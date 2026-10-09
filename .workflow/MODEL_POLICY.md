# Model Selection Policy

## Philosophy
Choose the lowest-cost capable model for each task when supported.

## Suggested Categories
- **Simple formatting, documentation, small tests:** Available fast model.
- **Complex financial reasoning, architecture, migrations:** Capable reasoning model.
- **React Native implementation and Stitch translation:** Gemini coding-capable model.
- **Independent QA and hard debugging:** Codex reasoning-capable model.

## Orchestration Limits
Antigravity operates on session-level model configuration (no per-step dynamic model switching).
- Gemini session retains the implementation role.
- Codex CLI will be invoked with its supported model selection options for delegated work.
