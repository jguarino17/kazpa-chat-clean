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
  source: string; // file path relative to /knowledge
  text: string;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// Keep it small & safe for token limits
const MAX_FILES = 200; // hard cap so you don’t accidentally scan 10k files
const MAX_CHUNKS_TO_USE = 6;
const CHUNK_SIZE = 900; // characters
const CHUNK_OVERLAP = 150; // characters
const MAX_CONTEXT_CHARS = 9000; // injected into prompt

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, source: string): Chunk[] {
  const chunks: Chunk[] = [];
  const clean = text.replace(/\r\n/g, "\n");
  let i = 0;
  let n = 0;

  while (i < clean.length) {
    const slice = clean.slice(i, i + CHUNK_SIZE);
    const trimmed = slice.trim();
    if (trimmed.length > 0) {
      chunks.push({
        id: `${source}#${n++}`,
        source,
        text: trimmed,
      });
    }
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function listFilesRec(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listFilesRec(full)));
    } else {
      out.push(full);
    }
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

function looksLikeTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return [".md", ".txt", ".json"].includes(ext);
}

// Very simple relevance: token overlap score
function scoreChunk(queryTokens: string[], chunkText: string) {
  const hay = normalize(chunkText);
  let score = 0;

  for (const t of queryTokens) {
    if (!t) continue;
    // Give slightly more weight to longer tokens (e.g., "vistax", "license", "drawdown")
    const weight = t.length >= 6 ? 2 : 1;
    if (hay.includes(t)) score += weight;
  }
  return score;
}

let CACHE: { loadedAt: number; chunks: Chunk[] } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

async function loadKnowledgeChunks(): Promise<Chunk[]> {
  const now = Date.now();
  if (CACHE && now - CACHE.loadedAt < CACHE_TTL_MS) return CACHE.chunks;

  try {
    const files = await listFilesRec(KNOWLEDGE_DIR);
    const textFiles = files.filter(looksLikeTextFile);

    const chunks: Chunk[] = [];
    for (const f of textFiles) {
      const raw = await fs.readFile(f, "utf8");
      const rel = path.relative(KNOWLEDGE_DIR, f).replace(/\\/g, "/");
      chunks.push(...chunkText(raw, rel));
      if (chunks.length > 5000) break; // keep memory sane
    }

    CACHE = { loadedAt: now, chunks };
    return chunks;
  } catch (e) {
    // If knowledge folder missing in prod for some reason, fail gracefully
    CACHE = { loadedAt: now, chunks: [] };
    return [];
  }
}

function pickRelevantChunks(all: Chunk[], userQuestion: string) {
  const q = normalize(userQuestion);
  const tokens = Array.from(new Set(q.split(" "))).filter(Boolean);

  // If user typed something extremely short, still try
  const scored = all
    .map((c) => ({ c, s: scoreChunk(tokens, c.text) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_CHUNKS_TO_USE)
    .map((x) => x.c);

  // Cap context size
  let total = 0;
  const picked: Chunk[] = [];
  for (const c of scored) {
    if (total + c.text.length > MAX_CONTEXT_CHARS) break;
    picked.push(c);
    total += c.text.length;
  }
  return picked;
}

function buildSystemPrompt(retrieved: Chunk[]) {
  const base = `
You are kazpaGPT for kazpa.io.

Rules:
- Be concise, practical, and specific.
- If asked for trading advice: include a clear risk disclaimer and avoid guarantees.
- If you don't know something about kazpa: say what info you need.
- Prefer the provided "Knowledge" context. If the context doesn’t contain the answer, say so.
- When you use knowledge, cite it like: (source: <file>).

Tone:
- Direct, helpful, no fluff.
`.trim();

  if (!retrieved.length) {
    return base + "\n\nKnowledge: (none loaded)";
  }

  const knowledgeBlock =
    "Knowledge (excerpts):\n" +
    retrieved
      .map(
        (c, i) =>
          `[#${i + 1}] (source: ${c.source})\n${c.text}\n`
      )
      .join("\n");

  return `${base}\n\n${knowledgeBlock}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages ?? [];

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY (set in Vercel + .env.local)" },
        { status: 500 }
      );
    }

    // Get last user message to retrieve relevant docs
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userQuestion = lastUser?.content ?? "";

    const allChunks = await loadKnowledgeChunks();
    const retrieved = pickRelevantChunks(allChunks, userQuestion);
    const system = buildSystemPrompt(retrieved);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "developer", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.3,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    return Response.json({
      text,
      debug: {
        usedKnowledgeChunks: retrieved.map((r) => r.source),
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}

// Optional: make GET helpful (so curl without -X POST doesn’t confuse you)
export async function GET() {
  return Response.json(
    { ok: false, hint: "Use POST /api/chat with { messages: [...] }" },
    { status: 405 }
  );
}
