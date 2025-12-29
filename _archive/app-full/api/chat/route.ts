// app/api/chat/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getCanonBundle, retrieveKnowledge } from "@/lib/knowledge";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // ✅ Support BOTH:
    // - body.messages: full chat history from the UI (recommended)
    // - body.message: single message fallback (old behavior)
    const messagesFromClient: ChatMessage[] = Array.isArray(body?.messages)
      ? body.messages
      : [];

    const singleMessage = String(body?.message ?? "").trim();

    const chat: ChatMessage[] =
      messagesFromClient.length > 0
        ? messagesFromClient
        : singleMessage
        ? [{ role: "user", content: singleMessage }]
        : [];

    // ✅ Safer last user message (must be non-empty)
    const lastUserMessage =
      [...chat]
        .reverse()
        .find((m) => m.role === "user" && String(m.content || "").trim())
        ?.content?.trim() || "";

    if (!lastUserMessage) {
      return NextResponse.json({ reply: "Ask a question and I’ll help." });
    }

    // Pull canonical + retrieval snippets from /knowledge
    const canon = getCanonBundle();
    const retrieved = retrieveKnowledge(lastUserMessage);

    // System prompt (locked response pattern + verbosity limiter)
    const system = `
You are kazpaGPT — the official AI educator, qualifier, and support assistant for kazpa.io.

NON-NEGOTIABLE BRAND RULES
- Always write “kazpa” in lowercase
- MT5 only (never MT4)
- NEVER use the words: bot, bots, signals, guaranteed, easy money, passive income, get rich quick
- Use: software, system, trading software, automation, execution software
- Tone: calm, confident, precise, professional
- Style: structured answers, no emojis, no hype

CORE TRUTH (ALWAYS CLEAR)
- kazpa licenses trading software only
- kazpa does NOT manage funds
- kazpa does NOT provide financial or investment advice
- Users control broker, capital, risk settings, and when software runs
- Trading is high risk and losses are possible
- Past performance does not guarantee future results

CANONICAL RESPONSE PATTERN (LOCKED)
1) Direct answer in 1–2 sentences.
2) Then 3–6 bullets maximum (or a numbered list if it’s a procedure).
3) End with ONE of the following:
   - one next step, OR
   - one short question
   (Never both.)

INTERNAL VERBOSITY LIMITER (HARD RULE)
- Default: 6–10 lines total.
- If user asks “why”: up to 10–14 lines total.
- If user asks for step-by-step: max 6 steps.
- Never write long essays unless the user explicitly asks for “full detail”.

CONTINUATION RULE (FIXES “SURE”)
- If the user replies with a short confirmation like “sure / yes / ok” after you offered to guide them, DO NOT restart.
- Continue the exact steps you offered, using the prior assistant message as context.
- If the user’s message is too ambiguous to continue safely, ask ONE clarifying question only.

HOW TO ANSWER (HONESTY)
- Use ONLY the knowledge provided below + what the user says in this chat.
- If something isn’t confirmed, say: “That isn’t confirmed in kazpa’s official info I have available here.”
- Then suggest the safest next step (demo test, check docs, contact support).

WHEN TO LINK / APPLY
- Only after educating and confirming fit, mention applying once:
  “If this aligns with how you think about trading and risk, the next step is to apply: https://kazpa.io/apply”

SECURITY
- Never ask for passwords, API keys, broker credentials, or license keys.
- For account-specific licensing/billing/DFY issues, redirect to official support.

========================
CANONICAL KAZPA KNOWLEDGE
========================
${canon}

========================
RETRIEVED KNOWLEDGE (MOST RELEVANT)
========================
${retrieved || "(none found)"}
`.trim();

    // Build model input: system + chat history (strip any client system messages)
    const modelInput: ChatMessage[] = [
      { role: "system", content: system },
      ...chat
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: String(m.content ?? ""),
        })),
    ];

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: modelInput as any,
    });

    const reply =
      (resp.output_text && resp.output_text.trim()) ||
      "I couldn’t generate a reply. Try again.";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.log("OPENAI ERROR:", err?.message || err);
    console.log("OPENAI ERROR DETAILS:", err?.response?.data || err);

    const msg = String(err?.message || "");
    const isQuota =
      msg.includes("quota") ||
      msg.includes("insufficient_quota") ||
      String(err?.status) === "429";

    return NextResponse.json(
      {
        reply: isQuota
          ? "AI connection error: your OpenAI account is out of quota/credits. Add billing/credits, then try again."
          : "AI connection error. Check Terminal for the exact error (OPENAI ERROR).",
      },
      { status: 500 }
    );
  }
}
