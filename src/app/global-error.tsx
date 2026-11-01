"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>
              A client-side exception occurred. Please try again.
            </p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>{error?.message}</p>
            <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  minHeight: 44,
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "#1e3a5f",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
              <a
                href="/"
                style={{
                  minHeight: 44,
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#0f172a",
                  fontWeight: 600,
                }}
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
