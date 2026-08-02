# Tradi-Nox Design System

This is the source of truth for every product route except `/slides`. It reconciles the supplied Galxe extraction with WCAG 2.2 AA and the interaction needs of a transactional DeFi product.

## Direction

Tradi-Nox uses Galxe's high-contrast, spacious visual rhythm without copying proprietary assets or inaccessible extracted values. The defining cues are a pure-black canvas, one vivid violet accent, light display typography, large section spacing, pill actions, flat depth, and a small number of confident surfaces.

## Accessible foundations

| Role | Token | Value | Minimum measured contrast |
| --- | --- | --- | --- |
| Canvas | `--color-bg` | `#000000` | — |
| Surface | `--color-surface` | `#0D0D0F` | — |
| Raised surface | `--color-surface-low` | `#151518` | — |
| Divider | `--color-border` | `#222226` | Decorative only |
| Control border | `--color-border-control` | `#62626C` | 3.02:1 against raised surface |
| Primary | `--color-primary` | `#482BFF` | 6.85:1 with white text |
| Foreground | `--color-foreground` | `#F7F7F8` | 19.61:1 on canvas |
| Secondary text | `--color-text-secondary` | `#A3A3AA` | 7.74:1 on surface |
| Muted text | `--color-text-muted` | `#8B8B94` | 5.75:1 on surface |

The extracted `#000000` text on a `#000000` canvas is invalid and must never be implemented. White is the on-dark and on-violet foreground. Status colors are semantic exceptions to the single-accent rule and always include a text or icon label.

## Typography

- Space Grotesk is the licensed substitute for the proprietary Galxe Lader face.
- Display headings use weight 400, approximately `-1px` letter spacing, and balanced wrapping.
- Hero/display text scales from 44px to 64px; marketing section headings scale from 40px to 50px.
- Application page titles scale from 32px to 38px.
- Inter is used for UI and body copy at 16px minimum for primary reading text and 14px for labels/supporting copy.
- JetBrains Mono is limited to amounts, hashes, addresses, timers, and table data.
- Body copy uses 1.5–1.75 line height and a maximum measure of roughly 62–70 characters.

## Layout rhythm

The source's 40px rhythm is applied at structural levels while controls remain on an accessible 4/8px sub-grid:

- Page gutters: 20px mobile, 40px tablet and desktop.
- Primary sections: 80px mobile, 120px desktop.
- Major content groups: 40px or 80px.
- Component internals: 8, 12, 16, 20, 24, 32, or 40px.
- Marketing container: `max-w-7xl`; application container: `max-w-7xl` after the adaptive navigation offset.
- Verify 375px, 768px, 1024px, and 1440px with no horizontal overflow.

## Shape and surfaces

- Buttons, navigation states, chips, and compact actions are full pills.
- Signature marketing panels use a restrained 24px radius; application cards and dialogs use 16â€“20px; fields use 16px.
- Violet may fill one major surface per view. Most application surfaces remain black or near-black so transaction state stays readable.
- Depth comes from background changes and borders. No gradients, decorative glow, or large backdrop blur.
- Shadows are reserved for floating menus, dialogs, toasts, and wallet surfaces.

## Anti-slop composition rules

- Prefer section dividers, tables, and editorial rows over repeating card grids.
- Use cards only when the boundary communicates ownership, state, or a distinct transaction surface.
- Do not place every icon inside a colored circle or rounded square. Product icons are usually inline and secondary to the label.
- Do not repeat the same status in the header, hero, and card. Show it once at the point where it affects a decision.
- Avoid cards inside cards. A signature violet panel may contain one flat data surface, not another decorated shell.
- Badges are reserved for operational states, execution modes in dense data, warnings, and success. Marketing qualifiers stay as plain text.
- Keep one primary CTA per region. Supporting actions use a text link or quiet outline treatment.
- A repeated component should not default to the largest radius, strongest border, icon tile, badge, and shadow at the same time.

## Components and behavior

- Interactive targets are at least 44×44px and show hover, pressed, focus, disabled, and loading states.
- Fields always have programmatic labels. Required state is visible; errors sit next to the field/action and are announced.
- Status never relies on color alone.
- Loading uses structural skeletons; empty states have one clear action; errors include retry or recovery.
- Menus, tooltips, and dialogs use Base UI. Product icons use Lucide. RainbowKit remains the wallet primitive.
- Destructive or irreversible writes require an AlertDialog.
- Fixed navigation respects safe areas and reserves matching content padding.

## Motion

- Motion only communicates interaction or transaction feedback.
- Transitions affect transform/opacity or small local color changes and finish within 200ms.
- Decorative loops are forbidden. Transaction spinners are allowed and stop with the transaction state.
- `prefers-reduced-motion` disables nonessential motion.

## Route structure

- Desktop: grouped sidebar for Trading, Account, Insights, and Testnet.
- Mobile: Market, Create, Portfolio, Activity, and a More menu.
- Landing: one clear hero action, live intent proof, two execution choices, three-step explanation, live activity, trust disclosure, and testnet CTA.
- Every route has one visible `<h1>` and one dominant action.
