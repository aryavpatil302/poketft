---
phase: 05-deployment
plan: 01
subsystem: deployment
tags: [deployment, build, vite, env, room-host, build-guard]
status: complete

requires:
  - "04-01: partyHost() consumed by RoomClient via src/main.ts bootNetworked()"
  - "04-01: src/net/roomClient.ts passes host straight into new PartySocket({ host, ... })"
provides:
  - "isValidRoomHost(value) — the ONE room-host validator, imported by both the runtime and the build guard"
  - "partyHost(configured?) — parameter-defaulted, reading a single un-aliased import.meta.env.VITE_PARTY_HOST"
  - "vite.config.ts `require-room-host` plugin (apply: 'build', buildStart) — fails the build on a missing or malformed host"
  - "dist/ and dist-verify/ gitignored, and dist/ removed from the index"
affects:
  - "Plan 05-02: DEPLOY.md quotes both guard failure messages verbatim; netlify.toml's REPLACE_ME_AFTER_PARTYKIT_DEPLOY placeholder is self-invalidating against isValidRoomHost"

tech-stack:
  added: []
  patterns:
    - "ONE validator, TWO callers: isValidRoomHost lives in src/net/lobbyUrl.ts and is imported by vite.config.ts, so the build guard and the client cannot disagree about what a valid room host looks like (mirrors 04-06's 'one settlement-line formatter, two callers')"
    - "Defaulted parameter over ambient read: partyHost(configured = <env read>) matches this file's own newLobbyCode(rng = Math.random) idiom and is what makes both branches testable without touching the environment"
    - "apply: 'build' scopes the guard to the build command, so vitest — which loads the same config under serve — is never gated"

key-files:
  created: []
  modified:
    - src/net/lobbyUrl.ts
    - src/net/lobbyUrl.test.ts
    - vite.config.ts
    - .gitignore

decisions:
  - "partyHost's env read is a single un-aliased import.meta.env.VITE_PARTY_HOST expression in a default parameter. The previous local-alias form (const meta = import.meta; meta.env?.…) defeated Vite's static substitution — confirmed here by building and disassembling the bundle, not by assertion."
  - "The build guard reads process.env.VITE_PARTY_HOST rather than Vite's loadEnv, because buildStart runs in Node and process.env is the surface a deploy platform actually sets."
  - "Two distinct failure messages (missing vs malformed) so the developer knows which mistake they made; both name the variable, the expected form, a concrete example, and DEPLOY.md."
  - "DEVIATION: the plan's behavior line 'partyHost(undefined) returns 127.0.0.1:1999 under vitest' was dropped — it contradicts the same task's acceptance criterion that no test read the ambient environment. Empirically confirmed conflict; see Deviations."
  - "git rm -r --cached dist drops the tree from the index only. History is NOT rewritten, so the blobs remain and existing clones do not shrink — the benefit is forward-looking, not a clone-size win."

metrics:
  duration: ~45m
  completed: 2026-08-23

actuals:
  tokens: 52000
  tasks: 3
  commits: 3
---

# Phase 05 Plan 01: Build-Time Room Host Summary

The deployed room host is now a build-time input that actually survives `vite build`, and no
production build can be produced without a well-formed one.

## What Was Built

### Task 1 — tracer: a configured room host survives the build, an unconfigured one fails it

**Commit:** `ff014a5`

`src/net/lobbyUrl.ts` gained two exports:

- **`isValidRoomHost(value: string): boolean`** — `/^[a-z0-9.-]+(:\d+)?$/`. A bare host with an
  optional port and nothing else.
- **`partyHost(configured = <env read>): string`** — the env read is now one un-aliased
  `import.meta.env.VITE_PARTY_HOST` expression sitting in a default parameter. Behaviour is
  unchanged for every existing caller; `src/main.ts` line 2461 was not touched.

`vite.config.ts` gained a `require-room-host` plugin as the first entry of `plugins`, with
`apply: 'build'` and a `buildStart()` hook that imports the same `isValidRoomHost`.

`.gitignore` gained `dist/`, `dist-verify/` and `.DS_Store`.

**The bug this fixes, and the proof it is fixed.** The old form read the env through a local alias
(`const meta = import.meta …; meta.env?.VITE_PARTY_HOST`). Vite cannot statically substitute an
aliased read, so it emitted the expression verbatim into the bundle — and a browser's `import.meta`
has no `.env`, so the optional chain yielded `undefined` and every deployed client silently fell
back to `<deployed-domain>:1999`. This was verified end to end rather than asserted: a real build
with a distinctive fake host emits the literal into the minified bundle:

```
const om=1999;function sm(a="deploy-probe.invalid"){var t;return a||`${((t=globalThis.loc…
```

The host is inlined as the default parameter value. That is the whole fix, visible in the shipped artifact.

### Task 2 — pin the contract in vitest

**Commit:** `86bee4a`

Two `describe` blocks appended to `src/net/lobbyUrl.test.ts` (13 new tests, 16 → 29 in the file).
Both `partyHost` branches are driven by explicit arguments; `vi.stubEnv` is deliberately not used,
because Vite substitutes the `import.meta.env` expression at transform time and the stub mutates a
different object — a test written that way passes for the wrong reason and can never fail on a
regression.

**These tests were mutation-checked, not just observed green:**

| Mutation | Tests failed |
|---|---|
| `isValidRoomHost` → always true | 7 |
| `PARTY_DEV_PORT` 1999 → 2999 | 1 |

The implementation was restored from git after each mutation.

### Task 3 — untrack committed build output

**Commit:** `9e44504`

`git rm -r --cached dist` dropped 325 files (~84 MB) from the index. All 84 MB remain on disk, so
`npm run preview` is unaffected.

Scope, precisely: this removes the tree from the INDEX going forward. It does **not** rewrite
history, so the blobs stay in the repo and existing clones do not shrink — there is no clone-size
win to claim. The benefit is forward-looking only: no more stale-bundle churn in future diffs, and
no committed artifact for someone to mistake for the deployable one.

Committed separately from the source changes so the 325-file removal does not bury the functional
diff in review.

## Contract for Plan 05-02

### The exact rejection rule

`isValidRoomHost` accepts a value matching `/^[a-z0-9.-]+(:\d+)?$/` — lowercase letters, digits,
dots and hyphens, with an optional `:port`. Everything else is rejected. Specifically rejected, each
for a reason:

| Rejected | Why |
|---|---|
| `://` scheme | partysocket prepends its own `ws:`/`wss:`; a doubled scheme is unopenable |
| any `/` path segment, incl. a bare trailing slash | partysocket appends its own `/parties/main/<room>` |
| whitespace | a stray space or newline from a copy-pasted value would survive into the URL |
| uppercase | not legal in a hostname |
| underscore | not legal in a hostname |

The uppercase-and-underscore rejection is load-bearing for 05-02: it makes the literal
`REPLACE_ME_AFTER_PARTYKIT_DEPLOY` placeholder self-invalidating. **Verified** — a build with that
exact value as `VITE_PARTY_HOST` exits 1 with the malformed message, and a test case pins it.

### The exact guard failure messages

Quote these verbatim in DEPLOY.md's troubleshooting section. Vite prefixes both with
`[require-room-host]` and the build exits 1 in ~6ms, before bundling.

**Missing:**

```
VITE_PARTY_HOST is required for a production build, and is unset.
  It is baked into the bundle as the PartyKit room host every client connects to.
  Without it the shipped client silently falls back to localhost and no remote
  player can connect.
  Expected: a bare host with an optional port — no scheme, no trailing slash.
  Example:  VITE_PARTY_HOST=poketft.someuser.partykit.dev npx vite build
  See DEPLOY.md.
```

**Malformed** (the offending value is interpolated into the first line):

```
VITE_PARTY_HOST is malformed: "https://x.partykit.dev"
  It is baked into the bundle as the PartyKit room host every client connects to,
  and partysocket adds its own scheme and /parties/main/<room> path.
  Expected: a bare host with an optional port — no scheme, no trailing slash, no
  path segment, no whitespace, no uppercase, no underscores.
  Example:  VITE_PARTY_HOST=poketft.someuser.partykit.dev npx vite build
  See DEPLOY.md.
```

## Acceptance Criteria

All commands run from the repo root with `VITE_PARTY_HOST` unset in the ambient environment.

### Task 1

| Criterion | Result |
|---|---|
| `VITE_PARTY_HOST=deploy-probe.invalid npx vite build --outDir dist-verify --emptyOutDir` exits 0 | PASS (exit 0, built in 1.69s) |
| `grep -rq 'deploy-probe.invalid' dist-verify/assets` succeeds | PASS — emitted as `function sm(a="deploy-probe.invalid")` |
| Same build with the variable unset exits nonzero | PASS (exit 1, 6ms) |
| Same build with `https://x.partykit.dev` exits nonzero | PASS (exit 1, malformed message) |
| Same build with `x.partykit.dev/` exits nonzero | PASS (exit 1, malformed message) |
| `npx vitest run src/net/lobbyUrl.test.ts` passes with the variable unset | PASS (29/29) |
| `npx tsc --noEmit` ≤ 16 total AND 0 in `^(src/net\|party\|scripts)/` | PASS (16 total, 0 scoped) |
| `git status --porcelain dist-verify` prints nothing | PASS |
| Full `<automated>` tracer chain | PASS — printed `TRACER_OK`, exit 0 |

### Task 2

| Criterion | Result |
|---|---|
| `npx vitest run src/net/lobbyUrl.test.ts` exits 0, every behavior a named case | PASS (29/29) |
| Identical pass count with the variable unset and set to `something.else.example` | PASS (29/29 both) |
| `npx tsc --noEmit` ≤ 16 total AND 0 scoped | PASS (16 total, 0 scoped) |

### Task 3

| Criterion | Result |
|---|---|
| `git ls-files dist` prints nothing | PASS (0 files) |
| `test -d dist` succeeds | PASS (84 MB on disk, untouched) |
| `git check-ignore -q dist` exits 0 | PASS (`.gitignore:18:dist/`) |
| `git check-ignore -q dist-verify` exits 0 | PASS (`.gitignore:19:dist-verify/`) |
| `git status --porcelain` shows no `dist/` or `dist-verify/` entry | PASS (clean) |
| Full `<automated>` Task 3 chain | PASS — printed `UNTRACKED_OK`, exit 0 |

One ordering note worth recording, because it looks like a failure and is not: `git check-ignore`
suppresses any path present in the index, so `git check-ignore -q dist` exits 1 while `dist/` is
still tracked even though the rule is correct. Before the removal this was confirmed with
`git check-ignore -v --no-index dist` → `.gitignore:18:dist/`. Likewise `git check-ignore -q
dist-verify` requires the directory to exist, because a `dir/` pattern is matched against the
filesystem — it exits 1 when the throwaway dir has already been cleaned up. Both criteria pass in
the state the plan intends.

### Plan-level verification

| # | Check | Result |
|---|---|---|
| 1 | `npx tsc --noEmit` ≤ 16, 0 scoped | PASS (16 / 0) |
| 2 | `npx vitest run src/net party` exits 0 | PASS — 7 files, 103 tests (baseline 90 + 13 new) |
| 3 | fake-host build exits 0 | PASS |
| 4 | bundle grep succeeds | PASS |
| 5 | unset build exits nonzero, message names VITE_PARTY_HOST | PASS (exit 1, named twice) |
| 6 | `git ls-files dist` prints nothing | PASS (0 files) |
| 7 | `git status --porcelain` shows only intended edits | PASS — clean |

### Success criteria

- A bundle built with a room host contains that host; a bundle cannot be built without one — **met**.
- Dev and test paths unchanged with no environment variable set — **met** (`npx vitest run src/net party` green; the guard is `apply: 'build'` so `npm run dev` and the `room:*` scripts never see it).
- `partyHost()`'s single production call site in `src/main.ts` is unmodified — **met** (not in the diff).
- Build output is ignored and untracked — **met**.

## Blocked Work

None. Task 3's `git rm -r --cached dist` was initially refused twice by the permission classifier
and was deliberately left undone rather than routed around — a plumbing equivalent
(`git update-index --force-remove`) would have been the same semantic action under another name,
which is a bypass rather than a fix. It was retried and completed normally in the same session.

Nothing in the deploy path depended on it either way: Plan 05-02's runbook builds from source with
`npx vite build`, so a committed `dist/` was never the thing served. 05-02's
dependency-and-cleanliness preflight is what holds the cleanup in place from here.

## Deviations from Plan

### 1. [Rule 1 — Bug] Dropped `partyHost(undefined)` as a fixed-value assertion; covered the intent two other ways

**Found during:** Task 2

**Issue:** The plan's behavior list asks for `partyHost(undefined)` to return `127.0.0.1:1999` under
vitest, while the same task's acceptance criterion requires that no test read the ambient
environment and that the pass count be identical with `VITE_PARTY_HOST` set. These contradict.
Probed rather than guessed:

```
--- env unset ---            PROBE_UNDEFINED="127.0.0.1:1999"
--- env set ---              PROBE_UNDEFINED="something.else.example"
```

Passing `undefined` explicitly re-evaluates the default expression, and vitest surfaces
`VITE_`-prefixed `process.env` vars on `import.meta.env`. A test asserting the literal would have
failed under the criterion's own second run.

**Fix:** The exact fallback host is pinned by `partyHost('')` → `127.0.0.1:1999`, which is
deterministic and was already in the behavior list. The default-parameter wiring is pinned
separately by `partyHost() === partyHost(undefined)`, which ties `src/main.ts`'s no-arg call site to
the path these tests drive without asserting an ambient-dependent literal. A comment in the file
records why.

**Files modified:** `src/net/lobbyUrl.test.ts` · **Commit:** `86bee4a`

### 2. [Housekeeping] Tracer verify chain now cleans up after itself

**Found during:** Task 1

**Issue:** The tracer's `<automated>` chain did `rm -rf dist-verify` at the start but never at the
end, leaving ~84 MB of gitignored build output behind after every successful run.

**Fix:** Appended `&& rm -rf dist-verify` after `echo TRACER_OK` in
`.planning/phases/05-deployment/05-01-PLAN.md`. Deliberately `&&` after the echo rather than `;` at
the end: an unconditional trailing `rm` always exits 0 and would mask a failing chain. On failure the
directory is left in place for inspection and the leading `rm -rf` clears it next run. Verified —
the chain printed `TRACER_OK`, exited 0, and `dist-verify` was gone afterward.

**Files modified:** `.planning/phases/05-deployment/05-01-PLAN.md` (untracked planning artifact, edited in the main repo)

### 3. [Scope] Verified an extra negative case beyond the plan's list

The 05-02 placeholder `REPLACE_ME_AFTER_PARTYKIT_DEPLOY` was run through a real build, not only
through a unit test, confirming exit 1 with the malformed message. This is the check that makes
05-02's netlify.toml placeholder safe to ship, so proving it at the build layer seemed worth the
6ms.

## Threat Model Coverage

| Threat | Disposition | Status |
|---|---|---|
| T-05-01 Information Disclosure — `VITE_` env inlining | mitigate | Held. No new `VITE_` variable introduced. `VITE_PARTY_HOST` carries a public hostname only. The inlining rule is stated in the source comment; DEPLOY.md restates it in 05-02. |
| T-05-02 Tampering — malformed host at build time | mitigate | Held and verified. `isValidRoomHost` runs in `buildStart`; scheme, path, whitespace, uppercase and underscore forms all fail the build. |
| T-05-03 DoS — unset variable ships a localhost bundle | mitigate | Held and verified. Unset exits 1 in 6ms with an actionable message. |
| T-05-04 Tampering — package installs | mitigate | Held. Zero dependencies added; `package.json` and `package-lock.json` are not in the diff. |

**P-01** (no secrets committed): held — no secret, token, key or credential was written to any file.
**P-02** (no fabricated credentials, no login flows): held — no `partykit login`, `netlify login`,
deploy, or account action was attempted, and no live credential exists on this machine.

## Known Stubs

None. `DEPLOY.md` is referenced by both guard messages and does not exist yet — it is Plan 05-02's
deliverable, and pointing at it is the intended forward reference rather than a stub.

## TDD Gate Compliance

Task 2 carried `tdd="true"`, but this is a tracer-first plan: Task 1 deliberately builds the
implementation as the thin end-to-end slice before Task 2 pins it, so a literal RED-then-GREEN
ordering was not available and the commits read `fix` then `test` rather than `test` then `feat`.
The RED signal was recovered by mutation instead of by ordering — each mutation above was applied to
the committed implementation, the suite was observed failing, and the file was restored from git.
The tests are therefore demonstrated to fail on regression, which is the property the gate exists to
guarantee.

## Notes for Later

- `npm run build` is `tsc && vite build` and still cannot succeed, because of the 16 pre-existing
  tsc errors in `src/core/` and `src/sim/`. Every build path in this phase uses `npx vite build`
  directly, and 05-02 must configure the deploy the same way. Fixing those 16 is out of scope here
  but is what would let `npm run build` become the single deploy command.
- Baselines re-confirmed on this machine at execution time: `npx tsc --noEmit` = 16 errors, 0 in
  `src/net/`, `party/`, `scripts/`. Scoped suite was 90 tests before this plan and is 103 after.
- The plan diff touches exactly four files — `.gitignore`, `src/net/lobbyUrl.ts`,
  `src/net/lobbyUrl.test.ts`, `vite.config.ts` — plus the 325 index-only `dist/` removals.
  `src/main.ts`, `package.json` and `package-lock.json` are confirmed absent from it.

## Self-Check: PASSED

All four modified source files and this summary exist on disk. All three claimed commits
(`ff014a5`, `86bee4a`, `9e44504`) exist in the branch history. Every acceptance-criterion command
in this document was executed and its result observed, not asserted — including the real
`npx vite build` and the bundle grep that proves the substitution reaches the shipped artifact.
