"use client";

import { useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "kazpaGPT_v1_5_messages";

const DEFAULT_MESSAGES: Msg[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Hello — kazpaGPT (V1.5) is live. Ask me anything about kazpa setup, dashboard, VistaONE/VistaX, risk rules, VPS/MT5, troubleshooting, etc.",
  },
];

function safeParseMessages(raw: string | null): Msg[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // Light validation so bad data doesn't crash the UI
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

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(DEFAULT_MESSAGES);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const didHydrateRef = useRef(false);

  // 1) Load messages from localStorage ONCE
  useEffect(() => {
    const saved = safeParseMessages(localStorage.getItem(STORAGE_KEY));
    if (saved) setMessages(saved);
    didHydrateRef.current = true;
  }, []);

  // 2) Persist messages to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (!didHydrateRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // If storage is full/blocked, fail silently (don't break chat)
    }
  }, [messages]);

  // 3) Keep view pinned to bottom as messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  function clearChat() {
    setLoading(false);
    setInput("");
    setMessages(DEFAULT_MESSAGES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

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

  return (
    <main className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="font-semibold tracking-tight">kazpaGPT (V1.5)</div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-white/50">no auth • no db • stable</div>

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
                send();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-[16px] outline-none focus:border-white/25"
          />
          <button
            onClick={send}
            disabled={loading}
            className="rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>

        <div className="max-w-3xl mx-auto mt-2 text-[11px] text-white/40">
          If production errors, check Vercel env var OPENAI_API_KEY and redeploy.
        </div>
      </footer>
    </main>
  );
}
