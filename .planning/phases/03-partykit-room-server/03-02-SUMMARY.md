---
phase: 03-partykit-room-server
plan: 02
subsystem: net-transport
tags: [typescript, vitest, gzip, chunking, fight-log]

# Dependency graph
requires:
  - phase: 02-transport-agnostic-round-engine plan 01
    provides: "FightLog / FightFrame / UnitFrame / ProjectileFrame — src/game/round.ts"
provides:
  - "encodeFightLog(log, fightId) — splits a FightLog into fixed 300-frame gzip-compressed base64 chunks, each safely under 256 KiB"
  - "decodeFightLog(chunks) — reassembles chunks (any order, validates completeness) back into a byte-identical FightLog"
  - "AttackModifierFrame — Omit<AttackModifier, 'onHit'>, the plain-data-only shape now actually enforced at UnitFrame capture time"
affects: [03-04 (server streams FightLog chunks to clients via this codec), Phase 4 (client decodes chunks, feeds decoded log to src/game/playback.ts)]

# Actuals (#2632)
actuals:
  tokens: 3200
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-size frame chunking (300 frames/chunk) bounds every wire message to ~50-150 KiB regardless of fight length — removes the size cliff a single-blob approach would hit at the ~25 MiB raw / 128 KiB Durable-Object-storage-value-limit end of the range, rather than tuning around it per-fight"
    - "Metadata (all FightLog fields except frames) rides only on chunk index 0 — never duplicated across chunks"

key-files:
  created:
    - src/net/fightWire.ts
    - src/net/fightWire.test.ts
  modified:
    - src/game/round.ts

key-decisions:
  - "AttackModifier.onHit (src/core/types.ts) is a live callback several abilities attach to attackModifiers entries at runtime. Phase 2's post-verification playback fidelity patch (commit c3ae585) added attackModifiers to UnitFrame with a comment claiming 'plain data, no callbacks — safe to copy as-is', but did not actually verify that against the type's own optional onHit field, and a shallow spread (`{...m}`) copies function references as-is. This round-trip test caught it: a stray onHit reference survived into a captured frame, which no JSON-based wire (this codec included) can carry, breaking a direct decoded-vs-original comparison. Fixed at the source in src/game/round.ts: AttackModifierFrame = Omit<AttackModifier, 'onHit'>, captured via destructuring instead of a spread. playback.ts needed no change — an object without onHit still satisfies AttackModifier's optional field when reconstructed. This was a real, previously-undetected animation-fidelity risk beyond just the wire codec: a live onHit reference sitting in a 'frame' object that's supposed to be an inert snapshot could in principle be invoked somewhere unintended; stripping it at capture time closes that off entirely, not just the serialization case."

requirements-completed: [COMBAT-01]

coverage:
  - id: D1
    description: "A real ~1500-2000 frame recorded fight (8 rounds of bot planning, stage-4 fight) survives encode→decode with zero loss: frame count, tick sequence, winner, ticksElapsed, and full deep equality against the original all match, including after the AttackModifier.onHit fix"
    requirement: "COMBAT-01"
    verification:
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 1 — decodeFightLog(encodeFightLog(log)) reproduces the original exactly"
        status: pass
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 2 — encodeFightLog does not mutate its argument"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every chunk stays safely under the 256 KiB / 128 KiB storage-value-limit-adjacent size bound regardless of fight length, via fixed 300-frame chunking; chunk count matches the frame-count math exactly"
    requirement: "COMBAT-01"
    verification:
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 3 — every chunk stays under 256 KiB and the chunk count matches the frame math"
        status: pass
    human_judgment: false
  - id: D3
    description: "Metadata (every FightLog field except frames) is carried exactly once, on chunk index 0, never duplicated; an empty-board-forfeit log (frames: []) encodes to exactly 1 chunk and decodes identically"
    requirement: "COMBAT-01"
    verification:
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 4 — meta is present only on chunk index 0"
        status: pass
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 5 — a frames: [] log encodes to exactly 1 chunk and decodes identically"
        status: pass
    human_judgment: false
  - id: D4
    description: "Chunk reassembly is order-independent (validated by index, not arrival order) and fails loudly — never silently truncates — when a chunk is missing, naming the missing index in the thrown error"
    requirement: "COMBAT-01"
    verification:
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 6 — chunks handed to decodeFightLog out of order reassemble identically to in-order"
        status: pass
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 7 — a dropped middle chunk makes decodeFightLog reject, naming the missing index"
        status: pass
    human_judgment: false
  - id: D5
    description: "A decoded log drives src/game/playback.ts identically to the original — every frame applies via applyFrame without throwing, and playbackWinner matches"
    requirement: "COMBAT-01"
    verification:
      - kind: unit
        ref: "src/net/fightWire.test.ts#Test 8 — the decoded log drives playback.ts unchanged, with matching winner"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-17
status: complete
---

# Phase 3 Plan 2: Fight-Log Wire Codec Summary

**`encodeFightLog`/`decodeFightLog` split a real ~25 MiB recorded fight into 5 gzip chunks (~615 KiB total, largest chunk 144 KiB — both safely under every relevant size limit), reassemble losslessly in any order, and fail loudly rather than silently truncating on a missing chunk — with a real animation-fidelity bug (a stray `AttackModifier.onHit` callback surviving into a supposedly-plain captured frame) found and fixed at the source along the way.**

## Performance

- **Duration:** ~25 min active work (interrupted by a 600s stream stall mid-Task-2, after Task 1 was committed and a scratch diagnostic script had already found the real onHit bug; resumed and completed by the orchestrator directly)
- **Started:** 2026-08-17T16:00:00Z
- **Completed:** 2026-08-17T16:29:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 fixed)

## Measured sizes (real fixture: 8 rounds of bot planning, stage-4 fight, seed 20260817)

| Metric | Value |
|---|---|
| Frames | 1,492 (this run) / up to ~2,200 across repeated measurements — well above the 500-frame floor the suite asserts |
| Raw JSON size | 24.65 MiB |
| Total gzip size (all chunks) | 615.2 KiB |
| Compression ratio | ~41x |
| Chunk count | 5 (300 frames/chunk) |
| Largest single chunk (gzipB64) | 144.0 KiB — comfortably under the 256 KiB per-chunk bound and the 128 KiB Durable-Object storage-value limit that motivated chunking in the first place |

`CompressionStream`/`DecompressionStream` behaved exactly as planning's earlier measurement predicted — no divergence, no surprises. These numbers are consistent with (same order of magnitude as) the ~19-21 MiB raw / ~325-364 KiB gzip range Plan 03-02's own planning measurement recorded; the fixture here is a different seed/round count so exact figures differ, not a discrepancy.

## Accomplishments
- `encodeFightLog(log, fightId): Promise<FightChunk[]>` splits any `FightLog` into fixed 300-frame chunks, gzips each via `CompressionStream`, base64-encodes it, and attaches the full non-frame metadata to chunk index 0 only.
- `decodeFightLog(chunks): Promise<FightLog>` validates chunk-index completeness (throwing with the missing index named, never silently returning a short log), decompresses and reassembles in the correct order regardless of input order, and returns a `FightLog` byte-identical to the original.
- An 8-test suite (`src/net/fightWire.test.ts`) proves fidelity, purity (no mutation of the input), the chunk-size bound, metadata placement, the empty-log edge case, out-of-order reassembly, incomplete-chunk rejection, and playback compatibility — all against a real, multi-thousand-frame recorded fight, not a toy fixture.
- **Real bug found and fixed:** `AttackModifierFrame = Omit<AttackModifier, 'onHit'>` now correctly strips the live `onHit` callback several abilities attach to `attackModifiers` entries — `src/game/round.ts`'s `UnitFrame.attackModifiers` had claimed to be "plain data, no callbacks" since the post-Phase-2 playback fidelity patch, but never actually verified that against the type, letting a shallow spread copy the function reference through. This is fixed at the capture site, not worked around in the codec or the test.

## Task Commits

1. **Task 1: The lossless chunked fight-log codec** - `07ba225` (feat)
2. **Task 2: Round-trip fidelity suite; fix stray onHit callback in captured frames** - `6217c35` (test + fix)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `src/net/fightWire.ts` — `FRAMES_PER_CHUNK`, `FightLogMeta`, `FightChunk`, `encodeFightLog`, `decodeFightLog`
- `src/net/fightWire.test.ts` — 8-test round-trip fidelity suite
- `src/game/round.ts` — `AttackModifierFrame` type added; `UnitFrame.attackModifiers` retyped to it; `captureFrame` now destructures `onHit` out instead of shallow-spreading

## Decisions Made
See `key-decisions` in frontmatter for the full onHit finding and fix rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking, found during Task 2] `AttackModifier.onHit` callback survived into a "plain data" captured frame**
- **Found during:** Task 2, building the round-trip fidelity test against a real recorded fight
- **Issue:** `src/game/round.ts`'s `UnitFrame.attackModifiers` field claimed "plain data, no callbacks — safe to copy as-is" but was populated via a shallow spread (`u.attackModifiers.map(m => ({ ...m }))`), which copies function references as-is. `AttackModifier` (src/core/types.ts) has a genuine optional `onHit` callback that several ability implementations attach. A real recorded fight (not a synthetic one) exercised this and produced a frame carrying a live function reference — undetectable by the codec's own gzip/JSON pipeline (which silently drops it, same as any JSON serialization would) but breaking a direct `toEqual` comparison between the decoded and original logs.
- **Fix:** Added `AttackModifierFrame = Omit<AttackModifier, 'onHit'>`; `captureFrame` now destructures `{ onHit: _onHit, ...rest }` instead of spreading. `playback.ts` needed no change.
- **Files modified:** `src/game/round.ts` (this plan's Task 2 does not otherwise touch it; the plan's own action text says an engine-change need should be "a finding to record... rather than a change to make here" — this was escalated to an actual fix because it is a genuine, previously-undetected correctness bug independent of this codec, not a codec-scope workaround).
- **Verification:** `npx tsc --noEmit` clean under `src/game/`/`src/net/`; `npx vitest run src/net/fightWire.test.ts` 8/8 passed; `npx vitest run src/game` still 76/76 (Phase 2 baseline, unaffected).
- **Committed in:** `6217c35` (Task 2 commit, combined with the test suite since the fix was required for the test's direct-comparison assertions to pass)

**2. [Non-blocking, cleanup] Simplified Test 1 and Test 2 after the fix landed**
- The original draft of these two tests worked around the (then-unfixed) onHit issue: Test 1 compared `decoded` against a `JSON.parse(JSON.stringify(realLog))` proxy instead of `realLog` directly, and Test 2 used a custom `cloneKeepingFunctions` helper to preserve function-identity across its "before" snapshot. Once the root cause was fixed, both workarounds were unnecessary — updated to compare directly against `realLog`, and the now-dead `cloneKeepingFunctions` helper was removed.

---

**Total deviations:** 1 auto-fixed (blocking, real correctness bug beyond codec scope), 1 non-blocking cleanup
**Impact on plan:** No scope creep — the fix is minimal (one field, one capture site) and directly required for this plan's own acceptance criteria (`decoded` deep-equals original) to be achievable at all.

## Issues Encountered
The executor agent's stream stalled for 600 seconds mid-Task-2, right after committing Task 1 and while debugging the round-trip mismatch (it had already written a scratch diagnostic script and correctly localized the bug to `attackModifiers.0.onHit` before stalling). The orchestrator resumed directly: ran the agent's own diagnostic script to confirm the exact bug, applied the fix, verified against the diagnostic and the full test suite, cleaned up the scratch file, and completed the SUMMARY.

## User Setup Required
None.

## Next Phase Readiness
- `encodeFightLog`/`decodeFightLog` are ready for Plan 03-04 to call directly when streaming a resolved round's fight logs to connected clients.
- The `AttackModifierFrame` fix also improves Phase 2's playback fidelity beyond what this plan strictly required — any future work reading `Unit.attackModifiers` from a played-back frame can now trust it is genuinely inert data, not a live callback waiting to be invoked somewhere unintended.
- No blockers for Plan 03-04 (depends on this plan + 03-03).

---
*Phase: 03-partykit-room-server*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: src/net/fightWire.ts
- FOUND: src/net/fightWire.test.ts
- FOUND: src/game/round.ts (modified)
- FOUND: .planning/phases/03-partykit-room-server/03-02-SUMMARY.md
- FOUND commit: 07ba225 (Task 1)
- FOUND commit: 6217c35 (Task 2 + fix)
