import type { Unit, CombatState } from '../types'

export function applyHeal(unit: Unit, amount: number, sourceId: string, state: CombatState): number {
  if (unit.state === 'dead') return 0
  const healBlock = unit.statusEffects.find(fx => fx.id === 'healBlock')
  const effective = healBlock ? Math.round(amount * (1 - (healBlock.magnitude ?? 0.33))) : amount
  const actual = Math.min(effective, unit.maxHp - unit.currentHp)
  unit.currentHp += actual
  if (actual > 0) state.events.push({ type: 'heal', targetId: unit.id, amount: actual, sourceId })
  return actual
}
