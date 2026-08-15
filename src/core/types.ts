import type { OffsetCoord } from './hexGrid'

// ─── Coordinates ─────────────────────────────────────────────────────────────

export type HexId = string  // `${col},${row}`

// ─── Static game data ─────────────────────────────────────────────────────────

export interface UnitBaseStats {
  hp: number
  startMana: number
  maxMana: number
  attack: number
  special: number
  defense: number
  spDefense: number
  attackSpeed: number   // attacks per second (e.g. 0.75)
  critChance: number    // fraction (0.25 = 25%)
  critDamage: number    // multiplier (1.40 = 140%)
  range: number         // 1 = melee, >1 = ranged hex distance
}

export interface AbilityScaling {
  [key: string]: [number, number, number]  // [1-star, 2-star, 3-star]
}

export interface AbilityDefinition {
  id: string
  name: string
  description: string
  scaling: AbilityScaling
}

export type UnitRole = 'tank' | 'attack caster' | 'attack marksman' | 'attack fighter' | 'special caster' | 'special marksman'

export interface UnitDefinition {
  id: string
  name: string
  cost: number          // 1–5
  types: string[]       // lowercase type IDs
  role?: UnitRole       // combat role — omitted on dummies
  baseStats: UnitBaseStats
  ability?: AbilityDefinition   // optional — dummies and special units may have none
  spritePath: string
  spriteScale?: number  // multiplier on top of default SPRITE_HALF (default 1.0)
  isDummy?: boolean     // stationary, non-attacking target dummy for testing
}

// Item archetype(s) — which unit roles an item is meant for. Drives the fair-mix
// offering in Delibird item rounds so the player sees a spread. An item can suit
// more than one role (see ItemDefinition.categories).
export type ItemCategory =
  | 'tank'
  | 'attack fighter'  | 'attack caster'  | 'attack marksman'
  | 'special fighter' | 'special caster' | 'special marksman'

export interface ItemDefinition {
  id: string
  name: string
  description: string
  statBonus: Partial<UnitBaseStats>
  categories?: ItemCategory[]   // archetypes this item suits, for item-round balancing (icon items only)
  iconPath?: string     // /visuals path for the item icon (bench + on-unit render)
  // Percent/adaptive bonuses that flat statBonus can't express:
  attackSpeedPct?: number    // multiplies attack speed (0.30 = +30%)
  moveSpeedPct?: number      // multiplies move speed (0.20 = +20%)
  adaptiveForcePct?: number  // adds this fraction of the higher base offensive stat to attack or special
  adaptiveForce?: number     // flat: adds this to whichever of attack/special is higher
  // Tunable magnitudes for the item's triggered effect (read by its passive /
  // the combat pipeline). Keys are item-specific — see each item's module in
  // src/data/items/. Centralizes balance so every number lives with the item.
  effect?: Record<string, number>
}

// An item's combat behaviour, registered on the holder at combat start
// (see initItemPassives). Reads tunables from def.effect.
export type ItemPassive = (unit: Unit, state: CombatState, def: ItemDefinition) => void

// A self-contained item: its definition (description / stats / tunables) plus the
// optional passive that wires its combat behaviour. One per file in
// src/data/items/, aggregated by src/data/items/index.ts.
export interface ItemModule {
  def: ItemDefinition
  passive?: ItemPassive
}

export interface TraitThreshold {
  count: number
  description: string
  statBonus?: Partial<UnitBaseStats>        // applied to trait units
  teamBonus?: Partial<UnitBaseStats>        // applied to ALL allies
  specialEffect?: string                    // ID for effects that can't be expressed as stats
}

export interface TraitDefinition {
  id: string
  name: string
  thresholds: TraitThreshold[]
}

// ─── Runtime unit ─────────────────────────────────────────────────────────────

export type UnitState = 'idle' | 'moving' | 'leaping' | 'attacking' | 'casting' | 'stunned' | 'knockedUp' | 'ascended' | 'dead'
export type Team = 'player' | 'enemy'
export type DamageType = 'physical' | 'magic' | 'true'

export interface Shield {
  id: string
  sourceAbility: string
  sourceUnitId?: string   // unit that cast the shield; defaults to the holder (self-shield) when unset
  value: number
  maxValue: number
  durationTicks: number   // -1 = no expiry timer (breaks only by damage)
  effectiveMaxHp?: number // currentHp + shield at cast time — frozen for stable tick display
  traitSource?: string    // trait that granted this shield (e.g. 'zen') → damage it absorbs is attributed there
  onExpire?: (unit: Unit, shield: Shield) => void
}

export interface StatusEffect {
  id: string
  sourceUnitId: string
  durationTicks: number   // -1 = permanent until manually removed
  magnitude?: number
  stackId?: string        // unique key to prevent duplicate stacks
  onExpire?: (unit: Unit, state: CombatState) => void
  onDeath?:  (unit: Unit, state: CombatState) => void
  tickEffect?: (unit: Unit, state: CombatState) => void
  tickInterval?: number   // only fire tickEffect every N ticks (default: 1)
  suppressManaGain?: boolean  // while this effect is active, the unit cannot gain mana
}

// ─── Attack modifier ──────────────────────────────────────────────────────────
// Empowers the next N auto-attacks with bonus effects.

export interface AttackModifier {
  id: string
  remainingCharges: number
  visualId?: string           // if set, projectiles launched with this modifier use this abilityId for visual lookup
  projectileSpeed?: number    // overrides default auto projectile speed (default 8)
  bonusDamage?: number
  bonusDamageType?: DamageType
  bonusBeachyFrac?: number    // 0–1: fraction of bonusDamage from the Beachy spell buff → attributed to 'beachy'
  aoeRadius?: number          // if > 0: splash AoE around target on hit
  knockUp?: boolean
  maxHealthPercent?: number   // bonus = target.maxHp * this
  swingDir?: number           // windup animation swing direction: 1 = CW cock → CCW strike, -1 = mirror
  instantFollowUp?: boolean   // skip attack cooldown after this auto fires so the next queued modifier starts immediately
  followUpDelayTicks?: number    // like instantFollowUp but waits this many ticks before the next modifier's windup
  extendedWindupTicks?: number   // overrides the default windupTicks() for this modifier's attack animation
  ignoreBlind?: boolean        // if true, blind has no effect on this modifier's attack
  suppressBaseAttack?: boolean // if true, skip base auto damage — modifier owns the entire hit
  suppressManaGain?: boolean   // if true, attacker gains no mana on hit for this modifier
  onHit?: (source: Unit, target: Unit, state: CombatState) => void
}

// ─── Passive cast handler ─────────────────────────────────────────────────────
// Fires additional logic whenever the unit's ability goes off (after onCast).

export interface PassiveCastHandler {
  id: string
  onCast(unit: Unit, state: CombatState): void      // fires BEFORE the ability's onCast
  afterCast?(unit: Unit, state: CombatState): void  // fires AFTER the ability's onCast (cleanup)
}

// ─── Passive attack handler ───────────────────────────────────────────────────
// Fires additional logic on every auto-attack (chain lightning, waves, etc.)

export interface PassiveAttackHandler {
  id: string
  suppressBaseAttack?: boolean  // if true, base physical attack is skipped; handler fires all shots
  onAttack(source: Unit, target: Unit, state: CombatState): void
  onProjectileHit?: (source: Unit, target: Unit, state: CombatState) => void  // fires when the auto projectile lands
}

// ─── Unit mark ────────────────────────────────────────────────────────────────
// Delayed detonation or amplification mark placed on a unit.

export interface UnitMark {
  id: string
  sourceUnitId: string
  durationTicks: number       // -1 = permanent; counts down to auto-detonate
  magnitude?: number          // damage multiplier, stored damage, etc.
  onDetonate?: (marked: Unit, source: Unit | undefined, state: CombatState) => void
  // Fires once, at the moment the carrying unit dies, instead of onDetonate —
  // lets a mark (e.g. Celebi's Future Sight) jump to a new carrier with its
  // remaining timing intact rather than fizzling silently on a corpse.
  onCarrierDeath?: (marked: Unit, mark: UnitMark, state: CombatState) => void
}

// ─── Persistent AoE zone ──────────────────────────────────────────────────────

export interface PersistentAoEZone {
  id: string
  center: OffsetCoord
  radius: number
  sourceUnitId: string
  damagePerInterval: number
  intervalTicks: number
  damageType: DamageType
  durationTicks: number
  lastFiredTick: number
  targetTeam: Team
  armorReduction?: number
  spDefReduction?: number
  armorReductionPct?: number   // fraction of target's current defense to shred (e.g. 0.03 = 3%)
  spDefReductionPct?: number   // fraction of target's current spDefense to shred
  healPct?: number             // fraction of finalDamage dealt to heal back to source
  onExpire?: (state: CombatState) => void
  onKill?:   (zone: PersistentAoEZone, state: CombatState) => void
}

// ─── Terrain state ────────────────────────────────────────────────────────────

export interface TerrainState {
  electric: boolean
  psychic: boolean
  grassy: boolean
  misty: boolean
  sunny: boolean
}

export interface ComputedStats {
  maxHp: number
  attack: number
  special: number
  defense: number
  spDefense: number
  attackSpeed: number
  critChance: number
  critDamage: number
  range: number
  moveSpeed: number
  omnivamp: number       // fraction of HP damage dealt returned as healing (0 = none)
  healShieldPower: number  // multiplier bonus on heals and shields (0 = no bonus)
}

export interface Unit {
  id: string
  definitionId: string
  name: string
  team: Team
  tier: 1 | 2 | 3
  role: UnitRole | undefined
  isDummy: boolean      // if true: stationary, never attacks or casts

  hexPos: OffsetCoord
  visualPos: { x: number; y: number }
  moveProgress: number    // 0→1 interpolation between hexes
  path: OffsetCoord[]     // remaining path steps (A* result)

  maxHp: number
  currentHp: number
  maxMana: number
  currentMana: number

  // Base stats (post star-scaling, pre item/trait/effect)
  attack: number
  special: number
  defense: number
  spDefense: number
  attackSpeed: number
  critChance: number
  critDamage: number
  range: number
  moveSpeed: number       // hexes per second, default 1.5

  state: UnitState
  targetId: string | null

  attackTimer: number         // ticks until next attack is ready
  attackWindupTimer: number   // ticks remaining in windup
  isInWindup: boolean
  pendingCrit: boolean        // pre-rolled at windup start so renderer can show crit lunge

  manaLockTimer: number       // ticks remaining of mana suppression post-cast
  abilityCastTimer: number    // ticks remaining of cast animation
  manaRefundOnCast?: number   // mana granted back after each cast (Spell Tag item)
  abilitiesCanCrit?: boolean   // ability damage may crit too (Leek / Razor Claw items)
  appliesBurnOnHit?: boolean   // this unit's attacks & spells burn the target (Charcoal / Flame Orb)
  abilityDamageMult?: number   // multiplies this unit's ability (non-auto) damage (Life Orb)

  items: string[]             // ItemDefinition IDs (max 3)
  types: string[]             // TraitDefinition IDs

  statusEffects: StatusEffect[]
  shields: Shield[]

  attackModifiers: AttackModifier[]
  passiveAttackHandlers: PassiveAttackHandler[]
  passiveCastHandlers: PassiveCastHandler[]
  placedAt: number               // monotonic counter set when placed on board; higher = more recently placed
  attackCount: number            // total autos fired this combat
  damageTakenThisCombat: number  // cumulative pre-mitigation damage taken
  damageDealtThisCombat: number  // cumulative final damage dealt (after mitigation)
  // Per-trait contribution tallies (trait id → amount), for the report's "trait
  // contribution" breakdown. traitDmg = damage this unit's traits added to what it
  // dealt; traitHeal/traitShield = amount its traits added to heals/shields it got;
  // traitMitigated = incoming damage its traits reduced (e.g. River durability);
  // traitCount = discrete events its traits produced (e.g. Sky Striker executes).
  traitDmg: Record<string, number>
  traitHeal: Record<string, number>
  traitShield: Record<string, number>
  traitMitigated: Record<string, number>
  traitCount: Record<string, number>
  silenced: boolean              // blocks ability casting
  whirlpooled: boolean           // Tapu Fini: prevents double-targeting in zone
  marks: UnitMark[]
  incomingDamageMult: number     // default 1.0; amplifies incoming damage

  _computedStats: ComputedStats | null
  // Per-trait additive contribution to stats, filled by computeStats (trait id →
  // deltas). Drives damage/heal/shield/mitigation attribution. atk/sp → damage;
  // hsp → heal & shield; omni → omnivamp healing; def/spdef → damage reduced;
  // as → extra-auto damage estimate.
  _traitStat?: Record<string, { atk: number; sp: number; hsp: number; omni: number; def: number; spdef: number; as: number }>
  // Per-trait bonus max-HP granted (trait id → HP), for the effective-HP "damage
  // soaked" estimate. Set where a trait mutates maxHp (Bruiser/Volcano/Beachy/River).
  _traitHp?: Record<string, number>
  // For summoned units (Ruiner golem, Substitutor decoy): the trait that spawned it,
  // so its damage dealt / soaked is attributed to that trait.
  _traitOwner?: string
  _empoweredAuto?: boolean   // transient: set while an empowered auto's effects resolve, so their damage is tagged empowered
  // In-flight dash state, set by startLeap and cleared on landing. Present only
  // while unit.state === 'leaping'. A unit mid-leap owns NO hex in hexOccupancy
  // (origin freed at takeoff, destination claimed on arrival) — see movement.ts.
  _leap?: LeapData
}

// Pixel-lerp dash data. Lives on Unit rather than in a side table so the
// renderer can read dash progress (unitLayer reads _leap.tick/_leap.total).
export interface LeapData {
  sx: number; sy: number     // start pixel
  ex: number; ey: number     // end pixel
  tick: number               // ticks elapsed (0 → total)
  total: number              // total ticks for the dash
  destHex: OffsetCoord       // hex to claim on arrival
  onLand?: (unit: Unit, state: CombatState) => void
  onMidpoint?: (unit: Unit, state: CombatState) => void
  onInterrupt?: (unit: Unit, state: CombatState) => void  // fired if the leap is abandoned without landing (CC/force-end) — undo any flight-only state (e.g. invulnerability)
  midpointFired: boolean
  visualOnly?: boolean       // skip hexPos/occupancy changes — sprite-only animation
}

// ─── Projectile ───────────────────────────────────────────────────────────────

export interface DamagePayload {
  baseAmount: number
  damageType: DamageType
  canCrit: boolean
  forceCrit?: boolean         // if true, always crits regardless of critChance
  scalingStat?: 'attack' | 'special'
  scalingRatio?: number        // additive: base += stat * scalingRatio
  abilityScalingStat?: 'attack' | 'special'  // multiplicative: base *= stat / 100
  // 'auto_attack' for auto attacks; an ability id for ability damage; undefined for untagged
  abilityId?: string
  // True for damage that IS the unit's basic attack — the standard auto (tagged
  // abilityId 'auto_attack') or a passive that replaces the base auto (Corkscrew,
  // Drednaw's Razor Shell). ONLY this damage may critically strike; spells never
  // do, nor does the extra spell damage bolted onto an empowered auto. See the
  // crit gate in damage.ts.
  isAutoAttack?: boolean
  empowered?: boolean       // this damage came from an empowered auto (attack modifier or empowered form) — for reporting only
  armorPiercePct?: number   // 0–1: fraction of target's defense to ignore (physical only)
  spDefPiercePct?: number   // 0–1: fraction of target's sp. defense to ignore (magic only)
  traitSource?: string      // this damage IS a trait's direct damage (e.g. Cave Crawler quake) → attributed 100% to that trait
  beachyFrac?: number       // 0–1: fraction of this hit's damage contributed by the Beachy spell buff → attributed to 'beachy'
  traitFrac?: { trait: string; frac: number }  // 0–1 fraction of this hit attributable to a trait's bonus (e.g. Corkscrew's extra dash hit)
}

export interface HealPayload {
  amount: number
}

export interface Projectile {
  id: string
  sourceId: string
  targetId?: string      // track a unit; omit when using targetPos
  targetPos?: { x: number; y: number }  // fixed destination (overrides targetId lookup)
  startPos: { x: number; y: number }
  currentPos: { x: number; y: number }
  speed: number           // pixels per tick
  damagePayload?: DamagePayload    // set for damage projectiles
  healPayload?: HealPayload        // set for healing projectiles
  onHit?: (source: Unit | undefined, target: Unit, state: CombatState) => void
  onTick?: (proj: Projectile, source: Unit | undefined, state: CombatState) => void
  abilityId?: string      // set for ability projectiles
  hitRadius: number       // pixels, default 8
  arcHeight?: number      // visual arc height in px (renderer only)
  launchDist?: number     // distance at launch time, used to compute arc progress
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type CombatEvent =
  | { type: 'damage';  targetId: string; amount: number; damageType: DamageType; isCrit: boolean; sourceId: string; abilityId?: string; absorbed?: number; empowered?: boolean }
  | { type: 'heal';    targetId: string; amount: number; sourceId: string; abilityId?: string }
  | { type: 'death';   unitId: string; sourceId?: string; abilityId?: string }
  | { type: 'cast';    unitId: string; abilityId: string }
  | { type: 'shield';  unitId: string; amount: number; sourceId?: string }
  | { type: 'miss';    sourceId: string; targetId: string }
  | { type: 'vfx';         effectId: 'discharge_row';        sourceId: string; targetRow: number }
  | { type: 'vfx';         effectId: 'beak_blast_explosion'; x: number; y: number }
  | { type: 'vfx';         effectId: 'tornado';              x: number; y: number; dirX: number; dirY: number }
  | { type: 'vfx';         effectId: 'scorching_sands';      unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'blastoise_sway';       unitId: string }
  | { type: 'vfx';         effectId: 'tapufini_whirlpool';   x: number; y: number; unitId: string; sourceId: string }
  | { type: 'vfx';         effectId: 'torkoal_white_smoke';    unitId: string; durationTicks: number }
  | { type: 'vfx';         effectId: 'armarouge_cannon_explosion'; x: number; y: number; large?: boolean }
  | { type: 'vfx';         effectId: 'wheezing_gas_puff';         x: number; y: number }
  | { type: 'vfx';         effectId: 'blast_burn_mark_apply';     unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'blast_burn_detonate';       unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'marowak_hammer_swing';      unitId: string; dirX: number; dirY: number; swingDir: number }
  | { type: 'vfx';         effectId: 'marowak_shadow_bone_cone';  unitId: string; dirX: number; dirY: number; hexPositions: { x: number; y: number }[] }
  | { type: 'vfx';         effectId: 'boomburst_soundwave';       x: number; y: number; sourceId: string }
  | { type: 'vfx';         effectId: 'dragon_slam';               x: number; y: number }
  | { type: 'vfx';         effectId: 'aqua_ring_pass';            fromX: number; fromY: number; toX: number; toY: number; toUnitId: string; level: number }
  | { type: 'vfx';         effectId: 'bellibolt_discharge';       unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'tapukoko_chain';            unitId: string; x: number; y: number; fromX: number; fromY: number; empowered: boolean }
  | { type: 'vfx';         effectId: 'luster_purge_burst';        x: number; y: number }
  | { type: 'vfx';         effectId: 'mist_ball_burst';           x: number; y: number }
  | { type: 'vfx';         effectId: 'quagsire_shield_pop';       x: number; y: number }
  | { type: 'vfx';         effectId: 'celebi_mark_apply';         unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'tapulele_psystrike';        targetId: string; x: number; y: number; rotation?: number }
  | { type: 'vfx';         effectId: 'unown_hp_electric_ring';   x: number; y: number }
  | { type: 'vfx';         effectId: 'stonjourner_rock_hit';     unitId: string }
  | { type: 'vfx';         effectId: 'absol_night_slash';        unitId: string; startAngle: number }
  | { type: 'vfx';         effectId: 'xatu_bounce_shot_hit';     unitId: string }
  | { type: 'vfx';         effectId: 'claydol_gravity_cast';    unitId: string }
  | { type: 'vfx';         effectId: 'claydol_gravity_slam';    unitId: string }
  | { type: 'vfx';         effectId: 'spiritomb_mark_apply';    unitId: string; targetId: string }
  | { type: 'vfx';         effectId: 'wandering_spirit_mark_apply'; unitId: string; targetId: string }
  | { type: 'vfx';         effectId: 'wandering_spirit_consume';    unitId: string }
  | { type: 'vfx';         effectId: 'shadow_punch_appear';         sourceId: string; targetId: string; dirX: number; dirY: number }
  | { type: 'vfx';         effectId: 'shadow_punch_fly';            sourceId: string }
  | { type: 'vfx';         effectId: 'shadow_punch_strike';         sourceId: string; targetId: string; dirX: number; dirY: number }
  | { type: 'vfx';         effectId: 'sneasler_dire_claw';          sourceId: string; hexPositions: { x: number; y: number }[]; angle: number }
  | { type: 'vfx';         effectId: 'gible_bite_lunge';            unitId: string; dirX: number; dirY: number }
  | { type: 'vfx';         effectId: 'mamoswine_thick_fat_start'; unitId: string }
  | { type: 'vfx';         effectId: 'mamoswine_thick_fat_end';   unitId: string }
  | { type: 'vfx';         effectId: 'abomasnow_blizzard_start'; x: number; y: number; zoneId: string }
  | { type: 'vfx';         effectId: 'abomasnow_blizzard_unit';  targetId: string; zoneId: string }
  | { type: 'vfx';         effectId: 'h_avalugg_avalanche'; positions: { x: number; y: number; unitId: string }[]; hoverTicks: number }
  | { type: 'vfx';         effectId: 'h_avalugg_impact';   unitId: string }
  | { type: 'vfx';         effectId: 'excadrill_land';      unitId: string }
  | { type: 'vfx';         effectId: 'earthquake';                   team: Team }
  | { type: 'vfx';         effectId: 'cliff_fall'; x: number; y: number; direction: -1 | 1; col: number; row: number; isLeft: boolean }
  | { type: 'leech_drain'; sourceUnitId: string; venusaurId: string }

// ─── Combat world state ───────────────────────────────────────────────────────

export type CombatPhase = 'setup' | 'combat' | 'playerWin' | 'enemyWin'

export interface CombatState {
  tick: number
  phase: CombatPhase
  units: Map<string, Unit>
  projectiles: Map<string, Projectile>
  events: CombatEvent[]
  hexOccupancy: Map<HexId, string>  // HexId → unit ID
  terrain: TerrainState
  tailwind: { player: boolean; enemy: boolean }  // Sky Striker: per-team — true once that team's first sky striker casts
  earthquakeCounts: Map<string, number>  // team → total earthquakes fired (Cave Crawler)
  spellBuffCounters: Map<string, number>  // unitId → Beachy cast stack count
  persistentAoEZones: PersistentAoEZone[]
  stage?: number   // econ stage (see stageOf in econ/constants); scales stage-dependent traits. Omitted = full strength.
}

// ─── Combat run result ────────────────────────────────────────────────────────

export interface CombatResult {
  winner: 'player' | 'enemy' | 'draw'
  ticksElapsed: number
  finalState: CombatState
}
