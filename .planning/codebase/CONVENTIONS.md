# Coding Conventions

**Analysis Date:** 2026-08-16

## Naming Patterns

**Files:**
- Source files: `kebab-case.ts` (e.g., `combatEngine.ts`, `hexGrid.ts`)
- Test files: `*.test.ts` (e.g., `unitFactory.test.ts`)
- Type/interface files: lowercase with clear purpose (e.g., `types.ts`, `constants.ts`)
- Ability implementations: `[pokemonName].ts` in `src/core/abilities/` (e.g., `aerodactyl.ts`)
- Directories: `kebab-case` or `camelCase` based on domain (e.g., `src/core/systems/`, `src/core/abilities/`)

**Functions:**
- camelCase: `tickCombat()`, `makeUnit()`, `applyDamage()`, `computeStats()`
- Exported functions clearly named: `export function tickMovement(...)`
- Handler functions: `onCast()`, `onLand()`, `onExpire()` — prefixed with event context
- Utility/helper functions: descriptive camelCase (e.g., `findNearestEnemy()`, `creditMitigation()`)

**Variables:**
- camelCase throughout: `currentHp`, `maxMana`, `attackSpeed`, `hexPos`
- Constants: UPPERCASE_SNAKE_CASE (e.g., `HP_SCALE`, `HEX_SIZE`, `BOARD_ROWS`)
- Array/collection variables: plural or descriptive (e.g., `units`, `projectiles`, `statusEffects`)
- Loop counters: simple single letters (`i`, `s`, `r`, `t` for trait) in tight loops

**Types:**
- Interface/type names: PascalCase (e.g., `UnitDefinition`, `CombatState`, `DamagePayload`)
- Union/literal types: lowercase with hyphens (e.g., `'physical' | 'magic' | 'true'`, `'idle' | 'moving' | 'dead'`)
- Readonly/frozen data: marked in interface (`readonly` keyword when immutable at runtime)

## Code Style

**Formatting:**
- No explicit ESLint or Prettier config detected — appears to follow implicit conventions
- 2-space indentation (based on source file inspection)
- Semicolons used throughout
- Lines generally stay under 100 characters

**Linting:**
- TypeScript strict mode enabled (`strict: true` in `tsconfig.json`)
- `noUnusedLocals: true` enforced
- `noUnusedParameters: true` enforced
- `noFallthroughCasesInSwitch: true` enforced
- No external linter config found (ESLint/Prettier not configured)

## Import Organization

**Order:**
1. Type imports: `import type { ... } from './types'`
2. Regular imports from same package: `import { ... } from './hexGrid'`
3. Imports from parent package: `import { ... } from '../data/units'`
4. Side-effect imports: `import '../systems/ability'` (for passive registrations)

**Path Aliases:**
- No path aliases configured; all imports are relative
- Paths use explicit relative notation: `../`, `./`

**Example from `src/core/combatEngine.ts`:**
```typescript
import type { Unit, CombatState, CombatResult, CombatEvent } from './types'
import { hexId, hexToPixel } from './hexGrid'
import { HEX_SIZE } from './constants'
import { computeStats } from './unitFactory'
import { tickStatusEffects, tickShields } from './systems/statusEffect'
```

## Comments and Documentation

**Section Dividers:**
- Use ASCII comment dividers to mark sections: `// ─── Section Name ─────────────────`
- Example: `// ─── Coordinate Conversion ────────────────────────────────────────────────────`
- Improves readability of long files

**Inline Comments:**
- Single-line comments for clarifications: `// Only apply stat buff once`
- Guard comments explain preconditions: `// Guard: only apply the stat buff once (stackId prevents duplicate status effects)`
- Code section comments explain "why" not "what": "// Permanently block mana gain — Ancient Power fires once and never again"

**JSDoc Comments:**
- JSDoc not used; simple single-line comments preferred
- Comments immediately above the relevant code
- Multi-line explanations placed before function/block, not parameter-by-parameter JSDoc

**No TODO format observed:**
- Only one TODO found in codebase: `// TODO(round-3-items): on the final creep round, grant the player an item reward here.`
- Format: `// TODO(feature-name): description of what needs to be done`

## Function Design

**Size:**
- Functions are focused and single-purpose
- Examples: `tickLeapMovement()` handles one state, `creditMitigation()` handles one responsibility
- Larger files (1200+ LOC) contain multiple related functions grouped by purpose

**Parameters:**
- Type annotations always present (strict TypeScript)
- Destructuring used for complex objects: `{ col, row }` for coordinates
- Defaults not heavily used; explicit parameter passing preferred

**Return Values:**
- Functions use explicit return types
- Common patterns:
  - `void` for side-effect functions: `tickMovement(unit, state): void`
  - Typed returns: `applyDamage(...): ApplyDamageResult`
  - Nullable returns marked clearly: `Unit | null`
  - Boolean returns for checks: `isValidHex()`, `rollCrit()`

**Error Handling:**
- Guards pattern: check invalid state at function start and return early
- Example: `if (target.state === 'dead') return { finalDamage: 0, preMitigDamage: 0, isCrit: false }`
- Type safety over exceptions: functions return typed results rather than throw
- No try/catch patterns observed; validation done via checks

## Module Design

**Exports:**
- Named exports preferred: `export function applyDamage(...) { }`
- Type exports separate: `export type HexId = string`
- Interface exports: `export interface UnitDefinition { }`
- No default exports observed

**Barrel Files:**
- Used for re-exporting: `src/data/items/index.ts` aggregates item modules
- Centralizes imports: allows `import { ITEM_MAP } from '../data/items'`

**Module Structure Pattern:**
- Modules export a single main function or interface
- Related utilities in the same file
- Large domains split into subdirectories: `src/core/systems/`, `src/core/abilities/`

## Key Patterns

**Type Narrowing:**
- Guard clauses at function start: `if (!item) continue`
- Optional chaining rare; explicit null checks preferred
- Status effect checking: `statusEffects.some(fx => fx.id === 'example')`

**Computed State:**
- Use `_computedStats` for cached derived state: `unit._computedStats = computeStats(unit)`
- Prefix underscore indicates "computed/internal": `_traitStat`, `_leap`
- Recompute on demand: `target._computedStats ?? computeStats(target)`

**Array Operations:**
- `for...of` loops for iteration and modification
- `Map<K, V>` for id-based lookups: `units.set(unit.id, unit)`
- `.filter()` for side effects: `unit.shields = unit.shields.filter(s => s.value > 0)`

---

*Convention analysis: 2026-08-16*
