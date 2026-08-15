// Item registry — aggregates the per-item modules (def + passive) in this
// directory into the public surface the rest of the app uses: ALL_ITEMS,
// ITEM_MAP, and initItemPassives. Add a new item by dropping a `<item>.ts`
// module here and listing it in ITEM_MODULES below.

import type { CombatState, ItemDefinition, ItemModule, ItemPassive } from '../../core/types'

import { metronome } from './metronome'
import { sitrusBerry } from './sitrus_berry'
import { assaultVest } from './assault_vest'
import { rockyHelmet } from './rocky_helmet'
import { leftovers } from './leftovers'
import { spellTag } from './spell_tag'
import { charcoal } from './charcoal'
import { flameOrb } from './flame_orb'
import { leek } from './leek'
import { razorClaw } from './razor_claw'
import { covertCloak } from './covert_cloak'
import { expertBelt } from './expert_belt'
import { twistedSpoon } from './twisted_spoon'
import { focusBand } from './focus_band'
import { lifeOrb } from './life_orb'
import { SCAFFOLD_ITEMS } from './scaffold'

const ITEM_MODULES: ItemModule[] = [
  metronome, sitrusBerry, assaultVest, rockyHelmet, leftovers, spellTag,
  charcoal, flameOrb, leek, razorClaw,
  covertCloak, expertBelt, twistedSpoon, focusBand, lifeOrb,
  ...SCAFFOLD_ITEMS,
]

export const ALL_ITEMS: ItemDefinition[] = ITEM_MODULES.map(m => m.def)

export const ITEM_MAP: Map<string, ItemDefinition> = new Map(
  ALL_ITEMS.map(i => [i.id, i]),
)

// itemId → passive, for items that register combat hooks on their holder.
const ITEM_PASSIVES: Map<string, ItemPassive> = new Map(
  ITEM_MODULES.filter(m => m.passive).map(m => [m.def.id, m.passive!]),
)

// Register every equipped item's passive on every unit at combat start.
export function initItemPassives(state: CombatState): void {
  for (const unit of state.units.values()) {
    for (const itemId of unit.items) {
      const def = ITEM_MAP.get(itemId)
      const passive = ITEM_PASSIVES.get(itemId)
      if (def && passive) passive(unit, state, def)
    }
  }
}
