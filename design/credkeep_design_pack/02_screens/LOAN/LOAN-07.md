# LOAN-07 — Loan Created

## Purpose
Confirm durable local loan creation.

## Entry and destination
Entry is via the preceding route in `00_foundation/SCREEN_NAVIGATION_MAP.md`. Primary action **View Loan** -> **KIST-01/ONCE-01** (where multiple destinations depend on the selected product/status). Android back returns to the previous valid authenticated step, without resetting the session.

## Exact visible content / hierarchy
loan ID, product, amount, locally saved/sync pending vs synced.

## Components
Use the shared header, concise form/row and footer components from `01_components/`. Reuse the proper product calculator / loan detail / payment components as applicable; no one-off styling. Header title **Loan Created**, one dominant action, secondary cancel/back, appropriate 16–20dp outline icons.

## Required states
pending sync, synced. Provide additional state frame(s) only if visually different (e.g. open dropdown, loading, error); never concatenate them below the main screen.

## Layout
Exactly **one 390 × 884dp phone frame**; 16dp insets; normal viewport with content scrolling inside if needed; 48dp tappable elements; sticky footer for irreversible actions; keyboard-safe; neutral Notion-style tokens. No tall composite screen, no marketing visuals, no giant status cards.

## Ready-to-paste single-screen Stitch prompt
Design **ONE** Android mobile frame named **LOAN-07 — Loan Created** for existing CredKeep using `DESIGN_SYSTEM_MASTER.md` and the approved `COMP-*` components. Objective: confirm durable local loan creation. Visible content: loan ID, product, amount, locally saved/sync pending vs synced. Main CTA **View Loan** routes to **KIST-01/ONCE-01**. Show the normal ready state; states to document separately: pending sync, synced. Strict **390 × 884dp** viewport, NOT an elongated scroll mockup or multiple screens. Compact, polished Notion + Linear + Raycast styling, white surfaces, 1dp borders, crisp small icons. Do not regenerate other screens.
