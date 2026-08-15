import type { ItemModule, Unit } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'
import { TICK_RATE } from '../../core/constants'

// Assault Vest: after each cast, gain +durabilityPct Defense and Sp. Defense for
// durationSec seconds. The buff is a refreshable status; computeStats reads
// 'assault_vest_buff' magnitude.
export const assaultVest: ItemModule = {
  def: {
    id: 'assault_vest',
    categories: ['tank'],
    name: 'Assault Vest',
    description: '+100 HP, +35 Sp. Defense. After the holder casts, gain +30% Defense and Sp. Defense for 4 seconds.',
    statBonus: { hp: 100, spDefense: 35 },
    iconPath: '/visuals/item icons/assault_vest.png',
    effect: { durabilityPct: 0.30, durationSec: 4 },   // post-cast def/spDef buff and its duration
  },
  passive(unit, _state, def) {
    if (unit.passiveCastHandlers.some(h => h.id === 'assault_vest')) return
    const durabilityPct = def.effect?.durabilityPct ?? 0.30
    const durationTicks = Math.round((def.effect?.durationSec ?? 4) * TICK_RATE)
    unit.passiveCastHandlers.push({
      id: 'assault_vest',
      onCast(): void {},
      afterCast(u: Unit): void {
        addStatusEffect(u, {
          id: 'assault_vest_buff',
          sourceUnitId: u.id,
          durationTicks,
          magnitude: durabilityPct,
          stackId: 'assault_vest_buff',
        })
      },
    })
  },
}
