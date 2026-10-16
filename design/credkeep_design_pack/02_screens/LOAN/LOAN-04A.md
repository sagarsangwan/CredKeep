# LOAN-04A — Monthly Kist Terms

## Purpose
Set installment loan terms.

## Entry and destination
Entry is via the preceding route in `00_foundation/SCREEN_NAVIGATION_MAP.md`. Primary action **Continue** -> **LOAN-05** (where multiple destinations depend on the selected product/status). Android back returns to the previous valid authenticated step, without resetting the session.

## Exact visible content / hierarchy
principal, APR p.a., 10 months, start/due day, live ₹10000 interest/₹60000 total/₹6000 kist.

## Components
Use the shared header, concise form/row and footer components from `01_components/`. Reuse the proper product calculator / loan detail / payment components as applicable; no one-off styling. Header title **Monthly Kist Terms**, one dominant action, secondary cancel/back, appropriate 16–20dp outline icons.

## Required states
invalid APR, calculation, date picker. Provide additional state frame(s) only if visually different (e.g. open dropdown, loading, error); never concatenate them below the main screen.

## Layout
Exactly **one 390 × 884dp phone frame**; 16dp insets; normal viewport with content scrolling inside if needed; 48dp tappable elements; sticky footer for irreversible actions; keyboard-safe; neutral Notion-style tokens. No tall composite screen, no marketing visuals, no giant status cards.

## Ready-to-paste single-screen Stitch prompt
Design **ONE** Android mobile frame named **LOAN-04A — Monthly Kist Terms** for existing CredKeep using `DESIGN_SYSTEM_MASTER.md` and the approved `COMP-*` components. Objective: set installment loan terms. Visible content: principal, APR p.a., 10 months, start/due day, live ₹10000 interest/₹60000 total/₹6000 kist. Main CTA **Continue** routes to **LOAN-05**. Show the normal ready state; states to document separately: invalid APR, calculation, date picker. Strict **390 × 884dp** viewport, NOT an elongated scroll mockup or multiple screens. Compact, polished Notion + Linear + Raycast styling, white surfaces, 1dp borders, crisp small icons. Do not regenerate other screens.
