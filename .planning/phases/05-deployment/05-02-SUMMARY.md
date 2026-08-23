---
phase: 05-deployment
plan: 02
subsystem: deployment
tags: [deployment, partykit, netlify, preflight, runbook, credential-free]
status: complete

requires:
  - "05-01: isValidRoomHost — makes netlify.toml's REPLACE_ME_AFTER_PARTYKIT_DEPLOY placeholder self-invalidating"
  - "05-01: vite.config.ts `require-room-host` guard — both failure messages quoted verbatim in DEPLOY.md"
  - "05-01: dist/ and dist-verify/ gitignored — preflight writes only dist-verify/"
  - "03-01: partykit.json — verified deploy-ready here, unchanged"
  - "03-01: scripts/roomHarness.ts + roomSmoke.ts — the credential-free stand-in for `partykit deploy`"
provides:
  - "netlify.toml — repo-root static host config, `npx vite build`, self-invalidating VITE_PARTY_HOST placeholder"
  - "scripts/deployPreflight.ts + `npm run deploy:preflight` — seven credential-free checks, fail-fast, self-cleaning"
  - "DEPLOY.md — the ordered runbook, its human-only manual section, and the DEPLOY-03 cross-network checklist"
affects:
  - "Any future phase that clears the 16-error tsc debt: netlify.toml's command and preflight's TSC_ERROR_BASELINE both want updating together"

tech-stack:
  added: []
  patterns:
    - "Self-invalidating placeholder: the un-edited default is chosen to FAIL an existing validator, so forgetting to edit it is a loud build failure rather than a silently broken deploy"
    - "Baseline-plus-path-filter gating: a ceiling on pre-existing debt makes regressions visible, while a zero-tolerance path filter keeps the current phase's own surfaces clean — neither alone would work"
    - "Credential-free stand-in: room:smoke bundles through the same workerd pipeline a deploy uses, so config/bundling defects surface locally; its blind spot (the live API) is stated in the script's own output"
    - "Human-only work is quarantined into prose (DEPLOY.md), never into a task that could pretend to have run it"

key-files:
  created:
    - netlify.toml
    - scripts/deployPreflight.ts
    - DEPLOY.md
  modified:
    - package.json

decisions:
  - "partykit.json verified with ZERO edits — all four keys correct, no vars block, main resolves. The room needs no production environment variable: PLANNING_MS is a dev-only --var override and a deployed room correctly falls through to the 30s default."
  - "No [[redirects]] SPA fallback in netlify.toml. Verified against all three URL-construction sites in src/main.ts (2433, 2445, 5811), not assumed."
  - "netlify.toml's build command is `npx vite build`, deliberately bypassing the repo's tsc-then-vite `build` script, which cannot succeed against 16 pre-existing type errors in 13 files under src/core/ and src/sim/."
  - "The netlify.toml comment explains the tsc problem WITHOUT writing the literal string `npm run build`, because Task 1's acceptance criterion greps for its absence. Phrased as 'the repo's `build` npm script (`tsc && vite build`)' — clearer prose, and the criterion keeps its teeth."
  - "DEPLOY.md leads with Route A (local netlify-cli build) as the verified route; Route B (git-connected) is marked UNTESTED with the committed-node_modules darwin-arm64 reason named up front."
  - "DEVIATION: the preflight header comment does NOT claim to mutate nothing tracked, because vitest rewrites the tracked node_modules/.vite/vitest/results.json. Stated accurately instead of asserted falsely. See Deviations."

metrics:
  duration: ~50m
  completed: 2026-08-23

actuals:
  tokens: 61000
  tasks: 3
  commits: 3
---

# Phase 05 Plan 02: Deploy Config, Preflight and Runbook Summary

Both halves of the deploy are configured and proven as far as a zero-credential session allows;
one command (`npm run deploy:preflight`) establishes that everything except the two authenticated
steps and the cross-network round is already correct, and DEPLOY.md is the ordered runbook for the
rest.

## What Was Built

### Task 1 — room config verified, static host config added

**Commit:** `3255929`

**`partykit.json`: zero edits, by design.** Verified rather than rewritten — `name` is `poketft`,
`main` is `party/lobby.ts` and that file exists, `compatibilityDate` is present, and there is no
`vars` block. No `vars` block was added, and adding one would have been actively wrong: `PLANNING_MS`
is a dev-only per-room `--var` override that only `scripts/roomRound.ts` passes, and a deployed room
that is never given the flag falls through to the 30-second `PLANNING_MS` default in
`src/net/protocol.ts` — the correct production planning window. A `vars` entry would push a value
onto every room and override that default globally, the opposite of what the override exists for.
The file also holds no per-run, per-machine or timestamped value, so validating it is idempotent.
`git diff --exit-code partykit.json` exits 0.

**The rewrite-rule finding (Task 1b), with the line numbers inspected.** **No SPA fallback redirect
is required, and none was added.** This was determined by inspecting every history and
URL-construction call in `src/main.ts`, not by assumption:

| `src/main.ts` line | Call | Resulting URL |
|---|---|---|
| 2433 | `history.replaceState(null, '', location.origin + location.pathname)` | root path, no query |
| 2445 | `shareableLobbyUrl(location.origin, code)` | `${origin}/?lobby=${code}` |
| 5811 | `history.replaceState(null, '', shareableLobbyUrl(location.origin, code))` | `${origin}/?lobby=${code}` |

`grep -n` over `src/main.ts` for `history.`, `pushState`, `replaceState`, `shareableLobbyUrl`,
`location.origin` and `location.pathname` returns exactly these three sites plus the import on line
62 and an unrelated comment on line 3782. `shareableLobbyUrl` is defined in `src/net/lobbyUrl.ts` as
`` `${origin}/?lobby=${code}` ``. A lobby code therefore **always** travels as a query string on the
root path and **never** as a path segment, so a static host serving one `index.html` at `/` needs no
fallback rule. The finding is recorded as a comment in `netlify.toml` so the next reader does not
re-derive it.

**`netlify.toml`** was written at the repo root mirroring `blog/netlify.toml`'s proven shape, with
`command = "npx vite build"`, `publish = "dist"`, `NODE_VERSION = "20"` and
`VITE_PARTY_HOST = "REPLACE_ME_AFTER_PARTYKIT_DEPLOY"`. It carries comments covering all four
required topics: the placeholder's self-invalidating purpose (including an explicit "do not replace
this with a lowercase placeholder" warning), the no-secrets rule for `VITE_`-inlined variables
(P-01), the rewrite-rule finding above, and the Netlify rationale.

**The placeholder was proven un-shippable against a real build**, not merely asserted:

```
x Build failed in 7ms
error during build:
[require-room-host] VITE_PARTY_HOST is malformed: "REPLACE_ME_AFTER_PARTYKIT_DEPLOY"
```

Exit code 1.

### Task 2 — `npm run deploy:preflight`

**Commit:** `f2035a9`

`scripts/deployPreflight.ts`, registered in `package.json` next to the `room:*` entries as
`"deploy:preflight": "tsx scripts/deployPreflight.ts"`. Dependency blocks untouched. It reuses
`roomSmoke.ts`'s `assert(condition, message)` idiom — throw on failure, log `OK:` on success — and
runs seven checks cheapest-first, failing fast with a nonzero exit.

Observed output of a full run:

| # | Check | Result |
|---|---|---|
| 1 | Types against baseline | 0 errors in `src/net\|party\|scripts`, 16 total (at the ceiling) |
| 2 | `npx vitest run src/net party` | exit 0 |
| 3 | Dependency freeze | `dependencies` is exactly `[partysocket]`; no deploy CLI in devDeps |
| 4 | `npm run room:smoke` | passes — partykit.json loads, `party/lobby.ts` bundles under workerd |
| 5 | Build guard, negative | unset → nonzero and names the variable; placeholder → nonzero |
| 6 | Build guard, positive | `deploy-probe.invalid` → exit 0, and the literal is **found in the emitted bundle** |
| 7 | Payload report | 327 files, **84.8 MB total**; largest `dist-verify/visuals/ability_icons/blizzard.webp` at **10.6 MB** |

**Payload baseline for future regression detection: 327 files / 84.8 MB total / largest file 10.6 MB
against Netlify's 100 MB per-file ceiling.** Ample headroom; the check exists to catch a future asset
that would be silently refused at upload.

Check 1 also prints a `NOTE:` telling the developer to lower `TSC_ERROR_BASELINE` if the count ever
drops below 16 — a silently over-generous baseline stops catching anything.

Teardown is `rmSync(VERIFY_DIR, …)` in a `finally`, so a failed run does not leave ~85 MB behind
either. The run ends by printing the four remaining steps under a heading stating they are human-only
and pointing at DEPLOY.md.

**The room check was proven load-bearing without mutating any tracked file.** Rather than corrupting
the real `partykit.json`, a scratch mirror was built in the system temp directory with symlinks to
`node_modules/`, `party/`, `src/`, `scripts/`, `package.json` and `tsconfig.json`, and a **copy** of
`partykit.json`. A **control run first** confirmed the mirror is faithful (`roomSmoke: all assertions
passed`) — without that control, a later failure would prove nothing about the corruption. The copy's
`main` was then repointed at `party/does-not-exist.ts`:

```
partykit dev did not become ready within 60000ms.
Captured stderr:
Error: Could not find main: ./party/does-not-exist.ts
SMOKE_EXIT=1
```

`git diff --exit-code partykit.json` exits 0 afterward — the real file was never touched, renamed or
moved at any point.

### Task 3 — DEPLOY.md

**Commit:** `7e07658`

`DEPLOY.md` at the repo root (not under `.planning/`, so it survives a fresh clone). Sections:
header banner, what gets deployed where, before you start, **Manual steps — HUMAN-ONLY**,
**Verifying DEPLOY-03** as its own top-level section with an 8-item checkbox list, troubleshooting
(6 entries), decisions worth revisiting, and a closing note on credentials.

Both `require-room-host` guard messages are quoted in the troubleshooting section and were verified
**byte-identical** against `05-01-SUMMARY.md` — and additionally cross-checked line-by-line against
the actual string literals in `vite.config.ts`, so the runbook cannot quote a message the build no
longer produces.

## The Manual Steps — full text, for the developer returning with credentials

This is the complete `## Manual steps` and `## Verifying DEPLOY-03` content of `DEPLOY.md`,
reproduced verbatim so it is unambiguous what remains to be done.

---

## Manual steps — HUMAN-ONLY, in this order

### 1. Run the credential-free preflight

```sh
npm run deploy:preflight
```

Runs every check that is possible without a credential: the type baseline, the scoped
test suite, a dependency freeze, a real bundle of the room under workerd, both build-guard
directions, and a payload size report. **Fix any failure before continuing** — anything
red here will also be red after deploying, just far more expensively.

Note what this does *not* cover: it never contacts PartyKit's or Netlify's API, so it
cannot see an account-side problem or a project-name collision.

### 2. Log in to PartyKit

```sh
npx partykit login
```

Opens a browser for GitHub OAuth. **Human-only** — this cannot be run non-interactively.

### 3. Deploy the room

```sh
npx partykit deploy
```

**Copy the URL it prints.** The room's name comes from `partykit.json`'s `name` field
(`poketft`), so the result takes the form:

```
https://poketft.<your-username>.partykit.dev
```

**The exact value printed by the command is authoritative** over anything written in
this document. If it differs from the shape above, use what was printed.

### 4. Set `VITE_PARTY_HOST` to the host portion of that URL

Take the **host only** — no `https://`, no trailing slash, no path:

```
poketft.<your-username>.partykit.dev
```

Both are stripped because `partysocket` derives its own scheme (`ws:`/`wss:`) and
appends its own `/parties/main/<room>` path. A value carrying either one produces an
unopenable URL, and the build guard rejects it before you get that far.

Two ways to set it, pick one:

- **Edit `netlify.toml`** — replace `REPLACE_ME_AFTER_PARTYKIT_DEPLOY` in
  `[build.environment]` and commit. This is a public hostname, not a secret, so it is
  safe to commit.
- **Set it in the Netlify dashboard** — Site configuration → Environment variables.

Leaving the placeholder in place **fails the build on purpose**. It contains uppercase
letters and underscores, neither of which is legal in a hostname, so the guard rejects
it rather than letting you publish a site whose every connection attempt points nowhere.

> **This step must come after step 3 and before step 5.** The value is compiled into
> the bundle at build time, not read at run time. Setting it later — in a dashboard,
> after a deploy — changes nothing until you rebuild.

### 5. Build and deploy the frontend

#### Route A — local CLI build (RECOMMENDED; the only route whose build step is verified)

```sh
npx netlify-cli login
VITE_PARTY_HOST=poketft.<your-username>.partykit.dev npx vite build
npx netlify-cli deploy --prod --dir=dist
```

The build must be `npx vite build`, per "Before you start" above.

#### Route B — git-connected repo (UNTESTED, LIKELY TO FAIL — try Route A first)

Push, connect the repo `aryavpatil302/poketft` in the Netlify dashboard, set
`VITE_PARTY_HOST` in Netlify's build environment, and let `netlify.toml` drive the build.

**Why this is expected to break:** this repo commits `node_modules` — **6406 tracked
files**, including platform-specific **darwin-arm64** binaries for `esbuild` and
`chromedriver`. Netlify's build container is Linux and cannot execute those. Making
Route B work would mean untracking `node_modules` first, which is out of scope for this
phase. This is stated up front rather than left for you to discover from a failed remote
build log.

### 6. Get the shareable link

Open the deployed site, click **Multiplayer**, and copy the link. It takes the form:

```
https://<your-site>.netlify.app/?lobby=<six-character-code>
```

The lobby code is always a **query string on the root path**, never a path segment —
which is why `netlify.toml` needs no SPA fallback redirect.

---

## Verifying DEPLOY-03 — human, cross-network, cannot be automated

**This requirement is verified by a person on a second device, on a different network.
No test in this repo covers it, and none can.** The preflight eliminates every failure
cause reachable without a credential; what remains is genuinely a two-humans-and-two-
networks check.

Work through this list with a friend:

- [ ] Friend opens the shareable link **on a different network** — a phone on **cellular
      data**, not the same wifi. Same-wifi success can pass while the public internet
      path is broken, so it does not count.
- [ ] Friend's browser lands **in the lobby**, not on the title screen.
- [ ] The seat list shows **two humans and four bots**.
- [ ] Host presses **Start**.
- [ ] Both players shop **during the same countdown**, and the two countdowns **agree**
      with each other. (The planning window is the 30-second production default —
      `PLANNING_MS` in `src/net/protocol.ts`. The 2-second override exists only for
      local automated runs and is never passed to a deployed room.)
- [ ] The round **resolves** for both players.
- [ ] Both see **combat playback** and a **consistent settlement line**.
- [ ] A **second round begins**.

---

## What remains manual — explicit statement for `/gsd-verify-work`

**DEPLOY-01, DEPLOY-02 and DEPLOY-03 are NOT fully agent-verified, and must not be read as such.**
No task in this plan ran, faked, or claimed an authenticated operation. Precisely:

| Requirement | Verified here, credential-free | Still requires a human |
|---|---|---|
| DEPLOY-01 | partykit.json shape; `party/lobby.ts` bundles under workerd via a real `partykit dev` | `npx partykit login`, `npx partykit deploy` |
| DEPLOY-02 | netlify.toml valid and correct; build succeeds; the room host is provably baked into the emitted bundle; an un-edited config cannot build | The Netlify account, login, and the upload itself |
| DEPLOY-03 | Nothing. Every preflight-reachable failure cause is eliminated in advance, which is not the same as verification | The entire cross-network round with a friend on a different network |

The four human-only items, in order: `npx partykit login`; `npx partykit deploy`; Netlify account +
login + frontend deploy; the DEPLOY-03 cross-network round. All four live in DEPLOY.md as prose and
in no `<task>` block.

## Acceptance Criteria

### Task 1

| Criterion | Result |
|---|---|
| Node assertion block prints `PARTYKIT_JSON_OK` | PASS |
| `git diff --exit-code partykit.json` exits 0 | PASS (zero edits) |
| netlify.toml exists at repo root, valid TOML, correct command/publish/NODE_VERSION | PASS — `TOML_OK` |
| netlify.toml does NOT reference `npm run build` | PASS (`grep -c` = 0) |
| A build with the placeholder exits NONZERO | PASS (exit 1, malformed message) |
| Comments cover placeholder purpose, no-secrets rule, rewrite finding, Netlify rationale | PASS (all four present) |
| Rewrite-rule question answered with src/main.ts line numbers | PASS (2433, 2445, 5811 — table above) |
| Full Task 1 `<automated>` chain | PASS — printed `PARTYKIT_JSON_OK` then `CONFIG_OK`, exit 0 |

TOML validity was checked with a strict subset parser written for the purpose (comments,
`[table]` headers, `KEY = "string"` pairs) that **throws on any line it does not recognise**, so it
cannot rubber-stamp a malformed file by ignoring what it does not understand. No TOML parser exists
in this repo's `node_modules`, and `npx`-fetching an unverified package to get one would have been a
worse trade than a 30-line validator.

### Task 2

| Criterion | Result |
|---|---|
| `npm run deploy:preflight` exits 0 with an `OK:` line per check | PASS (7 checks, 13 `OK:` lines) |
| A second immediate run also exits 0 with the same verdict | PASS — probe DEPLOY-01/idempotency discharged by observation |
| `git diff --exit-code partykit.json netlify.toml` exits 0 after both runs | PASS |
| `git status --porcelain dist-verify` prints nothing after both runs | PASS |
| Room check proven load-bearing without mutating a tracked file | PASS — mirror + control run + corrupted copy; exit 1 |
| `dependencies` prints exactly `partysocket` | PASS |
| Output names DEPLOY.md and states the remaining steps are human-only | PASS |
| Full Task 2 `<automated>` chain | PASS — printed `PREFLIGHT_IDEMPOTENT_OK` |

### Task 3

| Criterion | Result |
|---|---|
| DEPLOY.md exists at repo root, non-empty | PASS (273 lines) |
| Contains all five required literal commands | PASS (preflight 1x, partykit login 2x, partykit deploy 1x, `npx vite build` 7x, `npx netlify-cli deploy` 1x) |
| `npm run build` appears only in explanation-of-why-not | PASS — exactly 2 occurrences, lines 44 and 184, both explanatory |
| Route A recommended, Route B marked untested with the node_modules reason | PASS (lines 120, 130, 135-136) |
| First `npx partykit deploy` precedes first `netlify-cli deploy` | PASS |
| Human-only heading + separate top-level DEPLOY-03 section with checkboxes | PASS (lines 51, 155, 8 checkboxes) |
| Credential-shape regex finds no match | PASS |
| Both guard messages verbatim from 05-01-SUMMARY.md | PASS — byte-identical, and cross-checked against vite.config.ts |
| Both reversible decisions recorded with rationale | PASS |
| Full Task 3 `<automated>` chain | PASS — printed `RUNBOOK_OK` |

### Plan-level verification

| # | Check | Result |
|---|---|---|
| 1 | preflight exits 0, twice in a row | PASS |
| 2 | `git diff --exit-code partykit.json` | PASS |
| 3 | `dependencies` deep-equals `['partysocket']` | PASS |
| 4 | `test -s DEPLOY.md && test -s netlify.toml` | PASS |
| 5 | Placeholder build exits nonzero | PASS |
| 6 | `git status --porcelain` shows only intended files | PASS (see Deviation 1) |
| 7 | No authenticated command run by any task | PASS — by inspection; see below |

**On criterion 7.** No `partykit login`, `partykit deploy`, `netlify` login or deploy, or any
authenticated request was attempted at any point in this session. No account was created and no
credential was fabricated. The only `partykit` invocation was `partykit dev` on localhost:1999, spawned
by the existing `roomHarness.ts` — an unauthenticated local dev server. Those commands appear in this
repo only as text, in DEPLOY.md's manual section and in this summary.

### Success criteria

- DEPLOY-01 discharged as far as a credential-free session allows — **met**.
- DEPLOY-02 discharged in full except the upload; an un-edited config cannot ship — **met, verified against a real build**.
- DEPLOY-03 covered as a written human checklist, explicitly not automated — **met**.
- Zero new npm dependencies — **met**, asserted mechanically by preflight check 3.
- No task attempted, faked, or claimed an authenticated operation — **met**.

## Deviations from Plan

### 1. [Rule 1 — Accuracy] The preflight header does not claim to "mutate nothing tracked", because that would be false

**Found during:** Task 2

**Issue:** The plan specifies a header comment stating the script "mutates nothing tracked". It would
have been untrue. Check 2 runs vitest, and vitest rewrites its own result cache at
`node_modules/.vite/vitest/results.json` — which **this repo tracks** (it sits under the committed
`node_modules` tree and no `.gitignore` rule covers it; `git check-ignore` exits 1 on it). Every
preflight run leaves that file modified.

**Fix:** The header states the truth instead: the script writes only the gitignored `dist-verify/`
and never touches `partykit.json`, `netlify.toml` or `package.json`, **and** it names the vitest
cache file explicitly as a side effect that is not the script's doing, notes it is local cache state
in the same class as the already-ignored `node_modules/.mf/`, and gives the one-line discard command.

The tempting alternative — copying the file aside and restoring it — was rejected: the plan
explicitly forbids the script from renaming, moving or deleting a tracked file *even transiently*,
and an aborted run mid-restore would leave the repo dirty in exactly the way that rule exists to
prevent. Untracking `node_modules/.vite/` properly (mirroring how 05-01 handled `node_modules/.mf/`)
is the real fix and is recorded below as a deferred item rather than done here, per instruction.

**Files modified:** `scripts/deployPreflight.ts` · **Commit:** `f2035a9`

### 2. [Rule 3 — Blocking] netlify.toml explains the tsc problem without writing the literal `npm run build`

**Found during:** Task 1

**Issue:** Task 1's action requires a comment explaining that `npm run build` is `tsc && vite build`
and cannot succeed. Task 1's own `<automated>` chain asserts `! grep -q 'npm run build' netlify.toml`.
Written literally, the required comment fails the required check.

**Fix:** The comment says "Deliberately `npx vite build` and NOT the repo's `build` npm script. That
script is `tsc && vite build`, and …". Identical information, arguably clearer prose, and the
acceptance criterion keeps its teeth as a genuine guard against the config ever *pointing* at the
broken script. This is the netlify.toml counterpart to the bounded-count fix applied to DEPLOY.md
below — in DEPLOY.md a count bound was right because the runbook must name the string it warns
against; in netlify.toml, which is machine-read config, zero occurrences is the correct bar.

**Files modified:** `netlify.toml` · **Commit:** `3255929`

### 3. [Housekeeping] Both flagged plan-checker items applied to 05-02-PLAN.md

**Found during:** pre-execution review, per instruction

**(a) Verify chains now clean up `dist-verify/` at both ends.** Task 1's `<automated>` chain gained a
leading `rm -rf dist-verify;` and a trailing `&& rm -rf dist-verify`, matching the precedent 05-01
set. The trailing `rm` is `&&`-chained after `echo CONFIG_OK` rather than `;`-appended: an
unconditional trailing `rm` always exits 0 and would mask a failing chain. On failure the directory
is left for inspection and the leading `rm` clears it next run. Task 2 needed no change — the
preflight already tears down in a `finally`.

**(b) The `npm run build` check in Task 3 is a bounded count, not a bare negative grep.** The chain
gained `test "$(grep -c 'npm run build' DEPLOY.md)" -le 6` plus a positive
`grep -q 'npx vite build'`. A bare `! grep -q` would fail a *correctly written* runbook, since
DEPLOY.md must name the string to explain why not to use it. Actual count: **2**. The acceptance
criterion text was updated to record the reasoning.

**Files modified:** `.planning/phases/05-deployment/05-02-PLAN.md` (untracked planning artifact,
edited in the main checkout — the worktree has no copy)

### 4. [Scope] Two verification checks written beyond the plan's list

- **A strict-subset TOML validator**, because "is valid TOML (parses without error)" is an acceptance
  criterion and no TOML parser exists in `node_modules`. It fails hard on any unrecognised line.
- **A guard-message equivalence check** comparing DEPLOY.md's quoted blocks against both
  `05-01-SUMMARY.md` **and** the string literals in `vite.config.ts`. The plan only asks for the
  former; adding the latter means a future edit to the guard's wording cannot leave DEPLOY.md quoting
  a message that is no longer produced.

Both are one-off verification scripts in the session scratchpad, deliberately not committed — they
verify a static config that the preflight already re-checks in substance.

## Deferred Issues

**`node_modules/.vite/` should be gitignored and untracked**, exactly as 05-01 did for
`node_modules/.mf/` and for the same stated reason: it is local Vite/vitest cache state living under
a committed `node_modules` tree. Today, any `vitest` run — including preflight check 2 — dirties the
tracked `node_modules/.vite/vitest/results.json`. It was reverted with `git checkout --` before each
commit in this session, and all three commits are clean of it. Not done here because it is outside
this plan's file scope and was explicitly directed to be handled by reverting.

## Threat Model Coverage

| Threat | Disposition | Status |
|---|---|---|
| T-05-05 Information Disclosure — DEPLOY.md / netlify.toml on a public remote | mitigate | Held. No credential literal in either file, not even an example-shaped fake; all placeholders are `<your-username>`-style. The credential-shape regex over DEPLOY.md finds no match. `VITE_PARTY_HOST` is documented as a public hostname at its point of use in both files. |
| T-05-06 Tampering — package installs | mitigate | Held and now mechanically enforced. Zero packages added; `package.json`'s only diff is one `scripts` line; `package-lock.json` untouched. Preflight check 3 asserts `dependencies` is exactly `[partysocket]` and that no netlify/vercel/wrangler CLI entered devDependencies, so this is a fact re-checked on every run rather than an intention. |
| T-05-07 Elevation of Privilege — non-interactive auth | mitigate | Held. No authenticated command was run. The only `partykit` invocation was the unauthenticated local `partykit dev`. |
| T-05-08 Spoofing — lobby code guessability | accept | Unchanged; no new surface introduced by this plan. |
| T-05-09 DoS — open room | accept | Unchanged; no new surface introduced by this plan. |

**P-01** (no secrets committed): held — no secret, token, key, cookie or credential was written to
any file in this session. **P-02** (no fabricated credentials, no login flows): held — no
`partykit login`, `partykit deploy`, netlify CLI command, account creation, or authenticated request
was attempted.

## Known Stubs

None. `netlify.toml`'s `REPLACE_ME_AFTER_PARTYKIT_DEPLOY` is deliberately **not** a stub in the
broken-window sense: it is a value engineered to fail an existing validator, so it cannot silently
ship. An un-edited config fails the build in ~6ms with an actionable message. That is the mechanism,
verified against a real build, not an unfinished edge.

## Notes for Later

- `netlify.toml`'s `command` and `scripts/deployPreflight.ts`'s `TSC_ERROR_BASELINE` are a **pair**.
  Whoever clears the 16 pre-existing type errors should restore the `tsc`-gated build script in
  `netlify.toml` and drop the baseline to 0 in the same change. Preflight check 1 prints a `NOTE:`
  prompting this whenever the count falls below 16.
- The tsc debt is 16 errors across 13 files: `persistentAoE.ts` (3), `weavile.ts` (2), and one each
  in `runner.ts`, `traitEffects.test.ts`, `statusEffect.ts`, `skystriker.test.ts`,
  `vikavolt.test.ts`, `torkoal.ts`, `mega_golurk.test.ts`, `golurk.test.ts`, `golett.test.ts`,
  `gogoat.test.ts`, `gible.ts`.
- Payload baseline to compare against after any asset change: **327 files, 84.8 MB, largest 10.6 MB**.
- Route B (git-connected Netlify) remains untested. If it is ever attempted, untracking
  `node_modules` is the prerequisite, and that is a large enough change to deserve its own plan.

## Self-Check: PASSED

All three created files (`netlify.toml`, `scripts/deployPreflight.ts`, `DEPLOY.md`) and this summary
exist on disk. All three claimed commits (`3255929`, `f2035a9`, `7e07658`) exist in the branch
history. Every acceptance-criterion command in this document was executed and its result observed,
not asserted — including two full back-to-back preflight runs, the real placeholder build, the
bundle grep, and the corrupted-config room-smoke failure with its control run.
