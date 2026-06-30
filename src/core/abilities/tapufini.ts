import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'

export const TapuFiniAbility: AbilityHandler = {
  abilityId: 'tapufini_natures_madness',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages      = [100, 150, 5000] as const
    const healPcts     = [0.33, 0.33, 0.85] as const
    const reductionPct = [0.02, 0.03, 0.20] as const
    const DURATION     = 10 * TICK_RATE

    const dmg       = damages[tier - 1]
    const healPct   = healPcts[tier - 1]
    const spellBuff = getSpellBuff(unit, state)
    const shredPct  = reductionPct[tier - 1] + spellBuff * 0.01
    const finiId    = unit.id

    const castWhirlpoolOn = (target: Unit) => {
      if (target.whirlpooled) return

      target.whirlpooled = true

      state.events.push({ type: 'vfx', effectId: 'tapufini_whirlpool', x: target.visualPos.x, y: target.visualPos.y, unitId: target.id, sourceId: unit.id })

      const baseDefense   = target.defense
      const baseSpDefense = target.spDefense
      const armorPerTick  = Math.round(baseDefense   * shredPct)
      const spDefPerTick  = Math.round(baseSpDefense * shredPct)
      addStatusEffect(target, {
        id: 'whirlpool_damage',
        sourceUnitId: finiId,
        durationTicks: DURATION,
        stackId: `whirlpool_dmg_${target.id}`,
        tickInterval: TICK_RATE,
        tickEffect: (tgt, st) => {
          if (tgt.state === 'dead') return
          const fini = st.units.get(finiId)
          if (!fini || fini.state === 'dead') return

          tgt.defense   = Math.max(0, tgt.defense   - armorPerTick)
          tgt.spDefense = Math.max(0, tgt.spDefense - spDefPerTick)
          tgt._computedStats = null

          const result = applyDamage(fini, tgt, {
            baseAmount: dmg,
            damageType: 'magic',
            canCrit: false,
            abilityId: 'tapufini_natures_madness',
          }, st)

          if (result.finalDamage > 0 && healPct > 0) {
            const healAmt = Math.round(result.finalDamage * healPct)
            fini.currentHp = Math.min(fini.maxHp, fini.currentHp + healAmt)
            st.events.push({ type: 'heal', targetId: finiId, amount: healAmt, sourceId: finiId })
          }
        },
        onExpire: (tgt) => {
          tgt.whirlpooled = false
        },
      })
    }

    const enemies = [...state.units.values()].filter(u => u.team !== unit.team && u.state !== 'dead')

    if (tier === 3) {
      // 3★ — whirlpool every enemy at once
      for (const enemy of enemies) {
        castWhirlpoolOn(enemy)
      }
    } else {
      // 1★/2★ — prefer current attack target, fall back to first non-whirlpooled enemy
      const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
      const target = (attackTarget && !attackTarget.whirlpooled && attackTarget.state !== 'dead')
        ? attackTarget
        : (enemies.find(u => !u.whirlpooled) ?? enemies[0])
      if (target) castWhirlpoolOn(target)
    }

    incrementSpellBuff(unit, state)
  },
}
