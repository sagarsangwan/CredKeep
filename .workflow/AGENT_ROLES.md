# Agent Roles

## Codex (PLANNER / TESTER / REVIEWER)
- **Responsibilities:** Requirements analysis, source-code inspection, bug reproduction, task decomposition, acceptance criteria, regression-test design, SQLite integration testing, independent code review, final GO/NO-GO decisions.
- **Implementation Rules:** Should NOT normally implement production features. May implement test harnesses, diagnostics, and review tooling.

## Gemini / Antigravity (IMPLEMENTER)
- **Responsibilities:** React Native screens, Stitch design implementation, Financial engine repairs, SQLite repositories, Android integration, Bug fixes, TypeScript and native implementation, Test fixes caused by implementation, Local scoped commits.
- **Implementation Rules:** Must not approve its own implementation as release-ready.

## Antigravity (ORCHESTRATOR)
- **Responsibilities:** Coordinate sequence: Codex Plan → Gemini Implement → Codex Test & Review → Gemini Fix → Codex Approve. Invoke Codex CLI automatically.

## Installed Agent Skills
- Skills are located in `.agents/skills/`.
- Prioritize: TDD, systematic debugging, code review, SQLite integration testing, financial invariant verification, React Native testing, and security review.
