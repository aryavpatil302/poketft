---
phase: 04-client-networking-lobby-ui
plan: 04
subsystem: client-networking
tags: [dispatch-seam, game-action, drag-and-drop, board-ownership, item-bench, pool-conservation, partykit]

# Dependency graph
requires:
  - phase: 04-client-networking-lobby-ui plan 00
    provides: "src/game/round.ts's widened GameAction union — moveBoard.to accepting `{ bench: n }`, placeItem accepting `{ onHex }` | `{ onBench }`, and the new `{ t: 'removeItem'; from; index }` variant, each with its own validated applyAction branch"
  - phase: 04-client-networking-lobby-ui plan 03
    provides: "src/main.ts's `dispatchAction(action: GameAction): boolean` seam, `reportActionRejected`, `localTierComposition` / `detectStarUps` / `heldOnBoard` / `flashStarUps`, and `applyServerSnapshot`'s syncRunToBoard call"
  - phase: 04-client-networking-lobby-ui plan 01
    provides: "`net` / `isNetworked()` / `netDropped` / the `saveRun` wrapper, and scripts/netClient.ts's `probeClient` harness"
  - phase: 03-partykit-room-server plan 02
    provides: "party/lobby.ts's serial onMessage -> applyAction -> broadcast-snapshot loop and its per-connection MAX_ACTIONS_PER_PHASE budget"
provides:
  - "src/main.ts — `econBoardClick` and `econBoardSell` rewritten onto the seam: moveBoard / moveBench / placeItem(onHex) / sell(from:'board')"
  - "src/main.ts — the bench-cell click handler rewritten onto the seam: moveBench(bench target), moveBoard(bench target), the board-onto-occupied-bench swap expressed as moveBench, and placeItem(onBench)"
  - "src/main.ts — `removeHoveredItem` dispatches `{ t: 'removeItem', from, index }`"
  - "src/main.ts — visual-only pick-up: `liftedBoardHexKey`, `liftedBenchSlot`, `heldItemIndex`, `resolveHeldItemIndex()`, `boardIndexAtHex(hex)`, `cancelHeldUnit()`"
  - "src/main.ts — `sellHeldUnit` is now an ordinary `sell` dispatch; `placeDisplacedUnitAtOrigin`, `placeHeldUnitOnHex` and `equipHeldItemOn` are deleted, as is the `sellFromBoard` import"
  - "scripts/netClient.ts — scenario 12 (two clients against one pool); 12 scenarios total"
affects:
  - "Plan 04-05 (server-driven countdown) — every board/bench/item click is now a dispatch that inherits the `netDropped` gate and the 'wrong-phase' rejection rendering, so a drag made after the deadline explains itself instead of silently reshaping a board the server has already settled."
  - "Plan 04-06 — section A of its consolidated solo-regression checklist is the phase-exit gate for everything this plan rewrote; the checklist below is this plan's scoped subset. 04-06 also replaces startCombat's `isNetworked()` early-return with server-log playback, at which point the `!isNetworked()` guard now sitting on `autoFieldFromBench` becomes the load-bearing one rather than a second lock."
  - "NET-02 is complete: no input handler in src/main.ts mutates the economy outside `dispatchAction`."

# Actuals (#2632)
actuals:
  tokens: 62000
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pick-up is a gesture, the drop is the state change. Picking a unit or an item up now mutates nothing at all — no bench slot cleared, no placedUnits entry deleted, no itemBench splice. Three render-only markers (`liftedBoardHexKey`, `liftedBenchSlot`, `heldItemIndex`) make the source slot LOOK empty while the sprite rides the cursor. This is what makes a networked pick-up safe (there is nothing to unwind if the drop is refused) and it makes drop-on-own-hex a genuine no-op rather than a delete-then-recreate that happened to land in the same place."
    - "One ownership rule, stated at the seam. Solo: `applyAction` mutates `run.board` and `syncRunToBoard()` rebuilds `placedUnits` from it inside `dispatchAction`, so the live map is downstream of the engine rather than upstream of it. Networked: `placedUnits` is derived state only, rebuilt exclusively by `syncRunToBoard()` inside `applyServerSnapshot`. The rule is written above `dispatchAction` so a later reader cannot reconstruct it wrongly from the call sites."
    - "Client-side validation is advisory and says so in source. The player-half check and the board-cap check survive as immediate feedback (`flashHeldUnitRejected`, no round trip) but each carries a comment naming `applyAction` as the authority and the `ActionReason` it would return. T-04-40's mitigation is the comment as much as the re-validation."
    - "A swap nobody added an engine variant for. Dropping a BOARD unit onto an OCCUPIED bench slot is expressed as `moveBench` addressed at the occupant and sent to the held unit's own hex — which is exactly that swap. So the interaction survives networked play without a fourth `GameAction` shape, and `moveBoard`-to-bench stays the simple empty-slot case."
    - "The held item's index is re-resolved at drop time, not trusted from pick-up. `resolveHeldItemIndex()` keeps the remembered slot only while it still holds the same item id, otherwise looks the id up afresh, and returns null when the item is gone — the client half of T-04-43, layered on applyAction's own range check."

key-files:
  created: []
  modified:
    - src/main.ts
    - scripts/netClient.ts
    - .planning/phases/04-client-networking-lobby-ui/deferred-items.md

key-decisions:
  - "`dispatchAction`'s solo branch does NOT call `syncBoardToRun()` before `applyAction`, even though the plan's ownership discussion invites it. Two reasons, both discovered by writing it the other way first. (a) Correctness: the caller computes its board index against `run.board`, so re-deriving that array from `placedUnits` in between would shift the index out from under it. (b) Safety: `placedUnits` holds Ascender pillars that `reconcileAscenderPillars()` spawned straight into it and `run.board` has never seen; committing them first turns a bench-unit drop onto a pillar's hex into a swap that benches the pillar. Reading run.board as the single pre-existing array both sides address avoids both. `syncBoardToRun()` now has exactly ONE call site left in the file: startCombat's solo economy path."
  - "Board-onto-occupied-bench is dispatched as `moveBench(benchIndex: slot, to: originHex)` rather than being dropped as unsupported or given a new engine variant. `applyAction`'s `moveBench` hex-destination branch already swaps a bench unit with a board occupant, and addressing it at the OCCUPANT makes that swap the exact interaction the player performed. `moveBoard`-to-bench (04-00's new variant) is used only for the empty-slot case, which is the case it refuses to do when occupied ('occupied')."
  - "`returnHeldUnitToBench` was DELETED and replaced with `cancelHeldUnit`, not kept alongside. Its whole body — find the first free bench slot and rehome the held unit — existed because pick-up used to remove the unit from its slot. With a visual-only pick-up that same code would DUPLICATE the unit on every phase transition made mid-drag. This is the single most dangerous line in the refactor and it is why the rename is a rename rather than a no-op body swap: a leftover call to a function named `returnHeldUnitToBench` would read as harmless."
  - "`sellHeldUnit` (drag onto the shop bar) stops hand-rolling gold + pool + item accounting and becomes `{ t: 'sell', from, index }`. The hand-rolled version existed because the held unit 'isn't in any bench/board slot while held' — no longer true, and leaving it would have credited the seat a sale while the unit stayed on its slot."
  - "`removeHoveredItem` (`r`) no longer calls `pickUpItem`. The plan is explicit and the reason is concrete: `applyAction`'s `removeItem` branch pushes the item into `itemBench`, so also attaching it to the cursor would show one item in two places and let the player 'place' a copy of it. The item now lands back in the item bench and is picked up again from there. This is the one deliberate UX change in solo play and it is called out in the manual checklist."
  - "The advisory board-cap check moved to the bench-origin branch ONLY. With a visual-only pick-up the lifted board unit is still counted by `playerBoardUnitCount()`, so keeping the old unconditional check would have flash-rejected a legal board-to-board move made at cap. `applyAction` agrees: `moveBoard` never cap-checks (the fielded count is unchanged either way) and `moveBench` cap-checks only an empty-hex destination."
  - "`dropHeldUnit()` calls `renderBenchRow()` whenever a unit was actually held. Both the lifted slot and every empty cell's drop-target highlight need undoing, and neither a REFUSED action (dispatchAction returns without rendering) nor a NETWORKED one (the snapshot renders, eventually) would otherwise repaint the bench. The same reasoning puts an unconditional `renderItemBench()` after each item-equip dispatch."
  - "Scenario 12 shares scenarios 10-11's `partykit dev` process (PLANNING_MS=20000) but takes a FRESH room id, exactly as 04-02's scenarios 8-9 do. It needs the long window (every assertion must land inside one planning phase, or a settlement would let five bot seats shop against the same pool and make the conservation arithmetic a statement about `botPlanRound`) but not a room scenario 11 has already spent down to broke."
  - "Scenario 12's pool assertions compare client A's copy of a broadcast against client B's copy of the SAME broadcast — both waiters are keyed on one predicate over a frame the room broadcasts to every connection — rather than against a locally recomputed expectation. And the conservation delta is derived from the count of buys actually OBSERVED to apply, so a `pool-empty` refusal when the other seat wins the race for the last copy reads as a correct outcome instead of a red assertion."
  - "`npx tsc --noEmit` and `npx vitest run` still do not exit 0 on this repo and did not before this plan: 16 pre-existing tsc errors and 23 pre-existing test failures, byte-identical to the counts 04-03 re-confirmed, none in a file this plan touches. Verified scoped-clean, as 04-01 through 04-03 did."

requirements-completed: [NET-02]

coverage:
  - id: D1
    description: "Every remaining economy mutation in src/main.ts — board moves, board-to-bench moves, bench moves, board and bench sells, item placement onto a board OR a benched unit, and item removal — is expressed as a GameAction and routed through dispatchAction."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "`grep -c 'sellFromBoard(' src/main.ts` returns 0 and the import is gone; `dispatchAction(` has 1 definition + 16 call sites; the deleted helpers (placeDisplacedUnitAtOrigin, placeHeldUnitOnHex, equipHeldItemOn) leave no callers — `noUnusedLocals` would have failed the build otherwise."
        status: pass
    human_judgment: false
  - id: D2
    description: "The three previously-inexpressible interactions dispatch real actions rather than being special-cased away in networked mode: board-to-bench drag (moveBoard's bench target), equipping a BENCHED unit (placeItem's onBench target), and the `r`-key item pull (removeItem)."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "`grep -c removeItem src/main.ts` = 5, `grep -c onBench src/main.ts` = 2; no source comment declares any board, bench or item interaction unsupported in networked mode."
        status: pass
      - kind: manual
        ref: "Manual checklist M3, M8, M9 (solo) and N2, N3, N4 (two-tab lobby)"
        status: deferred
    human_judgment: true
  - id: D3
    description: "Board and bench placement in a networked lobby does not locally mutate placedUnits ahead of the server; placedUnits is derived state rebuilt exclusively by syncRunToBoard inside applyServerSnapshot."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "The 10 remaining `placedUnits.set(`/`.delete(` sites are: loadScenario + placeUnit/removeUnit (test mode, never networked), the three reconcileAscenderPillars sites (auto-spawn, not an input handler), autoFieldFromBench (now guarded on `!isNetworked()`), syncRunToBoard itself, startCombat's solo pre-fight rebuild, and restorePlayerBoard's post-playback rebuild. None is inside an input handler at all, let alone a networked branch. econBoardClick and the bench-cell handler contain zero placedUnits writes."
        status: pass
    human_judgment: false
  - id: D4
    description: "Picking a unit up is a purely visual gesture in both modes — it dispatches nothing, and dropping it back on its origin hex is a no-op that neither duplicates nor loses the unit."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "econBoardClick's pick-up branch sets `liftedBoardHexKey` and calls pickUpUnit only; the bench pick-up sets `liftedBenchSlot` only; the item-slot click records an index and no longer splices. The own-hex drop returns after `dropHeldUnit()` without dispatching. `returnHeldUnitToBench`'s rehoming body — which would now duplicate — was deleted."
        status: pass
      - kind: manual
        ref: "Manual checklist M4 (drop on own hex), M10 (start combat mid-drag)"
        status: deferred
    human_judgment: true
  - id: D5
    description: "Client-side board-cap and player-half checks remain as immediate feedback but are advisory only; applyAction performs the authoritative check and a refusal surfaces through reportActionRejected (T-04-40)."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "Both checks carry an in-source comment naming applyAction as the authority and the ActionReason it returns ('not-player-hex', 'board-full'). The cap check now runs only on the bench-origin branch, matching applyAction's own rule that only a bench-to-empty-hex move ADDS a fielded unit."
        status: pass
      - kind: manual
        ref: "Manual checklist M7 (overfill past the level cap)"
        status: deferred
    human_judgment: true
  - id: D6
    description: "Two clients buying against one shared pool stay conserved: both clients' snapshots agree on the full pool map after every buy, and the total units removed equals the total successful buys across both seats."
    requirement: "NET-02"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 12. Observed: 4 buys across 2 seats, pool 1210 -> 1206, both clients' pool maps identical after every one of the four; fielding changed no pool copy; round stayed at 1 so no bot seat shopped."
        status: pass
    human_judgment: false
  - id: D7
    description: "Neither seat's board or item actions leak into the other seat's state (T-04-42)."
    requirement: "NET-02"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 12 fields seat 0 onto (2,6) and seat 1 onto (4,5) and asserts each seat's board holds exactly its own entry on its own hex, that neither board contains the other's hex, and that both clients hold byte-identical RunStates."
        status: pass
    human_judgment: false
  - id: D8
    description: "Solo drag-and-drop regression — bench-to-hex, board-to-hex swap, board-to-bench, right-click sell, item equip on board and bench, item removal, cap rejection — behaves as before the refactor."
    requirement: "NET-02"
    verification:
      - kind: manual
        ref: "Manual checklist M1-M11. THIS IS THE ONLY GATE: `npx vitest run` does not cover src/main.ts (accepted risk, recorded in the plan's must_haves as verification:backstop). The phase-exit gate is plan 04-06's checklist section A."
        status: deferred
    human_judgment: true

duration: 55min
completed: 2026-08-20
status: complete
---

# Phase 4 Plan 4: Board, Bench & Item Interactions Through the Seam Summary

**Every drag-and-drop economy interaction — board moves, board-to-bench moves, bench moves, board and bench sells, item equips onto board OR benched units, and item removal — is now a `GameAction` handed to the same `dispatchAction` seam plan 04-03 built, and picking a unit or an item up mutates nothing at all until the drop lands.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Commits:** 3 (2 code + 1 docs)
- **Files:** 2 source files changed, 500 insertions, 165 deletions

## Task Commits

1. **Task 1: Board, bench and item interactions through the same seam** — `3e0ff6c` (feat)
2. **Task 2: Prove pool conservation with two clients shopping at once** — `4834e4d` (test)
3. **Docs: this summary + deferred items** — see final commit

## Accomplishments

### Task 1 — the ownership rule, stated once and enforced by deletion

The comment block above `dispatchAction` now carries the rule in two paragraphs:

- **Solo** — `placedUnits` is still the working surface, but it is no longer what input handlers *write*. `applyAction` mutates `run.board` synchronously and `syncRunToBoard()` rebuilds `placedUnits` from it inside `dispatchAction`, before anything renders. The live board is downstream of the engine instead of upstream of it.
- **Networked** — `placedUnits` is derived state only. No handler adds, deletes or moves an entry; `applyServerSnapshot`'s `syncRunToBoard()` is the sole writer. The networked branch returns *before* the rebuild, which is what makes that true structurally rather than by discipline.

The rule holds because the code that could break it is gone, not guarded:

| Deleted | Why it could not survive |
|---------|--------------------------|
| `placeHeldUnitOnHex` | Created a live `Unit` straight into `placedUnits` — an optimistic board edit by definition |
| `placeDisplacedUnitAtOrigin` | Hand-rolled the swap `applyAction`'s `moveBoard`/`moveBench` already perform, against `placedUnits` and `bench` directly |
| `equipHeldItemOn` | Wrote `unit.items` and pushed the displaced item to `itemBench` locally |
| `returnHeldUnitToBench`'s body | Rehomed the held unit onto the first free bench slot — with a visual-only pick-up that **duplicates** it |
| the `sellFromBoard` import | `grep -c "sellFromBoard(" src/main.ts` is now 0 |

`syncBoardToRun()` has exactly **one** call site left in the whole file: `startCombat`'s solo economy path, where the engine needs `run.players[..].board` committed before `resolveRound`.

### Task 1 — pick-up as a gesture

Three render-only markers replace the old "delete from the slot on pick-up" model:

- `liftedBoardHexKey` — `render()`'s preview map skips that one hex, so the unit is drawn on the cursor instead of on the board while staying in `placedUnits` *and* in `run.board`;
- `liftedBenchSlot` — `benchCellHTML` renders that slot as if empty (including as a drop target) while the entry stays in `econ.bench`;
- `heldItemIndex` — `renderItemBench` draws that slot empty while the item stays in `itemBench`, which is what lets `applyAction`'s `placeItem` branch be the only thing that ever removes it.

Consequences that fall out for free: dropping a unit back on its own hex is a real no-op (it returns before dispatching — there is nothing to undo and nothing to ask the server for), a refused drop leaves the unit exactly where it was with an amber notice explaining why, and starting combat mid-drag simply puts the cursor sprite away.

### Task 1 — the interaction table

Every branch now names an action:

| Gesture | Action dispatched |
|---------|-------------------|
| Bench unit → empty or occupied player hex | `{ t: 'moveBench', benchIndex, to: { col, row } }` |
| Board unit → another player hex | `{ t: 'moveBoard', from: hex, to: { col, row } }` |
| Board unit → **empty** bench slot | `{ t: 'moveBoard', from: hex, to: { bench: slot } }` — 04-00's new variant |
| Board unit → **occupied** bench slot | `{ t: 'moveBench', benchIndex: slot, to: originHex }` — the same swap, addressed at the occupant |
| Bench unit → another bench slot | `{ t: 'moveBench', benchIndex, to: { bench: slot } }` |
| Held item → board unit | `{ t: 'placeItem', itemIndex, onHex }` |
| Held item → benched unit | `{ t: 'placeItem', itemIndex, onBench: slot }` — 04-00's new variant |
| `r` over a unit holding an item | `{ t: 'removeItem', from, index }` — 04-00's new variant |
| Right-click a board unit | `{ t: 'sell', from: 'board', index }` |
| Drag a unit onto the shop bar | `{ t: 'sell', from: 'bench' \| 'board', index }` |
| Pick anything up | *nothing* |
| Drop a unit on its own hex | *nothing* |
| Drop an item back on the item bench | *nothing* |

The board-onto-occupied-bench row is the one worth pausing on. `applyAction`'s `moveBoard`-to-bench branch refuses an occupied slot (`'occupied'`), so a literal reading would have made that gesture a rejection in both modes — a capability quietly lost. Addressing the same swap at the *occupant* via `moveBench`'s hex destination expresses it exactly, with no fourth engine variant and no change to `src/game/round.ts`.

### Task 1 — advisory checks, said out loud

The player-half check and the board-cap check both survive as instant local feedback, and both now carry a comment naming `applyAction` as the authority and the `ActionReason` a refusal would carry. The cap check additionally **moved** to the bench-origin branch only: with a visual-only pick-up the lifted board unit is still counted by `playerBoardUnitCount()`, so an unconditional check would have flash-rejected a perfectly legal board-to-board move made at cap. That matches the engine exactly — `moveBoard` never cap-checks (the fielded count is unchanged either way) and `moveBench` cap-checks only an empty-hex destination.

### Task 2 — two clients, one pool, proven

`scripts/netClient.ts` scenario 12 drives two real `RoomClient`s against a live `partykit dev` room on the long-planning-window process (fresh room id — scenarios 10-11 leave theirs broke).

Both seats' buys go out **back to back with no await between them**, so the room genuinely has two intents in flight against one pool. Four waiters are registered before either send: each seat's view of its own buy, and each seat's view of the other's. Because a `snapshot` is broadcast to every connection, the two waiters keyed on one predicate resolve on the *same* frame — which is what makes comparing them a statement about the wire rather than about one client's arithmetic.

Observed on the passing run:

```
OK: after seat 0's buy #1 both clients report an identical pool map
OK: after seat 1's buy #1 both clients report an identical pool map
OK: after seat 0's buy #2 both clients report an identical pool map
OK: after seat 1's buy #2 both clients report an identical pool map
OK: exactly 4 copies left the shared pool across 4 successful buys — none duplicated, none vanished (1210 -> 1206)
OK: seat 0's moveBench was applied over the wire, not refused (snapshot)
OK: seat 1's moveBench was applied over the wire, not refused (snapshot)
OK: both clients hold byte-identical RunStates once both placements have landed
OK: seat 0's board holds exactly its own fielded unit, on its own hex ([{"col":2,"row":6}])
OK: seat 1's board holds exactly its own fielded unit, on its own hex ([{"col":4,"row":5}])
OK: neither seat's placement reached the other seat's board (T-04-42)
OK: fielding changed no pool copy at all — a move relocates, it never mints or returns (1206 -> 1206)
OK: no round settled during the scenario, so every pool change is attributable to these two seats (round stayed at 1)
```

Three things the scenario refuses to assume, each for a concrete reason:

- **The expected pool delta is derived from the buys observed to apply**, not hardcoded. A `pool-empty` refusal when the other seat wins the race for the last copy is a *correct* outcome; hardcoding would have turned it red.
- **The `no round settled` assertion is load-bearing**, not decoration. A settlement would let five bot seats shop against the same pool and silently make the conservation arithmetic a statement about `botPlanRound`.
- **The affordable slot is read from `UNIT_MAP`**, so a shop that rolled something expensive is skipped rather than producing a `'no-gold'` that the script would have to interpret.

## Automated verification — what actually passes

Run from the worktree at commit `4834e4d`:

| Check | Result |
|-------|--------|
| `npm run net:client` | **PASS** — exit 0, `all assertions passed across 12 scenario(s)`, including the new one |
| `npx tsc --noEmit`, scoped to touched files | **PASS** — 0 errors in `src/main.ts`, 0 in `scripts/netClient.ts` |
| `npx vite build` | **PASS** — 414 modules transformed, built clean in 1.77s |
| `npx tsc --noEmit`, whole repo | **FAIL (pre-existing)** — 16 errors, all in `src/core/abilities/*`, `src/core/systems/*`, `src/sim/runner.ts`. Byte-identical to the list logged in `deferred-items.md` during 04-01 and re-confirmed by 04-03. None in a file this plan touches. |
| `npx vitest run` | **FAIL (pre-existing)** — 23 failed / 1327 passed across 105 files, the exact counts 04-03 re-confirmed. **Nothing in the repo imports `src/main.ts`**, so this plan cannot have moved them either way. |

`dist/` is tracked in this repo, so the `vite build` output was reverted (`git checkout -- dist` plus deleting the new untracked hashed bundle and two copied assets) before staging — per the note 04-03 left in `deferred-items.md`.

### The verification gap this plan carries deliberately

`npx vitest run` **does not cover `src/main.ts`** — the file has no suite and nothing imports it. So a green test run proves nothing about the drag-and-drop handlers this plan rewrote, which are precisely the riskiest surface in the phase. That is an accepted risk recorded in the plan's own `must_haves` as `verification: backstop`, not a gap discovered here, and this repo has no browser automation to close it with. The compensating control is human verification; the **single phase-exit gate is plan 04-06's `<verification>` block, section A**. Everything below is this plan's scoped subset of it.

## Manual verification checklist

**M1-M11 need only a solo game:** `npm run dev`, then *Start Solo Game*. Buy a few units first so there is something to drag, and pick up an item from a Delibird round (or play to one) for the item rows.

**N1-N6 need two browser tabs against a running room:** `npm run room:dev` in one terminal and `npm run dev` in another; open the app, click *Start Multiplayer Game*, copy the share link into a second tab, then click *Start* in the host tab.

### Solo — nothing may have changed

| # | Do this | Expect |
|---|---------|--------|
| M1 | Drag a bench unit onto an **empty** player hex | Unit appears on the hex, its bench slot empties, trait badges update. The bench slot must look empty *while dragging* and stay empty after |
| M2 | Drag a board unit onto an **occupied** player hex | A true swap — the two units exchange hexes, neither ends up on the cursor, neither is lost |
| M3 | Drag a board unit onto an **empty bench slot**, then onto an **occupied** one | Empty slot: unit moves to the bench, hex clears. Occupied slot: a swap — the benched unit takes the hex, the board unit takes the slot. **Neither may duplicate or vanish** |
| M4 | Pick a board unit up and drop it back on **its own hex** | Absolutely nothing happens: one unit, same hex, same item, same star level. No duplicate, no loss, no gold change |
| M5 | Drag a bench unit onto **another bench slot**, empty and occupied | Empty: it moves. Occupied: the two swap |
| M6 | **Right-click** a board unit; separately, hover one and press `e` | It sells, gold rises by its sell value, its copies return to the pool, the hex clears, trait badges update |
| M7 | Fill the board to your level cap, then drag one more bench unit onto an empty hex | The cursor sprite **flashes/rumbles** and the unit stays on the cursor. Then move a unit already on the board from one hex to another at full cap — **this must still work**, no flash |
| M8 | Pick an item off the item bench and click a **board** unit; then a **benched** unit | The item attaches to that unit and its icon appears on it. Its item-bench slot must look empty *while carrying* and be gone after. If the unit already held an item, the old one returns to the item bench |
| M9 | Hover a unit holding an item and press `r` — once on a board unit, once on a benched one | The item comes **off the unit and back into the item bench**. ⚠️ **This is the one intentional UX change**: `r` used to put the item on your cursor. Pick it back up from the item bench to re-place it |
| M10 | Pick a unit up, then click **Start** without dropping it | Combat starts and the unit is still on the board/bench where you picked it up — not rehomed to a random free bench slot, and **not duplicated** |
| M11 | Pick an item up, then click empty space in the item-bench panel | The item returns to its slot. The item bench must hold exactly the same items as before — **no extra copy** |
| M12 | Drag a unit onto the **shop bar** and click the "Sell (X)" overlay | It sells for the shown value from whichever slot it came from (bench or board), gold rises once, copies return to the pool once |

### Two-tab lobby — the same gestures, server-owned

| # | Do this | Expect |
|---|---------|--------|
| N1 | In the guest tab, drag a bench unit onto an empty hex | The unit appears on that hex **after a brief round trip**. It must not appear before the server answers, and it must not "snap back" |
| N2 | In the guest tab, drag a **board unit onto a bench slot** (both an empty and an occupied one) | Works exactly as in M3 — this is the interaction that had no `GameAction` before 04-00 and must not be a no-op here |
| N3 | In the guest tab, pick an item off the item bench and click a **benched** unit | The item attaches to the benched unit. This is `placeItem`'s `onBench` target over the wire |
| N4 | In the guest tab, hover a unit holding an item and press `r` | The item returns to that tab's item bench — `removeItem` over the wire |
| N5 | In both tabs, buy repeatedly at the same time | Each tab's shop and gold move only from its own buys, and the **shared pool count agrees** — the same property scenario 12 asserts, seen by eye |
| N6 | In the host tab, right-click a board unit to sell it | It sells in the host tab only. The guest tab's own board is untouched |

> N1-N6 overlap plan 04-06's section A. They are listed here so this plan's slice is verifiable in isolation; **04-06 remains the single phase-exit gate**.

## Deviations from Plan

### Departures from the written action

**1. `dispatchAction`'s solo branch does NOT pre-commit `placedUnits` into `run.board`**

- **Found during:** Task 1, after writing it the way the plan's ownership paragraph invites ("in solo mode `placedUnits` stays the working surface … `syncRunToBoard` immediately reconciles")
- **Issue:** A `syncBoardToRun()` before `applyAction` breaks two things. (a) The caller has already computed its board index against `run.board`; re-deriving that array in between shifts the index out from under it. (b) `placedUnits` holds Ascender pillars that `reconcileAscenderPillars()` spawned straight into it and `run.board` has never seen — committing them first turns a bench-unit drop onto a pillar's hex into a swap that puts the pillar on the bench.
- **Fix:** No pre-sync. `run.board` is the single pre-existing array both the caller's index computation and `applyAction` address, so they agree by construction. A post-`syncRunToBoard()` still runs for every board-addressing action. Both decisions are commented in place.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

**2. Board-onto-occupied-bench dispatched as `moveBench`, not `moveBoard`**

- **Found during:** Task 1, reading `applyAction`'s `moveBoard`-to-bench branch
- **Issue:** That branch returns `'occupied'` for a taken slot. Dispatching `moveBoard` for the occupied case would have turned a working solo swap into a rejection in both modes — a lost capability, which the plan's own must_have forbids.
- **Fix:** `{ t: 'moveBench', benchIndex: slot, to: originHex }` — `moveBench`'s hex branch already swaps a bench unit with a board occupant, and addressing it at the occupant makes that swap the exact gesture performed. `moveBoard`-to-bench is used for the empty-slot case only.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

### Auto-fixed issues

**3. [Rule 1 - Bug] `sellHeldUnit` would have credited a sale twice**

- **Found during:** Task 1, after making pick-up visual-only
- **Issue:** `sellHeldUnit` hand-rolled gold + pool + item accounting because the held unit "isn't in any bench/board slot while held". Once pick-up stopped removing the unit, that comment stopped being true — the function would have paid out a sale while leaving the unit standing in its slot.
- **Fix:** Rewritten as `{ t: 'sell', from: 'bench' | 'board', index }` addressed at the slot the unit is still in.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

**4. [Rule 1 - Bug] `returnHeldUnitToBench` would have duplicated a unit on every mid-drag phase transition**

- **Found during:** Task 1, same cause
- **Issue:** Its body found the first free bench slot and wrote the held unit into it. With a visual-only pick-up the unit had never left, so `startPlanningPhase` / `startItemRound` / `startCombat` / the test-mode toggle would each have minted a copy.
- **Fix:** Deleted the body and **renamed** the function to `cancelHeldUnit` (all four call sites updated). The rename is deliberate: a leftover call to something still named `returnHeldUnitToBench` would read as harmless.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

**5. [Rule 1 - Bug] The advisory board-cap check would have rejected legal board-to-board moves at cap**

- **Found during:** Task 1
- **Issue:** With the lifted unit still in `placedUnits`, `playerBoardUnitCount()` no longer drops by one on pick-up, so the old unconditional check would have flash-rejected a hex-to-hex move made at full cap.
- **Fix:** The check runs on the bench-origin branch only, and only for an empty destination — exactly `applyAction`'s own rule.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

**6. [Rule 2 - missing critical functionality] `resolveHeldItemIndex()` re-resolves the item index at drop time**

- **Found during:** Task 1
- **Issue:** The plan says to record the item-bench index at pick-up. In a lobby a server snapshot can land between pick-up and drop and re-order `itemBench` underneath the cursor, so a remembered index can name a different item. `applyAction` would validate the *range* and happily equip the wrong item.
- **Fix:** The remembered slot is trusted only while it still holds the same item id; otherwise the id is looked up afresh, and `null` (item gone entirely) suppresses the dispatch. The client half of T-04-43. `renderItemBench` draws the resolved slot empty, not the remembered one.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

**7. [Rule 2] Unconditional repaint after every ended gesture**

- **Found during:** Task 1
- **Issue:** `dispatchAction` re-renders on a **local success only**. On a refused action, and on every networked action, nothing repaints the bench row or the item bench — so the lifted slot's hole and the drop-target highlights would persist until some unrelated render.
- **Fix:** `dropHeldUnit()` calls `renderBenchRow()` whenever a unit was actually held; each item-equip dispatch is followed by an unconditional `renderItemBench()`.
- **Files modified:** `src/main.ts`
- **Commit:** `3e0ff6c`

### Intentional behaviour changes in solo play

- **`r` no longer puts the removed item on the cursor.** It returns to the item bench, per the plan's explicit instruction — `applyAction`'s `removeItem` branch pushes it there, and also calling `pickUpItem` would show one item in two places. Checklist item **M9**.
- **Trait badges and the `n/level` board watermark no longer flicker mid-drag.** A lifted unit is still in `placedUnits`, so it is still counted while it rides the cursor. Cosmetic, and arguably the nicer behaviour; noted so it is not read as a bug.
- **A drop the engine refuses now shows an amber notice** (e.g. dropping a board unit onto an occupied bench slot in a case `applyAction` declines) where the old local code silently did its own thing.

### Out of scope — logged, not fixed

Two pre-existing issues surfaced by reading the swap paths closely; both reproduce identically before and after this plan and both live in `src/game/round.ts` or in gameplay-readability territory. Written up in `deferred-items.md`:

- **Ascender pillars can be swapped onto the bench** — `applyAction`'s `moveBench` swap branch has no `isPillar` guard on the *displaced* entry, so dragging a bench unit onto a pillar's hex benches the pillar and `reconcileAscenderPillars()` then spawns a duplicate. One-line engine fix, not this plan's surface.
- **The client's advisory cap count includes pillars, `applyAction`'s does not** — so a player with an active Ascender trait can see an advisory rejection for a placement the engine would allow. Left exactly as found.

## Threat Flags

None. The register's dispositions all hold as written:

- **T-04-40 (mitigate)** — the player-half and board-cap checks are explicitly advisory in source, each naming `applyAction` and the `ActionReason` a refusal carries. `applyAction` re-validates every action including the three new variants, and refusals reach `reportActionRejected` in both modes.
- **T-04-41 (mitigate)** — no handler mutates `placedUnits` or `itemBench` optimistically; pick-up mutates nothing at all, which removes the duplication window rather than guarding it. Scenario 12 asserts pool conservation end to end with two live clients.
- **T-04-42 (accept)** — `GameAction` still carries no seat field and the three new variants add none; `party/lobby.ts` resolves the acting seat from connection identity. Scenario 12 asserts neither client's action altered the other's board.
- **T-04-43 (mitigate)** — `applyAction`'s `placeItem`/`removeItem` branches range-check the index against the seat's own `itemBench`. `resolveHeldItemIndex()` adds a client-side identity check on top, which was not in the plan.
- **T-04-SC** — no package installed; no install task exists.

## Self-Check: PASSED

- `src/main.ts` — FOUND; 16 `dispatchAction(` call sites; 0 `sellFromBoard(`; 5 `removeItem`; 2 `onBench`; `autoFieldFromBench` guarded on `!isNetworked()`; one `syncBoardToRun()` call site (startCombat's solo path)
- `scripts/netClient.ts` — FOUND; 12 scenarios; `npm run net:client` exits 0
- `.planning/phases/04-client-networking-lobby-ui/04-04-SUMMARY.md` — FOUND (this file)
- `.planning/phases/04-client-networking-lobby-ui/deferred-items.md` — FOUND, two new entries
- Commit `3e0ff6c` — FOUND
- Commit `4834e4d` — FOUND
