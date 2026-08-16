# pokeTFT

## What This Is

pokeTFT is a Pokémon-themed Teamfight Tactics-style auto-battler, built as hand-rolled TypeScript + Vite + Canvas 2D (no game engine, no frontend framework). It has two modes: normal/economy mode (real TFT meta — shop/gold/XP/bench/star-ups, 1 human vs 5 persistent AI bot opponents sharing one unit pool) and test mode (free placement, isolated ability/combat testing). Currently single-player only, running fully client-side with localStorage persistence.

## Core Value

A friend can open a link, join your lobby, and play a full round of real TFT-style economy gameplay with you — same shared shop pool, same bot opponents, same game state — today.

## Requirements

### Validated

- ✓ Core auto-battler combat engine — headless, zero browser deps (`src/core/`) — existing
- ✓ TFT-authentic economy system — shop/XP/bench/combine, pool-based, fully JSON-serializable `RunState` (`src/econ/`) — existing
- ✓ 5 persistent AI bot personas playing real economies on the shared pool via trained genomes — existing
- ✓ Ability/trait system covering a large and growing unit roster — existing
- ✓ Bot composition-learning bandit (Phase B/C training) with recent pollution fixes (splash-trait exclusion, cost-weighted credit, tempo-aware leveling) — existing, retrain pending

### Active

- [ ] Host can create a lobby and get a shareable invite link that works over the internet (not just local network)
- [ ] Friend can join the host's lobby via that link and take a seat
- [ ] Both human seats share one authoritative `RunState` — same shop pool, same gold/XP rules, same bot opponents filling remaining seats
- [ ] Rounds are synchronized: both players plan/shop, then the round resolves for everyone together
- [ ] Combat is server-authoritative and streamed as a full event log to both clients (no client-side deterministic seed-replay) — clients just play back what the server recorded
- [ ] Single-player mode continues to work unchanged throughout

### Out of Scope

- Deterministic seed-based combat replay — cut in favor of streaming full combat event logs from the server; revisit only if bandwidth/scale becomes a real constraint
- More than 2 human seats (host + 1 friend) for this build — architecture should stay seat-symmetric enough to extend later, but the immediate goal is 2 humans + bot-fill
- Reconnect/resync after a dropped connection — deferred
- Idle/auto-lock handling for a stalled human seat — deferred
- Spectator mode — deferred
- Finishing the full bot-training-pipeline retrain (`npm run train-all` under the fixed logic) — separate work thread, not part of this multiplayer push; tracked as a later phase

## Context

Existing planning docs at the repo root are authoritative reference for this work and should be read directly rather than re-derived:
- `MULTIPLAYER_PLAN.md` — original architecture: authoritative serverless room (PartyKit or Cloudflare Durable Objects), 6 seats, synchronized rounds. Its own risk notes call this a "multi-week refactor" — the roadmap here deliberately compresses it.
- `MULTIPLAYER_IMPLEMENTATION.md` — execution-ready task breakdown with exact files/functions/line numbers. Its stated milestone was a **local** PartyKit room only, with real deployment deferred to a later phase — this project pulls deployment forward and drops the determinism work to make an internet-joinable link achievable quickly.
- `.planning/codebase/` — full codebase map (stack, architecture, structure, conventions, testing, integrations, concerns), produced by `/gsd-map-codebase` on 2026-08-16.

Key architectural facts that make this tractable (from the existing audit): every seat (human or bot) is the same symmetric `PlayerEcon`; `RunState` is pure JSON; core combat (`src/core/*`) already runs headless in Node with zero browser dependencies. The main gaps are (1) killing the "seat 0 = human" hardcoding, (2) a transport-agnostic round module, (3) a PartyKit room server, (4) client networking + minimal lobby UI, (5) actually deploying it.

There is a second, independent work thread — finishing the bot-training-pipeline hardening (retraining `learnedCompositionAffinities.ts`/`learnedCatalogAffinities.ts` under fixes made 2026-08-16) — that the user also cares about but is explicitly not today's focus.

## Constraints

- **Timeline**: Working, internet-joinable 2-player lobby needed today (a few hours), not the multi-week full build — drives the event-streaming shortcut over deterministic replay
- **Tech stack**: Must build on existing stack (TypeScript, Vite, no framework); transport layer is PartyKit per existing plan docs
- **Compatibility**: Single-player mode must keep working unchanged throughout the refactor
- **Hosting**: Must be reachable over the internet by a friend on a different network — local-only PartyKit dev server is not sufficient

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stream full combat event logs instead of deterministic seed-replay | Original design needed pinning down 5 `Math.random()` call sites to a shared seeded RNG and testing byte-identical replay — real time cost for a 2-player build. Streaming the actual recorded fight is simpler, always visually correct, and the bandwidth cost is irrelevant at 2 players. | — Pending |
| Follow existing MULTIPLAYER_PLAN.md / MULTIPLAYER_IMPLEMENTATION.md as the roadmap basis, with edits | Docs are already execution-ready (exact files/functions/line numbers) — avoids re-deriving a good plan from scratch | — Pending |
| Cap today's scope at 2 human seats (host + 1 friend) + bot-fill, no reconnect/spectate/idle-handling | User's literal goal is "invite a friend and play together today" — the 6-human generality, reconnect, and polish are separable later work | — Pending |
| Bot-training-pipeline retrain treated as a separate, later phase | User confirmed multiplayer is today's priority; training retrain is compute-heavy and independent | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-16 after initialization*
