import OpenAI from "openai";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Msg = { role: "user" | "assistant"; content: string };

type Chunk = {
  id: string;
  file: string;
  text: string;
  score: number;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// --- Simple helpers (keep it stable / fast) ---
function safeReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function listKnowledgeFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listKnowledgeFiles(full));
    } else {
      // include common text formats
      const ext = path.extname(e.name).toLowerCase();
      if ([".txt", ".md", ".markdown"].includes(ext)) out.push(full);
    }
  }
  return out;
}

function chunkText(text: string, maxLen = 1200): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const parts: string[] = [];

  // naive paragraph chunking
  const paras = cleaned.split(/\n\s*\n/g);
  let buf = "";
  for (const p of paras) {
    const next = (buf ? buf + "\n\n" : "") + p;
    if (next.length > maxLen) {
      if (buf) parts.push(buf);
      buf = p.slice(0, maxLen);
    } else {
      buf = next;
    }
  }
  if (buf) parts.push(buf);

  // hard-split any oversized chunk
  const final: string[] = [];
  for (const c of parts) {
    if (c.length <= maxLen) final.push(c);
    else {
      for (let i = 0; i < c.length; i += maxLen) {
        final.push(c.slice(i, i + maxLen));
      }
    }
  }
  return final;
}

// lightweight scoring (keyword overlap)
function scoreChunk(query: string, chunk: string) {
  const q = query.toLowerCase();
  const c = chunk.toLowerCase();

  const qTerms = q
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .slice(0, 24);

  let score = 0;
  for (const t of qTerms) {
    if (t.length < 3) continue;
    if (c.includes(t)) score += 1;
  }

  // small bonus for exact phrase
  if (q.length >= 6 && c.includes(q)) score += 3;

  return score;
}

function buildKnowledgeSnippets(latestUserMsg: string, maxSnippets = 10) {
  const files = listKnowledgeFiles(KNOWLEDGE_DIR);
  if (!files.length) return { snippets: [] as string[] };

  const chunks: Chunk[] = [];

  for (const f of files) {
    const rel = path.relative(KNOWLEDGE_DIR, f).replace(/\\/g, "/");
    const raw = safeReadFile(f);
    const parts = chunkText(raw, 1200);

    parts.forEach((text, idx) => {
      const score = scoreChunk(latestUserMsg, text);
      if (score > 0) {
        chunks.push({
          id: `${rel}#${idx + 1}`,
          file: rel,
          text,
          score,
        });
      }
    });
  }

  chunks.sort((a, b) => b.score - a.score);
  const top = chunks.slice(0, maxSnippets);

  // IMPORTANT: do NOT include filenames/ids here (prevents the model from echoing “sources”)
  const snippets = top.map((c, i) => `K${i + 1}:\n${c.text}`);
  return { snippets };
}

function buildSystemPrompt(snippets: string[]) {
  return `
You are kazpaGPT for kazpa.io.

Your job:
- Answer questions about kazpa setup, member dashboard, VistaONE/VistaX, VPS/MT5 setup, troubleshooting, risk rules, and general platform guidance.
- Be concise, clear, and practical.
- DO NOT mention, quote, or reference internal documents, filenames, “sources”, IDs, chunks, or citations.
- If something is unknown or not covered, say what info you need to answer.

Compliance & safety:
- No financial advice. No guarantees of profit.
- If user asks “should I trade / what should I do / how much will I make”, respond with general education + a brief risk disclaimer.

If relevant, use the knowledge below to answer (silently). Do not reveal it.

KNOWLEDGE (internal):
${snippets.length ? snippets.join("\n\n---\n\n") : "No internal knowledge provided."}
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages ?? [];

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const latestUserMsg =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const { snippets } = buildKnowledgeSnippets(latestUserMsg, 12);
    const system = buildSystemPrompt(snippets);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "developer", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.3,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";

    // Return ONLY the answer text. No sources.
    return Response.json({ text });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
