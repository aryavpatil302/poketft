import type { ItemModule } from '../../core/types'

// Scaffold items: the single-component raw stats and the classic combined items.
// These have no icon and no wired-up passive yet — they exist for a future
// component/combine system. Kept together here (rather than one file each) since
// they carry no implementation. Give any of them its own module file once it
// gains a real passive.
export const SCAFFOLD_ITEMS: ItemModule[] = [
  // ── Single-component, pure stat ──────────────────────────────────────────
  { def: { id: 'bf_sword',             name: 'B.F. Sword',            description: '+20 Attack Damage',   statBonus: { attack: 20 } } },
  { def: { id: 'recurve_bow',          name: 'Recurve Bow',           description: '+15% Attack Speed',   statBonus: { attackSpeed: 0.15 } } },
  { def: { id: 'needlessly_large_rod', name: 'Needlessly Large Rod',  description: '+20 Special Attack',  statBonus: { special: 20 } } },
  { def: { id: 'chain_vest',           name: 'Chain Vest',            description: '+20 Defense',         statBonus: { defense: 20 } } },
  { def: { id: 'negatron_cloak',       name: 'Negatron Cloak',        description: '+20 Sp. Defense',     statBonus: { spDefense: 20 } } },
  { def: { id: 'giants_belt',          name: "Giant's Belt",          description: '+200 HP',             statBonus: { hp: 200 } } },
  { def: { id: 'tear_of_the_goddess',  name: 'Tear of the Goddess',   description: '+20 Starting Mana',   statBonus: { startMana: 20 } } },

  // ── Combined items (passives not yet implemented) ────────────────────────
  { def: { id: 'infinity_edge', name: 'Infinity Edge', description: '+35 Attack, +20% Crit Chance, +15% Crit Damage. Crits deal bonus true damage equal to 10% of missing HP.', statBonus: { attack: 35, critChance: 0.20, critDamage: 0.15 } } },
  { def: { id: 'rageblade',     name: 'Rageblade',     description: '+20% Attack Speed. On auto-attack hit, gain 8% Attack Speed until end of combat (stacks infinitely).',      statBonus: { attackSpeed: 0.20 } } },
  { def: { id: 'bramble_vest',  name: 'Bramble Vest',  description: '+40 Defense. On taking physical damage, deal 80 magic damage to the attacker.',                             statBonus: { defense: 40 } } },
  { def: { id: 'warmogs_armor', name: "Warmog's Armor", description: '+500 HP. Regenerate 3% of max HP per second.',                                                              statBonus: { hp: 500 } } },
]
