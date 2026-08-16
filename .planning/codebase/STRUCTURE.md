# Codebase Structure

**Analysis Date:** 2026-08-16

## Directory Layout

```
poketft/ [project root]
├── src/
│   ├── main.ts                      # Entry point: DOM setup, game loop, event handlers
│   ├── repoTests.ts                 # Suite of repo-wide test scenarios
│   ├── vite-env.d.ts                # Vite type declarations
│   │
│   ├── core/                        # Core combat and game logic
│   │   ├── combatEngine.ts          # Main tick loop; coordinates all combat systems
│   │   ├── combatTest.ts            # Test utilities for combat scenarios
│   │   ├── constants.ts             # Game balance constants (HEX_SIZE, TICK_RATE, etc.)
│   │   ├── hexGrid.ts               # Hex coordinate math; pathfinding
│   │   ├── projectile.ts            # Projectile creation; arc physics
│   │   ├── rng.ts                   # Seeded RNG; crit/targeting rolls
│   │   ├── types.ts                 # Core type definitions (Unit, CombatState, etc.)
│   │   ├── unitFactory.ts           # Unit creation; stat computation
│   │   │
│   │   ├── abilities/               # 60+ Pokémon ability implementations
│   │   │   ├── a_exeggutor.ts       # A-Exeggutor egg bomb ability
│   │   │   ├── tapu_bulu.ts         # Tapu Bulu terrain setter
│   │   │   ├── rayquaza.ts          # Rayquaza swift strike
│   │   │   └── [50+ more units].ts  # One ability file per unit (co-located tests)
│   │   │
│   │   └── systems/                 # 22 independent combat systems
│   │       ├── ability.ts           # Ability registry + trigger logic
│   │       ├── attack.ts            # Attack windup, damage determination
│   │       ├── damage.ts            # Damage application; mitigation calc
│   │       ├── heal.ts              # Healing application
│   │       ├── mana.ts              # Mana gain; mana lock
│   │       ├── movement.ts          # Path calculation; hex movement
│   │       ├── targeting.ts         # Nearest enemy; ally targeting
│   │       ├── statusEffect.ts      # Status effect tick; expiry
│   │       ├── shield.ts            # Shield mechanics
│   │       ├── marks.ts             # Unit mark detonation
│   │       ├── persistentAoE.ts     # Persistent zone damage tick
│   │       ├── spellBuff.ts         # Spell buff stacking
│   │       ├── terrain.ts           # Terrain flag management
│   │       ├── traitEffects.ts      # All 10+ trait effects (Volcano, Jungle, etc.)
│   │       ├── traitAttribution.ts  # Damage source attribution to traits
│   │       ├── cavecrawler.test.ts  # Tests for Earthquake trait
│   │       ├── skystriker.test.ts   # Tests for airborne/immunity effects
│   │       └── [more ].test.ts      # System-specific test suites
│   │
│   ├── data/                        # Static game definitions
│   │   ├── units.ts                 # UNIT_MAP: 100+ Pokémon definitions
│   │   ├── traits.ts                # TRAIT_MAP: 10+ trait definitions with thresholds
│   │   ├── traitTooltips.ts         # User-facing trait descriptions
│   │   │
│   │   └── items/                   # Item definitions (one file per item)
│   │       ├── weakness_policy.ts   # Item modules with def + passive
│   │       ├── lifeorb.ts           # Damage boost item
│   │       ├── assault_vest.ts      # Defense item
│   │       └── index.ts             # ITEM_MAP aggregation + passive registration
│   │
│   ├── econ/                        # Economy / meta-game layer
│   │   ├── runState.ts              # RunState interface; persistence to localStorage
│   │   ├── shop.ts                  # Shop logic (roll, buy, sell)
│   │   ├── combine.ts               # Unit combining (1-star → 2-star, etc.)
│   │   ├── xp.ts                    # XP spending; level progression
│   │   ├── income.ts                # Gold settlement (win/loss/streak)
│   │   ├── bots.ts                  # Bot AI personas; round planning
│   │   ├── botMatches.ts            # Bot-vs-bot matchmaking; creep round handling
│   │   ├── botItems.ts              # Bot item selection logic
│   │   ├── botNames.ts              # Bot persona naming
│   │   ├── creeps.ts                # Creep round definitions (Diglett, Slowbro, etc.)
│   │   ├── caveCrawlerSpawn.ts      # Earthquake trait item reward logic
│   │   ├── constants.ts             # Economy balancing (REROLL_COST, SHOP_ODDS, etc.)
│   │   │
│   │   ├── compositionSignature.ts  # Hash of unit comp (detects meta shifts)
│   │   ├── trainCompositionAffinities.ts  # ML: learns unit pairing synergies
│   │   ├── learnedCompositionAffinities.ts # Loaded affinity matrix
│   │   ├── trainCatalogComps.ts     # ML: optimal comps per stage
│   │   ├── catalogIndex.ts          # Indexed catalog of learned comps
│   │   ├── trainAll.ts              # Master training script
│   │   │
│   │   ├── aiSummary.ts             # AI state snapshot (for debugging)
│   │   ├── train.ts                 # CLI: train bot opponents pipeline
│   │   ├── trainedGenomes.ts        # Saved bot decision trees
│   │   ├── learningCredit.ts        # Credit assignment for losses
│   │   ├── growCatalog.ts           # Expand catalog with new comps
│   │   ├── itemAffinity.ts          # Item-composition pairings
│   │   ├── preferredItems.ts        # Item selection weights
│   │   ├── catalogIndexGen.ts       # Catalog index generation
│   │   │
│   │   └── *.test.ts                # Economy system tests
│   │
│   ├── enemy/                       # Opponent generation & calibration
│   │   ├── generator.ts             # Generate enemy board from catalog
│   │   ├── boardPower.ts            # Estimate board strength
│   │   ├── calibration.ts           # Online ML: win-rate predictor (Brier score)
│   │   ├── battleLog.ts             # Persistence: versioned battle history
│   │   │
│   │   └── *.test.ts                # Enemy generation tests
│   │
│   ├── sim/                         # Headless combat simulation (CLI scripts)
│   │   ├── run.ts                   # Single combat runner
│   │   ├── runner.ts                # Multi-game runner with stats
│   │   ├── botGame.ts               # Single bot game
│   │   ├── botLeague.ts             # Multi-bot league (5 bots per game, 100 games)
│   │   ├── leagueReport.ts          # Generate league standings HTML
│   │   ├── reportAssets.ts          # League report styling
│   │   ├── calibrate.ts             # Calibration update loop
│   │   │
│   │   └── *.test.ts                # Simulation tests
│   │
│   ├── render/                      # Rendering layer
│   │   └── layers/
│   │       ├── boardLayer.ts        # Hex grid visualization; terrain overlay; combat timer
│   │       ├── unitLayer.ts         # Unit sprite rendering; animation timing; hover/select
│   │       └── effectLayer.ts       # VFX rendering (projectiles, particle effects, spell waves)
│   │
│   └── ui/                          # User interface controls
│       ├── teamBuilder.ts           # Unit placement UI; shop display; bench management
│       └── combatControls.ts        # Combat mode controls (skip turn, etc.)
│
├── public/                          # Static assets (sprites, icons, backgrounds)
│   └── visuals/
│       ├── sprites/                 # Unit/item sprites (webp)
│       ├── backgrounds/             # Board backgrounds
│       ├── trait\ icons/            # Trait ability badges
│       ├── effects/                 # VFX sprites
│       └── ...
│
├── dist/                            # Build output (generated)
│   ├── index.html
│   ├── assets/                      # Bundled JS + CSS
│   └── visuals/                     # Copied static assets
│
├── tests/                           # Global test data
│   └── [test JSON scenarios]
│
├── docs/                            # Documentation
│
├── e2e/                             # End-to-end tests (Cucumber + Selenium)
│   ├── features/
│   ├── step_definitions/
│   └── support/
│
├── scripts/                         # Utility scripts
│
├── blog/                            # Astro blog (separate project)
│   ├── src/
│   └── public/
│
├── training_runs/                   # Output from ML training scripts
│
├── package.json                     # NPM scripts + dev dependencies
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
└── .planning/
    └── codebase/                    # Generated documentation (this file)
        ├── ARCHITECTURE.md
        └── STRUCTURE.md
```

## Directory Purposes

**src/core:**
- Purpose: Combat engine and core game mechanics
- Contains: Tick loop, 22 combat systems, 60+ abilities, hex grid, type definitions
- Key files: `combatEngine.ts` (orchestrator), `systems/*.ts` (modular logic), `abilities/*.ts` (unit-specific)

**src/core/abilities:**
- Purpose: Pokémon-specific ability implementations
- Contains: One `.ts` file per unit; `.test.ts` co-located
- Pattern: Export AbilityHandler; import in `systems/ability.ts`; auto-register

**src/core/systems:**
- Purpose: 22 independent combat subsystems (no interdependencies)
- Contains: Damage calc, targeting, movement, projectiles, marks, trait effects, etc.
- Pattern: Pure functions (unit, state) → void; called once per tick or on-demand

**src/data:**
- Purpose: Static game definitions
- Contains: Unit/trait/item definitions; read-only maps
- Loaded at: Startup; immutable during gameplay

**src/data/items:**
- Purpose: Item definitions with combat effects
- Contains: One file per item; exports ItemModule (def + passive)
- Aggregated by: `items/index.ts` → ITEM_MAP

**src/econ:**
- Purpose: Economy and bot AI systems
- Contains: Shop, XP, gold, bot planning, ML training
- Key files: `runState.ts` (state shape), `bots.ts` (bot logic), `train.ts` (CLI entry)

**src/enemy:**
- Purpose: Enemy board generation and calibration
- Contains: Catalog-based generator, board power calc, ML win-rate predictor
- Used by: main.ts (bot round setup), training scripts

**src/sim:**
- Purpose: Headless combat simulation (no UI)
- Contains: Runner infrastructure, bot game loop, league report generation
- Entry points: CLI scripts (`npm run sim-bots`, `npm run train-bots`)

**src/render/layers:**
- Purpose: Canvas rendering
- Contains: BoardLayer (hex grid), UnitLayer (sprites), EffectLayer (VFX)
- Pattern: Each layer handles one visual concern; drawn in order (board → units → effects)

**src/ui:**
- Purpose: User input and planning-phase UI
- Contains: Team builder (unit placement), shop display, bench management
- Used by: main.ts event listeners

**public/visuals:**
- Purpose: Static image assets
- Contains: Sprites (PNG/WebP), backgrounds, trait icons, VFX
- Served by: Vite static file server

**dist/:**
- Purpose: Build output (generated; not committed)
- Generated by: `npm run build`

**e2e/:**
- Purpose: Behavioral tests (Cucumber features)
- Contains: Feature files (.feature), step definitions (.ts)
- Runner: Selenium + Chrome Driver

**training_runs/:**
- Purpose: Output directory for ML training (bot affinities, calibration)
- Generated by: `npm run train-bots`, `npm run sim-bots`

## Key File Locations

**Entry Points:**
- `src/main.ts`: Browser app entry point
- `src/econ/train.ts`: Bot training CLI
- `src/sim/botLeague.ts`: Bot league simulation CLI
- `src/core/combatEngine.ts`: Combat tick function (used by both main.ts and sim/)

**Configuration:**
- `src/core/constants.ts`: Game balance (HEX_SIZE, TICK_RATE, BOARD_PERSP_Y, OVERLAY_HEADROOM, HP_BAR_HEIGHT)
- `src/econ/constants.ts`: Economy balance (REROLL_COST, XP_BUY_COST, SHOP_ODDS, POOL_COPIES)
- `tsconfig.json`: TypeScript settings (ES2020 target, strict mode)
- `vite.config.ts`: Vite build settings

**Core Logic:**
- `src/core/combatEngine.ts`: advanceCombatTick (main game loop)
- `src/core/systems/damage.ts`: Damage calculation with mitigation
- `src/core/systems/targeting.ts`: Nearest enemy + ally targeting
- `src/core/systems/traitEffects.ts`: All 10+ trait passive effects
- `src/econ/shop.ts`: Shop mechanics (roll, buy, sell, combine)
- `src/econ/bots.ts`: Bot decision-making (60KB, core AI logic)

**Testing:**
- `src/core/abilities/*.test.ts`: Ability unit tests (co-located)
- `src/core/systems/*.test.ts`: Combat system tests
- `src/econ/*.test.ts`: Economy tests
- `src/repoTests.ts`: Repo-wide test suite
- `e2e/features/*.feature`: Behavioral tests

**Data:**
- `src/data/units.ts`: UNIT_MAP (100+ Pokémon)
- `src/data/traits.ts`: TRAIT_MAP (10+ traits with thresholds)
- `src/data/items/index.ts`: ITEM_MAP aggregation

## Naming Conventions

**Files:**
- Module name reflects primary export (e.g., `damage.ts` exports applyDamage function)
- Abilities: lowercase unit ID + `.ts` (e.g., `pikachu.ts`, `a_exeggutor.ts` for Alolan variant)
- Tests: `.test.ts` suffix (co-located with implementation)
- No index.ts used except in `data/items/` and ability registry

**Directories:**
- Lowercase plural for collections (e.g., `abilities/`, `systems/`, `items/`)
- One-level deep (no nested src/core/systems/damage/ subdirectories)

**Functions:**
- camelCase: `applyDamage()`, `findNearestEnemies()`, `tickStatusEffects()`
- Verbs + nouns: `apply*`, `tick*`, `register*`, `create*`, `compute*`

**Types & Interfaces:**
- PascalCase: `Unit`, `CombatState`, `AbilityHandler`, `ItemModule`
- Abstract concepts: `DamagePayload`, `AttackModifier`, `StatusEffect`, `Shield`

**Constants:**
- SCREAMING_SNAKE_CASE: `HEX_SIZE`, `TICK_RATE`, `BOARD_COLS`, `REROLL_COST`

**Event Types:**
- Lowercase ID: `{ type: 'vfx', effectId: 'wandering_spirit_consume' }`, `{ type: 'cast', unitId, abilityId }`

## Where to Add New Code

**New Pokémon Ability:**
1. Create `src/core/abilities/[pokemon_name].ts`
2. Export `AbilityHandler` with abilityId matching unit definition
3. Import in `src/core/systems/ability.ts` (top section, grouped by trait)
4. Call `registerAbility([Name]Ability)` in same file
5. Add co-located `.test.ts` file with unit tests
6. Update `src/data/units.ts` if unit is new

**New Trait:**
1. Add trait definition to `src/data/traits.ts` (TRAIT_MAP with thresholds)
2. Implement effect logic in `src/core/systems/traitEffects.ts` (initTraitEffects function)
3. Add user-facing tooltip to `src/data/traitTooltips.ts`
4. If trait adds visual feedback: update `src/render/layers/boardLayer.ts` or `src/render/layers/effectLayer.ts`

**New Item:**
1. Create `src/data/items/[item_name].ts`
2. Export `ItemModule` with def (definition) + optional passive handler
3. Import in `src/data/items/index.ts`; add to ITEM_MAP export
4. Add co-located `.test.ts` file for passive testing

**New Combat System:**
1. Create `src/core/systems/[system_name].ts`
2. Export main function(s): (unit, state) => void
3. Called from `src/core/combatEngine.ts` in tickUnit() or advanceCombatTick()
4. Add co-located `.test.ts` file

**New Render Feature:**
1. Add logic to existing layer (boardLayer, unitLayer, or effectLayer) OR create new layer
2. Layer draws in fixed order: board → units → effects (manage z-index)
3. Triggered by CombatState values or event log (preferred for decoupling)

**New Economy Mode Feature:**
1. Update `src/econ/runState.ts` (RunState/PlayerEcon interface if new state needed)
2. Implement logic in appropriate econ module (shop.ts, xp.ts, income.ts, bots.ts)
3. Call from `src/main.ts` event handlers or economy phase loop
4. Persist to localStorage if needed (already handled by runState persistence layer)

## Special Directories

**src/core/abilities:**
- Purpose: Ability implementations (one per Pokémon)
- Generated: No
- Committed: Yes
- Size: ~2-4 KB per ability file; 60+ files total
- Organization: Alphabetical; grouped by trait in registry (ability.ts)

**src/data:**
- Purpose: Static game data
- Generated: Partially (ITEM_MAP aggregated from items/ files)
- Committed: Yes
- Mutable: Only during development (balance changes)

**training_runs/:**
- Purpose: ML training output (bot affinities, calibration results)
- Generated: Yes (by `npm run train-bots`, `npm run sim-bots`)
- Committed: No (.gitignore)
- Retention: Ephemeral (can be regenerated)

**dist/:**
- Purpose: Build output
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (.gitignore)

---

*Structure analysis: 2026-08-16*
