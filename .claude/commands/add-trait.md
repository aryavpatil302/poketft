# Add Trait

Add a new trait to the simulator. `src/data/traits.ts` holds the `TraitDefinition`s (display/tooltip text only), and `src/core/systems/traitEffects.ts` holds the actual combat logic, applied once at the start of combat via `initTraitEffects(state)`.

**Important**: `TraitDefinition`'s `statBonus`/`teamBonus`/`specialEffect` fields in `traits.ts` are **never read by combat code** — they exist purely for the trait-bar tooltip UI and the bot AI's board-power scoring (`src/enemy/boardPower.ts`). Writing numbers there does nothing to gameplay. The real thresholds and effects always live in a hand-written function in `traitEffects.ts`, and must be kept in sync with the `traits.ts` description text by hand.

## Steps

### 1. Add the TraitDefinition to `src/data/traits.ts` (UI text only)

```typescript
{
  id: 'traitname',          // lowercase, used in unit definitions' `types` array
  name: 'Display Name',
  thresholds: [
    { count: 2, description: '(2) Short description of the 2-unit bonus.', statBonus: {}, teamBonus: {} },
    { count: 4, description: '...', statBonus: {}, teamBonus: {} },
    { count: 6, description: '...', statBonus: {}, teamBonus: {} },
  ],
}
```
Keep `statBonus`/`teamBonus` empty or purely descriptive — they're not wired to anything. The `description` text is what players actually see, so it must match what you implement in step 2.

### 2. Implement the real effect in `src/core/systems/traitEffects.ts`

Add a new `applyMyTrait(state: CombatState): void` function following the existing per-trait convention (see `applyJungle`, `applyBeachy`, `applyBruiser` for reference), then call it from `initTraitEffects()`:

```typescript
function applyMyTrait(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => !u.isDummy && u.team === team)
    const traitUnits = teamUnits.filter(u => u.types.includes('traitname'))
    // TFT-style counting: unique species, not unit count
    const speciesCount = new Set(traitUnits.map(u => u.definitionId)).size

    if (speciesCount >= 6) { /* apply tier-3 bonus */ }
    else if (speciesCount >= 4) { /* apply tier-2 bonus */ }
    else if (speciesCount >= 2) { /* apply tier-1 bonus */ }
    else continue

    for (const unit of traitUnits) {
      addStatusEffect(unit, {
        id: 'traitname_bonus',       // must have a matching case in computeStats()
        sourceUnitId: 'trait',
        durationTicks: -1,
        magnitude: 0.25,
        stackId: 'traitname_bonus',
      })
    }
  }
}
```

Bonuses that apply to the whole team (not just trait members) iterate `teamUnits` instead of `traitUnits`. Simple flat/permanent bonuses (like Bruiser's HP, Beachy's mana) can mutate `unit.maxHp`/stats directly instead of going through a status effect — check an existing similar trait for which style fits.

### 3. Verify `computeStats()` reads the new effect

If step 2 applies its bonus via `addStatusEffect`, make sure `src/core/unitFactory.ts`'s `computeStats()` has a `case` for the status-effect `id` you used — an effect with no matching case is silently inert (it exists on the unit but changes nothing).

### 4. Write a test in `src/core/systems/traitEffects.test.ts`

```typescript
it('MyTrait (2) grants 25% bonus to trait units', () => {
  const t1 = makeUnit('unit_a', 'player')
  const t2 = makeUnit('unit_b', 'player')
  const state = createCombatState([t1, t2], [])
  initTraitEffects(state)
  // Assert the status effect was applied / stat changed
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
