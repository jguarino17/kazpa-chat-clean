"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UIButton = {
  id: string;
  label: string;
  value: string;
};

type UIBlock =
  | {
      type: "start";
      title?: string;
      buttons: UIButton[];
    }
  | {
      type: "wizard";
      title?: string;
      step?: string;
      buttons: UIButton[];
    };

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ui?: UIBlock;
};

type ClientContext = {
  activeProduct?: "VistaX" | "VistaONE" | "Both" | "Unknown";
  stage?: "setup" | "troubleshoot" | "learning" | "general";
  confirmedSteps?: string[];
  lastIssue?: string;
  lastUpdated?: string;
};

const STORAGE_KEY = "kazpaGPT_v1_5_messages";
const CONTEXT_KEY = "kazpaGPT_v1_6_context";

const START_MENU: UIBlock = {
  type: "start",
  title: "Quick start",
  buttons: [
    {
      id: "start-setup",
      label: "🧭 Setup",
      value:
        "I need help setting up kazpa from scratch (VPS + MT5 + install). What's step 1?",
    },
    {
      id: "start-troubleshoot",
      label: "🔧 Troubleshooting",
      value:
        "My kazpa software isn't trading. Start the troubleshooting wizard step-by-step.",
    },
    {
      id: "start-risk",
      label: "⚠️ Risk rules",
      value: "Summarize kazpa risk rules and disclaimers (educational only).",
    },
    {
      id: "start-vistax",
      label: "📊 VistaX",
      value:
        "Explain VistaX: what it is, the symbol/timeframe, and the key operating rules.",
    },
    {
      id: "start-vistaone",
      label: "📈 VistaONE",
      value:
        "Explain VistaONE: what it is, the symbol/timeframe, and the key operating rules.",
    },
  ],
};

const DEFAULT_MESSAGES: Msg[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Hello — kazpaGPT (V1.7) is live. Ask me anything about kazpa setup, dashboard, VistaONE/VistaX, risk rules, VPS/MT5, troubleshooting, etc.",
    ui: START_MENU,
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
      .map((m: any) => {
        const out: Msg = { id: m.id, role: m.role, content: m.content };

        if (m.ui && typeof m.ui === "object" && typeof m.ui.type === "string") {
          if (
            (m.ui.type === "start" || m.ui.type === "wizard") &&
            Array.isArray(m.ui.buttons)
          ) {
            const buttons: UIButton[] = m.ui.buttons
              .filter(
                (b: any) =>
                  b &&
                  typeof b.id === "string" &&
                  typeof b.label === "string" &&
                  typeof b.value === "string"
              )
              .slice(0, 8);

            out.ui = {
              type: m.ui.type,
              title:
                typeof m.ui.title === "string"
                  ? m.ui.title.slice(0, 80)
                  : undefined,
              step:
                typeof m.ui.step === "string"
                  ? m.ui.step.slice(0, 40)
                  : undefined,
              buttons,
            } as UIBlock;
          }
        }

        return out;
      });

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

function isLatestAssistantMessage(messages: Msg[], msgId: string) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i].id === msgId;
  }
  return false;
}

// ── INLINE STYLES (kazpa design tokens) ─────────────────────────────────────

const S = {
  // layout
  main: {
    height: "100dvh",
    background: "var(--bg)",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    position: "relative" as const,
  } as React.CSSProperties,

  // noise overlay
  noise: {
    content: "''",
    position: "fixed" as const,
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
    opacity: 0.025,
    pointerEvents: "none" as const,
    zIndex: 0,
  } as React.CSSProperties,

  // topbar
  header: {
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    background: "rgba(12,12,15,.93)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  } as React.CSSProperties,

  headerInner: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "0 20px",
    height: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  } as React.CSSProperties,

  logo: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
    textDecoration: "none",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,

  logoAccent: {
    color: "var(--accent-h)",
  } as React.CSSProperties,

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as React.CSSProperties,

  livePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: "var(--green)",
    background: "var(--green-dim)",
    border: "1px solid var(--green-b)",
    padding: "3px 10px",
    borderRadius: 999,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,

  liveDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "var(--green)",
  } as React.CSSProperties,

  clearBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    borderRadius: "var(--rxs)",
    border: "1px solid var(--border)",
    background: "var(--panel2)",
    color: "var(--text3)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
  } as React.CSSProperties,

  backLink: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text3)",
    textDecoration: "none",
    transition: "color .15s",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  // messages area
  messagesArea: {
    flex: 1,
    overflowY: "auto" as const,
    overscrollBehavior: "contain",
    padding: "28px 20px",
    position: "relative" as const,
    zIndex: 1,
  } as React.CSSProperties,

  messagesInner: {
    maxWidth: 760,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  } as React.CSSProperties,

  // message bubbles
  bubbleWrapUser: {
    display: "flex",
    justifyContent: "flex-end",
  } as React.CSSProperties,

  bubbleWrapAssistant: {
    display: "flex",
    justifyContent: "flex-start",
    gap: 10,
    alignItems: "flex-start",
  } as React.CSSProperties,

  avatarBot: {
    width: 28,
    height: 28,
    borderRadius: "var(--rxs)",
    background: "var(--accent-dim)",
    border: "1px solid var(--accent-dim2)",
    display: "grid",
    placeItems: "center",
    fontSize: 13,
    flexShrink: 0,
    marginTop: 2,
  } as React.CSSProperties,

  bubbleUser: {
    maxWidth: "82%",
    background: "var(--accent-dim)",
    border: "1px solid var(--accent-dim2)",
    borderRadius: "var(--r)",
    borderBottomRightRadius: "var(--rxs)",
    padding: "12px 16px",
    fontSize: 14,
    lineHeight: 1.65,
    color: "var(--text)",
  } as React.CSSProperties,

  bubbleAssistant: {
    maxWidth: "82%",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r)",
    borderBottomLeftRadius: "var(--rxs)",
    padding: "14px 18px",
    fontSize: 14,
    lineHeight: 1.65,
    color: "var(--text)",
  } as React.CSSProperties,

  roleLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text3)",
    marginBottom: 6,
  } as React.CSSProperties,

  msgContent: {
    whiteSpace: "pre-wrap" as const,
    color: "var(--text)",
    lineHeight: 1.7,
  } as React.CSSProperties,

  // quick-start buttons
  uiButtonsWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid var(--border)",
  } as React.CSSProperties,

  uiButtonsTitle: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text3)",
    marginBottom: 10,
  } as React.CSSProperties,

  uiButtonsGrid: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 7,
  } as React.CSSProperties,

  uiButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: "var(--rsm)",
    border: "1px solid var(--border2)",
    background: "var(--panel2)",
    color: "var(--text2)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s",
    fontFamily: "'Inter', system-ui, sans-serif",
  } as React.CSSProperties,

  // step badge inside wizard
  stepBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    background: "var(--yellow-dim)",
    border: "1px solid var(--yellow-b)",
    color: "var(--yellow)",
    padding: "3px 10px",
    borderRadius: 999,
    marginBottom: 10,
    letterSpacing: "0.06em",
  } as React.CSSProperties,

  // thinking bubble
  thinkingBubble: {
    maxWidth: "82%",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r)",
    borderBottomLeftRadius: "var(--rxs)",
    padding: "14px 18px",
  } as React.CSSProperties,

  thinkingDots: {
    display: "flex",
    gap: 5,
    alignItems: "center",
  } as React.CSSProperties,

  // footer / input area
  footer: {
    borderTop: "1px solid var(--border)",
    padding: "14px 20px",
    background: "rgba(12,12,15,.93)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    flexShrink: 0,
    position: "relative" as const,
    zIndex: 1,
  } as React.CSSProperties,

  footerInner: {
    maxWidth: 760,
    margin: "0 auto",
  } as React.CSSProperties,

  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  } as React.CSSProperties,

  input: {
    flex: 1,
    background: "var(--panel2)",
    border: "1px solid var(--border2)",
    borderRadius: "var(--rsm)",
    padding: "12px 16px",
    fontSize: 15,
    color: "var(--text)",
    fontFamily: "'Inter', system-ui, sans-serif",
    lineHeight: 1.5,
    resize: "none" as const,
    transition: "border-color .15s",
  } as React.CSSProperties,

  sendBtn: {
    padding: "12px 20px",
    borderRadius: "var(--rsm)",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background .15s",
    fontFamily: "'Inter', system-ui, sans-serif",
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  sendBtnDisabled: {
    background: "var(--panel3)",
    color: "var(--text3)",
    cursor: "not-allowed",
  } as React.CSSProperties,

  disclaimer: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: "var(--text3)",
    marginTop: 10,
    letterSpacing: "0.04em",
    lineHeight: 1.6,
  } as React.CSSProperties,
};

// ── THINKING DOTS ANIMATION ─────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div style={S.thinkingDots}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--text3)",
            display: "inline-block",
            animation: `kazpaBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes kazpaBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes kazpaBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(DEFAULT_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [clientContext, setClientContext] = useState<ClientContext>({});
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const didHydrateRef = useRef(false);
  const didHydrateContextRef = useRef(false);

  const hasUserMessages = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages]
  );

  useEffect(() => {
    const saved = safeParseMessages(localStorage.getItem(STORAGE_KEY));
    if (saved) setMessages(saved);
    didHydrateRef.current = true;
  }, []);

  useEffect(() => {
    const savedCtx = safeParseContext(localStorage.getItem(CONTEXT_KEY));
    if (savedCtx) setClientContext(savedCtx);
    didHydrateContextRef.current = true;
  }, []);

  useEffect(() => {
    if (!didHydrateRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (!didHydrateContextRef.current) return;
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(clientContext));
    } catch {}
  }, [clientContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  function clearChat() {
    setLoading(false);
    setInput("");
    setMessages(DEFAULT_MESSAGES);
    setClientContext({});
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONTEXT_KEY);
    } catch {}
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }

  async function sendText(text: string) {
    const trimmed = (text || "").trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setClientContext((prev) => {
      const next: ClientContext = { ...(prev || {}) };
      const p = detectProductFromText(trimmed);
      if (p) next.activeProduct = p;
      next.stage = detectStageFromText(trimmed);
      if (next.stage === "troubleshoot") {
        next.lastIssue = trimmed.replace(/\s+/g, " ").slice(0, 120);
      }
      next.lastUpdated = new Date().toISOString();
      return next;
    });

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    try {
      const payload = {
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        clientContext,
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
            content: `⚠️ ${errText}`,
          },
        ]);
        return;
      }

      const assistantText =
        (data?.text && String(data.text)) || "No response text returned.";

      const ui =
        data?.ui && typeof data.ui === "object" ? data.ui : undefined;

      let safeUI: UIBlock | undefined;

      if (
        ui &&
        (ui.type === "wizard" || ui.type === "start") &&
        Array.isArray(ui.buttons)
      ) {
        const buttons: UIButton[] = ui.buttons
          .filter(
            (b: any) =>
              b &&
              typeof b.id === "string" &&
              typeof b.label === "string" &&
              typeof b.value === "string"
          )
          .slice(0, 8);

        safeUI = {
          type: ui.type,
          title:
            typeof ui.title === "string" ? ui.title.slice(0, 80) : undefined,
          step:
            typeof ui.step === "string" ? ui.step.slice(0, 40) : undefined,
          buttons,
        } as UIBlock;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantText,
          ui: safeUI,
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ ${e?.message ?? "Unknown error"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    return sendText(input);
  }

  function handleUIButtonClick(btn: UIButton) {
    sendText(btn.value);
  }

  return (
    <main style={S.main}>
      {/* Noise + glow overlays */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: 0.025,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "-20%",
          right: "-10%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(47,123,255,.06) 0%,transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── TOPBAR ── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="https://kazpa.io/dashboard" style={S.logo}>
              kazpa<span style={S.logoAccent}>.</span>
            </a>
            <div
              style={{
                width: 1,
                height: 16,
                background: "var(--border2)",
              }}
            />
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text2)",
                letterSpacing: "0.04em",
              }}
            >
              kazpaGPT
            </span>
          </div>

          <div style={S.headerRight}>
            <div style={S.livePill}>
              <span
                style={{
                  ...S.liveDot,
                  animation: "kazpaBlink 2s ease-in-out infinite",
                }}
              />
              V1.7 · Live
            </div>

            <a href="https://kazpa.io/dashboard" style={S.backLink}>
              ← Dashboard
            </a>

            <button
              onClick={clearChat}
              style={S.clearBtn}
              type="button"
              aria-label="Clear chat"
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.borderColor = "var(--border2)";
                (e.target as HTMLElement).style.color = "var(--text2)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.borderColor = "var(--border)";
                (e.target as HTMLElement).style.color = "var(--text3)";
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <section style={S.messagesArea}>
        <div style={S.messagesInner}>
          {messages.map((m) => {
            const showButtons =
              m.role === "assistant" &&
              m.ui &&
              isLatestAssistantMessage(messages, m.id) &&
              ((m.ui.type === "start" && !hasUserMessages) ||
                (m.ui.type === "wizard" && hasUserMessages));

            if (m.role === "user") {
              return (
                <div key={m.id} style={S.bubbleWrapUser}>
                  <div style={S.bubbleUser}>
                    <div style={S.msgContent}>{m.content}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} style={S.bubbleWrapAssistant}>
                <div style={S.avatarBot}>🤖</div>
                <div style={S.bubbleAssistant}>
                  <div style={S.roleLabel}>kazpaGPT</div>
                  <div style={S.msgContent}>{m.content}</div>

                  {showButtons && m.ui && (
                    <div style={S.uiButtonsWrap}>
                      {m.ui.type === "wizard" && m.ui.step && (
                        <div style={S.stepBadge}>Step: {m.ui.step}</div>
                      )}
                      {m.ui.title && (
                        <div style={S.uiButtonsTitle}>{m.ui.title}</div>
                      )}
                      <div style={S.uiButtonsGrid}>
                        {m.ui.buttons.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleUIButtonClick(b)}
                            style={{
                              ...S.uiButton,
                              ...(hoveredBtn === b.id
                                ? {
                                    borderColor: "var(--accent-dim2)",
                                    background: "var(--accent-dim)",
                                    color: "var(--text)",
                                  }
                                : {}),
                            }}
                            onMouseEnter={() => setHoveredBtn(b.id)}
                            onMouseLeave={() => setHoveredBtn(null)}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={S.bubbleWrapAssistant}>
              <div style={S.avatarBot}>🤖</div>
              <div style={S.thinkingBubble}>
                <div style={{ ...S.roleLabel, marginBottom: 10 }}>
                  kazpaGPT
                </div>
                <ThinkingDots />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      {/* ── INPUT FOOTER ── */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <div style={S.inputRow}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask anything about kazpa…"
              rows={1}
              style={{
                ...S.input,
                ...(input ? { borderColor: "var(--accent-dim2)" } : {}),
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--accent-dim2)";
                e.target.style.boxShadow =
                  "0 0 0 3px var(--accent-dim)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border2)";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                ...S.sendBtn,
                ...(loading || !input.trim() ? S.sendBtnDisabled : {}),
              }}
              onMouseEnter={(e) => {
                if (!loading && input.trim())
                  (e.target as HTMLElement).style.background =
                    "var(--accent-h)";
              }}
              onMouseLeave={(e) => {
                if (!loading && input.trim())
                  (e.target as HTMLElement).style.background = "var(--accent)";
              }}
            >
              {loading ? "…" : "Send →"}
            </button>
          </div>

          <div style={S.disclaimer}>
            Educational Software Only · Not Financial Advice · Leverage Trading Involves Risk
          </div>
        </div>
      </footer>
    </main>
  );
}
