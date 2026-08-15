# Composition Reference

Auto-derived from the real unit/trait data in `src/data/units.ts` / `src/data/traits.ts`, and from
the ACTUAL reroll-package logic in `pickRerollTarget` (`src/econ/bots.ts`) — every entry below is a
package shape the bot AI itself can actually discover and commit to, not an invented combination.
Trait breakpoints are hit by DISTINCT SPECIES count, not total copies or star level — a 1★ and a 3★
of the same unit both count as exactly 1 toward the trait.

**A reroll core does not need to reach a trait's breakpoint by itself.** You only need to actively
reroll the carry(ies) you're starring up to 2★/3★ — any OTHER unit that shares the trait can just be
fielded once, at 1★, un-rerolled, purely to fill out the trait.

Three reroll core shapes, matching what the bot AI actually forms: **Solo**, **Same-cost package**
(every unit sharing both the trait and a cost tier — correct shop odds for every member), and
**Mixed-cost package** (every reroll-eligible unit sharing the trait, any cost).

**Role matters, not just cost.** Several cost-4/5 units are TANKS (Fezandipiti, Mamoswine, Quagsire,
Tropius, Wheezing, Latias, Tapu Fini) — they get a tank-appropriate treatment (which carries they
naturally protect), not "co-carry" suggestions, since a tank isn't a build-around-me unit.

This is a reference for what's *mechanically possible*, not a ranked tier list — cross-check against
`src/econ/learnedCompositionAffinities.ts` (via `npm run sim-bots`) for which of these your bots have
actually found to win at a given stage.

---

## Part 1 — Reroll Compositions (cost 1-3 carries)

### Bruiser (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Venusaur (2c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Hisuian Avalugg (3c, tank)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Tropius (4c, tank), Salamence (5c)

**Solo: Venusaur** (contributes 1 toward the trait alone) — support: Jungle
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Venusaur + Salamence (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Venusaur + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Venusaur + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Venusaur + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Palossand** (contributes 1 toward the trait alone) — support: Beachy
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Palossand + Salamence (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Palossand + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Palossand + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Palossand + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Graveler** (contributes 1 toward the trait alone) — support: Volcano
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Graveler + Salamence (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Graveler + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Graveler + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Graveler + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Stonjourner** (contributes 1 toward the trait alone) — support: Ruiner
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Gogoat (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Stonjourner + Salamence (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Stonjourner + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Stonjourner + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Stonjourner + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Gogoat** (contributes 1 toward the trait alone) — support: Ascender
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Gogoat + Salamence (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Gogoat + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Gogoat + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Gogoat + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Hisuian Avalugg** (contributes 1 toward the trait alone) — support: Froststone
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Hisuian Avalugg + Salamence (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Hisuian Avalugg + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Hisuian Avalugg + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Hisuian Avalugg + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Venusaur + Stonjourner + Gogoat** (contributes 3 toward the trait alone) — support: Ascender, Jungle, Ruiner
  - Breakpoint 4: splash any 1 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 3 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Salamence (5c), Hisuian Avalugg (3c, tank)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Venusaur + Stonjourner + Gogoat + Salamence (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Venusaur + Stonjourner + Gogoat + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Venusaur + Stonjourner + Gogoat + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Venusaur + Stonjourner + Gogoat + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (3c): Palossand + Hisuian Avalugg** (contributes 2 toward the trait alone) — support: Beachy, Froststone
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Tropius (4c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Salamence (5c)

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Palossand + Hisuian Avalugg + Salamence (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Palossand + Hisuian Avalugg + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Palossand + Hisuian Avalugg + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Palossand + Hisuian Avalugg + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Venusaur + Palossand + Graveler + Stonjourner + Gogoat + Hisuian Avalugg** (contributes 6 toward the trait alone) — support: Ascender, Beachy, Froststone, Jungle, Ruiner, Volcano
  - Breakpoint 6: reached by the core alone, no splash needed

**Suggested board variations:**

1. **Reinforce Bruiser (strongest splash)**: Venusaur + Palossand + Graveler + Stonjourner + Gogoat + Hisuian Avalugg + Salamence (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Venusaur + Palossand + Graveler + Stonjourner + Gogoat + Hisuian Avalugg + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Venusaur + Palossand + Graveler + Stonjourner + Gogoat + Hisuian Avalugg + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Venusaur + Palossand + Graveler + Stonjourner + Gogoat + Hisuian Avalugg + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Cave Crawler (breakpoints: 3 / 5)

Reroll-eligible carriers (cost ≤3): Gible (2c), Zubat (1c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): none

**Solo: Gible** (contributes 1 toward the trait alone) — support: Promoter, Volcano
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Zubat (1c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Zubat (1c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Gible + Excadrill (3c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Gible + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Gible + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Gible + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Zubat** (contributes 1 toward the trait alone) — support: Spellweaver
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Gible (2c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Gible (2c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Zubat + Excadrill (3c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Zubat + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Zubat + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Zubat + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Druddigon** (contributes 1 toward the trait alone) — support: Roughneck
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Druddigon + Excadrill (3c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Druddigon + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Druddigon + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Druddigon + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Sableye** (contributes 1 toward the trait alone) — support: Keen Eye
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Druddigon (1c), Ferrothorn (2c, tank), Excadrill (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Druddigon (1c), Ferrothorn (2c, tank), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Sableye + Excadrill (3c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Sableye + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Sableye + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Sableye + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Ferrothorn** (contributes 1 toward the trait alone) — support: Substitutor
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Druddigon (1c), Sableye (2c), Excadrill (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Druddigon (1c), Sableye (2c), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Ferrothorn + Excadrill (3c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Ferrothorn + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Ferrothorn + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ferrothorn + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Excadrill** (contributes 1 toward the trait alone) — support: Corkscrew
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Gible (2c), Zubat (1c), Druddigon (1c), Sableye (2c), Ferrothorn (2c, tank)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Excadrill + Ferrothorn (2c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Excadrill + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Excadrill + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Excadrill + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (1c): Zubat + Druddigon** (contributes 2 toward the trait alone) — support: Roughneck, Spellweaver
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Gible (2c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Gible (2c), Sableye (2c), Ferrothorn (2c, tank), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Zubat + Druddigon + Excadrill (3c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Zubat + Druddigon + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Zubat + Druddigon + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Zubat + Druddigon + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Gible + Sableye + Ferrothorn** (contributes 3 toward the trait alone) — support: Keen Eye, Promoter, Substitutor, Volcano
  - Breakpoint 3: reached by the core alone, no splash needed
  - Breakpoint 5: splash any 2 more (un-rerolled, 1★ is enough) from: Zubat (1c), Druddigon (1c), Excadrill (3c)

**Suggested board variations:**

1. **Reinforce Cave Crawler (strongest splash)**: Gible + Sableye + Ferrothorn + Excadrill (3c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Gible + Sableye + Ferrothorn + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Gible + Sableye + Ferrothorn + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Gible + Sableye + Ferrothorn + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Gible + Zubat + Druddigon + Sableye + Ferrothorn + Excadrill** (contributes 6 toward the trait alone) — support: Corkscrew, Keen Eye, Promoter, Roughneck, Spellweaver, Substitutor, Volcano

**Suggested board variations:**

1. **5-cost power splash (independent trait line)**: Gible + Zubat + Druddigon + Sableye + Ferrothorn + Excadrill + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Secondary carry (different trait line)**: Gible + Zubat + Druddigon + Sableye + Ferrothorn + Excadrill + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Alternate secondary carry (different trait line)**: Gible + Zubat + Druddigon + Sableye + Ferrothorn + Excadrill + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Jungle (breakpoints: 3 / 5 / 7)

Reroll-eligible carriers (cost ≤3): Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Solo: Tangela** (contributes 1 toward the trait alone) — support: Stalwart
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Tangela + Tapu Bulu (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Tangela + Tapu Fini (5c, tank) + Latias (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Tangela + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Tangela + Darmanitan (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Ribombee** (contributes 1 toward the trait alone) — support: Promoter
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Ribombee + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Ribombee + Tapu Fini (5c, tank) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Ribombee + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ribombee + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Venusaur** (contributes 1 toward the trait alone) — support: Bruiser
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Venusaur + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Venusaur + Tapu Fini (5c, tank) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Venusaur + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Venusaur + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Vigoroth** (contributes 1 toward the trait alone) — support: Crashout, Quickclaw
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Vigoroth + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Vigoroth + Tapu Fini (5c, tank) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Vigoroth + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Vikavolt** (contributes 1 toward the trait alone) — support: Promoter
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Vikavolt + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Vikavolt + Tapu Fini (5c, tank) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Vikavolt + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vikavolt + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (1c): Tangela + Ribombee** (contributes 2 toward the trait alone) — support: Promoter, Stalwart
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 5 more (un-rerolled, 1★ is enough) from: Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Tangela + Ribombee + Tapu Bulu (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Tangela + Ribombee + Tapu Fini (5c, tank) + Latias (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Tangela + Ribombee + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Tangela + Ribombee + Darmanitan (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (3c): Vigoroth + Vikavolt** (contributes 2 toward the trait alone) — support: Crashout, Promoter, Quickclaw
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)
  - Breakpoint 7: splash any 5 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Vigoroth + Vikavolt + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Vigoroth + Vikavolt + Tapu Fini (5c, tank) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Vigoroth + Vikavolt + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Vikavolt + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Tangela + Ribombee + Venusaur + Vigoroth + Vikavolt** (contributes 5 toward the trait alone) — support: Bruiser, Crashout, Promoter, Quickclaw, Stalwart
  - Breakpoint 5: reached by the core alone, no splash needed
  - Breakpoint 7: splash any 2 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Tropius (4c, tank), Tapu Bulu (5c)

**Suggested board variations:**

1. **Reinforce Jungle (strongest splash)**: Tangela + Ribombee + Venusaur + Vigoroth + Vikavolt + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Tangela + Ribombee + Venusaur + Vigoroth + Vikavolt + Tapu Fini (5c, tank) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Tangela + Ribombee + Venusaur + Vigoroth + Vikavolt + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Tangela + Ribombee + Venusaur + Vigoroth + Vikavolt + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Keen Eye (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Sableye (2c), Celebi (3c), Unown (1c), Claydol (3c), Froslass (2c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Noivern (4c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Solo: Sableye** (contributes 1 toward the trait alone) — support: Cave Crawler
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c), Froslass (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Noivern (4c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c), Froslass (2c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Noivern (4c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c), Froslass (2c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Sableye + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Sableye + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Sableye + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Sableye + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Celebi** (contributes 1 toward the trait alone) — support: Temporal Woods
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c), Froslass (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c), Froslass (2c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c), Froslass (2c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Celebi + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Celebi + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Celebi + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Celebi + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Unown** (contributes 1 toward the trait alone) — support: Ruiner
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Claydol (3c), Froslass (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Claydol (3c), Froslass (2c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Claydol (3c), Froslass (2c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Unown + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Unown + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Unown + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Unown + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Claydol** (contributes 1 toward the trait alone) — support: Ruiner
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Froslass (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Froslass (2c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Froslass (2c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Claydol + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Claydol + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Claydol + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Claydol + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Froslass** (contributes 1 toward the trait alone) — support: Froststone
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Froslass + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Froslass + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Froslass + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Froslass + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Sableye + Froslass** (contributes 2 toward the trait alone) — support: Cave Crawler, Froststone
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Noivern (4c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Noivern (4c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Claydol (3c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Sableye + Froslass + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Sableye + Froslass + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Sableye + Froslass + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Sableye + Froslass + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (3c): Celebi + Claydol** (contributes 2 toward the trait alone) — support: Ruiner, Temporal Woods
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Froslass (2c)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Noivern (4c), Sableye (2c), Fezandipiti (4c, tank), Tapu Lele (5c), Unown (1c), Froslass (2c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Celebi + Claydol + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Celebi + Claydol + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Celebi + Claydol + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Celebi + Claydol + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Sableye + Celebi + Unown + Claydol + Froslass** (contributes 5 toward the trait alone) — support: Cave Crawler, Froststone, Ruiner, Temporal Woods
  - Breakpoint 6: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Keen Eye (strongest splash)**: Sableye + Celebi + Unown + Claydol + Froslass + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Sableye + Celebi + Unown + Claydol + Froslass + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Sableye + Celebi + Unown + Claydol + Froslass + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Sableye + Celebi + Unown + Claydol + Froslass + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Ruiner (breakpoints: 3 / 5 / 7)

Reroll-eligible carriers (cost ≤3): Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Spiritomb (4c), Runerigus (5c)

**Solo: Unown** (contributes 1 toward the trait alone) — support: Keen Eye
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Unown + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Unown + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Unown + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Unown + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Stonjourner** (contributes 1 toward the trait alone) — support: Bruiser
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Unown (1c), Absol (2c), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Unown (1c), Absol (2c), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Unown (1c), Absol (2c), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Stonjourner + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Stonjourner + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Stonjourner + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Stonjourner + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Absol** (contributes 1 toward the trait alone) — support: Roughneck
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Xatu (2c, tank), Claydol (3c), Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Absol + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Absol + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Absol + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Absol + Darmanitan (5c) + Stonjourner (2c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Xatu** (contributes 1 toward the trait alone) — support: Substitutor
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Claydol (3c), Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Xatu + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Xatu + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Xatu + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Xatu + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Claydol** (contributes 1 toward the trait alone) — support: Keen Eye
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Claydol + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Claydol + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Claydol + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Claydol + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Stonjourner + Absol + Xatu** (contributes 3 toward the trait alone) — support: Bruiser, Roughneck, Substitutor
  - Breakpoint 3: reached by the core alone, no splash needed
  - Breakpoint 5: splash any 2 more (un-rerolled, 1★ is enough) from: Unown (1c), Claydol (3c), Spiritomb (4c), Runerigus (5c)
  - Breakpoint 7: splash any 4 more (un-rerolled, 1★ is enough) from: Unown (1c), Claydol (3c), Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Stonjourner + Absol + Xatu + Runerigus (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Stonjourner + Absol + Xatu + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Stonjourner + Absol + Xatu + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Stonjourner + Absol + Xatu + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Unown + Stonjourner + Absol + Xatu + Claydol** (contributes 5 toward the trait alone) — support: Bruiser, Keen Eye, Roughneck, Substitutor
  - Breakpoint 5: reached by the core alone, no splash needed
  - Breakpoint 7: splash any 2 more (un-rerolled, 1★ is enough) from: Spiritomb (4c), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Ruiner (strongest splash)**: Unown + Stonjourner + Absol + Xatu + Claydol + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Unown + Stonjourner + Absol + Xatu + Claydol + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Unown + Stonjourner + Absol + Xatu + Claydol + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Unown + Stonjourner + Absol + Xatu + Claydol + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Volcano (breakpoints: 3 / 5 / 7)

Reroll-eligible carriers (cost ≤3): Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Armarouge (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Solo: Graveler** (contributes 1 toward the trait alone) — support: Bruiser
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Graveler + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Graveler + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Graveler + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Graveler + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Solo: Typhlosion** (contributes 1 toward the trait alone) — support: Spellweaver
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Typhlosion + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Typhlosion + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Typhlosion + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Typhlosion + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Solo: Torkoal** (contributes 1 toward the trait alone) — support: Stalwart
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Torkoal + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Torkoal + Tapu Bulu (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Torkoal + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Torkoal + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Solo: Gible** (contributes 1 toward the trait alone) — support: Cave Crawler, Promoter
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Gible + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Gible + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Gible + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Gible + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Solo: Armarouge** (contributes 1 toward the trait alone) — support: Quickclaw
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 6 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Armarouge + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Armarouge + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Armarouge + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Armarouge + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Same-cost package (1c): Graveler + Typhlosion** (contributes 2 toward the trait alone) — support: Bruiser, Spellweaver
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 5 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Gible (2c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Graveler + Typhlosion + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Graveler + Typhlosion + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Graveler + Typhlosion + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Graveler + Typhlosion + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Same-cost package (2c): Torkoal + Gible** (contributes 2 toward the trait alone) — support: Cave Crawler, Promoter, Stalwart
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)
  - Breakpoint 7: splash any 5 more (un-rerolled, 1★ is enough) from: Graveler (1c, tank), Typhlosion (1c), Armarouge (3c), Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Torkoal + Gible + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Torkoal + Gible + Tapu Bulu (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Torkoal + Gible + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Torkoal + Gible + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Mixed-cost package: Graveler + Typhlosion + Torkoal + Gible + Armarouge** (contributes 5 toward the trait alone) — support: Bruiser, Cave Crawler, Promoter, Quickclaw, Spellweaver, Stalwart
  - Breakpoint 5: reached by the core alone, no splash needed
  - Breakpoint 7: splash any 2 more (un-rerolled, 1★ is enough) from: Alolan Marowak (4c), Wheezing (4c, tank), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Volcano (strongest splash)**: Graveler + Typhlosion + Torkoal + Gible + Armarouge + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Graveler + Typhlosion + Torkoal + Gible + Armarouge + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Graveler + Typhlosion + Torkoal + Gible + Armarouge + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Graveler + Typhlosion + Torkoal + Gible + Armarouge + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)

### Beachy (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Kingler (1c), Alolan Raichu (2c), Palossand (3c, tank), Alolan Exeggutor (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Blastoise (4c), Tapu Fini (5c, tank)

**Solo: Kingler** (contributes 1 toward the trait alone) — support: Corkscrew
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Alolan Raichu (2c), Palossand (3c, tank), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Alolan Raichu (2c), Palossand (3c, tank), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Alolan Raichu (2c), Palossand (3c, tank), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)

**Suggested board variations:**

1. **Reinforce Beachy (strongest splash)**: Kingler + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Kingler + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Kingler + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Kingler + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Alolan Raichu** (contributes 1 toward the trait alone) — support: Spellweaver
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Kingler (1c), Palossand (3c, tank), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Kingler (1c), Palossand (3c, tank), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Kingler (1c), Palossand (3c, tank), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)

**Suggested board variations:**

1. **Reinforce Beachy (strongest splash)**: Alolan Raichu + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Alolan Raichu + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Alolan Raichu + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Alolan Raichu + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Palossand** (contributes 1 toward the trait alone) — support: Bruiser
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Alolan Exeggutor (3c), Blastoise (4c), Tapu Fini (5c, tank)

**Suggested board variations:**

1. **Reinforce Beachy (strongest splash)**: Palossand + Tapu Fini (5c, tank) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Palossand + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Palossand + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Palossand + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Alolan Exeggutor** (contributes 1 toward the trait alone) — support: Spellweaver
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Palossand (3c, tank), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Palossand (3c, tank), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Palossand (3c, tank), Blastoise (4c), Tapu Fini (5c, tank)

**Suggested board variations:**

1. **Reinforce Beachy (strongest splash)**: Alolan Exeggutor + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Alolan Exeggutor + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Alolan Exeggutor + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Alolan Exeggutor + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (3c): Palossand + Alolan Exeggutor** (contributes 2 toward the trait alone) — support: Bruiser, Spellweaver
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Blastoise (4c), Tapu Fini (5c, tank)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Kingler (1c), Alolan Raichu (2c), Blastoise (4c), Tapu Fini (5c, tank)

**Suggested board variations:**

1. **Reinforce Beachy (strongest splash)**: Palossand + Alolan Exeggutor + Tapu Fini (5c, tank) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Palossand + Alolan Exeggutor + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Palossand + Alolan Exeggutor + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Palossand + Alolan Exeggutor + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Kingler + Alolan Raichu + Palossand + Alolan Exeggutor** (contributes 4 toward the trait alone) — support: Bruiser, Corkscrew, Spellweaver
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 6: splash any 2 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Tapu Fini (5c, tank)

**Suggested board variations:**

1. **Reinforce Beachy (strongest splash)**: Kingler + Alolan Raichu + Palossand + Alolan Exeggutor + Tapu Fini (5c, tank) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Kingler + Alolan Raichu + Palossand + Alolan Exeggutor + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Kingler + Alolan Raichu + Palossand + Alolan Exeggutor + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Kingler + Alolan Raichu + Palossand + Alolan Exeggutor + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Froststone (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Snorunt (1c, tank), Froslass (2c), Weavile (2c), Hisuian Avalugg (3c, tank)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Abomasnow (4c), Mamoswine (4c, tank)

**Solo: Snorunt** (contributes 1 toward the trait alone) — support: Stalwart
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Froslass (2c), Weavile (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Froslass (2c), Weavile (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Froslass (2c), Weavile (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Froststone (strongest splash)**: Snorunt + Abomasnow (4c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Snorunt + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Snorunt + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Snorunt + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Froslass** (contributes 1 toward the trait alone) — support: Keen Eye
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Weavile (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Weavile (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Weavile (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Froststone (strongest splash)**: Froslass + Abomasnow (4c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Froslass + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Froslass + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Froslass + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Weavile** (contributes 1 toward the trait alone) — support: Corkscrew
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Froslass (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Froslass (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Froslass (2c), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Froststone (strongest splash)**: Weavile + Abomasnow (4c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Weavile + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Weavile + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Weavile + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Hisuian Avalugg** (contributes 1 toward the trait alone) — support: Bruiser
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Froslass (2c), Weavile (2c), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Froslass (2c), Weavile (2c), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Froslass (2c), Weavile (2c), Abomasnow (4c), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Froststone (strongest splash)**: Hisuian Avalugg + Abomasnow (4c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Hisuian Avalugg + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Hisuian Avalugg + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Hisuian Avalugg + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Froslass + Weavile** (contributes 2 toward the trait alone) — support: Corkscrew, Keen Eye
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Snorunt (1c, tank), Hisuian Avalugg (3c, tank), Abomasnow (4c), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Froststone (strongest splash)**: Froslass + Weavile + Abomasnow (4c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Froslass + Weavile + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Froslass + Weavile + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Froslass + Weavile + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Snorunt + Froslass + Weavile + Hisuian Avalugg** (contributes 4 toward the trait alone) — support: Bruiser, Corkscrew, Keen Eye, Stalwart
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 6: splash any 2 more (un-rerolled, 1★ is enough) from: Abomasnow (4c), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Froststone (strongest splash)**: Snorunt + Froslass + Weavile + Hisuian Avalugg + Abomasnow (4c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Snorunt + Froslass + Weavile + Hisuian Avalugg + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Snorunt + Froslass + Weavile + Hisuian Avalugg + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Snorunt + Froslass + Weavile + Hisuian Avalugg + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Promoter (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Ribombee (1c), Vikavolt (3c), Gible (2c), Wailord (2c, tank)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Solo: Ribombee** (contributes 1 toward the trait alone) — support: Jungle
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Vikavolt (3c), Gible (2c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Vikavolt (3c), Gible (2c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Vikavolt (3c), Gible (2c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Promoter (strongest splash)**: Ribombee + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Ribombee + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Ribombee + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ribombee + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Vikavolt** (contributes 1 toward the trait alone) — support: Jungle
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Gible (2c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Gible (2c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Gible (2c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Promoter (strongest splash)**: Vikavolt + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Vikavolt + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Vikavolt + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vikavolt + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Gible** (contributes 1 toward the trait alone) — support: Cave Crawler, Volcano
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Promoter (strongest splash)**: Gible + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Gible + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Gible + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Gible + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Wailord** (contributes 1 toward the trait alone) — support: Sky Striker
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Gible (2c), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Gible (2c), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Gible (2c), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Promoter (strongest splash)**: Wailord + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Wailord + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Wailord + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Wailord + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Gible + Wailord** (contributes 2 toward the trait alone) — support: Cave Crawler, Sky Striker, Volcano
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Ribombee (1c), Vikavolt (3c), Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Promoter (strongest splash)**: Gible + Wailord + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Gible + Wailord + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Gible + Wailord + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Gible + Wailord + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Ribombee + Vikavolt + Gible + Wailord** (contributes 4 toward the trait alone) — support: Cave Crawler, Jungle, Sky Striker, Volcano
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 6: splash any 2 more (un-rerolled, 1★ is enough) from: Quagsire (4c, tank), Fezandipiti (4c, tank), Runerigus (5c)

**Suggested board variations:**

1. **Reinforce Promoter (strongest splash)**: Ribombee + Vikavolt + Gible + Wailord + Runerigus (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Ribombee + Vikavolt + Gible + Wailord + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Ribombee + Vikavolt + Gible + Wailord + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ribombee + Vikavolt + Gible + Wailord + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Quickclaw (breakpoints: 2 / 3 / 4 / 5)

Reroll-eligible carriers (cost ≤3): Vigoroth (3c), Armarouge (3c), Pidgeotto (1c), Klawf (1c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Blastoise (4c), Tapu Koko (5c)

**Solo: Vigoroth** (contributes 1 toward the trait alone) — support: Crashout, Jungle
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Vigoroth + Tapu Koko (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Vigoroth + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Vigoroth + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Armarouge** (contributes 1 toward the trait alone) — support: Volcano
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Armarouge + Tapu Koko (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Armarouge + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Armarouge + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Armarouge + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Pidgeotto** (contributes 1 toward the trait alone) — support: Sky Striker
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Klawf (1c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Pidgeotto + Tapu Koko (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
2. **5-cost power splash (independent trait line)**: Pidgeotto + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Pidgeotto + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Pidgeotto + Darmanitan (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Klawf** (contributes 1 toward the trait alone) — support: Ascender
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Tapu Koko (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Tapu Koko (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Tapu Koko (5c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Pidgeotto (1c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Klawf + Tapu Koko (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Klawf + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Klawf + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Klawf + Darmanitan (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (1c): Pidgeotto + Klawf** (contributes 2 toward the trait alone) — support: Ascender, Sky Striker
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Tapu Koko (5c)
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Tapu Koko (5c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Blastoise (4c), Armarouge (3c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Pidgeotto + Klawf + Tapu Koko (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
2. **5-cost power splash (independent trait line)**: Pidgeotto + Klawf + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Pidgeotto + Klawf + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Pidgeotto + Klawf + Darmanitan (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (3c): Vigoroth + Armarouge** (contributes 2 toward the trait alone) — support: Crashout, Jungle, Volcano
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Pidgeotto (1c), Klawf (1c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Vigoroth + Armarouge + Tapu Koko (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Vigoroth + Armarouge + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Vigoroth + Armarouge + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Armarouge + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Vigoroth + Armarouge + Pidgeotto + Klawf** (contributes 4 toward the trait alone) — support: Ascender, Crashout, Jungle, Sky Striker, Volcano
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 5: splash any 1 more (un-rerolled, 1★ is enough) from: Blastoise (4c), Tapu Koko (5c)

**Suggested board variations:**

1. **Reinforce Quickclaw (strongest splash)**: Vigoroth + Armarouge + Pidgeotto + Klawf + Tapu Koko (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Vigoroth + Armarouge + Pidgeotto + Klawf + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Vigoroth + Armarouge + Pidgeotto + Klawf + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Armarouge + Pidgeotto + Klawf + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Spellweaver (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Zubat (1c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Toucannon (4c), Charizard (5c)

**Solo: Alolan Raichu** (contributes 1 toward the trait alone) — support: Beachy
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Exeggutor (3c), Typhlosion (1c), Charizard (5c), Zubat (1c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Exeggutor (3c), Typhlosion (1c), Charizard (5c), Zubat (1c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Exeggutor (3c), Typhlosion (1c), Charizard (5c), Zubat (1c)

**Suggested board variations:**

1. **Reinforce Spellweaver (strongest splash)**: Alolan Raichu + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Alolan Raichu + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Alolan Raichu + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Alolan Raichu + Latias (5c, tank) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Alolan Exeggutor** (contributes 1 toward the trait alone) — support: Beachy
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Typhlosion (1c), Charizard (5c), Zubat (1c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Typhlosion (1c), Charizard (5c), Zubat (1c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Typhlosion (1c), Charizard (5c), Zubat (1c)

**Suggested board variations:**

1. **Reinforce Spellweaver (strongest splash)**: Alolan Exeggutor + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Alolan Exeggutor + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Alolan Exeggutor + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Alolan Exeggutor + Latias (5c, tank) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Typhlosion** (contributes 1 toward the trait alone) — support: Volcano
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Charizard (5c), Zubat (1c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Charizard (5c), Zubat (1c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Charizard (5c), Zubat (1c)

**Suggested board variations:**

1. **Reinforce Spellweaver (strongest splash)**: Typhlosion + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Typhlosion + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Typhlosion + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Typhlosion + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Solo: Zubat** (contributes 1 toward the trait alone) — support: Cave Crawler
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Charizard (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Charizard (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Spellweaver (strongest splash)**: Zubat + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Zubat + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Zubat + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Zubat + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
**Same-cost package (1c): Typhlosion + Zubat** (contributes 2 toward the trait alone) — support: Cave Crawler, Volcano
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Charizard (5c)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Alolan Raichu (2c), Alolan Exeggutor (3c), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Spellweaver (strongest splash)**: Typhlosion + Zubat + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Typhlosion + Zubat + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Typhlosion + Zubat + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Typhlosion + Zubat + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
**Mixed-cost package: Alolan Raichu + Alolan Exeggutor + Typhlosion + Zubat** (contributes 4 toward the trait alone) — support: Beachy, Cave Crawler, Volcano
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 6: splash any 2 more (un-rerolled, 1★ is enough) from: Toucannon (4c), Charizard (5c)

**Suggested board variations:**

1. **Reinforce Spellweaver (strongest splash)**: Alolan Raichu + Alolan Exeggutor + Typhlosion + Zubat + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Alolan Raichu + Alolan Exeggutor + Typhlosion + Zubat + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Alolan Raichu + Alolan Exeggutor + Typhlosion + Zubat + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Alolan Raichu + Alolan Exeggutor + Typhlosion + Zubat + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)

### Stalwart (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Tangela (1c, tank), Torkoal (2c, tank), Bellibolt (3c, tank), Snorunt (1c, tank)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Wheezing (4c, tank), Latias (5c, tank), Mamoswine (4c, tank)

**Solo: Tangela** (contributes 1 toward the trait alone) — support: Jungle
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Stalwart (strongest splash)**: Tangela + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Tangela + Tapu Bulu (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Tangela + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Tangela + Darmanitan (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Torkoal** (contributes 1 toward the trait alone) — support: Volcano
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Stalwart (strongest splash)**: Torkoal + Latias (5c, tank) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Torkoal + Tapu Bulu (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Torkoal + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Torkoal + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Bellibolt** (contributes 1 toward the trait alone) — support: River
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Stalwart (strongest splash)**: Bellibolt + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Bellibolt + Tapu Bulu (5c) + Tangela (1c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Bellibolt + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Bellibolt + Darmanitan (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Snorunt** (contributes 1 toward the trait alone) — support: Froststone
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Mamoswine (4c, tank)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Stalwart (strongest splash)**: Snorunt + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Snorunt + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Snorunt + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Snorunt + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (1c): Tangela + Snorunt** (contributes 2 toward the trait alone) — support: Froststone, Jungle
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Mamoswine (4c, tank)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Stalwart (strongest splash)**: Tangela + Snorunt + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Tangela + Snorunt + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Tangela + Snorunt + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Tangela + Snorunt + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Tangela + Torkoal + Bellibolt + Snorunt** (contributes 4 toward the trait alone) — support: Froststone, Jungle, River, Volcano
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 6: splash any 2 more (un-rerolled, 1★ is enough) from: Wheezing (4c, tank), Latias (5c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Stalwart (strongest splash)**: Tangela + Torkoal + Bellibolt + Snorunt + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **5-cost power splash (independent trait line)**: Tangela + Torkoal + Bellibolt + Snorunt + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (different trait line)**: Tangela + Torkoal + Bellibolt + Snorunt + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Tangela + Torkoal + Bellibolt + Snorunt + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Temporal Woods (breakpoints: 2 / 4 / 6)

Reroll-eligible carriers (cost ≤3): Morgrem (1c, tank), Morelull (1c), Oranguru (2c), Celebi (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Fezandipiti (4c, tank), Tapu Lele (5c)

**Solo: Morgrem** (contributes 1 toward the trait alone) — support: Substitutor
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Morelull (1c), Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Morelull (1c), Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Morelull (1c), Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Temporal Woods (strongest splash)**: Morgrem + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morgrem + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Morgrem + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Morgrem + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Morelull** (contributes 1 toward the trait alone) — support: Mystic
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Temporal Woods (strongest splash)**: Morelull + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morelull + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Morelull + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Morelull + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Oranguru** (contributes 1 toward the trait alone) — support: Mystic
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Morelull (1c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Morelull (1c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Morelull (1c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Temporal Woods (strongest splash)**: Oranguru + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Oranguru + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Oranguru + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Oranguru + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Celebi** (contributes 1 toward the trait alone) — support: Keen Eye
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Morelull (1c), Oranguru (2c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Morelull (1c), Oranguru (2c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 6: splash any 5 more (un-rerolled, 1★ is enough) from: Morgrem (1c, tank), Morelull (1c), Oranguru (2c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Temporal Woods (strongest splash)**: Celebi + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Celebi + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Celebi + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Celebi + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (1c): Morgrem + Morelull** (contributes 2 toward the trait alone) — support: Mystic, Substitutor
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)
  - Breakpoint 6: splash any 4 more (un-rerolled, 1★ is enough) from: Oranguru (2c), Celebi (3c), Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Temporal Woods (strongest splash)**: Morgrem + Morelull + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morgrem + Morelull + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Morgrem + Morelull + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Morgrem + Morelull + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Morgrem + Morelull + Oranguru + Celebi** (contributes 4 toward the trait alone) — support: Keen Eye, Mystic, Substitutor
  - Breakpoint 4: reached by the core alone, no splash needed
  - Breakpoint 6: splash any 2 more (un-rerolled, 1★ is enough) from: Fezandipiti (4c, tank), Tapu Lele (5c)

**Suggested board variations:**

1. **Reinforce Temporal Woods (strongest splash)**: Morgrem + Morelull + Oranguru + Celebi + Tapu Lele (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morgrem + Morelull + Oranguru + Celebi + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Morgrem + Morelull + Oranguru + Celebi + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Morgrem + Morelull + Oranguru + Celebi + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Ascender (breakpoints: 2 / 4)

Reroll-eligible carriers (cost ≤3): Klawf (1c), Gogoat (2c, tank), Sneasler (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Aerodactyl (4c)

**Solo: Klawf** (contributes 1 toward the trait alone) — support: Quickclaw
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Gogoat (2c, tank), Sneasler (3c), Aerodactyl (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Gogoat (2c, tank), Sneasler (3c), Aerodactyl (4c)

**Suggested board variations:**

1. **Reinforce Ascender (strongest splash)**: Klawf + Aerodactyl (4c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5)
2. **5-cost power splash (independent trait line)**: Klawf + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Klawf + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Klawf + Darmanitan (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Gogoat** (contributes 1 toward the trait alone) — support: Bruiser
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Klawf (1c), Sneasler (3c), Aerodactyl (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Klawf (1c), Sneasler (3c), Aerodactyl (4c)

**Suggested board variations:**

1. **Reinforce Ascender (strongest splash)**: Gogoat + Aerodactyl (4c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Gogoat + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Gogoat + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Gogoat + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Sneasler** (contributes 1 toward the trait alone) — support: Roughneck
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Klawf (1c), Gogoat (2c, tank), Aerodactyl (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Klawf (1c), Gogoat (2c, tank), Aerodactyl (4c)

**Suggested board variations:**

1. **Reinforce Ascender (strongest splash)**: Sneasler + Aerodactyl (4c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5)
2. **5-cost power splash (independent trait line)**: Sneasler + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Sneasler + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Sneasler + Darmanitan (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Klawf + Gogoat + Sneasler** (contributes 3 toward the trait alone) — support: Bruiser, Quickclaw, Roughneck
  - Breakpoint 4: splash any 1 more (un-rerolled, 1★ is enough) from: Aerodactyl (4c)

**Suggested board variations:**

1. **Reinforce Ascender (strongest splash)**: Klawf + Gogoat + Sneasler + Aerodactyl (4c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Klawf + Gogoat + Sneasler + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Klawf + Gogoat + Sneasler + Charizard (5c) + Graveler (1c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Klawf + Gogoat + Sneasler + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Corkscrew (breakpoints: 2 / 3 / 4 / 5)

Reroll-eligible carriers (cost ≤3): Kingler (1c), Excadrill (3c), Weavile (2c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Rayquaza (5c), Barraskewda (4c)

**Solo: Kingler** (contributes 1 toward the trait alone) — support: Beachy
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Rayquaza (5c), Excadrill (3c), Barraskewda (4c), Weavile (2c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Rayquaza (5c), Excadrill (3c), Barraskewda (4c), Weavile (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Rayquaza (5c), Excadrill (3c), Barraskewda (4c), Weavile (2c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Rayquaza (5c), Excadrill (3c), Barraskewda (4c), Weavile (2c)

**Suggested board variations:**

1. **Reinforce Corkscrew (strongest splash)**: Kingler + Rayquaza (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Kingler + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Kingler + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Kingler + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Excadrill** (contributes 1 toward the trait alone) — support: Cave Crawler
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Barraskewda (4c), Weavile (2c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Barraskewda (4c), Weavile (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Barraskewda (4c), Weavile (2c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Barraskewda (4c), Weavile (2c)

**Suggested board variations:**

1. **Reinforce Corkscrew (strongest splash)**: Excadrill + Rayquaza (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Excadrill + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Excadrill + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Excadrill + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Weavile** (contributes 1 toward the trait alone) — support: Froststone
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Excadrill (3c), Barraskewda (4c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Excadrill (3c), Barraskewda (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Excadrill (3c), Barraskewda (4c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Kingler (1c), Rayquaza (5c), Excadrill (3c), Barraskewda (4c)

**Suggested board variations:**

1. **Reinforce Corkscrew (strongest splash)**: Weavile + Rayquaza (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Weavile + Tapu Bulu (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Weavile + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Weavile + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Kingler + Excadrill + Weavile** (contributes 3 toward the trait alone) — support: Beachy, Cave Crawler, Froststone
  - Breakpoint 3: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 1 more (un-rerolled, 1★ is enough) from: Rayquaza (5c), Barraskewda (4c)
  - Breakpoint 5: splash any 2 more (un-rerolled, 1★ is enough) from: Rayquaza (5c), Barraskewda (4c)

**Suggested board variations:**

1. **Reinforce Corkscrew (strongest splash)**: Kingler + Excadrill + Weavile + Rayquaza (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Kingler + Excadrill + Weavile + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Kingler + Excadrill + Weavile + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Kingler + Excadrill + Weavile + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Crashout (breakpoints: 2 / 3 / 4)

Reroll-eligible carriers (cost ≤3): Vigoroth (3c), Talonflame (3c), Drednaw (2c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Aerodactyl (4c), Darmanitan (5c)

**Solo: Vigoroth** (contributes 1 toward the trait alone) — support: Jungle, Quickclaw
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Talonflame (3c), Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Talonflame (3c), Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Talonflame (3c), Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)

**Suggested board variations:**

1. **Reinforce Crashout (strongest splash)**: Vigoroth + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Vigoroth + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Vigoroth + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Latias (5c, tank) + Tangela (1c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
**Solo: Talonflame** (contributes 1 toward the trait alone) — support: Sky Striker
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)

**Suggested board variations:**

1. **Reinforce Crashout (strongest splash)**: Talonflame + Darmanitan (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Talonflame + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Talonflame + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Talonflame + Latias (5c, tank) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
**Solo: Drednaw** (contributes 1 toward the trait alone) — support: River
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Talonflame (3c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Talonflame (3c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Vigoroth (3c), Talonflame (3c), Aerodactyl (4c), Darmanitan (5c)

**Suggested board variations:**

1. **Reinforce Crashout (strongest splash)**: Drednaw + Darmanitan (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Drednaw + Tapu Bulu (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5)
3. **Secondary carry (different trait line)**: Drednaw + Charizard (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Drednaw + Latias (5c, tank) + Bellibolt (3c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
**Same-cost package (3c): Vigoroth + Talonflame** (contributes 2 toward the trait alone) — support: Jungle, Quickclaw, Sky Striker
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Drednaw (2c), Aerodactyl (4c), Darmanitan (5c)

**Suggested board variations:**

1. **Reinforce Crashout (strongest splash)**: Vigoroth + Talonflame + Darmanitan (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Vigoroth + Talonflame + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Vigoroth + Talonflame + Charizard (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Talonflame + Latias (5c, tank) + Tangela (1c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
**Mixed-cost package: Vigoroth + Talonflame + Drednaw** (contributes 3 toward the trait alone) — support: Jungle, Quickclaw, River, Sky Striker
  - Breakpoint 3: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 1 more (un-rerolled, 1★ is enough) from: Aerodactyl (4c), Darmanitan (5c)

**Suggested board variations:**

1. **Reinforce Crashout (strongest splash)**: Vigoroth + Talonflame + Drednaw + Darmanitan (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **5-cost power splash (independent trait line)**: Vigoroth + Talonflame + Drednaw + Tapu Bulu (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
3. **Secondary carry (different trait line)**: Vigoroth + Talonflame + Drednaw + Charizard (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Vigoroth + Talonflame + Drednaw + Latias (5c, tank) + Bellibolt (3c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)

### Roughneck (breakpoints: 2 / 3 / 4 / 5)

Reroll-eligible carriers (cost ≤3): Druddigon (1c), Absol (2c), Sneasler (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Tapu Bulu (5c), Alolan Marowak (4c)

**Solo: Druddigon** (contributes 1 toward the trait alone) — support: Cave Crawler
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Absol (2c), Sneasler (3c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Absol (2c), Sneasler (3c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Absol (2c), Sneasler (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Absol (2c), Sneasler (3c)

**Suggested board variations:**

1. **Reinforce Roughneck (strongest splash)**: Druddigon + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Druddigon + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Druddigon + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Druddigon + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Absol** (contributes 1 toward the trait alone) — support: Ruiner
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Sneasler (3c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Sneasler (3c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Sneasler (3c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Sneasler (3c)

**Suggested board variations:**

1. **Reinforce Roughneck (strongest splash)**: Absol + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Absol + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Absol + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Absol + Darmanitan (5c) + Stonjourner (2c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Sneasler** (contributes 1 toward the trait alone) — support: Ascender
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Absol (2c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Absol (2c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Absol (2c)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c), Druddigon (1c), Absol (2c)

**Suggested board variations:**

1. **Reinforce Roughneck (strongest splash)**: Sneasler + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Sneasler + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Sneasler + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Sneasler + Darmanitan (5c) + Gogoat (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Druddigon + Absol + Sneasler** (contributes 3 toward the trait alone) — support: Ascender, Cave Crawler, Ruiner
  - Breakpoint 3: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 1 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c)
  - Breakpoint 5: splash any 2 more (un-rerolled, 1★ is enough) from: Tapu Bulu (5c), Alolan Marowak (4c)

**Suggested board variations:**

1. **Reinforce Roughneck (strongest splash)**: Druddigon + Absol + Sneasler + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Druddigon + Absol + Sneasler + Tapu Fini (5c, tank) + Palossand (3c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Druddigon + Absol + Sneasler + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Druddigon + Absol + Sneasler + Darmanitan (5c) + Ferrothorn (2c, tank)
   Traits this combo activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Sky Striker (breakpoints: 2 / 4)

Reroll-eligible carriers (cost ≤3): Pidgeotto (1c), Wailord (2c, tank), Talonflame (3c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Noivern (4c), Rayquaza (5c)

**Solo: Pidgeotto** (contributes 1 toward the trait alone) — support: Quickclaw
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Wailord (2c, tank), Talonflame (3c), Noivern (4c), Rayquaza (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Wailord (2c, tank), Talonflame (3c), Noivern (4c), Rayquaza (5c)

**Suggested board variations:**

1. **Reinforce Sky Striker (strongest splash)**: Pidgeotto + Rayquaza (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
2. **5-cost power splash (independent trait line)**: Pidgeotto + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Pidgeotto + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Pidgeotto + Darmanitan (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Wailord** (contributes 1 toward the trait alone) — support: Promoter
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Pidgeotto (1c), Talonflame (3c), Noivern (4c), Rayquaza (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Pidgeotto (1c), Talonflame (3c), Noivern (4c), Rayquaza (5c)

**Suggested board variations:**

1. **Reinforce Sky Striker (strongest splash)**: Wailord + Rayquaza (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Wailord + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Wailord + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Wailord + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Talonflame** (contributes 1 toward the trait alone) — support: Crashout
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Pidgeotto (1c), Wailord (2c, tank), Noivern (4c), Rayquaza (5c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Pidgeotto (1c), Wailord (2c, tank), Noivern (4c), Rayquaza (5c)

**Suggested board variations:**

1. **Reinforce Sky Striker (strongest splash)**: Talonflame + Rayquaza (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
2. **5-cost power splash (independent trait line)**: Talonflame + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Talonflame + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Talonflame + Darmanitan (5c) + Wailord (2c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Pidgeotto + Wailord + Talonflame** (contributes 3 toward the trait alone) — support: Crashout, Promoter, Quickclaw
  - Breakpoint 4: splash any 1 more (un-rerolled, 1★ is enough) from: Noivern (4c), Rayquaza (5c)

**Suggested board variations:**

1. **Reinforce Sky Striker (strongest splash)**: Pidgeotto + Wailord + Talonflame + Rayquaza (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Pidgeotto + Wailord + Talonflame + Tapu Bulu (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Pidgeotto + Wailord + Talonflame + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Pidgeotto + Wailord + Talonflame + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Substitutor (breakpoints: 1 / 3 / 5)

Reroll-eligible carriers (cost ≤3): Ferrothorn (2c, tank), Morgrem (1c, tank), Xatu (2c, tank)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Tropius (4c, tank), Mamoswine (4c, tank)

**Solo: Ferrothorn** (contributes 1 toward the trait alone) — support: Cave Crawler
  - Breakpoint 1: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Morgrem (1c, tank), Xatu (2c, tank), Mamoswine (4c, tank)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Morgrem (1c, tank), Xatu (2c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Substitutor (strongest splash)**: Ferrothorn + Mamoswine (4c, tank) + Snorunt (1c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Ferrothorn + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Ferrothorn + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ferrothorn + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Morgrem** (contributes 1 toward the trait alone) — support: Temporal Woods
  - Breakpoint 1: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Ferrothorn (2c, tank), Xatu (2c, tank), Mamoswine (4c, tank)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Ferrothorn (2c, tank), Xatu (2c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Substitutor (strongest splash)**: Morgrem + Mamoswine (4c, tank) + Snorunt (1c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morgrem + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Morgrem + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Morgrem + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Xatu** (contributes 1 toward the trait alone) — support: Ruiner
  - Breakpoint 1: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Ferrothorn (2c, tank), Morgrem (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 5: splash any 4 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Ferrothorn (2c, tank), Morgrem (1c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Substitutor (strongest splash)**: Xatu + Mamoswine (4c, tank) + Snorunt (1c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Xatu + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Xatu + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Xatu + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Same-cost package (2c): Ferrothorn + Xatu** (contributes 2 toward the trait alone) — support: Cave Crawler, Ruiner
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Morgrem (1c, tank), Mamoswine (4c, tank)
  - Breakpoint 5: splash any 3 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Morgrem (1c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Substitutor (strongest splash)**: Ferrothorn + Xatu + Mamoswine (4c, tank) + Snorunt (1c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **5-cost power splash (independent trait line)**: Ferrothorn + Xatu + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (different trait line)**: Ferrothorn + Xatu + Charizard (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ferrothorn + Xatu + Darmanitan (5c) + Mamoswine (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Ferrothorn + Morgrem + Xatu** (contributes 3 toward the trait alone) — support: Cave Crawler, Ruiner, Temporal Woods
  - Breakpoint 3: reached by the core alone, no splash needed
  - Breakpoint 5: splash any 2 more (un-rerolled, 1★ is enough) from: Tropius (4c, tank), Mamoswine (4c, tank)

**Suggested board variations:**

1. **Reinforce Substitutor (strongest splash)**: Ferrothorn + Morgrem + Xatu + Mamoswine (4c, tank) + Snorunt (1c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Ferrothorn + Morgrem + Xatu + Tapu Bulu (5c) + Tropius (4c, tank)
   Traits this combo activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Ferrothorn + Morgrem + Xatu + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Ferrothorn + Morgrem + Xatu + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this combo activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Mystic (breakpoints: 2 / 4)

Reroll-eligible carriers (cost ≤3): Morelull (1c), Oranguru (2c)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Tapu Fini (5c, tank), Spiritomb (4c), Latios (5c), Abomasnow (4c)

**Solo: Morelull** (contributes 1 toward the trait alone) — support: Temporal Woods
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tapu Fini (5c, tank), Oranguru (2c), Spiritomb (4c), Latios (5c), Abomasnow (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tapu Fini (5c, tank), Oranguru (2c), Spiritomb (4c), Latios (5c), Abomasnow (4c)

**Suggested board variations:**

1. **Reinforce Mystic (strongest splash)**: Morelull + Latios (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morelull + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Morelull + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Morelull + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Oranguru** (contributes 1 toward the trait alone) — support: Temporal Woods
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Tapu Fini (5c, tank), Morelull (1c), Spiritomb (4c), Latios (5c), Abomasnow (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Tapu Fini (5c, tank), Morelull (1c), Spiritomb (4c), Latios (5c), Abomasnow (4c)

**Suggested board variations:**

1. **Reinforce Mystic (strongest splash)**: Oranguru + Latios (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Oranguru + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Oranguru + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Oranguru + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Morelull + Oranguru** (contributes 2 toward the trait alone) — support: Temporal Woods
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Tapu Fini (5c, tank), Spiritomb (4c), Latios (5c), Abomasnow (4c)

**Suggested board variations:**

1. **Reinforce Mystic (strongest splash)**: Morelull + Oranguru + Latios (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Morelull + Oranguru + Tapu Bulu (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (different trait line)**: Morelull + Oranguru + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate secondary carry (different trait line)**: Morelull + Oranguru + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this combo activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### River (breakpoints: 2 / 3 / 4)

Reroll-eligible carriers (cost ≤3): Drednaw (2c), Bellibolt (3c, tank)
Splash-only carriers (cost 4-5, field once — don't need to reroll): Quagsire (4c, tank), Barraskewda (4c)

**Solo: Drednaw** (contributes 1 toward the trait alone) — support: Crashout
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Bellibolt (3c, tank), Quagsire (4c, tank), Barraskewda (4c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Bellibolt (3c, tank), Quagsire (4c, tank), Barraskewda (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Bellibolt (3c, tank), Quagsire (4c, tank), Barraskewda (4c)

**Suggested board variations:**

1. **Reinforce River (strongest splash)**: Drednaw + Barraskewda (4c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4)
2. **5-cost power splash (independent trait line)**: Drednaw + Tapu Bulu (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5)
3. **Secondary carry (different trait line)**: Drednaw + Charizard (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Drednaw + Darmanitan (5c) + Quagsire (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Solo: Bellibolt** (contributes 1 toward the trait alone) — support: Stalwart
  - Breakpoint 2: splash any 1 more (un-rerolled, 1★ is enough) from: Drednaw (2c), Quagsire (4c, tank), Barraskewda (4c)
  - Breakpoint 3: splash any 2 more (un-rerolled, 1★ is enough) from: Drednaw (2c), Quagsire (4c, tank), Barraskewda (4c)
  - Breakpoint 4: splash any 3 more (un-rerolled, 1★ is enough) from: Drednaw (2c), Quagsire (4c, tank), Barraskewda (4c)

**Suggested board variations:**

1. **Reinforce River (strongest splash)**: Bellibolt + Barraskewda (4c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Bellibolt + Tapu Bulu (5c) + Tangela (1c, tank)
   Traits this combo activates or contributes to: Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Bellibolt + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Bellibolt + Darmanitan (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
**Mixed-cost package: Drednaw + Bellibolt** (contributes 2 toward the trait alone) — support: Crashout, Stalwart
  - Breakpoint 2: reached by the core alone, no splash needed
  - Breakpoint 3: splash any 1 more (un-rerolled, 1★ is enough) from: Quagsire (4c, tank), Barraskewda (4c)
  - Breakpoint 4: splash any 2 more (un-rerolled, 1★ is enough) from: Quagsire (4c, tank), Barraskewda (4c)

**Suggested board variations:**

1. **Reinforce River (strongest splash)**: Drednaw + Bellibolt + Barraskewda (4c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **5-cost power splash (independent trait line)**: Drednaw + Bellibolt + Tapu Bulu (5c) + Tangela (1c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
3. **Secondary carry (different trait line)**: Drednaw + Bellibolt + Charizard (5c) + Wheezing (4c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate secondary carry (different trait line)**: Drednaw + Bellibolt + Darmanitan (5c) + Latias (5c, tank)
   Traits this combo activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

---

## Part 2 — Leveling Compositions (cost 4-5 carries)

### 2a. High-cost trait clusters

Every trait where 2+ cost-4/5 units share it — a genuine double/triple HIGH-COST carry comp.
Member roles are tagged; a cluster can legitimately mix carries and tanks.

**Mystic (breakpoints 2/4): Tapu Fini (5c, tank) + Spiritomb (4c) + Latios (5c) + Abomasnow (4c)**
  - Core alone contributes 4 — reachable: 2/4

**Jungle (breakpoints 3/5/7): Toucannon (4c) + Tropius (4c, tank) + Tapu Bulu (5c)**
  - Core alone contributes 3 — reachable: 3 — not reached by the core alone: 5/7
  - Breakpoint 5: splash any 2 more from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c)
  - Breakpoint 7: splash any 4 more from: Tangela (1c, tank), Ribombee (1c), Venusaur (2c, tank), Vigoroth (3c), Vikavolt (3c)

**Keen Eye (breakpoints 2/4/6): Noivern (4c) + Fezandipiti (4c, tank) + Tapu Lele (5c)**
  - Core alone contributes 3 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 1 more from: Sableye (2c), Celebi (3c), Unown (1c), Claydol (3c), Froslass (2c)
  - Breakpoint 6: splash any 3 more from: Sableye (2c), Celebi (3c), Unown (1c), Claydol (3c), Froslass (2c)

**Promoter (breakpoints 2/4/6): Quagsire (4c, tank) + Fezandipiti (4c, tank) + Runerigus (5c)**
  - Core alone contributes 3 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 1 more from: Ribombee (1c), Vikavolt (3c), Gible (2c), Wailord (2c, tank)
  - Breakpoint 6: splash any 3 more from: Ribombee (1c), Vikavolt (3c), Gible (2c), Wailord (2c, tank)

**Stalwart (breakpoints 2/4/6): Wheezing (4c, tank) + Latias (5c, tank) + Mamoswine (4c, tank)**
  - Core alone contributes 3 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 1 more from: Tangela (1c, tank), Torkoal (2c, tank), Bellibolt (3c, tank), Snorunt (1c, tank)
  - Breakpoint 6: splash any 3 more from: Tangela (1c, tank), Torkoal (2c, tank), Bellibolt (3c, tank), Snorunt (1c, tank)

**Volcano (breakpoints 3/5/7): Alolan Marowak (4c) + Wheezing (4c, tank) + Charizard (5c)**
  - Core alone contributes 3 — reachable: 3 — not reached by the core alone: 5/7
  - Breakpoint 5: splash any 2 more from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Armarouge (3c)
  - Breakpoint 7: splash any 4 more from: Graveler (1c, tank), Typhlosion (1c), Torkoal (2c, tank), Gible (2c), Armarouge (3c)

**Beachy (breakpoints 2/4/6): Blastoise (4c) + Tapu Fini (5c, tank)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 2 more from: Kingler (1c), Alolan Raichu (2c), Palossand (3c, tank), Alolan Exeggutor (3c)
  - Breakpoint 6: splash any 4 more from: Kingler (1c), Alolan Raichu (2c), Palossand (3c, tank), Alolan Exeggutor (3c)

**Bruiser (breakpoints 2/4/6): Tropius (4c, tank) + Salamence (5c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 2 more from: Venusaur (2c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 4 more from: Venusaur (2c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Hisuian Avalugg (3c, tank)

**Corkscrew (breakpoints 2/3/4/5): Rayquaza (5c) + Barraskewda (4c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 3/4/5
  - Breakpoint 3: splash any 1 more from: Kingler (1c), Excadrill (3c), Weavile (2c)
  - Breakpoint 4: splash any 2 more from: Kingler (1c), Excadrill (3c), Weavile (2c)
  - Breakpoint 5: splash any 3 more from: Kingler (1c), Excadrill (3c), Weavile (2c)

**Crashout (breakpoints 2/3/4): Aerodactyl (4c) + Darmanitan (5c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 3/4
  - Breakpoint 3: splash any 1 more from: Vigoroth (3c), Talonflame (3c), Drednaw (2c)
  - Breakpoint 4: splash any 2 more from: Vigoroth (3c), Talonflame (3c), Drednaw (2c)

**Froststone (breakpoints 2/4/6): Abomasnow (4c) + Mamoswine (4c, tank)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 2 more from: Snorunt (1c, tank), Froslass (2c), Weavile (2c), Hisuian Avalugg (3c, tank)
  - Breakpoint 6: splash any 4 more from: Snorunt (1c, tank), Froslass (2c), Weavile (2c), Hisuian Avalugg (3c, tank)

**Quickclaw (breakpoints 2/3/4/5): Blastoise (4c) + Tapu Koko (5c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 3/4/5
  - Breakpoint 3: splash any 1 more from: Vigoroth (3c), Armarouge (3c), Pidgeotto (1c), Klawf (1c)
  - Breakpoint 4: splash any 2 more from: Vigoroth (3c), Armarouge (3c), Pidgeotto (1c), Klawf (1c)
  - Breakpoint 5: splash any 3 more from: Vigoroth (3c), Armarouge (3c), Pidgeotto (1c), Klawf (1c)

**River (breakpoints 2/3/4): Quagsire (4c, tank) + Barraskewda (4c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 3/4
  - Breakpoint 3: splash any 1 more from: Drednaw (2c), Bellibolt (3c, tank)
  - Breakpoint 4: splash any 2 more from: Drednaw (2c), Bellibolt (3c, tank)

**Roughneck (breakpoints 2/3/4/5): Tapu Bulu (5c) + Alolan Marowak (4c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 3/4/5
  - Breakpoint 3: splash any 1 more from: Druddigon (1c), Absol (2c), Sneasler (3c)
  - Breakpoint 4: splash any 2 more from: Druddigon (1c), Absol (2c), Sneasler (3c)
  - Breakpoint 5: splash any 3 more from: Druddigon (1c), Absol (2c), Sneasler (3c)

**Ruiner (breakpoints 3/5/7): Spiritomb (4c) + Runerigus (5c)**
  - Core alone contributes 2 — not reached by the core alone: 3/5/7
  - Breakpoint 3: splash any 1 more from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c)
  - Breakpoint 5: splash any 3 more from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c)
  - Breakpoint 7: splash any 5 more from: Unown (1c), Stonjourner (2c, tank), Absol (2c), Xatu (2c, tank), Claydol (3c)

**Sky Striker (breakpoints 2/4): Noivern (4c) + Rayquaza (5c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 4
  - Breakpoint 4: splash any 2 more from: Pidgeotto (1c), Wailord (2c, tank), Talonflame (3c)

**Soul Bonded (breakpoints 1/2): Latios (5c) + Latias (5c, tank)**
  - Core alone contributes 2 — reachable: 1/2

**Spellweaver (breakpoints 2/4/6): Toucannon (4c) + Charizard (5c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 2 more from: Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Zubat (1c)
  - Breakpoint 6: splash any 4 more from: Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Zubat (1c)

**Substitutor (breakpoints 1/3/5): Tropius (4c, tank) + Mamoswine (4c, tank)**
  - Core alone contributes 2 — reachable: 1 — not reached by the core alone: 3/5
  - Breakpoint 3: splash any 1 more from: Ferrothorn (2c, tank), Morgrem (1c, tank), Xatu (2c, tank)
  - Breakpoint 5: splash any 3 more from: Ferrothorn (2c, tank), Morgrem (1c, tank), Xatu (2c, tank)

**Temporal Woods (breakpoints 2/4/6): Fezandipiti (4c, tank) + Tapu Lele (5c)**
  - Core alone contributes 2 — reachable: 2 — not reached by the core alone: 4/6
  - Breakpoint 4: splash any 2 more from: Morgrem (1c, tank), Morelull (1c), Oranguru (2c), Celebi (3c)
  - Breakpoint 6: splash any 4 more from: Morgrem (1c, tank), Morelull (1c), Oranguru (2c), Celebi (3c)

### 2b. High-cost carries

Cost-4/5 units that are actual damage-dealing carries (role ≠ tank): trait breakdown (co-carry, tank
pairing, support — classified by REAL ROLE, not cost) plus suggested board variations.

### Abomasnow (4c), special caster — Froststone / Mystic

**Froststone** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Snorunt (1c, tank), Hisuian Avalugg (3c, tank), Mamoswine (4c, tank)
- Support (cost ≤3, non-tank): Froslass (2c), Weavile (2c)
**Mystic** (breakpoints 2/4) — whole-roster pool: 6 — reachable: 2/4
- Co-carry (other high-cost, non-tank): Spiritomb (4c), Latios (5c)
- Tank pairing (any cost): Tapu Fini (5c, tank)
- Support (cost ≤3, non-tank): Morelull (1c), Oranguru (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Abomasnow (4c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **Budget double carry (shared trait, cheapest option)**: Abomasnow (4c) + Morelull (1c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Abomasnow (4c) + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Abomasnow (4c) + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Aerodactyl (4c), attack marksman — Ascender / Crashout

**Ascender** (breakpoints 2/4) — whole-roster pool: 4 — reachable: 2/4
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Gogoat (2c, tank)
- Support (cost ≤3, non-tank): Klawf (1c), Sneasler (3c)
**Crashout** (breakpoints 2/3/4) — whole-roster pool: 5 — reachable: 2/3/4
- Co-carry (other high-cost, non-tank): Darmanitan (5c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Vigoroth (3c), Talonflame (3c), Drednaw (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Aerodactyl (4c) + Darmanitan (5c) + Gogoat (2c, tank)
   Traits this trio activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **Budget double carry (shared trait, cheapest option)**: Aerodactyl (4c) + Klawf (1c) + Gogoat (2c, tank)
   Traits this trio activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5)
3. **Secondary carry (independent trait line)**: Aerodactyl (4c) + Charizard (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Aerodactyl (4c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)

### Alolan Marowak (4c), attack fighter — Volcano / Roughneck

**Volcano** (breakpoints 3/5/7) — whole-roster pool: 8 — reachable: 3/5/7
- Co-carry (other high-cost, non-tank): Charizard (5c)
- Tank pairing (any cost): Graveler (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank)
- Support (cost ≤3, non-tank): Typhlosion (1c), Gible (2c), Armarouge (3c)
**Roughneck** (breakpoints 2/3/4/5) — whole-roster pool: 5 — reachable: 2/3/4/5
- Co-carry (other high-cost, non-tank): Tapu Bulu (5c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Druddigon (1c), Absol (2c), Sneasler (3c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Alolan Marowak (4c) + Charizard (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Budget double carry (shared trait, cheapest option)**: Alolan Marowak (4c) + Druddigon (1c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (independent trait line)**: Alolan Marowak (4c) + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Alolan Marowak (4c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)

### Barraskewda (4c), attack caster — River / Corkscrew

**River** (breakpoints 2/3/4) — whole-roster pool: 4 — reachable: 2/3/4
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Bellibolt (3c, tank), Quagsire (4c, tank)
- Support (cost ≤3, non-tank): Drednaw (2c)
**Corkscrew** (breakpoints 2/3/4/5) — whole-roster pool: 5 — reachable: 2/3/4/5
- Co-carry (other high-cost, non-tank): Rayquaza (5c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Kingler (1c), Excadrill (3c), Weavile (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Barraskewda (4c) + Rayquaza (5c) + Quagsire (4c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
2. **Budget double carry (shared trait, cheapest option)**: Barraskewda (4c) + Kingler (1c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Barraskewda (4c) + Charizard (5c) + Quagsire (4c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Barraskewda (4c) + Darmanitan (5c) + Quagsire (4c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Blastoise (4c), special marksman — Beachy / Quickclaw

**Beachy** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Palossand (3c, tank), Tapu Fini (5c, tank)
- Support (cost ≤3, non-tank): Kingler (1c), Alolan Raichu (2c), Alolan Exeggutor (3c)
**Quickclaw** (breakpoints 2/3/4/5) — whole-roster pool: 6 — reachable: 2/3/4/5
- Co-carry (other high-cost, non-tank): Tapu Koko (5c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Vigoroth (3c), Armarouge (3c), Pidgeotto (1c), Klawf (1c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Blastoise (4c) + Tapu Koko (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **Budget double carry (shared trait, cheapest option)**: Blastoise (4c) + Kingler (1c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Blastoise (4c) + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Blastoise (4c) + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Noivern (4c), special caster — Sky Striker / Keen Eye

**Sky Striker** (breakpoints 2/4) — whole-roster pool: 5 — reachable: 2/4
- Co-carry (other high-cost, non-tank): Rayquaza (5c)
- Tank pairing (any cost): Wailord (2c, tank)
- Support (cost ≤3, non-tank): Pidgeotto (1c), Talonflame (3c)
**Keen Eye** (breakpoints 2/4/6) — whole-roster pool: 8 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): Tapu Lele (5c)
- Tank pairing (any cost): Fezandipiti (4c, tank)
- Support (cost ≤3, non-tank): Sableye (2c), Celebi (3c), Unown (1c), Claydol (3c), Froslass (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Noivern (4c) + Rayquaza (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **Budget double carry (shared trait, cheapest option)**: Noivern (4c) + Pidgeotto (1c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (independent trait line)**: Noivern (4c) + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Noivern (4c) + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Spiritomb (4c), special caster — Ruiner / Mystic

**Ruiner** (breakpoints 3/5/7) — whole-roster pool: 7 — reachable: 3/5/7
- Co-carry (other high-cost, non-tank): Runerigus (5c)
- Tank pairing (any cost): Stonjourner (2c, tank), Xatu (2c, tank)
- Support (cost ≤3, non-tank): Unown (1c), Absol (2c), Claydol (3c)
**Mystic** (breakpoints 2/4) — whole-roster pool: 6 — reachable: 2/4
- Co-carry (other high-cost, non-tank): Latios (5c), Abomasnow (4c)
- Tank pairing (any cost): Tapu Fini (5c, tank)
- Support (cost ≤3, non-tank): Morelull (1c), Oranguru (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Spiritomb (4c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **Budget double carry (shared trait, cheapest option)**: Spiritomb (4c) + Morelull (1c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Spiritomb (4c) + Charizard (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Spiritomb (4c) + Darmanitan (5c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Toucannon (4c), attack caster — Jungle / Spellweaver

**Jungle** (breakpoints 3/5/7) — whole-roster pool: 8 — reachable: 3/5/7
- Co-carry (other high-cost, non-tank): Tapu Bulu (5c)
- Tank pairing (any cost): Tangela (1c, tank), Venusaur (2c, tank), Tropius (4c, tank)
- Support (cost ≤3, non-tank): Ribombee (1c), Vigoroth (3c), Vikavolt (3c)
**Spellweaver** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): Charizard (5c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Zubat (1c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Toucannon (4c) + Charizard (5c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Budget double carry (shared trait, cheapest option)**: Toucannon (4c) + Ribombee (1c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (independent trait line)**: Toucannon (4c) + Darmanitan (5c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Toucannon (4c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)

### Charizard (5c), special caster — Volcano / Spellweaver

**Volcano** (breakpoints 3/5/7) — whole-roster pool: 8 — reachable: 3/5/7
- Co-carry (other high-cost, non-tank): Alolan Marowak (4c)
- Tank pairing (any cost): Graveler (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank)
- Support (cost ≤3, non-tank): Typhlosion (1c), Gible (2c), Armarouge (3c)
**Spellweaver** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): Toucannon (4c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Alolan Raichu (2c), Alolan Exeggutor (3c), Typhlosion (1c), Zubat (1c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Charizard (5c) + Typhlosion (1c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Budget double carry (shared trait, cheapest option)**: Charizard (5c) + Zubat (1c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Secondary carry (independent trait line)**: Charizard (5c) + Darmanitan (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Charizard (5c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)

### Darmanitan (5c), attack fighter — Zen / Crashout

**Zen** (breakpoints 1) — whole-roster pool: 1 — reachable: 1
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier
**Crashout** (breakpoints 2/3/4) — whole-roster pool: 5 — reachable: 2/3/4
- Co-carry (other high-cost, non-tank): Aerodactyl (4c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Vigoroth (3c), Talonflame (3c), Drednaw (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Darmanitan (5c) + Aerodactyl (4c) + Gogoat (2c, tank)
   Traits this trio activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **Budget double carry (shared trait, cheapest option)**: Darmanitan (5c) + Drednaw (2c) + Quagsire (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Darmanitan (5c) + Charizard (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate splash**: Darmanitan (5c) + Latios (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Latios (5c), special caster — Soul Bonded / Mystic

**Soul Bonded** (breakpoints 1/2) — whole-roster pool: 2 — reachable: 1/2
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Latias (5c, tank)
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier
**Mystic** (breakpoints 2/4) — whole-roster pool: 6 — reachable: 2/4
- Co-carry (other high-cost, non-tank): Spiritomb (4c), Abomasnow (4c)
- Tank pairing (any cost): Tapu Fini (5c, tank)
- Support (cost ≤3, non-tank): Morelull (1c), Oranguru (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Latios (5c) + Abomasnow (4c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **Budget double carry (shared trait, cheapest option)**: Latios (5c) + Morelull (1c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (independent trait line)**: Latios (5c) + Charizard (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Latios (5c) + Darmanitan (5c) + Latias (5c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Rayquaza (5c), attack fighter — Sky Striker / Corkscrew

**Sky Striker** (breakpoints 2/4) — whole-roster pool: 5 — reachable: 2/4
- Co-carry (other high-cost, non-tank): Noivern (4c)
- Tank pairing (any cost): Wailord (2c, tank)
- Support (cost ≤3, non-tank): Pidgeotto (1c), Talonflame (3c)
**Corkscrew** (breakpoints 2/3/4/5) — whole-roster pool: 5 — reachable: 2/3/4/5
- Co-carry (other high-cost, non-tank): Barraskewda (4c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Kingler (1c), Excadrill (3c), Weavile (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Rayquaza (5c) + Barraskewda (4c) + Quagsire (4c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4)
2. **Budget double carry (shared trait, cheapest option)**: Rayquaza (5c) + Kingler (1c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Rayquaza (5c) + Charizard (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Rayquaza (5c) + Darmanitan (5c) + Wailord (2c, tank)
   Traits this trio activates or contributes to: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Sky Striker (breakpoints 2/4, whole-roster pool 5 — reachable: 2/4); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Runerigus (5c), special caster — Ruiner / Promoter

**Ruiner** (breakpoints 3/5/7) — whole-roster pool: 7 — reachable: 3/5/7
- Co-carry (other high-cost, non-tank): Spiritomb (4c)
- Tank pairing (any cost): Stonjourner (2c, tank), Xatu (2c, tank)
- Support (cost ≤3, non-tank): Unown (1c), Absol (2c), Claydol (3c)
**Promoter** (breakpoints 2/4/6) — whole-roster pool: 7 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Wailord (2c, tank), Quagsire (4c, tank), Fezandipiti (4c, tank)
- Support (cost ≤3, non-tank): Ribombee (1c), Vikavolt (3c), Gible (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Runerigus (5c) + Spiritomb (4c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **Budget double carry (shared trait, cheapest option)**: Runerigus (5c) + Ribombee (1c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (independent trait line)**: Runerigus (5c) + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Runerigus (5c) + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Salamence (5c), attack fighter — Rogue / Bruiser

**Rogue** (breakpoints 1) — whole-roster pool: 1 — reachable: 1
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier
**Bruiser** (breakpoints 2/4/6) — whole-roster pool: 8 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Venusaur (2c, tank), Tropius (4c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Hisuian Avalugg (3c, tank)
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier

**Suggested board variations:**

1. **Secondary carry (independent trait line)**: Salamence (5c) + Charizard (5c) + Graveler (1c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Alternate splash**: Salamence (5c) + Darmanitan (5c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Tapu Bulu (5c), attack fighter — Earth Spirit / Jungle / Roughneck

**Earth Spirit** (breakpoints 1) — whole-roster pool: 1 — reachable: 1
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier
**Jungle** (breakpoints 3/5/7) — whole-roster pool: 8 — reachable: 3/5/7
- Co-carry (other high-cost, non-tank): Toucannon (4c)
- Tank pairing (any cost): Tangela (1c, tank), Venusaur (2c, tank), Tropius (4c, tank)
- Support (cost ≤3, non-tank): Ribombee (1c), Vigoroth (3c), Vikavolt (3c)
**Roughneck** (breakpoints 2/3/4/5) — whole-roster pool: 5 — reachable: 2/3/4/5
- Co-carry (other high-cost, non-tank): Alolan Marowak (4c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Druddigon (1c), Absol (2c), Sneasler (3c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Tapu Bulu (5c) + Alolan Marowak (4c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Budget double carry (shared trait, cheapest option)**: Tapu Bulu (5c) + Druddigon (1c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Cave Crawler (breakpoints 3/5, whole-roster pool 6 — reachable: 3/5); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Secondary carry (independent trait line)**: Tapu Bulu (5c) + Charizard (5c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Tapu Bulu (5c) + Darmanitan (5c) + Tropius (4c, tank)
   Traits this trio activates or contributes to: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Tapu Koko (5c), attack marksman — Shock Spirit / Quickclaw

**Shock Spirit** (breakpoints 1) — whole-roster pool: 1 — reachable: 1
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier
**Quickclaw** (breakpoints 2/3/4/5) — whole-roster pool: 6 — reachable: 2/3/4/5
- Co-carry (other high-cost, non-tank): Blastoise (4c)
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): Vigoroth (3c), Armarouge (3c), Pidgeotto (1c), Klawf (1c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Tapu Koko (5c) + Blastoise (4c) + Tapu Fini (5c, tank)
   Traits this trio activates or contributes to: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **Budget double carry (shared trait, cheapest option)**: Tapu Koko (5c) + Klawf (1c) + Gogoat (2c, tank)
   Traits this trio activates or contributes to: Ascender (breakpoints 2/4, whole-roster pool 4 — reachable: 2/4); Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Secondary carry (independent trait line)**: Tapu Koko (5c) + Charizard (5c) + Wheezing (4c, tank)
   Traits this trio activates or contributes to: Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Tapu Koko (5c) + Darmanitan (5c) + [no natural trait-sharing tank found — field any tank for the front line]
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Quickclaw (breakpoints 2/3/4/5, whole-roster pool 6 — reachable: 2/3/4/5); Shock Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Tapu Lele (5c), special caster — Mind Spirit / Temporal Woods / Keen Eye

**Mind Spirit** (breakpoints 1) — whole-roster pool: 1 — reachable: 1
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): none — no tank shares this trait
- Support (cost ≤3, non-tank): none — this trait has no other low-cost carrier
**Temporal Woods** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): none — this trait has no other high-cost carrier
- Tank pairing (any cost): Morgrem (1c, tank), Fezandipiti (4c, tank)
- Support (cost ≤3, non-tank): Morelull (1c), Oranguru (2c), Celebi (3c)
**Keen Eye** (breakpoints 2/4/6) — whole-roster pool: 8 — reachable: 2/4/6
- Co-carry (other high-cost, non-tank): Noivern (4c)
- Tank pairing (any cost): Fezandipiti (4c, tank)
- Support (cost ≤3, non-tank): Sableye (2c), Celebi (3c), Unown (1c), Claydol (3c), Froslass (2c)

**Suggested board variations:**

1. **Double carry (shared trait, reinforces breakpoints)**: Tapu Lele (5c) + Celebi (3c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **Budget double carry (shared trait, cheapest option)**: Tapu Lele (5c) + Morelull (1c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Secondary carry (independent trait line)**: Tapu Lele (5c) + Charizard (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate splash**: Tapu Lele (5c) + Darmanitan (5c) + Fezandipiti (4c, tank)
   Traits this trio activates or contributes to: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### 2c. High-cost tanks

Cost-4/5 units whose real role is tank (Fezandipiti, Mamoswine, Quagsire, Tropius, Wheezing, Latias,
Tapu Fini): trait breakdown (who they front-line for, not "co-carries" of their own), plus which real
carries they naturally pair with.

### Fezandipiti (4c, tank) — Temporal Woods / Promoter / Keen Eye

**Temporal Woods** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Carries this trait would support: Tapu Lele (5c)
- Other tanks sharing this trait: Morgrem (1c, tank)
- Cheap support (cost ≤3, non-tank): Morelull (1c), Oranguru (2c), Celebi (3c)
**Promoter** (breakpoints 2/4/6) — whole-roster pool: 7 — reachable: 2/4/6
- Carries this trait would support: Runerigus (5c)
- Other tanks sharing this trait: Wailord (2c, tank), Quagsire (4c, tank)
- Cheap support (cost ≤3, non-tank): Ribombee (1c), Vikavolt (3c), Gible (2c)
**Keen Eye** (breakpoints 2/4/6) — whole-roster pool: 8 — reachable: 2/4/6
- Carries this trait would support: Noivern (4c), Tapu Lele (5c)
- Other tanks sharing this trait: none
- Cheap support (cost ≤3, non-tank): Sableye (2c), Celebi (3c), Unown (1c), Claydol (3c), Froslass (2c)

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Fezandipiti (4c, tank) + Tapu Lele (5c)
   Traits this pairing touches: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Mind Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
2. **Budget natural pairing (shared trait, cheapest option)**: Fezandipiti (4c, tank) + Celebi (3c)
   Traits this pairing touches: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)
3. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Fezandipiti (4c, tank) + Charizard (5c)
   Traits this pairing touches: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate pairing**: Fezandipiti (4c, tank) + Runerigus (5c)
   Traits this pairing touches: Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7); Temporal Woods (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6)

### Mamoswine (4c, tank) — Froststone / Substitutor / Stalwart

**Froststone** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Carries this trait would support: Abomasnow (4c)
- Other tanks sharing this trait: Snorunt (1c, tank), Hisuian Avalugg (3c, tank)
- Cheap support (cost ≤3, non-tank): Froslass (2c), Weavile (2c)
**Substitutor** (breakpoints 1/3/5) — whole-roster pool: 5 — reachable: 1/3/5
- Carries this trait would support: none — this trait has no real carrier
- Other tanks sharing this trait: Tropius (4c, tank), Ferrothorn (2c, tank), Morgrem (1c, tank), Xatu (2c, tank)
- Cheap support (cost ≤3, non-tank): none
**Stalwart** (breakpoints 2/4/6) — whole-roster pool: 7 — reachable: 2/4/6
- Carries this trait would support: none — this trait has no real carrier
- Other tanks sharing this trait: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank)
- Cheap support (cost ≤3, non-tank): none

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Mamoswine (4c, tank) + Abomasnow (4c)
   Traits this pairing touches: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **Budget natural pairing (shared trait, cheapest option)**: Mamoswine (4c, tank) + Froslass (2c)
   Traits this pairing touches: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Keen Eye (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Mamoswine (4c, tank) + Charizard (5c)
   Traits this pairing touches: Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate pairing**: Mamoswine (4c, tank) + Weavile (2c)
   Traits this pairing touches: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)

### Quagsire (4c, tank) — River / Promoter

**River** (breakpoints 2/3/4) — whole-roster pool: 4 — reachable: 2/3/4
- Carries this trait would support: Barraskewda (4c)
- Other tanks sharing this trait: Bellibolt (3c, tank)
- Cheap support (cost ≤3, non-tank): Drednaw (2c)
**Promoter** (breakpoints 2/4/6) — whole-roster pool: 7 — reachable: 2/4/6
- Carries this trait would support: Runerigus (5c)
- Other tanks sharing this trait: Wailord (2c, tank), Fezandipiti (4c, tank)
- Cheap support (cost ≤3, non-tank): Ribombee (1c), Vikavolt (3c), Gible (2c)

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Quagsire (4c, tank) + Runerigus (5c)
   Traits this pairing touches: Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Ruiner (breakpoints 3/5/7, whole-roster pool 7 — reachable: 3/5/7)
2. **Budget natural pairing (shared trait, cheapest option)**: Quagsire (4c, tank) + Ribombee (1c)
   Traits this pairing touches: Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4)
3. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Quagsire (4c, tank) + Charizard (5c)
   Traits this pairing touches: Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate pairing**: Quagsire (4c, tank) + Barraskewda (4c)
   Traits this pairing touches: Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); River (breakpoints 2/3/4, whole-roster pool 4 — reachable: 2/3/4)

### Tropius (4c, tank) — Jungle / Bruiser / Substitutor

**Jungle** (breakpoints 3/5/7) — whole-roster pool: 8 — reachable: 3/5/7
- Carries this trait would support: Toucannon (4c), Tapu Bulu (5c)
- Other tanks sharing this trait: Tangela (1c, tank), Venusaur (2c, tank)
- Cheap support (cost ≤3, non-tank): Ribombee (1c), Vigoroth (3c), Vikavolt (3c)
**Bruiser** (breakpoints 2/4/6) — whole-roster pool: 8 — reachable: 2/4/6
- Carries this trait would support: Salamence (5c)
- Other tanks sharing this trait: Venusaur (2c, tank), Palossand (3c, tank), Graveler (1c, tank), Stonjourner (2c, tank), Gogoat (2c, tank), Hisuian Avalugg (3c, tank)
- Cheap support (cost ≤3, non-tank): none
**Substitutor** (breakpoints 1/3/5) — whole-roster pool: 5 — reachable: 1/3/5
- Carries this trait would support: none — this trait has no real carrier
- Other tanks sharing this trait: Ferrothorn (2c, tank), Morgrem (1c, tank), Xatu (2c, tank), Mamoswine (4c, tank)
- Cheap support (cost ≤3, non-tank): none

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Tropius (4c, tank) + Salamence (5c)
   Traits this pairing touches: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Rogue (breakpoints 1, whole-roster pool 1 — reachable: 1); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
2. **Budget natural pairing (shared trait, cheapest option)**: Tropius (4c, tank) + Ribombee (1c)
   Traits this pairing touches: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Promoter (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)
3. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Tropius (4c, tank) + Charizard (5c)
   Traits this pairing touches: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
4. **Alternate pairing**: Tropius (4c, tank) + Tapu Bulu (5c)
   Traits this pairing touches: Bruiser (breakpoints 2/4/6, whole-roster pool 8 — reachable: 2/4/6); Earth Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1); Jungle (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Substitutor (breakpoints 1/3/5, whole-roster pool 5 — reachable: 1/3/5)

### Wheezing (4c, tank) — Volcano / Stalwart

**Volcano** (breakpoints 3/5/7) — whole-roster pool: 8 — reachable: 3/5/7
- Carries this trait would support: Alolan Marowak (4c), Charizard (5c)
- Other tanks sharing this trait: Graveler (1c, tank), Torkoal (2c, tank)
- Cheap support (cost ≤3, non-tank): Typhlosion (1c), Gible (2c), Armarouge (3c)
**Stalwart** (breakpoints 2/4/6) — whole-roster pool: 7 — reachable: 2/4/6
- Carries this trait would support: none — this trait has no real carrier
- Other tanks sharing this trait: Tangela (1c, tank), Torkoal (2c, tank), Bellibolt (3c, tank), Latias (5c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
- Cheap support (cost ≤3, non-tank): none

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Wheezing (4c, tank) + Charizard (5c)
   Traits this pairing touches: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
2. **Budget natural pairing (shared trait, cheapest option)**: Wheezing (4c, tank) + Typhlosion (1c)
   Traits this pairing touches: Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Wheezing (4c, tank) + Darmanitan (5c)
   Traits this pairing touches: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate pairing**: Wheezing (4c, tank) + Alolan Marowak (4c)
   Traits this pairing touches: Roughneck (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)

### Latias (5c, tank) — Soul Bonded / Stalwart

**Soul Bonded** (breakpoints 1/2) — whole-roster pool: 2 — reachable: 1/2
- Carries this trait would support: Latios (5c)
- Other tanks sharing this trait: none
- Cheap support (cost ≤3, non-tank): none
**Stalwart** (breakpoints 2/4/6) — whole-roster pool: 7 — reachable: 2/4/6
- Carries this trait would support: none — this trait has no real carrier
- Other tanks sharing this trait: Tangela (1c, tank), Torkoal (2c, tank), Wheezing (4c, tank), Bellibolt (3c, tank), Snorunt (1c, tank), Mamoswine (4c, tank)
- Cheap support (cost ≤3, non-tank): none

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Latias (5c, tank) + Latios (5c)
   Traits this pairing touches: Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6)
2. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Latias (5c, tank) + Charizard (5c)
   Traits this pairing touches: Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7)
3. **Alternate pairing**: Latias (5c, tank) + Darmanitan (5c)
   Traits this pairing touches: Crashout (breakpoints 2/3/4, whole-roster pool 5 — reachable: 2/3/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Stalwart (breakpoints 2/4/6, whole-roster pool 7 — reachable: 2/4/6); Zen (breakpoints 1, whole-roster pool 1 — reachable: 1)

### Tapu Fini (5c, tank) — Wave Spirit / Beachy / Mystic

**Wave Spirit** (breakpoints 1) — whole-roster pool: 1 — reachable: 1
- Carries this trait would support: none — this trait has no real carrier
- Other tanks sharing this trait: none
- Cheap support (cost ≤3, non-tank): none
**Beachy** (breakpoints 2/4/6) — whole-roster pool: 6 — reachable: 2/4/6
- Carries this trait would support: Blastoise (4c)
- Other tanks sharing this trait: Palossand (3c, tank)
- Cheap support (cost ≤3, non-tank): Kingler (1c), Alolan Raichu (2c), Alolan Exeggutor (3c)
**Mystic** (breakpoints 2/4) — whole-roster pool: 6 — reachable: 2/4
- Carries this trait would support: Spiritomb (4c), Latios (5c), Abomasnow (4c)
- Other tanks sharing this trait: none
- Cheap support (cost ≤3, non-tank): Morelull (1c), Oranguru (2c)

**Suggested carry pairings:**

1. **Natural pairing (shared trait)**: Tapu Fini (5c, tank) + Latios (5c)
   Traits this pairing touches: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Soul Bonded (breakpoints 1/2, whole-roster pool 2 — reachable: 1/2); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
2. **Budget natural pairing (shared trait, cheapest option)**: Tapu Fini (5c, tank) + Kingler (1c)
   Traits this pairing touches: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Corkscrew (breakpoints 2/3/4/5, whole-roster pool 5 — reachable: 2/3/4/5); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
3. **Flexible pairing (independent trait, e.g. a 5-cost carry)**: Tapu Fini (5c, tank) + Charizard (5c)
   Traits this pairing touches: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Spellweaver (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Volcano (breakpoints 3/5/7, whole-roster pool 8 — reachable: 3/5/7); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)
4. **Alternate pairing**: Tapu Fini (5c, tank) + Abomasnow (4c)
   Traits this pairing touches: Beachy (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Froststone (breakpoints 2/4/6, whole-roster pool 6 — reachable: 2/4/6); Mystic (breakpoints 2/4, whole-roster pool 6 — reachable: 2/4); Wave Spirit (breakpoints 1, whole-roster pool 1 — reachable: 1)

---

## Part 3 — Discovered by Training

Trait pairings self-play training found winning consistently but that aren't already represented
by a Part 1/2 entry above — generated by `npx tsx src/econ/growCatalog.ts`, refreshed every time the
training pipeline runs. Threshold: 40+ real samples, 62%+ win rate.
Measured win-rate annotations for the hand-derived Part 1/2 entries above live in `compositions.json`
only (`measuredWinRate` / `measuredSamples` fields) — not duplicated into this prose doc.

### Discovered: Rogue + Sky Striker (stage 5)

Self-play training found fielding both Rogue and Sky Striker together correlated with winning 93% of fights at stage 5 (40 real samples). No fixed core — any real carriers of both traits qualify. Rogue (breakpoints 1) carriers: Salamence. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto.

### Discovered: Promoter + Shock Spirit (stage 5)

Self-play training found fielding both Promoter and Shock Spirit together correlated with winning 91% of fights at stage 5 (77 real samples). No fixed core — any real carriers of both traits qualify. Promoter (breakpoints 2/4/6) carriers: Runerigus, Quagsire, Fezandipiti, Vikavolt, Gible. Shock Spirit (breakpoints 1) carriers: Tapu Koko.

### Discovered: Sky Striker + Wave Spirit (stage 5)

Self-play training found fielding both Sky Striker and Wave Spirit together correlated with winning 91% of fights at stage 5 (44 real samples). No fixed core — any real carriers of both traits qualify. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto. Wave Spirit (breakpoints 1) carriers: Tapu Fini.

### Discovered: Quickclaw + Rogue (stage 5)

Self-play training found fielding both Quickclaw and Rogue together correlated with winning 89% of fights at stage 5 (75 real samples). No fixed core — any real carriers of both traits qualify. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto. Rogue (breakpoints 1) carriers: Salamence.

### Discovered: Mind Spirit + Quickclaw (stage 5)

Self-play training found fielding both Mind Spirit and Quickclaw together correlated with winning 88% of fights at stage 5 (65 real samples). No fixed core — any real carriers of both traits qualify. Mind Spirit (breakpoints 1) carriers: Tapu Lele. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto.

### Discovered: Corkscrew + Soul Bonded (stage 5)

Self-play training found fielding both Corkscrew and Soul Bonded together correlated with winning 87% of fights at stage 5 (108 real samples). No fixed core — any real carriers of both traits qualify. Corkscrew (breakpoints 2/3/4/5) carriers: Rayquaza, Barraskewda, Excadrill, Weavile, Kingler. Soul Bonded (breakpoints 1/2) carriers: Latios, Latias.

### Discovered: Promoter + Rogue (stage 5)

Self-play training found fielding both Promoter and Rogue together correlated with winning 84% of fights at stage 5 (69 real samples). No fixed core — any real carriers of both traits qualify. Promoter (breakpoints 2/4/6) carriers: Runerigus, Quagsire, Fezandipiti, Vikavolt, Gible. Rogue (breakpoints 1) carriers: Salamence.

### Discovered: Beachy + Mind Spirit (stage 5)

Self-play training found fielding both Beachy and Mind Spirit together correlated with winning 82% of fights at stage 5 (62 real samples). No fixed core — any real carriers of both traits qualify. Beachy (breakpoints 2/4/6) carriers: Tapu Fini, Blastoise, Palossand, Alolan Exeggutor, Alolan Raichu. Mind Spirit (breakpoints 1) carriers: Tapu Lele.

### Discovered: Corkscrew + Mind Spirit (stage 5)

Self-play training found fielding both Corkscrew and Mind Spirit together correlated with winning 82% of fights at stage 5 (45 real samples). No fixed core — any real carriers of both traits qualify. Corkscrew (breakpoints 2/3/4/5) carriers: Rayquaza, Barraskewda, Excadrill, Weavile, Kingler. Mind Spirit (breakpoints 1) carriers: Tapu Lele.

### Discovered: Rogue + Temporal Woods (stage 5)

Self-play training found fielding both Rogue and Temporal Woods together correlated with winning 78% of fights at stage 5 (90 real samples). No fixed core — any real carriers of both traits qualify. Rogue (breakpoints 1) carriers: Salamence. Temporal Woods (breakpoints 2/4/6) carriers: Tapu Lele, Fezandipiti, Celebi, Oranguru, Morgrem.

### Discovered: Corkscrew + Rogue (stage 5)

Self-play training found fielding both Corkscrew and Rogue together correlated with winning 77% of fights at stage 5 (56 real samples). No fixed core — any real carriers of both traits qualify. Corkscrew (breakpoints 2/3/4/5) carriers: Rayquaza, Barraskewda, Excadrill, Weavile, Kingler. Rogue (breakpoints 1) carriers: Salamence.

### Discovered: Mystic + Sky Striker (stage 5)

Self-play training found fielding both Mystic and Sky Striker together correlated with winning 76% of fights at stage 5 (391 real samples). No fixed core — any real carriers of both traits qualify. Mystic (breakpoints 2/4) carriers: Tapu Fini, Latios, Spiritomb, Abomasnow, Oranguru. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto.

### Discovered: Cave Crawler + River (stage 4)

Self-play training found fielding both Cave Crawler and River together correlated with winning 72% of fights at stage 4 (103 real samples). No fixed core — any real carriers of both traits qualify. Cave Crawler (breakpoints 3/5) carriers: Excadrill, Gible, Sableye, Ferrothorn, Zubat. River (breakpoints 2/3/4) carriers: Quagsire, Barraskewda, Bellibolt, Drednaw.

### Discovered: Bruiser + Temporal Woods (stage 5)

Self-play training found fielding both Bruiser and Temporal Woods together correlated with winning 72% of fights at stage 5 (541 real samples). No fixed core — any real carriers of both traits qualify. Bruiser (breakpoints 2/4/6) carriers: Salamence, Tropius, Palossand, Hisuian Avalugg, Venusaur. Temporal Woods (breakpoints 2/4/6) carriers: Tapu Lele, Fezandipiti, Celebi, Oranguru, Morgrem.

### Discovered: Bruiser + Sky Striker (stage 5)

Self-play training found fielding both Bruiser and Sky Striker together correlated with winning 71% of fights at stage 5 (385 real samples). No fixed core — any real carriers of both traits qualify. Bruiser (breakpoints 2/4/6) carriers: Salamence, Tropius, Palossand, Hisuian Avalugg, Venusaur. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto.

### Discovered: Bruiser + Sky Striker (stage 4)

Self-play training found fielding both Bruiser and Sky Striker together correlated with winning 70% of fights at stage 4 (311 real samples). No fixed core — any real carriers of both traits qualify. Bruiser (breakpoints 2/4/6) carriers: Salamence, Tropius, Palossand, Hisuian Avalugg, Venusaur. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto.

### Discovered: Keen Eye + Wave Spirit (stage 5)

Self-play training found fielding both Keen Eye and Wave Spirit together correlated with winning 70% of fights at stage 5 (138 real samples). No fixed core — any real carriers of both traits qualify. Keen Eye (breakpoints 2/4/6) carriers: Tapu Lele, Noivern, Fezandipiti, Celebi, Claydol. Wave Spirit (breakpoints 1) carriers: Tapu Fini.

### Discovered: Froststone + Quickclaw (stage 5)

Self-play training found fielding both Froststone and Quickclaw together correlated with winning 69% of fights at stage 5 (1054 real samples). No fixed core — any real carriers of both traits qualify. Froststone (breakpoints 2/4/6) carriers: Abomasnow, Mamoswine, Hisuian Avalugg, Froslass, Weavile. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto.

### Discovered: Rogue + Stalwart (stage 5)

Self-play training found fielding both Rogue and Stalwart together correlated with winning 69% of fights at stage 5 (88 real samples). No fixed core — any real carriers of both traits qualify. Rogue (breakpoints 1) carriers: Salamence. Stalwart (breakpoints 2/4/6) carriers: Latias, Wheezing, Mamoswine, Bellibolt, Torkoal.

### Discovered: Quickclaw + Substitutor (stage 5)

Self-play training found fielding both Quickclaw and Substitutor together correlated with winning 69% of fights at stage 5 (2853 real samples). No fixed core — any real carriers of both traits qualify. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Substitutor + Wave Spirit (stage 5)

Self-play training found fielding both Substitutor and Wave Spirit together correlated with winning 69% of fights at stage 5 (239 real samples). No fixed core — any real carriers of both traits qualify. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem. Wave Spirit (breakpoints 1) carriers: Tapu Fini.

### Discovered: Mystic + Shock Spirit (stage 5)

Self-play training found fielding both Mystic and Shock Spirit together correlated with winning 68% of fights at stage 5 (88 real samples). No fixed core — any real carriers of both traits qualify. Mystic (breakpoints 2/4) carriers: Tapu Fini, Latios, Spiritomb, Abomasnow, Oranguru. Shock Spirit (breakpoints 1) carriers: Tapu Koko.

### Discovered: Ascender + Promoter (stage 5)

Self-play training found fielding both Ascender and Promoter together correlated with winning 68% of fights at stage 5 (25 real samples). No fixed core — any real carriers of both traits qualify. Ascender (breakpoints 2/4) carriers: Aerodactyl, Sneasler, Gogoat, Klawf. Promoter (breakpoints 2/4/6) carriers: Runerigus, Quagsire, Fezandipiti, Vikavolt, Gible.

### Discovered: Froststone + Promoter (stage 4)

Self-play training found fielding both Froststone and Promoter together correlated with winning 67% of fights at stage 4 (86 real samples). No fixed core — any real carriers of both traits qualify. Froststone (breakpoints 2/4/6) carriers: Abomasnow, Mamoswine, Hisuian Avalugg, Froslass, Weavile. Promoter (breakpoints 2/4/6) carriers: Runerigus, Quagsire, Fezandipiti, Vikavolt, Gible.

### Discovered: Mystic + Sky Striker (stage 4)

Self-play training found fielding both Mystic and Sky Striker together correlated with winning 67% of fights at stage 4 (261 real samples). No fixed core — any real carriers of both traits qualify. Mystic (breakpoints 2/4) carriers: Tapu Fini, Latios, Spiritomb, Abomasnow, Oranguru. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto.

### Discovered: Mind Spirit + Soul Bonded (stage 5)

Self-play training found fielding both Mind Spirit and Soul Bonded together correlated with winning 67% of fights at stage 5 (55 real samples). No fixed core — any real carriers of both traits qualify. Mind Spirit (breakpoints 1) carriers: Tapu Lele. Soul Bonded (breakpoints 1/2) carriers: Latios, Latias.

### Discovered: Beachy + Substitutor (stage 2)

Self-play training found fielding both Beachy and Substitutor together correlated with winning 66% of fights at stage 2 (428 real samples). No fixed core — any real carriers of both traits qualify. Beachy (breakpoints 2/4/6) carriers: Tapu Fini, Blastoise, Palossand, Alolan Exeggutor, Alolan Raichu. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Quickclaw + Substitutor (stage 2)

Self-play training found fielding both Quickclaw and Substitutor together correlated with winning 66% of fights at stage 2 (62 real samples). No fixed core — any real carriers of both traits qualify. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Shock Spirit + Soul Bonded (stage 5)

Self-play training found fielding both Shock Spirit and Soul Bonded together correlated with winning 66% of fights at stage 5 (51 real samples). No fixed core — any real carriers of both traits qualify. Shock Spirit (breakpoints 1) carriers: Tapu Koko. Soul Bonded (breakpoints 1/2) carriers: Latios, Latias.

### Discovered: Quickclaw + Temporal Woods (stage 5)

Self-play training found fielding both Quickclaw and Temporal Woods together correlated with winning 66% of fights at stage 5 (412 real samples). No fixed core — any real carriers of both traits qualify. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto. Temporal Woods (breakpoints 2/4/6) carriers: Tapu Lele, Fezandipiti, Celebi, Oranguru, Morgrem.

### Discovered: Bruiser + Sky Striker (stage 3)

Self-play training found fielding both Bruiser and Sky Striker together correlated with winning 66% of fights at stage 3 (208 real samples). No fixed core — any real carriers of both traits qualify. Bruiser (breakpoints 2/4/6) carriers: Salamence, Tropius, Palossand, Hisuian Avalugg, Venusaur. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto.

### Discovered: Bruiser + Mind Spirit (stage 5)

Self-play training found fielding both Bruiser and Mind Spirit together correlated with winning 66% of fights at stage 5 (70 real samples). No fixed core — any real carriers of both traits qualify. Bruiser (breakpoints 2/4/6) carriers: Salamence, Tropius, Palossand, Hisuian Avalugg, Venusaur. Mind Spirit (breakpoints 1) carriers: Tapu Lele.

### Discovered: Froststone + Shock Spirit (stage 5)

Self-play training found fielding both Froststone and Shock Spirit together correlated with winning 65% of fights at stage 5 (103 real samples). No fixed core — any real carriers of both traits qualify. Froststone (breakpoints 2/4/6) carriers: Abomasnow, Mamoswine, Hisuian Avalugg, Froslass, Weavile. Shock Spirit (breakpoints 1) carriers: Tapu Koko.

### Discovered: Bruiser + Shock Spirit (stage 5)

Self-play training found fielding both Bruiser and Shock Spirit together correlated with winning 65% of fights at stage 5 (55 real samples). No fixed core — any real carriers of both traits qualify. Bruiser (breakpoints 2/4/6) carriers: Salamence, Tropius, Palossand, Hisuian Avalugg, Venusaur. Shock Spirit (breakpoints 1) carriers: Tapu Koko.

### Discovered: Earth Spirit + Soul Bonded (stage 5)

Self-play training found fielding both Earth Spirit and Soul Bonded together correlated with winning 65% of fights at stage 5 (42 real samples). No fixed core — any real carriers of both traits qualify. Earth Spirit (breakpoints 1) carriers: Tapu Bulu. Soul Bonded (breakpoints 1/2) carriers: Latios, Latias.

### Discovered: Mystic + Rogue (stage 5)

Self-play training found fielding both Mystic and Rogue together correlated with winning 65% of fights at stage 5 (99 real samples). No fixed core — any real carriers of both traits qualify. Mystic (breakpoints 2/4) carriers: Tapu Fini, Latios, Spiritomb, Abomasnow, Oranguru. Rogue (breakpoints 1) carriers: Salamence.

### Discovered: Keen Eye + Shock Spirit (stage 5)

Self-play training found fielding both Keen Eye and Shock Spirit together correlated with winning 65% of fights at stage 5 (93 real samples). No fixed core — any real carriers of both traits qualify. Keen Eye (breakpoints 2/4/6) carriers: Tapu Lele, Noivern, Fezandipiti, Celebi, Claydol. Shock Spirit (breakpoints 1) carriers: Tapu Koko.

### Discovered: Sky Striker + Substitutor (stage 5)

Self-play training found fielding both Sky Striker and Substitutor together correlated with winning 65% of fights at stage 5 (1675 real samples). No fixed core — any real carriers of both traits qualify. Sky Striker (breakpoints 2/4) carriers: Rayquaza, Noivern, Talonflame, Wailord, Pidgeotto. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Beachy + Substitutor (stage 3)

Self-play training found fielding both Beachy and Substitutor together correlated with winning 64% of fights at stage 3 (98 real samples). No fixed core — any real carriers of both traits qualify. Beachy (breakpoints 2/4/6) carriers: Tapu Fini, Blastoise, Palossand, Alolan Exeggutor, Alolan Raichu. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Mind Spirit + Stalwart (stage 5)

Self-play training found fielding both Mind Spirit and Stalwart together correlated with winning 64% of fights at stage 5 (96 real samples). No fixed core — any real carriers of both traits qualify. Mind Spirit (breakpoints 1) carriers: Tapu Lele. Stalwart (breakpoints 2/4/6) carriers: Latias, Wheezing, Mamoswine, Bellibolt, Torkoal.

### Discovered: Shock Spirit + Temporal Woods (stage 5)

Self-play training found fielding both Shock Spirit and Temporal Woods together correlated with winning 64% of fights at stage 5 (81 real samples). No fixed core — any real carriers of both traits qualify. Shock Spirit (breakpoints 1) carriers: Tapu Koko. Temporal Woods (breakpoints 2/4/6) carriers: Tapu Lele, Fezandipiti, Celebi, Oranguru, Morgrem.

### Discovered: Quickclaw + Substitutor (stage 4)

Self-play training found fielding both Quickclaw and Substitutor together correlated with winning 64% of fights at stage 4 (144 real samples). No fixed core — any real carriers of both traits qualify. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Shock Spirit + Substitutor (stage 5)

Self-play training found fielding both Shock Spirit and Substitutor together correlated with winning 64% of fights at stage 5 (216 real samples). No fixed core — any real carriers of both traits qualify. Shock Spirit (breakpoints 1) carriers: Tapu Koko. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Keen Eye + Soul Bonded (stage 5)

Self-play training found fielding both Keen Eye and Soul Bonded together correlated with winning 64% of fights at stage 5 (187 real samples). No fixed core — any real carriers of both traits qualify. Keen Eye (breakpoints 2/4/6) carriers: Tapu Lele, Noivern, Fezandipiti, Celebi, Claydol. Soul Bonded (breakpoints 1/2) carriers: Latios, Latias.

### Discovered: Ascender + Temporal Woods (stage 5)

Self-play training found fielding both Ascender and Temporal Woods together correlated with winning 64% of fights at stage 5 (182 real samples). No fixed core — any real carriers of both traits qualify. Ascender (breakpoints 2/4) carriers: Aerodactyl, Sneasler, Gogoat, Klawf. Temporal Woods (breakpoints 2/4/6) carriers: Tapu Lele, Fezandipiti, Celebi, Oranguru, Morgrem.

### Discovered: Corkscrew + Shock Spirit (stage 5)

Self-play training found fielding both Corkscrew and Shock Spirit together correlated with winning 64% of fights at stage 5 (42 real samples). No fixed core — any real carriers of both traits qualify. Corkscrew (breakpoints 2/3/4/5) carriers: Rayquaza, Barraskewda, Excadrill, Weavile, Kingler. Shock Spirit (breakpoints 1) carriers: Tapu Koko.

### Discovered: Froststone + Quickclaw (stage 4)

Self-play training found fielding both Froststone and Quickclaw together correlated with winning 63% of fights at stage 4 (38 real samples). No fixed core — any real carriers of both traits qualify. Froststone (breakpoints 2/4/6) carriers: Abomasnow, Mamoswine, Hisuian Avalugg, Froslass, Weavile. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto.

### Discovered: Froststone + Quickclaw (stage 2)

Self-play training found fielding both Froststone and Quickclaw together correlated with winning 63% of fights at stage 2 (97 real samples). No fixed core — any real carriers of both traits qualify. Froststone (breakpoints 2/4/6) carriers: Abomasnow, Mamoswine, Hisuian Avalugg, Froslass, Weavile. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto.

### Discovered: Mystic + River (stage 5)

Self-play training found fielding both Mystic and River together correlated with winning 63% of fights at stage 5 (219 real samples). No fixed core — any real carriers of both traits qualify. Mystic (breakpoints 2/4) carriers: Tapu Fini, Latios, Spiritomb, Abomasnow, Oranguru. River (breakpoints 2/3/4) carriers: Quagsire, Barraskewda, Bellibolt, Drednaw.

### Discovered: Shock Spirit + Stalwart (stage 5)

Self-play training found fielding both Shock Spirit and Stalwart together correlated with winning 63% of fights at stage 5 (87 real samples). No fixed core — any real carriers of both traits qualify. Shock Spirit (breakpoints 1) carriers: Tapu Koko. Stalwart (breakpoints 2/4/6) carriers: Latias, Wheezing, Mamoswine, Bellibolt, Torkoal.

### Discovered: Keen Eye + Rogue (stage 5)

Self-play training found fielding both Keen Eye and Rogue together correlated with winning 62% of fights at stage 5 (101 real samples). No fixed core — any real carriers of both traits qualify. Keen Eye (breakpoints 2/4/6) carriers: Tapu Lele, Noivern, Fezandipiti, Celebi, Claydol. Rogue (breakpoints 1) carriers: Salamence.

### Discovered: Corkscrew + Temporal Woods (stage 5)

Self-play training found fielding both Corkscrew and Temporal Woods together correlated with winning 62% of fights at stage 5 (432 real samples). No fixed core — any real carriers of both traits qualify. Corkscrew (breakpoints 2/3/4/5) carriers: Rayquaza, Barraskewda, Excadrill, Weavile, Kingler. Temporal Woods (breakpoints 2/4/6) carriers: Tapu Lele, Fezandipiti, Celebi, Oranguru, Morgrem.

### Discovered: Ascender + Substitutor (stage 4)

Self-play training found fielding both Ascender and Substitutor together correlated with winning 60% of fights at stage 4 (80 real samples). No fixed core — any real carriers of both traits qualify. Ascender (breakpoints 2/4) carriers: Aerodactyl, Sneasler, Gogoat, Klawf. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Quickclaw + Substitutor (stage 3)

Self-play training found fielding both Quickclaw and Substitutor together correlated with winning 60% of fights at stage 3 (102 real samples). No fixed core — any real carriers of both traits qualify. Quickclaw (breakpoints 2/3/4/5) carriers: Tapu Koko, Blastoise, Vigoroth, Armarouge, Pidgeotto. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Ascender + Substitutor (stage 5)

Self-play training found fielding both Ascender and Substitutor together correlated with winning 60% of fights at stage 5 (114 real samples). No fixed core — any real carriers of both traits qualify. Ascender (breakpoints 2/4) carriers: Aerodactyl, Sneasler, Gogoat, Klawf. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Beachy + Substitutor (stage 5)

Self-play training found fielding both Beachy and Substitutor together correlated with winning 58% of fights at stage 5 (264 real samples). No fixed core — any real carriers of both traits qualify. Beachy (breakpoints 2/4/6) carriers: Tapu Fini, Blastoise, Palossand, Alolan Exeggutor, Alolan Raichu. Substitutor (breakpoints 1/3/5) carriers: Tropius, Mamoswine, Ferrothorn, Xatu, Morgrem.

### Discovered: Froststone + Promoter (stage 3)

Self-play training found fielding both Froststone and Promoter together correlated with winning 58% of fights at stage 3 (45 real samples). No fixed core — any real carriers of both traits qualify. Froststone (breakpoints 2/4/6) carriers: Abomasnow, Mamoswine, Hisuian Avalugg, Froslass, Weavile. Promoter (breakpoints 2/4/6) carriers: Runerigus, Quagsire, Fezandipiti, Vikavolt, Gible.

### Discovered: Beachy + Keen Eye (stage 5)

Self-play training found fielding both Beachy and Keen Eye together correlated with winning 57% of fights at stage 5 (65 real samples). No fixed core — any real carriers of both traits qualify. Beachy (breakpoints 2/4/6) carriers: Tapu Fini, Blastoise, Palossand, Alolan Exeggutor, Alolan Raichu. Keen Eye (breakpoints 2/4/6) carriers: Tapu Lele, Noivern, Fezandipiti, Celebi, Claydol.
