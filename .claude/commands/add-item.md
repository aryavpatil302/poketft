# Add Item

Add a new equippable item to the simulator.

## Steps

### 1. Add the ItemDefinition to `src/data/items.ts`

```typescript
{
  id: 'item_id',           // lowercase, underscore-separated
  name: 'Item Name',
  description: 'Short description of what it does.',
  statBonus: {             // added directly to unit stats via computeStats()
    attack: 15,
    // hp, startMana, attack, special, defense, spDefense,
    // attackSpeed, critChance, critDamage, range are all valid
  },
  passive: 'passive_id',   // optional — omit if it's a pure stat item
}
```

### 2. If the item has a passive effect, add it to `src/core/systems/item.ts`

```typescript
export const MY_ITEM_PASSIVE: ItemPassiveHandler = {
  itemId: 'item_id',

  // Called on every successful auto-attack hit
  onAutoHit(attacker, target, state) {
    // e.g. apply a burn
    addStatusEffect(target, {
      id: 'burn', sourceUnitId: attacker.id,
      durationTicks: 4 * TICK_RATE, magnitude: 8,
    })
  },

  // Called when the unit takes any damage
  onDamageTaken(unit, damage, source, state) { },

  // Called once per tick (use sparingly)
  onTick(unit, state) { },

  // Called once at combat start
  onCombatStart(unit, state) { },
}
```

Register it in the `ITEM_PASSIVE_REGISTRY` map in `src/core/systems/item.ts`.

### 3. Verify in `computeStats()`

`computeStats()` in `src/core/unitFactory.ts` already sums all `item.statBonus` fields from the unit's equipped items. Passive effects are separate hooks and don't need changes there.

### 4. Update the item equip UI

In `src/ui/itemEquip.ts`, make sure the new item appears in the item pool dropdown/list. Items are rendered from the `ALL_ITEMS` export in `src/data/items.ts`.

### 5. Write a test

```typescript
it('item stat bonus is applied in computeStats', () => {
  const unit = makeUnit('tangela', 'player')
  unit.items = ['item_id']
  computeStats(unit, [], [])
  expect(unit._computedStats!.attack).toBe(unit.attack + 15)
})
```

## Item design guidelines (matching TFT conventions)

- **Stat items**: pure `statBonus`, no passive. E.g. B.F. Sword equivalent = +20 attack.
- **On-hit items**: `onAutoHit` hook. Keep effects simple — a burn, a slow, extra damage.
- **Shred/sunder items**: Apply `armorShred` or `spDefShred` status effect on hit (reduces armor/spDef by flat amount for N seconds).
- **Lifesteal items**: Add `omnivamp` or `physLifesteal` field to the status effect system if not already present; heal attacker for X% of damage dealt.
- **Tank items**: `onDamageTaken` hook for damage reflection (e.g. Bramble Vest), or flat stat bonuses.
- Max 3 items per unit — enforced in `src/ui/itemEquip.ts`.
