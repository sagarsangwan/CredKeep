OpenAI Codex v0.163.0
--------
workdir: /mnt/f/personal projects/credkeep
model: gpt-6.1-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: medium
reasoning summaries: none
session id: 01a15cca-2a5a-7440-b9bf-d06c3d2f26c5
--------
user
Perform focused, read-only QA review on CredKeep Google OAuth Audience and Startup Reliability Fix. Review the git diff against feaeefa and working changes in src/core/auth/googleAuth.ts, src/app/auth/login.tsx, src/app/settings/security.tsx, src/ui/PinLock.tsx, backend/api/views_auth.py. Scope: 1. Google OAuth audience mismatch and recovery behavior. 2. Auth endpoint compatibility. 3. Startup initialization in PinLock. 4. Sync outbox integrity. Return APPROVED if no blocking issues.

warning: Codex could not find bubblewrap on PATH. Install bubblewrap with your OS package manager. See the sandbox prerequisites: https://developers.openai.com/codex/concepts/sandboxing#prerequisites. Codex will use the bundled bubblewrap in the meantime.
codex
I’ll review the diff against `feaeefa` in the five named files, checking direct dependencies where needed to assess auth recovery, startup initialization, and sync outbox integrity. I’ll use the code-review and Graphify skills and keep the review read-only.

exec
/bin/bash -lc 'cat .agents/skills/code-review/SKILL.md .agents/skills/graphify/SKILL.md' in /mnt/f/personal projects/credkeep
 succeeded in 16ms:
---
name: code-review
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

The issue tracker should have been provided to you. If `docs/agents/issue-tracker.md` is missing, tell the user to run `/setup-matt-pocock-skills`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point (a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.). If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here, not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.), fetched via the workflow in `docs/agents/issue-tracker.md`.
2. A path the user passed as an argument.
3. A spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below: a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn both sub-agents in parallel

**Standards sub-agent prompt** should include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full (the sub-agent has no other access to it).
- The brief: "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** should include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings, because the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes: that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
---
name: graphify
description: "Use for any question about a codebase, its architecture, file relationships, or project content — especially when graphify-out/ exists, where the question should be treated as a graphify query first. Turns any input (code, docs, papers, images, videos) into a persistent knowledge graph with god nodes, community detection, and query/path/explain tools."
---

# /graphify

Turn any folder of files into a navigable knowledge graph with community detection, an honest audit trail, and three outputs: interactive HTML, GraphRAG-ready JSON, and a plain-language GRAPH_REPORT.md.

## Usage

```
/graphify                                             # full pipeline on current directory (HTML viz; add --obsidian for a vault)
/graphify <path>                                      # full pipeline on specific path
/graphify https://github.com/<owner>/<repo>           # clone repo then run full pipeline on it
/graphify https://github.com/<owner>/<repo> --branch <branch>  # clone a specific branch
/graphify <url1> <url2> ...                           # clone multiple repos, build each, merge into one cross-repo graph
/graphify <path> --mode deep                          # thorough extraction, richer INFERRED edges
/graphify <path> --update                             # incremental - re-extract only new/changed files
/graphify <path> --directed                            # build directed graph (preserves edge direction: source→target)
/graphify <path> --whisper-model medium                # use a larger Whisper model for better transcription accuracy
/graphify <path> --cluster-only                       # rerun clustering on existing graph
/graphify <path> --no-viz                             # skip visualization, just report + JSON
/graphify <path> --html                               # (HTML is generated by default - this flag is a no-op)
/graphify <path> --svg                                # also export graph.svg (embeds in Notion, GitHub)
/graphify <path> --graphml                            # export graph.graphml (Gephi, yEd)
/graphify <path> --neo4j                              # generate graphify-out/cypher.txt for Neo4j
/graphify <path> --neo4j-push bolt://localhost:7687   # push directly to Neo4j
/graphify <path> --falkordb                           # generate graphify-out/cypher.txt for FalkorDB
/graphify <path> --falkordb-push falkordb://localhost:6379   # push directly to FalkorDB
/graphify <path> --mcp                                # start MCP stdio server for agent access
/graphify <path> --watch                              # watch folder, auto-rebuild on code changes (no LLM needed)
/graphify <path> --wiki                               # build agent-crawlable wiki (index.md + one article per community)
/graphify <path> --obsidian --obsidian-dir ~/vaults/my-project  # write vault to custom path (e.g. existing vault)
/graphify add <url>                                   # fetch URL, save to ./raw, update graph
/graphify add <url> --author "Name"                   # tag who wrote it
/graphify add <url> --contributor "Name"              # tag who added it to the corpus
/graphify query "<question>"                          # BFS traversal - broad context
/graphify query "<question>" --dfs                    # DFS - trace a specific path
/graphify query "<question>" --budget 1500            # cap answer at N tokens
/graphify path "AuthModule" "Database"                # shortest path between two concepts
/graphify explain "SwinTransformer"                   # plain-language explanation of a node
```

## What graphify is for

Drop any folder of code, docs, papers, images, or video into graphify and get a queryable knowledge graph. Persistent across sessions, honest audit trail (EXTRACTED/INFERRED/AMBIGUOUS), community detection surfaces cross-document connections you wouldn't think to ask about.

## What You Must Do When Invoked

If the user invoked `/graphify --help` or `/graphify -h` (with no other arguments), print the contents of the `## Usage` section above verbatim and stop. Do not run any commands, do not detect files, do not default the path to `.`. Just print the Usage block and return.

**Fast path — existing graph:** Before doing anything else, check whether `graphify-out/graph.json` exists. The expected location is `graphify-out/graph.json` relative to the **current working directory** (i.e. the project root where you are running commands). If it exists AND the user's request is a natural-language question about the codebase (e.g. "How does X work?", "What calls Y?", "Trace the data flow through Z") and NOT an explicit rebuild command (`--update`, `--cluster-only`, or a bare path/URL that implies fresh extraction): **skip Steps 1–5 entirely and jump straight to `## For /graphify query`.** Run `graphify query "<question>"` immediately. Do not run detect. Do not check corpus size. Do not ask the user to narrow. The graph is already built — use it.

If no path was given, use `.` (current directory). Do not ask the user for a path.

If the path argument starts with `https://github.com/` or `http://github.com/`, treat it as a GitHub URL - run Step 0 before anything else, then continue with the resolved local path.

Follow these steps in order. Do not skip steps.

### Step 0 - GitHub repos and multi-path merge (only if a URL or several paths)

Only when the path is one or more `https://github.com/...` URLs, or several local subfolders to merge. See `references/github-and-merge.md` for the clone, cross-repo merge, and monorepo flow, then continue with the resolved local path. A plain local path skips this step.

### Step 1 - Ensure graphify is installed

```bash
# Detect the correct Python interpreter (handles uv tool, pipx, venv, system installs)
PYTHON=""
GRAPHIFY_BIN=$(which graphify 2>/dev/null)
# 1. uv tool installs — most reliable on modern Mac/Linux
if [ -z "$PYTHON" ] && command -v uv >/dev/null 2>&1; then
    _UV_PY=$(uv tool run --from graphifyy python -c "import sys; print(sys.executable)" 2>/dev/null)
    if [ -n "$_UV_PY" ]; then PYTHON="$_UV_PY"; fi
fi
# 2. Read shebang from graphify binary (pipx and direct pip installs)
if [ -z "$PYTHON" ] && [ -n "$GRAPHIFY_BIN" ]; then
    _SHEBANG=$(head -1 "$GRAPHIFY_BIN" | tr -d '#!')
    case "$_SHEBANG" in
        *[!a-zA-Z0-9/_.@-]*) ;;
        *) "$_SHEBANG" -c "import graphify" 2>/dev/null && PYTHON="$_SHEBANG" ;;
    esac
fi
# 3. Fall back to python3
if [ -z "$PYTHON" ]; then PYTHON="python3"; fi
if ! "$PYTHON" -c "import graphify" 2>/dev/null; then
    if command -v uv >/dev/null 2>&1; then
        uv tool install --upgrade graphifyy -q 2>&1 | tail -3
        _UV_PY=$(uv tool run --from graphifyy python -c "import sys; print(sys.executable)" 2>/dev/null)
        if [ -n "$_UV_PY" ]; then PYTHON="$_UV_PY"; fi
    else
        "$PYTHON" -m pip install graphifyy -q 2>/dev/null \
          || "$PYTHON" -m pip install graphifyy -q --break-system-packages 2>&1 | tail -3
    fi
fi
# Write interpreter path for all subsequent steps (persists across invocations)
mkdir -p graphify-out
"$PYTHON" -c "import sys; open('graphify-out/.graphify_python', 'w', encoding='utf-8').write(sys.executable)"
# Save scan root so `graphify update` (no args) knows where to look next time.
# The scan path is passed through a quoted heredoc, never substituted into the
# command line itself: a bare `cd <path>` (or an unquoted heredoc, which
# still expands $()/backticks in its body) would let a malicious path execute
# as shell code the moment this line runs.
"$PYTHON" -c "import os, sys; out_path = os.path.abspath('graphify-out/.graphify_root'); os.chdir(sys.stdin.readline().rstrip('\n')); open(out_path, 'w', encoding='utf-8').write(os.getcwd())" <<'GRAPHIFY_ROOT_EOF'
INPUT_PATH
GRAPHIFY_ROOT_EOF
```

If the import succeeds, print nothing and move straight to Step 2.

**In every subsequent bash block, replace `python3` with `$(cat graphify-out/.graphify_python)` to use the correct interpreter.**

### Step 2 - Detect files

```bash
$(cat graphify-out/.graphify_python) -c "
import json
from graphify.detect import detect
from pathlib import Path
result = detect(Path('INPUT_PATH'))
# Write the sidecar from Python, not a shell redirect, so the same block renders
# on PowerShell hosts without console-encoding drift (#2528).
Path('graphify-out/.graphify_detect.json').write_text(json.dumps(result, ensure_ascii=False), encoding=\"utf-8\")
print(f'Detected {result[\"total_files\"]} files')
"
```

Replace INPUT_PATH with the actual path the user provided. Do NOT cat or print the JSON - read it silently and present a clean summary instead:

```
Corpus: X files · ~Y words
  code:     N files (.py .ts .go ...)
  docs:     N files (.md .txt ...)
  papers:   N files (.pdf ...)
  images:   N files
  video:    N files (.mp4 .mp3 ...)
```

Omit any category with 0 files from the summary.

Then act on it:
- If `total_files` is 0: stop with "No supported files found in [path]."
- If `skipped_sensitive` is non-empty: report the count and list the skipped file names, so a wrongly-flagged source or doc is visible and can be renamed or moved (#2106).
- If `total_words` > 2,000,000 OR `total_files` > 500: show the warning. Then compute the top 5 first-level subdirectories by file count:
  - Read `scan_root` from the detect JSON (always an absolute path to the resolved INPUT_PATH).
  - Concatenate all file lists across all types (`code`, `document`, `paper`, `image`, `video`).
  - Filter out any path that starts with `scan_root + "/graphify-out/"` to exclude converted sidecars.
  - For each file, strip the `scan_root` prefix and take the first path component. Files directly in `scan_root` with no subdirectory count as `(root)`.
  - If all files are in `(root)` with no subdirectories, do not ask to narrow — no subfolders exist. Instead suggest `--no-cluster` to skip the expensive clustering step and proceed.
  - Otherwise rank by count, show the top 5 with file counts, then ask which subfolder to run on. Wait for the user's answer before proceeding.
- Otherwise: proceed directly to Step 2.5 if video files were detected, or Step 3 if not.

### Step 2.5 - Video and audio (only if video files detected)

Skip this step entirely if `detect` returned zero `video` files. When the corpus has video or audio, see `references/transcribe.md` to transcribe them to text first, then treat the transcripts as doc files in Step 3.

### Step 3 - Extract entities and relationships

**Before starting:** note whether `--mode deep` was given. You must pass `DEEP_MODE=true` to every subagent in Step B2 if it was. Track this from the original invocation - do not lose it.

This step has two parts: **structural extraction** (deterministic, free) and **semantic extraction** (LLM, costs tokens).

> **graphify needs no API key. Never ask the user for one, and never block on one.** Code is extracted structurally (AST) with no LLM and no key at all — a code-only corpus (the common `/graphify .` on a repo) skips semantic extraction entirely, so it needs nothing here: go straight to Part A and skip Part B. Semantic extraction (only for docs, papers, and images) uses Gemini **only if** `GEMINI_API_KEY`/`GOOGLE_API_KEY` is already set; otherwise the host agent itself is the LLM. graphify does **not** read `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or any other provider key. If you catch yourself about to prompt for, wait on, or stop because of a missing API key, that is a misread of this skill — proceed without one.

**Before semantic extraction:** check whether `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set. If neither is set, print this one-liner to the user:
> Tip: set `GEMINI_API_KEY` or `GOOGLE_API_KEY` to use Gemini for semantic extraction (`pip install 'graphifyy[gemini]'`).

Print it once, then continue — do not wait for the user to supply a key. If `GEMINI_API_KEY` or `GOOGLE_API_KEY` IS set, use `graphify.llm.extract_corpus_parallel(files, backend="gemini")` for semantic extraction instead of dispatching subagents. The default Gemini model is `gemini-3-flash-preview`; set `GRAPHIFY_GEMINI_MODEL` or pass `--model` in headless CLI flows to override it.

> **No other API keys are read.** When `GEMINI_API_KEY`/`GOOGLE_API_KEY` are unset, semantic extraction falls to the host agent itself — the running session is the LLM. On a host that dispatches subagents (e.g. Claude Code), dispatch them as written in Part B. On a host that runs the CLI directly in a terminal and cannot dispatch subagents, do not stall: a code-only corpus has no semantic work, so write the empty semantic file (Part B "Fast path") and continue to Part C; for a corpus with docs/papers/images, either set a Gemini key or extract those inline yourself, but in no case prompt for `ANTHROPIC_API_KEY` — that prompt is a misread of this skill.

**Run Part A (AST) and Part B (semantic) in parallel. Dispatch all semantic subagents AND start AST extraction in the same message. Both can run simultaneously since they operate on different file types. Merge results in Part C as before.**

Note: Parallelizing AST + semantic saves 5-15s on large corpora. AST is deterministic and fast; start it while subagents are processing docs/papers.

#### Part A - Structural extraction for code files

For any code files detected, run AST extraction in parallel with Part B subagents:

```bash
$(cat graphify-out/.graphify_python) -c "
import sys, json
from graphify.extract import collect_files, extract
from pathlib import Path
import json

code_files = []
detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding=\"utf-8\"))
for f in detect.get('files', {}).get('code', []):
    code_files.extend(collect_files(Path(f)) if Path(f).is_dir() else [Path(f)])

if code_files:
    result = extract(code_files, cache_root=Path('INPUT_PATH'))
    Path('graphify-out/.graphify_ast.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding=\"utf-8\")
    print(f'AST: {len(result[\"nodes\"])} nodes, {len(result[\"edges\"])} edges')
else:
    Path('graphify-out/.graphify_ast.json').write_text(json.dumps({'nodes':[],'edges':[],'input_tokens':0,'output_tokens':0}, ensure_ascii=False), encoding=\"utf-8\")
    print('No code files - skipping AST extraction')
"
```

#### Part B - Semantic extraction (parallel subagents)

**Fast path:** If detection found zero docs, papers, and images (code-only corpus), skip Part B entirely and go straight to Part C. AST handles code - there is nothing for semantic subagents to do. **First write an empty semantic file** so Part C's merge has its input (it reads `.graphify_semantic.json` unconditionally; without this a code-only run hits `FileNotFoundError`):

```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path
Path('graphify-out/.graphify_semantic.json').write_text(json.dumps({'nodes':[],'edges':[],'hyperedges':[],'input_tokens':0,'output_tokens':0}), encoding='utf-8')
"
```

**MANDATORY: You MUST use the Agent tool here. Reading files yourself one-by-one is forbidden - it is 5-10x slower. If you do not use the Agent tool you are doing this wrong.**

Before dispatching subagents, print a timing estimate:
- Load `total_words` and file counts from `graphify-out/.graphify_detect.json`
- Estimate agents needed: `ceil(uncached_non_code_files / 22)` (chunk size is 20-25)
- Estimate time: ~45s per agent batch (they run in parallel, so total ≈ 45s × ceil(agents/parallel_limit))
- Print: "Semantic extraction: ~N files → X agents, estimated ~Ys"

**Step B0 - Check extraction cache first**

Before dispatching any subagents, check which files already have cached extraction results:

SPEC_PATH below is the **absolute** path of the `references/extraction-spec.md` that ships beside this SKILL.md — the same file Step B2 loads and hands to every subagent. It is the extraction prompt, so cache entries are attributed to it: when a graphify upgrade changes the prompt, entries produced by the old one are re-extracted instead of replayed, and unchanged prompts keep their entries (#1939). Substitute the real path in both Step B0 and Step B3 — pass the same one to each, and do not drop the argument.

```bash
$(cat graphify-out/.graphify_python) -c "
import json
from graphify.cache import check_semantic_cache
from pathlib import Path

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding=\"utf-8\"))
# Only content files go to semantic extraction. Code is already covered structurally
# by the AST pass (Part A); flattening every category here makes subagents re-read
# every source file (#1392). Video is transcribed to a document in Step 2.5 first.
all_files = [f for cat in ('document', 'paper', 'image') for f in detect['files'].get(cat, [])]

cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(all_files, root='INPUT_PATH', prompt_file='SPEC_PATH')

# Always (re)write the cache file: write hits, else DELETE any leftover from a prior
# run so Part C never merges a stale .graphify_cached.json (#1392).
if cached_nodes or cached_edges or cached_hyperedges:
    Path('graphify-out/.graphify_cached.json').write_text(json.dumps({'nodes': cached_nodes, 'edges': cached_edges, 'hyperedges': cached_hyperedges}, ensure_ascii=False), encoding=\"utf-8\")
else:
    Path('graphify-out/.graphify_cached.json').unlink(missing_ok=True)
Path('graphify-out/.graphify_uncached.txt').write_text('\n'.join(uncached), encoding=\"utf-8\")
# Nothing has been dispatched yet, so any chunk file on disk is a leftover from an
# interrupted run, and Step B3 merges every .graphify_chunk_*.json it finds.
for stale in Path('graphify-out').glob('.graphify_chunk_*.json'):
    stale.unlink()
print(f'Cache: {len(all_files)-len(uncached)} files hit, {len(uncached)} files need extraction')
"
```

Only dispatch subagents for files listed in `graphify-out/.graphify_uncached.txt`. If all files are cached, skip Steps B1 and B2 but still run Step B3's commands: its merge is the only Part B step that writes `graphify-out/.graphify_semantic.json`, and Part C reads that file unconditionally. Do not write an empty `.graphify_semantic.json` instead, because that drops every cached node.

**Step B1 - Split into chunks**

Load files from `graphify-out/.graphify_uncached.txt`. Split into chunks of 20-25 files each. Each image gets its own chunk (vision needs separate context). When splitting, group files from the same directory together so related artifacts land in the same chunk and cross-file relationships are more likely to be extracted.

**Step B2 - Dispatch ALL subagents in a single message**

Call the Agent tool multiple times IN THE SAME RESPONSE - one call per chunk. This is the only way they run in parallel. If you make one Agent call, wait, then make another, you are doing it sequentially and defeating the purpose.

**IMPORTANT - subagent type:** Always use `subagent_type="general-purpose"`. Do NOT use `Explore` - it is read-only and cannot write chunk files to disk, which silently drops extraction results. General-purpose has Write and Bash access which the subagent needs.

Concrete example for 3 chunks:
```
[Agent tool call 1: files 1-15, subagent_type="general-purpose"]
[Agent tool call 2: files 16-30, subagent_type="general-purpose"]
[Agent tool call 3: files 31-45, subagent_type="general-purpose"]
```
All three in one message. Not three separate messages.

Each subagent receives this exact prompt (substitute FILE_LIST, CHUNK_NUM, TOTAL_CHUNKS, DEEP_MODE, and CHUNK_PATH).

CHUNK_PATH must be an **absolute** path — derive it before dispatching:
```bash
PROJECT_ROOT=$(pwd)  # cwd — where Part C globs graphify-out/ (NOT .graphify_root/scan dir, #1392)
# Then for chunk N: CHUNK_PATH="${PROJECT_ROOT}/graphify-out/.graphify_chunk_0N.json"
```

Subagent prompt template:

See `references/extraction-spec.md` for the exact subagent prompt (JSON schema, node-ID rules, confidence rubric, frontmatter, hyperedge, and vision rules). Load it only here, only when at least one chunk holds a doc, paper, or image; a pure-code corpus has skipped Part B and never reads it. Pass each subagent that prompt verbatim with FILE_LIST, CHUNK_NUM, TOTAL_CHUNKS, DEEP_MODE, and CHUNK_PATH substituted, and have it write the result to CHUNK_PATH.

**Step B3 - Collect, cache, and merge**

Wait for all subagents. For each result:
- Check that `graphify-out/.graphify_chunk_NN.json` exists on disk — this is the success signal
- If the file exists and contains valid JSON with `nodes` and `edges`, include it and save to cache
- If the file is missing, the subagent was likely dispatched as read-only (Explore type) — print a warning: "chunk N missing from disk — subagent may have been read-only. Re-run with general-purpose agent." Do not silently skip.
- If a subagent failed or returned invalid JSON, print a warning and skip that chunk - do not abort

If more than half the chunks failed or are missing, stop and tell the user to re-run and ensure `subagent_type="general-purpose"` is used.

Merge all chunk files into `.graphify_semantic_new.json`. **After each Agent call completes, read the real token counts from the Agent tool result's `usage` field and write them back into the chunk JSON before merging** — the chunk JSON itself always has placeholder zeros. Then run:
```bash
$(cat graphify-out/.graphify_python) -c "
import json, glob
from pathlib import Path

chunks = sorted(glob.glob('graphify-out/.graphify_chunk_*.json'))
all_nodes, all_edges, all_hyperedges = [], [], []
total_in, total_out = 0, 0
for c in chunks:
    d = json.loads(Path(c).read_text(encoding=\"utf-8\"))
    all_nodes += d.get('nodes', [])
    all_edges += d.get('edges', [])
    all_hyperedges += d.get('hyperedges', [])
    total_in += d.get('input_tokens', 0)
    total_out += d.get('output_tokens', 0)
Path('graphify-out/.graphify_semantic_new.json').write_text(json.dumps({
    'nodes': all_nodes, 'edges': all_edges, 'hyperedges': all_hyperedges,
    'input_tokens': total_in, 'output_tokens': total_out,
}, indent=2, ensure_ascii=False), encoding=\"utf-8\")
print(f'Merged {len(chunks)} chunks: {total_in:,} in / {total_out:,} out tokens')
"
```

Save new results to cache. Pass the same SPEC_PATH as Step B0 — it stamps each entry with the prompt that produced it, and a write under a different prompt than the read lands where the next run won't look (#1939):
```bash
$(cat graphify-out/.graphify_python) -c "
import json
from graphify.cache import save_semantic_cache
from pathlib import Path

new = json.loads(Path('graphify-out/.graphify_semantic_new.json').read_text(encoding=\"utf-8\")) if Path('graphify-out/.graphify_semantic_new.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}
uncached = [line for line in Path('graphify-out/.graphify_uncached.txt').read_text(encoding=\"utf-8\").splitlines() if line]
saved = save_semantic_cache(new.get('nodes', []), new.get('edges', []), new.get('hyperedges', []), root='INPUT_PATH', allowed_source_files=uncached, prompt_file='SPEC_PATH')
print(f'Cached {saved} files')
"
```

Merge cached + new results into `graphify-out/.graphify_semantic.json`:
```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path

cached = json.loads(Path('graphify-out/.graphify_cached.json').read_text(encoding=\"utf-8\")) if Path('graphify-out/.graphify_cached.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}
new = json.loads(Path('graphify-out/.graphify_semantic_new.json').read_text(encoding=\"utf-8\")) if Path('graphify-out/.graphify_semantic_new.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}

all_nodes = cached['nodes'] + new.get('nodes', [])
all_edges = cached['edges'] + new.get('edges', [])
all_hyperedges = cached.get('hyperedges', []) + new.get('hyperedges', [])
seen = set()
deduped = []
for n in all_nodes:
    if n['id'] not in seen:
        seen.add(n['id'])
        deduped.append(n)

merged = {
    'nodes': deduped,
    'edges': all_edges,
    'hyperedges': all_hyperedges,
    'input_tokens': new.get('input_tokens', 0),
    'output_tokens': new.get('output_tokens', 0),
}
Path('graphify-out/.graphify_semantic.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding=\"utf-8\")
print(f'Extraction complete - {len(deduped)} nodes, {len(all_edges)} edges ({len(cached[\"nodes\"])} from cache, {len(new.get(\"nodes\",[]))} new)')
"
```
Clean up temp files: `rm -f graphify-out/.graphify_cached.json graphify-out/.graphify_uncached.txt graphify-out/.graphify_semantic_new.json`

#### Part C - Merge AST + semantic into final extraction

```bash
$(cat graphify-out/.graphify_python) -c "
import sys, json
from pathlib import Path

ast = json.loads(Path('graphify-out/.graphify_ast.json').read_text(encoding=\"utf-8\"))
sem = json.loads(Path('graphify-out/.graphify_semantic.json').read_text(encoding=\"utf-8\"))

# Merge: AST nodes first, semantic nodes deduplicated by id
seen = {n['id'] for n in ast['nodes']}
merged_nodes = list(ast['nodes'])
for n in sem['nodes']:
    if n['id'] not in seen:
        merged_nodes.append(n)
        seen.add(n['id'])

merged_edges = ast['edges'] + sem['edges']
merged_hyperedges = sem.get('hyperedges', [])
merged = {
    'nodes': merged_nodes,
    'edges': merged_edges,
    'hyperedges': merged_hyperedges,
    'input_tokens': sem.get('input_tokens', 0),
    'output_tokens': sem.get('output_tokens', 0),
}
Path('graphify-out/.graphify_extract.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding=\"utf-8\")
total = len(merged_nodes)
edges = len(merged_edges)
print(f'Merged: {total} nodes, {edges} edges ({len(ast[\"nodes\"])} AST + {len(sem[\"nodes\"])} semantic)')
"
```

### Step 4 - Build graph, cluster, analyze, generate outputs

**Before starting:** the code blocks below pass `directed=IS_DIRECTED` to `build_from_json()`. Replace `IS_DIRECTED` with `True` if `--directed` was given (builds a `DiGraph` preserving edge direction source→target), otherwise `False` (the default undirected `Graph`). Substitute it the same way you substitute `INPUT_PATH` — do not leave the literal `IS_DIRECTED` in the code.

```bash
mkdir -p graphify-out
$(cat graphify-out/.graphify_python) -c "
import sys, json
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding=\"utf-8\"))
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding=\"utf-8\"))

# root= mirrors the --update runbook (#1361): relativize source_file to the same
# base so the full build and incremental --update never drift apart on re-extract.
G = build_from_json(extraction, root='INPUT_PATH', directed=IS_DIRECTED)
# Guard BEFORE any write: an empty extraction must not clobber a good graph.json /
# GRAPH_REPORT.md / analysis sidecar. Check immediately after build (#1392).
if G.number_of_nodes() == 0:
    print('ERROR: Graph is empty - extraction produced no nodes.')
    print('Possible causes: all files were skipped, binary-only corpus, or extraction failed.')
    raise SystemExit(1)
communities = cluster(G)
cohesion = score_all(G, communities)
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: 'Community ' + str(cid) for cid in communities}
# Placeholder questions - regenerated with real labels in Step 5
questions = suggest_questions(G, communities, labels)

# Export FIRST and honor the #479 shrink-guard: to_json returns False (writing
# nothing) when the new graph is smaller than the existing graph.json. Only write
# GRAPH_REPORT.md + the analysis sidecar when the graph was actually written, so
# they never describe a graph that graph.json doesn't contain (#1392).
wrote = to_json(G, communities, 'graphify-out/graph.json')
if not wrote:
    print('ERROR: refused to shrink graphify-out/graph.json (existing graph has more nodes; #479).')
    print('If this shrink is intentional (you deleted files), re-run a full build with --force.')
    raise SystemExit(1)
report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, 'INPUT_PATH', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding=\"utf-8\")
analysis = {
    'communities': {str(k): v for k, v in communities.items()},
    'cohesion': {str(k): v for k, v in cohesion.items()},
    'gods': gods,
    'surprises': surprises,
    'questions': questions,
}
Path('graphify-out/.graphify_analysis.json').write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding=\"utf-8\")
print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')
"
```

If this step prints `ERROR: Graph is empty`, stop and tell the user what happened - do not proceed to labeling or visualization.

Replace INPUT_PATH with the actual path.

### Step 4.5 - Graph health check (read-only integrity gate)

A non-destructive diagnostic on the extraction, before labeling. It surfaces edge collapse, dangling/missing endpoints, and self-loops — the silent-corruption modes of incremental updates and AST/LLM id mismatches. Read-only; never aborts.

```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding=\"utf-8\"))
summary = diagnose_extraction(extraction, directed=IS_DIRECTED, root='INPUT_PATH')
print(format_diagnostic_report(summary))
flags = [f'{summary[k]} {label}' for k, label in (
    ('dangling_endpoint_edges', 'dangling-endpoint edges'),
    ('missing_endpoint_edges', 'missing-endpoint edges'),
    ('self_loop_edges', 'self-loop edges'),
    ('directed_same_endpoint_collapsed_edges', 'collapsed (directed) edges'),
    ('undirected_same_endpoint_collapsed_edges', 'collapsed (undirected) edges'),
) if summary.get(k, 0)]
print('GRAPH HEALTH WARNING: ' + '; '.join(flags) + ' - graph may be incomplete/corrupt.' if flags else 'Graph health: OK (no dangling/missing/collapsed edges).')
"
```

Substitute `IS_DIRECTED` and `INPUT_PATH` as in Step 4. If a `GRAPH HEALTH WARNING` prints, surface it in the final summary (do not abort — the graph is still usable, but the integrity issue must be visible, per the Honesty Rules).

### Step 5 - Label communities

Read `graphify-out/.graphify_analysis.json`. For each community key, look at its node labels and write a 2-5 word plain-language name (e.g. "Attention Mechanism", "Training Pipeline", "Data Loading").

Then regenerate the report and save the labels for the visualizer:

```bash
$(cat graphify-out/.graphify_python) -c "
import sys, json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding=\"utf-8\"))
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding=\"utf-8\"))
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding=\"utf-8\"))

# root= as in Step 4 / the --update runbook (#1361) — same base for node-key parity.
G = build_from_json(extraction, root='INPUT_PATH', directed=IS_DIRECTED)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

# LABELS - replace these with the names you chose above
labels = LABELS_DICT

# Regenerate questions with real community labels (labels affect question phrasing)
questions = suggest_questions(G, communities, labels)

report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, 'INPUT_PATH', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding=\"utf-8\")
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding=\"utf-8\")
# Re-export so graph.json nodes carry the curated community_name (#2490).
# Same extraction as Step 4, so the #479 shrink-guard passes on node count;
# if it still refuses, surface the guard message - do not force past it.
wrote = to_json(G, communities, 'graphify-out/graph.json', community_labels=labels)
if not wrote:
    print('ERROR: refused to shrink graphify-out/graph.json (existing graph has more nodes; #479).')
    print('If this shrink is intentional (you deleted files), re-run a full build with --force.')
print('Report updated with community labels')
"
```

Replace `LABELS_DICT` with the actual dict you constructed (e.g. `{0: "Attention Mechanism", 1: "Training Pipeline"}`).
Replace INPUT_PATH with the actual path.

### Step 6 - Generate Obsidian vault (opt-in) + HTML

**Generate HTML always** (unless `--no-viz`). **Obsidian vault only if `--obsidian` was explicitly given** — skip it otherwise, it generates one file per node.

If `--obsidian` was given:

- If `--obsidian-dir <path>` was also given, pass it via `--dir`. Otherwise defaults to `graphify-out/obsidian`.

```bash
graphify export obsidian
# or with custom dir: graphify export obsidian --dir ~/vaults/my-project
```

Generate the HTML graph (always, unless `--no-viz`):

```bash
graphify export html  # auto-aggregates to community view if graph > 5000 nodes
# or: graphify export html --no-viz
```

### Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark (only on their flags)

These run only when their flag is present (`--wiki`, `--neo4j`/`--neo4j-push`, `--falkordb`/`--falkordb-push`, `--svg`, `--graphml`, `--mcp`) or, for the token-reduction benchmark, when `total_words` exceeds 5,000. A default run with no export flags skips all of them. See `references/exports.md` for each one. Run any `--wiki` export before Step 9 cleanup so `.graphify_labels.json` is still available.

---

### Step 9 - Save manifest, update cost tracker, clean up, and report

```bash
$(cat graphify-out/.graphify_python) -c "
import json
from pathlib import Path
from datetime import datetime, timezone
from graphify.detect import save_manifest

# Save manifest for --update
detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding=\"utf-8\"))
extract = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding=\"utf-8\"))
# In --update mode, 'all_files' carries the full corpus; 'files' is the changed
# subset. Full-rebuild mode populates only 'files', so the fallback handles that.
# root= relativizes the manifest keys to the scan root (same base as the build),
# so the on-disk manifest is portable across clones/machines and a later --update
# matches cached files instead of missing every one (#1417).
#
# Only stamp semantic files (docs/papers/images) that ACTUALLY produced output:
# a detected file whose chunk failed or was omitted must stay unstamped so the
# next --update re-queues it, otherwise it is marked done and its content is lost
# forever (#2015). This mirrors the library extract path exactly
# (cli._stamped_manifest_files + clear_semantic + scan_corpus); do not stamp the
# raw corpus. Code files are always stamped (AST is deterministic); only semantic
# types are gated on output.
from graphify.cli import _stamped_manifest_files
_corpus = detect.get('all_files') or detect['files']
_manifest_files = _stamped_manifest_files(_corpus, extract, Path('INPUT_PATH'))
# Files dispatched this run (the changed subset) but NOT stamped above still carry
# a stale semantic_hash from a prior run; clear it so detect_incremental re-queues
# them instead of reading them as unchanged (#1948).
_sem_types = ('document', 'paper', 'image')
_dispatched = {f for t, fl in detect['files'].items() if t in _sem_types for f in fl}
_stamped = {f for fl in _manifest_files.values() for f in fl}
_cleared = _dispatched - _stamped
# scan_corpus = the RAW full corpus (not the stamp-filtered subset) so in-root
# files newly excluded since last run are dropped rather than masquerading as
# deletions; untouched files' prior rows are still preserved (#1908).
_scan = {f for fl in _corpus.values() for f in fl}
save_manifest(_manifest_files, root='INPUT_PATH', scan_corpus=_scan, clear_semantic=_cleared or None)

# Update cumulative cost tracker
input_tok = extract.get('input_tokens', 0)
output_tok = extract.get('output_tokens', 0)

cost_path = Path('graphify-out/cost.json')
if cost_path.exists():
    cost = json.loads(cost_path.read_text(encoding=\"utf-8\"))
else:
    cost = {'runs': [], 'total_input_tokens': 0, 'total_output_tokens': 0}

cost['runs'].append({
    'date': datetime.now(timezone.utc).isoformat(),
    'input_tokens': input_tok,
    'output_tokens': output_tok,
    'files': detect.get('total_files', 0),
})
cost['total_input_tokens'] += input_tok
cost['total_output_tokens'] += output_tok
cost_path.write_text(json.dumps(cost, indent=2, ensure_ascii=False), encoding=\"utf-8\")

print(f'This run: {input_tok:,} input tokens, {output_tok:,} output tokens')
print(f'All time: {cost[\"total_input_tokens\"]:,} input, {cost[\"total_output_tokens\"]:,} output ({len(cost[\"runs\"])} runs)')
"
rm -f graphify-out/.graphify_detect.json graphify-out/.graphify_extract.json graphify-out/.graphify_ast.json graphify-out/.graphify_semantic.json graphify-out/.graphify_analysis.json
find graphify-out -maxdepth 1 -name '.graphify_chunk_*.json' -delete 2>/dev/null
rm -f graphify-out/.needs_update 2>/dev/null || true
```

Replace INPUT_PATH with the actual path (same value used in Steps 4-5) so the manifest is relativized to the scan root.

Tell the user (omit the obsidian line unless --obsidian was given):
```
Graph complete. Outputs in PATH_TO_DIR/graphify-out/

  graph.html            - interactive graph, open in browser
  GRAPH_REPORT.md       - audit report
  graph.json            - raw graph data
  obsidian/             - Obsidian vault (only if --obsidian was given)
```

If graphify saved you time, consider supporting it: https://github.com/sponsors/safishamsi

Replace PATH_TO_DIR with the actual absolute path of the directory that was processed.

Then paste these sections from GRAPH_REPORT.md directly into the chat:
- God Nodes
- Surprising Connections
- Suggested Questions

Do NOT paste the full report - just those three sections. Keep it concise.

Then immediately offer to explore. Pick the single most interesting suggested question from the report - the one that crosses the most community boundaries or has the most surprising bridge node - and ask:

> "The most interesting question this graph can answer: **[question]**. Want me to trace it?"

If the user says yes, run `/graphify query "[question]"` on the graph and walk them through the answer using the graph structure - which nodes connect, which community boundaries get crossed, what the path reveals. Keep going as long as they want to explore. Each answer should end with a natural follow-up ("this connects to X - want to go deeper?") so the session feels like navigation, not a one-shot report.

The graph is the map. Your job after the pipeline is to be the guide.

---

## Interpreter guard for subcommands

Before running any subcommand below (`--update`, `--cluster-only`, `query`, `path`, `explain`, `add`), check that `.graphify_python` exists. If it's missing (e.g. user deleted `graphify-out/`), re-resolve the interpreter first:

```bash
if [ ! -f graphify-out/.graphify_python ]; then
    GRAPHIFY_BIN=$(which graphify 2>/dev/null)
    if [ -n "$GRAPHIFY_BIN" ]; then
        PYTHON=$(head -1 "$GRAPHIFY_BIN" | tr -d '#!')
        case "$PYTHON" in *[!a-zA-Z0-9/_.@-]*) PYTHON="python3" ;; esac
    else
        PYTHON="python3"
    fi
    mkdir -p graphify-out
    "$PYTHON" -c "import sys; open('graphify-out/.graphify_python', 'w', encoding='utf-8').write(sys.executable)"
fi
```

## For --update and --cluster-only

Both are non-default subcommands. `--update` re-extracts only new or changed files; `--cluster-only` reruns clustering on the existing graph. See `references/update.md` for both flows.

---

## For /graphify query

When `graphify-out/graph.json` already exists and the user asks a question about the corpus, answer from the graph rather than rebuilding it:

```bash
graphify query "<question>"
```

Before traversal, expand the question against the graph's own vocabulary so a wording mismatch does not collapse the answer to noise. If the `graphify query` CLI is unavailable, fall back to an inline NetworkX traversal of `graphify-out/graph.json`. Answer using only what the graph output contains, and quote `source_location` when citing a specific fact. For that vocab-expansion step, the BFS/DFS traversal modes, the `--budget` cap, the NetworkX fallback, `save-result` feedback, and the `/graphify path` and `/graphify explain` flows, see `references/query.md`.

---

## For /graphify add and --watch

Neither is part of the default build. When the user runs `/graphify add <url>` to fetch a URL into the corpus, or passes `--watch` to auto-rebuild on file changes, see `references/add-watch.md`.

---

## For the commit hook and native CLAUDE.md integration

When the user asks to install the post-commit auto-rebuild hook or wire graphify into a project's CLAUDE.md, see `references/hooks.md`.

---

## Honesty Rules

- Never invent an edge. If unsure, use AMBIGUOUS.
- Never skip the corpus check warning.
- Always show token cost in the report.
- Never hide cohesion scores behind symbols - show the raw number.
- Never run HTML viz on a graph with more than 5,000 nodes without warning the user.

exec
/bin/bash -lc 'git status --short; git diff feaeefa --stat -- src/core/auth/googleAuth.ts src/app/auth/login.tsx src/app/settings/security.tsx src/ui/PinLock.tsx backend/api/views_auth.py' in /mnt/f/personal projects/credkeep
 succeeded in 2722ms:
 M .agents/rules/graphify.md
 M .agents/skills/code-review/SKILL.md
 M .agents/skills/code-review/agents/openai.yaml
 M .agents/skills/diagnosing-bugs/SKILL.md
 M .agents/skills/diagnosing-bugs/agents/openai.yaml
 M .agents/skills/financial-invariant-verification/SKILL.md
 M .agents/skills/react-native-testing/SKILL.md
 M .agents/skills/security-review/SKILL.md
 M .agents/skills/sqlite-integration-testing/SKILL.md
 M .agents/skills/tdd/SKILL.md
 M .agents/skills/tdd/agents/openai.yaml
 M .agents/skills/tdd/mocking.md
 M .agents/skills/tdd/tests.md
 M .agents/workflows/graphify.md
 M .codex/hooks.json.disabled
 M .gitattributes
 M .gitignore
 M .graphifyignore
 M .npmrc
 M .scratch/screens/CredKeep_Borrowers.html
 M .scratch/screens/CredKeep_Collections.html
 M .scratch/screens/CredKeep_Home.html
 M .scratch/screens/CredKeep_Loans.html
 M .scratch/screens/CredKeep_More_Settings.html
 M .scratch/screens/New_Loan_Borrower_&_Product.html
 M .scratch/screens/New_Loan_Review_&_Create.html
 M .scratch/screens/New_Loan_Security.html
 M .scratch/screens/New_Loan_Terms_&_Calculation.html
 M .scratch/screens/Payment_Recorded.html
 M .scratch/screens/Record_Payment.html
 M .scratch/v1-financial-engine/issues/07-bullet-loan-settlement.md
 M .workflow/AGENT_ROLES.md
 M .workflow/DECISIONS.md
 M .workflow/MODEL_POLICY.md
 M .workflow/QA_GATE.md
 M .workflow/SESSION_LOG.md
 M .workflow/TASKS.md
 M .workflow/V2_TASKS.md
 M .workflow/handoff.ps1
 M .workflow/handoffs/.gitkeep
 M .workflow/mock-cmd.bat
 M .workflow/plans/.gitkeep
 M .workflow/plans/Android_SafeArea.md
 M .workflow/plans/Android_SafeArea_prompt.txt
 M .workflow/plans/Borrower_Profile.md
 M .workflow/plans/Borrower_Profile_Impl.md
 M .workflow/plans/Borrower_Profile_Impl_prompt.txt
 M .workflow/plans/Borrower_Profile_prompt.txt
 M .workflow/plans/CK-P0-001.md
 M .workflow/plans/CK-P0-002.md
 M .workflow/plans/CK-P0-003-QA.md
 M .workflow/plans/CK-V2-ARCH-001.md
 M .workflow/plans/CK-V2-ARCH-001_prompt.txt
 M .workflow/plans/PIN_App_Lock.md
 M .workflow/plans/PIN_App_Lock_prompt.txt
 M .workflow/plans/Second_Phone_Install.md
 M .workflow/plans/Second_Phone_Install_prompt.txt
 M .workflow/plans/test_invocation.md
 M .workflow/plans/test_invocation_prompt.txt
 M .workflow/qa-codex.ps1
 M .workflow/reports/.gitkeep
 M .workflow/reports/CK-P0-002_QA.md
 M .workflow/reports/CODEX_EXECUTION_STATUS.md
 M .workflow/reports/CODEX_QA_DIAGNOSTIC.md
 M .workflow/reports/QA_REPAIR_SUMMARY.md
 M .workflow/reports/Stale_Home_earnings_qa_prompt.txt
 M .workflow/reports/Stale_Home_earnings_qa_report.md
 M .workflow/reports/V2_Final_qa_guard.json
 M .workflow/reports/V2_Final_qa_prompt.txt
 M .workflow/reports/V2_Final_qa_report.md
 M .workflow/reports/V2_Milestone_qa_guard.json
 M .workflow/reports/V2_Milestone_qa_prompt.txt
 M .workflow/reports/V2_Milestone_qa_report.md
 M .workflow/reports/V2_Phase1_qa_prompt.txt
 M .workflow/reports/V2_Phase1_qa_report.md
 M .workflow/reports/V2_RENDER_STAGING_DEPLOYMENT.md
 M .workflow/reports/V2_Signoff_qa_guard.json
 M .workflow/reports/V2_Signoff_qa_prompt.txt
 M .workflow/reports/V2_Signoff_qa_report.md
 M .workflow/reports/codex_diagnostic_plan.md
 M .workflow/reports/codex_qa_report.md
 M .workflow/reports/codex_qa_report_2.md
 M .workflow/reports/mock-task_qa_prompt.txt
 M .workflow/run-codex.ps1
 M .workflow/status.ps1
 M .workflow/test-qa-orchestrator.ps1
 M .workflow/tests/.gitkeep
 M AGENTS.md
 M app.json
 M backend/.gitignore
 M backend/Dockerfile
 M backend/README.md
 M backend/api/admin.py
 M backend/api/apps.py
 M backend/api/authentication.py
 M backend/api/models.py
 M backend/api/tests.py
 M backend/api/urls.py
 M backend/api/views.py
 M backend/credkeep_backend/asgi.py
 M backend/credkeep_backend/settings.py
 M backend/credkeep_backend/urls.py
 M backend/credkeep_backend/wsgi.py
 M backend/ledger/__init__.py
 M backend/ledger/admin.py
 M backend/ledger/apps.py
 M backend/ledger/engine/__init__.py
 M backend/ledger/engine/allocation.py
 M backend/ledger/engine/penalty.py
 M backend/ledger/engine/schedule.py
 M backend/ledger/migrations/0001_initial.py
 M backend/ledger/migrations/0002_rls.py
 M backend/ledger/migrations/0003_syncoutbox_unique_tenant_outbox_sequence.py
 M backend/ledger/migrations/0004_loanaccount_check_loan_markup_factor_non_negative_and_more.py
 M backend/ledger/migrations/0005_transaction_unique_tenant_transaction_sequence.py
 M backend/ledger/migrations/0006_synclog_operation_type_synclog_request_payload.py
 M backend/ledger/migrations/0007_loanaccount_annual_rate_loanaccount_collateral_and_more.py
 M backend/ledger/models.py
 M backend/ledger/tests.py
 M backend/manage.py
 M backend/pytest.ini
 M backend/tenants/admin.py
 M backend/tenants/apps.py
 M backend/tenants/management/commands/verify_database_role.py
 M backend/tenants/management/commands/verify_rls.py
 M backend/tenants/middleware.py
 M backend/tenants/migrations/0001_initial.py
 M backend/tenants/migrations/0002_device.py
 M backend/tenants/migrations/0003_rls.py
 M backend/tenants/migrations/0004_tenant_outbox_sequence_counter.py
 M backend/tenants/migrations/0005_tenant_transaction_sequence_counter.py
 M backend/tenants/migrations/0006_googleidentity.py
 M backend/tenants/models.py
 M backend/tenants/test_deployment_checks.py
 M backend/tenants/tests.py
 M backend/tenants/views.py
 M design/credkeep_design_pack/03_workflow/COMPLETION_TRACKER.csv
 M design/credkeep_design_pack/03_workflow/STITCH_GENERATION_RESULTS.ndjson
 M design/credkeep_design_pack/04_audit/DESIGN_GAP_MATRIX.csv
 M docs/FINANCIAL_RULES.md
 M docs/v2/01-v1-audit.md
 M docs/v2/02-system-architecture.md
 M docs/v2/03-backend-design.md
 M docs/v2/04-threat-model.md
 M docs/v2/05-tenant-isolation.md
 M docs/v2/06-data-model.md
 M docs/v2/07-financial-invariants.md
 M docs/v2/08-migrations.md
 M docs/v2/09-sync-protocol.md
 M docs/v2/10-sync-failure-matrix.md
 M docs/v2/11-v1-migration.md
 M docs/v2/12-api-contract.md
 M docs/v2/13-hosting.md
 M docs/v2/14-operations.md
 M docs/v2/15-test-strategy.md
 M docs/v2/16-release-roadmap.md
 M docs/v2/17-risk-register.md
 M docs/v2/18-open-decisions.md
 M docs/v2/README.md
 M eas.json
 M fetch_screens.js
 M package-lock.json
 M package.json
 M render.yaml
 M src/__tests__/bullet-loan.test.ts
 M src/__tests__/cross-loan.test.ts
 M src/__tests__/loans.test.tsx
 M src/app/(tabs)/_layout.tsx
 M src/app/auth/login.tsx
 M src/app/settings/security.tsx
 M src/core/auth/googleAuth.ts
 M src/core/database/borrowerRepository.ts
 M src/core/database/loanRepository.test.ts
 M src/core/database/loanRepository.ts
 M src/core/database/transactionRepository.ts
 M src/core/domain/allocation.test.ts
 M src/core/domain/allocation.ts
 M src/core/domain/backupUtil.test.ts
 M src/core/domain/backupUtil.ts
 M src/core/domain/models.ts
 M src/core/domain/money.test.ts
 M src/core/domain/money.ts
 M src/core/domain/penalty.test.ts
 M src/core/domain/penalty.ts
 M src/core/domain/schedule.test.ts
 M src/core/domain/schedule.ts
 M src/core/sync/syncService.test.ts
 M src/core/sync/syncService.ts
 M src/ui/Keypad.tsx
 M src/ui/PinLock.tsx
 M tsconfig.json
?? .workflow/reports/OAuth_Audience_Fix_qa_prompt.txt
?? .workflow/reports/OAuth_Audience_Fix_qa_report.md
 src/app/auth/login.tsx        |   8 +-
 src/app/settings/security.tsx | 655 +++++++++++++++++++++---------------------
 src/core/auth/googleAuth.ts   |  16 +-
 src/ui/PinLock.tsx            |  28 +-
 4 files changed, 371 insertions(+), 336 deletions(-)

exec
/bin/bash -lc 'git rev-parse feaeefa; git log feaeefa..HEAD --oneline; git diff --ignore-space-at-eol feaeefa -- src/core/auth/googleAuth.ts src/app/auth/login.tsx src/app/settings/security.tsx src/ui/PinLock.tsx backend/api/views_auth.py; cat package.json' in /mnt/f/personal projects/credkeep
 succeeded in 441ms:
feaeefabed797318857823a5770abae6dce5c367
diff --git a/src/app/auth/login.tsx b/src/app/auth/login.tsx
index 38544a3..08678f0 100644
--- a/src/app/auth/login.tsx
+++ b/src/app/auth/login.tsx
@@ -20,7 +20,7 @@ import { AuthService } from '../../core/auth/authService';
 import { triggerBackendWarmup } from '../../core/api/backendWarmup';
 import { useSecurity } from '../../ui/PinLock';
 
-import { promptGoogleSignIn } from '../../core/auth/googleAuth';
+import { promptGoogleSignIn, signOutGoogle } from '../../core/auth/googleAuth';
 
 export default function LoginScreen() {
   const router = useRouter();
@@ -104,6 +104,12 @@ export default function LoginScreen() {
         }
       }
     } catch (err: any) {
+      // Clear stale Google SDK state after backend rejection so subsequent taps reopen picker
+      try {
+        await signOutGoogle();
+      } catch {
+        // Non-fatal
+      }
       if (
         err?.code === 'ACCOUNT_EXISTS_LINK_REQUIRED' ||
         err?.message?.includes('link your Google account')
diff --git a/src/app/settings/security.tsx b/src/app/settings/security.tsx
index 0f7cf38..d60ebb3 100644
--- a/src/app/settings/security.tsx
+++ b/src/app/settings/security.tsx
@@ -12,7 +12,7 @@ import { Card } from '../../ui/Card';
 import { GoogleLogo } from '../../ui/GoogleSignInButton';
 import { AuthStore } from '../../core/auth/authStore';
 import { AuthService } from '../../core/auth/authService';
-import { promptGoogleSignIn } from '../../core/auth/googleAuth';
+import { promptGoogleSignIn, signOutGoogle } from '../../core/auth/googleAuth';
 
 export default function SecuritySettingsScreen() {
   const router = useRouter();
@@ -47,6 +47,11 @@ export default function SecuritySettingsScreen() {
         `Successfully linked ${linkRes.email}. You can now sign in to your CredKeep workspace using Continue with Google.`
       );
     } catch (err: any) {
+      try {
+        await signOutGoogle();
+      } catch {
+        // Non-fatal
+      }
       Alert.alert(
         'Unable to Link Account',
         err?.message || 'Failed to connect Google account. Please try again.'
diff --git a/src/core/auth/googleAuth.ts b/src/core/auth/googleAuth.ts
index c035505..c93eb20 100644
--- a/src/core/auth/googleAuth.ts
+++ b/src/core/auth/googleAuth.ts
@@ -55,6 +55,14 @@ export async function promptGoogleSignIn(): Promise<GooglePromptResult> {
   try {
     if (Platform.OS === 'android') {
       await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
+      // Reset stale native Google session before prompting so the account picker always opens
+      try {
+        if (typeof GoogleSignin.hasPreviousSignIn === 'function' && GoogleSignin.hasPreviousSignIn()) {
+          await GoogleSignin.signOut();
+        }
+      } catch {
+        // Non-fatal session reset
+      }
     }
 
     const response: SignInResponse = await GoogleSignin.signIn();
@@ -91,11 +99,15 @@ export async function promptGoogleSignIn(): Promise<GooglePromptResult> {
   } catch (error: any) {
     if (error?.code === statusCodes?.SIGN_IN_CANCELLED) {
       return { success: false, cancelled: true };
-    } else if (error?.code === statusCodes?.IN_PROGRESS) {
+    } else if (
+      error?.code === statusCodes?.IN_PROGRESS ||
+      error?.code === 'ASYNC_OP_IN_PROGRESS' ||
+      error?.message?.includes('ASYNC_OP_IN_PROGRESS')
+    ) {
       return {
         success: false,
         error: 'Sign in is already in progress. Please wait.',
-        code: error.code,
+        code: error.code || 'ASYNC_OP_IN_PROGRESS',
       };
     } else if (error?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
       return {
diff --git a/src/ui/PinLock.tsx b/src/ui/PinLock.tsx
index 7811de4..8e1e336 100644
--- a/src/ui/PinLock.tsx
+++ b/src/ui/PinLock.tsx
@@ -1,5 +1,5 @@
 import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
-import { View, StyleSheet, TouchableOpacity, AppState, AppStateStatus, Modal } from 'react-native';
+import { View, StyleSheet, TouchableOpacity, AppState, AppStateStatus, Modal, ActivityIndicator } from 'react-native';
 import * as SecureStore from 'expo-secure-store';
 import * as LocalAuthentication from 'expo-local-authentication';
 import { Typography } from './Typography';
@@ -71,22 +71,21 @@ export function PinLock({ children }: { children: React.ReactNode }) {
   };
 
   const checkPinSetup = async () => {
+    let pinExists = false;
+    let bioActive = false;
     try {
       setStorageError(null);
       const pin = await SecureStore.getItemAsync(PIN_KEY);
       const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
 
-      const pinExists = Boolean(pin && pin.trim().length === 4);
+      pinExists = Boolean(pin && pin.trim().length === 4);
       setHasPinState(pinExists);
       setStoredPin(pinExists ? pin : null);
-      const bioActive = bio === 'true';
+      bioActive = bio === 'true';
       setBioEnabledState(bioActive);
 
       if (pinExists) {
         setIsLocked(true);
-        if (bioActive) {
-          await promptBiometricsIfEligible();
-        }
       } else {
         setIsLocked(false);
       }
@@ -98,6 +97,10 @@ export function PinLock({ children }: { children: React.ReactNode }) {
     } finally {
       setLoading(false);
     }
+
+    if (pinExists && bioActive) {
+      promptBiometricsIfEligible();
+    }
   };
 
   useEffect(() => {
@@ -135,8 +138,17 @@ export function PinLock({ children }: { children: React.ReactNode }) {
   }, [hasPin, bioEnabled]);
 
   useEffect(() => {
+    // Fail-safe timeout ensures startup loading overlay never hangs indefinitely
+    const safetyTimer = setTimeout(() => {
+      setLoading(false);
+    }, 3500);
+
     // eslint-disable-next-line react-hooks/set-state-in-effect
-    checkPinSetup();
+    checkPinSetup().finally(() => {
+      clearTimeout(safetyTimer);
+    });
+
+    return () => clearTimeout(safetyTimer);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
 
@@ -219,7 +231,7 @@ export function PinLock({ children }: { children: React.ReactNode }) {
         {/* Loading overlay during initial PIN check */}
         {loading && (
           <View style={[StyleSheet.absoluteFill, styles.overlay]}>
-            <Typography variant="headlineMd">Loading...</Typography>
+            <ActivityIndicator size="large" color={theme.colors.primary} />
           </View>
         )}
 
{
  "name": "credkeep",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "dependencies": {
    "@react-native-google-signin/google-signin": "^16.1.5",
    "crypto-js": "^4.2.0",
    "expo": "~57.0.30",
    "expo-build-properties": "~57.0.22",
    "expo-constants": "~57.0.22",
    "expo-crypto": "~57.0.4",
    "expo-document-picker": "~57.0.3",
    "expo-file-system": "~57.0.7",
    "expo-image-picker": "~57.0.20",
    "expo-linking": "~57.0.13",
    "expo-local-authentication": "~57.0.3",
    "expo-network": "~57.0.2",
    "expo-router": "~57.0.28",
    "expo-secure-store": "~57.0.4",
    "expo-sharing": "~57.0.23",
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
    "jest-expo": "~57.0.6",
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

exec
/bin/bash -lc "if test -f graphify-out/graph.json; then graphify query 'googleAuth PinLock SyncOutbox authentication startup' --budget 1200; fi" in /mnt/f/personal projects/credkeep
 exited 127 in 118ms:
/bin/bash: line 1: graphify: command not found

exec
/bin/bash -lc 'cat src/ui/PinLock.tsx src/core/auth/googleAuth.ts src/app/auth/login.tsx backend/api/views_auth.py' in /mnt/f/personal projects/credkeep
 succeeded in 18ms:
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState, AppStateStatus, Modal, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Typography } from './Typography';
import { Button } from './Button';
import { theme } from './theme';
import { Keypad } from './Keypad';

export const PIN_KEY = 'credkeep_app_pin';
export const BIO_ENABLED_KEY = 'credkeep_bio_enabled';

// Grace period before re-locking when app is backgrounded (30 seconds)
const BACKGROUND_LOCK_GRACE_PERIOD_MS = 30000;

interface SecurityContextValue {
  hasPin: boolean;
  bioEnabled: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  setBioEnabled: (enabled: boolean) => Promise<void>;
  lockApp: () => void;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export const useSecurity = () => {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within PinLock');
  return ctx;
};

export function PinLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPinState] = useState(false);
  const [bioEnabled, setBioEnabledState] = useState(false);

  const [pinEntry, setPinEntry] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimestampRef = useRef<number | null>(null);
  const isAuthenticatingBioRef = useRef<boolean>(false);

  const promptBiometricsIfEligible = async () => {
    if (isAuthenticatingBioRef.current) return;
    try {
      isAuthenticatingBioRef.current = true;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock CredKeep',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: true,
        });
        if (auth.success) {
          setIsLocked(false);
          setPinEntry('');
          setStorageError(null);
        }
      }
    } catch (e) {
      console.warn('Biometric auth error', e);
    } finally {
      isAuthenticatingBioRef.current = false;
    }
  };

  const checkPinSetup = async () => {
    let pinExists = false;
    let bioActive = false;
    try {
      setStorageError(null);
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);

      pinExists = Boolean(pin && pin.trim().length === 4);
      setHasPinState(pinExists);
      setStoredPin(pinExists ? pin : null);
      bioActive = bio === 'true';
      setBioEnabledState(bioActive);

      if (pinExists) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    } catch (e: any) {
      console.error('SecureStore error', e);
      // Fail-secure: If SecureStore fails, stay locked and allow the user to retry
      setIsLocked(true);
      setStorageError('Failed to access secure storage. Please retry.');
    } finally {
      setLoading(false);
    }

    if (pinExists && bioActive) {
      promptBiometricsIfEligible();
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState;

      // Do NOT lock if native biometric prompt dialog is currently active
      if (isAuthenticatingBioRef.current) {
        return;
      }

      if (nextAppState === 'background') {
        // Record timestamp when the app enters background
        backgroundTimestampRef.current = Date.now();
      } else if (nextAppState === 'active') {
        // When returning to active, check if the app was previously backgrounded
        if (backgroundTimestampRef.current !== null) {
          const elapsed = Date.now() - backgroundTimestampRef.current;
          backgroundTimestampRef.current = null;

          // Only lock if genuine background duration met or exceeded grace period
          if (hasPin && elapsed >= BACKGROUND_LOCK_GRACE_PERIOD_MS) {
            setIsLocked(true);
            setPinEntry('');
            if (bioEnabled) {
              promptBiometricsIfEligible();
            }
          }
        }
      }
      // Note: Transitions to 'inactive' do NOT clear backgroundTimestampRef or trigger lock
    });

    return () => subscription.remove();
  }, [hasPin, bioEnabled]);

  useEffect(() => {
    // Fail-safe timeout ensures startup loading overlay never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3500);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkPinSetup().finally(() => {
      clearTimeout(safetyTimer);
    });

    return () => clearTimeout(safetyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      setError(false);
      const newPin = pinEntry + num;
      setPinEntry(newPin);

      if (newPin.length === 4) {
        if (newPin === storedPin) {
          setIsLocked(false);
          setPinEntry('');
          setStorageError(null);
        } else {
          setError(true);
          setTimeout(() => setPinEntry(''), 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinEntry((prev) => prev.slice(0, -1));
    setError(false);
  };

  const setPin = async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
    setStoredPin(pin);
    setHasPinState(true);
  };

  const removePin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
    setStoredPin(null);
    setHasPinState(false);
    setBioEnabledState(false);
    setIsLocked(false);
  };

  const setBioEnabled = async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
    setBioEnabledState(enabled);
  };

  const lockApp = () => {
    if (hasPin) {
      setIsLocked(true);
      setPinEntry('');
    }
  };

  const handleRetryBio = async () => {
    await promptBiometricsIfEligible();
  };

  const contextValue: SecurityContextValue = {
    hasPin,
    bioEnabled,
    setPin,
    removePin,
    setBioEnabled,
    lockApp,
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      <View style={styles.root}>
        {/* Navigation children are ALWAYS kept mounted underneath to preserve navigation and form state */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={isLocked || loading ? 'none' : 'auto'}
          importantForAccessibility={isLocked || loading ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>

        {/* Loading overlay during initial PIN check */}
        {loading && (
          <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}

        {/* Top-level Modal overlay when locked: covers all screens including native Android Modals */}
        <Modal
          visible={isLocked && !loading}
          animationType="fade"
          transparent={false}
          statusBarTranslucent
          onRequestClose={() => {
            // Android back button cannot dismiss PIN lock
          }}
        >
          <View style={styles.container}>
            <Typography variant="headlineMd" color={theme.colors.primary} style={styles.title}>
              Enter PIN
            </Typography>

            {storageError ? (
              <View style={styles.errorContainer}>
                <Typography variant="bodyMd" color={theme.colors.error} style={{ marginBottom: 16 }}>
                  {storageError}
                </Typography>
                <Button title="Retry Security Check" onPress={() => checkPinSetup()} />
              </View>
            ) : (
              <>
                <View style={styles.dotsContainer}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        pinEntry.length >= i ? styles.dotFilled : null,
                        error ? styles.dotError : null,
                      ]}
                    />
                  ))}
                </View>

                <Keypad onKeyPress={handleKeyPress} onBackspace={handleBackspace} />

                {bioEnabled && (
                  <TouchableOpacity onPress={handleRetryBio} style={styles.bioButton}>
                    <Typography variant="labelLg" color={theme.colors.primary}>
                      Use Biometrics
                    </Typography>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Modal>
      </View>
    </SecurityContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  overlay: {
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
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
    marginBottom: 60,
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
  bioButton: {
    marginTop: 40,
    padding: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
});
import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  SignInResponse,
} from '@react-native-google-signin/google-signin';

export interface GoogleAuthResult {
  idToken: string;
  email?: string;
  name?: string;
}

export type GooglePromptResult =
  | { success: true; idToken: string; email?: string; name?: string }
  | { success: false; cancelled: true }
  | { success: false; error: string; code?: string };

let isConfigured = false;

export function configureGoogleAuth(webClientId?: string): void {
  const clientId = webClientId || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured in the environment. Google Sign-In requires a configured Web OAuth Client ID.'
    );
  }

  try {
    GoogleSignin.configure({
      webClientId: clientId,
      offlineAccess: false,
    });
    isConfigured = true;
  } catch (err: any) {
    // Graceful fallback for non-native environments or unit tests
    console.warn('[GoogleAuth] Failed to configure GoogleSignin:', err?.message || err);
  }
}

export async function promptGoogleSignIn(): Promise<GooglePromptResult> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return {
      success: false,
      error:
        'Google OAuth requires EXPO_PUBLIC_GOOGLE_CLIENT_ID configured in your environment. Username/password login is active.',
    };
  }

  if (!isConfigured) {
    configureGoogleAuth(clientId);
  }

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Reset stale native Google session before prompting so the account picker always opens
      try {
        if (typeof GoogleSignin.hasPreviousSignIn === 'function' && GoogleSignin.hasPreviousSignIn()) {
          await GoogleSignin.signOut();
        }
      } catch {
        // Non-fatal session reset
      }
    }

    const response: SignInResponse = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return { success: false, cancelled: true };
    }

    if (response.type === 'success' && response.data) {
      let idToken = response.data.idToken;
      if (!idToken) {
        // Fallback: fetch tokens explicitly if idToken was not in initial payload
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        return {
          success: false,
          error:
            'Google Sign-In did not return an identity token. Please ensure your Web Client ID is properly configured.',
        };
      }

      return {
        success: true,
        idToken,
        email: response.data.user?.email,
        name: response.data.user?.name || undefined,
      };
    }

    return { success: false, cancelled: true };
  } catch (error: any) {
    if (error?.code === statusCodes?.SIGN_IN_CANCELLED) {
      return { success: false, cancelled: true };
    } else if (
      error?.code === statusCodes?.IN_PROGRESS ||
      error?.code === 'ASYNC_OP_IN_PROGRESS' ||
      error?.message?.includes('ASYNC_OP_IN_PROGRESS')
    ) {
      return {
        success: false,
        error: 'Sign in is already in progress. Please wait.',
        code: error.code || 'ASYNC_OP_IN_PROGRESS',
      };
    } else if (error?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        success: false,
        error: 'Google Play Services is not available or outdated on this device.',
        code: error.code,
      };
    }

    return {
      success: false,
      error:
        error?.message ||
        'Google authentication failed. Please try again or use your password.',
      code: error?.code,
    };
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal
  }
}
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { Input } from '../../ui/Input';
import { PasswordInput } from '../../ui/PasswordInput';
import { Button } from '../../ui/Button';
import { GoogleSignInButton } from '../../ui/GoogleSignInButton';
import { theme } from '../../ui/theme';
import { AuthService } from '../../core/auth/authService';
import { triggerBackendWarmup } from '../../core/api/backendWarmup';
import { useSecurity } from '../../ui/PinLock';

import { promptGoogleSignIn, signOutGoogle } from '../../core/auth/googleAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { hasPin, bioEnabled } = useSecurity();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    // Non-blocking backend wake-up
    triggerBackendWarmup();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await AuthService.login({ username, password });

      if (!hasPin && !bioEnabled) {
        router.replace('/auth/security-setup');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials or network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLinkNotice(null);

    const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      setError(
        'Google OAuth requires EXPO_PUBLIC_GOOGLE_CLIENT_ID configured in your environment. Username/password login is active.'
      );
      return;
    }

    try {
      setGoogleLoading(true);
      const promptResult = await promptGoogleSignIn();

      if (!promptResult.success) {
        if ('cancelled' in promptResult) {
          // User dismissed or cancelled the Google account picker
          return;
        }
        setError(promptResult.error || 'Google authentication was cancelled.');
        return;
      }

      const res = await AuthService.loginWithGoogle(promptResult.idToken);

      if (res.status === 'needs_profile') {
        router.push({
          pathname: '/auth/google-onboarding',
          params: {
            tempToken: res.tempToken,
            profileName: res.profileName,
            email: res.email,
          },
        });
      } else {
        if (!hasPin && !bioEnabled) {
          router.replace('/auth/security-setup');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      // Clear stale Google SDK state after backend rejection so subsequent taps reopen picker
      try {
        await signOutGoogle();
      } catch {
        // Non-fatal
      }
      if (
        err?.code === 'ACCOUNT_EXISTS_LINK_REQUIRED' ||
        err?.message?.includes('link your Google account')
      ) {
        setLinkNotice(
          'An existing CredKeep account uses this email. Please log in with your username and password below, then connect your Google account in App Security settings.'
        );
      } else {
        setError(err?.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top App Bar with CredKeep Mark and Version Tag */}
        <View style={styles.topBar}>
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Typography variant="labelSm" color="#FFFFFF" style={styles.logoText}>
                CK
              </Typography>
            </View>
            <Typography variant="titleMd" color={theme.colors.textPrimary} style={styles.brandTitle}>
              CredKeep
            </Typography>
          </View>
          <View style={styles.versionPill}>
            <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.versionText}>
              v2.4
            </Typography>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <Typography variant="headlineLg" color={theme.colors.textPrimary} style={styles.title}>
              Welcome back
            </Typography>
            <Typography variant="bodyMd" color={theme.colors.textSecondary} style={styles.subtitle}>
              Sign in to your CredKeep workspace.
            </Typography>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={theme.colors.danger} style={{ marginTop: 2, marginRight: 8 }} />
              <Typography variant="bodySm" color={theme.colors.danger} style={{ flex: 1 }}>
                {error}
              </Typography>
            </View>
          )}

          {/* Account Exists / Link Notice Banner */}
          {linkNotice && (
            <View style={styles.linkNoticeBanner}>
              <ShieldCheck size={18} color={theme.colors.textPrimary} style={{ marginTop: 2, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                  Existing Account Detected
                </Typography>
                <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
                  {linkNotice}
                </Typography>
              </View>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            <Input
              label="Username"
              placeholder="e.g. ramesh_financier"
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <PasswordInput
              label="Password"
              placeholder="••••••••••••"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              headerRight={
                <TouchableOpacity
                  onPress={() => router.push('/auth/forgot-password')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                >
                  <Typography variant="labelSm" color={theme.colors.textSecondary}>
                    Forgot password?
                  </Typography>
                </TouchableOpacity>
              }
            />

            {/* Primary Action Button */}
            <Button
              title="Log In"
              onPress={handleLogin}
              loading={loading}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
              style={styles.loginBtn}
            />

            {/* OR Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerBadge}>
                <Typography variant="labelSm" color={theme.colors.textSecondary} style={styles.dividerText}>
                  OR
                </Typography>
              </View>
            </View>

            {/* Google Authentication */}
            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              style={styles.googleBtn}
            />
          </View>

          {/* Bottom Switch Link */}
          <View style={styles.bottomLinkContainer}>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              {"Don't have an account? "}
            </Typography>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Typography variant="bodySm" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Create account
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Local Keystore Security Information Card */}
          <View style={styles.securityCard}>
            <ShieldCheck size={18} color={theme.colors.textSecondary} style={{ marginTop: 2, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ fontWeight: '600' }}>
                Local Keystore Security (AES-256)
              </Typography>
              <Typography variant="bodySm" color={theme.colors.textSecondary} style={styles.securityText}>
                Session keys and local ledger state are hardware-isolated. Account credentials verify on-device cryptographic nodes.
              </Typography>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    height: 56,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.actionPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  brandTitle: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  versionText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.dangerContainer,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  linkNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  form: {
    gap: 4,
  },
  loginBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.actionPrimary,
  },
  dividerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.borderDefault,
  },
  dividerBadge: {
    position: 'absolute',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  googleBtn: {
    width: '100%',
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  securityText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
});
import os
import uuid
import json
import urllib.request
import urllib.error
import logging
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from tenants.models import Tenant, Device, GoogleIdentity

logger = logging.getLogger(__name__)


def verify_google_id_token(id_token: str, google_client_id: str) -> dict:
    """
    Verifies a Google ID token against Google's public tokeninfo service.
    Validates audience, expiration, and email_verified.
    Raises ValueError with client-safe message if verification fails.
    """
    if not google_client_id:
        raise ValueError("Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment.")

    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CredKeep-Backend'})
        with urllib.request.urlopen(req, timeout=5) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        logger.warning("Google tokeninfo HTTP error: %s", e)
        raise ValueError("Invalid or expired Google identity token.")
    except Exception as e:
        logger.warning("Failed to verify Google token: %s", e)
        raise ValueError("Failed to verify Google identity token.")

    aud = payload.get('aud')
    if aud != google_client_id:
        raise ValueError("Token audience does not match configured Google client ID.")

    if not payload.get('email_verified', False):
        raise ValueError("Google account email is not verified.")

    if not payload.get('sub'):
        raise ValueError("Google identity token missing subject (sub) claim.")

    return payload


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        workspace_name = request.data.get('workspace_name', '').strip()
        email = request.data.get('email', '').strip()
        full_name = request.data.get('full_name', '').strip()
        phone = request.data.get('phone', '').strip()

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not workspace_name:
            workspace_name = f"{username}'s Workspace"

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            first_name = full_name[:30] if full_name else ''
            last_name = full_name[30:150] if len(full_name) > 30 else ''
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            tenant = Tenant.objects.create(name=workspace_name, owner=user)
            token = Token.objects.create(user=user)

        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {"error": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        token, _ = Token.objects.get_or_create(user=user)
        tenant = getattr(user, 'owned_tenant', None)

        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
            } if tenant else None
        }, status=status.HTTP_200_OK)


class GoogleAuthView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        id_token = request.data.get('id_token', '').strip()
        if not id_token:
            return Response(
                {"error": "id_token is required for Google authentication."},
                status=status.HTTP_400_BAD_REQUEST
            )

        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return Response(
                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            payload = verify_google_id_token(id_token, google_client_id)
        except ValueError as e:
            err_msg = str(e)
            if "not configured" in err_msg:
                return Response({"error": err_msg}, status=status.HTTP_501_NOT_IMPLEMENTED)
            return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        sub = payload['sub']
        email = payload.get('email', '').strip().lower()
        name = payload.get('name', '').strip()

        # 1. Lookup by immutable Google sub identifier
        identity = GoogleIdentity.objects.filter(google_sub=sub).select_related('user').first()
        if identity:
            user = identity.user
            token, _ = Token.objects.get_or_create(user=user)
            tenant = getattr(user, 'owned_tenant', None)
            return Response({
                "status": "success",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                },
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                } if tenant else None
            }, status=status.HTTP_200_OK)

        # 2. Account Takeover Protection (Requirement 9):
        # Prevent logging into an existing account solely because the Google token presents a matching email.
        if User.objects.filter(email=email).exists():
            return Response({
                "error": "An account with this email already exists. Please log in with your username and password, then link your Google account to enable Google Sign-In.",
                "code": "ACCOUNT_EXISTS_LINK_REQUIRED"
            }, status=status.HTTP_409_CONFLICT)

        # 3. New user: requires phone number before tenant creation
        temp_data = {
            'email': email,
            'name': name,
            'sub': sub,
            'timestamp': timezone.now().isoformat()
        }
        signer = signing.TimestampSigner(salt='google-onboarding')
        temp_token = signer.sign(json.dumps(temp_data))

        return Response({
            "status": "needs_profile",
            "temp_token": temp_token,
            "profile_name": name,
            "email": email
        }, status=status.HTTP_200_OK)


class GoogleCompleteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        temp_token = request.data.get('temp_token', '').strip()
        phone = request.data.get('phone', '').strip()
        workspace_name = request.data.get('workspace_name', '').strip()
        full_name = request.data.get('full_name', '').strip()

        if not temp_token or not phone:
            return Response(
                {"error": "temp_token and phone are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify signed token (max-age 15 minutes)
        signer = signing.TimestampSigner(salt='google-onboarding')
        try:
            raw_data = signer.unsign(temp_token, max_age=900)
            token_payload = json.loads(raw_data)
        except (signing.BadSignature, signing.SignatureExpired):
            return Response(
                {"error": "Onboarding session expired or invalid. Please sign in with Google again."},
                status=status.HTTP_400_BAD_REQUEST
            )

        sub = token_payload.get('sub', '').strip()
        email = token_payload.get('email', '').strip().lower()
        name = full_name or token_payload.get('name', '').strip()

        # Idempotency / Duplicate request check (Requirement 7)
        if sub:
            existing_identity = GoogleIdentity.objects.filter(google_sub=sub).select_related('user').first()
            if existing_identity:
                user = existing_identity.user
                token, _ = Token.objects.get_or_create(user=user)
                tenant = getattr(user, 'owned_tenant', None)
                return Response({
                    "token": token.key,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                    },
                    "tenant": {
                        "id": str(tenant.id),
                        "name": tenant.name,
                    } if tenant else None
                }, status=status.HTTP_200_OK)

        if User.objects.filter(email=email).exists():
            user = User.objects.get(email=email)
            if sub:
                GoogleIdentity.objects.get_or_create(
                    user=user,
                    defaults={'google_sub': sub, 'email': email}
                )
            token, _ = Token.objects.get_or_create(user=user)
            tenant = getattr(user, 'owned_tenant', None)
            return Response({
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                },
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                } if tenant else None
            }, status=status.HTTP_200_OK)

        base_username = email.split('@')[0]
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{suffix}"
            suffix += 1

        if not workspace_name:
            workspace_name = f"{name or username}'s Workspace"

        with transaction.atomic():
            first_name = name[:30] if name else ''
            last_name = name[30:150] if len(name) > 30 else ''
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            # Unusable password for OAuth-only users until password reset is configured
            user.set_unusable_password()
            user.save()

            tenant = Tenant.objects.create(name=workspace_name, owner=user)
            token = Token.objects.create(user=user)
            if sub:
                GoogleIdentity.objects.create(user=user, google_sub=sub, email=email)

        return Response({
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
            },
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
            }
        }, status=status.HTTP_201_CREATED)


class GoogleLinkView(APIView):
    """
    Securely links a Google identity to an existing authenticated user.
    Protects against account takeover while preserving the user's existing tenant workspace.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        id_token = request.data.get('id_token', '').strip()
        if not id_token:
            return Response(
                {"error": "id_token is required to link Google identity."},
                status=status.HTTP_400_BAD_REQUEST
            )

        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return Response(
                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            payload = verify_google_id_token(id_token, google_client_id)
        except ValueError as e:
            err_msg = str(e)
            if "not configured" in err_msg:
                return Response({"error": err_msg}, status=status.HTTP_501_NOT_IMPLEMENTED)
            return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        sub = payload['sub']
        email = payload.get('email', '').strip().lower()

        # Check if this Google sub is already linked to another user
        existing = GoogleIdentity.objects.filter(google_sub=sub).first()
        if existing:
            if existing.user_id != request.user.id:
                return Response(
                    {"error": "This Google account is already linked to another user."},
                    status=status.HTTP_409_CONFLICT
                )
            return Response({
                "status": "already_linked",
                "message": "Google identity is already linked to this account.",
                "google_sub": sub,
                "email": email
            }, status=status.HTTP_200_OK)

        with transaction.atomic():
            identity, created = GoogleIdentity.objects.update_or_create(
                user=request.user,
                defaults={'google_sub': sub, 'email': email}
            )

        return Response({
            "status": "linked",
            "message": "Google identity linked successfully.",
            "google_sub": sub,
            "email": email
        }, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {"error": "Email address is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Zero-Knowledge Protection:
        # Always return identical neutral confirmation regardless of whether account exists.
        neutral_message = "If an account matches this email, password reset instructions will be sent."

        user = User.objects.filter(email=email).first()
        if user and user.is_active:
            signer = signing.TimestampSigner(salt='password-reset')
            reset_token = signer.sign(str(user.id))
            logger.info("Generated password reset token for user %s: %s", user.id, reset_token)

            # Check if email is configured
            email_host = getattr(settings, 'EMAIL_HOST', None) or os.environ.get('EMAIL_HOST')
            if email_host:
                try:
                    send_mail(
                        subject="CredKeep Password Reset",
                        message=f"Use this token to reset your CredKeep password: {reset_token}\nThis token expires in 15 minutes.",
                        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@credkeep.local'),
                        recipient_list=[email],
                        fail_silently=True
                    )
                except Exception as e:
                    logger.warning("Failed to send reset email: %s", e)

        return Response({"message": neutral_message}, status=status.HTTP_200_OK)


class DeviceRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request, 'tenant', None):
            return Response(
                {"error": "User does not have an active tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        push_token = request.data.get('push_token', '')
        device_id_str = request.data.get('device_id', None)

        if device_id_str:
            try:
                device_id = uuid.UUID(str(device_id_str))
                existing = Device.objects.filter(id=device_id).first()
                if existing and existing.tenant_id != request.tenant.id:
                    return Response(
                        {"error": "Device ID is registered to another tenant."},
                        status=status.HTTP_409_CONFLICT
                    )
                device, created = Device.objects.get_or_create(
                    id=device_id,
                    tenant=request.tenant,
                    defaults={'push_token': push_token, 'last_sync': timezone.now()}
                )
                if not created:
                    device.push_token = push_token
                    device.last_sync = timezone.now()
                    device.save(update_fields=['push_token', 'last_sync'])
            except (ValueError, TypeError):
                return Response(
                    {"error": "Invalid device_id format."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except IntegrityError:
                return Response(
                    {"error": "Device ID is registered to another tenant."},
                    status=status.HTTP_409_CONFLICT
                )
        else:
            device = Device.objects.create(
                tenant=request.tenant,
                push_token=push_token,
                last_sync=timezone.now()
            )

        return Response({
            "device_id": str(device.id),
            "push_token": device.push_token,
            "tenant_id": str(request.tenant.id)
        }, status=status.HTTP_200_OK)

exec
/bin/bash -lc "cat .agents/skills/graphify/references/query.md; cat src/core/auth/authService.ts src/core/auth/authStore.ts; cat backend/api/urls.py; rg -n 'GOOGLE|SyncOutbox|sync|initialize' backend/api/views_auth.py src/app/settings/security.tsx src/ui/PinLock.tsx src/app/_layout.tsx src/core/database/database.ts" in /mnt/f/personal projects/credkeep
 exited 2 in 97ms:
# graphify reference: query, path, explain

Load this when the user asks a question against an existing graph, or runs `/graphify path` or `/graphify explain`. The core's query stub points here for the full traversal flow. These flows use the `graphify query` CLI when it is available and fall back to an inline NetworkX traversal otherwise.

Two traversal modes - choose based on the question:

| Mode | Flag | Best for |
|------|------|----------|
| BFS (default) | _(none)_ | "What is X connected to?" - broad context, nearest neighbors first |
| DFS | `--dfs` | "How does X reach Y?" - trace a specific chain or dependency path |

First check the graph exists:
```bash
$(cat graphify-out/.graphify_python) -c "
from pathlib import Path
if not Path('graphify-out/graph.json').exists():
    print('ERROR: No graph found. Run /graphify <path> first to build the graph.')
    raise SystemExit(1)
"
```
If it fails, stop and tell the user to run `/graphify <path>` first.

### Step 0 — Constrained query expansion (REQUIRED before traversal)

graphify's `query` CLI matches nodes via case-folded substring + IDF — there is **no stemming, no synonyms, no cross-language match** inside the binary, and the inline fallback below matches the same way. If the user's question uses different language or different domain vocabulary than the graph's labels (user says "обработчик" / graph says "handler"; user says "authentication" / graph says "Guardian"), the literal matcher returns 0 hits and the answer collapses to noise.

Fix this **without inventing tokens** by expanding the query against the actual graph vocabulary first:

1. Extract the token vocabulary from node labels:
```bash
$(cat graphify-out/.graphify_python) -c "
import json, re
from pathlib import Path
data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
vocab = set()
for n in data['nodes']:
    for c in re.findall(r'[^\W\d_]+', n.get('label','') or '', re.UNICODE):
        parts = re.findall(r'[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+', c) or [c]
        for p in parts:
            t = p.lower()
            if 3 <= len(t) <= 30:
                vocab.add(t)
Path('graphify-out/.vocab.txt').write_text('\n'.join(sorted(vocab)), encoding='utf-8')
print(f'vocab: {len(vocab)} tokens')
"
```

2. Read `graphify-out/.vocab.txt`. Then for the user's question, select **up to 12 tokens from this exact list** that semantically match the query intent. Hard constraints:
   - You MUST pick only tokens present in the vocabulary file. Do NOT invent tokens.
   - If a query concept has no plausible token in the vocab, skip it — do not substitute a near-synonym from training memory.
   - If **no** vocab tokens match the query at all, output an empty list and tell the user the corpus has no relevant vocabulary for this question. Do not fabricate a search.
   - Translate cross-language: Russian "аутентификация" → look for `auth`, `credential`, `token`, `security` IFF present in vocab.
   - Morphology: "handlers" maps to `handler` IFF present; "todos" maps to `todo` IFF present.

3. Print the selection explicitly to the user before running the query, so the expansion is auditable:
```
Query expanded to (from graph vocab, N tokens): [token1, token2, ...]
```
If the list is empty, say so plainly and stop — do not proceed to traversal.

### Step 1 — Traversal

Build the **expanded query string** by joining the selected tokens with spaces. Use this string as `QUESTION` below — NOT the original user question. (The original question is preserved only for `save-result` at the end.)

Prefer the CLI when it is installed:
```bash
graphify query "QUESTION"
# or: graphify query "QUESTION" --dfs --budget 3000
```

If the CLI is unavailable, load `graphify-out/graph.json` and run the traversal inline:

1. Find the 1-3 nodes whose label best matches the expanded tokens.
2. Run the appropriate traversal from each starting node.
3. Read the subgraph - node labels, edge relations, confidence tags, source locations.
4. Answer using **only** what the graph contains. Quote `source_location` when citing a specific fact.
5. If the graph lacks enough information, say so - do not hallucinate edges.

```bash
$(cat graphify-out/.graphify_python) -c "
import sys, json
from networkx.readwrite import json_graph
import networkx as nx
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')

question = 'QUESTION'
mode = 'MODE'  # 'bfs' or 'dfs'
terms = [t.lower() for t in question.split() if len(t) >= 3]  # match the vocab threshold; keeps api/jwt/ios (#1392)

# Find best-matching start nodes
scored = []
for nid, ndata in G.nodes(data=True):
    label = ndata.get('label', '').lower()
    score = sum(1 for t in terms if t in label)
    if score > 0:
        scored.append((score, nid))
scored.sort(reverse=True)
start_nodes = [nid for _, nid in scored[:3]]

if not start_nodes:
    print('No matching nodes found for query terms:', terms)
    sys.exit(0)

subgraph_nodes = set()
subgraph_edges = []

if mode == 'dfs':
    # DFS: follow one path as deep as possible before backtracking.
    # Depth-limited to 6 to avoid traversing the whole graph.
    visited = set()
    stack = [(n, 0) for n in reversed(start_nodes)]
    while stack:
        node, depth = stack.pop()
        if node in visited or depth > 6:
            continue
        visited.add(node)
        subgraph_nodes.add(node)
        for neighbor in G.neighbors(node):
            if neighbor not in visited:
                stack.append((neighbor, depth + 1))
                subgraph_edges.append((node, neighbor))
else:
    # BFS: explore all neighbors layer by layer up to depth 3.
    frontier = set(start_nodes)
    subgraph_nodes = set(start_nodes)
    for _ in range(3):
        next_frontier = set()
        for n in frontier:
            for neighbor in G.neighbors(n):
                if neighbor not in subgraph_nodes:
                    next_frontier.add(neighbor)
                    subgraph_edges.append((n, neighbor))
        subgraph_nodes.update(next_frontier)
        frontier = next_frontier

# Token-budget aware output: rank by relevance, cut at budget (~4 chars/token)
token_budget = BUDGET  # default 2000
char_budget = token_budget * 4

# Score each node by term overlap for ranked output
def relevance(nid):
    label = G.nodes[nid].get('label', '').lower()
    return sum(1 for t in terms if t in label)

ranked_nodes = sorted(subgraph_nodes, key=relevance, reverse=True)

lines = [f'Traversal: {mode.upper()} | Start: {[G.nodes[n].get(\"label\",n) for n in start_nodes]} | {len(subgraph_nodes)} nodes']
for nid in ranked_nodes:
    d = G.nodes[nid]
    lines.append(f'  NODE {d.get(\"label\", nid)} [src={d.get(\"source_file\",\"\")} loc={d.get(\"source_location\",\"\")}]')
for u, v in subgraph_edges:
    if u in subgraph_nodes and v in subgraph_nodes:
        _raw = G[u][v]; d = next(iter(_raw.values()), {}) if isinstance(G, nx.MultiGraph) else _raw
        lines.append(f'  EDGE {G.nodes[u].get(\"label\",u)} --{d.get(\"relation\",\"\")} [{d.get(\"confidence\",\"\")}]--> {G.nodes[v].get(\"label\",v)}')

output = '\n'.join(lines)
if len(output) > char_budget:
    output = output[:char_budget] + f'\n... (truncated at ~{token_budget} token budget - use --budget N for more)'
print(output)
"
```

Replace `QUESTION` with the **expanded** query string, `MODE` with `bfs` or `dfs`, and `BUDGET` with the token budget (default `2000`, or whatever `--budget N` specifies). Then answer based on the subgraph output above, using only what the graph contains.

After writing the answer, save it back into the graph so it improves future queries. Include the expanded tokens inside the `--answer` text (e.g. `"Expanded from original query via vocab: [tokens]. Then traversed..."`) so the next `--update` extracts the expansion history as a graph node:

```bash
$(cat graphify-out/.graphify_python) -m graphify save-result --question "ORIGINAL_QUESTION" --answer "ANSWER" --type query --nodes NODE1 NODE2
```

Replace `ORIGINAL_QUESTION` with the user's verbatim question, `ANSWER` with your full answer text (containing the expanded-token trace), `NODE1 NODE2` with the list of node labels you cited. This closes the feedback loop: the next `--update` will extract this Q&A as a node in the graph.

**Work memory (self-improving loop).** Add an `--outcome` so future sessions learn from this one — append `--outcome useful|dead_end|corrected` to the `save-result` command (and `--correction "the right answer"` when correcting):

- `useful` — the cited nodes answered the question well (they become *preferred sources*).
- `dead_end` — the question/path led nowhere; don't re-derive it next time.
- `corrected` — the saved answer was wrong; `--correction` records what was right.

At the **start** of graph work, refresh and read the lessons: run `graphify reflect --if-stale` (cheap, deterministic, no LLM; `--if-stale` makes it a no-op when `LESSONS.md` is already newer than every input, e.g. when the git hook just refreshed it), then read `graphify-out/reflections/LESSONS.md`. It lists **preferred sources** (start there), **known dead ends** (skip them), and prior **corrections**. Running `reflect` yourself keeps the lessons current even without the git hook installed; if the post-commit hook *is* installed, `--if-stale` means your session-start run costs almost nothing.

---

## For /graphify path

Find the shortest path between two named concepts in the graph. Prefer the CLI when installed:

```bash
graphify path "NODE_A" "NODE_B"
```

If the CLI is unavailable, run it inline:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, sys
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')

a_term = 'NODE_A'
b_term = 'NODE_B'

def find_node(term):
    term = term.lower()
    scored = sorted(
        [(sum(1 for w in term.split() if w in G.nodes[n].get('label','').lower()), n)
         for n in G.nodes()],
        reverse=True
    )
    return scored[0][1] if scored and scored[0][0] > 0 else None

src = find_node(a_term)
tgt = find_node(b_term)

if not src or not tgt:
    print(f'Could not find nodes matching: {a_term!r} or {b_term!r}')
    sys.exit(0)

try:
    path = nx.shortest_path(G, src, tgt)
    print(f'Shortest path ({len(path)-1} hops):')
    for i, nid in enumerate(path):
        label = G.nodes[nid].get('label', nid)
        if i < len(path) - 1:
            _raw = G[nid][path[i+1]]; edge = next(iter(_raw.values()), {}) if isinstance(G, nx.MultiGraph) else _raw
            rel = edge.get('relation', '')
            conf = edge.get('confidence', '')
            print(f'  {label} --{rel}--> [{conf}]')
        else:
            print(f'  {label}')
except nx.NetworkXNoPath:
    print(f'No path found between {a_term!r} and {b_term!r}')
except nx.NodeNotFound as e:
    print(f'Node not found: {e}')
"
```

Replace `NODE_A` and `NODE_B` with the actual concept names from the user. Then explain the path in plain language - what each hop means, why it's significant.

After writing the explanation, save it back:

```bash
$(cat graphify-out/.graphify_python) -m graphify save-result --question "Path from NODE_A to NODE_B" --answer "ANSWER" --type path_query --nodes NODE_A NODE_B
```

---

## For /graphify explain

Give a plain-language explanation of a single node - everything connected to it. Prefer the CLI when installed:

```bash
graphify explain "NODE_NAME"
```

If the CLI is unavailable, run it inline:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, sys
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')

term = 'NODE_NAME'
term_lower = term.lower()

# Find best matching node
scored = sorted(
    [(sum(1 for w in term_lower.split() if w in G.nodes[n].get('label','').lower()), n)
     for n in G.nodes()],
    reverse=True
)
if not scored or scored[0][0] == 0:
    print(f'No node matching {term!r}')
    sys.exit(0)

nid = scored[0][1]
data_n = G.nodes[nid]
print(f'NODE: {data_n.get(\"label\", nid)}')
print(f'  source: {data_n.get(\"source_file\",\"unknown\")}')
print(f'  type: {data_n.get(\"file_type\",\"unknown\")}')
print(f'  degree: {G.degree(nid)}')
print()
print('CONNECTIONS:')
for neighbor in G.neighbors(nid):
    _raw = G[nid][neighbor]; edge = next(iter(_raw.values()), {}) if isinstance(G, nx.MultiGraph) else _raw
    nlabel = G.nodes[neighbor].get('label', neighbor)
    rel = edge.get('relation', '')
    conf = edge.get('confidence', '')
    src_file = G.nodes[neighbor].get('source_file', '')
    print(f'  --{rel}--> {nlabel} [{conf}] ({src_file})')
"
```

Replace `NODE_NAME` with the concept the user asked about. Then write a 3-5 sentence explanation of what this node is, what it connects to, and why those connections are significant. Use the source locations as citations.

After writing the explanation, save it back:

```bash
$(cat graphify-out/.graphify_python) -m graphify save-result --question "Explain NODE_NAME" --answer "ANSWER" --type explain --nodes NODE_NAME
```
import { ApiClient } from '../api/client';
import { AuthStore, AuthSession } from './authStore';

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
  workspaceName?: string;
  email?: string;
}

export type GoogleAuthResponse =
  | { status: 'success'; session: AuthSession }
  | { status: 'needs_profile'; tempToken: string; profileName: string; email: string };

export interface GoogleCompleteParams {
  tempToken: string;
  phone: string;
  fullName?: string;
  workspaceName?: string;
}

export class AuthService {
  static async login(params: LoginParams): Promise<AuthSession> {
    const res = await ApiClient.post<AuthSession>(
      '/auth/login/',
      {
        username: params.username.trim(),
        password: params.password,
      },
      false
    );

    await AuthStore.setAuth(res);

    // Automatically register device
    try {
      await this.registerDevice();
    } catch {
      // Non-fatal device registration failure
    }

    return res;
  }

  static async register(params: RegisterParams): Promise<AuthSession> {
    const res = await ApiClient.post<AuthSession>(
      '/auth/register/',
      {
        username: params.username.trim(),
        password: params.password,
        full_name: params.fullName?.trim() || undefined,
        phone: params.phone?.trim() || undefined,
        workspace_name: params.workspaceName?.trim() || undefined,
        email: params.email?.trim() || undefined,
      },
      false
    );

    await AuthStore.setAuth(res);

    try {
      await this.registerDevice();
    } catch {
      // Non-fatal
    }

    return res;
  }

  static async loginWithGoogle(idToken: string): Promise<GoogleAuthResponse> {
    const res = await ApiClient.post<any>(
      '/auth/google/',
      {
        id_token: idToken,
      },
      false
    );

    if (res.status === 'needs_profile') {
      return {
        status: 'needs_profile',
        tempToken: res.temp_token,
        profileName: res.profile_name || '',
        email: res.email || '',
      };
    }

    const session: AuthSession = {
      token: res.token,
      user: res.user,
      tenant: res.tenant,
    };

    await AuthStore.setAuth(session);

    try {
      await this.registerDevice();
    } catch {
      // Non-fatal
    }

    return {
      status: 'success',
      session,
    };
  }

  static async completeGoogleOnboarding(params: GoogleCompleteParams): Promise<AuthSession> {
    const res = await ApiClient.post<AuthSession>(
      '/auth/google/complete/',
      {
        temp_token: params.tempToken,
        phone: params.phone.trim(),
        full_name: params.fullName?.trim() || undefined,
        workspace_name: params.workspaceName?.trim() || undefined,
      },
      false
    );

    await AuthStore.setAuth(res);

    try {
      await this.registerDevice();
    } catch {
      // Non-fatal
    }

    return res;
  }

  static async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await ApiClient.post<{ message: string }>(
      '/auth/password-reset/',
      {
        email: email.trim(),
      },
      false
    );
    return res;
  }

  static async registerDevice(pushToken: string = ''): Promise<void> {
    const deviceId = await AuthStore.getDeviceId();
    await ApiClient.post('/auth/device/', {
      device_id: deviceId,
      push_token: pushToken,
    });
  }

  static async linkGoogleAccount(idToken: string): Promise<{ status: string; message: string; google_sub: string; email: string }> {
    const res = await ApiClient.post<{ status: string; message: string; google_sub: string; email: string }>(
      '/auth/google/link/',
      { id_token: idToken },
      true
    );
    if (res.email) {
      await AuthStore.setGoogleLinkedEmail(res.email);
    }
    return res;
  }

  static async logout(): Promise<void> {
    await AuthStore.clearAuth();
  }
}

import * as SecureStore from 'expo-secure-store';
import * as crypto from 'expo-crypto';

const KEY_AUTH_TOKEN = 'credkeep_auth_token';
const KEY_TENANT_ID = 'credkeep_tenant_id';
const KEY_TENANT_NAME = 'credkeep_tenant_name';
const KEY_USER_INFO = 'credkeep_user_info';
const KEY_DEVICE_ID = 'credkeep_device_id';
const KEY_GOOGLE_LINKED_EMAIL = 'credkeep_google_linked_email';

export interface UserInfo {
  id: number;
  username: string;
}

export interface TenantInfo {
  id: string;
  name: string;
}

export interface AuthSession {
  token: string;
  user: UserInfo;
  tenant: TenantInfo | null;
}

export type AuthChangeListener = (tenantId: string | null) => void;

export class AuthStore {
  static async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_AUTH_TOKEN);
    } catch {
      return null;
    }
  }

  static async getTenantId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_TENANT_ID);
    } catch {
      return null;
    }
  }

  static async getTenantName(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_TENANT_NAME);
    } catch {
      return null;
    }
  }

  static async getUserInfo(): Promise<UserInfo | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY_USER_INFO);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static async getDeviceId(): Promise<string> {
    const gen = () => {
      try {
        if (crypto && typeof crypto.randomUUID === 'function') {
          const id = crypto.randomUUID();
          if (id) return id;
        }
      } catch {}
      try {
        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
          const id = globalThis.crypto.randomUUID();
          if (id) return id;
        }
      } catch {}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    try {
      let deviceId = await SecureStore.getItemAsync(KEY_DEVICE_ID);
      if (!deviceId) {
        deviceId = gen();
        await SecureStore.setItemAsync(KEY_DEVICE_ID, deviceId);
      }
      return deviceId;
    } catch {
      return gen();
    }
  }

  private static listeners = new Set<AuthChangeListener>();

  static onAuthChange(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(tenantId: string | null): void {
    for (const listener of this.listeners) {
      try {
        listener(tenantId);
      } catch {
        // Ignore listener exceptions
      }
    }
  }

  static async setAuth(session: AuthSession): Promise<void> {
    await SecureStore.setItemAsync(KEY_AUTH_TOKEN, session.token);
    await SecureStore.setItemAsync(KEY_USER_INFO, JSON.stringify(session.user));
    if (session.tenant) {
      await SecureStore.setItemAsync(KEY_TENANT_ID, session.tenant.id);
      await SecureStore.setItemAsync(KEY_TENANT_NAME, session.tenant.name);
    }
    this.notifyListeners(session.tenant ? session.tenant.id : null);
  }

  static async clearAuth(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_AUTH_TOKEN);
      await SecureStore.deleteItemAsync(KEY_TENANT_ID);
      await SecureStore.deleteItemAsync(KEY_TENANT_NAME);
      await SecureStore.deleteItemAsync(KEY_USER_INFO);
      await SecureStore.deleteItemAsync(KEY_GOOGLE_LINKED_EMAIL);
    } catch {
      // Ignore clear errors on missing keys
    }
    this.notifyListeners(null);
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return Boolean(token && token.trim().length > 0);
  }

  static async getGoogleLinkedEmail(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_GOOGLE_LINKED_EMAIL);
    } catch {
      return null;
    }
  }

  static async setGoogleLinkedEmail(email: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY_GOOGLE_LINKED_EMAIL, email);
    } catch {
      // Non-fatal
    }
  }
}

from django.urls import path
from .views import HealthCheckView, ReadinessCheckView
from .views_auth import (
    RegisterView,
    LoginView,
    DeviceRegisterView,
    GoogleAuthView,
    GoogleCompleteView,
    GoogleLinkView,
    PasswordResetRequestView,
)
from .views_sync import SyncPushView, SyncPullView, PortfolioSummaryView
from tenants.views import DeviceListView

urlpatterns = [
    # Health checks
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('ready/', ReadinessCheckView.as_view(), name='readiness-check'),

    # Authentication
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth-google'),
    path('auth/google/complete/', GoogleCompleteView.as_view(), name='auth-google-complete'),
    path('auth/google/link/', GoogleLinkView.as_view(), name='auth-google-link'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('auth/device/', DeviceRegisterView.as_view(), name='auth-device'),

    # Sync endpoints
    path('sync/push/', SyncPushView.as_view(), name='sync-push'),
    path('sync/pull/', SyncPullView.as_view(), name='sync-pull'),
    path('sync/portfolio/', PortfolioSummaryView.as_view(), name='portfolio-summary'),
    path('portfolio/summary/', PortfolioSummaryView.as_view(), name='portfolio-summary-alt'),

    # Tenancy / legacy devices
    path('devices/', DeviceListView.as_view(), name='device-list'),
]

rg: src/core/database/database.ts: No such file or directory (os error 2)
src/ui/PinLock.tsx:48:  const promptBiometricsIfEligible = async () => {
src/ui/PinLock.tsx:52:      const hasHardware = await LocalAuthentication.hasHardwareAsync();
src/ui/PinLock.tsx:53:      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
src/ui/PinLock.tsx:55:        const auth = await LocalAuthentication.authenticateAsync({
src/ui/PinLock.tsx:73:  const checkPinSetup = async () => {
src/ui/PinLock.tsx:78:      const pin = await SecureStore.getItemAsync(PIN_KEY);
src/ui/PinLock.tsx:79:      const bio = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:179:  const setPin = async (pin: string) => {
src/ui/PinLock.tsx:180:    await SecureStore.setItemAsync(PIN_KEY, pin);
src/ui/PinLock.tsx:185:  const removePin = async () => {
src/ui/PinLock.tsx:186:    await SecureStore.deleteItemAsync(PIN_KEY);
src/ui/PinLock.tsx:187:    await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
src/ui/PinLock.tsx:194:  const setBioEnabled = async (enabled: boolean) => {
src/ui/PinLock.tsx:195:    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
src/ui/PinLock.tsx:206:  const handleRetryBio = async () => {
src/app/_layout.tsx:19:    async function checkAuth() {
backend/api/views_auth.py:31:        raise ValueError("Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment.")
backend/api/views_auth.py:160:        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
backend/api/views_auth.py:163:                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
backend/api/views_auth.py:351:        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
backend/api/views_auth.py:354:                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
backend/api/views_auth.py:462:                    defaults={'push_token': push_token, 'last_sync': timezone.now()}
backend/api/views_auth.py:466:                    device.last_sync = timezone.now()
backend/api/views_auth.py:467:                    device.save(update_fields=['push_token', 'last_sync'])
backend/api/views_auth.py:482:                last_sync=timezone.now()
src/app/settings/security.tsx:31:  const handleConnectGoogle = async () => {
src/app/settings/security.tsx:64:  const handleToggleBio = async (val: boolean) => {
src/app/settings/security.tsx:107:  const handleRemovePin = async () => {
src/app/settings/security.tsx:113:        { text: 'Remove', style: 'destructive', onPress: async () => {

codex
The PinLock timeout appears to introduce a security regression: it removes the startup overlay after 3.5 seconds even if secure storage has not returned the saved PIN. I’m checking the resulting screen access, alongside the OAuth endpoint contract and outbox behavior.

exec
/bin/bash -lc "rg -n 'outbox|clear|delete|tenant|onAuthChange' src/core/sync/syncService.ts; rg --files -g '*lock*' -g '*google*test*' -g '*auth*test*' -g '*PinLock*' -g '*google*' src backend/api; ls node_modules/.bin/tsc node_modules/.bin/eslint; cat graphify-out/.graphify_python" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc "sed -n '1,60p' backend/api/views_auth.py; sed -n '145,245p' backend/api/views_auth.py; sed -n '330,425p' backend/api/views_auth.py; cat src/app/_layout.tsx; sed -n '1,85p' src/app/settings/security.tsx; cat src/core/api/client.ts" in /mnt/f/personal projects/credkeep
 succeeded in 0ms:
import os
import uuid
import json
import urllib.request
import urllib.error
import logging
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from tenants.models import Tenant, Device, GoogleIdentity

logger = logging.getLogger(__name__)


def verify_google_id_token(id_token: str, google_client_id: str) -> dict:
    """
    Verifies a Google ID token against Google's public tokeninfo service.
    Validates audience, expiration, and email_verified.
    Raises ValueError with client-safe message if verification fails.
    """
    if not google_client_id:
        raise ValueError("Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment.")

    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CredKeep-Backend'})
        with urllib.request.urlopen(req, timeout=5) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        logger.warning("Google tokeninfo HTTP error: %s", e)
        raise ValueError("Invalid or expired Google identity token.")
    except Exception as e:
        logger.warning("Failed to verify Google token: %s", e)
        raise ValueError("Failed to verify Google identity token.")

    aud = payload.get('aud')
    if aud != google_client_id:
        raise ValueError("Token audience does not match configured Google client ID.")

    if not payload.get('email_verified', False):
        raise ValueError("Google account email is not verified.")

    if not payload.get('sub'):
        raise ValueError("Google identity token missing subject (sub) claim.")

    return payload


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []
        }, status=status.HTTP_200_OK)


class GoogleAuthView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        id_token = request.data.get('id_token', '').strip()
        if not id_token:
            return Response(
                {"error": "id_token is required for Google authentication."},
                status=status.HTTP_400_BAD_REQUEST
            )

        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return Response(
                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            payload = verify_google_id_token(id_token, google_client_id)
        except ValueError as e:
            err_msg = str(e)
            if "not configured" in err_msg:
                return Response({"error": err_msg}, status=status.HTTP_501_NOT_IMPLEMENTED)
            return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        sub = payload['sub']
        email = payload.get('email', '').strip().lower()
        name = payload.get('name', '').strip()

        # 1. Lookup by immutable Google sub identifier
        identity = GoogleIdentity.objects.filter(google_sub=sub).select_related('user').first()
        if identity:
            user = identity.user
            token, _ = Token.objects.get_or_create(user=user)
            tenant = getattr(user, 'owned_tenant', None)
            return Response({
                "status": "success",
                "token": token.key,
                "user": {
                    "id": user.id,
                    "username": user.username,
                },
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                } if tenant else None
            }, status=status.HTTP_200_OK)

        # 2. Account Takeover Protection (Requirement 9):
        # Prevent logging into an existing account solely because the Google token presents a matching email.
        if User.objects.filter(email=email).exists():
            return Response({
                "error": "An account with this email already exists. Please log in with your username and password, then link your Google account to enable Google Sign-In.",
                "code": "ACCOUNT_EXISTS_LINK_REQUIRED"
            }, status=status.HTTP_409_CONFLICT)

        # 3. New user: requires phone number before tenant creation
        temp_data = {
            'email': email,
            'name': name,
            'sub': sub,
            'timestamp': timezone.now().isoformat()
        }
        signer = signing.TimestampSigner(salt='google-onboarding')
        temp_token = signer.sign(json.dumps(temp_data))

        return Response({
            "status": "needs_profile",
            "temp_token": temp_token,
            "profile_name": name,
            "email": email
        }, status=status.HTTP_200_OK)


class GoogleCompleteView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        temp_token = request.data.get('temp_token', '').strip()
        phone = request.data.get('phone', '').strip()
        workspace_name = request.data.get('workspace_name', '').strip()
        full_name = request.data.get('full_name', '').strip()

        if not temp_token or not phone:
            return Response(
                {"error": "temp_token and phone are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify signed token (max-age 15 minutes)
        signer = signing.TimestampSigner(salt='google-onboarding')
        try:
            raw_data = signer.unsign(temp_token, max_age=900)
            token_payload = json.loads(raw_data)
        except (signing.BadSignature, signing.SignatureExpired):
                "id": str(tenant.id),
                "name": tenant.name,
            }
        }, status=status.HTTP_201_CREATED)


class GoogleLinkView(APIView):
    """
    Securely links a Google identity to an existing authenticated user.
    Protects against account takeover while preserving the user's existing tenant workspace.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        id_token = request.data.get('id_token', '').strip()
        if not id_token:
            return Response(
                {"error": "id_token is required to link Google identity."},
                status=status.HTTP_400_BAD_REQUEST
            )

        google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return Response(
                {"error": "Google OAuth is not configured on the backend. Please configure GOOGLE_CLIENT_ID in backend environment."},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            payload = verify_google_id_token(id_token, google_client_id)
        except ValueError as e:
            err_msg = str(e)
            if "not configured" in err_msg:
                return Response({"error": err_msg}, status=status.HTTP_501_NOT_IMPLEMENTED)
            return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

        sub = payload['sub']
        email = payload.get('email', '').strip().lower()

        # Check if this Google sub is already linked to another user
        existing = GoogleIdentity.objects.filter(google_sub=sub).first()
        if existing:
            if existing.user_id != request.user.id:
                return Response(
                    {"error": "This Google account is already linked to another user."},
                    status=status.HTTP_409_CONFLICT
                )
            return Response({
                "status": "already_linked",
                "message": "Google identity is already linked to this account.",
                "google_sub": sub,
                "email": email
            }, status=status.HTTP_200_OK)

        with transaction.atomic():
            identity, created = GoogleIdentity.objects.update_or_create(
                user=request.user,
                defaults={'google_sub': sub, 'email': email}
            )

        return Response({
            "status": "linked",
            "message": "Google identity linked successfully.",
            "google_sub": sub,
            "email": email
        }, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {"error": "Email address is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Zero-Knowledge Protection:
        # Always return identical neutral confirmation regardless of whether account exists.
        neutral_message = "If an account matches this email, password reset instructions will be sent."

        user = User.objects.filter(email=email).first()
        if user and user.is_active:
            signer = signing.TimestampSigner(salt='password-reset')
            reset_token = signer.sign(str(user.id))
            logger.info("Generated password reset token for user %s: %s", user.id, reset_token)

            # Check if email is configured
            email_host = getattr(settings, 'EMAIL_HOST', None) or os.environ.get('EMAIL_HOST')
            if email_host:
                try:
                    send_mail(
                        subject="CredKeep Password Reset",
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '../core/database/DatabaseProvider';
import { PinLock } from '../ui/PinLock';
import { AuthStore } from '../core/auth/authStore';
import { theme } from '../ui/theme';

function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('[LIFECYCLE] APP_START: RootLayout mounted');
    console.log('[LIFECYCLE] AUTH_HYDRATING: Checking authentication session');

    async function checkAuth() {
      const auth = await AuthStore.isAuthenticated();
      console.log(`[LIFECYCLE] ${auth ? 'AUTHENTICATED' : 'UNAUTHENTICATED'}: session checked`);
      setIsAuthenticated(auth);
    }
    checkAuth();

    const unsubscribe = AuthStore.onAuthChange((tenantId) => {
      console.log(`[LIFECYCLE] AUTH_CHANGED: tenantId=${tenantId}`);
      setIsAuthenticated(Boolean(tenantId));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const inAuthGroup = segments[0] === 'auth';
    const segList = segments as string[];
    const isWelcomeScreen = inAuthGroup && (!segList[1] || segList[1] === 'index');

    if (!isAuthenticated && !inAuthGroup) {
      // Unauthenticated cold start or logged out: Gate immediately to Welcome/Auth
      router.replace('/auth');
    } else if (isAuthenticated && isWelcomeScreen) {
      // Authenticated session landing on Welcome screen: forward to dashboard
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, router]);

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="borrower/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reports/index" options={{ headerShown: false }} />
      <Stack.Screen name="settings/security" options={{ headerShown: false }} />
      <Stack.Screen name="settings/backup" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <PinLock>
          <RootNavigator />
        </PinLock>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Switch, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, ArrowLeft } from 'lucide-react-native';
import { Typography } from '../../ui/Typography';
import { theme } from '../../ui/theme';
import { Button } from '../../ui/Button';
import { useSecurity } from '../../ui/PinLock';
import { Keypad } from '../../ui/Keypad';
import { Card } from '../../ui/Card';
import { GoogleLogo } from '../../ui/GoogleSignInButton';
import { AuthStore } from '../../core/auth/authStore';
import { AuthService } from '../../core/auth/authService';
import { promptGoogleSignIn, signOutGoogle } from '../../core/auth/googleAuth';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { hasPin, bioEnabled, setPin, removePin, setBioEnabled } = useSecurity();
  const [pinEntry, setPinEntry] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = Enter, 2 = Confirm
  const [firstPin, setFirstPin] = useState('');
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState<string | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  useEffect(() => {
    AuthStore.getGoogleLinkedEmail().then(setLinkedGoogleEmail);
  }, []);

  const handleConnectGoogle = async () => {
    try {
      setIsLinkingGoogle(true);
      const promptResult = await promptGoogleSignIn();
      if (!promptResult.success) {
        if ('cancelled' in promptResult) {
          return;
        }
        Alert.alert('Google Sign-In', promptResult.error || 'Authentication cancelled.');
        return;
      }

      const linkRes = await AuthService.linkGoogleAccount(promptResult.idToken);
      setLinkedGoogleEmail(linkRes.email);
      Alert.alert(
        'Google Account Connected',
        `Successfully linked ${linkRes.email}. You can now sign in to your CredKeep workspace using Continue with Google.`
      );
    } catch (err: any) {
      try {
        await signOutGoogle();
      } catch {
        // Non-fatal
      }
      Alert.alert(
        'Unable to Link Account',
        err?.message || 'Failed to connect Google account. Please try again.'
      );
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleToggleBio = async (val: boolean) => {
    if (!hasPin) {
      Alert.alert('Error', 'Please set a PIN first.');
      return;
    }
    await setBioEnabled(val);
  };

  const handleKeyPress = (num: string) => {
    if (pinEntry.length < 4) {
      const newPin = pinEntry + num;
      setPinEntry(newPin);
      
      if (newPin.length === 4) {
        setTimeout(() => {
          if (step === 1) {
            setFirstPin(newPin);
            setPinEntry('');
            setStep(2);
          } else {
            if (newPin === firstPin) {
              setPin(newPin);
import { Platform } from 'react-native';
import { AuthStore } from '../auth/authStore';

export function resolveDefaultServerUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const trimmed = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    return trimmed.endsWith('/api/v2') ? trimmed : `${trimmed}/api/v2`;
  }

  // Development-only fallback for local testing (Android emulator loopback vs localhost)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v2' : 'http://localhost:8000/api/v2';
  }

  throw new Error(
    'EXPO_PUBLIC_API_URL environment variable is required in production and staging builds.'
  );
}

const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

export class ApiClient {
  private static baseUrl: string = DEFAULT_SERVER_URL;

  static setBaseUrl(url: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  static getBaseUrl(): string {
    return this.baseUrl;
  }

  static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (requireAuth) {
      const token = await AuthStore.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorMsg =
        (typeof data === 'object' && data !== null && (data.error || data.detail || JSON.stringify(data))) ||
        `HTTP request failed with status ${response.status}`;
      const error: any = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      if (typeof data === 'object' && data !== null && data.code) {
        error.code = data.code;
      }
      throw error;
    }

    return data as T;
  }

  static async get<T = any>(endpoint: string, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requireAuth);
  }

  static async post<T = any>(endpoint: string, body: any, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      requireAuth
    );
  }
}

exec
/bin/bash -lc "python3 - <<'PY'
import json
from collections import deque
with open('graphify-out/graph.json') as f: g=json.load(f)
nodes={n['id']:n for n in g['nodes']}
seeds=[k for k,n in nodes.items() if any(t in str(n.get('label','')).lower() for t in ['promptgooglesignin','pinlock','loginwithgoogle','syncoutbox'])]
adj={k:[] for k in nodes}
for e in g.get('links',g.get('edges',[])):
 if e['source'] in adj and e['target'] in adj:
  adj[e['source']].append(e['target']); adj[e['target']].append(e['source'])
seen=set(seeds); q=deque((s,0) for s in seeds)
while q and len(seen)<35:
 k,d=q.popleft(); n=nodes[k]
 print(n.get('label'),n.get('source_location',n.get('source_file','')))
 if d<1:
  for x in adj[k]:
   if x not in seen: seen.add(x); q.append((x,d+1))
PY" in /mnt/f/personal projects/credkeep
 exited 1 in 62ms:
5:import { OutboxManager, registerOutboxRevertHandler } from './outbox';
520:            const outboxRow = await tx.getFirstAsync<{ payload: string }>(
521:              `SELECT payload FROM sync_outbox WHERE operation_id = ?`,
524:            if (outboxRow?.payload) {
526:                const parsed = JSON.parse(outboxRow.payload);
660:      `SELECT operation_id, payload FROM sync_outbox WHERE status IN ('PENDING', 'NEEDS_REVIEW') AND operation_type = 'record_collection' ORDER BY created_at ASC`
691:             SELECT 1 FROM sync_outbox so
723:                 SELECT 1 FROM sync_outbox so
879:                 SELECT 1 FROM sync_outbox so
1050:           SELECT operation_id FROM sync_outbox WHERE status = 'REJECTED'
1071:               SELECT 1 FROM sync_outbox so
1220:             SELECT 1 FROM sync_outbox so
1260:             SELECT 1 FROM sync_outbox so
src/__tests__/auth-ui-components.test.tsx
src/ui/PinLock.tsx
src/core/auth/googleAuth.test.ts
src/core/auth/authStore.test.ts
src/core/auth/googleAuth.ts
src/app/auth/google-onboarding.tsx
node_modules/.bin/eslint
node_modules/.bin/tsc
cat: graphify-out/.graphify_python: No such file or directory

 succeeded in 143ms:
SyncOutboxAdmin L49
SyncOutbox L323
PinLock() L33

exec
/bin/bash -lc "cat src/core/auth/googleAuth.test.ts; sed -n '1,135p' src/core/database/DatabaseProvider.tsx; sed -n '1,140p' src/core/sync/SyncProvider.tsx; git diff --numstat feaeefa -- backend/api/views_auth.py; nl -ba src/ui/PinLock.tsx | sed -n '136,153p'; rg -n 'Google|audience|GOOGLE_CLIENT_ID' backend/api/test* .workflow/reports/OAuth_Audience_Fix_qa_prompt.txt" in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc './node_modules/.bin/eslint . --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc './node_modules/.bin/jest src/core/auth/googleAuth.test.ts src/core/auth/authStore.test.ts src/core/sync/syncService.test.ts --runInBand --no-cache' in /mnt/f/personal projects/credkeep
exec
/bin/bash -lc './node_modules/.bin/tsc --noEmit --incremental false' in /mnt/f/personal projects/credkeep
 succeeded in 220ms:
import { promptGoogleSignIn, signOutGoogle } from './googleAuth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    getTokens: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));

describe('Google Authentication Service', () => {
  const originalClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'test-web-client-id.apps.googleusercontent.com';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = originalClientId;
  });

  it('fails gracefully when EXPO_PUBLIC_GOOGLE_CLIENT_ID is unset', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'error' in res) {
      expect(res.error).toContain('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
    }
  });

  it('handles user cancellation via cancelled response type', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'cancelled',
      data: null,
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'cancelled' in res) {
      expect(res.cancelled).toBe(true);
    }
  });

  it('handles user cancellation via SIGN_IN_CANCELLED exception code', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.SIGN_IN_CANCELLED,
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'cancelled' in res) {
      expect(res.cancelled).toBe(true);
    }
  });

  it('handles PLAY_SERVICES_NOT_AVAILABLE error', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
      message: 'Play services not available',
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'error' in res) {
      expect(res.error).toContain('Google Play Services is not available');
    }
  });

  it('handles IN_PROGRESS error', async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({
      code: statusCodes.IN_PROGRESS,
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(false);
    if (!res.success && 'error' in res) {
      expect(res.error).toContain('already in progress');
    }
  });

  it('successfully returns idToken on valid sign-in', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {
        idToken: 'mock-google-id-token',
        user: {
          email: 'lender@example.com',
          name: 'CredKeep Lender',
        },
      },
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.idToken).toBe('mock-google-id-token');
      expect(res.email).toBe('lender@example.com');
      expect(res.name).toBe('CredKeep Lender');
    }
  });

  it('falls back to getTokens() if idToken is omitted in initial data payload', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {
        idToken: null,
        user: { email: 'fallback@example.com' },
      },
    });
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({
      idToken: 'fallback-fetched-token',
    });

    const res = await promptGoogleSignIn();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.idToken).toBe('fallback-fetched-token');
    }
  });

  it('calls GoogleSignin.signOut() without throwing', async () => {
    await expect(signOutGoogle()).resolves.toBeUndefined();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './db';
import { runMigrations } from './schema';
import { BorrowerRepository } from './borrowerRepository';
import { LoanRepository } from './loanRepository';
import { TransactionRepository } from './transactionRepository';
import { AuthStore } from '../auth/authStore';
import { SyncCoordinator } from '../sync/syncCoordinator';

export type DatabaseStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

type DatabaseContextType = {
  db: SQLiteDatabase | null;
  borrowers: BorrowerRepository | null;
  loans: LoanRepository | null;
  transactions: TransactionRepository | null;
  status: DatabaseStatus;
  error: Error | null;
  refreshVersion: number;
  triggerRefresh: () => void;
  switchTenant: (tenantId?: string | null) => Promise<void>;
  closeCurrentDatabase: () => Promise<void>;
  retryInitDatabase: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  borrowers: null,
  loans: null,
  transactions: null,
  status: 'IDLE',
  error: null,
  refreshVersion: 0,
  triggerRefresh: () => {},
  switchTenant: async () => {},
  closeCurrentDatabase: async () => {},
  retryInitDatabase: async () => {},
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const loadGenerationRef = useRef(0);

  const triggerRefresh = useCallback(() => {
    setRefreshVersion((v) => v + 1);
  }, []);

  const [state, setState] = useState<{
    db: SQLiteDatabase | null;
    borrowers: BorrowerRepository | null;
    loans: LoanRepository | null;
    transactions: TransactionRepository | null;
    status: DatabaseStatus;
    error: Error | null;
  }>({
    db: null,
    borrowers: null,
    loans: null,
    transactions: null,
    status: 'IDLE',
    error: null,
  });

  const closeCurrentDatabase = useCallback(async () => {
    loadGenerationRef.current++;
    SyncCoordinator.reset();
    setState((prev) => {
      if (prev.db && typeof (prev.db as any).closeAsync === 'function') {
        (prev.db as any).closeAsync().catch(() => {});
      }
      return {
        db: null,
        borrowers: null,
        loans: null,
        transactions: null,
        status: 'IDLE',
        error: null,
      };
    });
    setRefreshVersion((v) => v + 1);
  }, []);

  const loadDatabase = useCallback(async (tenantId?: string | null) => {
    const generation = ++loadGenerationRef.current;
    
    // Mark status LOADING before resolving tenant
    setState((prev) => ({ ...prev, status: 'LOADING', error: null }));

    const activeTenant = tenantId !== undefined ? tenantId : await AuthStore.getTenantId();

    if (generation !== loadGenerationRef.current) return;

    if (!activeTenant || activeTenant.trim().length === 0) {
      // Unauthenticated state: Do not open any database
      SyncCoordinator.reset();
      setState((prev) => {
        if (prev.db && typeof (prev.db as any).closeAsync === 'function') {
          (prev.db as any).closeAsync().catch(() => {});
        }
        return {
          db: null,
          borrowers: null,
          loans: null,
          transactions: null,
          status: 'IDLE',
          error: null,
        };
      });
      return;
    }

    console.log(`[LIFECYCLE] TENANT_RESOLVED: ${activeTenant}`);

    try {
      const db = await initDatabase(activeTenant);
      if (generation !== loadGenerationRef.current) {
        if (typeof (db as any).closeAsync === 'function') {
          (db as any).closeAsync().catch(() => {});
        }
        return;
      }

      await runMigrations(db);
      if (generation !== loadGenerationRef.current) {
        if (typeof (db as any).closeAsync === 'function') {
          (db as any).closeAsync().catch(() => {});
        }
        return;
      }

      const borrowerRepo = new BorrowerRepository(db);
      const loanRepo = new LoanRepository(db);
      const transactionRepo = new TransactionRepository(db);

sed: can't read src/core/sync/SyncProvider.tsx: No such file or directory
   136	
   137	    return () => subscription.remove();
   138	  }, [hasPin, bioEnabled]);
   139	
   140	  useEffect(() => {
   141	    // Fail-safe timeout ensures startup loading overlay never hangs indefinitely
   142	    const safetyTimer = setTimeout(() => {
   143	      setLoading(false);
   144	    }, 3500);
   145	
   146	    // eslint-disable-next-line react-hooks/set-state-in-effect
   147	    checkPinSetup().finally(() => {
   148	      clearTimeout(safetyTimer);
   149	    });
   150	
   151	    return () => clearTimeout(safetyTimer);
   152	    // eslint-disable-next-line react-hooks/exhaustive-deps
   153	  }, []);
.workflow/reports/OAuth_Audience_Fix_qa_prompt.txt:1:Perform focused, read-only QA review on CredKeep Google OAuth Audience and Startup Reliability Fix. Review the git diff against feaeefa and working changes in src/core/auth/googleAuth.ts, src/app/auth/login.tsx, src/app/settings/security.tsx, src/ui/PinLock.tsx, backend/api/views_auth.py. Scope: 1. Google OAuth audience mismatch and recovery behavior. 2. Auth endpoint compatibility. 3. Startup initialization in PinLock. 4. Sync outbox integrity. Return APPROVED if no blocking issues.
backend/api/tests_auth.py:10:from tenants.models import Tenant, GoogleIdentity
backend/api/tests_auth.py:13:class MockGoogleHTTPResponse:
backend/api/tests_auth.py:27:TEST_GOOGLE_CLIENT_ID = "387140373963-eolp5877u81mtm04vmkamtpoft2dvoog.apps.googleusercontent.com"
backend/api/tests_auth.py:68:        settings.GOOGLE_CLIENT_ID = ''
backend/api/tests_auth.py:69:        with patch.dict('os.environ', {'GOOGLE_CLIENT_ID': ''}):
backend/api/tests_auth.py:74:            assert 'Google OAuth is not configured' in res.data['error']
backend/api/tests_auth.py:77:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:79:            "aud": TEST_GOOGLE_CLIENT_ID,
backend/api/tests_auth.py:85:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
backend/api/tests_auth.py:96:    def test_google_auth_invalid_audience_rejected(self, settings):
backend/api/tests_auth.py:97:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:99:            "aud": "wrong-audience-client-id.apps.googleusercontent.com",
backend/api/tests_auth.py:104:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
backend/api/tests_auth.py:110:            assert 'Token audience does not match configured Google client ID.' in res.data['error']
backend/api/tests_auth.py:113:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:127:            assert 'Invalid or expired Google identity token.' in res.data['error']
backend/api/tests_auth.py:130:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:132:            "aud": TEST_GOOGLE_CLIENT_ID,
backend/api/tests_auth.py:137:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
backend/api/tests_auth.py:143:            assert 'Google account email is not verified.' in res.data['error']
backend/api/tests_auth.py:146:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:148:            "aud": TEST_GOOGLE_CLIENT_ID,
backend/api/tests_auth.py:152:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
backend/api/tests_auth.py:158:            assert 'Google identity token missing subject (sub) claim.' in res.data['error']
backend/api/tests_auth.py:182:        # Verify GoogleIdentity record exists with immutable sub
backend/api/tests_auth.py:183:        identity = GoogleIdentity.objects.get(user=user)
backend/api/tests_auth.py:197:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:207:        # Attacker / unlinked Google user tries to authenticate with matching email
backend/api/tests_auth.py:209:            "aud": TEST_GOOGLE_CLIENT_ID,
backend/api/tests_auth.py:215:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):
backend/api/tests_auth.py:223:            assert 'link your Google account' in res.data['error']
backend/api/tests_auth.py:226:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:237:        # 2. Bob links his Google account while authenticated
backend/api/tests_auth.py:239:            "aud": TEST_GOOGLE_CLIENT_ID,
backend/api/tests_auth.py:246:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(link_payload)):
backend/api/tests_auth.py:256:        identity = GoogleIdentity.objects.get(user=user)
backend/api/tests_auth.py:259:        # 3. Subsequent Google sign-in works immediately via immutable sub
backend/api/tests_auth.py:261:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(link_payload)):
backend/api/tests_auth.py:281:        settings.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID
backend/api/tests_auth.py:285:        GoogleIdentity.objects.create(user=user1, google_sub='google-sub-shared', email='user1@example.com')
backend/api/tests_auth.py:287:        # User 2 tries to link the same Google sub
backend/api/tests_auth.py:295:            "aud": TEST_GOOGLE_CLIENT_ID,
backend/api/tests_auth.py:300:        with patch('urllib.request.urlopen', return_value=MockGoogleHTTPResponse(mock_payload)):

 exited 1 in 4309ms:
Error: ENOENT: no such file or directory, mkdir '/tmp/jest_rs'
    at Object.mkdirSync (node:fs:1410:26)
    at createDirectory (/mnt/f/personal projects/credkeep/node_modules/jest-util/build/createDirectory.js:63:10)
    at /mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:250:39
    at Array.map (<anonymous>)
    at buildContextsAndHasteMaps (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:249:13)
    at _run10000 (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:327:47)
    at runCLI (/mnt/f/personal projects/credkeep/node_modules/@jest/core/build/cli/index.js:198:9)
    at async Object.run (/mnt/f/personal projects/credkeep/node_modules/jest-cli/build/run.js:130:37)

 succeeded in 15519ms:
codex
Confirmed one blocking issue: a slow or hanging SecureStore read lets the new timeout expose the app without a PIN check. Auth endpoint paths and payloads remain compatible, and the Google recovery handlers do not modify AuthStore or the sync outbox. The scoped diff does not change audience configuration, so I cannot verify that the deployment mismatch is resolved. TypeScript passed; Jest could not run because this read-only environment prevents creation of its temporary directory.

exec
/bin/bash -lc "ps -eo pid,etime,pcpu,args | rg 'eslint|tsc|jest'" in /mnt/f/personal projects/credkeep
 succeeded in 54ms:
      1       00:00 50.0 codex-linux-sandbox --sandbox-policy-cwd /mnt/f/personal projects/credkeep --command-cwd /mnt/f/personal projects/credkeep --permission-profile {"type":"managed","file_system":{"type":"restricted","entries":[{"path":{"type":"special","value":{"kind":"root"}},"access":"read"}]},"network":"restricted"} --apply-seccomp-then-exec -- /bin/bash -c __CODEX_SNAPSHOT_OVERRIDE_SET_0="${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS+x}" __CODEX_SNAPSHOT_OVERRIDE_0="${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS-}" __CODEX_SNAPSHOT_OVERRIDE_SET_1="${CODEX_PERMISSION_PROFILE+x}" __CODEX_SNAPSHOT_OVERRIDE_1="${CODEX_PERMISSION_PROFILE-}" __CODEX_SNAPSHOT_OVERRIDE_SET_2="${CODEX_PLUGIN_METRICS_OUTPUT+x}" __CODEX_SNAPSHOT_OVERRIDE_2="${CODEX_PLUGIN_METRICS_OUTPUT-}" __CODEX_SNAPSHOT_OVERRIDE_SET_3="${CODEX_SESSION_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_3="${CODEX_SESSION_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_4="${CODEX_THREAD_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_4="${CODEX_THREAD_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_5="${CODEX_TOOL_CALL_ID+x}" __CODEX_SNAPSHOT_OVERRIDE_5="${CODEX_TOOL_CALL_ID-}" __CODEX_SNAPSHOT_OVERRIDE_SET_6="${CODEX_VERSION+x}" __CODEX_SNAPSHOT_OVERRIDE_6="${CODEX_VERSION-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0="${ALL_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_0="${ALL_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1="${BUNDLE_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_1="${BUNDLE_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2="${BUNDLE_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_2="${BUNDLE_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3="${BUNDLE_NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_3="${BUNDLE_NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4="${BUNDLE_SSL_CA_CERT+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_4="${BUNDLE_SSL_CA_CERT-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5="${CARGO_HTTP_CAINFO+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_5="${CARGO_HTTP_CAINFO-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6="${CODEX_CA_CERTIFICATE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_6="${CODEX_CA_CERTIFICATE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7="${CODEX_NETWORK_ALLOW_LOCAL_BINDING+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_7="${CODEX_NETWORK_ALLOW_LOCAL_BINDING-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8="${CODEX_NETWORK_PROXY_ACTIVE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_8="${CODEX_NETWORK_PROXY_ACTIVE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9="${CODEX_NETWORK_PROXY_ATTRIBUTION+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_9="${CODEX_NETWORK_PROXY_ATTRIBUTION-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10="${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_10="${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11="${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_11="${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12="${CURL_CA_BUNDLE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_12="${CURL_CA_BUNDLE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13="${DOCKER_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_13="${DOCKER_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14="${DOCKER_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_14="${DOCKER_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15="${ELECTRON_GET_USE_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_15="${ELECTRON_GET_USE_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16="${FTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_16="${FTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17="${GIT_SSL_CAINFO+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_17="${GIT_SSL_CAINFO-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18="${HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_18="${HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19="${HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_19="${HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20="${NODE_EXTRA_CA_CERTS+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_20="${NODE_EXTRA_CA_CERTS-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21="${NODE_USE_ENV_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_21="${NODE_USE_ENV_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22="${NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_22="${NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23="${NPM_CONFIG_CAFILE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_23="${NPM_CONFIG_CAFILE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24="${NPM_CONFIG_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_24="${NPM_CONFIG_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25="${NPM_CONFIG_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_25="${NPM_CONFIG_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26="${NPM_CONFIG_NOPROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_26="${NPM_CONFIG_NOPROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27="${NPM_CONFIG_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_27="${NPM_CONFIG_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28="${PIP_CERT+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_28="${PIP_CERT-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29="${PIP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_29="${PIP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30="${REQUESTS_CA_BUNDLE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_30="${REQUESTS_CA_BUNDLE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31="${SSL_CERT_FILE+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_31="${SSL_CERT_FILE-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32="${WSS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_32="${WSS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33="${WS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_33="${WS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34="${YARN_HTTPS_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_34="${YARN_HTTPS_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35="${YARN_HTTP_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_35="${YARN_HTTP_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36="${YARN_NO_PROXY+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_36="${YARN_NO_PROXY-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37="${all_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_37="${all_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38="${ftp_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_38="${ftp_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39="${http_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_39="${http_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40="${https_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_40="${https_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41="${no_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_41="${no_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42="${npm_config_cafile+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_42="${npm_config_cafile-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43="${npm_config_http_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_43="${npm_config_http_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44="${npm_config_https_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_44="${npm_config_https_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45="${npm_config_noproxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_45="${npm_config_noproxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46="${npm_config_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_46="${npm_config_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47="${ws_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_47="${ws_proxy-}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48="${wss_proxy+x}" __CODEX_SNAPSHOT_PROXY_OVERRIDE_48="${wss_proxy-}" __CODEX_SNAPSHOT_PROXY_ENV_SET="${CODEX_NETWORK_PROXY_ACTIVE+x}"  if . '/home/sagar/.codex/shell_snapshots/01a15cca-2a5a-7440-b9bf-d06c3d2f26c5.1792558116975946755.sh' >/dev/null 2>&1; then :; fi  if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_0}" ]; then   if [ -z "${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS+x}" ] || [ "${CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS-}" != "${__CODEX_SNAPSHOT_OVERRIDE_0}" ]; then export CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS="${__CODEX_SNAPSHOT_OVERRIDE_0}"; else export CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS; fi else builtin unset CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS 2>/dev/null || command unset CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_0 __CODEX_SNAPSHOT_OVERRIDE_0 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_0 __CODEX_SNAPSHOT_OVERRIDE_0 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_1}" ]; then   if [ -z "${CODEX_PERMISSION_PROFILE+x}" ] || [ "${CODEX_PERMISSION_PROFILE-}" != "${__CODEX_SNAPSHOT_OVERRIDE_1}" ]; then export CODEX_PERMISSION_PROFILE="${__CODEX_SNAPSHOT_OVERRIDE_1}"; else export CODEX_PERMISSION_PROFILE; fi else builtin unset CODEX_PERMISSION_PROFILE 2>/dev/null || command unset CODEX_PERMISSION_PROFILE; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_1 __CODEX_SNAPSHOT_OVERRIDE_1 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_1 __CODEX_SNAPSHOT_OVERRIDE_1 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_2}" ]; then   if [ -z "${CODEX_PLUGIN_METRICS_OUTPUT+x}" ] || [ "${CODEX_PLUGIN_METRICS_OUTPUT-}" != "${__CODEX_SNAPSHOT_OVERRIDE_2}" ]; then export CODEX_PLUGIN_METRICS_OUTPUT="${__CODEX_SNAPSHOT_OVERRIDE_2}"; else export CODEX_PLUGIN_METRICS_OUTPUT; fi else builtin unset CODEX_PLUGIN_METRICS_OUTPUT 2>/dev/null || command unset CODEX_PLUGIN_METRICS_OUTPUT; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_2 __CODEX_SNAPSHOT_OVERRIDE_2 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_2 __CODEX_SNAPSHOT_OVERRIDE_2 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_3}" ]; then   if [ -z "${CODEX_SESSION_ID+x}" ] || [ "${CODEX_SESSION_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_3}" ]; then export CODEX_SESSION_ID="${__CODEX_SNAPSHOT_OVERRIDE_3}"; else export CODEX_SESSION_ID; fi else builtin unset CODEX_SESSION_ID 2>/dev/null || command unset CODEX_SESSION_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_3 __CODEX_SNAPSHOT_OVERRIDE_3 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_3 __CODEX_SNAPSHOT_OVERRIDE_3 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_4}" ]; then   if [ -z "${CODEX_THREAD_ID+x}" ] || [ "${CODEX_THREAD_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_4}" ]; then export CODEX_THREAD_ID="${__CODEX_SNAPSHOT_OVERRIDE_4}"; else export CODEX_THREAD_ID; fi else builtin unset CODEX_THREAD_ID 2>/dev/null || command unset CODEX_THREAD_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_4 __CODEX_SNAPSHOT_OVERRIDE_4 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_4 __CODEX_SNAPSHOT_OVERRIDE_4 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_5}" ]; then   if [ -z "${CODEX_TOOL_CALL_ID+x}" ] || [ "${CODEX_TOOL_CALL_ID-}" != "${__CODEX_SNAPSHOT_OVERRIDE_5}" ]; then export CODEX_TOOL_CALL_ID="${__CODEX_SNAPSHOT_OVERRIDE_5}"; else export CODEX_TOOL_CALL_ID; fi else builtin unset CODEX_TOOL_CALL_ID 2>/dev/null || command unset CODEX_TOOL_CALL_ID; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_5 __CODEX_SNAPSHOT_OVERRIDE_5 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_5 __CODEX_SNAPSHOT_OVERRIDE_5 if [ -n "${__CODEX_SNAPSHOT_OVERRIDE_SET_6}" ]; then   if [ -z "${CODEX_VERSION+x}" ] || [ "${CODEX_VERSION-}" != "${__CODEX_SNAPSHOT_OVERRIDE_6}" ]; then export CODEX_VERSION="${__CODEX_SNAPSHOT_OVERRIDE_6}"; else export CODEX_VERSION; fi else builtin unset CODEX_VERSION 2>/dev/null || command unset CODEX_VERSION; fi builtin unset __CODEX_SNAPSHOT_OVERRIDE_SET_6 __CODEX_SNAPSHOT_OVERRIDE_6 2>/dev/null || command unset __CODEX_SNAPSHOT_OVERRIDE_SET_6 __CODEX_SNAPSHOT_OVERRIDE_6 if [ -n "$__CODEX_SNAPSHOT_PROXY_ENV_SET" ] || [ -n "${CODEX_NETWORK_PROXY_ACTIVE+x}" ]; then if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0}" ]; then   if [ -z "${ALL_PROXY+x}" ] || [ "${ALL_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_0}" ]; then export ALL_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_0}"; else export ALL_PROXY; fi else builtin unset ALL_PROXY 2>/dev/null || command unset ALL_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0 __CODEX_SNAPSHOT_PROXY_OVERRIDE_0 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_0 __CODEX_SNAPSHOT_PROXY_OVERRIDE_0 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1}" ]; then   if [ -z "${BUNDLE_HTTPS_PROXY+x}" ] || [ "${BUNDLE_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_1}" ]; then export BUNDLE_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_1}"; else export BUNDLE_HTTPS_PROXY; fi else builtin unset BUNDLE_HTTPS_PROXY 2>/dev/null || command unset BUNDLE_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1 __CODEX_SNAPSHOT_PROXY_OVERRIDE_1 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_1 __CODEX_SNAPSHOT_PROXY_OVERRIDE_1 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2}" ]; then   if [ -z "${BUNDLE_HTTP_PROXY+x}" ] || [ "${BUNDLE_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_2}" ]; then export BUNDLE_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_2}"; else export BUNDLE_HTTP_PROXY; fi else builtin unset BUNDLE_HTTP_PROXY 2>/dev/null || command unset BUNDLE_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2 __CODEX_SNAPSHOT_PROXY_OVERRIDE_2 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_2 __CODEX_SNAPSHOT_PROXY_OVERRIDE_2 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3}" ]; then   if [ -z "${BUNDLE_NO_PROXY+x}" ] || [ "${BUNDLE_NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_3}" ]; then export BUNDLE_NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_3}"; else export BUNDLE_NO_PROXY; fi else builtin unset BUNDLE_NO_PROXY 2>/dev/null || command unset BUNDLE_NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3 __CODEX_SNAPSHOT_PROXY_OVERRIDE_3 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_3 __CODEX_SNAPSHOT_PROXY_OVERRIDE_3 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4}" ]; then   if [ -z "${BUNDLE_SSL_CA_CERT+x}" ] || [ "${BUNDLE_SSL_CA_CERT-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_4}" ]; then export BUNDLE_SSL_CA_CERT="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_4}"; else export BUNDLE_SSL_CA_CERT; fi else builtin unset BUNDLE_SSL_CA_CERT 2>/dev/null || command unset BUNDLE_SSL_CA_CERT; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4 __CODEX_SNAPSHOT_PROXY_OVERRIDE_4 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_4 __CODEX_SNAPSHOT_PROXY_OVERRIDE_4 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5}" ]; then   if [ -z "${CARGO_HTTP_CAINFO+x}" ] || [ "${CARGO_HTTP_CAINFO-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_5}" ]; then export CARGO_HTTP_CAINFO="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_5}"; else export CARGO_HTTP_CAINFO; fi else builtin unset CARGO_HTTP_CAINFO 2>/dev/null || command unset CARGO_HTTP_CAINFO; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5 __CODEX_SNAPSHOT_PROXY_OVERRIDE_5 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_5 __CODEX_SNAPSHOT_PROXY_OVERRIDE_5 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6}" ]; then   if [ -z "${CODEX_CA_CERTIFICATE+x}" ] || [ "${CODEX_CA_CERTIFICATE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_6}" ]; then export CODEX_CA_CERTIFICATE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_6}"; else export CODEX_CA_CERTIFICATE; fi else builtin unset CODEX_CA_CERTIFICATE 2>/dev/null || command unset CODEX_CA_CERTIFICATE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6 __CODEX_SNAPSHOT_PROXY_OVERRIDE_6 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_6 __CODEX_SNAPSHOT_PROXY_OVERRIDE_6 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7}" ]; then   if [ -z "${CODEX_NETWORK_ALLOW_LOCAL_BINDING+x}" ] || [ "${CODEX_NETWORK_ALLOW_LOCAL_BINDING-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_7}" ]; then export CODEX_NETWORK_ALLOW_LOCAL_BINDING="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_7}"; else export CODEX_NETWORK_ALLOW_LOCAL_BINDING; fi else builtin unset CODEX_NETWORK_ALLOW_LOCAL_BINDING 2>/dev/null || command unset CODEX_NETWORK_ALLOW_LOCAL_BINDING; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7 __CODEX_SNAPSHOT_PROXY_OVERRIDE_7 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_7 __CODEX_SNAPSHOT_PROXY_OVERRIDE_7 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_ACTIVE+x}" ] || [ "${CODEX_NETWORK_PROXY_ACTIVE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_8}" ]; then export CODEX_NETWORK_PROXY_ACTIVE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_8}"; else export CODEX_NETWORK_PROXY_ACTIVE; fi else builtin unset CODEX_NETWORK_PROXY_ACTIVE 2>/dev/null || command unset CODEX_NETWORK_PROXY_ACTIVE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8 __CODEX_SNAPSHOT_PROXY_OVERRIDE_8 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_8 __CODEX_SNAPSHOT_PROXY_OVERRIDE_8 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_ATTRIBUTION+x}" ] || [ "${CODEX_NETWORK_PROXY_ATTRIBUTION-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_9}" ]; then export CODEX_NETWORK_PROXY_ATTRIBUTION="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_9}"; else export CODEX_NETWORK_PROXY_ATTRIBUTION; fi else builtin unset CODEX_NETWORK_PROXY_ATTRIBUTION 2>/dev/null || command unset CODEX_NETWORK_PROXY_ATTRIBUTION; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9 __CODEX_SNAPSHOT_PROXY_OVERRIDE_9 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_9 __CODEX_SNAPSHOT_PROXY_OVERRIDE_9 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS+x}" ] || [ "${CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_10}" ]; then export CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_10}"; else export CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS; fi else builtin unset CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS 2>/dev/null || command unset CODEX_NETWORK_PROXY_BROKERED_CREDENTIALS; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10 __CODEX_SNAPSHOT_PROXY_OVERRIDE_10 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_10 __CODEX_SNAPSHOT_PROXY_OVERRIDE_10 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11}" ]; then   if [ -z "${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE+x}" ] || [ "${CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_11}" ]; then export CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_11}"; else export CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE; fi else builtin unset CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE 2>/dev/null || command unset CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11 __CODEX_SNAPSHOT_PROXY_OVERRIDE_11 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_11 __CODEX_SNAPSHOT_PROXY_OVERRIDE_11 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12}" ]; then   if [ -z "${CURL_CA_BUNDLE+x}" ] || [ "${CURL_CA_BUNDLE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_12}" ]; then export CURL_CA_BUNDLE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_12}"; else export CURL_CA_BUNDLE; fi else builtin unset CURL_CA_BUNDLE 2>/dev/null || command unset CURL_CA_BUNDLE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12 __CODEX_SNAPSHOT_PROXY_OVERRIDE_12 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_12 __CODEX_SNAPSHOT_PROXY_OVERRIDE_12 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13}" ]; then   if [ -z "${DOCKER_HTTPS_PROXY+x}" ] || [ "${DOCKER_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_13}" ]; then export DOCKER_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_13}"; else export DOCKER_HTTPS_PROXY; fi else builtin unset DOCKER_HTTPS_PROXY 2>/dev/null || command unset DOCKER_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13 __CODEX_SNAPSHOT_PROXY_OVERRIDE_13 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_13 __CODEX_SNAPSHOT_PROXY_OVERRIDE_13 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14}" ]; then   if [ -z "${DOCKER_HTTP_PROXY+x}" ] || [ "${DOCKER_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_14}" ]; then export DOCKER_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_14}"; else export DOCKER_HTTP_PROXY; fi else builtin unset DOCKER_HTTP_PROXY 2>/dev/null || command unset DOCKER_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14 __CODEX_SNAPSHOT_PROXY_OVERRIDE_14 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_14 __CODEX_SNAPSHOT_PROXY_OVERRIDE_14 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15}" ]; then   if [ -z "${ELECTRON_GET_USE_PROXY+x}" ] || [ "${ELECTRON_GET_USE_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_15}" ]; then export ELECTRON_GET_USE_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_15}"; else export ELECTRON_GET_USE_PROXY; fi else builtin unset ELECTRON_GET_USE_PROXY 2>/dev/null || command unset ELECTRON_GET_USE_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15 __CODEX_SNAPSHOT_PROXY_OVERRIDE_15 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_15 __CODEX_SNAPSHOT_PROXY_OVERRIDE_15 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16}" ]; then   if [ -z "${FTP_PROXY+x}" ] || [ "${FTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_16}" ]; then export FTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_16}"; else export FTP_PROXY; fi else builtin unset FTP_PROXY 2>/dev/null || command unset FTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16 __CODEX_SNAPSHOT_PROXY_OVERRIDE_16 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_16 __CODEX_SNAPSHOT_PROXY_OVERRIDE_16 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17}" ]; then   if [ -z "${GIT_SSL_CAINFO+x}" ] || [ "${GIT_SSL_CAINFO-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_17}" ]; then export GIT_SSL_CAINFO="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_17}"; else export GIT_SSL_CAINFO; fi else builtin unset GIT_SSL_CAINFO 2>/dev/null || command unset GIT_SSL_CAINFO; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17 __CODEX_SNAPSHOT_PROXY_OVERRIDE_17 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_17 __CODEX_SNAPSHOT_PROXY_OVERRIDE_17 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18}" ]; then   if [ -z "${HTTPS_PROXY+x}" ] || [ "${HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_18}" ]; then export HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_18}"; else export HTTPS_PROXY; fi else builtin unset HTTPS_PROXY 2>/dev/null || command unset HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18 __CODEX_SNAPSHOT_PROXY_OVERRIDE_18 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_18 __CODEX_SNAPSHOT_PROXY_OVERRIDE_18 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19}" ]; then   if [ -z "${HTTP_PROXY+x}" ] || [ "${HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_19}" ]; then export HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_19}"; else export HTTP_PROXY; fi else builtin unset HTTP_PROXY 2>/dev/null || command unset HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19 __CODEX_SNAPSHOT_PROXY_OVERRIDE_19 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_19 __CODEX_SNAPSHOT_PROXY_OVERRIDE_19 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20}" ]; then   if [ -z "${NODE_EXTRA_CA_CERTS+x}" ] || [ "${NODE_EXTRA_CA_CERTS-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_20}" ]; then export NODE_EXTRA_CA_CERTS="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_20}"; else export NODE_EXTRA_CA_CERTS; fi else builtin unset NODE_EXTRA_CA_CERTS 2>/dev/null || command unset NODE_EXTRA_CA_CERTS; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20 __CODEX_SNAPSHOT_PROXY_OVERRIDE_20 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_20 __CODEX_SNAPSHOT_PROXY_OVERRIDE_20 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21}" ]; then   if [ -z "${NODE_USE_ENV_PROXY+x}" ] || [ "${NODE_USE_ENV_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_21}" ]; then export NODE_USE_ENV_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_21}"; else export NODE_USE_ENV_PROXY; fi else builtin unset NODE_USE_ENV_PROXY 2>/dev/null || command unset NODE_USE_ENV_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21 __CODEX_SNAPSHOT_PROXY_OVERRIDE_21 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_21 __CODEX_SNAPSHOT_PROXY_OVERRIDE_21 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22}" ]; then   if [ -z "${NO_PROXY+x}" ] || [ "${NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_22}" ]; then export NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_22}"; else export NO_PROXY; fi else builtin unset NO_PROXY 2>/dev/null || command unset NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22 __CODEX_SNAPSHOT_PROXY_OVERRIDE_22 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_22 __CODEX_SNAPSHOT_PROXY_OVERRIDE_22 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23}" ]; then   if [ -z "${NPM_CONFIG_CAFILE+x}" ] || [ "${NPM_CONFIG_CAFILE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_23}" ]; then export NPM_CONFIG_CAFILE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_23}"; else export NPM_CONFIG_CAFILE; fi else builtin unset NPM_CONFIG_CAFILE 2>/dev/null || command unset NPM_CONFIG_CAFILE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23 __CODEX_SNAPSHOT_PROXY_OVERRIDE_23 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_23 __CODEX_SNAPSHOT_PROXY_OVERRIDE_23 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24}" ]; then   if [ -z "${NPM_CONFIG_HTTPS_PROXY+x}" ] || [ "${NPM_CONFIG_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_24}" ]; then export NPM_CONFIG_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_24}"; else export NPM_CONFIG_HTTPS_PROXY; fi else builtin unset NPM_CONFIG_HTTPS_PROXY 2>/dev/null || command unset NPM_CONFIG_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24 __CODEX_SNAPSHOT_PROXY_OVERRIDE_24 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_24 __CODEX_SNAPSHOT_PROXY_OVERRIDE_24 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25}" ]; then   if [ -z "${NPM_CONFIG_HTTP_PROXY+x}" ] || [ "${NPM_CONFIG_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_25}" ]; then export NPM_CONFIG_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_25}"; else export NPM_CONFIG_HTTP_PROXY; fi else builtin unset NPM_CONFIG_HTTP_PROXY 2>/dev/null || command unset NPM_CONFIG_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25 __CODEX_SNAPSHOT_PROXY_OVERRIDE_25 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_25 __CODEX_SNAPSHOT_PROXY_OVERRIDE_25 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26}" ]; then   if [ -z "${NPM_CONFIG_NOPROXY+x}" ] || [ "${NPM_CONFIG_NOPROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_26}" ]; then export NPM_CONFIG_NOPROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_26}"; else export NPM_CONFIG_NOPROXY; fi else builtin unset NPM_CONFIG_NOPROXY 2>/dev/null || command unset NPM_CONFIG_NOPROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26 __CODEX_SNAPSHOT_PROXY_OVERRIDE_26 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_26 __CODEX_SNAPSHOT_PROXY_OVERRIDE_26 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27}" ]; then   if [ -z "${NPM_CONFIG_PROXY+x}" ] || [ "${NPM_CONFIG_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_27}" ]; then export NPM_CONFIG_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_27}"; else export NPM_CONFIG_PROXY; fi else builtin unset NPM_CONFIG_PROXY 2>/dev/null || command unset NPM_CONFIG_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27 __CODEX_SNAPSHOT_PROXY_OVERRIDE_27 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_27 __CODEX_SNAPSHOT_PROXY_OVERRIDE_27 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28}" ]; then   if [ -z "${PIP_CERT+x}" ] || [ "${PIP_CERT-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_28}" ]; then export PIP_CERT="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_28}"; else export PIP_CERT; fi else builtin unset PIP_CERT 2>/dev/null || command unset PIP_CERT; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28 __CODEX_SNAPSHOT_PROXY_OVERRIDE_28 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_28 __CODEX_SNAPSHOT_PROXY_OVERRIDE_28 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29}" ]; then   if [ -z "${PIP_PROXY+x}" ] || [ "${PIP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_29}" ]; then export PIP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_29}"; else export PIP_PROXY; fi else builtin unset PIP_PROXY 2>/dev/null || command unset PIP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29 __CODEX_SNAPSHOT_PROXY_OVERRIDE_29 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_29 __CODEX_SNAPSHOT_PROXY_OVERRIDE_29 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30}" ]; then   if [ -z "${REQUESTS_CA_BUNDLE+x}" ] || [ "${REQUESTS_CA_BUNDLE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_30}" ]; then export REQUESTS_CA_BUNDLE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_30}"; else export REQUESTS_CA_BUNDLE; fi else builtin unset REQUESTS_CA_BUNDLE 2>/dev/null || command unset REQUESTS_CA_BUNDLE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30 __CODEX_SNAPSHOT_PROXY_OVERRIDE_30 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_30 __CODEX_SNAPSHOT_PROXY_OVERRIDE_30 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31}" ]; then   if [ -z "${SSL_CERT_FILE+x}" ] || [ "${SSL_CERT_FILE-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_31}" ]; then export SSL_CERT_FILE="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_31}"; else export SSL_CERT_FILE; fi else builtin unset SSL_CERT_FILE 2>/dev/null || command unset SSL_CERT_FILE; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31 __CODEX_SNAPSHOT_PROXY_OVERRIDE_31 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_31 __CODEX_SNAPSHOT_PROXY_OVERRIDE_31 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32}" ]; then   if [ -z "${WSS_PROXY+x}" ] || [ "${WSS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_32}" ]; then export WSS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_32}"; else export WSS_PROXY; fi else builtin unset WSS_PROXY 2>/dev/null || command unset WSS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32 __CODEX_SNAPSHOT_PROXY_OVERRIDE_32 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_32 __CODEX_SNAPSHOT_PROXY_OVERRIDE_32 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33}" ]; then   if [ -z "${WS_PROXY+x}" ] || [ "${WS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_33}" ]; then export WS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_33}"; else export WS_PROXY; fi else builtin unset WS_PROXY 2>/dev/null || command unset WS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33 __CODEX_SNAPSHOT_PROXY_OVERRIDE_33 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_33 __CODEX_SNAPSHOT_PROXY_OVERRIDE_33 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34}" ]; then   if [ -z "${YARN_HTTPS_PROXY+x}" ] || [ "${YARN_HTTPS_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_34}" ]; then export YARN_HTTPS_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_34}"; else export YARN_HTTPS_PROXY; fi else builtin unset YARN_HTTPS_PROXY 2>/dev/null || command unset YARN_HTTPS_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34 __CODEX_SNAPSHOT_PROXY_OVERRIDE_34 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_34 __CODEX_SNAPSHOT_PROXY_OVERRIDE_34 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35}" ]; then   if [ -z "${YARN_HTTP_PROXY+x}" ] || [ "${YARN_HTTP_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_35}" ]; then export YARN_HTTP_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_35}"; else export YARN_HTTP_PROXY; fi else builtin unset YARN_HTTP_PROXY 2>/dev/null || command unset YARN_HTTP_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35 __CODEX_SNAPSHOT_PROXY_OVERRIDE_35 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_35 __CODEX_SNAPSHOT_PROXY_OVERRIDE_35 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36}" ]; then   if [ -z "${YARN_NO_PROXY+x}" ] || [ "${YARN_NO_PROXY-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_36}" ]; then export YARN_NO_PROXY="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_36}"; else export YARN_NO_PROXY; fi else builtin unset YARN_NO_PROXY 2>/dev/null || command unset YARN_NO_PROXY; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36 __CODEX_SNAPSHOT_PROXY_OVERRIDE_36 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_36 __CODEX_SNAPSHOT_PROXY_OVERRIDE_36 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37}" ]; then   if [ -z "${all_proxy+x}" ] || [ "${all_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_37}" ]; then export all_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_37}"; else export all_proxy; fi else builtin unset all_proxy 2>/dev/null || command unset all_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37 __CODEX_SNAPSHOT_PROXY_OVERRIDE_37 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_37 __CODEX_SNAPSHOT_PROXY_OVERRIDE_37 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38}" ]; then   if [ -z "${ftp_proxy+x}" ] || [ "${ftp_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_38}" ]; then export ftp_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_38}"; else export ftp_proxy; fi else builtin unset ftp_proxy 2>/dev/null || command unset ftp_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38 __CODEX_SNAPSHOT_PROXY_OVERRIDE_38 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_38 __CODEX_SNAPSHOT_PROXY_OVERRIDE_38 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39}" ]; then   if [ -z "${http_proxy+x}" ] || [ "${http_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_39}" ]; then export http_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_39}"; else export http_proxy; fi else builtin unset http_proxy 2>/dev/null || command unset http_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39 __CODEX_SNAPSHOT_PROXY_OVERRIDE_39 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_39 __CODEX_SNAPSHOT_PROXY_OVERRIDE_39 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40}" ]; then   if [ -z "${https_proxy+x}" ] || [ "${https_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_40}" ]; then export https_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_40}"; else export https_proxy; fi else builtin unset https_proxy 2>/dev/null || command unset https_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40 __CODEX_SNAPSHOT_PROXY_OVERRIDE_40 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_40 __CODEX_SNAPSHOT_PROXY_OVERRIDE_40 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41}" ]; then   if [ -z "${no_proxy+x}" ] || [ "${no_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_41}" ]; then export no_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_41}"; else export no_proxy; fi else builtin unset no_proxy 2>/dev/null || command unset no_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41 __CODEX_SNAPSHOT_PROXY_OVERRIDE_41 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_41 __CODEX_SNAPSHOT_PROXY_OVERRIDE_41 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42}" ]; then   if [ -z "${npm_config_cafile+x}" ] || [ "${npm_config_cafile-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_42}" ]; then export npm_config_cafile="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_42}"; else export npm_config_cafile; fi else builtin unset npm_config_cafile 2>/dev/null || command unset npm_config_cafile; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42 __CODEX_SNAPSHOT_PROXY_OVERRIDE_42 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_42 __CODEX_SNAPSHOT_PROXY_OVERRIDE_42 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43}" ]; then   if [ -z "${npm_config_http_proxy+x}" ] || [ "${npm_config_http_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_43}" ]; then export npm_config_http_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_43}"; else export npm_config_http_proxy; fi else builtin unset npm_config_http_proxy 2>/dev/null || command unset npm_config_http_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43 __CODEX_SNAPSHOT_PROXY_OVERRIDE_43 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_43 __CODEX_SNAPSHOT_PROXY_OVERRIDE_43 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44}" ]; then   if [ -z "${npm_config_https_proxy+x}" ] || [ "${npm_config_https_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_44}" ]; then export npm_config_https_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_44}"; else export npm_config_https_proxy; fi else builtin unset npm_config_https_proxy 2>/dev/null || command unset npm_config_https_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44 __CODEX_SNAPSHOT_PROXY_OVERRIDE_44 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_44 __CODEX_SNAPSHOT_PROXY_OVERRIDE_44 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45}" ]; then   if [ -z "${npm_config_noproxy+x}" ] || [ "${npm_config_noproxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_45}" ]; then export npm_config_noproxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_45}"; else export npm_config_noproxy; fi else builtin unset npm_config_noproxy 2>/dev/null || command unset npm_config_noproxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45 __CODEX_SNAPSHOT_PROXY_OVERRIDE_45 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_45 __CODEX_SNAPSHOT_PROXY_OVERRIDE_45 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46}" ]; then   if [ -z "${npm_config_proxy+x}" ] || [ "${npm_config_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_46}" ]; then export npm_config_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_46}"; else export npm_config_proxy; fi else builtin unset npm_config_proxy 2>/dev/null || command unset npm_config_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46 __CODEX_SNAPSHOT_PROXY_OVERRIDE_46 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_46 __CODEX_SNAPSHOT_PROXY_OVERRIDE_46 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47}" ]; then   if [ -z "${ws_proxy+x}" ] || [ "${ws_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_47}" ]; then export ws_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_47}"; else export ws_proxy; fi else builtin unset ws_proxy 2>/dev/null || command unset ws_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47 __CODEX_SNAPSHOT_PROXY_OVERRIDE_47 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_47 __CODEX_SNAPSHOT_PROXY_OVERRIDE_47 if [ -n "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48}" ]; then   if [ -z "${wss_proxy+x}" ] || [ "${wss_proxy-}" != "${__CODEX_SNAPSHOT_PROXY_OVERRIDE_48}" ]; then export wss_proxy="${__CODEX_SNAPSHOT_PROXY_OVERRIDE_48}"; else export wss_proxy; fi else builtin unset wss_proxy 2>/dev/null || command unset wss_proxy; fi builtin unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48 __CODEX_SNAPSHOT_PROXY_OVERRIDE_48 2>/dev/null || command unset __CODEX_SNAPSHOT_PROXY_OVERRIDE_SET_48 __CODEX_SNAPSHOT_PROXY_OVERRIDE_48 fi if [ -n "${PATH:-}" ]; then export PATH='/home/sagar/.nvm/versions/node/v24.21.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex-path':"$PATH"; else export PATH='/home/sagar/.nvm/versions/node/v24.21.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/codex-path'; fi  exec '/bin/bash' -c 'ps -eo pid,etime,pcpu,args | rg '"'"'eslint|tsc|jest'"'"''
      2       00:00  0.0 /bin/bash -c ps -eo pid,etime,pcpu,args | rg 'eslint|tsc|jest'
      4       00:00  0.0 rg eslint|tsc|jest

 exited 130 in 68134ms:
codex
**NOT APPROVED — one blocking issue.**

**P1: Startup timeout bypasses PIN protection** — [PinLock.tsx:142](/mnt/f/personal%20projects/credkeep/src/ui/PinLock.tsx:142). `isLocked` starts as `false`. If either SecureStore read exceeds 3.5 seconds, the timer clears `loading`, exposing the mounted app and enabling interaction without PIN authentication. A hanging read leaves access open indefinitely. Keep access blocked on timeout and display a retry state.

Auth endpoints remain compatible; no outbox integrity regression was found in the scoped changes. Audience configuration is unchanged, so deployment alignment remains unverified.

Validation: TypeScript passed. Lint was interrupted without results; Jest was blocked by temporary-directory creation in the read-only environment.
tokens used
46,315
**NOT APPROVED — one blocking issue.**

**P1: Startup timeout bypasses PIN protection** — [PinLock.tsx:142](/mnt/f/personal%20projects/credkeep/src/ui/PinLock.tsx:142). `isLocked` starts as `false`. If either SecureStore read exceeds 3.5 seconds, the timer clears `loading`, exposing the mounted app and enabling interaction without PIN authentication. A hanging read leaves access open indefinitely. Keep access blocked on timeout and display a retry state.

Auth endpoints remain compatible; no outbox integrity regression was found in the scoped changes. Audience configuration is unchanged, so deployment alignment remains unverified.

Validation: TypeScript passed. Lint was interrupted without results; Jest was blocked by temporary-directory creation in the read-only environment.
