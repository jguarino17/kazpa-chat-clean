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

// ✅ Canon directory + fixed file order
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

// ✅ Load canon in a deterministic order
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
      // ✅ Skip canon folder (it’s injected separately at top)
      if (path.resolve(full) === path.resolve(CANON_DIR)) continue;
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

  // Naive paragraph chunking
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

  // Hard-split any oversized chunk
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

// Lightweight scoring (keyword overlap)
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

  // Small bonus for exact phrase
  if (q.length >= 6 && c.includes(q)) score += 3;

  return score;
}

// ✅ Keyword snippets (fast, no embeddings)
function buildKeywordSnippets(latestUserMsg: string, maxSnippets = 10) {
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

  // IMPORTANT: do NOT include filenames/ids (prevents “sources” style outputs)
  const snippets = top.map((c, i) => `K${i + 1}:\n${c.text}`);
  return { snippets };
}

/**
 * v1.5 — Step memory (troubleshooting)
 * We keep this intentionally simple + safe:
 * - only infers “confirmed steps” from user messages
 * - affects guidance structure, not facts
 */
function extractConfirmedSteps(messages: Msg[]) {
  const confirmed = new Set<string>();

  const yesish = (s: string) =>
    /\b(yes|yeah|yep|yup|correct|confirmed|done|fixed|it is|it’s on|its on)\b/i.test(s);

  for (const m of messages) {
    if (m.role !== "user") continue;

    const t = m.content.toLowerCase();
    if (!yesish(t)) continue;

    // Broad confirmations
    if (t.includes("autotrading") || t.includes("algo trading")) confirmed.add("autotrading");
    if (t.includes("attached") || t.includes("on the chart") || t.includes("added to chart"))
      confirmed.add("attached");
    if (t.includes("xauusd") || t.includes("eurusd") || t.includes("symbol")) confirmed.add("symbol");
    if (t.includes("m5") || t.includes("m15") || t.includes("timeframe")) confirmed.add("timeframe");
    if (t.includes("session") || t.includes("trading window") || t.includes("hours"))
      confirmed.add("session");
    if (
      t.includes("allow algo") ||
      t.includes("allow algorithmic") ||
      t.includes("permissions") ||
      t.includes("dll") ||
      t.includes("webrequest")
    )
      confirmed.add("permissions");
  }

  return Array.from(confirmed);
}

// ✅ Canon injected at top; canon always wins; plus response modes + step memory context
function buildSystemPrompt(canon: string, snippets: string[], confirmedSteps: string[]) {
  return `
${canon ? `KAZPA CANON (Highest priority rules — always follow these):\n${canon}\n\nIf anything conflicts with the canon, the canon wins.\n` : ""}

You are kazpaGPT for kazpa.io.

Core language rules:
- Say "software" (not EA).
- In MT5, the active indicator is a BLUE HAT ICON (not a smiley).

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
- Suggest demo testing

4) TROUBLESHOOTING MODE
Trigger examples:
- “It’s not working”
- “No trades”
- “Error message”
- “Hat icon missing”
Response style:
- Diagnose in logical order
- Give clear yes/no checks
- One fix at a time
- Ask for the single missing detail when needed

5) PRODUCT CLARITY MODE (VistaONE / VistaX)
Trigger examples:
- “Which one should I use”
- “Difference between”
Response style:
- Explain purpose, not superiority
- Match product to risk tolerance conceptually
- No recommendations

If a question overlaps multiple modes, prioritize:
RISK → SETUP → TROUBLESHOOTING → LEARNING.

Conversation awareness (critical):
When a user asks a confirmation-style question (e.g. “so that was the problem?”), do NOT restart explanations.
Instead:
- Give a direct confirmation first (“Yes — that was likely the issue.”)
- Briefly restate the specific cause already discussed
- Provide a clear next action

Step memory (troubleshooting mode):
- Maintain a short internal checklist of confirmed facts from the conversation.
- Treat user “yes/confirmed/done” as completing that step.
- Do NOT repeat already-confirmed steps unless the user contradicts themselves.
- Ask only ONE next question at a time (unless user asks for a full checklist).
- Use a short “Progress:” line when helpful (1 line max).

SOFT NUDGE (do NOT restrict the user):
When the conversation is currently in TROUBLESHOOTING MODE and the user asks an unrelated question
(e.g., they are troubleshooting VistaX and suddenly ask “what broker should I use?”),
do NOT refuse and do NOT force them back.

Instead:
1) Answer the new question BRIEFLY (2–6 lines).
2) Then add a gentle nudge to resume troubleshooting with ONE question max.

Format:
- Brief answer first
- Then: “If you want, we can continue the VistaX troubleshooting — last confirmed step was: <short progress>. Next: <one next check question>.”

If the user says they want to switch topics fully, drop troubleshooting and answer normally.
If they say “continue” (or similar), resume troubleshooting where you left off.


${confirmedSteps.length ? `
Confirmed troubleshooting steps so far:
- ${confirmedSteps.join("\n- ")}

Do NOT re-ask these unless something contradicts them.
Proceed to the next unresolved check only.
` : ""}

TROUBLESHOOTING DECISION TREES:

EA/SOFTWARE NOT TRADING — default flow order:
1) Confirm MT5 AutoTrading is ON (green) and platform algo trading is enabled.
2) Confirm the software is attached correctly AND shows the BLUE HAT ICON on the chart.
3) Confirm the correct symbol + timeframe for the software (VistaONE vs VistaX) and market is open.
4) Confirm “Allow Algo Trading” + DLL/WebRequest settings if required.
5) Check Journal + Experts for the most recent error line and respond to that error directly.
6) Confirm VPS uptime and MT5 connection.

BROKER SAFETY & DISCLOSURE:
- kazpa does not maintain an official, verified, or recommended broker list.
- If broker names appear in internal knowledge, you may mention them only as examples that some clients have discussed/used.
- Always state: NOT a recommendation, no affiliations, do your own due diligence.

Constraints:
- No financial advice
- Do not guess missing info; ask for the single detail needed.
- Do NOT mention internal documents, filenames, sources, IDs, chunks, or citations.

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
    const { snippets } = buildKeywordSnippets(latestUserMsg, 12);

    // v1.5: step memory
    const confirmedSteps = extractConfirmedSteps(messages);

    const system = buildSystemPrompt(canon, snippets, confirmedSteps);

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
