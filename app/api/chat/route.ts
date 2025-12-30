import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Msg = { role: "user" | "assistant"; content: string };

type Chunk = {
  id: string;
  file: string;     // relative path within /knowledge
  text: string;
};

type VectorChunk = Chunk & {
  embedding: number[];
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4.1-mini";

const MAX_FILE_BYTES = 1_000_000;         // skip giant files
const CHUNK_CHARS = 1200;                 // chunk size
const CHUNK_OVERLAP = 150;                // overlap
const TOP_K = 6;                          // retrieved chunks
const MAX_CONTEXT_CHARS = 10_000;         // keep prompts under control

let CACHE:
  | null
  | {
      loadedAt: number;
      vectors: VectorChunk[];
    } = null;

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

function normalizeWS(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function chunkText(text: string) {
  const t = normalizeWS(text);
  if (!t) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + CHUNK_CHARS, t.length);
    chunks.push(t.slice(i, end));
    if (end === t.length) break;
    i = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

async function listKnowledgeFiles(dirAbs: string, baseAbs: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dirAbs, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dirAbs, e.name);
    if (e.isDirectory()) {
      out.push(...(await listKnowledgeFiles(full, baseAbs)));
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if ([".md", ".txt", ".json"].includes(ext)) {
        out.push(path.relative(baseAbs, full));
      }
    }
  }
  return out;
}

async function loadAndChunkKnowledge(): Promise<Chunk[]> {
  const knowledgeAbs = path.join(process.cwd(), "knowledge");
  const relFiles = await listKnowledgeFiles(knowledgeAbs, knowledgeAbs);

  const chunks: Chunk[] = [];
  let chunkCount = 0;

  for (const rel of relFiles) {
    const abs = path.join(knowledgeAbs, rel);
    const stat = await fs.stat(abs);
    if (stat.size > MAX_FILE_BYTES) continue;

    const raw = await fs.readFile(abs, "utf8");
    const pieces = chunkText(raw);

    for (const p of pieces) {
      chunkCount++;
      chunks.push({
        id: `c${chunkCount}`,
        file: rel.replace(/\\/g, "/"),
        text: p,
      });
    }
  }

  return chunks;
}

async function embedTexts(texts: string[]) {
  const resp = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return resp.data.map((d) => d.embedding);
}

async function buildVectorCache(): Promise<VectorChunk[]> {
  const chunks = await loadAndChunkKnowledge();

  // Embed in batches (keeps payloads smaller)
  const vectors: VectorChunk[] = [];
  const BATCH = 64;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embeddings = await embedTexts(batch.map((c) => c.text));
    for (let j = 0; j < batch.length; j++) {
      vectors.push({ ...batch[j], embedding: embeddings[j] });
    }
  }

  return vectors;
}

async function getVectors(): Promise<VectorChunk[]> {
  const now = Date.now();
  if (CACHE && now - CACHE.loadedAt < CACHE_TTL_MS) return CACHE.vectors;

  const vectors = await buildVectorCache();
  CACHE = { loadedAt: now, vectors };
  return vectors;
}

function buildContext(top: VectorChunk[]) {
  // Keep context tight so the model doesn’t drown
  let context = "";
  const sources: { file: string; chunkId: string }[] = [];

  for (const c of top) {
    const block = `\n\n[Source: ${c.file} • ${c.id}]\n${c.text}`;
    if (context.length + block.length > MAX_CONTEXT_CHARS) break;
    context += block;
    sources.push({ file: c.file, chunkId: c.id });
  }

  return { context: context.trim(), sources };
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY (set it in Vercel + .env.local)" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: Msg[] = body?.messages ?? [];

    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.trim();
    const query = lastUser || "";

    const vectors = await getVectors();

    // Embed the query
    const qEmb = (await embedTexts([query]))[0];

    // Rank
    const scored = vectors
      .map((c) => ({
        c,
        s: cosineSimilarity(qEmb, c.embedding),
      }))
      .sort((a, b) => b.s - a.s)
      .slice(0, TOP_K)
      .map((x) => x.c);

    const { context, sources } = buildContext(scored);

    const system = `
You are kazpaGPT for kazpa.io.

Use ONLY the provided knowledge context when answering kazpa-specific questions.
If the context does not contain the answer, say you don’t have it yet and suggest what doc to add.

Be concise, practical, step-by-step when helpful.
If asked for trading advice: do NOT give guarantees; include a brief risk disclaimer.

When you use the knowledge, cite sources like: (Source: filename • chunkId)
`.trim();

    const trimmedHistory = messages.slice(-12); // keep it snappy

    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "developer", content: system },
        {
          role: "user",
          content:
            `KNOWLEDGE CONTEXT:\n${context || "(no relevant context found)"}\n\n` +
            `USER QUESTION:\n${query}`,
        },
        // Optional: include some prior messages (keeps chat flow)
        ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const text = completion.choices?.[0]?.message?.content ?? "";

    return Response.json({ text, sources });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
