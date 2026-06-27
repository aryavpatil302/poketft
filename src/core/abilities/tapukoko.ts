import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, AttackModifier } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'
import { isTerrainActive, setTerrain } from '../systems/terrain'

const CHAIN_ID = 'tapukoko_chain'

function fireChainLightning(
  source: Unit,
  firstTarget: Unit,
  state: CombatState,
  targetCount: number,
  chainDmg: number,
  stun: boolean,
): void {
  const targets = findNearestEnemies(source, state, targetCount)
  for (const t of targets) {
    applyDamage(source, t, { baseAmount: chainDmg, damageType: 'magic', canCrit: false, abilityId: 'tapukoko_electric_surge' }, state)
    if (stun && t.state !== 'dead') {
      addStatusEffect(t, {
        id: 'stun',
        sourceUnitId: source.id,
        durationTicks: 30,
        stackId: `tapukoko_stun_${t.id}`,
        onExpire: (u) => { if (u.state === 'stunned') u.state = 'idle' },
      })
    }
  }

  // Electric terrain: +5% attack speed permanently per chain
  if (isTerrainActive(state, 'electric')) {
    addStatusEffect(source, {
      id: 'atkSpd_buff',
      sourceUnitId: source.id,
      durationTicks: -1,
      magnitude: 0.05,
      stackId: `tapukoko_spd_${state.tick}`,
    })
  }
}

export const TapuKokoAbility: AbilityHandler = {
  abilityId: 'tapukoko_electric_surge',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const chainTargets = [4, 5, 6] as const
    const chainDamages = [150, 225, 375] as const

    const numTargets = chainTargets[tier - 1]
    const chainDmg   = chainDamages[tier - 1]

    // Ability: empower next auto with chain lightning + stun
    const mod: AttackModifier = {
      id: 'tapukoko_surge',
      remainingCharges: 1,
      bonusDamage: 0,
      onHit: (src, tgt, st) => {
        fireChainLightning(src, tgt, st, numTargets, chainDmg, true)
      },
    }
    unit.attackModifiers.unshift(mod)  // front of queue — fires on next attack

    // Passive: every 3rd auto fires chain without stun
    const existingPassive = unit.passiveAttackHandlers.find(h => h.id === CHAIN_ID)
    if (!existingPassive) {
      const handler: PassiveAttackHandler = {
        id: CHAIN_ID,
        onAttack: (src, tgt, st) => {
          if (src.attackCount % 3 === 0) {
            fireChainLightning(src, tgt, st, numTargets, chainDmg, false)
          }
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }

    setTerrain(state, 'electric', true)
  },
}
