OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a12434-b7a5-7d73-9a64-236fb52ebf92
--------
user
Plan and implement the PIN/app lock enhancement using Expo LocalAuthentication and SecureStore. Review src/ui/PinLock.tsx and src/app/settings/security.tsx which are currently incomplete. Provide a plan to make the security settings look beautiful using the app's theme and fully functional, ensuring the PIN is stored securely, and biometric unlock is properly integrated.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the lock flow, theme, and workflow state, then map out secure PIN storage and biometric unlock. This session has read-only filesystem access, so I can inspect and prepare the implementation plan, but can’t apply or commit changes.

exec
/bin/bash -lc 'cat AGENTS.md .workflow/STATE.md package.json; cat src/ui/PinLock.tsx src/app/settings/security.tsx' in /mnt/f/personal projects/credkeep
 succeeded in 0ms:
This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Agent skills

### Issue tracker

Local markdown issues live in `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles using default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

## Autonomous Development Workflow

CredKeep operates under an autonomous AI-driven development model where the user acts solely as Product Owner. Agents must autonomously write code, select skills, run validation commands, and create local Git commits without burdening the Product Owner with manual operational prompts.

### Automatic Skill Selection Rules

Select skills autonomously based on the specific engineering task:
- **Financial Math & Ledger Engine**: Auto-select `tdd` for test-first implementation of money arithmetic, schedule generators, overdue periods, and allocation waterfalls.
- **Architecture & Boundaries**: Auto-select `setup-ts-deep-modules` when defining TypeScript interfaces, domain contracts, and encapsulated module barriers.
- **Spec Execution**: Auto-select `implement-spec` when claiming and implementing tickets from `.scratch/<feature>/issues/`.
- **Domain Alignment**: Auto-select `domain-modeling` when introducing or reconciling domain terms against `GLOSSARY.md` and `docs/adr/`.
- **Pre-Commit Verification**: Auto-select `code-review` to inspect diffs against domain invariants before committing.
- **UI Screen Construction**: Consult Stitch MCP design assets (`CredKeep V1 — Mobile Design System`, Project ID `8106667901868227815`, Expected screens: 11) for screen layouts, typography, and color tokens. NEVER use the old `CredKeep Field Lending App` project.

### Automated Local Git Workflow

Execute Git operations locally and autonomously under these invariants:
1. **Preserve Working Changes**: Inspect `git status` prior to branch transitions; preserve working changes cleanly.
2. **Scoped Feature Branches**: Create scoped branches for tickets (`feat/<feature-slug>/<ticket-slug>`).
3. **Mandatory Quality Gates**:
   - Run type checks (`npx tsc --noEmit`).
   - Run linter (`npx expo lint` or configured linter).
   - Run tests (`npm test` once configured).
   - If any check fails, resolve the issue autonomously before attempting to commit.
4. **Selective Staging**: Stage only files relevant to the specific ticket (`git add <paths>`). Never stage unrelated files or secrets.
5. **Conventional Commits**: Automatically author descriptive Conventional Commit messages (`feat(...)`, `fix(...)`, `test(...)`, `refactor(...)`, `docs(...)`).
6. **Report Commit Hash**: Always report the created commit hash and summary to the Product Owner.
7. **Strict Non-Destructive Boundary**:
   - **NEVER** automatically push to remote (`git push`).
   - **NEVER** force-push (`git push --force`).
   - **NEVER** delete branches without explicit Product Owner approval.

### Agent Permissions & Boundaries

- **Autonomous (Permitted Without Asking)**:
  - Reading, searching, and viewing project files.
  - Running safe `git status`, `git log`, and `git diff` commands.
  - Creating, editing, and formatting project source files.
  - Running development quality gates (`npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo-doctor`).
  - Running safe local diagnostic scripts and repeating failed tests after code fixes.
  - Invoking the authenticated Codex CLI for planning and independent QA in its noninteractive sandbox.
  - Running verified project-scoped Graphify commands.
  - Installing normal, necessary, compatible project development dependencies.
  - Creating task-specific local Git commits and staging selective changes.
  - Updating `.workflow` state, reports, and handoff documentation.
  - Transitioning between planning, implementation, testing, and code review autonomously.

- **Prohibited Without Explicit Approval**:
  - Deleting or resetting financial records.
  - Destructive Git operations (e.g., branch deletion, `push --force`).
  - Exposing or changing credentials.
  - Changing system-wide security settings.
  - Running untrusted scripts requiring elevated privileges.
  - Pushing code to remote repositories (GitHub/`origin`).
  - Publishing the app or triggering an EAS cloud build.
  - Bypassing operating-system security, fabricating approvals, or using unrestricted command execution to defeat safety controls.
  - Installing system-level software or machine packages.
  - Making paid services or purchases.

### Model Routing Policy

Antigravity operates on session-level model configuration (no per-step dynamic model switching). All autonomous tasks execute on the session's active strong model without simulating unsupported routing.

## Performance Is a Continuous Requirement

CredKeep is a lightweight, offline-first Android financial application.

Performance, efficient storage, and reasonable APK size are permanent engineering requirements, not optional V2 enhancements.

### 1. APK Size

- Investigate unnecessary native modules and bundled assets.
- Avoid adding dependencies when built-in React Native or Expo functionality is sufficient.
- Preserve SQLCipher and other required security features.
- Keep production JavaScript minification and compatible native shrinking enabled.
- Measure actual APK size after every approved release build.
- Compare each new artifact with the previous measured release.
- Investigate significant unexplained size increases.
- Never claim a particular APK size reduction without measuring it.
- Never compromise security or financial correctness merely to reduce APK size.

### 2. React Native Performance

- Avoid unnecessary component rerenders.
- Use FlatList or appropriate virtualized lists for potentially large borrower, loan, or transaction collections.
- Paginate lengthy histories.
- Avoid expensive calculations directly inside render functions.
- Use memoization where profiling or measurable behavior justifies it.
- Ensure loading, empty, and error states remain responsive.
- Avoid oversized image assets and unnecessary animation libraries.

### 3. SQLite Performance

- Add appropriate indexes for borrower_id, loan_id, due_date, status, and frequently queried transaction timestamps.
- Avoid N+1 queries in borrower and loan lists.
- Use transactions for financial mutations.
- Paginate long transaction histories.
- Measure query performance using realistic test datasets.
- Maintain correct journal and balance reconciliation.
- Never sacrifice accuracy or auditability for speed.

### 4. Startup & Memory

- Keep app startup lightweight.
- Initialize the database and security layer correctly.
- Avoid loading every historical transaction during application startup.
- Load screen-specific data when necessary.
- Clean up listeners and subscriptions.
- Avoid retaining redundant financial data in memory.

### 5. Offline & Battery Efficiency

- All V1 financial workflows must function without connectivity.
- Avoid unnecessary background polling.
- Use database mutation notifications or suitable state invalidation instead of continuous queries.
- Avoid unnecessary background tasks and battery-consuming refresh loops.

### 6. Dependency Discipline

Before installing a package:
- Verify that it is required.
- Check compatibility with the installed Expo SDK.
- Consider APK/native binary size implications.
- Prefer maintained packages.
- Avoid duplicate libraries performing the same job.

Do not remove a required dependency solely because it increases APK size.

### 7. Release Optimization Gate

Before requesting approval for a new EAS build:

- All critical business workflows must pass tests.
- TypeScript, ESLint, and Expo Doctor must pass.
- Check for unused dependencies and accidentally bundled development assets.
- Confirm appropriate release minification and resource shrinking.
- Confirm security and database functionality remain intact.
- Summarize any known performance concerns.

After an approved EAS build, report:

- Actual APK file size
- Build profile and Git commit
- APK architecture(s), if verified
- Startup performance, if measured
- Relevant performance regressions
- Prioritized optimization opportunities

Never invent benchmark results.

### 8. Optimization Priorities

Priority order:

1. Financial correctness and data integrity
2. Security
3. Functional offline workflows
4. UI responsiveness and Android stability
5. Battery and memory efficiency
6. APK size reduction
7. Cosmetic performance improvements

Do not perform broad architectural rewrites merely to reduce bundle size.

### 9. Automation

Apply these rules to every future CredKeep task automatically.

Use profiling and measurement before making invasive optimizations.

Perform safe, low-risk optimization during development.

Reserve intensive APK analysis and performance tuning for the final V1 stabilization phase.

## Multi-Agent Workflow Integration
This project uses a split-agent model:
- **Codex:** Planner, Tester, Reviewer. Operates independently.
- **Gemini / Antigravity:** Implementer and Orchestrator.

**Coordination Rules:**
1. All agents MUST read `.workflow/STATE.md` before taking action.
2. Agents MUST read `AGENTS.md` before every action.
3. Hand-offs occur by updating `.workflow/HANDOFF.md` and invoking the next agent.
4. Codex is the final arbiter of QA and tests.
5. All completed work MUST have local Git commits with conventional commit messages.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
# CredKeep Project State

## Current Context
- **Current Git Branch:** feat/security/pin-lock
- **HEAD Commit:** pending

## Active Task
- **Task ID:** PIN/app lock
- **Assigned Agent:** Gemini
- **Current Stage:** Phase 1 - Planning

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** N/A
- **Next Action:** Plan and implement the PIN/app lock enhancement using Expo LocalAuthentication and SecureStore.
{
  "name": "credkeep",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "crypto-js": "^4.2.0",
    "expo": "~57.0.27",
    "expo-build-properties": "~57.0.22",
    "expo-constants": "~57.0.21",
    "expo-crypto": "~57.0.3",
    "expo-document-picker": "~57.0.3",
    "expo-file-system": "~57.0.7",
    "expo-linking": "~57.0.12",
    "expo-local-authentication": "~57.0.3",
    "expo-router": "~57.0.25",
    "expo-secure-store": "~57.0.4",
    "expo-sharing": "~57.0.22",
    "expo-sqlite": "~57.0.4",
    "expo-status-bar": "~57.0.1",
    "lucide-react-native": "^1.54.0",
    "react": "19.2.3",
    "react-native": "0.86.3",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "~4.26.0",
    "react-native-svg": "^15.15.4"
  },
  "devDependencies": {
    "@react-native/jest-preset": "^0.86.3",
    "@types/crypto-js": "^4.2.2",
    "@types/jest": "29.5.14",
    "@types/react": "~19.2.2",
    "eslint": "^9.0.0",
    "eslint-config-expo": "~57.0.2",
    "jest": "^29.7.0",
    "jest-expo": "^57.0.5",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "test": "jest"
  },
  "private": true,
  "overrides": {
    "react-dom": "19.2.3"
  }
}
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { theme } from './theme';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const appState = React.useRef(AppState.currentState);

  const checkPinSetup = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin) {
        setHasPin(true);
        setStoredPin(pin);
        
        // Check biometrics
        const bioEnabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
        if (bioEnabled === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock CredKeep',
              fallbackLabel: 'Use PIN',
            });
            if (auth.success) {
              setIsLocked(false);
            }
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('SecureStore error', e);
      setIsLocked(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (storedPin) {
          setIsLocked(true);
          setPinEntry('');
          checkPinSetup();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [storedPin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup();
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
    setError(false);
  };

  if (!isLocked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
        Enter PIN
      </Typography>
      
      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              pinEntry.length >= i ? styles.dotFilled : null,
              error ? styles.dotError : null
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => key === 'del' ? handleBackspace() : key ? handleKeyPress(key) : null}
            disabled={!key}
          >
            {key === 'del' ? (
              <Typography variant="headlineSm" color={theme.colors.onSurface}>⌫</Typography>
            ) : key ? (
              <Typography variant="headlineLg" color={theme.colors.onSurface}>{key}</Typography>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 80,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
  dotError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 40,
  }
});
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { PIN_KEY, BIO_ENABLED_KEY } from '../../ui/PinLock';

export default function SecuritySettingsScreen() {
  const [hasPin, setHasPin] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  const loadStatus = async () => {
    const pin = await SecureStore.getItemAsync(PIN_KEY);
    setHasPin(!!pin);
    const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
    setBioEnabled(bio === 'true');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, []);

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, val ? 'true' : 'false');
    setBioEnabled(val);
  };

  const handleSetPin = async () => {
    if (pinEntry.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    await SecureStore.setItemAsync(PIN_KEY, pinEntry);
    setHasPin(true);
    setIsSettingPin(false);
    setPinEntry('');
    Alert.alert('Success', 'PIN set successfully.');
  };

  const handleRemovePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setHasPin(false);
    setBioEnabled(false);
    Alert.alert('Success', 'App Lock removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          App Security
        </Typography>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.error}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: 20 }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && !isSettingPin && (
          <Button title="Set up PIN" onPress={() => setIsSettingPin(true)} style={{ marginTop: 20 }} />
        )}

        {!hasPin && isSettingPin && (
          <View style={{ marginTop: 20 }}>
            <Typography variant="labelLg" color={theme.colors.onSurface}>Enter 4-digit PIN</Typography>
            {/* Extremely simple input for settings, relying on custom keypad is better but a TextInput or styled View works here */}
            {/* In a real app we'd use the same Keypad, but for brevity we'll just allow setting it directly or with a keypad */}
            <Typography variant="headlineLg" style={{ marginVertical: 20 }}>{pinEntry.padEnd(4, '-')}</Typography>
            <View style={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9','C','0','OK'].map(k => (
                <Button 
                  key={k} 
                  title={k} 
                  variant="outline" 
                  style={{ width: 80, marginBottom: 10 }} 
                  onPress={() => {
                    if (k === 'C') setPinEntry('');
                    else if (k === 'OK') handleSetPin();
                    else if (pinEntry.length < 4) setPinEntry(pinEntry + k);
                  }} 
                />
              ))}
            </View>
          </View>
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: 20 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: 260,
  }
});

web search: 
exec
/bin/bash -lc "cat AGENTS.md >/dev/null; git status --short; if test -f graphify-out/graph.json; then graphify query 'How are app PIN lock, security settings, theme and root layout connected?'; fi; cat src/app/settings/security.tsx src/ui/PinLock.tsx src/ui/theme.ts src/app/_layout.tsx app.json; rg --files | rg 'security|auth|test|lock|settings|bun.lock'; cat /mnt/f/'personal projects'/credkeep/.agents/skills/security-review/SKILL.md" in /mnt/f/personal projects/credkeep
 succeeded in 1024ms:
 M .agents/rules/graphify.md
 M .agents/skills/code-review/SKILL.md
 M .agents/skills/code-review/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/SKILL.md
 M .agents/skills/diagnosing-bugs/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/scripts/hitl-loop.template.sh
 M .agents/skills/tdd/SKILL.md
 M .agents/skills/tdd/agents/openai.yaml
 M .agents/skills/tdd/mocking.md
 M .agents/skills/tdd/tests.md
 M .agents/workflows/graphify.md
 D .codex/hooks.json
 M .workflow/HANDOFF.md
 M .workflow/STATE.md
 M .workflow/TASKS.md
 M .workflow/plans/CK-P0-001.md
 M .workflow/plans/CK-P0-002.md
 M .workflow/plans/CK-P0-003-QA.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M AGENTS.md
 M jest.config.js
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M tsconfig.json
?? .codex/hooks.json.disabled
?? .workflow/mock-cmd.bat
?? .workflow/plans/Borrower_Profile.md
?? .workflow/plans/Borrower_Profile_Impl.md
?? .workflow/plans/Borrower_Profile_Impl_prompt.txt
?? .workflow/plans/Borrower_Profile_prompt.txt
?? .workflow/plans/PIN_App_Lock.md
?? .workflow/plans/PIN_App_Lock_prompt.txt
?? .workflow/reports/CODEX_QA_DIAGNOSTIC.md
?? .workflow/reports/Stale_Home_earnings_qa_prompt.txt
?? .workflow/reports/Stale_Home_earnings_qa_report.md
?? .workflow/reports/mock-task_qa_prompt.txt
/bin/bash: line 1: graphify: command not found
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { PIN_KEY, BIO_ENABLED_KEY } from '../../ui/PinLock';

export default function SecuritySettingsScreen() {
  const [hasPin, setHasPin] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  const loadStatus = async () => {
    const pin = await SecureStore.getItemAsync(PIN_KEY);
    setHasPin(!!pin);
    const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
    setBioEnabled(bio === 'true');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, []);

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, val ? 'true' : 'false');
    setBioEnabled(val);
  };

  const handleSetPin = async () => {
    if (pinEntry.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    await SecureStore.setItemAsync(PIN_KEY, pinEntry);
    setHasPin(true);
    setIsSettingPin(false);
    setPinEntry('');
    Alert.alert('Success', 'PIN set successfully.');
  };

  const handleRemovePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setHasPin(false);
    setBioEnabled(false);
    Alert.alert('Success', 'App Lock removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          App Security
        </Typography>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.error}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: 20 }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && !isSettingPin && (
          <Button title="Set up PIN" onPress={() => setIsSettingPin(true)} style={{ marginTop: 20 }} />
        )}

        {!hasPin && isSettingPin && (
          <View style={{ marginTop: 20 }}>
            <Typography variant="labelLg" color={theme.colors.onSurface}>Enter 4-digit PIN</Typography>
            {/* Extremely simple input for settings, relying on custom keypad is better but a TextInput or styled View works here */}
            {/* In a real app we'd use the same Keypad, but for brevity we'll just allow setting it directly or with a keypad */}
            <Typography variant="headlineLg" style={{ marginVertical: 20 }}>{pinEntry.padEnd(4, '-')}</Typography>
            <View style={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9','C','0','OK'].map(k => (
                <Button 
                  key={k} 
                  title={k} 
                  variant="outline" 
                  style={{ width: 80, marginBottom: 10 }} 
                  onPress={() => {
                    if (k === 'C') setPinEntry('');
                    else if (k === 'OK') handleSetPin();
                    else if (pinEntry.length < 4) setPinEntry(pinEntry + k);
                  }} 
                />
              ))}
            </View>
          </View>
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: 20 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: 260,
  }
});
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { theme } from './theme';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const appState = React.useRef(AppState.currentState);

  const checkPinSetup = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin) {
        setHasPin(true);
        setStoredPin(pin);
        
        // Check biometrics
        const bioEnabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
        if (bioEnabled === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock CredKeep',
              fallbackLabel: 'Use PIN',
            });
            if (auth.success) {
              setIsLocked(false);
            }
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('SecureStore error', e);
      setIsLocked(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (storedPin) {
          setIsLocked(true);
          setPinEntry('');
          checkPinSetup();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [storedPin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup();
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
    setError(false);
  };

  if (!isLocked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
        Enter PIN
      </Typography>
      
      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              pinEntry.length >= i ? styles.dotFilled : null,
              error ? styles.dotError : null
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => key === 'del' ? handleBackspace() : key ? handleKeyPress(key) : null}
            disabled={!key}
          >
            {key === 'del' ? (
              <Typography variant="headlineSm" color={theme.colors.onSurface}>⌫</Typography>
            ) : key ? (
              <Typography variant="headlineLg" color={theme.colors.onSurface}>{key}</Typography>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 80,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
  dotError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 40,
  }
});
export const theme = {
  colors: {
    primary: '#001328',
    primaryContainer: '#14283f',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#7c8fab',
    secondary: '#006a62',
    secondaryFixed: '#94f3e7',
    onSecondary: '#ffffff',
    background: '#f7f9fb',
    onBackground: '#191c1e',
    surface: '#f7f9fb',
    onSurface: '#191c1e',
    surfaceVariant: '#e0e3e5',
    onSurfaceVariant: '#44474d',
    surfaceTint: '#4d6079',
    surfaceContainerHighest: '#e0e3e5',
    surfaceContainerHigh: '#e6e8ea',
    surfaceContainerLow: '#f2f4f6',
    surfaceContainerLowest: '#ffffff',
    outline: '#74777e',
    outlineVariant: '#c4c6cd',
    textPrimary: '#191c1e',
    textSecondary: '#44474d',
    success: '#16a34a',
    successContainer: '#7ffc97',
    warning: '#EA580C',
    warningContainer: '#FFEDD5',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
  },
  typography: {
    rupeeDisplay: {
      fontFamily: 'Inter',
      fontSize: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.03 * 30,
    },
    headlineLg: {
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: '700' as const,
      letterSpacing: -0.02 * 32,
    },
    headlineMd: {
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.01 * 22,
    },
    headlineSm: {
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: '600' as const,
    },
    titleMd: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '500' as const,
    },
    bodyLg: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '400' as const,
    },
    bodyMd: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '400' as const,
    },
    bodySm: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '400' as const,
    },
    labelLg: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.01 * 14,
    },
    labelMd: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '600' as const,
      letterSpacing: 0.02 * 12,
    },
    labelSm: {
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: '700' as const,
      letterSpacing: 0.04 * 10,
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  }
};
import { Stack } from 'expo-router';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <PinLock>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="borrower" options={{ headerShown: false }} />
            <Stack.Screen name="loan" options={{ headerShown: false }} />
          </Stack>
        </PinLock>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
{
  "expo": {
    "name": "credkeep",
    "slug": "credkeep",
    "scheme": "credkeep",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.sagarsangwan.credkeep",
      "versionCode": 2,
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26,
            "enableProguardInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ],
      "expo-status-bar",
      "expo-sharing"
    ],
    "extra": {
      "router": {},
      "eas": {
        "projectId": "44042971-c1f1-4f47-bec5-04950efe3bbf"
      }
    },
    "owner": "sagarsangwan"
  }
}
package-lock.json
src/__tests__/cross-loan.test.ts
src/__tests__/bullet-loan.test.ts
src/__tests__/loans.test.tsx
src/core/database/loanRepository.test.ts
src/core/domain/money.test.ts
src/core/domain/backupUtil.test.ts
src/core/domain/allocation.test.ts
src/core/domain/penalty.test.ts
src/core/domain/schedule.test.ts
src/app/settings/backup.tsx
src/app/settings/security.tsx
---
name: security-review
description: Security review checklist for CredKeep
---

# Security Review

1. Do not expose borrower data.
2. Protect SQLite database encryption.
3. Keep Backup/Restore disabled until verified.
4. Review PIN/app lock.

web search: https://docs.expo.dev/versions/v57.0.0/
codex
The current lock opens the app if SecureStore throws an error, and settings changes don’t update the lock’s cached PIN. PIN setup also displays the digits, has no confirmation step, and allows removal without re-authentication.

I’m applying the repository’s security-review skill. The plan will use shared security state, keep the app locked on storage errors, and require authentication for sensitive settings changes. Stitch tools aren’t available here, so I’ll base the visual design on the existing theme.

web search: 
exec
/bin/bash -lc "cat AGENTS.md >/dev/null; cat .workflow/plans/PIN_App_Lock.md .workflow/HANDOFF.md jest.config.js src/core/database/DatabaseProvider.tsx; rg -n 'SecureStore|Crypto|PBKDF|PIN|security' src/core src/app/'(tabs)' src/ui; command -v node; command -v npm; test -d node_modules && echo node_modules-present; rg --files .agents/skills | rg 'setup-ts|react-native';" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null; npx --no-install tsc --noEmit --incremental false' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null; npx --no-install eslint src --no-cache' in /mnt/f/personal projects/credkeep
 succeeded in 101ms:
OpenAI Codex v0.162.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 01a12434-b7a5-7d73-9a64-236fb52ebf92
--------
user
Plan and implement the PIN/app lock enhancement using Expo LocalAuthentication and SecureStore. Review src/ui/PinLock.tsx and src/app/settings/security.tsx which are currently incomplete. Provide a plan to make the security settings look beautiful using the app's theme and fully functional, ensuring the PIN is stored securely, and biometric unlock is properly integrated.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the lock flow, theme, and workflow state, then map out secure PIN storage and biometric unlock. This session has read-only filesystem access, so I can inspect and prepare the implementation plan, but can’t apply or commit changes.

exec
/bin/bash -lc 'cat AGENTS.md .workflow/STATE.md package.json; cat src/ui/PinLock.tsx src/app/settings/security.tsx' in /mnt/f/personal projects/credkeep
 succeeded in 0ms:
This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Agent skills

### Issue tracker

Local markdown issues live in `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles using default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

## Autonomous Development Workflow

CredKeep operates under an autonomous AI-driven development model where the user acts solely as Product Owner. Agents must autonomously write code, select skills, run validation commands, and create local Git commits without burdening the Product Owner with manual operational prompts.

### Automatic Skill Selection Rules

Select skills autonomously based on the specific engineering task:
- **Financial Math & Ledger Engine**: Auto-select `tdd` for test-first implementation of money arithmetic, schedule generators, overdue periods, and allocation waterfalls.
- **Architecture & Boundaries**: Auto-select `setup-ts-deep-modules` when defining TypeScript interfaces, domain contracts, and encapsulated module barriers.
- **Spec Execution**: Auto-select `implement-spec` when claiming and implementing tickets from `.scratch/<feature>/issues/`.
- **Domain Alignment**: Auto-select `domain-modeling` when introducing or reconciling domain terms against `GLOSSARY.md` and `docs/adr/`.
- **Pre-Commit Verification**: Auto-select `code-review` to inspect diffs against domain invariants before committing.
- **UI Screen Construction**: Consult Stitch MCP design assets (`CredKeep V1 — Mobile Design System`, Project ID `8106667901868227815`, Expected screens: 11) for screen layouts, typography, and color tokens. NEVER use the old `CredKeep Field Lending App` project.

### Automated Local Git Workflow

Execute Git operations locally and autonomously under these invariants:
1. **Preserve Working Changes**: Inspect `git status` prior to branch transitions; preserve working changes cleanly.
2. **Scoped Feature Branches**: Create scoped branches for tickets (`feat/<feature-slug>/<ticket-slug>`).
3. **Mandatory Quality Gates**:
   - Run type checks (`npx tsc --noEmit`).
   - Run linter (`npx expo lint` or configured linter).
   - Run tests (`npm test` once configured).
   - If any check fails, resolve the issue autonomously before attempting to commit.
4. **Selective Staging**: Stage only files relevant to the specific ticket (`git add <paths>`). Never stage unrelated files or secrets.
5. **Conventional Commits**: Automatically author descriptive Conventional Commit messages (`feat(...)`, `fix(...)`, `test(...)`, `refactor(...)`, `docs(...)`).
6. **Report Commit Hash**: Always report the created commit hash and summary to the Product Owner.
7. **Strict Non-Destructive Boundary**:
   - **NEVER** automatically push to remote (`git push`).
   - **NEVER** force-push (`git push --force`).
   - **NEVER** delete branches without explicit Product Owner approval.

### Agent Permissions & Boundaries

- **Autonomous (Permitted Without Asking)**:
  - Reading, searching, and viewing project files.
  - Running safe `git status`, `git log`, and `git diff` commands.
  - Creating, editing, and formatting project source files.
  - Running development quality gates (`npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo-doctor`).
  - Running safe local diagnostic scripts and repeating failed tests after code fixes.
  - Invoking the authenticated Codex CLI for planning and independent QA in its noninteractive sandbox.
  - Running verified project-scoped Graphify commands.
  - Installing normal, necessary, compatible project development dependencies.
  - Creating task-specific local Git commits and staging selective changes.
  - Updating `.workflow` state, reports, and handoff documentation.
  - Transitioning between planning, implementation, testing, and code review autonomously.

- **Prohibited Without Explicit Approval**:
  - Deleting or resetting financial records.
  - Destructive Git operations (e.g., branch deletion, `push --force`).
  - Exposing or changing credentials.
  - Changing system-wide security settings.
  - Running untrusted scripts requiring elevated privileges.
  - Pushing code to remote repositories (GitHub/`origin`).
  - Publishing the app or triggering an EAS cloud build.
  - Bypassing operating-system security, fabricating approvals, or using unrestricted command execution to defeat safety controls.
  - Installing system-level software or machine packages.
  - Making paid services or purchases.

### Model Routing Policy

Antigravity operates on session-level model configuration (no per-step dynamic model switching). All autonomous tasks execute on the session's active strong model without simulating unsupported routing.

## Performance Is a Continuous Requirement

CredKeep is a lightweight, offline-first Android financial application.

Performance, efficient storage, and reasonable APK size are permanent engineering requirements, not optional V2 enhancements.

### 1. APK Size

- Investigate unnecessary native modules and bundled assets.
- Avoid adding dependencies when built-in React Native or Expo functionality is sufficient.
- Preserve SQLCipher and other required security features.
- Keep production JavaScript minification and compatible native shrinking enabled.
- Measure actual APK size after every approved release build.
- Compare each new artifact with the previous measured release.
- Investigate significant unexplained size increases.
- Never claim a particular APK size reduction without measuring it.
- Never compromise security or financial correctness merely to reduce APK size.

### 2. React Native Performance

- Avoid unnecessary component rerenders.
- Use FlatList or appropriate virtualized lists for potentially large borrower, loan, or transaction collections.
- Paginate lengthy histories.
- Avoid expensive calculations directly inside render functions.
- Use memoization where profiling or measurable behavior justifies it.
- Ensure loading, empty, and error states remain responsive.
- Avoid oversized image assets and unnecessary animation libraries.

### 3. SQLite Performance

- Add appropriate indexes for borrower_id, loan_id, due_date, status, and frequently queried transaction timestamps.
- Avoid N+1 queries in borrower and loan lists.
- Use transactions for financial mutations.
- Paginate long transaction histories.
- Measure query performance using realistic test datasets.
- Maintain correct journal and balance reconciliation.
- Never sacrifice accuracy or auditability for speed.

### 4. Startup & Memory

- Keep app startup lightweight.
- Initialize the database and security layer correctly.
- Avoid loading every historical transaction during application startup.
- Load screen-specific data when necessary.
- Clean up listeners and subscriptions.
- Avoid retaining redundant financial data in memory.

### 5. Offline & Battery Efficiency

- All V1 financial workflows must function without connectivity.
- Avoid unnecessary background polling.
- Use database mutation notifications or suitable state invalidation instead of continuous queries.
- Avoid unnecessary background tasks and battery-consuming refresh loops.

### 6. Dependency Discipline

Before installing a package:
- Verify that it is required.
- Check compatibility with the installed Expo SDK.
- Consider APK/native binary size implications.
- Prefer maintained packages.
- Avoid duplicate libraries performing the same job.

Do not remove a required dependency solely because it increases APK size.

### 7. Release Optimization Gate

Before requesting approval for a new EAS build:

- All critical business workflows must pass tests.
- TypeScript, ESLint, and Expo Doctor must pass.
- Check for unused dependencies and accidentally bundled development assets.
- Confirm appropriate release minification and resource shrinking.
- Confirm security and database functionality remain intact.
- Summarize any known performance concerns.

After an approved EAS build, report:

- Actual APK file size
- Build profile and Git commit
- APK architecture(s), if verified
- Startup performance, if measured
- Relevant performance regressions
- Prioritized optimization opportunities

Never invent benchmark results.

### 8. Optimization Priorities

Priority order:

1. Financial correctness and data integrity
2. Security
3. Functional offline workflows
4. UI responsiveness and Android stability
5. Battery and memory efficiency
6. APK size reduction
7. Cosmetic performance improvements

Do not perform broad architectural rewrites merely to reduce bundle size.

### 9. Automation

Apply these rules to every future CredKeep task automatically.

Use profiling and measurement before making invasive optimizations.

Perform safe, low-risk optimization during development.

Reserve intensive APK analysis and performance tuning for the final V1 stabilization phase.

## Multi-Agent Workflow Integration
This project uses a split-agent model:
- **Codex:** Planner, Tester, Reviewer. Operates independently.
- **Gemini / Antigravity:** Implementer and Orchestrator.

**Coordination Rules:**
1. All agents MUST read `.workflow/STATE.md` before taking action.
2. Agents MUST read `AGENTS.md` before every action.
3. Hand-offs occur by updating `.workflow/HANDOFF.md` and invoking the next agent.
4. Codex is the final arbiter of QA and tests.
5. All completed work MUST have local Git commits with conventional commit messages.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
# CredKeep Project State

## Current Context
- **Current Git Branch:** feat/security/pin-lock
- **HEAD Commit:** pending

## Active Task
- **Task ID:** PIN/app lock
- **Assigned Agent:** Gemini
- **Current Stage:** Phase 1 - Planning

## Status
- **Known Failures:** None.
- **Latest Verified Test Results:** N/A
- **Next Action:** Plan and implement the PIN/app lock enhancement using Expo LocalAuthentication and SecureStore.
{
  "name": "credkeep",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "crypto-js": "^4.2.0",
    "expo": "~57.0.27",
    "expo-build-properties": "~57.0.22",
    "expo-constants": "~57.0.21",
    "expo-crypto": "~57.0.3",
    "expo-document-picker": "~57.0.3",
    "expo-file-system": "~57.0.7",
    "expo-linking": "~57.0.12",
    "expo-local-authentication": "~57.0.3",
    "expo-router": "~57.0.25",
    "expo-secure-store": "~57.0.4",
    "expo-sharing": "~57.0.22",
    "expo-sqlite": "~57.0.4",
    "expo-status-bar": "~57.0.1",
    "lucide-react-native": "^1.54.0",
    "react": "19.2.3",
    "react-native": "0.86.3",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "~4.26.0",
    "react-native-svg": "^15.15.4"
  },
  "devDependencies": {
    "@react-native/jest-preset": "^0.86.3",
    "@types/crypto-js": "^4.2.2",
    "@types/jest": "29.5.14",
    "@types/react": "~19.2.2",
    "eslint": "^9.0.0",
    "eslint-config-expo": "~57.0.2",
    "jest": "^29.7.0",
    "jest-expo": "^57.0.5",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "test": "jest"
  },
  "private": true,
  "overrides": {
    "react-dom": "19.2.3"
  }
}
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { theme } from './theme';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const appState = React.useRef(AppState.currentState);

  const checkPinSetup = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin) {
        setHasPin(true);
        setStoredPin(pin);
        
        // Check biometrics
        const bioEnabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
        if (bioEnabled === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock CredKeep',
              fallbackLabel: 'Use PIN',
            });
            if (auth.success) {
              setIsLocked(false);
            }
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('SecureStore error', e);
      setIsLocked(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (storedPin) {
          setIsLocked(true);
          setPinEntry('');
          checkPinSetup();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [storedPin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup();
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
    setError(false);
  };

  if (!isLocked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
        Enter PIN
      </Typography>
      
      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              pinEntry.length >= i ? styles.dotFilled : null,
              error ? styles.dotError : null
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => key === 'del' ? handleBackspace() : key ? handleKeyPress(key) : null}
            disabled={!key}
          >
            {key === 'del' ? (
              <Typography variant="headlineSm" color={theme.colors.onSurface}>⌫</Typography>
            ) : key ? (
              <Typography variant="headlineLg" color={theme.colors.onSurface}>{key}</Typography>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 80,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
  dotError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 40,
  }
});
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { PIN_KEY, BIO_ENABLED_KEY } from '../../ui/PinLock';

export default function SecuritySettingsScreen() {
  const [hasPin, setHasPin] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  const loadStatus = async () => {
    const pin = await SecureStore.getItemAsync(PIN_KEY);
    setHasPin(!!pin);
    const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
    setBioEnabled(bio === 'true');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, []);

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, val ? 'true' : 'false');
    setBioEnabled(val);
  };

  const handleSetPin = async () => {
    if (pinEntry.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    await SecureStore.setItemAsync(PIN_KEY, pinEntry);
    setHasPin(true);
    setIsSettingPin(false);
    setPinEntry('');
    Alert.alert('Success', 'PIN set successfully.');
  };

  const handleRemovePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setHasPin(false);
    setBioEnabled(false);
    Alert.alert('Success', 'App Lock removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          App Security
        </Typography>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.error}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: 20 }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && !isSettingPin && (
          <Button title="Set up PIN" onPress={() => setIsSettingPin(true)} style={{ marginTop: 20 }} />
        )}

        {!hasPin && isSettingPin && (
          <View style={{ marginTop: 20 }}>
            <Typography variant="labelLg" color={theme.colors.onSurface}>Enter 4-digit PIN</Typography>
            {/* Extremely simple input for settings, relying on custom keypad is better but a TextInput or styled View works here */}
            {/* In a real app we'd use the same Keypad, but for brevity we'll just allow setting it directly or with a keypad */}
            <Typography variant="headlineLg" style={{ marginVertical: 20 }}>{pinEntry.padEnd(4, '-')}</Typography>
            <View style={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9','C','0','OK'].map(k => (
                <Button 
                  key={k} 
                  title={k} 
                  variant="outline" 
                  style={{ width: 80, marginBottom: 10 }} 
                  onPress={() => {
                    if (k === 'C') setPinEntry('');
                    else if (k === 'OK') handleSetPin();
                    else if (pinEntry.length < 4) setPinEntry(pinEntry + k);
                  }} 
                />
              ))}
            </View>
          </View>
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: 20 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: 260,
  }
});

web search: 
exec
/bin/bash -lc "cat AGENTS.md >/dev/null; git status --short; if test -f graphify-out/graph.json; then graphify query 'How are app PIN lock, security settings, theme and root layout connected?'; fi; cat src/app/settings/security.tsx src/ui/PinLock.tsx src/ui/theme.ts src/app/_layout.tsx app.json; rg --files | rg 'security|auth|test|lock|settings|bun.lock'; cat /mnt/f/'personal projects'/credkeep/.agents/skills/security-review/SKILL.md" in /mnt/f/personal projects/credkeep
 succeeded in 1024ms:
 M .agents/rules/graphify.md
 M .agents/skills/code-review/SKILL.md
 M .agents/skills/code-review/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/SKILL.md
 M .agents/skills/diagnosing-bugs/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/scripts/hitl-loop.template.sh
 M .agents/skills/tdd/SKILL.md
 M .agents/skills/tdd/agents/openai.yaml
 M .agents/skills/tdd/mocking.md
 M .agents/skills/tdd/tests.md
 M .agents/workflows/graphify.md
 D .codex/hooks.json
 M .workflow/HANDOFF.md
 M .workflow/STATE.md
 M .workflow/TASKS.md
 M .workflow/plans/CK-P0-001.md
 M .workflow/plans/CK-P0-002.md
 M .workflow/plans/CK-P0-003-QA.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M AGENTS.md
 M jest.config.js
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M tsconfig.json
?? .codex/hooks.json.disabled
?? .workflow/mock-cmd.bat
?? .workflow/plans/Borrower_Profile.md
?? .workflow/plans/Borrower_Profile_Impl.md
?? .workflow/plans/Borrower_Profile_Impl_prompt.txt
?? .workflow/plans/Borrower_Profile_prompt.txt
?? .workflow/plans/PIN_App_Lock.md
?? .workflow/plans/PIN_App_Lock_prompt.txt
?? .workflow/reports/CODEX_QA_DIAGNOSTIC.md
?? .workflow/reports/Stale_Home_earnings_qa_prompt.txt
?? .workflow/reports/Stale_Home_earnings_qa_report.md
?? .workflow/reports/mock-task_qa_prompt.txt
/bin/bash: line 1: graphify: command not found
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { PIN_KEY, BIO_ENABLED_KEY } from '../../ui/PinLock';

export default function SecuritySettingsScreen() {
  const [hasPin, setHasPin] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  const loadStatus = async () => {
    const pin = await SecureStore.getItemAsync(PIN_KEY);
    setHasPin(!!pin);
    const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
    setBioEnabled(bio === 'true');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
  }, []);

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, val ? 'true' : 'false');
    setBioEnabled(val);
  };

  const handleSetPin = async () => {
    if (pinEntry.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    await SecureStore.setItemAsync(PIN_KEY, pinEntry);
    setHasPin(true);
    setIsSettingPin(false);
    setPinEntry('');
    Alert.alert('Success', 'PIN set successfully.');
  };

  const handleRemovePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setHasPin(false);
    setBioEnabled(false);
    Alert.alert('Success', 'App Lock removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Typography variant="headlineMd" color={theme.colors.onBackground} style={styles.title}>
          App Security
        </Typography>

        <View style={styles.card}>
          <View style={styles.row}>
            <Typography variant="titleMd" color={theme.colors.onSurface}>App Lock (PIN)</Typography>
            <Typography variant="labelLg" color={hasPin ? theme.colors.primary : theme.colors.error}>
              {hasPin ? 'Enabled' : 'Disabled'}
            </Typography>
          </View>
          
          {hasPin && (
            <View style={[styles.row, { marginTop: 20 }]}>
              <Typography variant="titleMd" color={theme.colors.onSurface}>Biometric Unlock</Typography>
              <Switch value={bioEnabled} onValueChange={handleToggleBio} />
            </View>
          )}
        </View>

        {!hasPin && !isSettingPin && (
          <Button title="Set up PIN" onPress={() => setIsSettingPin(true)} style={{ marginTop: 20 }} />
        )}

        {!hasPin && isSettingPin && (
          <View style={{ marginTop: 20 }}>
            <Typography variant="labelLg" color={theme.colors.onSurface}>Enter 4-digit PIN</Typography>
            {/* Extremely simple input for settings, relying on custom keypad is better but a TextInput or styled View works here */}
            {/* In a real app we'd use the same Keypad, but for brevity we'll just allow setting it directly or with a keypad */}
            <Typography variant="headlineLg" style={{ marginVertical: 20 }}>{pinEntry.padEnd(4, '-')}</Typography>
            <View style={styles.keypad}>
              {['1','2','3','4','5','6','7','8','9','C','0','OK'].map(k => (
                <Button 
                  key={k} 
                  title={k} 
                  variant="outline" 
                  style={{ width: 80, marginBottom: 10 }} 
                  onPress={() => {
                    if (k === 'C') setPinEntry('');
                    else if (k === 'OK') handleSetPin();
                    else if (pinEntry.length < 4) setPinEntry(pinEntry + k);
                  }} 
                />
              ))}
            </View>
          </View>
        )}

        {hasPin && (
          <Button variant="outline" title="Remove App Lock" onPress={handleRemovePin} style={{ marginTop: 20 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: 260,
  }
});
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { theme } from './theme';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const appState = React.useRef(AppState.currentState);

  const checkPinSetup = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin) {
        setHasPin(true);
        setStoredPin(pin);
        
        // Check biometrics
        const bioEnabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
        if (bioEnabled === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock CredKeep',
              fallbackLabel: 'Use PIN',
            });
            if (auth.success) {
              setIsLocked(false);
            }
          }
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.error('SecureStore error', e);
      setIsLocked(false);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        if (storedPin) {
          setIsLocked(true);
          setPinEntry('');
          checkPinSetup();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [storedPin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup();
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry(prev => prev.slice(0, -1));
    setError(false);
  };

  if (!isLocked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
        Enter PIN
      </Typography>
      
      <View style={styles.dotsContainer}>
        {[1, 2, 3, 4].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              pinEntry.length >= i ? styles.dotFilled : null,
              error ? styles.dotError : null
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => key === 'del' ? handleBackspace() : key ? handleKeyPress(key) : null}
            disabled={!key}
          >
            {key === 'del' ? (
              <Typography variant="headlineSm" color={theme.colors.onSurface}>⌫</Typography>
            ) : key ? (
              <Typography variant="headlineLg" color={theme.colors.onSurface}>{key}</Typography>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 80,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
  },
  dotError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 40,
  }
});
export const theme = {
  colors: {
    primary: '#001328',
    primaryContainer: '#14283f',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#7c8fab',
    secondary: '#006a62',
    secondaryFixed: '#94f3e7',
    onSecondary: '#ffffff',
    background: '#f7f9fb',
    onBackground: '#191c1e',
    surface: '#f7f9fb',
    onSurface: '#191c1e',
    surfaceVariant: '#e0e3e5',
    onSurfaceVariant: '#44474d',
    surfaceTint: '#4d6079',
    surfaceContainerHighest: '#e0e3e5',
    surfaceContainerHigh: '#e6e8ea',
    surfaceContainerLow: '#f2f4f6',
    surfaceContainerLowest: '#ffffff',
    outline: '#74777e',
    outlineVariant: '#c4c6cd',
    textPrimary: '#191c1e',
    textSecondary: '#44474d',
    success: '#16a34a',
    successContainer: '#7ffc97',
    warning: '#EA580C',
    warningContainer: '#FFEDD5',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
  },
  typography: {
    rupeeDisplay: {
      fontFamily: 'Inter',
      fontSize: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.03 * 30,
    },
    headlineLg: {
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: '700' as const,
      letterSpacing: -0.02 * 32,
    },
    headlineMd: {
      fontFamily: 'Inter',
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.01 * 22,
    },
    headlineSm: {
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: '600' as const,
    },
    titleMd: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '500' as const,
    },
    bodyLg: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '400' as const,
    },
    bodyMd: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '400' as const,
    },
    bodySm: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '400' as const,
    },
    labelLg: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.01 * 14,
    },
    labelMd: {
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: '600' as const,
      letterSpacing: 0.02 * 12,
    },
    labelSm: {
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: '700' as const,
      letterSpacing: 0.04 * 10,
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  }
};
import { Stack } from 'expo-router';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <PinLock>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="borrower" options={{ headerShown: false }} />
            <Stack.Screen name="loan" options={{ headerShown: false }} />
          </Stack>
        </PinLock>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
{
  "expo": {
    "name": "credkeep",
    "slug": "credkeep",
    "scheme": "credkeep",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.sagarsangwan.credkeep",
      "versionCode": 2,
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-sqlite",
        {
          "useSQLCipher": true
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26,
            "enableProguardInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ],
      "expo-status-bar",
      "expo-sharing"
    ],
    "extra": {
      "router": {},
      "eas": {
        "projectId": "44042971-c1f1-4f47-bec5-04950efe3bbf"
      }
    },
    "owner": "sagarsangwan"
  }
}
package-lock.json
src/__tests__/cross-loan.test.ts
src/__tests__/bullet-loan.test.ts
src/__tests__/loans.test.tsx
src/core/database/loanRepository.test.ts
src/core/domain/money.test.ts
src/core/domain/backupUtil.test.ts
src/core/domain/allocation.test.ts
src/core/domain/penalty.test.ts
src/core/domain/schedule.test.ts
src/app/settings/backup.tsx
src/app/settings/security.tsx
---
name: security-review
description: Security review checklist for CredKeep
---

# Security Review

1. Do not expose borrower data.
2. Protect SQLite database encryption.
3. Keep Backup/Restore disabled until verified.
4. Review PIN/app lock.

web search: https://docs.expo.dev/versions/v57.0.0/
codex
The current lock opens the app if SecureStore throws an error, and settings changes don’t update the lock’s cached PIN. PIN setup also displays the digits, has no confirmation step, and allows removal without re-authentication.

I’m applying the repository’s security-review skill. The plan will use shared security state, keep the app locked on storage errors, and require authentication for sensitive settings changes. Stitch tools aren’t available here, so I’ll base the visual design on the existing theme.

web search: 
# Task Handoff

## Handoff Detail
- **Task ID:** Borrower profile
- **Completed Changes:** 
  - Implemented `getBorrowerSummary` in `TransactionRepository` to aggregate multi-loan balances accurately (including bullet vs instalment rules).
  - Built out the Borrower Profile UI in `src/app/borrower/[id].tsx` featuring a rich navy summary card, identity details, and active loan list with product badges.
  - Wired up "Record Payment" and "New Loan" quick actions by passing navigation parameters to `loans.tsx` and `collections.tsx`.
  - Added support for pre-selecting the borrower in the new loan wizard and collections screen.
  - Addressed lint errors and verified tests.
- **Files Modified:** `src/app/borrower/[id].tsx`, `src/app/(tabs)/loans.tsx`, `src/app/(tabs)/collections.tsx`, `src/core/database/transactionRepository.ts`.
- **Commands Run:** `npm test`, `npx tsc --noEmit`, `npx expo lint`
- **Test Results:** 35 tests passed.
- **Git Commit Hashes:** `82c53f8`
- **Remaining Problems:** None.
- **Next Agent:** Gemini
- **Next Action:** Implement PIN/app lock feature.
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
  ]
};
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  borrowers: null,
  loans: null,
  transactions: null,
  error: null,
  refreshVersion: 0,
  triggerRefresh: () => {},
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
  }, []);

  const [state, setState] = useState<Omit<DatabaseContextType, 'refreshVersion' | 'triggerRefresh'>>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    error: null,
  });

  useEffect(() => {
    async function setup() {
      try {
        const db = await initDatabase();
        await runMigrations(db);
        
        setState({
          db,
          borrowers: new BorrowerRepository(db),
          loans: new LoanRepository(db),
          transactions: new TransactionRepository(db),
          error: null,
        });
      } catch (e: any) {
        setState(prev => ({ ...prev, error: e }));
      }
    }
    setup();
  }, []);

  return (
    <DatabaseContext.Provider value={{ ...state, refreshVersion, triggerRefresh }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
src/ui/PinLock.tsx:3:import * as SecureStore from 'expo-secure-store';
src/ui/PinLock.tsx:8:export const PIN_KEY = 'credkeep_app_pin';
src/ui/PinLock.tsx:21:      const pin = await SecureStore.getItemAsync(PIN_KEY);
src/ui/PinLock.tsx:27:        const bioEnabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:34:              fallbackLabel: 'Use PIN',
src/ui/PinLock.tsx:45:      console.error('SecureStore error', e);
src/ui/PinLock.tsx:103:        Enter PIN
src/core/database/db.ts:2:import * as SecureStore from 'expo-secure-store';
src/core/database/db.ts:3:import * as Crypto from 'expo-crypto';
src/core/database/db.ts:15:  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
src/core/database/db.ts:19:    const randomBytes = Crypto.getRandomBytes(32);
src/core/database/db.ts:22:    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
src/core/domain/backupUtil.ts:1:import CryptoJS from 'crypto-js';
src/core/domain/backupUtil.ts:5:  return CryptoJS.AES.encrypt(payload, password).toString();
src/core/domain/backupUtil.ts:9:  const bytes = CryptoJS.AES.decrypt(encryptedPayload, password);
src/core/domain/backupUtil.ts:12:    decryptedText = bytes.toString(CryptoJS.enc.Utf8);
src/app/(tabs)/more.tsx:13:    { title: 'App Security (PIN Lock)', route: '/settings/security' },
/home/sagar/.nvm/versions/node/v24.21.0/bin/node
/home/sagar/.nvm/versions/node/v24.21.0/bin/npm
node_modules-present
.agents/skills/react-native-testing/SKILL.md

web search: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/index.md
web search: 
exec
/bin/bash -lc 'cat AGENTS.md >/dev/null; npm test -- --runInBand --watch=false --cache=false' in /mnt/f/personal projects/credkeep
web search: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
 exited 1 in 4276ms:

> credkeep@1.0.0 test
> jest --runInBand --watch=false --cache=false

Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

 succeeded in 12424ms:
exec
/bin/bash -lc "cat AGENTS.md >/dev/null; sed -n '1,190p' node_modules/expo-secure-store/src/SecureStore.ts; cat src/core/database/db.ts" in /mnt/f/personal projects/credkeep
 succeeded in 50ms:
import ExpoSecureStore from './ExpoSecureStore';

export type KeychainAccessibilityConstant = number;

// @needsAudit
/**
 * The data in the keychain item cannot be accessed after a restart until the device has been
 * unlocked once by the user. This may be useful if you need to access the item when the phone
 * is locked.
 */
export const AFTER_FIRST_UNLOCK: KeychainAccessibilityConstant = ExpoSecureStore.AFTER_FIRST_UNLOCK;

// @needsAudit
/**
 * Similar to `AFTER_FIRST_UNLOCK`, except the entry is not migrated to a new device when restoring
 * from a backup.
 */
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: KeychainAccessibilityConstant =
  ExpoSecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY;

// @needsAudit
/**
 * The data in the keychain item can always be accessed regardless of whether the device is locked.
 * This is the least secure option.
 *
 * @deprecated Use an accessibility level that provides some user protection, such as `AFTER_FIRST_UNLOCK`.
 */
export const ALWAYS: KeychainAccessibilityConstant = ExpoSecureStore.ALWAYS;

// @needsAudit
/**
 * Similar to `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, except the user must have set a passcode in order to
 * store an entry. If the user removes their passcode, the entry will be deleted.
 */
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: KeychainAccessibilityConstant =
  ExpoSecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY;

// @needsAudit
/**
 * Similar to `ALWAYS`, except the entry is not migrated to a new device when restoring from a backup.
 *
 * @deprecated Use an accessibility level that provides some user protection, such as `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
 */
export const ALWAYS_THIS_DEVICE_ONLY: KeychainAccessibilityConstant =
  ExpoSecureStore.ALWAYS_THIS_DEVICE_ONLY;

// @needsAudit
/**
 * The data in the keychain item can be accessed only while the device is unlocked by the user.
 */
export const WHEN_UNLOCKED: KeychainAccessibilityConstant = ExpoSecureStore.WHEN_UNLOCKED;

// @needsAudit
/**
 * Similar to `WHEN_UNLOCKED`, except the entry is not migrated to a new device when restoring from
 * a backup.
 */
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY: KeychainAccessibilityConstant =
  ExpoSecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

// @needsAudit
export type SecureStoreOptions = {
  /**
   * - Android: Equivalent of the public/private key pair `Alias`.
   * - iOS: The item's service, equivalent to [`kSecAttrService`](https://developer.apple.com/documentation/security/ksecattrservice/).
   * > If the item is set with the `keychainService` option, it will be required to later fetch the value.
   */
  keychainService?: string;
  /**
   * Option responsible for enabling the usage of the user authentication methods available on the device while
   * accessing data stored in SecureStore.
   * - Android: Equivalent to [`setUserAuthenticationRequired(true)`](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder#setUserAuthenticationRequired(boolean))
   *   (requires API 23).
   * - iOS: Equivalent to [`biometryCurrentSet`](https://developer.apple.com/documentation/security/secaccesscontrolcreateflags/2937192-biometrycurrentset).
   * Complete functionality is unlocked only with a freshly generated key - this would not work in tandem with the `keychainService`
   * value used for the others non-authenticated operations.
   *
   * This option works slightly differently across platforms: On Android, user authentication is required for all operations.
   * On iOS, the user is prompted to authenticate only when reading or updating an existing value (not when creating a new one).
   *
   * Warning: This option is not supported in Expo Go when biometric authentication is available due to a missing NSFaceIDUsageDescription.
   * In release builds or when using continuous native generation, make sure to use the `expo-secure-store` config plugin.
   *
   * > **Note:** This library requires a real device for testing since emulators/simulators do not require biometric authentication when retrieving secrets, unlike real iOS devices.
   */
  requireAuthentication?: boolean;
  /**
   * Custom message displayed to the user while `requireAuthentication` option is turned on.
   */
  authenticationPrompt?: string;
  /**
   * Specifies when the stored entry is accessible, using iOS's `kSecAttrAccessible` property.
   * @see Apple's documentation on [keychain item accessibility](https://developer.apple.com/documentation/security/ksecattraccessible/).
   * @default SecureStore.WHEN_UNLOCKED
   * @platform ios
   */
  keychainAccessible?: KeychainAccessibilityConstant;

  /**
   * Specifies the access group the stored entry belongs to.
   * @see Apple's documentation on [Sharing access to keychain items among a collection of apps](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps).
   * @platform ios
   */
  accessGroup?: string;
};

// @needsAudit
/**
 * Returns whether the SecureStore API is enabled on the current device. This does not check the app
 * permissions.
 *
 * @return Promise which fulfils with a `boolean`, indicating whether the SecureStore API is available
 * on the current device. Currently, this resolves `true` on Android and iOS only.
 */
export async function isAvailableAsync(): Promise<boolean> {
  return !!ExpoSecureStore.getValueWithKeyAsync;
}

// @needsAudit
/**
 * Delete the value associated with the provided key.
 *
 * @param key The key that was used to store the associated value.
 * @param options An [`SecureStoreOptions`](#securestoreoptions) object.
 *
 * @return A promise that rejects if the value can't be deleted.
 */
export async function deleteItemAsync(
  key: string,
  options: SecureStoreOptions = {}
): Promise<void> {
  ensureValidKey(key);

  await ExpoSecureStore.deleteValueWithKeyAsync(key, options);
}

// @needsAudit
/**
 * Reads the stored value associated with the provided key.
 *
 * @param key The key that was used to store the associated value.
 * @param options An [`SecureStoreOptions`](#securestoreoptions) object.
 *
 * @return A promise that resolves to the previously stored value. It resolves with `null` if there is no entry
 * for the given key or if the key has been invalidated. It rejects if an error occurs while retrieving the value.
 *
 * > Keys are invalidated by the system when biometrics change, such as adding a new fingerprint or changing the face profile used for face recognition.
 * > After a key has been invalidated, it becomes impossible to read its value.
 * > This only applies to values stored with `requireAuthentication` set to `true`.
 */
export async function getItemAsync(
  key: string,
  options: SecureStoreOptions = {}
): Promise<string | null> {
  ensureValidKey(key);
  return await ExpoSecureStore.getValueWithKeyAsync(key, options);
}

// @needsAudit
/**
 * Stores a key–value pair.
 *
 * @param key The key to associate with the stored value. Keys may contain alphanumeric characters, `.`, `-`, and `_`.
 * @param value The value to store.
 * @param options An [`SecureStoreOptions`](#securestoreoptions) object.
 *
 * @return A promise that rejects if value cannot be stored on the device.
 */
export async function setItemAsync(
  key: string,
  value: string,
  options: SecureStoreOptions = {}
): Promise<void> {
  ensureValidKey(key);
  if (!isValidValue(value)) {
    throw new Error(
      `Invalid value provided to SecureStore. Values must be strings; consider JSON-encoding your values if they are serializable.`
    );
  }

  await ExpoSecureStore.setValueWithKeyAsync(value, key, options);
}

/**
 * Stores a key–value pair synchronously.
 * > **Note:** This function blocks the JavaScript thread, so the application may not be interactive when the `requireAuthentication` option is set to `true` until the user authenticates.
 *
 * @param key The key to associate with the stored value. Keys may contain alphanumeric characters, `.`, `-`, and `_`.
 * @param value The value to store.
 * @param options An [`SecureStoreOptions`](#securestoreoptions) object.
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_NAME = 'credkeep_db_master_key';
const DB_NAME = 'credkeep.db';

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getDatabaseKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
  
  if (!key) {
    // Generate a 32-byte cryptographically secure random key
    const randomBytes = Crypto.getRandomBytes(32);
    key = bufferToHex(randomBytes.buffer as ArrayBuffer);
    
    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
      requireAuthentication: false,
    });
  }
  
  return key;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const key = await getDatabaseKey();
  
  // Note: expo-sqlite SDK 50+ natively supports opening databases.
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // PRAGMA configuration
  await db.execAsync(`
    PRAGMA key = "x'${key}'";
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
  `);
  
  // Verify encryption by querying something
  await db.getFirstAsync('SELECT 1');
  
  return db;
}

codex
TypeScript passes on the current code. Jest cannot start because the sandbox prevents creation of its temporary directory; lint is still running.

For the UI, I recommend a navy protection summary card, rounded white settings cards, teal enabled states, and a shared masked keypad. The lock flow also needs to distinguish biometric prompts from genuine backgrounding and reject stale authentication results.

codex
Reviewed both screens. **Implementation is blocked by this session’s read-only filesystem**, so no source changes or commit were created.

The main issues are:

- SecureStore errors currently unlock the app.
- Settings changes leave `PinLock` using a stale PIN.
- Setup displays PIN digits and lacks confirmation.
- Removing the PIN requires no re-authentication.
- Biometric unlock lacks retry controls and protection against overlapping prompts.

Recommended implementation plan:

1. **Centralize security state.** Add a security service and provider shared by settings and `PinLock`. Model loading, unlocked, locked, authenticating, and storage-error states explicitly. Storage errors must keep protected content hidden and offer retry.

2. **Secure PIN management.** Keep credentials exclusively in SecureStore; use a versioned, salted PIN verifier rather than retaining the raw PIN in React state. Migrate the existing PIN safely before removing its legacy record. Keep PIN storage accessible without biometric authentication so PIN fallback remains available. Preserve the separate SQLCipher master key.

3. **Complete PIN flows.** Reuse a masked keypad for create → confirm, verify current → change → confirm, and verify current → remove. Add persistent attempt throttling, prevent duplicate submissions, and clear entered digits on cancellation, backgrounding, and completion.

4. **Integrate biometrics.** Check hardware, enrollment, and supported security level; require successful authentication before enabling. Use Android strong biometrics and disable device-passcode fallback so users return to CredKeep’s PIN. Add a visible biometric retry button, serialize prompts, and ignore stale results after backgrounding. These options are supported by [Expo SDK 57 LocalAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/).

5. **Polish settings with the theme.** Use a navy protection summary card with shield icon, rounded white cards for PIN and biometric controls, teal enabled badges, muted explanatory text, and a separate removal action. Apply existing typography, spacing, and radius tokens. Include accessible controls, responsive layout, and loading/error states. Stitch assets could not be consulted because its tools are unavailable here.

6. **Configure and validate.** Add SecureStore and LocalAuthentication config plugins, including Face ID permission text. Test cold start, resume, storage failures, migration, incorrect PIN throttling, settings synchronization, biometric cancellation, and stale results. Face ID requires a development build, per the [Expo documentation](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/).

**Validation:** Current TypeScript check passed. Jest could not start because its temporary directory could not be created. Lint has not returned a result. SDK 57 SecureStore documentation could not be fetched; its installed source was inspected instead.
2026-10-10T05:08:19.119656Z ERROR codex_core::session: failed to record rollout items: thread 01a12434-b7a5-7d73-9a64-236fb52ebf92 not found
tokens used
47,144
Reviewed both screens. **Implementation is blocked by this session’s read-only filesystem**, so no source changes or commit were created.

The main issues are:

- SecureStore errors currently unlock the app.
- Settings changes leave `PinLock` using a stale PIN.
- Setup displays PIN digits and lacks confirmation.
- Removing the PIN requires no re-authentication.
- Biometric unlock lacks retry controls and protection against overlapping prompts.

Recommended implementation plan:

1. **Centralize security state.** Add a security service and provider shared by settings and `PinLock`. Model loading, unlocked, locked, authenticating, and storage-error states explicitly. Storage errors must keep protected content hidden and offer retry.

2. **Secure PIN management.** Keep credentials exclusively in SecureStore; use a versioned, salted PIN verifier rather than retaining the raw PIN in React state. Migrate the existing PIN safely before removing its legacy record. Keep PIN storage accessible without biometric authentication so PIN fallback remains available. Preserve the separate SQLCipher master key.

3. **Complete PIN flows.** Reuse a masked keypad for create → confirm, verify current → change → confirm, and verify current → remove. Add persistent attempt throttling, prevent duplicate submissions, and clear entered digits on cancellation, backgrounding, and completion.

4. **Integrate biometrics.** Check hardware, enrollment, and supported security level; require successful authentication before enabling. Use Android strong biometrics and disable device-passcode fallback so users return to CredKeep’s PIN. Add a visible biometric retry button, serialize prompts, and ignore stale results after backgrounding. These options are supported by [Expo SDK 57 LocalAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/).

5. **Polish settings with the theme.** Use a navy protection summary card with shield icon, rounded white cards for PIN and biometric controls, teal enabled badges, muted explanatory text, and a separate removal action. Apply existing typography, spacing, and radius tokens. Include accessible controls, responsive layout, and loading/error states. Stitch assets could not be consulted because its tools are unavailable here.

6. **Configure and validate.** Add SecureStore and LocalAuthentication config plugins, including Face ID permission text. Test cold start, resume, storage failures, migration, incorrect PIN throttling, settings synchronization, biometric cancellation, and stale results. Face ID requires a development build, per the [Expo documentation](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/).

**Validation:** Current TypeScript check passed. Jest could not start because its temporary directory could not be created. Lint has not returned a result. SDK 57 SecureStore documentation could not be fetched; its installed source was inspected instead.
