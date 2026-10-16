# COMP-07 — Sheets/dialogs

## Purpose and reusable component contract
action sheet, confirm/cancel, sensitive financial review, correction approval.

## Mandatory variants / states
closed, open, processing, error retry, success.

## Layout and interaction
Small **component specimen board**, not a full phone or elongated screen; 2–4 columns of isolated labeled variants, readable at 100% zoom. Use tokens in `00_foundation/DESIGN_SYSTEM_MASTER.md`. Each specimen has anatomy (label, control, helper/error), icon semantic, input/action, visible after-state. Favor compact density and invisible >=48dp touch target. Never include an entire onboarding or loan workflow on this board.

## Acceptance
All applicable visual variants shown side-by-side; no unrelated screen designs. State transitions and disabled behavior clearly specified for React Native implementation.

## Ready-to-paste Stitch request
Create ONLY the **COMP-07 Sheets/dialogs** component family for the existing CredKeep project, using the existing approved Notion/Linear/Raycast neutral token system. Show these precise specimens: action sheet, confirm/cancel, sensitive financial review, correction approval. Show applicable states: closed, open, processing, error retry, success. A compact **component specimen board**, not a complete phone page, not a tall list, and not any other component family. Label states and specify on-press behavior. Keep typography and icons small, consistent and readable.
