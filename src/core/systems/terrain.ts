import type { CombatState, TerrainState } from '../types'

export function setTerrain(state: CombatState, type: keyof TerrainState, active: boolean): void {
  state.terrain[type] = active
}

export function isTerrainActive(state: CombatState, type: keyof TerrainState): boolean {
  return state.terrain[type]
}

// Maps tapu unit definition IDs to the terrain they set.
const TAPU_TERRAIN: Record<string, keyof TerrainState> = {
  tapu_bulu: 'grassy',
  tapu_fini: 'misty',
  tapu_lele: 'psychic',
  tapu_koko: 'electric',
}

// Determine the active terrain at combat start by finding the "strongest" player-team tapu:
//   1. Highest star tier
//   2. Then most equipped items
//   3. Then most recently placed (last in Map insertion order)
export function initTerrainFromTapus(state: CombatState): void {
  // Build insertion-order index so we can use it as a tiebreak
  const insertionIdx = new Map<string, number>()
  let idx = 0
  for (const u of state.units.values()) insertionIdx.set(u.id, idx++)

  const tapus = [...state.units.values()].filter(
    u => u.team === 'player' && !u.isDummy && TAPU_TERRAIN[u.definitionId] !== undefined
  )
  if (tapus.length === 0) return

  tapus.sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier
    if (b.items.length !== a.items.length) return b.items.length - a.items.length
    return (insertionIdx.get(b.id) ?? 0) - (insertionIdx.get(a.id) ?? 0)
  })

  const terrain = TAPU_TERRAIN[tapus[0].definitionId]
  if (terrain) setTerrain(state, terrain, true)
}

// Returns the hex border pulse color for the currently active terrain (null = no pulse).
export function activeTerrainPulseColor(terrain: TerrainState): string | null {
  if (terrain.grassy)   return '#80EF80'
  if (terrain.misty)    return '#80C8FF'
  if (terrain.psychic)  return '#C880FF'
  if (terrain.electric) return '#F5D94E'
  if (terrain.sunny)   return null  // sunny uses orange board tint instead
  return null
}

// Returns a display label for the active terrain (null if none).
export function activeTerrainLabel(terrain: TerrainState): string | null {
  if (terrain.grassy)   return 'Grassy Terrain'
  if (terrain.misty)    return 'Misty Terrain'
  if (terrain.psychic)  return 'Psychic Terrain'
  if (terrain.electric) return 'Electric Terrain'
  return null
}
