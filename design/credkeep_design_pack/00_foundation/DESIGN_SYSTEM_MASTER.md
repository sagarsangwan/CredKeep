# CredKeep — Design System Master (v1)

## Product promise
Android-first, offline-first personal lending ledger for independent Indian lenders. Auth-first registration; tenant-specific local encrypted records; never promise cloud sync unless server acknowledged updates. Product UI is operational, not a decorative bank dashboard.

## Design identity
Notion compactness + Linear hierarchy and precision + Raycast interaction polish. Neutral, quiet, crisp. No large saturated hero cards, gradients, emoji icons, bloated widgets, nested cards or artificially long mobile mockups.

### Tokens
- `surface.canvas #FFFFFF`; `surface.soft #F7F7F5`; `surface.pressed #F0F0EE`; `surface.overlay #FFFFFF`
- `text.primary #191919`; `text.secondary #737373`; `text.disabled #A3A3A3`
- `border.default #E8E8E6`; `border.strong #C9C9C5`; `action.primary #242424`; `action.onPrimary #FFFFFF`
- Semantic: success `#17805A`; warning `#B7791F`; danger `#C83E3E` (always paired with text and/or icon)
- Font Inter or compatible; 12sp tertiary, 13sp metadata, 14-15sp body, 16sp heading, 20sp page heading, 24–28sp meaningful amount display; tabular figures for money
- Spacing scale `4 8 12 16 24 32`; page horizontal inset `16dp`; row heights 48–64dp; tap target >=48dp; 1dp borders; 8dp controls radius, 12dp cards, 20dp sheets
- Icons: one outline set (Lucide-style), 16/18/20dp, consistent stroke 1.75–2; accessible labels for icon-only actions
- Motion: 120–220ms understated, pressed opacity/scale, bottom sheet 220ms, respect reduce-motion; haptics optional on confirmed financial actions
- Keyboard-safe content and sticky action footer above keyboard; Android back returns to parent; no auto-logout on navigation

## Frame discipline
One screen OR one interaction state per native **390 × 884 logical dp** mobile frame. Keep primary content and important controls within a **390 × 844dp content target** where practical while respecting dynamic Android status and navigation insets. Never hardcode a 40dp bottom inset. Reject desktop presentation boards that merely embed a phone mockup. Component specimens go on small separate boards, NOT 3000px phone mockups. Frames arranged horizontally in sections, named by exact ID. No giant long frame. Distinct variants of a dropdown/modal are distinct frames or specimen tiles.

## Fundamental states
All async operations distinguish initializing, ready, empty, offline-with-local-data, pending-sync, syncing, failed, retrying and completed. A failed DB is ERROR (not perpetual LOADING). Auth required on first registration/login online; returning authenticated user accesses local database offline. PIN/biometrics are optional additional local locks. Passwords, PINs, full phone numbers and sensitive document contents are not displayed on lock-screen previews.

## Two financial contracts
1. **Monthly Kist**: new annual simple *flat* interest = principal × APR × termMonths / 1200. ₹50,000 @24% p.a. ×10 months -> interest ₹10,000; total ₹60,000; ten ₹6,000 installments. Paise rounding must sum exactly.
2. **One-Time Repayment**: no monthly kists. ₹10,000 @30% p.a. ×3 months -> interest ₹750, ₹10,750 due at maturity. Extend by collecting completed-term interest ₹750 then +6 months interest ₹1,500; unchanged principal ₹10,000, cumulative interest ₹2,250, new maturity due ₹11,500. Close Loan and Extend Loan are primary actions.
3. **Correct Payment**: incorrect ₹25,000 -> correct ₹2,500; reversible auditable event pair, not in-place deletion; effective total ₹2,500, valid recalculation and immutable history.
4. Keep legacy interest basis stored explicitly; never recalculate older fixed-term contracts as annual APR by accident.

## Core navigation
Welcome -> Register/Login -> optional security setup -> Dashboard -> Borrowers/Loans/Collections/Reports/Settings. Collections -> active loan -> relevant product detail -> payment or extension/close; payment history -> correct payment. Documents attached to each loan and private to lender.

## Accessibility/engineering contract
Compact visual controls with generous invisible touch target; WCAG AA contrast for body text, no status by color alone; money values in INR with grouping; dates human-readable; inline form errors; loading buttons lock double submission; financial commit requires review + clear result. Reusable components map to React Native primitives (never use DOM-only shadcn/ui in Expo directly). Keep operational logic outside presentational components.
