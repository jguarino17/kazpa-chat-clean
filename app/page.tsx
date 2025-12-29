export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ maxWidth: 720, padding: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          kazpa chat (clean)
        </h1>
        <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
          This is the fresh baseline. Next step: add the chat UI + OpenAI route
          without any auth, database, or extra complexity.
        </p>
      </div>
    </main>
  );
}
