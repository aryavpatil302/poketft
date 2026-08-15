// Hand-authored item preferences per unit — the SOLE source of bot item
// choice (see botItems.ts's chooseBotItem/equipBotItems). There is no
// training or learning here: this is a direct reference you maintain
// yourself, e.g. because Blastoise's ability makes Metronome unusually
// strong in a way no stat formula would infer on its own.
//
// For each unit:
//   preferred — an open list of item ids this unit likes. When the unit needs
//               an item and has no `best` available, one is chosen at RANDOM
//               from whichever of these are actually on offer that round.
//   best      — the single item this unit wants above all others, taken on
//               sight whenever it's offered (e.g. Blastoise + Metronome).
//               Leave as `null` if this unit has no standout best-in-slot —
//               not every unit needs one; it'll just use `preferred`.
//
// If BOTH `preferred` is empty AND `best` is null, the unit falls back to the
// old stat-based heuristic (itemFitScore in botItems.ts) so an unconfigured
// unit still gets something sensible instead of nothing.
//
// ─── Valid item ids (use these exact strings) ─────────────────────────────
//   assault_vest   Assault Vest
//   charcoal       Charcoal
//   covert_cloak   Covert Cloak
//   expert_belt    Expert Belt
//   flame_orb      Flame Orb
//   focus_band     Focus Band
//   leek           Leek
//   leftovers      Leftovers
//   life_orb       Life Orb
//   metronome      Metronome
//   razor_claw     Razor Claw
//   rocky_helmet   Rocky Helmet
//   sitrus_berry   Sitrus Berry
//   spell_tag      Spell Tag
//   twisted_spoon  Twisted Spoon

export interface UnitItemPreference {
  preferred: string[]
  best: string | null
}

export const PREFERRED_ITEMS: Record<string, UnitItemPreference> = {
  a_exeggutor:  { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  a_marowak:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  a_raichu:     { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  abomasnow:    { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  absol:        { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  aerodactyl:   { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','metronome','covert_cloak'], best: 'metronome' },
  armarouge:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw', 'metronome', 'spell_tag'], best: 'metronome' },
  barraskewda:  { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  bellibolt:    { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  blastoise:    { preferred: ['twisted_spoon', 'leek', 'metronome'], best: 'metronome' },
  celebi:       { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  charizard:    { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  claydol:      { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  darmanitan:   { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  drednaw:      { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  druddigon:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  excadrill:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  ferrothorn:   { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  fezandipiti:  { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  froslass:     { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: 'null' },
  gible:        { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw', 'spell_tag','covert_cloak'], best: null },
  gogoat:       { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  graveler:     { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  h_avalugg:    { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  kingler:      { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  klawf:        { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  latias:       { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry', 'charcoal'], best: null },
  latios:       { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  mamoswine:    { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  morelull:     { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  morgrem:      { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  noivern:      { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  oranguru:     { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal','metronome'], best: 'metronome' },
  palossand:    { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  pidgeotto:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  quagsire:     { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  rayquaza:     { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw'], best: null },
  ribombee:     { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  runerigus:    { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  sableye:      { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  salamence:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw', 'metronome','covert_cloak'], best: null },
  sneasler:     { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  snorunt:      { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  spiritomb:    { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry', 'charcoal', 'twisted_spoon'], best: null },
  stonjourner:  { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  talonflame:   { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  tangela:      { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  tapu_bulu:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  tapu_fini:    { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  tapu_koko:    { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal', 'metronome'], best: 'metronome' },
  tapu_lele:    { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  torkoal:      { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  toucannon:    { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw', 'spell_tag'], best: null },
  tropius:      { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  typhlosion:   { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw', 'spell_tag'], best: null },
  unown:        { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  venusaur:     { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  vigoroth:     { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','metronome','covert_cloak'], best: null },
  vikavolt:     { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
  wailord:      { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  weavile:      { preferred: ['expert_belt', 'flame_orb', 'focus_band', 'razor_claw','covert_cloak'], best: null },
  wheezing:     { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  xatu:         { preferred: ['assault_vest', 'leftovers', 'rocky_helmet', 'sitrus_berry'], best: null },
  zubat:        { preferred: ['leek','life_orb','spell_tag','twisted_spoon','charcoal'], best: null },
}
