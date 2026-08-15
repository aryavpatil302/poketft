# Add Pokemon Unit

Add a new Pokemon unit to the simulator. The user will provide stats and ability info (usually from the PDF).

## Steps

1. **Add the UnitDefinition to `src/data/units.ts`** using this exact shape:
```typescript
{
  id: 'lowercase_name',         // e.g. 'ribombee'
  name: 'Display Name',
  cost: 1,                       // 1-5
  types: ['jungle'],             // lowercase trait ids from src/data/traits.ts
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

3. **Register the ability handler.** There is no auto-discovery — import the handler at the top of `src/core/systems/ability.ts` and call `registerAbility(YourUnitAbility)` in the trait-grouped block near the bottom of that file. If the unit's `ability.id` has no matching registered handler, `triggerAbility` silently mana-locks and does nothing (fails quietly, not loudly — double check the id string matches exactly).

4. **Sync the unit to its traits.** Having `types: ['jungle']` on the unit alone does **nothing** — `TraitDefinition`s in `src/data/traits.ts` are cosmetic (tooltip text + AI board-power scoring only, never read by combat logic). For each trait on the new unit:
   - Confirm the trait id already has an `applyXxx(state)` function wired into `initTraitEffects()` in `src/core/systems/traitEffects.ts`. If the trait itself is new, use `/add-trait` first to write that function.
   - If that trait function applies its bonus via `addStatusEffect(..., { id: 'some_bonus_id', ... })`, confirm `computeStats()` in `src/core/unitFactory.ts` has a `case 'some_bonus_id':` — a status effect with no matching case is silently inert.
   - New units usually don't require code changes here (they just get picked up by the trait's existing species-count loop), but always verify by reading the relevant `applyXxx` function rather than assuming.

5. **Write a test** in `src/core/abilities/<unitname>.test.ts` verifying the ability fires correctly with a mock CombatState. At minimum test: ability fires at max mana, correct effect is applied, scaling values match tier. See `/add-ability` for the standard test scaffold (`makeUnit`, `createCombatState`, `triggerAbility`/`tickAbilityCast`, and an `advanceLeaps` helper if the ability dashes/leaps).

## Movement (dash / leap / teleport abilities)

Full system: `src/core/systems/movement.ts`. Use this whenever an ability repositions its caster or another unit.

- **`startLeap(unit, dest, state, hasteMagnitude, onLand?, onMidpoint?, visualOnly?)`** — the standard dash/leap primitive. Call from `onCast`, then set `unit.state = 'leaping'` yourself (`startLeap` does not set it). `onLand` fires once on arrival — apply shields/buffs there so they can't be interrupted mid-dash (see Vigoroth-style pattern in `/add-ability`). `onMidpoint` fires once at the temporal midpoint (useful for "fire a bolt from the midpoint of the dash" effects).
- **`teleportUnit(unit, dest, state)`** — instant, no animation. Use for blink effects, not dashes.
- **Hex-occupancy invariant**: for a real leap, the origin hex is freed *immediately* when the leap starts, and the destination hex is claimed *only on arrival* (inside `tickLeapPixel`) — mid-flight the unit owns zero hexes. This is intentional (lets the unit visually dash through others) but means: **any code that force-changes a unit's `state` away from `'moving'`/`'leaping'` — knockback, a stun applied mid-dash, Rayquaza-style drops — must call `cancelInFlightMovement(unit, state)` first**, or hex-occupancy desyncs from `hexPos` and two units can end up sharing a hex. `tickStatusEffects` already does this automatically for stun/knockUp; any *new* forced-repositioning effect you write must do it too.

## Damage & modifiers

Full system: `src/core/systems/damage.ts` (the `applyDamage` pipeline), `src/core/systems/statusEffect.ts` (buffs/debuffs), `src/core/unitFactory.ts` (`computeStats`, where status effects actually become stat changes).

**`DamagePayload` fields** (`damage.ts`): `baseAmount`, `damageType: 'physical'|'magic'|'true'`, `canCrit`, `forceCrit?`, `scalingStat?: 'attack'|'special'`, `scalingRatio?`, `abilityScalingStat?: 'attack'|'special'`, `abilityId?`, `armorPiercePct?`, `spDefPiercePct?`.

Two different, easy-to-confuse scaling conventions — pick one per ability, not both:
- **Additive ratio** — `scalingStat` + `scalingRatio`: `base += statValue * scalingRatio`. Use for "deals X plus Y% of attack" style abilities (e.g. `scalingRatio: 0.5` = +50% of the stat added on top of `baseAmount`).
- **Multiplicative %** — `abilityScalingStat` only: `base = round(base * statValue / 100)`, treating `baseAmount` itself as a percentage where `special: 100`/`attack: 100` is the "no bonus" baseline. Use for "deals X% special/attack as damage" style abilities (most spell-power-scaling casters use this — e.g. a `baseAmount: 60` bolt with `abilityScalingStat: 'special'` on a unit with 150 special deals 90 damage).

`applyDamage` pipeline order: additive scaling → multiplicative ability scaling → `incomingDamageMult` → hardcoded unit/trait special cases → **damage amp** (sums `damage_amp` status-effect magnitudes, `base *= 1 + total`) → **crit** (`forceCrit` or `canCrit && rollCrit`, `base *= critDamage`) → mitigation (armor/spDefense formula, skipped entirely for `true` damage) → shields absorb front-to-back → HP subtracted → omnivamp heal → events/death.

**Any new buff/debuff you introduce must be added to `computeStats()`'s switch in `unitFactory.ts`.** Status effects are applied via `addStatusEffect(unit, { id, sourceUnitId, durationTicks, magnitude?, stackId? })` (`stackId` refreshes an existing effect's duration/magnitude instead of duplicating it — the standard idiom for "recast refreshes the buff"), but they only *do* something if `computeStats()` has a matching `case` for that `id` — otherwise the effect object exists but silently has zero effect on stats. `durationTicks: -1` means permanent until manually removed via `removeStatusEffect`/`removeStatusEffectByStack`.

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
