# Multiplayer — authoritative serverless rooms (PartyKit / Durable Objects)

## Context

Today this is a single-player browser TFT auto-battler: one human (`run.players[0]`) vs 5
bots, all seats in one `RunState` on a shared unit pool, resolved entirely on the human's
client and persisted to localStorage. The goal is online multiplayer — a website where you
send friends a link/code to join your lobby, each controls their own board, and empty seats
fill with the existing bots.

Two audits establish the approach:
- **The hard part is already done.** Every seat (human or bot) is the same symmetric
  `PlayerEcon`; `resolveBotRound` (`src/econ/botMatches.ts`) already resolves *all* fights +
  economy + matchmaking + next-opponent in one place — an authoritative round loop that just
  happens to run on the human's client. `RunState` is fully JSON-serializable; `EconStorage`
  (`src/econ/runState.ts:47-51`) is a clean seam to redirect state to a server. Core combat
  (`src/core/*`) runs headless in Node with **zero** browser deps.
- **Authority is required and sufficient.** The shared `run.pool` is one in-memory object
  mutated on every buy/sell — concurrent human buyers would corrupt it, so a single serialized
  authority is mandatory. Because one authority runs every combat, we do **not** need lockstep.

**Decisions:** authoritative **serverless room** per lobby (PartyKit or Cloudflare Durable
Object); **6 seats**, 1–6 humans + bot-fill; **synchronized rounds** with a server-broadcast
planning deadline; combat made **deterministic + seeded** so the server's authoritative outcome
and each client's visual replay agree from a shared seed.

## Architecture

```
        Browser client (per player)                 Serverless room (authority)
  UI · rendering · input  ─ actions ─▶   RunState (authoritative) · shared pool
  local seat view  ◀─ state snapshots ─  round loop: applyAction, resolveRound
  visual combat (deterministic, ◀─ seed+boards ─  headless combat (same core, same seed)
   replays server's exact fight)                   bot-fill · matchmaking · timers
```

- **Shared code, unchanged:** `src/core` (combat), `src/econ` (economy/bots), `src/data`. These
  already run in Node, so the room imports them directly and the client keeps using them for
  rendering/replay.
- **Client** never mutates `RunState` directly anymore: input handlers send *actions*
  (`buy/sell/reroll/buyXp/lock/moveBoard/moveBench`) to the room; the client renders from the
  room's broadcast snapshot for its own `localSeatIndex`, and animates its fight by re-running
  the deterministic sim from the room's seed (matching the room's authoritative result exactly).
- **Room** owns the single `RunState`, applies actions serially (pool-safe), runs the
  synchronized round, and broadcasts. Each lobby = one isolated room (your "100 groups = 100
  independent games").

## Phased implementation

### Phase 0 — Seat-agnostic + deterministic core (no networking; single-player stays working)
- **`localSeatIndex`**: replace `humanEcon()` = `run.players[0]` (`main.ts:1617`, ~30 call
  sites) with `run.players[localSeatIndex]` (default 0). Purely mechanical; single-player
  behaves identically.
- **Generalize matchmaking** for "N humans + M bots": `pickNextOpponent` / `resolveBotRound` /
  `checkGameOver` (`src/econ/botMatches.ts`) currently assume "one human at seat 0, everyone
  else a bot." Change to treat all living seats symmetrically (a seat is human if a player
  occupies it). At N=1 this reproduces today's behavior.
- **Determinism pass** (reuse the econ `Rng` type `src/econ/shop.ts:11` + LCG `src/econ/train.ts:57`,
  promote to `src/core/rng.ts`): add `rng: Rng` to `CombatState` (`combatEngine.ts:33`, set in
  `createCombatState` from a seed); replace the 5 gameplay `Math.random` sites (`damage.ts:23`
  rollCrit, `targeting.ts:70` tie-break, `a_exeggutor.ts:61`, `gible.ts:31`, `unown.ts:27`) with
  `state.rng()`; make IDs deterministic — a per-combat counter for unit/projectile IDs
  (`unitFactory.ts:255`, `projectile.ts:22`, `morelull.ts:68/105`) instead of random suffixes.
- Ship-safe: full suite green + a new test asserting `run(seed, boards)` twice → identical result.

### Phase 1 — Extract the transport-agnostic game module (`src/game/round.ts`)
Pull the round logic out of `main.ts`'s settlement block + `botMatches` into pure functions over
`RunState` (no DOM, no network): `applyAction(state, seat, action)`, `startPlanning(state)`,
`resolveRound(state, rng)` (generalizes settlement + `resolveBotRound` to symmetric seat pairing,
returns each seat's fight = {opponentBoard, seed, result}). `main.ts` (single-player) calls these
locally; the room calls the identical functions. This is the "networking separate from engine"
seam the design hinges on.

### Phase 2 — PartyKit room server (`party/lobby.ts`, `partykit.json`)
A PartyKit server class = one lobby. `onConnect` assigns a seat (fills the rest with existing bot
personas), `onMessage` validates + `applyAction` against the authoritative `RunState`, a room
timer broadcasts a server-authoritative planning deadline then calls `resolveRound`, and it
broadcasts snapshots + per-seat fight seeds. Imports the Phase-1 module + `src/core`/`src/econ`
directly. Room storage persists `RunState` across restarts via the `EconStorage` seam.

### Phase 3 — Client networking + lobby UI (`src/net/client.ts` + `main.ts`)
Transport layer: connect by lobby code, send actions, receive snapshots → expose synced
`RunState` + `localSeatIndex`. Refactor `main.ts` input handlers to dispatch actions instead of
mutating `run`; render the local seat's shop/bench/board + the lobby from the snapshot; drive the
planning countdown off the broadcast deadline; play combat by re-simulating from the room's seed.
Lobby UI: **Host** → create room → shareable `https://site/?lobby=CODE`; **Join** → code/link →
seat; ready/start; show which seats are humans vs bots.

### Phase 4 — Deploy & resilience
Static Vite build → any static host (Vercel/Netlify/CF Pages); `partykit deploy` for the rooms.
Reconnect/rejoin (room owns state, so a dropped client just resyncs); eliminated players spectate;
handle a human seat going idle (auto-lock at the deadline, like the current timer).

## Key files & reuse
- **Reuse as-is:** symmetric `PlayerEcon` + `settleRound` (`income.ts`) + all `shop.ts` functions
  (already operate on any seat), `resolveBotRound`/`runSimulation`/`boardToSpecs` (resolution
  template), the econ `Rng`/LCG, `EconStorage`.
- **Modify:** `src/core/combatEngine.ts`, `unitFactory.ts`, `projectile.ts`, `systems/{damage,targeting}.ts`,
  abilities `{a_exeggutor,gible,unown,morelull}.ts` (determinism); `src/econ/{runState,botMatches}.ts`
  (multi-human seats + matchmaking); `src/main.ts` (localSeatIndex, action dispatch, synced render,
  broadcast timer, lobby UI).
- **Create:** `src/core/rng.ts`, `src/game/round.ts`, `party/lobby.ts`, `partykit.json`, `src/net/client.ts`.

## Verification
- **Phase 0:** `npx vitest run` stays green (only the known pre-existing Talonflame/Vigoroth
  failures); new determinism test (same seed+boards → byte-identical outcome twice); single-player
  still fully playable in the browser (seat-agnostic refactor is behavior-preserving at N=1).
- **Phase 1:** unit tests for `applyAction`/`resolveRound` over `RunState` — pool conservation under
  interleaved buys from multiple seats, and N-human symmetric matchmaking (2 humans + 4 bots pairs
  correctly, eliminations end the game).
- **Phase 2:** `partykit dev` locally; a Node test client drives two seats through buy→lock→resolve;
  assert authoritative state consistency and pool safety under concurrent buys.
- **Phase 3:** two browser contexts (Playwright) join one room by code; both shop and fight the same
  round; assert both see consistent HP/gold/round and each replays its own fight matching the
  server outcome.
- **Phase 4:** deploy; join a real link from a second device/network (NAT-free via the room).

## Risks / notes
- **Determinism is load-bearing for visuals**, not authority. If a future ability adds
  nondeterminism, client replays desync from the server outcome — add a lint/test guarding against
  raw `Math.random` in `src/core`.
- **Scope honesty:** this is a multi-week refactor, not a patch. Phases 0–1 carry the most value and
  are shippable single-player with zero UX change, de-risking the rest.
- Transcendental float differences across JS engines are a non-issue if the room runs on a V8
  worker (PartyKit/CF) like the browser; standardize on that.
- **8-seat TFT** later = bump `PLAYER_COUNT` (`src/econ/constants.ts:18`) + a balance retune; the
  seat-symmetric design already supports it.
