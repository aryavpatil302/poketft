# Add Pokemon Unit

Add a new Pokemon unit to the simulator. The user will provide stats and ability info (usually from the PDF).

## Steps

1. **Add the UnitDefinition to `src/data/units.ts`** using this exact shape:
```typescript
{
  id: 'lowercase_name',         // e.g. 'ribombee'
  name: 'Display Name',
  cost: 1,                       // 1-5
  traits: ['jungle'],            // lowercase trait ids from src/data/traits.ts
  baseStats: {
    hp: 500,
    startMana: 30,               // the left number in "30/60" mana notation
    maxMana: 60,                 // the right number
    attack: 25,
    special: 100,
    defense: 15,
    spDefense: 15,
    attackSpeed: 0.75,           // attacks per second
    critChance: 0.25,            // always 0.25 unless stated otherwise
    critDamage: 1.40,            // always 1.40 unless stated otherwise
    range: 4,                    // 1 = melee, >1 = ranged (hex distance)
  },
  ability: {
    id: 'ribombee_pollen_puff',
    name: 'Pollen Puff',
    description: 'Brief description of what the ability does.',
    // scaling values indexed [0]=1-star, [1]=2-star, [2]=3-star
    scaling: {
      damage: [100, 175, 300],
      healAmount: [100, 175, 300],
    },
  },
  spritePath: '/sprites/ribombee.png',
}
```

2. **Create the ability handler in `src/core/abilities/<unitname>.ts`** following the `AbilityHandler` interface:
```typescript
import type { AbilityHandler } from '../systems/ability'
import type { CombatState } from '../types'
import type { Unit } from '../types'

export const RibombeeAbility: AbilityHandler = {
  abilityId: 'ribombee_pollen_puff',
  castTimeTicks: 20,
  onCast(unit: Unit, state: CombatState, tier: number): void {
    // implement here
  },
}
```

3. **Register the ability handler** in `src/core/systems/ability.ts` in the `ABILITY_REGISTRY` map.

4. **Check trait membership**: Confirm the unit's traits are already in `src/data/traits.ts`. If not, use `/add-trait` first.

5. **Write a test** in `src/core/abilities/<unitname>.test.ts` verifying the ability fires correctly with a mock CombatState. At minimum test: ability fires at max mana, correct effect is applied, scaling values match tier.

## Health/AD scaling reminder
- Star 2 HP  = Star 1 HP × 1.8
- Star 3 HP  = Star 2 HP × 1.8
- Star 2 AD  = Star 1 AD × 1.5
- Star 3 AD  = Star 2 AD × 1.5

The PDF stats are for 1-star/2-star/3-star shown as `val1/val2/val3`. Use val1 as the base stat in `baseStats` — the factory applies star scaling for tier 2 and 3.

## Damage type guide
- "special damage" → `damageType: 'magic'`, scale off `unit.special`
- "attack damage" / "physical damage" → `damageType: 'physical'`, scale off `unit.attack`
- "true damage" → `damageType: 'true'`
