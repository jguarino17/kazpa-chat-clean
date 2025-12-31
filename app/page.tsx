"use client";

import { useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m1",
      role: "assistant",
      content:
        "Hello — kazpaGPT (V1.5) is live. Ask me anything about kazpa setup, dashboard, VistaONE/VistaX, risk rules, VPS/MT5, troubleshooting, etc.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  // Scroll container + bottom anchor
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  // Keep view pinned as messages/typing appear
  useEffect(() => {
    scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loading]);

  // When the keyboard opens (focus), ensure we pin to bottom
  const handleFocus = () => {
    // tiny delay helps iOS after keyboard animation begins
    setTimeout(() => scrollToBottom(false), 50);
    setTimeout(() => scrollToBottom(false), 250);
  };

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const payload = {
        messages: [...messages, userMsg].map((m) => ({
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
          { id: crypto.randomUUID(), role: "assistant", content: `Error: ${errText}` },
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
      // after send, keep pinned
      setTimeout(() => scrollToBottom(false), 50);
    }
  }

  return (
    // Use a true viewport height (dvh) + prevent body scrolling issues
    <main className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
      <header className="border-b border-white/10 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="font-semibold tracking-tight">kazpaGPT (V1.5)</div>
          <div className="text-xs text-white/50">no auth • no db • stable</div>
        </div>
      </header>

      {/* This is the ONLY scroll area */}
      <section
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 overscroll-contain"
      >
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
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

      {/* Sticky footer pinned to bottom (with iOS safe area padding) */}
      <footer className="border-t border-white/10 px-4 py-4 shrink-0 bg-black sticky bottom-0">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onFocus={handleFocus}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            // 16px prevents iOS zoom; keep it exactly 16+
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

        <div className="max-w-3xl mx-auto mt-2 text-[11px] text-white/40 pb-[env(safe-area-inset-bottom)]">
          If production errors, check Vercel env var OPENAI_API_KEY and redeploy.
        </div>
      </footer>
    </main>
  );
}
