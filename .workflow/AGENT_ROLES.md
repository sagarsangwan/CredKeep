# Agent Roles

## Codex (INDEPENDENT MILESTONE REVIEWER)
- **Model & Configuration:** `gpt-6.1-sol` with Medium reasoning, read-only sandbox.
- **Invocation Cadence:** Invoked at most ONCE per completed milestone boundary, strictly for high-risk changes (financial calculations, payment corrections, tenant isolation, SQLCipher, auth, migrations, sync integrity).
- **Review Scope:** Changed files in diff and immediate dependencies only. Capped at 5 actionable findings ordered by severity.
- **Zero Loop Policy:** No automated recursive reviews, retries, or post-remediation loops.

## Gemini / Antigravity (IMPLEMENTER)
- **Responsibilities:** React Native screens, Stitch design implementation, Financial engine repairs, SQLite repositories, Android integration, Bug fixes, TypeScript and native implementation, Test fixes caused by implementation, Local scoped commits.
- **Implementation Rules:** Must not approve its own implementation as release-ready. Must pass all local static checks and tests first.

## Antigravity (ORCHESTRATOR)
- **Responsibilities:** Coordinate sequence: Gemini Implement → Local Quality Gates (tsc, lint, tests) → Single Milestone Codex QA (high-risk only) → Local Remediation & Verification → Release Approval. Never loop automatically back into Codex after fixes.

## Installed Agent Skills
- Skills are located in `.agents/skills/`.
- Prioritize: TDD, systematic debugging, code review, SQLite integration testing, financial invariant verification, React Native testing, and security review.
