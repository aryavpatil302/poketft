---
title: "Designing the Jungle Trait: Why Passive Healing Is Harder Than It Looks"
description: "Healing over time sounds gentle. In a combat system where fights last 30 seconds, it can be one of the strongest mechanics in the game."
date: 2025-04-15
tags: ["traits", "balance"]
---

Every auto-battler needs a sustain mechanic. In TFT it's the Bloodthirster item or the Vanguard frontline that survives everything. In Pokemon, the natural home for that fantasy is the forest — nature-type Pokemon that regenerate, drain, and outlast opponents.

That's the Jungle trait.

The concept is simple: Jungle units periodically heal a percentage of their max HP. But designing it well turned out to involve a lot of moving parts.

## The first version was broken

My initial implementation gave Jungle units a flat heal per second — something like 20 HP/sec at 2 units, scaling to 40 HP/sec at 4. It felt balanced on paper.

In testing, against a low-DPS frontline: the units were immortal. Against high burst damage: the healing was invisible. The trait was either the strongest thing in the game or irrelevant, depending entirely on the opponent's composition.

The problem is that flat healing doesn't interact well with a game where unit HP scales dramatically between star levels. A tier-1 Tangela healing 20 HP/sec is meaningful. A tier-3 Tangela with 3× the HP healing 20 HP/sec is a rounding error.

## Percentage-based healing

The fix was moving to a percentage of max HP. Now the healing scales with the unit — a tanky tier-3 front liner heals more than a squishy tier-1, which is the right direction.

But this introduced a new problem: Tangela specifically.

Tangela's ability is Leaf Guard — it grants a shield, and if any shield remains when the duration expires, it heals for a percentage of the remaining shield value. Combined with Jungle's passive healing, a well-positioned Tangela was essentially impossible to kill if you couldn't burst through the shield in time.

The interaction wasn't wrong exactly — shield plus healing is a classic tanking combination — but it required the burst threshold to be very high to matter, which made one-shot builds necessary to beat it. Not fun.

## Adding a healing cap

The solution was adding a per-tick healing cap based on the unit's missing HP rather than max HP. Instead of healing the same amount every tick regardless of HP, healing is most effective when the unit is low and tapers off as they approach full health.

This keeps Jungle relevant — a Tangela at 30% HP heals aggressively and can recover from dangerous situations. But a Tangela at 90% HP barely heals at all, so poking them down slowly over a long fight still works as a strategy.

## The current Jungle units

The trait currently runs at 2 or 4 units:

| Unit | Role | Cost |
|------|------|------|
| Tangela | Tank / sustain anchor | 1 |
| Ribombee | Ranged support | 1 |
| Venusaur | Mid-range drain | 2 |
| Vigoroth | Bruiser / dive | 3 |
| Vikavolt | Ranged control | 3 |
| Tropius | Frontline | 4 |
| Toucannon | Backline carry | 4 |
| Tapu Bulu | 5-cost carry | 5 |

The 2-unit threshold gives all Jungle units modest passive regeneration. The 4-unit threshold roughly doubles the healing and adds a small armor buff — enough to make pure Jungle a coherent win condition rather than a splash.

## What still needs work

The big open question is how Jungle performs into shield-break compositions. Some future traits will have mechanics that either destroy shields instantly or prevent healing outright. Without that counterplay, Jungle's late game at 6+ units could become oppressive.

I'm deferring that until more traits are in — it's hard to balance against a counter that doesn't exist yet. The current state is functional and internally consistent, which is good enough for now.

Next up: the **Roughneck** trait, which is the aggressive answer to Jungle's stall. More on that soon.
