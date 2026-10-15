import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** The picture shown when a link to the site is shared in a chat or social post. */
export function renderOgCard() {
  const bar = (h: number, color: string, opacity = 1) => (
    <div style={{ width: 54, height: h, borderRadius: 14, background: color, opacity, display: "flex" }} />
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#e8efe9",
        background:
          "radial-gradient(900px 500px at 15% 0%, rgba(52,130,98,0.55), rgba(11,20,16,0) 70%), radial-gradient(700px 420px at 100% 100%, rgba(240,182,74,0.28), rgba(11,20,16,0) 70%), #0b1410",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64 }}>
          {bar(32, "#4fcf99")}
          {bar(48, "#4fcf99", 0.6)}
          {bar(64, "#f0b64a")}
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>Milestone Pools</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Fund work in steps.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: "#f0b64a",
          }}
        >
          Pay only for what is delivered.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "rgba(232,239,233,0.72)" }}>
        Pooled funding, released milestone by milestone, approved by a fixed committee.
      </div>
    </div>,
    { ...ogSize },
  );
}
