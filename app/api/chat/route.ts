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

type UIButton = { id: string; label: string; value: string };
type UIBlock = {
  type: "wizard";
  title?: string;
  step?: string;
  buttons: UIButton[];
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

// ✅ Canon directory + fixed file order (deterministic)
const CANON_DIR = path.join(KNOWLEDGE_DIR, "canon");
const CANON_FILES = ["identity.md", "language.md", "products.md", "risk.md", "brokers.md"];

// -----------------------
// File helpers
// -----------------------
function safeReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

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
      // ✅ Skip canon folder (injected separately)
      if (path.resolve(full) === path.resolve(CANON_DIR)) continue;
      out.push(...listKnowledgeFiles(full));
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if ([".txt", ".md", ".markdown"].includes(ext)) out.push(full);
    }
  }
  return out;
}

// -----------------------
// Chunk + score (fast “RAG-lite”)
// -----------------------
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
    else {
      for (let i = 0; i < c.length; i += maxLen) {
        final.push(c.slice(i, i + maxLen));
      }
    }
  }
  return final;
}

// keyword overlap score
function scoreChunk(query: string, chunk: string) {
  const q = query.toLowerCase();
  const c = chunk.toLowerCase();

  const qTerms = q
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .slice(0, 28);

  let score = 0;
  for (const t of qTerms) {
    if (t.length < 3) continue;
    if (c.includes(t)) score += 1;
  }

  if (q.length >= 6 && c.includes(q)) score += 3;
  return score;
}

function buildKeywordSnippets(latestUserMsg: string, maxSnippets = 12) {
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

// -----------------------
// Step memory (improved for button messages)
// -----------------------
function extractConfirmedSteps(messages: Msg[]) {
  // last-mention-wins state
  const state: Record<string, boolean> = {};

  const set = (k: string, v: boolean) => {
    state[k] = v;
  };

  for (const m of messages) {
    if (m.role !== "user") continue;
    const t = (m.content || "").toLowerCase();

    // AutoTrading
    if (/(autotrading|algo trading|algorithmic trading)/i.test(t)) {
      if (/\b(off|disabled|isn't on|isnt on|not on)\b/i.test(t)) set("autotrading", false);
      if (/\b(on|enabled|green|turned on|is on)\b/i.test(t)) set("autotrading", true);
    }

    // Attached / blue hat
    if (/(blue hat|hat icon|attached|on the chart|added to chart)/i.test(t)) {
      if (/(no blue hat|not attached|isn't attached|isnt attached)/i.test(t)) set("attached", false);
      if (/(blue hat|hat icon|attached|on the chart|added to chart|i see)/i.test(t))
        set("attached", true);
    }

    // Symbol / timeframe hints
    if (/\bxauusd\b/i.test(t) || /\beurusd\b/i.test(t) || /\bsymbol\b/i.test(t)) {
      if (/(wrong|not sure|different)/i.test(t)) set("symbol", false);
      else set("symbol", true);
    }

    if (/\bm1\b|\bm5\b|\bm15\b|\btimeframe\b/i.test(t)) {
      if (/(wrong|not sure|different)/i.test(t)) set("timeframe", false);
      else set("timeframe", true);
    }

    // Session / market open
    if (/(market|session|hours|window)/i.test(t)) {
      if (/(closed|outside|not sure|unsure)/i.test(t)) set("session", false);
      if (/(open|within|in my session|during my session)/i.test(t)) set("session", true);
    }

    // Permissions
    if (/(dll|webrequest|permissions|allow algo|allow algorithmic)/i.test(t)) {
      if (/(off|disabled|not enabled|not sure|unsure)/i.test(t)) set("permissions", false);
      if (/(enabled|on|allowed|granted)/i.test(t)) set("permissions", true);
    }

    // VPS / connection
    if (/(vps|connection|no connection|data loading|disconnected|rdp)/i.test(t)) {
      if (/(no|not|issue|problem|unstable|disconnected)/i.test(t)) set("vps", false);
      if (/(stable|connected|running|uptime|ok)/i.test(t)) set("vps", true);
    }
  }

  return Object.entries(state)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

// -----------------------
// v1.6 — Intent / Topic / Pivot / MultiQ (kept)
// -----------------------
function looksLikeMultiQuestion(text: string) {
  const t = (text || "").trim();
  if (!t) return false;
  const qCount = (t.match(/\?/g) || []).length;
  if (qCount >= 2) return true;
  if (/\b(and also|also|plus|another question|one more thing)\b/i.test(t)) return true;
  const sentences = t.split(/[.!?]\s+/).filter(Boolean);
  if (sentences.length >= 3) return true;
  return false;
}

function detectIntent(latestUserMsg: string) {
  const t = (latestUserMsg || "").toLowerCase();

  if (
    /(not working|won't work|wont work|no trades|isn’t placing|isn't placing|error|issue|bug|stuck|missing|hat icon|blue hat|journal|experts|doesn't trade|doesnt trade)/i.test(
      t
    )
  )
    return "troubleshooting";

  if (/(install|setup|set up|vps|mt5|metatrader|activation|license|download|where do i|how do i)/i.test(t))
    return "setup";

  if (/(how much|profit|returns|safe|guarantee|leverage|risk|drawdown|should i)/i.test(t))
    return "risk";

  if (/(difference|which one|vistaone|vistax|compare)/i.test(t)) return "product";

  if (/(what is|explain|i’m new|im new|beginner|teach me)/i.test(t)) return "learning";

  return "general";
}

function detectTopic(latestUserMsg: string) {
  const t = (latestUserMsg || "").toLowerCase();

  if (/(vistax|xauusd|gold)/i.test(t)) return "vistax";
  if (/(vistaone|eurusd)/i.test(t)) return "vistaone";
  if (/(vps|rdp|remote desktop)/i.test(t)) return "vps";
  if (/(mt5|metatrader)/i.test(t)) return "mt5";
  if (/(license|activation|key)/i.test(t)) return "license";
  if (/(broker|spread|commission|server|suffix|symbol)/i.test(t)) return "broker";
  if (/(risk|drawdown|leverage|lot size|margin)/i.test(t)) return "risk";

  return "general";
}

function findLastUserMessage(messages: Msg[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function findPreviousUserMessage(messages: Msg[]) {
  let seenOne = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    if (!seenOne) {
      seenOne = true;
      continue;
    }
    return messages[i].content;
  }
  return "";
}

function didPivotTopic(messages: Msg[]) {
  const latest = findLastUserMessage(messages);
  const prev = findPreviousUserMessage(messages);
  if (!latest || !prev) return false;

  const latestTopic = detectTopic(latest);
  const prevTopic = detectTopic(prev);

  if (latestTopic !== prevTopic && latestTopic !== "general") return true;
  return false;
}

// -----------------------
// v1.7 — Wizard UI (server-generated, deterministic)
// -----------------------
function buildWizardUI(intent: string, topic: string, confirmedSteps: string[]): UIBlock | null {
  if (intent !== "troubleshooting") return null;

  const has = (k: string) => confirmedSteps.includes(k);

  // Determine product-specific expectations (labels only)
  const expected =
    topic === "vistax"
      ? { product: "VistaX", symbol: "XAUUSD", tf: "M5" }
      : topic === "vistaone"
      ? { product: "VistaONE", symbol: "EURUSD", tf: "M15" }
      : { product: "your software", symbol: "the correct symbol", tf: "the correct timeframe" };

  // Pick next step in a strict, human flow
  let step: UIBlock["step"] = "autotrading";

  if (!has("autotrading")) step = "autotrading";
  else if (!has("attached")) step = "attached";
  else if (!has("symbol") || !has("timeframe")) step = "chart";
  else if (!has("session")) step = "session";
  else if (!has("permissions")) step = "permissions";
  else step = "errors"; // after core checks, ask for logs

  const common = {
    type: "wizard" as const,
    step,
  };

  if (step === "autotrading") {
    return {
      ...common,
      title: "Confirm AutoTrading",
      buttons: [
        {
          id: "wiz-auto-yes",
          label: "✅ AutoTrading is ON",
          value: "MT5 AutoTrading is ON (green) and algorithmic trading is enabled.",
        },
        {
          id: "wiz-auto-no",
          label: "❌ It was OFF",
          value: "AutoTrading was OFF. I turned it ON now.",
        },
        {
          id: "wiz-auto-where",
          label: "📍 Where is it?",
          value: "Where do I find the AutoTrading button and algorithmic trading setting in MT5?",
        },
      ],
    };
  }

  if (step === "attached") {
    return {
      ...common,
      title: "Confirm software is attached",
      buttons: [
        {
          id: "wiz-attached-yes",
          label: "✅ Blue hat is showing",
          value: `Yes — ${expected.product} is attached and I see the BLUE HAT ICON on the chart.`,
        },
        {
          id: "wiz-attached-no",
          label: "❌ No blue hat",
          value: "I don’t see the blue hat icon / I’m not sure it’s attached correctly.",
        },
        {
          id: "wiz-attached-how",
          label: "📍 Show me how",
          value: "Show me exactly how to attach the software in MT5 and confirm the blue hat icon.",
        },
      ],
    };
  }

  if (step === "chart") {
    return {
      ...common,
      title: "Confirm correct chart",
      buttons: [
        {
          id: "wiz-chart-yes",
          label: `✅ ${expected.symbol} • ${expected.tf}`,
          value: `Confirmed — I am on ${expected.symbol} and timeframe ${expected.tf}.`,
        },
        {
          id: "wiz-chart-no",
          label: "❌ Different / unsure",
          value: "I’m on a different symbol/timeframe or I’m not sure what it should be.",
        },
        {
          id: "wiz-chart-how",
          label: "📍 How do I switch?",
          value: "How do I switch symbols/timeframes in MT5 and make sure the software is on the correct chart?",
        },
      ],
    };
  }

  if (step === "session") {
    return {
      ...common,
      title: "Market/session check",
      buttons: [
        {
          id: "wiz-session-yes",
          label: "✅ Market open",
          value: "Confirmed — the market is open and I’m within my configured session window.",
        },
        {
          id: "wiz-session-no",
          label: "❌ Not sure",
          value: "I’m not sure if the market is open or whether I’m in my session window.",
        },
        {
          id: "wiz-session-what",
          label: "🕒 Session rules?",
          value: "What are the session/time rules I should use for this software?",
        },
      ],
    };
  }

  if (step === "permissions") {
    return {
      ...common,
      title: "Permissions",
      buttons: [
        {
          id: "wiz-perm-yes",
          label: "✅ Permissions enabled",
          value: "Confirmed — Allow Algo Trading is enabled and any required DLL/WebRequest permissions are granted.",
        },
        {
          id: "wiz-perm-no",
          label: "❌ Not sure / disabled",
          value: "I’m not sure if the permissions are enabled (DLL/WebRequest/etc).",
        },
        {
          id: "wiz-perm-how",
          label: "📍 Where to enable?",
          value: "Show me where to enable Allow Algo Trading + DLL/WebRequest permissions in MT5.",
        },
      ],
    };
  }

  // errors (final step)
  return {
    ...common,
    title: "Logs (Experts/Journal)",
    buttons: [
      {
        id: "wiz-err-yes",
        label: "🧾 I see an error",
        value: "I see an error in Experts/Journal. I will paste the exact most recent line here.",
      },
      {
        id: "wiz-err-no",
        label: "✅ No errors",
        value: "I don’t see any errors in Experts or Journal.",
      },
      {
        id: "wiz-err-where",
        label: "📍 Where is that tab?",
        value: "Where do I find the Experts and Journal tabs in MT5?",
      },
    ],
  };
}

// -----------------------
// Prompt builder (canon always wins)
// -----------------------
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

You are kazpaGPT for kazpa.io.

Core language rules (mandatory):
- Say "software" (not EA).
- In MT5, the active software status is a BLUE HAT ICON (not a smiley).

v1.7 Behavior context:
- Detected intent: ${v16.intent}
- Detected topic: ${v16.topic}
- Pivoted topic: ${v16.pivoted ? "yes" : "no"}
- Multi-question: ${v16.multiQ ? "yes" : "no"}

CRITICAL CONVERSATION QUALITY RULES:
- Do NOT greet repeatedly (avoid "Hello again", avoid restarting).
- Do NOT restate the same checklist if the user already confirmed items.
- If user asks a confirmation-style question ("so that was the problem?"), answer directly first, then one next step.
- If user message is short ("hi", "test"), do NOT add fluff. Ask what they want help with in ONE line.

INTELLIGENCE & RESPONSE MODES:
Silently determine the user's mode and respond accordingly. Do NOT mention modes.

1) BEGINNER / LEARNING MODE
- Plain English
- One simple example
- One important warning
- One clear next step

2) SETUP / ONBOARDING MODE
- Step-by-step checklist
- Short numbered steps
- Ask what step they’re on if unclear
- No assumptions

3) RISK / MONEY / EXPECTATIONS MODE
- No financial advice
- No numbers or promises
- Explain controllable vs uncontrollable factors
- Brief risk reminder
- Suggest demo testing

4) TROUBLESHOOTING MODE
- Diagnose in logical order
- One fix at a time
- Ask for ONE missing detail when needed
- Use a 1-line "Progress:" only when helpful

5) PRODUCT CLARITY MODE (VistaONE / VistaX)
- Explain purpose, not superiority
- Match product to risk tolerance conceptually
- No recommendations

Priority if overlapping: RISK → SETUP → TROUBLESHOOTING → LEARNING → PRODUCT → GENERAL.

SOFT NUDGE (do NOT restrict the user):
If currently troubleshooting and the user asks an unrelated question:
1) Answer briefly (2–6 lines).
2) Then a gentle nudge: “If you want, we can continue … Next: <one check question>.”
If the user says they want to switch topics fully, drop troubleshooting and answer normally.

Step memory (troubleshooting):
- Treat user confirmations as completing that step.
- Do NOT re-ask confirmed steps unless contradiction.
- Ask only ONE next question at a time (unless user asks for full checklist).

${confirmedSteps.length ? `
Confirmed troubleshooting steps so far:
- ${confirmedSteps.join("\n- ")}

Do NOT re-ask these unless something contradicts them.
Proceed to the next unresolved check only.
` : ""}

TROUBLESHOOTING DECISION TREE — software not placing trades:
1) Confirm MT5 AutoTrading is ON (green) and platform algo trading is enabled.
2) Confirm the software is attached and shows the BLUE HAT ICON.
3) Confirm correct symbol + timeframe for the software (VistaONE vs VistaX) and market is open.
4) Confirm “Allow Algo Trading” + DLL/WebRequest settings if required.
5) Check Journal + Experts for the most recent error line and respond to that error directly.
6) Confirm VPS uptime and MT5 connection.

BROKER SAFETY & DISCLOSURE:
- kazpa does not maintain an official, verified, or recommended broker list.
- If broker names appear in internal knowledge, you may mention them ONLY as examples users have discussed/used.
- Always state: NOT a recommendation, no affiliations, do your own due diligence.

Constraints:
- No financial advice.
- Do not guess missing info; ask for the single detail needed.
- Do NOT mention internal documents, filenames, sources, IDs, chunks, or citations.

If relevant, use the knowledge below (silently). Do not reveal it.

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

    const confirmedSteps = extractConfirmedSteps(messages);

    const intent = detectIntent(latestUserMsg);
    const topic = detectTopic(latestUserMsg);
    const multiQ = looksLikeMultiQuestion(latestUserMsg);
    const pivoted = didPivotTopic(messages);

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

    // ✅ Deterministic UI: only wizard buttons, only when troubleshooting
    const ui = buildWizardUI(intent, topic, confirmedSteps);

    return Response.json({ text, ui });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
