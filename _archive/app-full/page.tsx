"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to kazpaGPT.\nAsk anything about kazpa — setup, software, risk, FAQs, or how to get started.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Always-accurate copy of messages (prevents stale-state bugs)
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };

    // ✅ Build nextMessages synchronously from ref (always current)
    const nextMessages = [...messagesRef.current, userMessage];

    // Update UI immediately
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await res.json();

      const botMessage: Message = {
        role: "assistant",
        content: String(data?.reply || "Something went wrong."),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-[#0b0f14] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold">kazpaGPT</h1>
        <p className="text-sm text-white/50">The AI brain of kazpa</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "assistant" ? "bg-white/5" : "bg-blue-500/20 ml-auto"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <div className="rounded-xl bg-white/5 p-4 text-sm text-white/50">
              kazpaGPT is thinking…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask kazpaGPT anything..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            className="text-sm text-white/70 hover:text-white disabled:opacity-40"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
