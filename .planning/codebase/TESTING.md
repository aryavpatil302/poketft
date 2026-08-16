# Testing Patterns

**Analysis Date:** 2026-08-16

## Test Framework

**Runner:**
- Vitest 1.6.0
- Config: Not explicitly configured (uses Vitest defaults)

**Assertion Library:**
- Vitest's built-in `expect()` from vitest module

**Run Commands:**
```bash
npm test                 # Run all tests once
npm run test:watch      # Watch mode with auto-rerun
npm run test:e2e        # Run Cucumber E2E tests
npm run test:e2e:ability # Run E2E ability tests only
```

**Test Output:**
- Results cached in `node_modules/.vite/vitest/results.json`
- No explicit coverage tool configured; coverage available via Vitest CLI flags

## Test File Organization

**Location:**
- **Unit/System tests:** Co-located with source in same directory using `.test.ts` suffix
- **Ability tests:** `src/core/abilities/[unitName].test.ts` alongside `[unitName].ts`
- **System tests:** `src/core/systems/[system].test.ts` alongside `[system].ts`
- **Economy tests:** `src/econ/[module].test.ts` alongside `[module].ts`
- **E2E tests:** Separate `e2e/` directory with Cucumber features and step definitions

**File Count:**
- ~100 test files across the codebase (total 82,908 LOC)
- Test files range from 50 LOC (minimal tests) to 700+ LOC (comprehensive suites)

**Naming:**
- Pattern: `[module].test.ts` (e.g., `hexGrid.test.ts`, `income.test.ts`)
- Feature files: `[ability].feature` in `e2e/features/abilities/`

## Test Structure

**Basic Pattern:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'

describe('Feature Name', () => {
  it('should describe expected behavior', () => {
    // Arrange
    const unit = makeUnit('tangela', 'player', 1)
    
    // Act
    const result = someFunction(unit)
    
    // Assert
    expect(result).toBe(expected)
  })
})
```

**Setup/Teardown:**
- `beforeEach()` used for common setup per test
- `afterEach()` used for cleanup (e.g., `afterEach(() => setGenomeOverrides(null))`)
- Inline setup preferred when tests differ significantly

**Example with beforeEach:**
```typescript
describe('Aerodactyl - Ancient Power', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('aerodactyl', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('applies ancient_power_stats status effect at tier 1', () => {
    cast(caster, state)
    const fx = caster.statusEffects.find(e => e.id === 'ancient_power_stats')
    expect(fx).toBeDefined()
  })
})
```

## Common Test Patterns

**Unit Creation (Factory Pattern):**
```typescript
// Simple creation with defaults
const unit = makeUnit('tangela', 'player', 1)

// With tier scaling
const tier2 = makeUnit('tangela', 'player', 2)
const tier3 = makeUnit('tangela', 'player', 3)
```

**Combat State Setup:**
```typescript
// Create multiple units and place on board
const player = makeUnit('aerodactyl', 'player', 1)
player.hexPos = { col: 3, row: 5 }
const enemy = makeUnit('dummy', 'enemy', 1)
enemy.hexPos = { col: 3, row: 2 }

// Initialize combat state with both teams
const state = createCombatState([player], [enemy])
```

**Ability Testing (Helper Function):**
```typescript
// Custom helper for casting abilities in tests
function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

// Usage
cast(caster, state)
```

**Economy Round Simulation:**
```typescript
// Helper for testing economy system
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function runSoloRounds(botIndex: number, rounds: number, seed: number): { run, bot } {
  const run = newRun(botSeats())
  const bot = run.players[botIndex]
  const rng = seededRng(seed)
  for (let r = 1; r <= rounds; r++) {
    run.round = r
    settleRound(bot, { won: r % 2 === 0, draw: false, survivorStars: 1, round: r })
    botPlanRound(run, bot, 0, rng)
  }
  return { run, bot }
}
```

## Assertion Patterns

**Equality & Value Tests:**
```typescript
expect(value).toBe(expected)           // Strict equality
expect(array).toHaveLength(count)      // Array/string length
expect(set).toHaveLength(5)            // Set uniqueness via length
expect(result).toBeCloseTo(0.30)       // Float comparisons with tolerance
```

**Collection Assertions:**
```typescript
expect(array).toContain(item)          // Includes check
expect(collection).not.toContain(item) // Negated containment
expect(new Set(...)).toHaveLength(n)   // Unique count
```

**Boolean & State Assertions:**
```typescript
expect(unit.state).toBe('idle')        // String state
expect(fx).toBeDefined()               // Existence check
expect(null).toBeNull()                // Null checks
expect(result).toEqual(expected)       // Deep object equality
```

**Comparison Assertions:**
```typescript
expect(value).toBeGreaterThanOrEqual(4)    // Numeric comparisons
expect(value).toBeLessThanOrEqual(10)
expect(list.length).toBeGreaterThanOrEqual(2)
```

## Test Data & Factories

**Unit Factory:**
- Location: `src/core/unitFactory.ts`
- Used in virtually all tests via `makeUnit(id, team, tier)`
- Creates fully initialized units with all stats and properties
- Example: `const unit = makeUnit('tangela', 'player', 1)`

**Combat State:**
- Location: `src/core/combatEngine.ts`
- Created via `createCombatState(playerUnits, enemyUnits, stage?)`
- Initializes all game state: hex occupancy, terrain, projectiles, events

**Test Helpers (defined per test file):**
- `cast()` — triggers ability and advances ticks
- `runSoloRounds()` — simulates economy rounds for bot testing
- `seededRng()` — deterministic RNG for reproducible tests
- `freshEcon()` — creates empty economy state with custom gold/streak

**Test Scenarios (JSON-based):**
- Location: `src/repoTests.ts`
- Defines preset unit placements and configurations
- Loaded in `main.ts` for pre-built combat scenarios
- Format: `{ label, units: [{ id, tier, col, row, team }] }`

## Mocking & Isolation

**Mocking Approach:**
- No explicit mocking framework (sinon, jest.mock, etc.) detected
- Isolation achieved via factory functions and controlled state creation

**What to Mock:**
- RNG for deterministic tests: `seededRng()` helper provides custom RNG
- External state: `setGenomeOverrides(null)` in afterEach
- API responses: Not applicable (no API calls in core logic)

**What NOT to Mock:**
- Game engine functions: Use real `createCombatState()`, `tickAbilityCast()`, etc.
- Unit creation: Real `makeUnit()` factory always used
- Combat simulation: No stubbing of combat loop

## Test Coverage

**Coverage:**
- No enforcement configured; coverage available via Vitest but not measured
- Heavily tested areas:
  - **Abilities:** 100+ ability implementations, each with test file
  - **Core systems:** damage, movement, targeting, status effects, traits
  - **Economy:** income, XP, bot behavior, composition affinities
  - **Utilities:** hex grid operations, unit factory

**Known Coverage Gaps:**
- Render layer (`src/render/`) not tested
- UI layer (`src/ui/`) has minimal testing
- E2E tests cover high-level ability scenarios only

**Coverage by Category:**
```
src/core/abilities/        ~135 .test.ts files (one per ability)
src/core/systems/          Multiple test files per system
src/econ/                  ~10 test files for economy
src/core/hexGrid.test.ts   Comprehensive hex math tests
```

## E2E Testing (Cucumber + Selenium)

**Framework:**
- Cucumber.js 12.9.0 with Gherkin syntax (`.feature` files)
- Selenium WebDriver 4.44.0 for browser automation
- ChromeDriver 148.0.4 for Chrome testing

**Test Structure:**
```gherkin
Feature: Snorunt - Ice Body

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 shield activates
    Given snorunt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "snorunt_t1_shield_explode"
```

**Step Definitions:**
- Location: `e2e/step_definitions/setup.ts`
- Imports: `Given`, `When`, `Then` from `@cucumber/cucumber`
- Hooks: `e2e/support/hooks.ts` for driver setup/teardown
- World: `e2e/support/world.ts` provides `PokeTFTWorld` context

**Example Steps:**
```typescript
import { Given, When, Then } from '@cucumber/cucumber'
import type { PokeTFTWorld } from '../support/world.js'

Given(
  '{word} is placed as player at col {int} row {int} at tier {int}',
  async function (this: PokeTFTWorld, unitId: string, col: number, row: number, tier: number) {
    await this.selectUnit(unitId, tier as 1 | 2 | 3)
    await this.clickHex(col, row)
  },
)

When('I start combat and wait {int} seconds', { timeout: 120_000 }, async function (this: PokeTFTWorld, seconds: number) {
  await this.startCombat()
  await this.waitForTicks(seconds * 60, (seconds + 10) * 1000)
})

Then('combat should have run without JavaScript errors', async function (this: PokeTFTWorld) {
  const errors = await this.getConsoleErrors()
  const critical = errors.filter(e => !e.includes('favicon'))
  if (critical.length > 0) {
    throw new Error(`JavaScript errors in browser:\n${critical.join('\n')}`)
  }
})
```

**E2E Test Files:**
- Location: `e2e/features/abilities/` — one `.feature` per ability
- File count: ~40+ feature files (one per tested ability)
- Pattern: Setup units → run combat → verify no errors → take screenshot

## Test Run Behavior

**What Tests Verify:**
- Unit creation and stat calculation (tiers, base stats, item scaling)
- Combat engine ticks (movement, attacking, casting, status effects)
- Ability mechanics (scaling, effects, status application)
- Economy rounds (income, XP, level ups, gold management)
- Trait synergies (composition checking, stat bonuses)
- Hex grid math (coordinate conversion, distance, pathfinding)

**No Tests Skip/Only Detected:**
- No `it.skip()`, `it.only()`, `describe.skip()`, or `describe.only()` patterns found in codebase
- All tests run on every test suite execution

**Determinism:**
- Tests use seeded RNG for reproducibility
- Economy tests pass multiple seeds to catch edge cases
- E2E tests have fixed unit placements

---

*Testing analysis: 2026-08-16*
