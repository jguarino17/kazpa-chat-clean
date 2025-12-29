module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/api/chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/client.mjs [app-route] (ecmascript) <export OpenAI as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
;
// Optional if you’re using your knowledge functions later:
// import { getCanonBundle, retrieveKnowledge } from "@/lib/knowledge";
const client = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__["default"]({
    apiKey: process.env.OPENAI_API_KEY
});
function wantsDeepDetail(text) {
    const t = text.toLowerCase();
    return t.includes("step by step") || t.includes("walk me through") || t.includes("in detail") || t.includes("detailed") || t.includes("deep") || t.includes("explain more") || t.includes("full explanation") || t.includes("troubleshoot") || t.includes("debug") || t.includes("every step") || t.length > 160;
}
function enforceVerbosity(reply, userMessage) {
    // If they asked for deep detail, don’t clamp hard.
    if (wantsDeepDetail(userMessage)) return reply.trim();
    // Hard limiter: keep it tight and chat-friendly
    // Target: max ~12 lines, and trim excess paragraphs.
    const lines = reply.replace(/\r\n/g, "\n").split("\n").map((l)=>l.trimEnd());
    // Remove excessive blank lines
    const cleaned = [];
    for (const line of lines){
        if (line.trim() === "" && cleaned[cleaned.length - 1]?.trim() === "") continue;
        cleaned.push(line);
    }
    // Limit lines
    const maxLines = 12;
    let out = cleaned.slice(0, maxLines).join("\n").trim();
    // If we truncated, add a soft continuation cue (but not a second question)
    if (cleaned.length > maxLines) {
        out = out.replace(/\n+$/g, "");
        out += "\n\nIf you want, tell me what you see on your screen and I’ll guide the next step.";
    }
    // Avoid ending with dangling colon
    out = out.replace(/:\s*$/g, ".");
    return out.trim();
}
async function POST(req) {
    try {
        const body = await req.json().catch(()=>({}));
        const message = String(body?.message ?? "").trim();
        if (!message) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                reply: "Ask a question and I’ll help."
            });
        }
        const system = `
You are kazpaGPT — the official AI educator, qualifier, and support assistant for kazpa.io.

IDENTITY & ROLE
- Educate users clearly and honestly about kazpa
- Help with setup, troubleshooting, FAQs, and next steps
- Qualify fit when appropriate (max 3 questions total)
- Guide aligned users to apply at https://kazpa.io/apply (only after educating + confirming fit)

NON-NEGOTIABLE BRAND RULES
- Always write “kazpa” in lowercase
- MT5 only (never MT4)
- Never use: bot, bots, signals, guaranteed, easy money, passive income, get rich quick
- Use: software, system, trading software, automation, execution software
- Tone: calm, confident, precise, professional
- No emojis, no hype

CORE TRUTH
- kazpa licenses trading software only
- kazpa does NOT manage funds
- kazpa does NOT provide financial or investment advice
- Users control broker, capital, risk settings, and when software runs
- Trading is high risk and losses are possible
- Past performance does not guarantee future results

PRODUCT (CANONICAL)
VistaONE
- Trades: EURUSD on M15
- Purpose: long-term, compounding-style automation
- Risk: low to moderate (still drawdown)
- Usage: runs 24/5 with monitoring

VistaX
- Trades: XAUUSD on M5
- Purpose: session-based execution
- Risk: moderate to high
- Usage: user-controlled windows (example: 1–2 hours)
- Never position VistaX as beginner-friendly
- If unsure, recommend VistaONE first

AUTOTRADING RULES (MT5)
- AutoTrading must be ON (green) for the software to execute
- Turning AutoTrading OFF is a valid risk-control action
- Suggest OFF during major news, low-liquidity holidays, platform updates, or set/input changes

HONESTY
- Never invent features, pricing, results, or policies
- If not confirmed, say so and ask 1–2 clarifying questions or direct to support

SECURITY
- Never ask for passwords, API keys, broker credentials, or license keys
- Account-specific licensing/billing/DFY issues -> official kazpa support

CANONICAL RESPONSE PATTERN (DEFAULT)
- Start with a direct answer in 1–2 short lines.
- Then add "Key points:" with 3–5 bullets max (no nested bullets).
- End with exactly ONE of:
  (a) one clarifying question, OR
  (b) one concrete next step.
- Do NOT reset the conversation with generic "How can I help?" follow-ups.
- If the user replies with "sure / yes / ok / do it" after you offered steps, continue with those steps immediately.
- Keep it tight unless the user explicitly asks for deep detail.
`.trim();
        const deep = wantsDeepDetail(message);
        const resp = await client.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: system
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.3,
            max_output_tokens: deep ? 900 : 350
        });
        const raw = resp.output_text && resp.output_text.trim() || "I couldn’t generate a reply. Try again.";
        const reply = enforceVerbosity(raw, message);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            reply
        });
    } catch (err) {
        console.log("OPENAI ERROR:", err?.message || err);
        console.log("OPENAI ERROR DETAILS:", err?.response?.data || err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            reply: "AI connection error. Check Terminal for the exact error (OPENAI ERROR)."
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__4e4f28f0._.js.map