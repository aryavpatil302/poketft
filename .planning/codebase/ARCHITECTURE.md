<!-- refreshed: 2026-08-16 -->
# Architecture

**Analysis Date:** 2026-08-16

## System Overview

PokéTFT is a Pokémon Auto-Battler TFT simulator with two game modes: Economy Mode (full meta-game with shop, XP, gold, bots) and Combat Test Mode (instant placement + combat). The architecture separates rendering, combat simulation, economy/meta-game, and AI into independent layers that share core game state.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         DOM & User Input                             │
│  main.ts: Canvas setup, event listeners, UI integration             │
└────────┬────────────────────────┬────────────────────────┬──────────┘
         │                        │                        │
         ▼                        ▼                        ▼
    ┌─────────────┐         ┌──────────────┐         ┌─────────────┐
    │ Render Sys  │         │ UI Controls  │         │ Canvas APIs │
    │ BoardLayer  │         │ TeamBuilder  │         │ RequestAnim │
    │ UnitLayer   │         │ Combat Ctrl  │         │             │
    │ EffectLayer │         │              │         │             │
    └─────┬───────┘         └──────┬───────┘         └─────────────┘
          │                        │
          └────────────┬───────────┘
                       │
          ┌────────────▼────────────┐
          │  Economy Phase State    │
          │  RunState (localStorage)│
          │  Shop / XP / Income     │
          │  Bot Planning           │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │  Combat Initialization  │
          │  createCombatState()    │
          │  Unit setup + board     │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────────────────────────────────────┐
          │                  Combat Engine Loop                     │
          │  combatEngine.advanceCombatTick() [once per frame]     │
          │  ┌─────────────────────────────────────────────────┐  │
          │  │ 22+ Combat Systems (per-unit state machine):    │  │
          │  │ • Status Effects / Shields tick                 │  │
          │  │ • Mana Lock & Casting readiness                 │  │
          │  │ • Targeting (find nearest enemy / allies)       │  │
          │  │ • Movement (path navigation on hex grid)        │  │
          │  │ • Leap movement (non-interruptible fast path)   │  │
          │  │ • Attack initiation & windup                    │  │
          │  │ • Ability trigger (mana-full cast)              │  │
          │  │ • Projectile updates (hit detection / arc)      │  │
          │  │ • Unit Marks (delayed detonation)               │  │
          │  │ • Persistent AoE Zones (damage tick)            │  │
          │  │ • Trait Effects (volcano, terrain, etc.)        │  │
          │  │ • Damage Application (mitigation calc)          │  │
          │  └─────────────────────────────────────────────────┘  │
          │  Win/Loss Detection → Combat End                       │
          └────────────┬────────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │ Combat Post-Processing  │
          │ Record battle log       │
          │ Calibration update (ML) │
          │ Bot opponent selection  │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │ Economy Next Phase      │
          │ Gold settlement         │
          │ Level/XP increment      │
          │ New shop roll           │
          └────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **main.ts** | Entry point; DOM setup; main game loop; event handling | `src/main.ts` |
| **combatEngine** | Per-tick unit state machine; coordinates all combat systems | `src/core/combatEngine.ts` |
| **Combat Systems** | 22 independent systems for abilities, damage, targeting, movement, etc. | `src/core/systems/*.ts` |
| **Abilities** | 60+ Pokémon-specific ability implementations | `src/core/abilities/*.ts` |
| **Render Layers** | Canvas rendering (board, units, effects) | `src/render/layers/*.ts` |
| **Economy** | Shop, XP, gold, income; bot state and decision-making | `src/econ/*.ts` |
| **Bot Generation** | Enemy board generation based on learned affinities | `src/enemy/generator.ts` |
| **ML Calibration** | Online learner for win-rate prediction; board power estimation | `src/enemy/calibration.ts` |
| **Data** | Static unit/trait/item definitions; loaded at startup | `src/data/*.ts` |

## Pattern Overview

**Overall:** Layered MVC-inspired pattern with clean separation between:
- **Presentation** (render layers, UI controls)
- **State Management** (RunState for economy; CombatState for combat)
- **Business Logic** (combat systems, ability handlers, trait effects)
- **Data** (static definitions loaded at startup)

**Key Characteristics:**
- **Per-tick deterministic combat engine** — Same state + RNG seed = same outcome (enables replay, simulation, testing)
- **Ability/Trait/Item registration pattern** — Handlers imported centrally, registered at startup (no hardcoded dispatch)
- **Stateless system functions** — Combat systems are pure functions (unit, state) → void mutations (no class methods)
- **Event-driven rendering** — Visual updates from event log (vfx, cast, damage) + real-time state (unit pos, HP, mana)

## Layers

**Presentation Layer:**
- Purpose: Render game state to canvas and handle user input
- Location: `src/render/`, `src/ui/`
- Contains: BoardLayer (hex grid visual), UnitLayer (sprite rendering), EffectLayer (VFX), TeamBuilder UI, combat controls
- Depends on: Core types, constants
- Used by: main.ts

**Economy/Meta-Game Layer:**
- Purpose: Manage player progression (shop, gold, XP, bench), persist state to localStorage, orchestrate bot opponents
- Location: `src/econ/`
- Contains: RunState (shared player econ shape), shop logic, bot planning, income settlement, item management
- Depends on: Core types, data definitions (units, items, traits)
- Used by: main.ts, bot generation

**Enemy Generation & Calibration:**
- Purpose: Generate opponent boards; predict win rates; online calibration for future predictions
- Location: `src/enemy/`
- Contains: Board generator (catalog-based), board power calculator, Brier score calibration, ML learner
- Depends on: Economy state, data, composition signatures
- Used by: main.ts (bot round setup), simulation training loops

**Combat Simulation Layer:**
- Purpose: Headless combat runner for training bots, replaying battles, testing balance
- Location: `src/sim/`
- Contains: runCombat, botGame, botLeague, leagueReport
- Depends on: combatEngine, all combat systems, data
- Used by: Training/analysis scripts (CLI), bot opponent generation

**Combat Engine Core:**
- Purpose: Tick-based state machine for all 22+ combat systems; win/loss detection
- Location: `src/core/combatEngine.ts`
- Contains: createCombatState, tickUnit (per-unit loop), advanceCombatTick (per-tick loop), checkWinLoss
- Depends on: All combat systems, core types
- Used by: main.ts (live game loop), sim/*.ts (headless)

**Combat Systems (22 independent modules):**
- Purpose: Each system handles one orthogonal aspect of combat (damage calc, targeting, movement, etc.)
- Location: `src/core/systems/*.ts`
- Examples: damage.ts, targeting.ts, movement.ts, ability.ts, statusEffect.ts, terrain.ts, traitEffects.ts, etc.
- Depends on: Core types
- Used by: combatEngine per-tick loop

**Core Types & Constants:**
- Purpose: Shared type definitions; game balancing constants
- Location: `src/core/types.ts`, `src/core/constants.ts`
- Contains: Unit, CombatState, Shield, StatusEffect, ItemDefinition, UnitDefinition, TraitDefinition, etc.
- Depends on: Nothing (foundational)
- Used by: All layers

**Data Layer:**
- Purpose: Static game definitions loaded at startup
- Location: `src/data/`
- Contains: UNIT_MAP (all 100+ unit definitions), TRAIT_MAP, ITEM_MAP, trait tooltips
- Depends on: Core types (to validate shape)
- Used by: All layers (read-only)

## Data Flow

### Primary Request Path (Planning Phase → Combat → Results)

1. **Planning Phase** (`main.ts` event loop)
   - User places units on bench/board or modifies shop/items
   - RunState updates in memory + localStorage
   - Canvas re-renders from updated state

2. **Combat Start** (`main.ts` → `combatEngine`)
   - UI hiding / combat timer display
   - createCombatState() converts RunState bench/board into Unit array
   - Trait effects initialized (Volcano, Jungle, etc.)
   - Item passives registered
   - Ability passives registered

3. **Per-Tick Combat Loop** (`advanceCombatTick()` runs ~60fps)
   - For each living unit: `tickUnit()` runs the state machine
   - State machine sequence:
     - Tick status effects / shields (decrement timers, apply periodic damage)
     - Check mana lock; is unit ready to cast?
     - If mana full: `triggerAbility()` → ability handler executes
     - If not attacking: `tickTargeting()` finds nearest enemy
     - If target in range: `startAttacking()` begins attack windup
     - If in windup: `tickAttack()` handles swing animation, projectile launch
     - Otherwise: `tickMovement()` steps unit along path toward target
   - After all units tick:
     - `tickProjectiles()` moves projectiles, resolves hits
     - `tickMarks()` decrements mark timers, detonates if expired
     - `tickPersistentAoEZones()` applies periodic damage
   - Win/Loss detection

4. **Combat End** (combatEngine → main.ts)
   - Combat phase ends when one team eliminated
   - CombatResult returned with winner, units remaining, event log
   - Battle log recorded (`src/enemy/battleLog.ts`)
   - Calibration updated with actual outcome

5. **Economy Round Settlement** (main.ts)
   - Player + bots receive gold based on battle result
   - Eliminate players at 0 HP
   - Settle streaks and income
   - Next opponent selected

### Secondary Flow: Bot Round Execution

1. **Bot Planning Phase**
   - For each bot: `botPlanRound()` examines catalog, selects best composition for current stage
   - Bot purchases units, levels up XP, buys items from bench
   - Both teams' boards frozen in RunState

2. **Combat Execution** (same as player combat)
   - createCombatState() from both boards
   - advanceCombatTick() runs to completion

3. **Bot Post-Round**
   - Bot next-round persona selected from winner prediction
   - Board power calc updates ranking

### State Management

**RunState (Economy):**
- Persisted to localStorage under `pokeTFT_run_v1`
- Single shared pool: all units draw from same deck
- Each player (human + 5 bots) has identical PlayerEcon shape
- Round number increments after both teams settle

**CombatState (Combat):**
- Ephemeral (created at combat start, discarded at end)
- Central hub for all mutable game state during combat:
  - `units` Map: all living units by ID
  - `projectiles` Map: in-flight projectiles
  - `hexOccupancy` Map: hex → unit ID (for pathfinding)
  - `terrain` object: active terrain flags (electric, psychic, grassy, misty, sunny)
  - `tailwind`, `earthquakeCounts`, `spellBuffCounters`: trait-specific state

**Event Log:**
- Array on CombatState (`state.events`)
- Populated during tick by systems (damage, cast, vfx, summon, etc.)
- Replayed post-combat by render layer to display effects

## Key Abstractions

**Unit (runtime state object):**
- Purpose: Represents a living combatant with current HP, position, mana, buffs, etc.
- Examples: `src/core/unitFactory.ts` creates them; `src/core/combatEngine.ts` ticks them
- Pattern: Mutable object; modified in-place by combat systems

**CombatState (ephemeral container):**
- Purpose: All mutable state during a single combat encounter
- Examples: `src/core/combatEngine.ts` creates it; all systems read/mutate it
- Pattern: Single source of truth; passed to all combat functions

**Ability Handler (registration pattern):**
- Purpose: Encapsulates one Pokémon's ability logic
- Examples: `src/core/abilities/a_exeggutor.ts`, `src/core/abilities/pikachu.ts`, etc.
- Pattern: Register in `src/core/systems/ability.ts`; looked up by `unit.definitionId`

**Item Passive (handler registration pattern):**
- Purpose: Passive combat effect triggered by equipped item
- Examples: `src/data/items/weakness_policy.ts` (amplifies damage taken), `src/data/items/lifeorb.ts` (damage boost)
- Pattern: Defined in item module; imported in `src/data/items/index.ts`; registered on unit at combat start

**Trait Effect (system-driven pattern):**
- Purpose: Passive triggered by trait activation (e.g., "3 Volcano" units alive)
- Examples: `src/core/systems/traitEffects.ts` implements Volcano, Jungle, Grassy, Misty, Electric, Psychic, Zen, etc.
- Pattern: Check trait threshold in initTraitEffects; apply stats or special effects

**Status Effect (tick-based pattern):**
- Purpose: Temporary debuff (stun, silence, burn) or buff (shield, regen)
- Examples: Status effects with onExpire/tickEffect callbacks; shield objects with damage absorption
- Pattern: Added to unit.statusEffects or unit.shields; ticked every frame until duration expires

**Projectile (arc physics + hit detection):**
- Purpose: Ranged attack traveling from source to target with arc animation and damage payload
- Examples: Auto-attack projectiles, ability projectiles (egg bomb)
- Pattern: Created with createProjectile; added to state.projectiles; ticked every frame

## Entry Points

**Web Application (Browser):**
- Location: `src/main.ts`
- Triggers: Page load (HTML loads app div, Vite injects main.ts)
- Responsibilities: DOM setup, canvas initialization, main game loop, event listeners (click hex to place, shop buttons, etc.)

**CLI Training Pipeline (Node):**
- Location: `src/econ/train.ts`, `src/sim/botLeague.ts`, etc.
- Triggers: `npm run train-bots`, `npm run sim-bots`, etc.
- Responsibilities: Headless bot training; calibration updates; catalog affinity learning

**Combat Test Entry (Headless):**
- Location: `src/sim/run.ts`
- Triggers: `npm test` (Vitest)
- Responsibilities: Replay specific combat scenarios for validation

**Ability Test Entry:**
- Location: `src/core/abilities/*.test.ts`
- Triggers: `npm test`
- Responsibilities: Unit-test individual ability implementations

## Architectural Constraints

- **Threading:** Single-threaded event loop (browser main thread). Training runs are CPU-bound CLI scripts (separate process).
- **Global state:** ABILITY_REGISTRY (ability.ts), UNIT_MAP/TRAIT_MAP/ITEM_MAP (data), localStorage (RunState). No module-level mutable unit/combat state.
- **Circular imports:** None enforced; ability.ts imports all ability modules (safe since no circular references). Combat systems don't import each other.
- **Deterministic RNG:** `combatRng()` seeded per session; used for targeting, crit rolls, trait triggers. Same seed + same inputs = same combat.
- **Hex grid:** Offset coordinates; Board is 8 rows (0-3 enemy, 4-7 player) × 6 cols. Pathfinding uses hex neighbors.
- **Canvas sizing:** Responsive; board dimensions in pixels driven by HEX_SIZE constant. Left panel / right panels overlay per game mode.

## Anti-Patterns

### Hardcoded Trait/Ability/Item Dispatch

**What happens:** New trait effects require editing traitEffects.ts; new abilities require editing ability.ts registry section
**Why it's wrong:** Coupling; hard to add new content without touching core files
**Do this instead:** Already fixed — use the registration pattern (see ability.ts, item modules). If a new trait is added to TRAIT_MAP, its effects are automatically available in initTraitEffects by name.

### Direct Canvas Manipulation Outside Render Layers

**What happens:** Some VFX drawn directly in combatEngine (old pattern)
**Why it's wrong:** Rendering logic scattered; hard to debug visual bugs
**Do this instead:** All rendering should go through render/layers or use event log (state.events.push({ type: 'vfx', ... })). Let render loop consume events.

### Mutable Global Unit Arrays

**What happens:** Units passed by reference; hard to track who owns mutation rights
**Why it's wrong:** State coherence issues; can't parallelize; hard to replay
**Do this instead:** All mutations go through combatEngine; no external code mutates unit arrays directly. createCombatState() is the contract boundary.

## Error Handling

**Strategy:** Permissive; catch errors at top level only (main try/catch wraps game loop). Most errors prevent specific action but continue.

**Patterns:**
- Ability not found → Ignore cast (unit resets mana, continues)
- Missing unit definition → Unit not placed in shop
- Invalid hex coordinate → Placement rejected silently
- Projectile target dies mid-flight → Projectile continues; onHit does null-check

## Cross-Cutting Concerns

**Logging:** Console.log for debug (no persistent logs in browser). CLI scripts use console for progress + results.

**Validation:** 
- Unit definitions validated at data load time (UNIT_MAP init)
- Trait thresholds checked at trait initialization
- Combat state invariants not explicitly checked (assumes valid RunState → CombatState conversion)

**Authentication:** Not applicable (single-player game). Bot opponent personas are just decision weights (no identity).

---

*Architecture analysis: 2026-08-16*
