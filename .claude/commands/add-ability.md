# Implement Ability

Implement or fix an ability handler for an existing unit. The unit must already be in `src/data/units.ts`.

## Checklist before writing code

1. Read the ability description from `src/data/units.ts` (the `ability.description` and `ability.scaling` fields).
2. Read `src/core/types.ts` fully — especially `Unit`, `CombatState`, `Shield`, `StatusEffect`, `Projectile`.
3. Read `src/core/systems/ability.ts` to see the `AbilityHandler` interface and `ABILITY_REGISTRY`.
4. Read 1-2 existing ability files (e.g. `src/core/abilities/tangela.ts`, `src/core/abilities/vigoroth.ts`) as reference for patterns.

## Common patterns

### Shield with expire callback (Tangela-style)
```typescript
const shield: Shield = {
  id: crypto.randomUUID(),
  sourceAbility: 'ability_id',
  value: scalingValues[tier - 1],
  maxValue: scalingValues[tier - 1],
  durationTicks: durationSeconds * TICK_RATE,  // -1 for "until broken"
  onExpire: (u, s) => {
    if (s.value > 0) {
      // heal, deal damage, etc.
    }
  },
}
unit.shields.push(shield)
state.events.push({ type: 'shield', unitId: unit.id, amount: shield.value })
```

### Attack speed / damage buff tied to shield (Vigoroth-style)
```typescript
// Apply buff as a status effect that computeStats() reads
addStatusEffect(unit, {
  id: 'unit_atkspd_buff',
  sourceUnitId: unit.id,
  durationTicks: -1,    // -1 = removed manually
  magnitude: 0.30,      // fractional bonus (0.30 = +30%)
  stackId: 'unit_atkspd',
})
// Remove in shield.onExpire:
// removeStatusEffect(u, 'unit_atkspd_buff')
```

### Projectile (Ribombee-style)
```typescript
import { createProjectile } from '../projectile'
const target = state.units.get(unit.targetId!)
if (!target) return
state.projectiles.set(projId, createProjectile({
  sourceId: unit.id,
  targetId: target.id,
  startPos: { ...unit.visualPos },
  speed: 8,   // pixels per tick
  damagePayload: {
    baseAmount: scalingValues[tier - 1],
    damageType: 'magic',
    canCrit: false,
    scalingStat: 'special',
    scalingRatio: 0,
  },
}))
```

### AoE damage in a hex radius
```typescript
import { hexesInRange } from '../hexGrid'
for (const hex of hexesInRange(unit.hexPos, 1)) {
  const targetId = state.hexOccupancy.get(hexId(hex))
  if (!targetId) continue
  const target = state.units.get(targetId)
  if (!target || target.team === unit.team || target.state === 'dead') continue
  applyDamage(unit, target, { baseAmount: dmg, damageType: 'magic', canCrit: false }, state)
}
```

### Jump / teleport
```typescript
import { findBestAttackHex } from '../systems/movement'
const dest = findBestAttackHex(unit, leapTarget, state)
teleportUnit(unit, dest, state)  // updates hexPos + hexOccupancy
```

### Stun
```typescript
addStatusEffect(target, {
  id: 'stun',
  sourceUnitId: unit.id,
  durationTicks: 2 * TICK_RATE,  // 2 seconds
})
// stun forces target.state = 'stunned' in statusEffect.ts tickStatusEffects()
```

## Required: write a test
After implementing, create `src/core/abilities/<unitname>.test.ts`:
- Build a minimal `CombatState` with just the caster and one enemy
- Set `unit.currentMana = unit.maxMana` then call `triggerAbility(unit, state)`
- Assert: correct status effects/shields/projectiles were applied
- Assert: scaling values match the tier (test all 3 tiers)
- Assert: mana was reset to 0 and manaLockTimer was set
