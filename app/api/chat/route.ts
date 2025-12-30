import OpenAI from "openai";
import fs from "fs";
import path from "path";

export const runtime = "nodejs"; // Node runtime (Vercel serverless)
export const dynamic = "force-dynamic"; // avoid caching

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Msg = { role: "user" | "assistant"; content: string };

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// ---- helpers ----

function safeReadText(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function walkFiles(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    // skip hidden + junk
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      // skip node_modules if it ever exists inside knowledge
      if (e.name === "node_modules") continue;
      walkFiles(full, out);
    } else {
      // only index text-like files
      const ext = path.extname(e.name).toLowerCase();
      if ([".md", ".txt", ".json"].includes(ext)) out.push(full);
    }
  }
  return out;
}

function chunkText(text: string, chunkSize = 900, overlap = 120) {
  const cleaned = text.replace(/\r/g, "");
  const chunks: string[] = [];
  let i = 0;

  while (i < cleaned.length) {
    const slice = cleaned.slice(i, i + chunkSize);
    chunks.push(slice);
    i += chunkSize - overlap;
    if (chunks.length > 2000) break; // hard safety cap
  }
  return chunks;
}

function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function scoreChunk(chunk: string, terms: string[]) {
  const hay = chunk.toLowerCase();
  let score = 0;

  for (const t of terms) {
    // simple frequency count
    const hits = hay.split(t).length - 1;
    score += hits;
  }

  // small bonus if the chunk contains key kazpa terms
  const bonuses = ["vistax", "vistaone", "mt5", "vps", "license", "drawdown", "risk"];
  for (const b of bonuses) {
    if (hay.includes(b)) score += 1;
  }

  return score;
}

function buildContext(query: string) {
  // If knowledge folder isn't present, return empty context.
  if (!fs.existsSync(KNOWLEDGE_DIR)) return "";

  const files = walkFiles(KNOWLEDGE_DIR);
  if (!files.length) return "";

  const terms = tokenize(query);
  if (!terms.length) return "";

  // Read + chunk + score
  const scored: { score: number; file: string; chunk: string }[] = [];

  for (const file of files) {
    const text = safeReadText(file);
    if (!text) continue;

    // Keep huge files under control
    const chunks = chunkText(text, 900, 120);

    for (const ch of chunks) {
      const s = scoreChunk(ch, terms);
      if (s > 0) {
        scored.push({ score: s, file, chunk: ch });
      }
    }
  }

  if (!scored.length) return "";

  scored.sort((a, b) => b.score - a.score);

  // Take top N chunks, but cap total chars so prompt stays stable
  const TOP = 8;
  const MAX_CHARS = 6000;

  let total = 0;
  const picked: string[] = [];

  for (const item of scored.slice(0, 200)) {
    const relPath = path.relative(process.cwd(), item.file);
    const block = `SOURCE: ${relPath}\n---\n${item.chunk.trim()}\n`;

    if (total + block.length > MAX_CHARS) break;
    picked.push(block);
    total += block.length;

    if (picked.length >= TOP) break;
  }

  return picked.join("\n");
}

// ---- handler ----

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = body?.messages ?? [];

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY (set it in .env.local and on Vercel)" },
        { status: 500 }
      );
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const context = lastUser ? buildContext(lastUser) : "";

    const system = `
You are kazpaGPT for kazpa.io.

Rules:
- Be concise and practical.
- Use ONLY the provided CONTEXT when it is relevant.
- If the user asks about trading advice, include a risk disclaimer and never guarantee results.
- If the answer is not in CONTEXT, say you don’t know and ask what info you need or where to find it.

CONTEXT (kazpa knowledge excerpts):
${context || "(no matching context found)"}
    `.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "developer", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.2,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";

    return Response.json({ text, usedContext: Boolean(context) });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
