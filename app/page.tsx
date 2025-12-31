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

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Keep latest messages in view (but don't fight the user if they scroll up)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 180;

    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, loading]);

  /**
   * Mobile keyboard fix (iOS/Safari):
   * - visualViewport changes when keyboard opens
   * - we convert that to a CSS variable --vvh
   * - and also a --kb offset so the footer stays visible
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const setVars = () => {
      // viewport height excluding the browser UI + keyboard area
      const height = vv.height;
      document.documentElement.style.setProperty("--vvh", `${height}px`);

      // how far the visual viewport is shifted up when keyboard opens
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", `${kb}px`);
    };

    setVars();
    vv.addEventListener("resize", setVars);
    vv.addEventListener("scroll", setVars);

    return () => {
      vv.removeEventListener("resize", setVars);
      vv.removeEventListener("scroll", setVars);
    };
  }, []);

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
    }
  }

  return (
    <main
      className="bg-black text-white flex flex-col"
      // Use the visualViewport-driven height when available (mobile keyboard safe)
      style={{ minHeight: "var(--vvh, 100svh)" as any }}
    >
      {/* Global helpers for iOS safe area + keyboard offset */}
      <style jsx global>{`
        :root {
          --kb: 0px;
          --vvh: 100svh;
        }
        html,
        body {
          height: 100%;
          overscroll-behavior-y: none;
          background: #000;
        }
      `}</style>

      <header className="border-b border-white/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="font-semibold tracking-tight">kazpaGPT (V1.5)</div>
          <div className="text-xs text-white/50">no auth • no db • stable</div>
        </div>
      </header>

      {/* SCROLLING MESSAGE AREA */}
      <section className="flex-1 overflow-hidden px-4 py-4">
        <div
          ref={scrollerRef}
          className="max-w-3xl mx-auto h-full overflow-y-auto space-y-3 pb-3"
        >
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

      {/* STICKY INPUT (ALWAYS VISIBLE) */}
      <footer
        className="border-t border-white/10 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/70"
        // lift footer when keyboard is open + respect iPhone safe area
        style={{
          transform: "translateY(calc(-1 * var(--kb, 0px)))",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-center">
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
              // iOS zoom prevention + better mobile keyboard behavior
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="on"
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/25"
              style={{ fontSize: 16 }} // critical for iOS to avoid zoom
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
        </div>
      </footer>
    </main>
  );
}
