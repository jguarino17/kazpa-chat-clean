import OpenAI from "openai";
import fs from "fs";
import path from "path";

type RagItem = {
  id: string;
  text: string;
  embedding: number[];
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ROOT = process.cwd();
const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");
const CANON_DIR = path.join(KNOWLEDGE_DIR, "canon");
const OUT_PATH = path.join(KNOWLEDGE_DIR, ".rag_index.json");

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
      if (path.resolve(full) === path.resolve(CANON_DIR)) continue; // skip canon
      out.push(...listKnowledgeFiles(full));
    } else {
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

  const final: string[] = [];
  for (const c of parts) {
    if (c.length <= maxLen) final.push(c);
    else for (let i = 0; i < c.length; i += maxLen) final.push(c.slice(i, i + maxLen));
  }
  return final;
}

async function embed(text: string) {
  const input = text.trim().slice(0, 2000);
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });
  const v = resp.data?.[0]?.embedding;
  if (!v || !Array.isArray(v)) throw new Error("No embedding returned");
  return v as number[];
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const files = listKnowledgeFiles(KNOWLEDGE_DIR);
  if (!files.length) {
    console.log("No knowledge files found.");
    process.exit(0);
  }

  const items: RagItem[] = [];

  for (const f of files) {
    const rel = path.relative(KNOWLEDGE_DIR, f).replace(/\\/g, "/");
    const raw = safeReadFile(f);
    const parts = chunkText(raw, 1200);

    for (let i = 0; i < parts.length; i++) {
      const text = parts[i].trim();
      if (!text) continue;

      const id = `${rel}#${i + 1}`;
      const embedding = await embed(text);

      items.push({ id, text, embedding });
      process.stdout.write(`Indexed ${id}\n`);
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(items, null, 2), "utf8");
  console.log(`\n✅ Wrote ${items.length} chunks to: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
