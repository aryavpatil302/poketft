# PokéTFT — Session Handoff

Written for a fresh Claude Code session that has **Playwright MCP** available and no memory of prior conversations. Read this end-to-end before touching code — it covers what the game is, how the codebase is organized, how every major system works, what was just built, and what's still open.

The repo also has four other reference docs, each authoritative for its own area — this file points to them rather than duplicating:
- **`COMMANDS.md`** — every CLI command (dev server, tests, bot training) with what it does and why.
- **`COMBAT_RULES.md`** — exact per-ability targeting/combat rules, kept current, read before changing combat logic.
- **`ML_Generation_Plan.md`** — the enemy-generation calibration system design.
- **`PokemonTFT_Balance_Engine_Plan.md`** — original balance-engine design doc.
- **`.claude/commands/*.md`** — Claude Code skills (`/add-unit`, `/add-ability`, `/add-trait`, `/add-item`, `/test-combat`) — invoke these for their respective tasks rather than reinventing the workflow. They were rewritten this session to fix stale/fictional references (see "This session" below) and are now accurate against the live code.

## What this is

A **Pokémon-TFT-style auto-battler** built solo with TypeScript + Vite + Canvas (no game engine, no React — hand-rolled render loop and DOM). Two modes:

- **Normal / economy mode** (default): the real TFT meta-game — shop, gold, XP, bench, star-ups, 5 persistent AI bot opponents sharing one unit pool with the human player, round-robin PvP-style bot matches, round after round until someone's eliminated.
- **Test mode** (checkbox in the bottom-right dev panel): free unit placement on both sides, Start/Pause/Stop/Reset + 0.5×/1×/2×/4× speed controls, for testing abilities/traits/combat in isolation without the economy layer. This is almost certainly what you want when verifying an ability or animation change visually.

Run `npm run dev` and open the printed localhost URL (Vite default port 5173, no custom port configured in `vite.config.ts`). Key DOM elements for Playwright: `#chk-test-mode` (checkbox), `#btn-start`, `#btn-pause`, `#btn-stop`, `#btn-reset`, `#speed-buttons` (child buttons have `data-spd` attributes: 0.5/1/2/4).

## Architecture map

```
src/
  main.ts                  entry point — full HTML template, frame loop, ALL DOM logic (huge file)
  core/
    types.ts               Unit, CombatState, StatusEffect, Shield, AttackModifier, CombatEvent (incl. VfxEvent union)
    constants.ts            HEX_SIZE=62, TICK_RATE=60, BOARD_PERSP_Y=0.70
    hexGrid.ts              hexToPixel, hexesInRange, getNeighbors, hexDistance, isValidHex, BOARD_COLS/ROWS
    combatEngine.ts          createCombatState, tickCombat — the per-tick simulation driver
    unitFactory.ts           makeUnit, computeStats (star scaling + status-effect → stat pipeline)
    projectile.ts             createProjectile
    abilities/                one file per unit, e.g. excadrill.ts, a_raichu.ts, vigoroth.ts (~66 files)
    systems/
      ability.ts               AbilityHandler interface, ABILITY_REGISTRY, triggerAbility/tickAbilityCast
      attack.ts                 auto-attack loop: tickAttack, fireAttack, applyAttackModifier, windupTicks/attackCooldownTicks
      damage.ts                  applyDamage — the full damage pipeline (see below)
      movement.ts                 startLeap, teleportUnit, cancelInFlightMovement, tickMovement, tickLeapPixel
      statusEffect.ts              addStatusEffect, removeStatusEffect(ByStack), tickStatusEffects
      shield.ts / heal.ts           addShield, applyHeal (both recompute stats fresh — never trust a stale cache)
      traitEffects.ts               initTraitEffects + one applyXxx(state) function per trait (real trait logic lives here)
      terrain.ts                     Tapu-driven terrain (Grassy/Misty/Psychic)
      spellBuff.ts                   Beachy trait's per-unit spell-buff stack counter
      targeting.ts / marks.ts / mana.ts / persistentAoE.ts (built but currently unused by any live ability)
  data/
    units.ts                  every UnitDefinition (id, cost, types[], baseStats, ability{id,name,description,scaling})
    traits.ts                  TraitDefinition[] — UI/tooltip text ONLY, not read by combat logic (see Traits below)
    items.ts / traitTooltips.ts
  render/layers/
    boardLayer.ts               hex field, terrain pulse, sun tint
    unitLayer.ts                 draws every unit sprite + health bar (~2400 lines — scale/tint/rotation/nudge all computed fresh per frame here)
    effectLayer.ts                VFX event → CastAnimation queue, floating damage numbers, projectiles-adjacent effects
  econ/                        the TFT meta-game (shop/xp/bench/bots) — see Economy section
  enemy/                        battle log + online calibration for (legacy) enemy generation — see ML section
  sim/                          offline calibration/simulation scripts
  ui/                           (minor UI helpers)
.claude/commands/               Claude Code skills — see below
e2e/features/                   Cucumber/Selenium end-to-end feature files
tests/                          saved test-mode board scenarios (JSON), loadable in test mode
```

**Working-tree state**: there is currently a large amount of *uncommitted* work across `src/core/abilities/*` and other files (`git status` shows dozens of modified files, one deletion — `grapploct`). Nothing from recent sessions has been committed. **Don't assume `git log` reflects current reality — always check `git status`/`git diff` first.**

## Core combat mechanics

**Tick-based simulation.** `TICK_RATE = 60` ticks/sec (game runs visually at up to 2× via `#speed-buttons`). `combatEngine.ts`'s `tickCombat` drives everything once per tick: movement, attacks, ability casts, status effects, projectiles.

**Hex grid**: offset coordinates `{col, row}`, `hexDistance`/`getNeighbors`/`hexesInRange` in `hexGrid.ts`. `hexesInRange(center, r)` includes the center hex itself (distance 0). Board is `BOARD_COLS × BOARD_ROWS`, pointy-top-ish hexes with `BOARD_PERSP_Y = 0.70` vertical compression for the isometric-ish camera look.

**Unit lifecycle**: `UnitDefinition` (static, `data/units.ts`) → `makeUnit(definitionId, team, tier)` (`unitFactory.ts`) applies star-scaling (`HP ×1.8` cumulative per star past 1, `attack ×1.5` cumulative) → runtime `Unit` with mutable stats, `state` (`idle|moving|leaping|attacking|casting|stunned|knockedUp|ascended|dead`), `statusEffects[]`, `shields[]`, `attackModifiers[]`.

**`computeStats(unit)`** (`unitFactory.ts`) is the single source of truth for a unit's *effective* stats: base stats → item bonuses → a large hand-maintained `switch (fx.id)` over every living `statusEffect`, applying flat/percent/set/cap semantics per known effect id. **Any new buff/debuff status-effect id must get a `case` here or it silently does nothing** — this is the single most common way a new ability's stat modifier goes quietly missing. Result cached on `unit._computedStats`, nulled by `addStatusEffect`/`removeStatusEffect` (and must be nulled manually by anything else that mutates a status effect's `magnitude` in place, e.g. persistent stacking counters).

**Damage pipeline** (`damage.ts`'s `applyDamage`, full order): additive scaling (`scalingStat`+`scalingRatio`: `base += stat*ratio`) → multiplicative ability scaling (`abilityScalingStat`: `base = round(base*stat/100)`, treats `baseAmount` as a **percentage** of the stat) → `incomingDamageMult` → hardcoded unit/trait special cases → damage amp (sums `damage_amp` status effects) → crit (`canCrit && rollCrit`, `×critDamage`) → mitigation (`armor/(armor+100)` LoL-style formula, skipped for `true` damage) → shields absorb front-to-back → HP subtracted → omnivamp heal → events/death. **Two scaling conventions exist and are easy to conflate** — pick additive-ratio for "X plus Y% of stat" abilities, multiplicative-% for "X% of stat as damage" abilities (most spell casters use the latter).

**Movement/leap** (`movement.ts`): `startLeap(unit, dest, state, hasteMagnitude, onLand?, onMidpoint?)` is the standard dash primitive — caller must set `unit.state = 'leaping'` afterward, `startLeap` doesn't. **Invariant**: origin hex frees immediately on leap start, destination hex claims only on arrival — mid-flight the unit owns zero hexes. Anything that force-exits a unit from `'moving'`/`'leaping'` (knockback, stun mid-dash) **must** call `cancelInFlightMovement(unit, state)` first or hex-occupancy desyncs and two units can end up sharing a hex (this was a real bug, fixed this session — see below).

**Ability handlers** (`systems/ability.ts`): `AbilityHandler { abilityId, castTimeTicks, onCombatStart?, onCastStart?, onCast(unit, state, tier) }`, manually registered via `registerAbility(...)` — imported and called in a big block near the bottom of `ability.ts`, grouped by trait. No auto-discovery; a unit with an `ability.id` and no matching registered handler silently mana-locks and does nothing. `triggerAbility` fires when mana is full; `tickAbilityCast` counts down `castTimeTicks` then calls `onCast`.

## Traits system

`data/traits.ts`'s `TraitDefinition{id, name, thresholds:[{count, description, statBonus, teamBonus, specialEffect}]}` is **cosmetic/tooltip text only** — `statBonus`/`teamBonus`/`specialEffect` are never read by combat code (verified by grep this session; only consumed by the trait-bar UI and bot AI board-power scoring). The **real** trait logic is entirely hand-written in `core/systems/traitEffects.ts`: one `applyXxx(state)` function per trait, all called once at combat start from `initTraitEffects(state)`. Pattern: iterate both teams → count **unique species** (`definitionId`) with the trait (TFT-style, not raw unit count) → compare against hardcoded breakpoints → apply via direct stat mutation or `addStatusEffect(..., {id: 'some_id', ...})` (which then needs a `computeStats()` case).

A unit's `types: [...]` array in `units.ts` only does anything because `traitEffects.ts` checks `unit.types.includes('trait_id')` — adding a trait id to `traits.ts` alone changes nothing in combat.

**All 26 traits currently defined** (`data/traits.ts` ids): `jungle`, `beachy`, `bruiser`, `roughneck`, `speed_striker`, `stalwart`, `promoter`, `volcanic`, `sky_striker`, `cave_crawler`, `river`, `temporal_woods`, `ruiner`, `ascender`, `froststone`, `quickclaw`, `corkscrew`, `spellweaver`, `keen_eye`, `mystic`, `crashout`, `substitutor`, `shock_spirit`, `rogue`, `soul_bonded`, `wave_spirit`. Corresponding `applyXxx` functions exist in `traitEffects.ts` for most of these (confirmed: `applySoulBonded`, `applyRogue`, `applyTerrainEffects`, `applyJungle`, `applyVolcano`, `applySkyStriker`, `applyCaveCrawler`, `applyRiver`, `applyBruiser`, `applyBeachy`, `applyTemporalWoods`, `applyRuiner`, `applyAscender`, `applyCorkscrew`, `applyRoughneck`, `applyQuickclaw`, `applyFroststone`, `applyPromoter`, `applySubstitutor`, `applyKeenEye`, `applyStalwart`, `applySpellweaver`, `applyMystic`, `applyCrashout`).

Notable trait mechanics (verify against live code before relying on exact numbers — some detail below is from memory, not re-verified this session):
- **Jungle**: grants `healShieldPower` bonus (team gets some, jungle-species units get more) — read fresh (not cached) by `heal.ts`/`shield.ts`.
- **Volcanic** (3/5/7): HP + adaptive force, plus a "sun" state that activates on a delay (10s/5s/instant) giving +50% extra HP/adaptive and burning enemies; board gets an orange tint (`boardLayer.setSunny`) and a spinning sun icon (`#sun-effect`) while active.
- **Terrain** (Tapu-driven, `systems/terrain.ts`): Grassy/Misty/Psychic — team heal-over-time / CC immunity / enemy attack-speed chill respectively, with a pulsing hex-boundary glow (`boardLayer.setTerrainPulse`).
- **Beachy**: `spellBuff.ts`'s per-unit stack counter — `incrementSpellBuff(unit, state)` is called by each Beachy ability itself (not centralized) on cast, scaled by team Beachy-species count (2+→+1, 4+→+2, 6+→+3 per cast); `getSpellBuff(unit, state)` reads a unit's own accumulated stacks. **Important for tests**: a single-Beachy-unit test board never crosses the 2-species threshold, so `getSpellBuff` stays 0 there unless you add a 2nd Beachy ally.

## Abilities

Pattern is fully documented in `.claude/commands/add-ability.md` (rewritten this session, now accurate) — read it before implementing/fixing any ability. Quick summary of common patterns it covers: shields with `onExpire` callbacks, attack-speed/damage buffs via `addStatusEffect`, projectiles via `createProjectile`, AoE via `hexesInRange`, dash/leap via `startLeap`, knockback via `cancelInFlightMovement`, stuns, and the two damage-scaling conventions. Every ability has a co-located `*.test.ts` following a standard scaffold (`makeUnit` → position hexes → `createCombatState` → `unit.currentMana = unit.maxMana` → `triggerAbility`/`tickAbilityCast` → assert; `advanceLeaps` helper for dash abilities).

## Economy / Bot AI system

Lives in `src/econ/` — full TFT meta-game (shop, XP, bench, star-combining), all tunables in `econ/constants.ts` (shop odds by level, pool sizes 30/25/18/10/9, XP curve, interest, streak gold — TFT-authentic). Normal mode **is** economy mode (`econActive()` in `main.ts` gates it).

**5 fixed bot personas** (`econ/bots.ts`): Rilla (reroller), Kass (fast-8), Echo (flex), Brick (tank), Vex (greedy) — share one gold/XP/unit pool with the human via `RunState.pool`, playing through the same shop/combine functions. Bot-vs-bot rounds resolve headlessly (`econ/botMatches.ts`'s `runSimulation`).

**Decision weights are trained, not hand-tuned**: each persona has a ~15-float `BotGenome` (econ pacing + HP-aware desperation/spike thresholds + unit-scoring weights), evolved offline via `npm run train-bots` (`econ/train.ts` — (μ,λ) evolution strategy, competitive self-play coevolution, seeded RNG). Output checked into `econ/trainedGenomes.ts`, with field-by-field fallback to `DEFAULT_GENOMES` if a persona/field is missing. **Training is cumulative** — re-running seeds from the last trained genomes rather than restarting.

HP-aware spending rhythm: HP below `hpDesperationRatio` → spend everything (reserve=0); healthy + ahead + banked gold ≥ `reserve × spikeBankMultiplier` → deliberate one-round power-spike (dump the bank). This was built this session specifically to fix bots (esp. Rilla/Vex) falling behind and making the player face only Echo/Kass in the late game.

## ML calibration (legacy/adjacent system)

`src/enemy/calibration.ts` — an *online* MAP logistic regression (batch refit after every combat from a 300-record localStorage battle log, `src/enemy/battleLog.ts`) that calibrates `generateEnemyTeam`'s variety bands. **This generator is no longer used by `main.ts`** since the econ/bot system shipped (enemy = the matched bot's mirrored board now) — it remains live for `src/sim/` tooling and tests, and `predictWinProb` still records battles. Full design doc: `ML_Generation_Plan.md`. Deferred future work noted there: segmenting the learner by comp archetype (continuous features, not hard buckets — flagged as important to avoid fragmenting the small sample count).

## UI & rendering / animation system

All combat HUD overlays are `position:absolute` children of `#canvas-wrap` (combat timer bar, terrain indicator, sun icon, trait overlay) — see memory-derived detail in git history / ask if exact pixel offsets matter, they're stable and rarely need touching.

**Canvas layers** (`render/layers/`): `boardLayer` (hex field/terrain/sun tint), `unitLayer` (sprites + health bars — the biggest file, ~2400 lines), `effectLayer` (VFX event → animation queue, floating numbers).

**Visual effects have no dedicated `Unit` fields** (no `scale`/`tint`/`rotation` properties) — every visual is computed **fresh each frame** in `unitLayer.ts`'s `drawUnit()`, from three sources:
1. **`unit.statusEffects`** — for tint/shake tied to an ability's own status-effect timer (e.g. Crashout rage, Weavile Triple Axel tint, Ferrothorn/Rayquaza continuous rumble read directly off a status effect's `durationTicks`).
2. **`unit.attackModifiers` + `unit.isInWindup`/`attackWindupTimer`** — for auto-attack-driven animations (Excadrill's empowered-attack spin is computed straight from windup progress).
3. **`castAnims: CastAnimation[]`** (from `EffectLayer`) — a generic one-shot animation queue. Ability code emits `state.events.push({type:'vfx', effectId, unitId, ...})`; `effectLayer.ts` listens for specific `effectId`s and pushes a `CastAnimation` (`type: 'shake'|'hop'|'bigShake'|'spin'|'hold_hop'|'slam_land'|...` — grep the union in `effectLayer.ts` for the full list and `unitLayer.ts`'s `anim.type === ...` chain for each one's math). **Caveat**: `castAnims?.find(a => a.unitId === unit.id)` only grabs the *first* matching animation per unit — combining two simultaneous effects (e.g. a hop + a shake) requires either one combined custom type or a separate non-castAnims mechanism (status-effect-driven), not two separate castAnims pushes.

Leap/dash visuals (shrink, squish, glow, spin) are gated on `unit.definitionId === 'xxx' && !!leapRaw` where `leapRaw = (unit as any)._leap` (an untyped internal field set by `startLeap`, read via `leapT = leapRaw.tick/leapRaw.total` for 0→1 progress) — see `isExcadrillTunnel`, `isRaichuDash`, `isGibleLeap`, etc. in `unitLayer.ts` for the established per-unit pattern. Tinting is always `ctx.filter = '...'` (CSS filter string) set right before `ctx.drawImage`.

## This session's work

Chronological summary of everything done in the conversation that produced this handoff (most is **uncommitted** — see working-tree note above):

1. **Bot AI overhaul** — diagnosed why combat always ended up vs. Echo/Kass (Rilla/Vex falling behind, not name bias); built the full `BotGenome` + evolutionary training pipeline described in the Economy section above, including HP-aware desperation/spike spending. Verified via diagnostic re-runs that Vex/Rilla close the power gap post-training.
2. **`COMMANDS.md`** created — CLI reference doc (already covered above, read it directly for details).
3. **Jungle heal/shield bug fix** — `addShield`/`applyHeal` were reading a possibly-null `unit._computedStats` instead of recomputing fresh; fixed in `heal.ts`/`shield.ts`. Verified Vigoroth's shield went from an incorrect 500 to correct 575 with 3-jungle active.
4. **Vigoroth shield duration** changed to 6 seconds per request.
5. **Hex-collision bug fix** — `tickStatusEffects` could force a unit's `state` away from `'moving'`/`'leaping'` (stun/knockup) without reconciling in-flight hex-occupancy claims, letting two units share a hex. Fixed via new `cancelInFlightMovement()` in `movement.ts` (now the documented invariant above), with new tests in `movement.test.ts`.
6. **Oranguru buff** — added "every Nth attack in empowered form grants atk speed" scaling with special; N was iterated 5th→3rd per user request. **A later report ("it seems to be every other attack, not every 3rd") was never investigated or fixed — this is a known open item, see below.**
7. **Trait-diagram tool** (`public/trait-diagram.html` + two dev-only Vite middleware endpoints in `vite.config.ts`: `GET /api/trait-diagram-data`, `POST /api/save-traits`) — a standalone visual tool (open directly, not part of the main game) for dragging units between Trait/Origin bubbles to spot overlaps, with a save button that rewrites `units.ts`'s `types: [...]` lines in place. Not part of the play experience; a dev utility.
8. **Alolan Raichu rework** — bolt count now scales off Raichu's own dash count (1/3/5... bolts per target, persistent per-unit status-effect counter) instead of the Beachy spell-buff; spell-buff now adds flat `+1% special` per stack to each bolt's damage instead of controlling bolt count. `src/core/abilities/a_raichu.ts`, `data/units.ts`, and `a_raichu.test.ts` all updated; 10/10 tests pass.
9. **Unit-design skill overhaul** (`.claude/commands/{add-unit,add-trait,add-ability}.md`) — found and fixed real inaccuracies: `add-unit.md` used a nonexistent `traits:` field (real field is `types:`); `add-trait.md` referenced a fictional `trait.ts`/`applySpecialTraitEffect()` pattern (real file/pattern is `traitEffects.ts`/per-trait `applyXxx()` functions, documented above). Added new Movement and Damage & Modifiers reference sections to `add-unit.md`, and a knockback pattern + dual-scaling-convention explainer to `add-ability.md`. All claims re-verified against live code via grep before committing to the doc.
10. **Excadrill bug fix + animation pass**:
    - Bug: empowered-attack splash damage was centered on `tgt.hexPos` (the current auto-attack target's hex) instead of `src.hexPos` (Excadrill's own hex), so it could hit enemies up to 2 hexes away instead of only units directly adjacent to him. Fixed in `excadrill.ts`; added a regression test that was verified to fail on the old code and pass on the fix.
    - Animation: tunnel shrink increased 30%→40% (`ctx.scale(0.6,0.6)`) plus a new brown `sepia` tint while tunneling (`unitLayer.ts`'s `isExcadrillTunnel` block).
    - Animation: new landing effect — small hop + rumble on arrival, via a new `excadrill_land` `CastAnimation` type (combined hop-arc + shake math in one type, since `castAnims` only supports one animation per unit at a time) triggered by a new `excadrill_land` `VfxEvent`.
    - Animation: empowered-attack sequence now orbits Excadrill's sprite through all 6 surrounding hexes while spinning, by reusing a previously-dormant `'spin'` `CastAnimation` type (built for Marowak, never wired up until now) via a new `excadrill_drill_spin` `VfxEvent` sized to span the full 3-attack sequence duration.
    - All new `VfxEvent` variants added to the union in `core/types.ts`.
11. **Playwright MCP configured** — registered in this project's local scope inside `~/.claude.json` (`projects["/Users/aryapatil/Documents/pokeTFT/poketft"].mcpServers.playwright`, command `npx @playwright/mcp@latest`). **This required a new session to take effect** — that's why this handoff doc exists. If the Playwright tools aren't showing up, the MCP server may need a moment to install/start on first use (`npx` will download it).

## Known open items

- **Oranguru "every other attack, not every 3rd" report** — never investigated. If revisited, check the empowered-form attack-count tracking logic in `oranguru.ts` against the actual per-attack trigger condition; likely an off-by-one or a stale/duplicate counter increment.
- **Talonflame and Vigoroth test failures** — `talonflame.test.ts` (4 tests) and `vigoroth.test.ts` (2 tests) currently fail on `npx vitest run` (base damage / shield value mismatches, e.g. expects 150 gets 200). These predate the Excadrill/Raichu work in this session and are **unrelated to Raichu/Excadrill changes** (confirmed by isolating the diff), but are real pre-existing failures from earlier uncommitted work (Vigoroth shield-duration change, a Talonflame chain-dive crash fix mentioned in bot-training diagnostics) that were never fully reconciled with their tests. Worth triaging early in the new session.
- **Large uncommitted working tree** — nothing from recent sessions has been committed. Confirm with the user before committing anything, and be aware `git log`/`git blame` won't reflect most of what's described in this document.
- **`add-item.md`** skill was not touched this session (not in scope) — hasn't been verified for staleness the way `add-unit`/`add-trait`/`add-ability` were.

## Suggested first steps with Playwright

1. Confirm the `playwright` MCP tools are actually present (they require the new session to have picked up the `~/.claude.json` change).
2. `npm run dev`, navigate to the printed URL, check the **Test Mode** checkbox (`#chk-test-mode`) to get free placement.
3. A good smoke test given this session's work: place an Excadrill (adjacent to 2+ enemies) and a couple of enemies, hit Start, and visually confirm (a) the tunnel shrink/brown-tint dash, (b) the landing hop+rumble, (c) the empowered attacks orbiting his 3 attacks around adjacent hexes without hitting anything 2 hexes away, and (d) no two units ever overlapping a hex during any of this.
