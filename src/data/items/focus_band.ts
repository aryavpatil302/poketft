import type { ItemModule, Unit, CombatState } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'

// Focus Band: the lower the holder's health, the stronger its stat bonus — from
// the flat +base (via statBonus) at full HP up to +max at/below floorPct HP.
// A monitor status recomputes each tick and drives three flat-buff statuses
// (dmg_buff / armorBuff / spDefBuff) with the SCALING portion (max − base); the
// flat base itself comes from statBonus. Only re-applies (nulling the stat cache)
// when the scaled value actually changes.
export const focusBand: ItemModule = {
  def: {
    id: 'focus_band',
    categories: ['attack fighter', 'special fighter'],
    name: 'Focus Band',
    description: '+5 Attack, +5 Defense, +5 Sp. Defense. The lower the holder\'s health, the stronger these bonuses — up to +20 each at 25% health or below.',
    statBonus: { attack: 5, defense: 5, spDefense: 5 },
    iconPath: '/visuals/item icons/focus_band.webp',
    effect: { base: 5, max: 20, floorPct: 0.25 },
  },
  passive(unit, _state, def) {
    if (unit.statusEffects.some(fx => fx.stackId === 'focus_band_monitor')) return
    const base    = def.effect?.base ?? 5
    const max     = def.effect?.max ?? 20
    const floor   = def.effect?.floorPct ?? 0.25
    const span    = Math.max(0, max - base)   // extra granted on top of the flat base
    let lastExtra = -1
    addStatusEffect(unit, {
      id: 'focus_band_monitor',
      sourceUnitId: unit.id,
      durationTicks: -1,
      stackId: 'focus_band_monitor',
      tickEffect: (u: Unit, _st: CombatState) => {
        if (u.state === 'dead' || u.maxHp <= 0) return
        const hpFrac = u.currentHp / u.maxHp
        // 0 at full HP → 1 at/below the floor.
        const t = Math.max(0, Math.min(1, (1 - hpFrac) / (1 - floor)))
        const extra = Math.round(t * span)
        if (extra === lastExtra) return
        lastExtra = extra
        for (const [id, stack] of [['dmg_buff', 'focus_band_atk'], ['armorBuff', 'focus_band_def'], ['spDefBuff', 'focus_band_spdef']] as const) {
          addStatusEffect(u, { id, sourceUnitId: u.id, durationTicks: -1, magnitude: extra, stackId: stack })
        }
      },
    })
  },
}
