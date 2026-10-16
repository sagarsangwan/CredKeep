# Codex + Stitch MCP orchestration (bounded)

## Can Codex control Stitch?
Yes, **if** the Stitch CLI/MCP server is installed, authenticated and exposes the required project/screen tools to Codex. The MCP server is not presently connected inside this ChatGPT session; the following is a **local setup/workflow**, not an assertion that your account/project is connected.

1. In a NEW terminal, verify Node.js >=20 and Codex CLI.
2. Follow the official `@google/stitch` CLI README. Install only if not already installed: `npm install -g @google/stitch`.
3. Authenticate via `stitch login` and verify `stitch status`. Do not paste tokens, account secrets or API keys in chat.
4. Inspect available commands: `stitch --help`, `stitch mcp --help`. The documented CLI supports `stitch mcp install` for editor registration. Alternatively register its documented stdio launcher with `codex mcp add ... -- <launcher>` only after verifying exact executable/args locally.
5. Run `codex mcp list` to verify MCP registration; run a **read-only project listing** before trying any generation. Confirm the existing *CredKeep Fintech App UI/UX* project ID, never guess it.
6. If MCP isn't supported in your environment, use the Stitch CLI/SDK with the same files; ask once for missing auth/access, then stop. Never fake screenshots or assume generations succeeded.

## Agent controller rules
- Codex reads `00_foundation` and `01_components` once and maintains a lightweight checklist. Do not feed all screen files into every request.
- First: design tokens and component specimens, **one component family per task**. Generate phone screens only after user approves components.
- Next: max **2–3 screen frames per batch**, preserving existing project and approved system. Use each screen's `Ready-to-paste single-screen Stitch prompt`.
- After batch: query/list exact generated screens and export previews (if tool supports). Compare frame dimensions, content and design consistency; report created IDs, missing IDs and only next proposed batch.
- If Stitch returns 1 of 3, don't claim 3. Don't fill missing screens with one 5000px image. Stop or retry only the missing frame once.
- Avoid uncontrolled autonomous loops. Max one generation attempt plus one targeted retry per screen; require user approval at major module gates. No repeated screenshot/regeneration without evidence.
- Save outputs as `stitch_exports/<ID>/` with screen-id, preview path, exported artifact and provenance where API allows. Never leak token/keys.

## Scope separation
Stitch/Codex design mode is **design only**: no CredKeep backend deploy, no production financial data, no Git push, no APK build. Later Antigravity may implement approved exports into Expo, and a separate bounded Codex review verifies implementation before device acceptance.

## Source docs (verify command updates)
- https://github.com/google-labs-code/stitch-sdk
- https://www.npmjs.com/package/@google/stitch
- https://learn.chatgpt.com/docs/cli/reference
