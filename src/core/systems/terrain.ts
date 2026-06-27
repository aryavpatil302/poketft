import type { CombatState, TerrainState } from '../types'

export function setTerrain(state: CombatState, type: keyof TerrainState, active: boolean): void {
  state.terrain[type] = active
}

export function isTerrainActive(state: CombatState, type: keyof TerrainState): boolean {
  return state.terrain[type]
}
