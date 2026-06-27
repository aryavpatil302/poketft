# Run Combat Test

Run the full test suite and do a headless combat sanity check.

## Step 1 — Run all tests

```bash
npx vitest run
```

Fix any failing tests before proceeding. Do not skip or suppress test failures.

## Step 2 — Headless combat sanity check

Run the headless combat script if it exists:

```bash
npx tsx src/core/combatTest.ts
```

If it doesn't exist yet, create `src/core/combatTest.ts`:

```typescript
import { makeUnit } from './unitFactory'
import { createCombatState } from './combatEngine'
import { runCombat } from './combatEngine'

const player = makeUnit('tangela', 'player', 1)
player.hexPos = { col: 0, row: 3 }

const enemy = makeUnit('vigoroth', 'enemy', 1)
enemy.hexPos = { col: 6, row: 0 }

const state = createCombatState([player], [enemy])
const result = runCombat(state, { maxTicks: 1800, verbose: true })

console.log(`Winner: ${result.winner}`)
console.log(`Duration: ${result.ticksElapsed} ticks (${(result.ticksElapsed / 60).toFixed(1)}s)`)
console.log(`Tangela final HP: ${result.finalState.units.get(player.id)?.currentHp ?? 'dead'}`)
console.log(`Vigoroth final HP: ${result.finalState.units.get(enemy.id)?.currentHp ?? 'dead'}`)
```

## What to verify in the output

- [ ] Combat ends (doesn't run forever)
- [ ] Winner is declared correctly
- [ ] Duration is reasonable (5–30 seconds of simulated combat)
- [ ] Tangela's ability fired at least once (look for "cast" events in verbose log)
- [ ] Mana numbers make sense (Tangela starts at 65 mana, casts at 110)
- [ ] Attack damage numbers are plausible (Vigoroth 1-star = 45 base attack, ~28% reduction from Tangela's 40 def)
- [ ] No NaN or Infinity in any stat

## Step 3 — Check for common bugs

- Units never reaching each other (pathfinding broken)
- Units stuck in 'moving' state forever (state machine loop)
- Ability never casting (mana gain broken)
- HP going negative (damage capping missing)
- Infinite loop (missing win/loss check)
