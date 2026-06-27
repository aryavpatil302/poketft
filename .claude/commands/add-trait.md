# Add Trait

Add a new trait to the simulator. Traits are defined in `src/data/traits.ts` and applied by `src/core/systems/trait.ts` at the start of combat.

## Steps

### 1. Add the TraitDefinition to `src/data/traits.ts`

```typescript
{
  id: 'traitname',          // lowercase, used in unit definitions
  name: 'Display Name',
  thresholds: [
    {
      count: 2,
      description: '(2) Short description of the 2-unit bonus.',
      statBonus: {           // flat stat additions applied to trait units
        // e.g. defense: 10
      },
      teamBonus: {           // applied to ALL allies (not just trait units)
        // e.g. attackSpeed: 0.05
      },
      specialEffect: 'effect_id',  // optional: for effects that can't be expressed as stats
    },
    { count: 4, description: '...', statBonus: {}, teamBonus: {} },
    { count: 6, description: '...', statBonus: {}, teamBonus: {} },
  ],
}
```

### 2. Handle `specialEffect` in `src/core/systems/trait.ts`

If the trait bonus can't be expressed as a flat stat modifier (e.g. Jungle's "15% extra heal/shield power for jungle units"), add a case in `applySpecialTraitEffect()`:

```typescript
case 'jungle_healshield_6': {
  // applied as a status effect that healAmount/shieldAmount calculations read
  for (const unit of traitUnits) {
    addStatusEffect(unit, {
      id: 'jungle_healshield_bonus',
      sourceUnitId: 'trait',
      durationTicks: -1,
      magnitude: 0.25,  // 25% bonus heal/shield power
      stackId: 'jungle_healshield',
    })
  }
  break
}
```

### 3. Verify `computeStats()` reads the new effect

If the trait applies via status effects, make sure `src/core/unitFactory.ts`'s `computeStats()` reads the relevant `statusEffect.id` and adjusts the appropriate computed stat.

### 4. Write a test in `src/core/systems/trait.test.ts`

```typescript
it('Jungle (2) grants 10% heal/shield power to jungle units', () => {
  const t1 = makeUnit('tangela', 'player')
  const t2 = makeUnit('ribombee', 'player')
  const state = makeTestState([t1, t2], [])
  applyTraitBonuses([t1, t2], state)
  // Assert the status effect or stat change was applied
})
```

## Trait reference (from the PDF)

| Trait | Thresholds | Effect |
|-------|-----------|--------|
| Jungle | 2/4/6 | Heal/shield power for team + extra for jungle units |
| Beachy | 2/4/6 | Mana regen + spell buff per cast |
| Volcanic | 3/5/7 | Adaptive force + HP; summon sun at different timings |
| Sky Striker | 2/4/6 | Tailwind attack speed on first cast; execute low-health units |
| Cave Crawler | 3/5 | Earthquake every 5s dealing damage |
| River | 2/3/4 | Aqua Ring buff passes on death |
| Temporal Woods | 2/4/6 | Charm/Heal Block/Confuse on ability damage |
| Ruiner | 3/5/7 | Summon Golet/Golurk/Mega Golurk when team loses 20% HP |
| Ascender | 2/4 | Summon cliffs; adjacent armor/MR; cliff topples on death |
| Froststone | 2/4/6 | Auto marks + true damage; consume on cast for chill |
| Stalwart | - | Gain armor/MR at health breakpoints (once per breakpoint) |
| Promoter | - | Shield + attack speed at combat start for unit + adjacents |
| Bruiser | - | Extra HP for team, more for bruisers |
| Speed Striker | 2/4 | Stack attack speed on auto (duelist-style) |
| Roughneck | 2/3/4 | Raw AD + lifesteal |
| Prodigy | 3/4/5 | Adaptive force that increases on cast (spelleaver-style) |
| Legends | 1/2/3 | Pledge bonus depending on which starter combo + summon Pikachu at 3 |
