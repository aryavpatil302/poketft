import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'
import { findNearestEnemies } from '../systems/targeting'

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
    const MANA_DRAIN = 2   // mana pulled from the target and given to Fini each whirlpool pulse

    const castWhirlpoolOn = (target: Unit, force = false) => {
      if (target.whirlpooled && !force) return

      if (!target.whirlpooled) target.whirlpooled = true

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

          // At 0 def AND 0 spDef, spell damage gets a 33% bonus
          const atZero = tgt.defense <= 0 && tgt.spDefense <= 0
          const effectiveDmg = atZero ? Math.round(dmg * 1.33) : dmg

          const result = applyDamage(fini, tgt, {
            baseAmount:        effectiveDmg,
            damageType:        'magic',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'tapufini_natures_madness',
          }, st)

          if (result.finalDamage > 0 && healPct > 0) {
            applyHeal(fini, Math.round(result.finalDamage * healPct), finiId, st)
          }

          // Drain mana from the target each pulse and hand it to Tapu Fini
          const drained = Math.min(MANA_DRAIN, tgt.currentMana)
          if (drained > 0) {
            tgt.currentMana  -= drained
            fini.currentMana  = Math.min(fini.maxMana, fini.currentMana + drained)
          }
        },
        onExpire: (tgt) => {
          tgt.whirlpooled = false
        },
      })
    }

    // Sort: attack target first, then non-whirlpooled, then whirlpooled
    const attackTargetId = unit.targetId
    const enemies = [...state.units.values()]
      .filter(u => u.team !== unit.team && u.state !== 'dead')
      .sort((a, b) => {
        if (a.id === attackTargetId && b.id !== attackTargetId) return -1
        if (b.id === attackTargetId && a.id !== attackTargetId) return 1
        return Number(a.whirlpooled) - Number(b.whirlpooled)
      })

    const baseCounts = [1, 1, 10] as const
    const spawnCount = baseCounts[tier - 1]
    for (const target of enemies.slice(0, spawnCount)) {
      castWhirlpoolOn(target)
    }

    // Misty terrain: after a 10-tick delay, cast a second whirlpool on the next nearest enemy
    if (state.terrain.misty) {
      addStatusEffect(unit, {
        id: 'tapufini_misty_second_cast',
        sourceUnitId: unit.id,
        durationTicks: 10,
        stackId: 'tapufini_misty_second_cast',
        onExpire: (fini, st) => {
          if (fini.state === 'dead') return
          // Prefer a non-whirlpooled enemy; fall back to nearest enemy if all are whirlpooled
          const next = findNearestEnemies(fini, st, st.units.size)
            .find(u => !u.whirlpooled) ?? findNearestEnemies(fini, st, 1)[0]
          if (next) castWhirlpoolOn(next, /* force */ true)
        },
      })
    }

    incrementSpellBuff(unit, state)
  },
}
