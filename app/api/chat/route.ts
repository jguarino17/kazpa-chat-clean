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

/**
 * v1.6 — Conversational Intelligence Control (lightweight, safe)
 * Goal: make responses feel “ChatGPT-level” without changing your knowledge system.
 * Adds:
 * - intent detection
 * - topic detection
 * - pivot detection (soft nudge behavior)
 * - multi-question handling
 * - reduces repetitive greetings
 */

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

function detectIntent(userMsg: string): "learn" | "setup" | "risk" | "troubleshoot" | "broker" | "general" {
  const t = normalize(userMsg);

  // troubleshooting signals
  const trouble = [
    "not working",
    "doesn't work",
    "isn't working",
    "no trades",
    "not trading",
    "not placing trades",
    "isn't placing trades",
    "error",
    "journal",
    "experts",
    "won't attach",
    "won't load",
    "not loading",
    "missing",
    "stuck",
    "help me fix",
    "issue",
    "problem",
  ];
  if (trouble.some((k) => t.includes(k))) return "troubleshoot";

  // setup signals
  const setup = [
    "how do i",
    "how to",
    "install",
    "set up",
    "setup",
    "activate",
    "license",
    "download",
    "mql5",
    "experts",
    "advisors",
    "vps",
    "mt5",
    "metatrader",
    "allow algo",
    "dll",
    "webrequest",
  ];
  if (setup.some((k) => t.includes(k))) return "setup";

  // broker signals
  const broker = [
    "broker",
    "which broker",
    "what broker",
    "best broker",
    "raw spread",
    "leverage",
    "server name",
    "account type",
  ];
  if (broker.some((k) => t.includes(k))) return "broker";

  // risk signals
  const risk = [
    "risk",
    "drawdown",
    "lot size",
    "margin",
    "equity stop",
    "safe",
    "aggressive",
    "conservative",
    "how much can i make",
    "profit",
    "guarantee",
    "returns",
  ];
  if (risk.some((k) => t.includes(k))) return "risk";

  // learning signals
  const learn = [
    "what is forex",
    "i'm new",
    "im new",
    "beginner",
    "explain",
    "how does",
    "what does",
    "fundamentals",
    "technicals",
  ];
  if (learn.some((k) => t.includes(k))) return "learn";

  return "general";
}

function detectTopic(userMsg: string) {
  const t = normalize(userMsg);
  if (t.includes("vistax")) return "VistaX";
  if (t.includes("vistaone") || t.includes("vista one")) return "VistaONE";
  if (t.includes("vps")) return "VPS";
  if (t.includes("mt5") || t.includes("metatrader")) return "MT5";
  if (t.includes("license") || t.includes("activate")) return "License";
  if (t.includes("broker")) return "Broker";
  if (t.includes("risk") || t.includes("drawdown") || t.includes("margin")) return "Risk";
  return "General";
}

function lastAssistantLooksLikeTroubleshooting(messages: Msg[]) {
  const lastA = [...messages].reverse().find((m) => m.role === "assistant")?.content || "";
  const t = normalize(lastA);
  return (
    t.includes("progress:") ||
    t.includes("confirm") ||
    t.includes("next check") ||
    t.includes("journal") ||
    t.includes("experts") ||
    t.includes("autotrading") ||
    t.includes("blue hat")
  );
}

function looksLikeMultiQuestion(userMsg: string) {
  const t = userMsg.trim();
  // multiple ? or numbered list often means multi-question
  const qCount = (t.match(/\?/g) || []).length;
  if (qCount >= 2) return true;
  if (/\n\s*\d+\)/.test(t) || /\n\s*\d+\./.test(t)) return true;
  if (t.includes(" and ") && qCount >= 1) return true;
  return false;
}

// ✅ Canon injected at top; canon always wins; plus response modes + step memory context
function buildSystemPrompt(
  canon: string,
  snippets: string[],
  confirmedSteps: string[],
  v16: {
    intent: string;
    topic: string;
    pivoted: boolean;
    multiQ: boolean;
  }
) {
  return `
${canon ? `KAZPA CANON (Highest priority rules — always follow these):\n${canon}\n\nIf anything conflicts with the canon, the canon wins.\n` : ""}

You are kazpaGPT for kazpa.io (v1.6).

Core language rules (non-negotiable):
- Say "software" (not EA).
- In MT5, the active indicator is a BLUE HAT ICON (not a smiley).
- Never guarantee profits or results.
- Never give financial advice.
- Never claim kazpa manages funds. User is in full control.

Conversation quality rules (v1.6):
- Do NOT start with repetitive greetings (“Hello again”, “Hey there”) unless it’s truly the first message.
- If the user asks multiple questions at once, answer them in a numbered list (1), (2), (3) so nothing gets missed.
- If the user asks a confirmation-style question (“so that was the problem?”), answer YES/NO first, then 1–2 lines why, then the next action.
- If the user pivots topics mid-troubleshoot, answer the new question briefly first, then add a gentle nudge to resume troubleshooting with ONE question max.
- Keep tone calm, structured, professional.

INTELLIGENCE & RESPONSE MODES:
Before answering, silently determine the user's intent and respond using the appropriate structure below.
Do NOT explain the mode. Just apply it.

1) BEGINNER / LEARNING MODE
Response style:
- Plain English
- One simple example
- One important warning
- One clear next step

2) SETUP / ONBOARDING MODE
Response style:
- Step-by-step checklist
- Short numbered steps
- Ask what step they’re on if unclear
- No assumptions

3) RISK / MONEY / EXPECTATIONS MODE
Response style:
- No financial advice
- No numbers or promises
- Explain controllable vs uncontrollable factors
- Include a brief risk reminder
- Suggest demo testing

4) TROUBLESHOOTING MODE
Response style:
- Diagnose in logical order
- One fix at a time
- Ask for the single missing detail when needed
- Use a short “Progress:” line when helpful (1 line max)

5) PRODUCT CLARITY MODE (VistaONE / VistaX)
Response style:
- Explain purpose, not superiority
- Match product to risk tolerance conceptually
- No recommendations

If a question overlaps multiple modes, prioritize:
RISK → SETUP → TROUBLESHOOTING → LEARNING.

SOFT NUDGE (do NOT restrict the user):
When the conversation is currently in TROUBLESHOOTING MODE and the user asks an unrelated question,
do NOT refuse and do NOT force them back.

Instead:
1) Answer the new question BRIEFLY (2–6 lines).
2) Then add a gentle nudge to resume troubleshooting with ONE question max.

Format:
- Brief answer first
- Then: “If you want, we can continue the <topic> troubleshooting — Progress: <short progress>. Next: <one next check question>.”

If the user says they want to switch topics fully, drop troubleshooting and answer normally.
If they say “continue” (or similar), resume troubleshooting where you left off.

v1.6 internal signals (do not reveal):
- intent: ${v16.intent}
- topic: ${v16.topic}
- pivoted: ${v16.pivoted ? "yes" : "no"}
- multi-question: ${v16.multiQ ? "yes" : "no"}

${confirmedSteps.length ? `
Confirmed troubleshooting steps so far:
- ${confirmedSteps.join("\n- ")}

Do NOT re-ask these unless something contradicts them.
Proceed to the next unresolved check only.
` : ""}

TROUBLESHOOTING DECISION TREES:

SOFTWARE NOT TRADING — default flow order:
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

    // v1.6 signals
    const intent = detectIntent(latestUserMsg);
    const topic = detectTopic(latestUserMsg);
    const multiQ = looksLikeMultiQuestion(latestUserMsg);

    // pivot detection: last assistant seemed to be in troubleshooting, but user is now asking something else
    const lastWasTrouble = lastAssistantLooksLikeTroubleshooting(messages);
    const pivoted = lastWasTrouble && intent !== "troubleshoot";

    const canon = loadCanonText();
    const { snippets } = buildKeywordSnippets(latestUserMsg, 12);

    // v1.5: step memory
    const confirmedSteps = extractConfirmedSteps(messages);

    const system = buildSystemPrompt(canon, snippets, confirmedSteps, {
      intent,
      topic,
      pivoted,
      multiQ,
    });

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
