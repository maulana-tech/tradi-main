import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tradi-Nox — Confidential OTC Desk on iExec Nox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          background: "#131313",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#e5e2e1",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
            zIndex: 1,
          }}
        >
          <svg width="120" height="120" viewBox="0 0 480 480">
            <polygon
              points="240,52 428,240 240,428 52,240"
              fill="none"
              stroke="#00ff41"
              strokeWidth={14}
              strokeLinejoin="miter"
            />
            <polygon
              points="240,116 364,240 240,364 116,240"
              fill="none"
              stroke="#00ff41"
              strokeWidth={2}
              opacity={0.32}
            />
            <rect x="78" y="218" width="324" height="44" fill="#00ff41" />
            <rect x="118" y="232" width="62" height="16" fill="#131313" />
            <rect x="208" y="232" width="62" height="16" fill="#131313" />
            <rect x="298" y="232" width="62" height="16" fill="#131313" />
          </svg>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              style={{
                color: "#00ff41",
                fontSize: 132,
                fontWeight: 700,
                letterSpacing: "8px",
                lineHeight: 1,
              }}
            >
              TRADI-NOX
            </div>
            <div
              style={{
                color: "#84967e",
                fontSize: 22,
                letterSpacing: "12px",
                marginTop: "12px",
              }}
            >
              CONFIDENTIAL · OTC · DESK
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "32px",
            zIndex: 1,
          }}
        >
          <div
            style={{
              color: "#e5e2e1",
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.15,
              maxWidth: "1000px",
            }}
          >
            Your trade. Their guess. Nobody knows.
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "center",
              color: "#71717a",
              fontSize: 22,
              letterSpacing: "4px",
            }}
          >
            <span style={{ color: "#00ff41" }}>●</span>
            <span>BUILT ON IEXEC NOX</span>
            <span>·</span>
            <span>ARBITRUM SEPOLIA</span>
            <span>·</span>
            <span>VICKREY-FAIR RFQ</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
