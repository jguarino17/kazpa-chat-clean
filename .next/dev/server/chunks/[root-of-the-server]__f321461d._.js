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
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/lib/knowledge.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCanonBundle",
    ()=>getCanonBundle,
    "retrieveKnowledge",
    ()=>retrieveKnowledge
]);
// lib/knowledge.ts
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
;
;
const KNOWLEDGE_DIR = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), "knowledge");
// Simple in-memory cache so we don't re-read every request
let CACHE = null;
function safeReadFile(filePath) {
    try {
        return __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].readFileSync(filePath, "utf8");
    } catch  {
        return "";
    }
}
function listFilesRecursive(dir) {
    const out = [];
    const items = __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].existsSync(dir) ? __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].readdirSync(dir, {
        withFileTypes: true
    }) : [];
    for (const item of items){
        const full = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(dir, item.name);
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
function normalizeText(s) {
    return (s || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
// Chunk by paragraphs with a max character budget.
// This is intentionally simple and fast.
function chunkText(text, maxChars = 1200) {
    const t = normalizeText(text);
    if (!t) return [];
    const paras = t.split("\n\n").map((p)=>p.trim()).filter(Boolean);
    const chunks = [];
    let buf = "";
    for (const p of paras){
        if (!buf) {
            buf = p;
            continue;
        }
        // If adding this paragraph stays within limit, append
        if (buf.length + 2 + p.length <= maxChars) {
            buf += "\n\n" + p;
            continue;
        }
        // Otherwise, push current buffer and start new
        chunks.push(buf);
        buf = p;
    }
    if (buf) chunks.push(buf);
    // Also split any chunk that's still huge (rare)
    const final = [];
    for (const c of chunks){
        if (c.length <= maxChars * 1.5) {
            final.push(c);
        } else {
            // Hard split
            for(let i = 0; i < c.length; i += maxChars){
                final.push(c.slice(i, i + maxChars));
            }
        }
    }
    return final;
}
function tokenize(q) {
    return normalizeText(q).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).filter((w)=>w.length >= 3).slice(0, 60);
}
function scoreChunk(queryTokens, chunkText) {
    const hay = chunkText.toLowerCase();
    let score = 0;
    for (const tok of queryTokens){
        // quick containment check
        if (hay.includes(tok)) score += 1;
    }
    // Boost for very important terms
    const boosts = [
        "mt5",
        "mql5",
        "experts",
        "advisors",
        "autotrading",
        "vistax",
        "vistaone",
        "vista",
        "vps",
        "license"
    ];
    for (const b of boosts){
        if (queryTokens.includes(b) && hay.includes(b)) score += 2;
    }
    return score;
}
function loadKnowledgeCache() {
    const now = Date.now();
    // Refresh cache every 60 seconds in dev
    if (CACHE && now - CACHE.loadedAt < 60_000) return CACHE;
    const allFiles = listFilesRecursive(KNOWLEDGE_DIR);
    // Canon bundle: keep separate and always include in system prompt
    const canonDir = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(KNOWLEDGE_DIR, "canon");
    const canonFiles = __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].existsSync(canonDir) ? listFilesRecursive(canonDir).filter((f)=>f.toLowerCase().endsWith(".md") || f.toLowerCase().endsWith(".txt")) : [];
    const canonParts = [];
    for (const f of canonFiles){
        const rel = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].relative(KNOWLEDGE_DIR, f);
        const txt = normalizeText(safeReadFile(f));
        if (txt) canonParts.push(`## ${rel}\n${txt}`);
    }
    const canonText = canonParts.join("\n\n").trim();
    // Index chunks from everything else (including raw)
    const chunks = [];
    for (const filePath of allFiles){
        const relPath = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].relative(KNOWLEDGE_DIR, filePath);
        // Skip canon files from chunk index (canon is injected separately)
        if (relPath.startsWith("canon" + __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].sep) || relPath.startsWith("canon/")) continue;
        const fileText = normalizeText(safeReadFile(filePath));
        if (!fileText) continue;
        const pieces = chunkText(fileText, 1200);
        pieces.forEach((piece, idx)=>{
            chunks.push({
                id: `${relPath}::${idx}`,
                file: __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].basename(filePath),
                relPath,
                text: piece
            });
        });
    }
    CACHE = {
        loadedAt: now,
        chunks,
        canonText
    };
    return CACHE;
}
function getCanonBundle() {
    const { canonText } = loadKnowledgeCache();
    return canonText || "(canon not found)";
}
function retrieveKnowledge(query, opts) {
    const maxChunks = opts?.maxChunks ?? 6;
    const { chunks } = loadKnowledgeCache();
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return "";
    const scored = chunks.map((c)=>({
            c,
            s: scoreChunk(qTokens, c.text)
        })).filter((x)=>x.s > 0).sort((a, b)=>b.s - a.s).slice(0, maxChunks);
    if (scored.length === 0) return "";
    // Return labeled snippets so the model stays grounded
    return scored.map(({ c })=>{
        return `SOURCE: ${c.relPath}\n${c.text}`;
    }).join("\n\n---\n\n");
}
}),
"[project]/app/api/chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
// app/api/chat/route.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/client.mjs [app-route] (ecmascript) <export OpenAI as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$knowledge$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/knowledge.ts [app-route] (ecmascript)");
;
;
;
const client = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__["default"]({
    apiKey: process.env.OPENAI_API_KEY
});
async function POST(req) {
    try {
        const body = await req.json().catch(()=>({}));
        // ✅ Support BOTH:
        // - body.messages: full chat history from the UI (recommended)
        // - body.message: single message fallback (old behavior)
        const messagesFromClient = Array.isArray(body?.messages) ? body.messages : [];
        const singleMessage = String(body?.message ?? "").trim();
        const chat = messagesFromClient.length > 0 ? messagesFromClient : singleMessage ? [
            {
                role: "user",
                content: singleMessage
            }
        ] : [];
        // ✅ Safer last user message (must be non-empty)
        const lastUserMessage = [
            ...chat
        ].reverse().find((m)=>m.role === "user" && String(m.content || "").trim())?.content?.trim() || "";
        if (!lastUserMessage) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                reply: "Ask a question and I’ll help."
            });
        }
        // Pull canonical + retrieval snippets from /knowledge
        const canon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$knowledge$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCanonBundle"])();
        const retrieved = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$knowledge$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["retrieveKnowledge"])(lastUserMessage);
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
        const modelInput = [
            {
                role: "system",
                content: system
            },
            ...chat.filter((m)=>m.role !== "system").map((m)=>({
                    role: m.role,
                    content: String(m.content ?? "")
                }))
        ];
        const resp = await client.responses.create({
            model: "gpt-4.1-mini",
            input: modelInput
        });
        const reply = resp.output_text && resp.output_text.trim() || "I couldn’t generate a reply. Try again.";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            reply
        });
    } catch (err) {
        console.log("OPENAI ERROR:", err?.message || err);
        console.log("OPENAI ERROR DETAILS:", err?.response?.data || err);
        const msg = String(err?.message || "");
        const isQuota = msg.includes("quota") || msg.includes("insufficient_quota") || String(err?.status) === "429";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            reply: isQuota ? "AI connection error: your OpenAI account is out of quota/credits. Add billing/credits, then try again." : "AI connection error. Check Terminal for the exact error (OPENAI ERROR)."
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f321461d._.js.map