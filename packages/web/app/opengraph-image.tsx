import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tradi-Nox — private OTC execution without public trade size";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ height: "100%", width: "100%", background: "#000000", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#f7f7f8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: "#482bff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="44" height="44" viewBox="0 0 480 480">
            <polygon points="240,52 428,240 240,428 52,240" fill="none" stroke="#ffffff" strokeWidth={18} />
            <rect x="78" y="218" width="324" height="44" fill="#ffffff" />
            <rect x="118" y="232" width="62" height="16" fill="#482bff" />
            <rect x="208" y="232" width="62" height="16" fill="#482bff" />
            <rect x="298" y="232" width="62" height="16" fill="#482bff" />
          </svg>
        </div>
        <div style={{ fontSize: 36, fontWeight: 600 }}>Tradi-Nox</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div style={{ maxWidth: "980px", fontSize: 76, fontWeight: 500, lineHeight: 1.02 }}>Private trades, without public size.</div>
        <div style={{ maxWidth: "900px", color: "#a1a1aa", fontSize: 28, lineHeight: 1.4 }}>Encrypted OTC intents, fair price discovery, and atomic settlement on Ethereum Sepolia.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#a1a1aa", fontSize: 22 }}>
        <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#3dd68c" }} />
        <span>Built on iExec Nox</span><span>·</span><span>Direct OTC + sealed RFQ</span>
      </div>
    </div>,
    size,
  );
}
