# Design System: CredKeep Neutral Precision

## 1. Visual Theme & Atmosphere

CredKeep is a compact, operational Android lending ledger: Notion simplicity, Linear hierarchy, and Raycast interaction quality. Density is balanced-to-compact, layouts are predictable and task-focused, and motion is restrained. The interface must feel private, reliable, fast, and legible outdoors without resembling a decorative bank dashboard.

## 2. Color Palette & Roles

- **Canvas White** (`#FFFFFF`) — primary screen background.
- **Soft Surface** (`#F7F7F5`) — grouped sections, selected rows, and quiet containers.
- **Pressed Surface** (`#F0F0EE`) — tactile pressed and hover-equivalent state.
- **Primary Ink** (`#191919`) — headings, values, and primary copy; never use pure black.
- **Secondary Ink** (`#737373`) — metadata, helper text, and inactive navigation.
- **Disabled Ink** (`#A3A3A3`) — disabled content only.
- **Default Border** (`#E8E8E6`) — one-dp structural dividers and control borders.
- **Strong Border** (`#C9C9C5`) — focused or emphasized neutral outlines.
- **Primary Action** (`#242424`) — dominant buttons and selected controls.
- **On Primary** (`#FFFFFF`) — text and icons on primary actions.
- **Success** (`#17805A`) — confirmed receipts and settled states, always paired with text or an icon.
- **Warning** (`#B7791F`) — due or pending states, always paired with text or an icon.
- **Danger** (`#C83E3E`) — overdue, destructive, and failed states, always paired with text or an icon.

No navy or teal brand tier, gradients, neon, glassmorphism, or large saturated summary cards.

## 3. Typography Rules

- **Family:** Inter or a metrically compatible Android-safe sans serif. Use one family throughout.
- **Page heading:** 20sp, semibold, compact tracking.
- **Section/control heading:** 16sp, semibold.
- **Body:** 14–15sp with calm line height.
- **Metadata:** 13sp; tertiary copy 12sp.
- **Money display:** 24–28sp only when the amount is the primary task information.
- **Financial figures:** tabular numerals, Indian grouping, no whitespace after `₹` (for example `₹1,50,000`).
- Hierarchy comes from weight, spacing, and tone—not oversized type.

## 4. Component Styling

- **Buttons:** 48dp minimum touch target, 8dp radius, one dominant filled action, refined secondary/outline/ghost/destructive variants. Pressed feedback uses slight opacity or scale; loading locks repeat submission.
- **Inputs:** label above, helper or inline error below, 48–52dp control height, 8dp radius, visible focus border, keyboard appropriate to the data type.
- **Rows and cards:** prefer flat rows, dividers, and negative space. Use 12dp cards only when containment communicates hierarchy; avoid nested cards.
- **Sheets and dialogs:** 20dp top/container radius, clear review hierarchy, keyboard-safe sticky actions, and explicit processing/error/success states.
- **Navigation:** compact header with Android back behavior; five bottom destinations; 16–20dp Lucide-style outline icons with consistent 1.75–2dp stroke.
- **Loading and empty states:** dimension-matched skeletons for structured content; small progress indicators only where appropriate; clear offline, database-failed, retry, and empty compositions.
- **Financial states:** Monthly Kist and One-Time Repayment remain visually distinct. Corrections are auditable reversal/correction events, never silent replacement.

## 5. Layout Principles

- Every application artifact is exactly one native `390 × 884dp` Android frame and represents one screen or one visually distinct state.
- Keep primary content and important controls within a `390 × 844dp` content target where practical, while using dynamic Android status and navigation insets.
- Never hardcode a 40dp bottom inset, and reject desktop presentation boards containing an embedded phone mockup.
- Use 16dp horizontal insets and the spacing scale `4, 8, 12, 16, 24, 32`.
- Rows are 48–64dp high; visible controls may be compact but every interactive target is at least 48dp.
- Component families use small labeled specimen boards with isolated variants, never complete phone workflows or giant vertical canvases.
- Keep content keyboard-safe; sticky actions remain above the keyboard and safe area.
- No horizontal overflow, overlapping content, decorative marketing imagery, or concatenated screens.

## 6. Motion & Interaction

- Use understated 120–220ms transitions, pressed opacity/scale, and a 220ms bottom-sheet transition.
- Animate only transform and opacity where possible; respect reduced-motion settings.
- No perpetual decorative animation. Haptics are optional only for confirmed financial actions.
- Android back returns to the valid parent state without resetting authentication or draft data.

## 7. Content and System Truthfulness

- Plain operational language: borrower, loan, Monthly Kist, One-Time Repayment, amount received, outstanding balance, due date, correction, extension.
- Never claim sync until server acknowledgement. Distinguish initializing, ready, empty, offline-with-local-data, pending sync, syncing, failed, retrying, and completed.
- Never expose passwords, PINs, full phone numbers, or sensitive document content in lock-screen previews.
- Use realistic Indian financial examples and mathematically consistent INR amounts.

## 8. Anti-Patterns

- No navy/teal dashboard revival, saturated hero cards, gradients, neon glows, glassmorphism, emojis, generic illustrations, or bloated widgets.
- No giant headings, fake metrics, nested cards, excessive shadows, inconsistent icon sets, or status conveyed by color alone.
- No web-only shadcn/Radix assumptions in implementation annotations.
- No elongated phone mockups, multi-screen composites, duplicated flows, or unrelated variants on one board.
