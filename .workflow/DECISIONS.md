# Architecture and Process Decisions

## Multi-Agent
- Decided to split roles: Antigravity/Gemini (Implementer & Orchestrator) and Codex (Planner/Tester/Reviewer).
- .workflow directory chosen as the synchronization point for independent agent sessions.
