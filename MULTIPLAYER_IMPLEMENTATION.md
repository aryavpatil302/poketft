# Multiplayer Implementation Guide (execution-ready)

> Detailed, task-by-task build plan for turning this single-player TFT auto-battler into an
> online, **play-with-friends** game using **PartyKit** rooms with **server-authoritative,
> deterministic** combat. Companion to the higher-level `MULTIPLAYER_PLAN.md`; this doc is the
> one to *execute* — every task names exact files, functions, and current line numbers (verified
> this session), plus a code sketch and how to verify it.

## 0. Decisions & goal (locked)

- **Transport:** PartyKit — one serverless room per lobby. Rooms run on V8 workers so float math
  matches the browser (safe for deterministic replay).
- **Milestone for this build:** Phases 0–3(local). End state = a **local** PartyKit room that
  **two browser tabs can join by code and play a full round together**. Single-player must stay
  **behavior-identical**. Deploy, reconnect/resync, spectating, idle auto-lock = Phase 4 (later).
- **Combat model:** the server is authoritative and computes each fight **deterministically from a
  seed**. When two players are matched, the server picks the fight's seed; **both clients re-run
  the identical sim from that seed** (each rendering its own seat on the near side), so both see
  the same combat. The server never streams per-tick combat data.
- **6 seats** (`PLAYER_COUNT`); 1–6 humans, remaining seats filled by the existing bot personas.

## 1. Why this is tractable (audit results — current, this session)

- **Every seat is symmetric.** Human and bot seats are both `PlayerEcon`; the whole economy +
  matchmaking + resolution already lives in one place (`src/econ/botMatches.ts` +
  `main.ts`'s settlement block). It just runs on the human's client today.
- **`RunState` is pure JSON** (`src/econ/runState.ts`): only plain objects/arrays/primitives
  (`pool: Record<string,number>`, `players: PlayerEcon[]`, `cliffPositions: Record<...>`). No Maps,
  functions, or class instances → trivially serializable for a room.
- **Storage is already abstracted** (`EconStorage`, `runState.ts:54`) → swap localStorage for a
  room store behind the same interface.
- **Core combat is headless** (`src/core/*`, zero DOM) → the room imports it directly.

### The two things that must change (and were re-verified)

1. **Determinism.** Combat currently uses `Math.random`. It must be seeded. **Refined finding:
   only 5 GAMEPLAY-RNG sites matter** (crit, target tie-break, 3 ability picks). The 7 ID-minting
   sites (`Math.random`/`crypto.randomUUID` for unit/projectile/shield ids) **do NOT need to
   change** — verified no combat logic sorts or compares by id value, each sim is self-consistent,
   and clients re-sim independently (they never correlate ids with the server). Determinism here
   means **same outcome** (HP/positions/deaths/event order), not byte-identical ids.
   > A shared RNG module already exists: **`src/core/rng.ts`** (created this session) exports
   > `type Rng`, `seededRng(seed)` (LCG), and `rngPick(rng, arr)`. Use it.

2. **Seat assumption + abstract bot fights.** `humanEcon()` hard-codes `run.players[0]`, and only
   the human's fight is *real* combat — bot-vs-bot is resolved **abstractly** by board-power compare
   (`resolveBotFight`, `botMatches.ts:49`); the human's live result is *injected* into
   `resolveBotRound`. Multiplayer needs: (a) a `localSeatIndex` instead of "seat 0", (b) a round
   loop that runs **real combat for every matchup involving a human**, authoritatively.

---

## Phase 0 — Deterministic + seat-agnostic core (no networking; single-player unchanged)

Goal: after Phase 0, single-player plays identically, but combat is seed-reproducible and the
"human is seat 0" assumption is gone. This is independently shippable and de-risks everything.

### Task 0a.1 — Add `rng` to `CombatState`, seed it in `createCombatState`
- **`src/core/types.ts`** — `CombatState` (currently lines ~448-461, fields: `tick, phase, units,
  projectiles, events, hexOccupancy, terrain, tailwind, earthquakeCounts, spellBuffCounters,
  persistentAoEZones, stage?`). Add: `rng: Rng` (import `Rng` from `./rng`).
- **`src/core/combatEngine.ts`** — `createCombatState(playerUnits, enemyUnits, stage?)` (line 19).
  Add a `seed = 0` param; set `rng: seededRng(seed)` in the state literal (import from `./rng`).
  ```ts
  export function createCombatState(playerUnits, enemyUnits, stage?, seed = 0): CombatState {
    ...
    const state: CombatState = { ..., rng: seededRng(seed), stage }
  ```
- Default `seed = 0` keeps every existing caller (tests, single-player, sim) compiling and
  behaving deterministically-by-default; callers that want variety pass a real seed.
- **Verify:** `npx tsc --noEmit` clean.

### Task 0a.2 — Replace the 5 gameplay `Math.random` sites with `state.rng()`
Thread `state` (or `rng`) into each and swap. Exact sites:
1. **`src/core/systems/damage.ts:43`** — `rollCrit(unit)`: `return Math.random() < chance`.
   `rollCrit` currently takes only `unit`. Change signature to `rollCrit(unit, state)` (or pass
   `rng`) and use `state.rng() < chance`. Update its callers in `damage.ts` (crit gate ~line 125)
   and `attack.ts` (windup pre-roll — search `rollCrit(`).
2. **`src/core/systems/targeting.ts:70`** — `return tiePool[Math.floor(Math.random()*tiePool.length)].id`.
   `chooseTarget`/the tie-break helper needs `state`; use `rngPick(state.rng, tiePool).id`.
   (Its callers in `tickTargeting` already have `state`.)
3. **`src/core/abilities/a_exeggutor.ts:64`** — `bounceTargets[Math.floor(Math.random()*…)]`.
   The ability `onHit`/handler has `state` (`st`); use `rngPick(st.rng, bounceTargets)`.
4. **`src/core/abilities/gible.ts:31`** — `pool[Math.floor(Math.random()*pool.length)]`. Use
   `rngPick(state.rng, pool)`.
5. **`src/core/abilities/unown.ts:27`** — `HP_TYPES[Math.floor(Math.random()*3)]`. Use
   `rngPick(state.rng, HP_TYPES)`.
- **Leave alone** (ids, do NOT change): `unitFactory.ts:306`, `projectile.ts:22`,
  `morelull.ts:68/105`, `xatu.ts:21`, `traitEffects.ts:118`, `traitEffects.ts:1148`.
- **Verify:** `npx vitest run src/core` still green (existing combat tests are seed-0 deterministic).

### Task 0a.3 — Determinism guard test
- New **`src/core/determinism.test.ts`**: build two identical boards, run `createCombatState(p,e,
  undefined, 12345)` twice, tick both to completion (reuse the tick loop from
  `src/sim/botLeague.ts`'s `runOneCombat` or `runCombat`), and assert **normalized outcomes match**:
  for each unit (keyed by `defId+startHex+team`) compare final `currentHp`/`state`, and compare the
  `events` stream with `sourceId`/`targetId`/ids **stripped** (compare `type/amount/damageType/
  abilityId/second`). Also assert two runs at *different* seeds differ (sanity).
- This is the real guard against gameplay non-determinism (a future ability using raw `Math.random`
  for a decision will fail it). We deliberately do **not** lint against `Math.random` globally
  because id-minting legitimately uses it.

### Task 0b — `localSeatIndex` (kill the "seat 0 = human" assumption)
- **`src/main.ts`** — `humanEcon()` is defined at **line 1687**: `return run.players[0]`. It's the
  single accessor; ~50 call sites route through it. Introduce `let localSeatIndex = 0` (near the
  other run-state module vars, e.g. by `currentOpponentIndex` at line 1667) and change:
  `function humanEcon(): PlayerEcon { return run.players[localSeatIndex] }`.
- Grep for any *direct* `run.players[0]` outside `humanEcon` (audit found only the one inside it) and
  route them through `humanEcon()`/`localSeatIndex`.
- **Verify:** single-player unchanged (localSeatIndex stays 0); full app still playable in browser.

### Task 0c — Symmetric matchmaking (`src/econ/botMatches.ts`)
Today these assume seat 0 = the one human, seats 1..N = abstract bots:
- `pickNextOpponent(state, rng)` (line 79) — returns a living seat `!== 0`.
- `resolveBotRound(state, humanOpponentResult, rng)` (line 96) — settles the human's injected
  result, then abstractly pairs the *other* bots.
- `resolveBotCreepRound(state, rng)` (line 170), `checkGameOver(state)` (line 197, `human =
  players[0]`).

Generalize to seat-symmetric (a seat is **human iff `personaId === null`**):
- `pickNextOpponent(state, forSeat, rng)` — pick a living seat `!== forSeat`, avoiding an immediate
  rematch where possible (keep the existing anti-repeat logic, parameterized by `forSeat`).
- `checkGameOver` → return the winner/among-survivors when **one** living seat remains (or the
  local seat's win/loss for UI). Keep a back-compat wrapper if convenient.
- **Do not** fully rewrite `resolveBotRound` here — that logic moves into `resolveRound` in Phase 1.
  In Phase 0, minimally parameterize so N=1 reproduces today exactly.
- **Verify:** N=1 single-player identical; add a unit test that 2 humans + 4 bots pair with no seat
  fighting itself and eliminations shrink the pool of opponents.

**Phase 0 done when:** `npx vitest run` green (minus the known pre-existing `crashout`-family /
`bots.test.ts` greed-spike / flaky-generator failures), determinism test passes, browser
single-player fully playable.

---

## Phase 1 — Transport-agnostic round module (`src/game/round.ts`)

Goal: one pure module over `RunState` (no DOM, no network) that both single-player `main.ts` and
the room call. This is the seam the whole design hinges on.

### The action type
```ts
export type GameAction =
  | { t: 'buy'; slot: number }
  | { t: 'sell'; from: 'bench'|'board'; index: number }   // or hex
  | { t: 'reroll' }
  | { t: 'buyXp' }
  | { t: 'lock' }                                          // toggle shop lock
  | { t: 'moveBoard'; from: Hex; to: Hex }
  | { t: 'moveBench'; benchIndex: number; to: Hex | { bench: number } }
  | { t: 'placeItem'; itemIndex: number; onHex: Hex }
```

### Task 1.1 — `applyAction(state, seat, action)`
- Pure function mutating `state.players[seat]` (+ shared `state.pool`). Reuse existing mutators
  **unchanged**: `buyUnit(state, econ, slot)`, `reroll`, `sellFromBench/Board`, `buyXp` (`xp.ts`),
  board/bench move helpers (lift the current drag-drop logic out of `main.ts`), `placeItem`
  (item bench pipeline). Validate seat ownership + affordability; ignore illegal actions.
- Pool-safety is automatic when the room applies actions **serially** (single-threaded event loop).

### Task 1.2 — `startPlanning(state)`
- Lift from `main.ts:startPlanningPhase` (line 3031): for **every living seat**, bank
  `pendingIncome` (make `pendingIncome` per-seat — it already is on `PlayerEcon`), settle interest,
  roll each unlocked shop (`rollShop`), clear `shopLocked` as today. No DOM.

### Task 1.3 — `resolveRound(state, roundSeed): RoundResult`
- **This replaces `main.ts:4123-4172` + the injection model in `resolveBotRound`.**
- Steps:
  1. **Pair all living seats deterministically** from `roundSeed` (seeded shuffle; carry the
     anti-immediate-rematch preference). Odd seat out → bye (settle as a win, as today's bye path).
  2. For each pair, derive a per-fight `seed_i = hash(roundSeed, round, seatA, seatB)`.
  3. **Run the matchup:**
     - If **either seat is human** → run **real** headless combat: build both boards
       (`boardToSpecs`), `createCombatState(playerUnits, enemyUnits, stage, seed_i)`, tick to
       completion (reuse the tick loop), read the result (winner, survivor stars, damage for HP
       loss, Cave-Crawler quakes).
     - If **both seats are bots** → keep the fast abstract `resolveBotFight(a,b)` (perf; visuals
       never needed). *(Optional later: make these real too for consistency.)*
  4. **Settle** each seat's HP/streak/elim from its result (reuse `settleHumanRound`/`settleRound`
     generalized to any seat), Cave-Crawler rewards, return eliminated boards to `state.pool`.
  5. Every living **bot** seat plans its next board (reuse `botPlanRound`, targeting the *table's*
     power, not `players[0]`).
  6. `state.round++`; set each seat's `nextOpponent`; `checkGameOver`.
- **Return** `RoundResult`: per-seat `{ opponentSeat, opponentBoard, seed_i, result }` so clients can
  replay their own fight, plus the new authoritative `RunState` (mutated in place).

### Task 1.4 — Rewire single-player `main.ts` to call the module
- `startCombat()`/settlement no longer resolve inline; instead, on the planning deadline the client
  (still local, no room yet) calls `startPlanning` → `resolveRound(state, seed)` and then
  **replays its own fight** from the returned `seed_i` for the visual combat (identical to what the
  room will later hand it). This proves the replay path with zero networking.
- **Verify:** single-player still plays; the on-screen fight is now a *replay* of the authoritative
  `resolveRound` result (same winner/HP). Unit tests: `applyAction` pool conservation under
  interleaved buys from 2 seats; `resolveRound` symmetric pairing + eliminations end the game; a
  human matchup's real-combat result settles both seats consistently.

---

## Phase 2 — PartyKit room (`party/lobby.ts`, `partykit.json`)

Goal: one authoritative room per lobby, running the Phase-1 module.

### Task 2.1 — Project setup
- `npm i -D partykit` and `npm i partysocket` (client).
- **`partykit.json`**: `{ "name": "poketft", "main": "party/lobby.ts" }` (+ `compatibilityDate`).
- Ensure `party/lobby.ts` can import `../src/core`, `../src/econ`, `../src/game/round` (tsconfig/
  bundling — PartyKit uses esbuild; keep imports relative, no DOM code paths pulled in).

### Task 2.2 — `party/lobby.ts` (the room)
```ts
export default class Lobby implements Party.Server {
  run: RunState                 // authoritative
  seats: (string|null)[]        // connectionId per seat (null = bot)
  deadline: number | null
  constructor(readonly room: Party.Room) {}

  async onStart() { this.run = (await this.room.storage.get('run')) ?? newRun(botSeats()) }

  onConnect(conn) {
    const seat = this.assignSeat(conn.id)          // first free bot seat → this human
    conn.send(json({ t:'welcome', seat, snapshot: this.run }))
    this.broadcastLobby()
  }
  onClose(conn) { this.freeSeat(conn.id) /* seat reverts to bot */ ; this.broadcastLobby() }

  onMessage(raw, conn) {
    const msg = parse(raw)
    if (msg.t === 'action') {
      const seat = this.seatOf(conn.id)
      applyAction(this.run, seat, msg.action)      // serial → pool-safe
      this.persist(); this.broadcast(this.snapshot())
    }
    if (msg.t === 'ready') { this.maybeStartPlanning() }
  }

  // Round loop: on planning start, set a server deadline and broadcast it; a timer
  // (this.room.storage.setAlarm or setTimeout in dev) fires resolveRound at the deadline.
  startPlanning() { startPlanning(this.run); this.deadline = Date.now()+PLANNING_MS; this.setAlarm(this.deadline); this.broadcast(...) }
  async onAlarm() {
    const seed = hash(this.room.id, this.run.round)
    const result = resolveRound(this.run, seed)
    this.persist()
    this.broadcast({ t:'resolve', snapshot:this.run, fights: result.perSeat })  // each: {opponentBoard, seed_i, result}
    this.startPlanning()                                                        // next round
  }
}
```
- **Seat assignment:** humans take the lowest-index bot seat on connect; on disconnect the seat
  reverts to its bot persona (bot-fill), so a lobby is always full and playable.
- **Persistence:** `this.room.storage.put('run', this.run)` after each mutation (the `EconStorage`
  seam idea, room-scoped — key is the room id, not the fixed `pokeTFT_run_v1`).
- **Verify:** `partykit dev`; a small Node client (`partysocket`) drives two seats through
  buy→ready→resolve; assert authoritative `run` consistency and pool conservation under concurrent
  buys from both seats.

---

## Phase 3 (local) — Client networking + minimal lobby (`src/net/client.ts` + `main.ts`)

Goal: two local browser tabs join a code and play a round. Polish deferred.

### Task 3.1 — `src/net/client.ts`
- Wrap `partysocket`: `connect(lobbyCode)`, `send(action)`, and callbacks for `welcome`
  (→ set `localSeatIndex`, initial snapshot), `snapshot`/`lobby` (→ update synced `RunState`),
  `resolve` (→ hand `main.ts` this seat's `{opponentBoard, seed_i, result}` to replay).
- Expose a tiny store: `getState(): RunState`, `getLocalSeat(): number`, event emitter.

### Task 3.2 — `main.ts`: dispatch actions, render from snapshot
- Input handlers (buy/sell/reroll/xp/lock/drag-move/place-item) **stop mutating `run`**; they call
  `net.send({ t:'action', action })`. The board/bench drag logic computes the `GameAction` and sends
  it; the authoritative snapshot comes back and re-renders.
- Rendering reads `net.getState().players[localSeatIndex]` for shop/bench/board, and a **lobby
  strip** showing all seats (name, hp, human/bot). Guard: if not in a room (no `?lobby=`), keep the
  current local single-player path (Phase 1) so nothing regresses.
- **Planning countdown** driven by the room's broadcast `deadline`, not `performance.now()`.

### Task 3.3 — Fight replay
- On `resolve`, for the local seat's fight, build the two boards and
  `createCombatState(player, enemy, stage, seed_i)`, then run the existing visual combat loop —
  **identical** to the server's authoritative run. Render `localSeatIndex` on the near side (for a
  human-vs-human match the loser/other tab renders the mirror; the sim is the same).

### Task 3.4 — Lobby UI
- **Host:** button → `net.connect(randomCode)` → show shareable `?lobby=CODE` link.
- **Join:** read `?lobby=` from URL or an input → `net.connect(code)` → seated.
- Minimal "ready/start" + a seat list. No reconnect/spectate yet.
- **Verify (Playwright):** two browser contexts open `?lobby=TEST`; both buy a unit, both hit
  ready, the round resolves; assert both tabs show consistent `round`/`hp`/`gold`, and when the two
  humans are matched they replay the **same** fight (same `seed_i` → same event stream).

---

## File-by-file change map

**Create**
- `src/core/rng.ts` — ✅ already created (`Rng`, `seededRng`, `rngPick`).
- `src/game/round.ts` — `GameAction`, `applyAction`, `startPlanning`, `resolveRound`.
- `party/lobby.ts`, `partykit.json` — the room.
- `src/net/client.ts` — transport wrapper.
- `src/core/determinism.test.ts`, `src/game/round.test.ts` — tests.

**Modify (determinism — 5 sites + wiring)**
- `src/core/types.ts` (add `rng` to `CombatState`), `src/core/combatEngine.ts` (seed param),
  `src/core/systems/damage.ts` (rollCrit), `src/core/systems/targeting.ts` (tie-break),
  `src/core/abilities/{a_exeggutor,gible,unown}.ts`. *(rollCrit callers in `attack.ts`.)*

**Modify (seats/loop)**
- `src/main.ts` (localSeatIndex; later: action dispatch, snapshot render, broadcast timer, lobby UI,
  replay), `src/econ/botMatches.ts` (symmetric matchmaking), `src/econ/runState.ts` (room-scoped
  key / storage; per-seat `pendingIncome` already fine), `src/econ/constants.ts` (`PLAYER_COUNT`
  only if changing seat count).

**Reuse unchanged**
- `PlayerEcon`, `settleRound`/interest (`income.ts`), all `shop.ts` mutators, `xp.ts`, `boardToSpecs`,
  `botPlanRound`, `EconStorage`, `seededRng`.

## Verification checklist (per phase)
- **0:** `npx tsc --noEmit` clean; `npx vitest run` green (minus known pre-existing failures);
  new determinism test passes (same seed → same normalized outcome; different seed → differs);
  browser single-player unchanged.
- **1:** `round.test.ts` — pool conservation under interleaved 2-seat buys; symmetric pairing (no
  self-fights; eliminations end game); human matchup runs real combat and settles both seats;
  single-player still plays with the fight now a replay of `resolveRound`.
- **2:** `partykit dev` + Node test client: two seats buy→ready→resolve; authoritative consistency
  + pool safety under concurrent buys.
- **3:** Playwright two-context: join one code, both shop + fight the same round, matched humans
  replay the identical fight.

## Risks & notes
- **Determinism is load-bearing for the shared-combat requirement.** The determinism test is the
  guardrail; keep it green. If a new ability needs randomness, it must use `state.rng()`.
- **Per-seat semantics:** `pendingIncome` and `cliffPositions` are on `PlayerEcon` but only used for
  seat 0 today — make sure Phase 1 uses them per-seat.
- **Bot-vs-bot stays abstract** for perf (no visuals needed); only human matchups run real combat.
- **Scope:** this build stops at a *local* playable room. Deploy (`partykit deploy` + static Vite
  host on Vercel/CF Pages), reconnect/resync, idle auto-lock at the deadline, and spectating
  eliminated players are **Phase 4** (out of scope here).
- **8 seats later:** bump `PLAYER_COUNT` (`src/econ/constants.ts`) + a balance retune; the
  seat-symmetric design already supports it.

## Known pre-existing test failures (not caused by this work — do not chase)
- `src/core/systems/crashout.test.ts` family, `src/econ/bots.test.ts` "banked-past-threshold
  greed spikes", and a flaky `src/enemy/generator.test.ts ±25%` case. Treat suite as green if only
  these fail.
