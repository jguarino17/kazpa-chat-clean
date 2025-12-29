// lib/knowledge.ts
import fs from "fs";
import path from "path";

type DocChunk = {
  id: string;
  file: string;
  relPath: string;
  text: string;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// Simple in-memory cache so we don't re-read every request
let CACHE: {
  loadedAt: number;
  chunks: DocChunk[];
  canonText: string;
} | null = null;

function safeReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const items = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  for (const item of items) {
    const full = path.join(dir, item.name);

    // Skip common junk folders
    if (item.isDirectory()) {
      if (item.name.startsWith(".")) continue;
      if (item.name === "node_modules") continue;
      if (item.name === ".next") continue;
      out.push(...listFilesRecursive(full));
      continue;
    }

    // Only index text-like files
    const lower = item.name.toLowerCase();
    if (lower.endsWith(".txt") || lower.endsWith(".md")) out.push(full);
  }
  return out;
}

function normalizeText(s: string) {
  return (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Chunk by paragraphs with a max character budget.
// This is intentionally simple and fast.
function chunkText(text: string, maxChars = 1200): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  const paras = t.split("\n\n").map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let buf = "";

  for (const p of paras) {
    if (!buf) {
      buf = p;
      continue;
    }

    // If adding this paragraph stays within limit, append
    if ((buf.length + 2 + p.length) <= maxChars) {
      buf += "\n\n" + p;
      continue;
    }

    // Otherwise, push current buffer and start new
    chunks.push(buf);
    buf = p;
  }

  if (buf) chunks.push(buf);

  // Also split any chunk that's still huge (rare)
  const final: string[] = [];
  for (const c of chunks) {
    if (c.length <= maxChars * 1.5) {
      final.push(c);
    } else {
      // Hard split
      for (let i = 0; i < c.length; i += maxChars) {
        final.push(c.slice(i, i + maxChars));
      }
    }
  }

  return final;
}

function tokenize(q: string): string[] {
  return normalizeText(q)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 3)
    .slice(0, 60);
}

function scoreChunk(queryTokens: string[], chunkText: string): number {
  const hay = chunkText.toLowerCase();

  let score = 0;
  for (const tok of queryTokens) {
    // quick containment check
    if (hay.includes(tok)) score += 1;
  }

  // Boost for very important terms
  const boosts = ["mt5", "mql5", "experts", "advisors", "autotrading", "vistax", "vistaone", "vista", "vps", "license"];
  for (const b of boosts) {
    if (queryTokens.includes(b) && hay.includes(b)) score += 2;
  }

  return score;
}

function loadKnowledgeCache(): { chunks: DocChunk[]; canonText: string } {
  const now = Date.now();

  // Refresh cache every 60 seconds in dev
  if (CACHE && (now - CACHE.loadedAt) < 60_000) return CACHE;

  const allFiles = listFilesRecursive(KNOWLEDGE_DIR);

  // Canon bundle: keep separate and always include in system prompt
  const canonDir = path.join(KNOWLEDGE_DIR, "canon");
  const canonFiles = fs.existsSync(canonDir)
    ? listFilesRecursive(canonDir).filter((f) => f.toLowerCase().endsWith(".md") || f.toLowerCase().endsWith(".txt"))
    : [];

  const canonParts: string[] = [];
  for (const f of canonFiles) {
    const rel = path.relative(KNOWLEDGE_DIR, f);
    const txt = normalizeText(safeReadFile(f));
    if (txt) canonParts.push(`## ${rel}\n${txt}`);
  }
  const canonText = canonParts.join("\n\n").trim();

  // Index chunks from everything else (including raw)
  const chunks: DocChunk[] = [];
  for (const filePath of allFiles) {
    const relPath = path.relative(KNOWLEDGE_DIR, filePath);

    // Skip canon files from chunk index (canon is injected separately)
    if (relPath.startsWith("canon" + path.sep) || relPath.startsWith("canon/")) continue;

    const fileText = normalizeText(safeReadFile(filePath));
    if (!fileText) continue;

    const pieces = chunkText(fileText, 1200);
    pieces.forEach((piece, idx) => {
      chunks.push({
        id: `${relPath}::${idx}`,
        file: path.basename(filePath),
        relPath,
        text: piece,
      });
    });
  }

  CACHE = { loadedAt: now, chunks, canonText };
  return CACHE;
}

// ✅ Used by route.ts: inject into system prompt
export function getCanonBundle(): string {
  const { canonText } = loadKnowledgeCache();
  return canonText || "(canon not found)";
}

// ✅ Used by route.ts: retrieve relevant snippets for a query
export function retrieveKnowledge(query: string, opts?: { maxChunks?: number }): string {
  const maxChunks = opts?.maxChunks ?? 6;
  const { chunks } = loadKnowledgeCache();

  const qTokens = tokenize(query);
  if (qTokens.length === 0) return "";

  const scored = chunks
    .map((c) => ({ c, s: scoreChunk(qTokens, c.text) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, maxChunks);

  if (scored.length === 0) return "";

  // Return labeled snippets so the model stays grounded
  return scored
    .map(({ c }) => {
      return `SOURCE: ${c.relPath}\n${c.text}`;
    })
    .join("\n\n---\n\n");
}
