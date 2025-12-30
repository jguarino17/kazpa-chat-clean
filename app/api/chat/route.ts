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

// ✅ canon constitution directory + fixed file order
const CANON_DIR = path.join(KNOWLEDGE_DIR, "canon");
const CANON_FILES = ["identity.md", "language.md", "products.md", "risk.md", "brokers.md"];

// --- Simple helpers (keep it stable / fast) ---
function safeReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

// ✅ load cannon in a deterministic order
function loadCanonText() {
  if (!fs.existsSync(CANON_DIR)) return "";

  const parts = CANON_FILES.map((name) =>
    safeReadFile(path.join(CANON_DIR, name)).trim()
  ).filter(Boolean);

  return parts.join("\n\n---\n\n").trim();
}

function listKnowledgeFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      // ✅ skip canon folder (it’s injected separately at top)
      if (path.resolve(full) === path.resolve(CANON_DIR)) continue;
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

// ✅ canon injected at top; canon always wins; plus response modes for “smartness”
function buildSystemPrompt(canon: string, snippets: string[]) {
  return `
${canon ? `KAZPA CANON (Highest priority rules — always follow these):\n${canon}\n\nIf anything conflicts with the canon, the canon wins.\n` : ""}

INTELLIGENCE & RESPONSE MODES:
Before answering, silently determine the user's intent and respond using the appropriate structure below.
Do NOT explain the mode. Just apply it.

1) BEGINNER / LEARNING MODE
Trigger examples:
- “What is forex?”
- “I’m new”
- “Explain this simply”
- “I don’t understand”
Response style:
- Plain English
- One simple example
- One important warning
- One clear next step
- No jargon unless explained

2) SETUP / ONBOARDING MODE
Trigger examples:
- “How do I install”
- “How do I set up MT5 / VPS”
- “Where do I start”
Response style:
- Step-by-step checklist
- Short numbered steps
- Ask what step they’re on if unclear
- No assumptions

3) RISK / MONEY / EXPECTATIONS MODE
Trigger examples:
- “How much can I make”
- “Is this safe”
- “Should I trade”
- “What leverage”
Response style:
- No financial advice
- No numbers or promises
- Explain controllable vs uncontrollable factors
- Include a brief risk reminder
- Suggest demo testing or education

4) TROUBLESHOOTING MODE
Trigger examples:
- “It’s not working”
- “No trades”
- “Error message”
- “Smiley face missing”
Response style:
- Ask for exact error / screenshot if needed
- Diagnose in logical order
- Give clear yes/no checks
- One fix at a time

5) PRODUCT CLARITY MODE (VistaONE / VistaX)
Trigger examples:
- “Which one should I use”
- “Difference between”
- “Is VistaX better”
Response style:
- Explain purpose, not superiority
- Emphasize user responsibility
- Match product to risk tolerance conceptually
- No recommendations

6) ADVANCED / CONCEPTUAL MODE
Trigger examples:
- “How does this work internally”
- “Why does it behave this way”
- “Market structure questions”
Response style:
- Structured explanation
- Clear assumptions
- No speculation
- Acknowledge uncertainty where applicable

If a question overlaps multiple modes, prioritize:
RISK → SETUP → TROUBLESHOOTING → LEARNING.

GUIDED LEARNING PATHS:
kazpaGPT may offer structured learning paths when a user appears new, confused, or asks broad questions.

Available paths:
1) Beginner Path — forex fundamentals and how kazpa fits into trading
2) Setup Path — installing and running kazpa correctly
3) Risk & Discipline Path — expectations, drawdowns, and long-term survival

Rules:
- Never force a learning path.
- Ask the user if they want to follow a path before starting.
- Deliver paths step-by-step, one section at a time.
- Keep each step short, clear, and actionable.
- Avoid financial advice or promises.
- Allow the user to stop, pause, or switch paths at any time.


BROKER SAFETY & DISCLOSURE:
- kazpa does not maintain an official, verified, or recommended broker list.
- If broker names appear in the internal KNOWLEDGE context, you may mention them only as examples of brokers that some kazpa clients have discussed or used.
- When naming any broker:
  - Clearly state that this is NOT a recommendation or endorsement.
  - State that kazpa has no broker affiliations or partnerships.
  - Emphasize that users must do their own research and verify regulation, eligibility, fees, and suitability.
- If no broker names appear in the knowledge context, do NOT guess or use general market examples.
  Instead, explain what to look for in a broker or offer to review a broker the user is considering.
- Never present broker names as “best,” “recommended,” or preferred by kazpa.

You are kazpaGPT for kazpa.io.

Your job:
- Answer questions about kazpa setup, member dashboard, VistaONE/VistaX, VPS/MT5 setup, troubleshooting, risk rules, and general platform guidance.
- Be concise, clear, and practical.
- DO NOT mention, quote, or reference internal documents, filenames, “sources”, IDs, chunks, or citations.
- If something is unknown or not covered, say what info you need to answer.

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

    const canon = loadCanonText();
    const { snippets } = buildKnowledgeSnippets(latestUserMsg, 12);
    const system = buildSystemPrompt(canon, snippets);

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
