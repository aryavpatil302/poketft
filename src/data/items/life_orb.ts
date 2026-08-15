import type { ItemModule, Unit } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'
import { TICK_RATE } from '../../core/constants'

// Life Orb: the holder's ability casts deal more damage (via the abilityDamageMult
// flag, honored in damage.ts) but each cast costs a chunk of the holder's own max
// HP (recoil, floored so it can't self-kill). Also grants steady mana regen.
export const lifeOrb: ItemModule = {
  def: {
    id: 'life_orb',
    categories: ['attack caster', 'special caster'],
    name: 'Life Orb',
    description: '+10 Adaptive Force, +1 Mana Regen. The holder\'s ability casts deal 33% more damage, but each cast costs 10% of the holder\'s max health.',
    statBonus: {},
    adaptiveForce: 10,
    iconPath: '/visuals/item icons/life_orb.webp',
    effect: { abilityDmgMult: 1.33, recoilPct: 0.10, manaRegen: 1 },
  },
  passive(unit, _state, def) {
    // Ability-damage amp (read in the damage pipeline).
    unit.abilityDamageMult = def.effect?.abilityDmgMult ?? 1.33

    // Mana regen — +manaRegen per second for the whole combat.
    const manaRegen = def.effect?.manaRegen ?? 1
    if (manaRegen > 0 && !unit.statusEffects.some(fx => fx.stackId === 'life_orb_regen')) {
      addStatusEffect(unit, {
        id: 'life_orb_regen',
        sourceUnitId: unit.id,
        durationTicks: -1,
        stackId: 'life_orb_regen',
        tickInterval: TICK_RATE,
        tickEffect: (u) => {
          if (u.state === 'dead' || u.maxMana === 0) return
          u.currentMana = Math.min(u.maxMana, u.currentMana + manaRegen)
        },
      })
    }

    // Recoil — each cast costs recoilPct of max HP (never lethal: floored at 1).
    if (unit.passiveCastHandlers.some(h => h.id === 'life_orb')) return
    const recoilPct = def.effect?.recoilPct ?? 0.10
    unit.passiveCastHandlers.push({
      id: 'life_orb',
      onCast(): void {},
      afterCast(u: Unit, st): void {
        const cost = Math.round(u.maxHp * recoilPct)
        const newHp = Math.max(1, u.currentHp - cost)
        const dealt = u.currentHp - newHp
        if (dealt <= 0) return
        u.currentHp = newHp
        st.events.push({ type: 'damage', targetId: u.id, amount: dealt, damageType: 'true', isCrit: false, sourceId: u.id, abilityId: 'life_orb' })
      },
    })
  },
}
