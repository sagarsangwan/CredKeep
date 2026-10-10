# Model Selection Policy

## Philosophy
Optimize engineering output per model invocation to respect quota allowances. 

## Operating Policy
- **No Routine Planning Calls:** Stop requiring Codex planning for every task. Rely on the existing `V2_TASKS.md` backlog and architecture documents.
- **Implementation:** Use the current Antigravity model (Gemini) for all implementation.
- **Independent QA:** Use Codex strictly for meaningful independent reviews at completed phase boundaries (e.g., end of Phase 1) or for critical security changes.
- **Efficiency:** No redundant architecture debates, repeated full-repository reads, unnecessary Graphify indexing, or verbose reports. Use Graphify selectively for locating unfamiliar code dependencies.
- **Tooling:** Keep the current WSL Codex integration and fail-closed QA safeguards. Avoid installing new AI frameworks or memory tools.
- **Capabilities:** Never claim automatic model switching unless an actual supported interface performs it.
