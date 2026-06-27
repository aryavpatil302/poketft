import type { Unit, UnitMark, CombatState } from '../types'

export function addMark(unit: Unit, mark: UnitMark): void {
  const existing = unit.marks.findIndex(m => m.id === mark.id)
  if (existing >= 0) {
    unit.marks[existing] = { ...mark }
  } else {
    unit.marks.push({ ...mark })
  }
}

export function removeMark(unit: Unit, markId: string): void {
  unit.marks = unit.marks.filter(m => m.id !== markId)
}

export function hasMark(unit: Unit, markId: string): boolean {
  return unit.marks.some(m => m.id === markId)
}

export function tickMarks(units: Map<string, Unit>, state: CombatState): void {
  for (const unit of units.values()) {
    if (unit.state === 'dead' || unit.marks.length === 0) continue

    const toRemove: string[] = []
    for (const mark of unit.marks) {
      if (mark.durationTicks === -1) continue
      mark.durationTicks--
      if (mark.durationTicks <= 0) {
        toRemove.push(mark.id)
        if (mark.onDetonate) {
          const source = state.units.get(mark.sourceUnitId)
          mark.onDetonate(unit, source, state)
        }
      }
    }
    if (toRemove.length > 0) {
      unit.marks = unit.marks.filter(m => !toRemove.includes(m.id))
    }
  }
}
