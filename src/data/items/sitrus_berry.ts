import type { ItemModule } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'
import { applyHeal } from '../../core/systems/heal'

// Sitrus Berry: the first time the holder drops below thresholdPct HP, heal
// healPct of max HP. Once per combat — a per-tick monitor that fires a single time.
export const sitrusBerry: ItemModule = {
  def: {
    id: 'sitrus_berry',
    categories: ['tank'],
    name: 'Sitrus Berry',
    description: '+200 HP, +20 Defense, +20 Sp. Defense. The first time the holder drops below 50% health, heal 25% of their max health (once per combat).',
    statBonus: { hp: 200, defense: 20, spDefense: 20 },
    iconPath: '/visuals/item icons/sitrus_berry.webp',
    effect: { thresholdPct: 0.50, healPct: 0.25 },   // HP% trigger, heal as fraction of max HP
  },
  passive(unit, _state, def) {
    if (unit.statusEffects.some(fx => fx.stackId === 'sitrus_monitor')) return
    const threshold = def.effect?.thresholdPct ?? 0.50
    const healPct = def.effect?.healPct ?? 0.25
    let fired = false
    addStatusEffect(unit, {
      id: 'sitrus_monitor',
      sourceUnitId: unit.id,
      durationTicks: -1,
      stackId: 'sitrus_monitor',
      tickEffect: (u, st) => {
        if (fired || u.state === 'dead') return
        if (u.maxHp > 0 && u.currentHp / u.maxHp < threshold) {
          fired = true
          applyHeal(u, Math.round(u.maxHp * healPct), u.id, st)
        }
      },
    })
  },
}
