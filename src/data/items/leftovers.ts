import type { ItemModule } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'
import { applyHeal } from '../../core/systems/heal'
import { TICK_RATE } from '../../core/constants'

// Leftovers: heal healPctPerSec of max HP every second, for the whole combat.
export const leftovers: ItemModule = {
  def: {
    id: 'leftovers',
    categories: ['tank'],
    name: 'Leftovers',
    description: '+400 HP. The holder heals 1% of their max health every second.',
    statBonus: { hp: 400 },
    iconPath: '/visuals/item icons/leftovers.png',
    effect: { healPctPerSec: 0.01 },   // max-HP fraction healed each second
  },
  passive(unit, _state, def) {
    if (unit.statusEffects.some(fx => fx.stackId === 'leftovers_heal')) return
    const healPctPerSec = def.effect?.healPctPerSec ?? 0.01
    addStatusEffect(unit, {
      id: 'leftovers_heal',
      sourceUnitId: unit.id,
      durationTicks: -1,
      stackId: 'leftovers_heal',
      tickInterval: TICK_RATE,
      tickEffect: (u, st) => {
        if (u.state === 'dead') return
        applyHeal(u, Math.round(u.maxHp * healPctPerSec), u.id, st)
      },
    })
  },
}
