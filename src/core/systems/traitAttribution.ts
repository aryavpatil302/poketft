// ─── Trait contribution attribution ──────────────────────────────────────────
// These maps let combat measure how much each TRAIT added to a unit's damage,
// healing and shielding — e.g. "how much did Volcano's adaptive force amp this
// unit's damage", "how much did Jungle increase its heal/shield". The attribution
// happens where the effect is applied (computeStats tallies per-trait stat deltas;
// applyDamage/applyHeal/addShield turn those into damage/heal/shield contributions).
//
// The model is an ESTIMATE that partitions each output by the *marginal* effect of
// the trait: a stat-buff trait gets its share of the scaling stat, an amp trait gets
// the portion its multiplier added, a heal/shield-power trait gets the amplified
// portion, and direct trait damage is attributed in full. It is exact for
// linearly-stat-scaling hits and for heal/shield amplification; approximate when a
// hit mixes flat and scaled components.

// Stat-buff status-effect id → the trait that granted it. These modify attack /
// special (→ damage) or healShieldPower (→ heal & shield). computeStats tallies each
// one's per-trait delta onto unit._traitStat, keyed by the granting trait.
export const STAT_EFFECT_TRAIT: Record<string, string> = {
  volcano_adaptive:     'volcanic',
  volcano_adaptive_sun: 'volcanic',
  sky_striker_adaptive: 'sky_striker',
  spellweaver_adaptive: 'spellweaver',
  atk_buff_pct:         'soul_bonded',
  sp_buff_pct:          'soul_bonded',
  soul_bonded_apex:     'soul_bonded',
  jungle_healshield_bonus: 'jungle',
  aqua_ring_durability: 'river',   // River durability buff → damage reduced
  roughneck_atk:        'roughneck',   // Roughneck +Attack (routed through a status) → damage
  stalwart_def:         'stalwart',    // Stalwart +Def/SpDef breakpoints → damage reduced
  mystic_durability:    'mystic',      // Mystic stolen team durability → damage reduced
}

// Some effect ids are shared by multiple traits (e.g. `omnivamp_buff`, `armorBuff`,
// `spDefBuff`) — resolve those by the effect's STACK id, checked before the id map.
export const STACK_EFFECT_TRAIT: Record<string, string> = {
  aqua_ring_omnivamp:  'river',       // River aqua-ring omnivamp → healing
  roughneck_omnivamp:  'roughneck',   // Roughneck omnivamp → healing
  soul_bonded_def:     'soul_bonded', // Soul Bonded team +Def → damage reduced
  soul_bonded_spdef:   'soul_bonded',
}
// stackId prefixes (some stacks are per-source, e.g. `ascender_armor_<id>`).
export const STACK_PREFIX_TRAIT: Array<[string, string]> = [
  ['ascender_armor_', 'ascender'],
  ['ascender_spdef_', 'ascender'],
]

// Attack-speed buff stacks → the trait, for the "extra autos enabled" estimate.
export const AS_STACK_TRAIT: Record<string, string> = {
  quickclaw_atkspd:   'quickclaw',
  promoter_atkspd:    'promoter',
  electric_terrain_as: 'shock_spirit',
}
// Sky Striker tailwind (id-based, no distinguishing stack needed).
export const AS_EFFECT_TRAIT: Record<string, string> = {
  sky_striker_tailwind:   'sky_striker',
  sky_striker_kill_boost: 'sky_striker',
}

// Resolve the trait that granted an effect, preferring stackId over effect id.
export function traitOfEffect(id: string, stackId?: string): string | undefined {
  if (stackId) {
    if (STACK_EFFECT_TRAIT[stackId]) return STACK_EFFECT_TRAIT[stackId]
    for (const [p, t] of STACK_PREFIX_TRAIT) if (stackId.startsWith(p)) return t
  }
  return STAT_EFFECT_TRAIT[id]
}
// Resolve the attack-speed trait for an AS buff (by id then stackId).
export function asTraitOf(id: string, stackId?: string): string | undefined {
  return AS_EFFECT_TRAIT[id] ?? (stackId ? AS_STACK_TRAIT[stackId] : undefined)
}

// Multiplicative outgoing-damage amp → the trait behind it (attributed as the
// portion of the hit the amp added). `damage_amp` is Crashout's team/rage amp;
// `roughneck_bonus_dmg` is Roughneck's execute-range bonus.
export const AMP_EFFECT_TRAIT: Record<string, string> = {
  damage_amp:          'crashout',
  roughneck_bonus_dmg: 'roughneck',
}

// A which-stat each stat-effect feeds, so computeStats can credit the right pool
// ('atk' and 'sp' drive damage; 'hsp' drives heal/shield). Adaptive effects choose
// atk-vs-sp at runtime (whichever is higher), so they are NOT listed here — the
// computeStats cases credit them directly.
export const STAT_EFFECT_POOL: Record<string, 'atk' | 'sp' | 'hsp'> = {
  atk_buff_pct: 'atk',
  sp_buff_pct: 'sp',
  soul_bonded_apex: 'sp',
  jungle_healshield_bonus: 'hsp',
}

// Empty per-trait damage/heal/shield accumulator (one per unit; reset each combat).
export type TraitTally = Record<string, number>
