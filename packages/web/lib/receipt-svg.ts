/**
 * Client-side SVG receipt generator — no API calls needed.
 *
 * Generates a clean trade receipt as an SVG data URL.
 * Deterministic from inputs — same trade always produces the same art.
 */

export interface ReceiptInput {
  pair: string;
  intentId: string;
  mode: "Direct" | "RFQ";
  txHash?: string;
  blockNumber?: string;
  timestamp?: number;
  makerAddress?: string;
  sellHandle?: string;
}

export interface ReceiptOutput {
  /** SVG string */
  svg: string;
  /** data:image/svg+xml;base64,... URL for <img src> */
  dataUrl: string;
  /** Short fingerprint for filenames / display */
  fingerprint: string;
}

function fingerprint(opts: ReceiptInput): string {
  return [
    `IX${opts.intentId.padStart(4, "0")}`,
    opts.txHash ? opts.txHash.slice(2, 8).toUpperCase() : "",
    opts.blockNumber ? `B${opts.blockNumber.slice(-6)}` : "",
  ]
    .filter(Boolean)
    .join("-");
}

function shortHash(h: string): string {
  if (!h) return "PENDING";
  return `${h.slice(0, 6)}..${h.slice(-4)}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GREEN = "#124d1c";
const GREEN_SOFT = "rgba(18,77,28,0.12)";
const BG = "#fafaf7";
const CARD = "#ffffff";
const TEXT = "#1c1c1a";
const TEXT_SEC = "#6b6b65";
const TEXT_MUTED = "#9c9c94";
const BORDER = "#e4e2dc";

export function generateReceiptSvg(opts: ReceiptInput): ReceiptOutput {
  const fp = fingerprint(opts);
  const settleDate = opts.timestamp
    ? new Date(opts.timestamp).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const makerTag = opts.makerAddress
    ? opts.makerAddress.slice(2, 6).toUpperCase()
    : "0000";

  const handleSig = opts.sellHandle
    ? opts.sellHandle.slice(2, 10).toUpperCase()
    : "ENCRYPTED";

  const txSig = opts.txHash ? opts.txHash.slice(-6).toUpperCase() : "PENDING";
  const modeLabel = opts.mode === "RFQ" ? "Vickrey RFQ" : "Direct OTC";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 620">
  <rect width="480" height="620" fill="${BG}"/>

  <!-- Card -->
  <rect x="24" y="24" width="432" height="572" rx="8" fill="${CARD}" stroke="${BORDER}" stroke-width="1"/>

  <!-- Header -->
  <text x="48" y="72" fill="${GREEN}" font-family="ui-monospace,monospace" font-size="11" letter-spacing="2" font-weight="600">TRADI-NOX RECEIPT</text>
  <text x="432" y="72" text-anchor="end" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="11">${esc(modeLabel)}</text>

  <!-- Fingerprint -->
  <text x="48" y="118" fill="${TEXT}" font-family="ui-monospace,monospace" font-size="26" font-weight="700">#${esc(fp)}</text>

  <!-- Divider -->
  <line x1="48" y1="138" x2="432" y2="138" stroke="${BORDER}" stroke-width="1"/>

  <!-- Grid -->
  <text x="48" y="172" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">PAIR</text>
  <text x="48" y="192" fill="${TEXT}" font-family="ui-monospace,monospace" font-size="15" font-weight="600">${esc(opts.pair)}</text>

  <text x="240" y="172" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">INTENT</text>
  <text x="240" y="192" fill="${TEXT}" font-family="ui-monospace,monospace" font-size="15">#${esc(opts.intentId)}</text>

  <text x="48" y="238" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">NETWORK</text>
  <text x="48" y="258" fill="${TEXT}" font-family="ui-monospace,monospace" font-size="15">ARB_SEPOLIA</text>

  <text x="240" y="238" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">SETTLED</text>
  <text x="240" y="258" fill="${TEXT}" font-family="ui-monospace,monospace" font-size="15">${esc(settleDate)}</text>

  <!-- Divider -->
  <line x1="48" y1="280" x2="432" y2="280" stroke="${BORDER}" stroke-width="1"/>

  <!-- Crypto details -->
  <text x="48" y="314" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">SETTLE_TX</text>
  <text x="48" y="334" fill="${TEXT_SEC}" font-family="ui-monospace,monospace" font-size="13">${esc(shortHash(opts.txHash ?? "0x0000"))}</text>

  <text x="240" y="314" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">BLOCK</text>
  <text x="240" y="334" fill="${TEXT_SEC}" font-family="ui-monospace,monospace" font-size="13">${esc(opts.blockNumber ?? "—")}</text>

  <text x="48" y="378" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">MAKER</text>
  <text x="48" y="398" fill="${TEXT_SEC}" font-family="ui-monospace,monospace" font-size="13">0x${esc(makerTag)}</text>

  <text x="240" y="378" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">HANDLE_SIG</text>
  <text x="240" y="398" fill="${TEXT_SEC}" font-family="ui-monospace,monospace" font-size="12">0x${esc(handleSig)}</text>

  <!-- Divider -->
  <line x1="48" y1="420" x2="432" y2="420" stroke="${BORDER}" stroke-width="1"/>

  <!-- Seal -->
  <g transform="translate(48,440)">
    <rect x="0" y="0" width="384" height="72" rx="4" fill="${GREEN_SOFT}" stroke="${GREEN}" stroke-width="0.5" opacity="0.6"/>
    <text x="192" y="30" text-anchor="middle" fill="${GREEN}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" font-weight="600">CONFIDENTIAL · ON-CHAIN · NOX_TEE</text>
    <text x="192" y="50" text-anchor="middle" fill="${GREEN}" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2" opacity="0.7">ENCRYPTED · VERIFIED · FINAL</text>
  </g>

  <!-- Footer -->
  <text x="48" y="545" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="9" letter-spacing="1">CONFIDENTIAL OTC SETTLEMENT · KEEPERHUB TEE</text>
  <text x="48" y="560" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="9" letter-spacing="1">AMOUNTS ENCRYPTED · SETTLEMENT VERIFIED · NO MEV</text>

  <!-- Bottom bar -->
  <rect x="48" y="572" width="384" height="1" fill="${BORDER}"/>
  <text x="48" y="592" fill="${TEXT_MUTED}" font-family="ui-monospace,monospace" font-size="9">${esc(fp)}</text>
  <text x="432" y="592" text-anchor="end" fill="${GREEN}" font-family="ui-monospace,monospace" font-size="9" font-weight="600">tradi-nox</text>
</svg>`;

  const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

  return { svg, dataUrl, fingerprint: fp };
}
