# ONCE-03 — Extend - New Term

## Purpose
Choose extra duration.

## Entry and destination
Entry is via the preceding route in `00_foundation/SCREEN_NAVIGATION_MAP.md`. Primary action **Continue** -> **ONCE-04** (where multiple destinations depend on the selected product/status). Android back returns to the previous valid authenticated step, without resetting the session.

## Exact visible content / hierarchy
+6 months, added interest ₹1500, new maturity date, principal unchanged.

## Components
Use the shared header, concise form/row and footer components from `01_components/`. Reuse the proper product calculator / loan detail / payment components as applicable; no one-off styling. Header title **Extend - New Term**, one dominant action, secondary cancel/back, appropriate 16–20dp outline icons.

## Required states
month selector, date preview. Provide additional state frame(s) only if visually different (e.g. open dropdown, loading, error); never concatenate them below the main screen.

## Layout
Exactly **one 390 × 884dp phone frame**; 16dp insets; normal viewport with content scrolling inside if needed; 48dp tappable elements; sticky footer for irreversible actions; keyboard-safe; neutral Notion-style tokens. No tall composite screen, no marketing visuals, no giant status cards.

## Ready-to-paste single-screen Stitch prompt
Design **ONE** Android mobile frame named **ONCE-03 — Extend - New Term** for existing CredKeep using `DESIGN_SYSTEM_MASTER.md` and the approved `COMP-*` components. Objective: choose extra duration. Visible content: +6 months, added interest ₹1500, new maturity date, principal unchanged. Main CTA **Continue** routes to **ONCE-04**. Show the normal ready state; states to document separately: month selector, date preview. Strict **390 × 884dp** viewport, NOT an elongated scroll mockup or multiple screens. Compact, polished Notion + Linear + Raycast styling, white surfaces, 1dp borders, crisp small icons. Do not regenerate other screens.
