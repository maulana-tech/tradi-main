# Tradi-Nox — 4-Minute Pitch Script

> Speaker: Pugar Huda Mantoro
> Format: Solo presentation, screen-share with `/slides` deck
> Target: **3:40** (20s buffer for pacing variance)
> Slides: **7** (consolidated from 10 for natural pacing — ~32s avg per slide)
> Language: English (matches slide copy and target audience)

---

## How to use this doc

1. **Practice 3× before recording.** Read aloud, then say from memory using the cue card column.
2. **Open the deck fullscreen** (`F` key on `/slides`).
3. **Timer is on by default** — top-right corner shows `SLIDE 0:18 / 0:25 · TOTAL 1:23`. Color shifts to amber at 80% of budget, red when over.
4. **Press `T`** to hide timer (use for actual recording — judges shouldn't see it).
5. **Press `R`** to reset both timers (restart practice run from scratch).

---

## Slide-by-slide script

### Slide 1 — TITLE  · `0:00 – 0:15` · 15s budget

> "Hi, I'm Pugar. This is **Tradi-Nox** — a confidential OTC desk on iExec Nox, where the trade amount stays sealed on-chain. Built solo with Claude Code over five days for the iExec Vibe Coding Challenge."

**Stage:**
- 3-second silent hold on logo before first word
- Don't read the tagline aloud — slide says it visually
- Then `→` to advance
- Reset timers (`R`) right before "Hi"

---

### Slide 2 — PROBLEM  · `0:15 – 0:55` · 40s budget

> "On-chain OTC has a leak problem. When you post a trade — Genesis-size, 8-figure size — every field is plaintext. Order size. Side. Counterparty. Price. The moment your transaction lands, every MEV bot, every market maker, every competing desk reads your hand."
>
> "And the cost is real. A leaked **fifty-million-dollar** sell order moves the market 2% against the maker before they ever execute."
>
> "That is why over **95% of institutional OTC volume** still happens off-chain — Telegram chats, Genesis, Cumberland, FalconX. **That is the institutional moat we close.**"

**Stage:**
- Eyes track the four EXPOSED red boxes as you name each field
- Pause for half a beat after "fifty-million-dollar"
- Drop tempo on "**95%**" — biggest stat, hold the number
- "**That is the moat we close**" → confident close, then `→`

---

### Slide 3 — SOLUTION  · `0:55 – 1:40` · 45s budget

> "The idea is simple: **what if the amount was sealed on-chain**?"
>
> "Maker posts an intent. The amount lives as an encrypted `euint256` handle inside iExec's TEE. The contract holds it sealed. Taker fills it blind. Nobody — not even the chain — sees the size."
>
> "Three primitives make this work, all from iExec Nox: **TEE encryption** so plaintext only exists inside the precompile; **a sealed-bid Vickrey RFQ** that picks the winner and second-price entirely on encrypted handles; and **atomic settlement** through `safeSub` and `select` — no partial fills, no failure mode that leaks size."

**Stage:**
- As you narrate the flow, trace Maker → handle → Contract → handle → Taker with cursor
- Slow down on "Nobody — not even the chain — sees the size."
- Read pillar names with vocal emphasis (TEE encryption / sealed-bid Vickrey / atomic settlement) but paraphrase the bodies — don't read verbatim
- This is a 45s slide; it's OK to take your time

---

### Slide 4 — STACK  · `1:40 – 1:55` · 15s budget

> "End-to-end on Arbitrum Sepolia. Four packages in one repo: contracts in Solidity 0.8.27 with Foundry, a Next.js 16 frontend, four autonomous agents, and an MCP server that exposes the desk as AI-callable tools — so an agent like Claude can trade through Tradi-Nox by calling a function."

**Stage:**
- Quick pace — this is breadth, not depth
- Don't dwell. This slide is a transition into the demo.

---

### Slide 5 — DEMO  · `1:55 – 2:55` · 60s budget — **THE WOW MOMENT**

> "And it's all **live, right now, on Arbitrum Sepolia**. The dApp is at `private-otc.vercel.app`. Three contracts deployed and verified — PrivateOTC, cUSDC, cETH."
>
> *[Switch to live dApp or pre-recorded demo segment]*
>
> *Voice over the demo, do NOT go silent:*
>
> "I'm connecting a wallet on Arbitrum Sepolia. Balance widget shows it sealed — that's an encrypted handle, not a plaintext number. I decrypt it locally with my wallet signature. *[2s]*
>
> "Now I'm posting an RFQ. The taker enters a bid — also encrypted before it ever leaves the browser. *[2s]*
>
> "When the maker triggers reveal — *[Vickrey reveal animation plays]* — the contract returns only the winner address and the second-price clearing. The losing bids stay sealed forever."

**Stage:**
- This is THE wow moment. If only one slide goes great, make it this one.
- **Pre-record** the demo segment if live demo is risky (network flake, wallet popup race)
- Demo segment: 25-30s max. Cut fluff. Keep: connect → decrypt balance → bid → reveal animation
- Return to deck after demo, don't dwell
- Watch the timer — 60s budget gives you slack, but if SLIDE timer goes amber at 0:48, start wrapping the demo voice-over

---

### Slide 6 — CRAFT  · `2:55 – 3:30` · 35s budget — **ENGINEERING CREDIBILITY**

> "One thing the testing caught — and this is what separates 'works on testnet' from 'should run mainnet'."
>
> "I wrote a pure-Solidity mirror of the Vickrey algorithm and fuzzed it. Bids of **one hundred, three hundred, two hundred** returned a second-price of one hundred. Wrong. The correct answer is two hundred."
>
> "It was a missing case in `_computeSecondPrice` — a bid landing *between* current highest and second wasn't handled. Three-line fix using a nested `Nox.select`. **Without that mirror, that bug ships.**"
>
> "100% line coverage on logic. 30+ Foundry tests. Zero Slither high or medium findings. **One developer, five days, four packages, Claude Code Opus 4.7.**"

**Stage:**
- Slow down for the bug story — this is the differentiator
- Read the bid array clearly: "one-hundred, three-hundred, two-hundred"
- Pause for half a beat after "Wrong."
- "**Without that mirror, that bug ships**" → land it
- Final line crisp — five distinct beats: "One developer / five days / four packages / Claude Code Opus 4.7"
- Don't apologize for using AI; it's a *Vibe Coding* challenge

---

### Slide 7 — FIN  · `3:30 – 3:40` · 10s budget + Q&A hold

> "**Tradi-Nox.** *[beat]* Your trade. *[beat]* Their guess. *[beat]* Nobody knows."
>
> "Demo at `private-otc.vercel.app`. Source on GitHub. Thanks to iExec and Claude Code. Happy to take questions."

**Stage:**
- Tagline cadence is the close. Three deliberate beats. Don't rush.
- Hold this slide indefinitely for Q&A

---

## Timer cheat sheet

By the end of each slide, your **TOTAL timer** should read approximately:

| Slide | Should be at | If you're over | If you're under |
|---|---|---|---|
| 1 ends | 0:15 | Fine, slight overhang OK | Don't rush — TITLE has visual gravity |
| 2 ends | 0:55 | Cut "Telegram, Genesis, Cumberland, FalconX" enumeration | Slow down on "95%" |
| 3 ends | 1:40 | Drop pillar 3 ("atomic settlement") body | Linger on the diagram |
| 4 ends | 1:55 | Drop the MCP-server clause | Add "agents on Vercel cron" detail |
| 5 ends | 2:55 | Cut demo voice-over to 15s | Stretch demo segment voice-over |
| 6 ends | 3:30 | Drop the stat-card line at end | Hold "Without that mirror, that bug ships" longer |
| 7 ends | 3:40 | Skip "Thanks to..." | OK — Q&A reads the slate anyway |

If at slide 4 you're already at 2:00, you're 5s over budget — start cutting.

---

## Q&A prep (5 most likely questions)

### 1. "How is this different from CoW Protocol or 1inch RFQ?"

> "CoW and 1inch protect against MEV at *execution* time — bundling and batch auctions. But the order itself is public from the moment it's posted. Tradi-Nox seals the order itself. Different threat model: we hide *intent*, they hide *timing*."

### 2. "Why iExec Nox instead of FHE chains like Inco or Fhenix?"

> "Nox runs as a precompile on Arbitrum. Institutional liquidity is already there. FHE chains require bridging into a new chain — non-starter for desks moving 8-figure size."

### 3. "The maker reveals the winner — isn't that trusted?"

> "Documented limitation in SECURITY.md. Two-step: anyone can call `finalizeRFQ` to compute the encrypted winner, only the maker can call `revealRFQWinner`. The maker's incentive to misreport is weak — the price is already fixed by the encrypted second-price computation. Trade-off accepted because Nox v0.2 doesn't yet support `eaddress`. When it does, this becomes fully trustless."

### 4. "Mainnet?"

> "Sepolia by design for this hackathon. I don't ship half-baked to mainnet. Path to mainnet is gated on Nox mainnet beta GA plus one institutional design partner."

### 5. "How does the Vickrey bug story make me trust this *more*, not less?"

> "Because the bug existed in a domain — encrypted second-price computation — where most teams would trust the encryption to mask their logic errors. We caught it precisely because we built a parallel implementation and fuzzed both. That's how you do this work seriously."

---

## 60-second elevator (if a judge cuts you short)

> "Tradi-Nox is a confidential OTC desk on iExec Nox. Today, on-chain OTC leaks order size, side, and price — that's why 95% of institutional volume still trades off-chain on Telegram and centralized desks. Tradi-Nox keeps the trade amount encrypted on-chain through TEE-backed handles, and runs a sealed-bid Vickrey auction that picks the winner and clearing price entirely on encrypted handles. Live on Arbitrum Sepolia at private-otc.vercel.app. Solo build, five days, Claude Code Opus 4.7. Your trade. Their guess. Nobody knows."

## 30-second hook (X / Telegram caption)

> "On-chain OTC leaks everything — order size, side, price. Every market maker reads your hand the second your trade lands. Tradi-Nox fixes that. Confidential OTC desk on iExec Nox, where the amount stays sealed on-chain. Your trade. Their guess. Nobody knows."

## 10-second sound bite (clip teaser)

> "OTC desks leak everything. We seal the trade amount on-chain. Your trade. Their guess. Nobody knows."

---

## Recording checklist

- [ ] Quiet room, mic 4-6 inches from mouth, no fan/AC noise
- [ ] Browser zoom 100%, dApp env loaded, deck on `/slides?slide=1`
- [ ] Press **`T`** to hide timer (judges don't need to see it)
- [ ] Press **`R`** to reset timers right before recording starts
- [ ] Press **`F`** for fullscreen BEFORE pressing record
- [ ] Disable system notifications (Slack, Telegram, Discord)
- [ ] OBS: 1920×1080, 30fps, MP4 H.264, target 8 Mbps
- [ ] Record 3 takes minimum. Use take 3 — voice warms up.
- [ ] On final take, slightly *over*-articulate. Recording flattens delivery.
