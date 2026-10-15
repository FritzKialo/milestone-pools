"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1410",
          color: "#e8efe9",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div role="alert" style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Milestone Pools could not load</h1>
          <p style={{ opacity: 0.75, lineHeight: 1.6, margin: "0 0 20px" }}>
            Nothing was sent or changed on the blockchain. Reload to try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#f0b64a",
              color: "#1a1305",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
