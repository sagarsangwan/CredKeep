# COMP-03 — Inputs

## Purpose and reusable component contract
text, phone, money, APR, integer months, dates, PIN, textarea.

## Mandatory variants / states
empty, filled, focus, validation error, disabled, read-only; numeric keyboards.

## Layout and interaction
Small **component specimen board**, not a full phone or elongated screen; 2–4 columns of isolated labeled variants, readable at 100% zoom. Use tokens in `00_foundation/DESIGN_SYSTEM_MASTER.md`. Each specimen has anatomy (label, control, helper/error), icon semantic, input/action, visible after-state. Favor compact density and invisible >=48dp touch target. Never include an entire onboarding or loan workflow on this board.

## Acceptance
All applicable visual variants shown side-by-side; no unrelated screen designs. State transitions and disabled behavior clearly specified for React Native implementation.

## Ready-to-paste Stitch request
Create ONLY the **COMP-03 Inputs** component family for the existing CredKeep project, using the existing approved Notion/Linear/Raycast neutral token system. Show these precise specimens: text, phone, money, APR, integer months, dates, PIN, textarea. Show applicable states: empty, filled, focus, validation error, disabled, read-only; numeric keyboards. A compact **component specimen board**, not a complete phone page, not a tall list, and not any other component family. Label states and specify on-press behavior. Keep typography and icons small, consistent and readable.
