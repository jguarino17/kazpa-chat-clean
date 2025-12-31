"use client";

import { useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type QuickReply = { label: string; send: string };

/**
 * Structured client context (local-only).
 * This is NOT the transcript; it’s compact operational context.
 */
type ClientContext = {
  activeProduct?: "VistaX" | "VistaONE" | "Both" | "Unknown";
  stage?: "setup" | "troubleshoot" | "learning" | "general";
  confirmedSteps?: string[]; // optional
  lastIssue?: string;
  lastUpdated?: string;
};

const STORAGE_KEY = "kazpaGPT_v1_5_messages";
const CONTEXT_KEY = "kazpaGPT_v1_6_context";

const DEFAULT_MESSAGES: Msg[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Hello — kazpaGPT (V1.6) is live. Ask me anything about kazpa setup, dashboard, VistaONE/VistaX, risk rules, VPS/MT5, troubleshooting, etc.",
  },
];

function safeParseMessages(raw: string | null): Msg[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const cleaned: Msg[] = parsed
      .filter(
        (m: any) =>
          m &&
          typeof m.id === "string" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m: any) => ({ id: m.id, role: m.role, content: m.content }));

    return cleaned.length ? cleaned : null;
  } catch {
    return null;
  }
}

function safeParseContext(raw: string | null): ClientContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const ctx: ClientContext = {};

    if (
      parsed.activeProduct === "VistaX" ||
      parsed.activeProduct === "VistaONE" ||
      parsed.activeProduct === "Both" ||
      parsed.activeProduct === "Unknown"
    ) {
      ctx.activeProduct = parsed.activeProduct;
    }

    if (
      parsed.stage === "setup" ||
      parsed.stage === "troubleshoot" ||
      parsed.stage === "learning" ||
      parsed.stage === "general"
    ) {
      ctx.stage = parsed.stage;
    }

    if (Array.isArray(parsed.confirmedSteps)) {
      ctx.confirmedSteps = parsed.confirmedSteps
        .filter((x: any) => typeof x === "string")
        .slice(0, 25);
    }

    if (typeof parsed.lastIssue === "string") {
      ctx.lastIssue = parsed.lastIssue.slice(0, 120);
    }

    if (typeof parsed.lastUpdated === "string") {
      ctx.lastUpdated = parsed.lastUpdated.slice(0, 40);
    }

    return ctx;
  } catch {
    return null;
  }
}

function detectProductFromText(
  text: string
): ClientContext["activeProduct"] | undefined {
  const t = (text || "").toLowerCase();
  const hasX = t.includes("vistax");
  const hasOne = t.includes("vistaone") || t.includes("vista one");
  if (hasX && hasOne) return "Both";
  if (hasX) return "VistaX";
  if (hasOne) return "VistaONE";
  return undefined;
}

function detectStageFromText(text: string): ClientContext["stage"] {
  const t = (text || "").toLowerCase();

  if (
    t.includes("not working") ||
    t.includes("doesn't work") ||
    t.includes("isn't working") ||
    t.includes("no trades") ||
    t.includes("not trading") ||
    t.includes("error") ||
    t.includes("journal") ||
    t.includes("experts") ||
    t.includes("license") ||
    t.includes("won't") ||
    t.includes("cant") ||
    t.includes("can't") ||
    t.includes("stuck") ||
    t.includes("missing")
  )
    return "troubleshoot";

  if (
    t.includes("install") ||
    t.includes("set up") ||
    t.includes("setup") ||
    t.includes("vps") ||
    t.includes("mt5") ||
    t.includes("metatrader") ||
    t.includes("activate") ||
    t.includes("mql5") ||
    t.includes("advisors")
  )
    return "setup";

  if (
    t.includes("what is forex") ||
    t.includes("i'm new") ||
    t.includes("im new") ||
    t.includes("beginner") ||
    t.includes("explain") ||
    t.includes("fundamentals") ||
    t.includes("technicals")
  )
    return "learning";

  return "general";
}

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(DEFAULT_MESSAGES);
  const [loading, setLoading] = useState(false);

  // Structured context (local-only, compact)
  const [clientContext, setClientContext] = useState<ClientContext>({});

  // ✅ Server-driven quick replies (buttons)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const didHydrateRef = useRef(false);
  const didHydrateContextRef = useRef(false);

  // 1) Load messages from localStorage ONCE
  useEffect(() => {
    const saved = safeParseMessages(localStorage.getItem(STORAGE_KEY));
    if (saved) setMessages(saved);
    didHydrateRef.current = true;
  }, []);

  // 1b) Load structured context from localStorage ONCE
  useEffect(() => {
    const savedCtx = safeParseContext(localStorage.getItem(CONTEXT_KEY));
    if (savedCtx) setClientContext(savedCtx);
    didHydrateContextRef.current = true;
  }, []);

  // 2) Persist messages to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (!didHydrateRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // 2b) Persist client context whenever it changes (after initial load)
  useEffect(() => {
    if (!didHydrateContextRef.current) return;
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(clientContext));
    } catch {}
  }, [clientContext]);

  // 3) Keep view pinned to bottom as messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  function clearChat() {
    setLoading(false);
    setInput("");
    setMessages(DEFAULT_MESSAGES);
    setClientContext({});
    setQuickReplies([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONTEXT_KEY);
    } catch {}
  }

  async function send(overrideText?: string) {
    const raw = typeof overrideText === "string" ? overrideText : input;
    const text = raw.trim();
    if (!text || loading) return;

    // clear old quick replies as soon as user sends
    setQuickReplies([]);

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    // vNext: update structured context (safe + lightweight)
    setClientContext((prev) => {
      const next: ClientContext = { ...(prev || {}) };

      const p = detectProductFromText(text);
      if (p) next.activeProduct = p;

      next.stage = detectStageFromText(text);

      if (next.stage === "troubleshoot") {
        next.lastIssue = text.replace(/\s+/g, " ").slice(0, 120);
      }

      next.lastUpdated = new Date().toISOString();
      return next;
    });

    // Use a local nextMessages variable so we don't depend on stale state
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const payload = {
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        clientContext, // optional
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errText =
          data?.error ||
          `Request failed (${res.status}). Check Vercel env vars + redeploy.`;

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${errText}`,
          },
        ]);
        return;
      }

      const assistantText =
        (data?.text && String(data.text)) || "No response text returned.";

      // ✅ read server-driven quick replies
      const serverReplies = data?.ui?.quickReplies;
      if (Array.isArray(serverReplies)) {
        const cleaned: QuickReply[] = serverReplies
          .filter(
            (x: any) =>
              x &&
              typeof x.label === "string" &&
              typeof x.send === "string"
          )
          .slice(0, 8);
        setQuickReplies(cleaned);
      } else {
        setQuickReplies([]);
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: assistantText },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${e?.message ?? "Unknown error"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function sendQuickReply(msg: string) {
    // sends immediately without timing hacks
    void send(msg);
  }

  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <main className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="font-semibold tracking-tight">kazpaGPT (V1.6)</div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-white/50">
              kazpaOS • intelligence layer • Live
            </div>

            <button
              onClick={clearChat}
              className="text-xs text-white/60 hover:text-white/90 border border-white/15 px-2 py-1 rounded-lg"
              type="button"
              aria-label="Clear chat"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <section className="flex-1 px-4 py-6 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                  m.role === "user"
                    ? "bg-white/10 border-white/10"
                    : "bg-white/[0.06] border-white/10"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1">
                  {m.role}
                </div>

                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* ✅ Server-driven quick replies ONLY under the latest assistant message */}
                {m.role === "assistant" &&
                  m.id === lastMessageId &&
                  quickReplies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quickReplies.map((qr, idx) => (
                        <button
                          key={`${qr.label}-${idx}`}
                          type="button"
                          onClick={() => sendQuickReply(qr.send)}
                          className="text-xs px-3 py-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.07] text-white/80"
                        >
                          {qr.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border bg-white/[0.06] border-white/10">
                <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1">
                  assistant
                </div>
                <div className="text-white/70">Thinking…</div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-[16px] outline-none focus:border-white/25"
          />
          <button
            onClick={() => void send()}
            disabled={loading}
            className="rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>

        <div className="max-w-3xl mx-auto mt-2 text-[11px] text-white/40">
          Educational Software Only • Not Financial Advice • Leverage Trading Involves Risk
        </div>
      </footer>
    </main>
  );
}
