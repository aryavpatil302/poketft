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

export interface UnitDefinition {
  id: string
  name: string
  cost: number          // 1–5
  traits: string[]      // lowercase trait IDs
  baseStats: UnitBaseStats
  ability?: AbilityDefinition   // optional — dummies and special units may have none
  spritePath: string
  spriteScale?: number  // multiplier on top of default SPRITE_HALF (default 1.0)
  isDummy?: boolean     // stationary, non-attacking target dummy for testing
}

export interface ItemDefinition {
  id: string
  name: string
  description: string
  statBonus: Partial<UnitBaseStats>
  passive?: string      // passive handler ID, omit for pure stat items
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
  value: number
  maxValue: number
  durationTicks: number   // -1 = no expiry timer (breaks only by damage)
  effectiveMaxHp?: number // currentHp + shield at cast time — frozen for stable tick display
  onExpire?: (unit: Unit, shield: Shield) => void
}

export interface StatusEffect {
  id: string
  sourceUnitId: string
  durationTicks: number   // -1 = permanent until manually removed
  magnitude?: number
  stackId?: string        // unique key to prevent duplicate stacks
  onExpire?: (unit: Unit, state: CombatState) => void
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
  aoeRadius?: number          // if > 0: splash AoE around target on hit
  knockUp?: boolean
  maxHealthPercent?: number   // bonus = target.maxHp * this
  swingDir?: number           // windup animation swing direction: 1 = CW cock → CCW strike, -1 = mirror
  instantFollowUp?: boolean   // skip attack cooldown after this auto fires so the next queued modifier starts immediately
  onHit?: (source: Unit, target: Unit, state: CombatState) => void
}

// ─── Passive attack handler ───────────────────────────────────────────────────
// Fires additional logic on every auto-attack (chain lightning, waves, etc.)

export interface PassiveAttackHandler {
  id: string
  suppressBaseAttack?: boolean  // if true, base physical attack is skipped; handler fires all shots
  onAttack(source: Unit, target: Unit, state: CombatState): void
}

// ─── Unit mark ────────────────────────────────────────────────────────────────
// Delayed detonation or amplification mark placed on a unit.

export interface UnitMark {
  id: string
  sourceUnitId: string
  durationTicks: number       // -1 = permanent; counts down to auto-detonate
  magnitude?: number          // damage multiplier, stored damage, etc.
  onDetonate?: (marked: Unit, source: Unit | undefined, state: CombatState) => void
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
}

// ─── Terrain state ────────────────────────────────────────────────────────────

export interface TerrainState {
  electric: boolean
  psychic: boolean
  grassy: boolean
  misty: boolean
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
}

export interface Unit {
  id: string
  definitionId: string
  name: string
  team: Team
  tier: 1 | 2 | 3
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

  manaLockTimer: number       // ticks remaining of mana suppression post-cast
  abilityCastTimer: number    // ticks remaining of cast animation

  items: string[]             // ItemDefinition IDs (max 3)
  traits: string[]            // TraitDefinition IDs

  statusEffects: StatusEffect[]
  shields: Shield[]

  attackModifiers: AttackModifier[]
  passiveAttackHandlers: PassiveAttackHandler[]
  attackCount: number            // total autos fired this combat
  damageTakenThisCombat: number  // cumulative pre-mitigation damage taken
  damageDealtThisCombat: number  // cumulative final damage dealt (after mitigation)
  silenced: boolean              // blocks ability casting
  whirlpooled: boolean           // Tapu Fini: prevents double-targeting in zone
  marks: UnitMark[]
  incomingDamageMult: number     // default 1.0; amplifies incoming damage

  _computedStats: ComputedStats | null
}

// ─── Projectile ───────────────────────────────────────────────────────────────

export interface DamagePayload {
  baseAmount: number
  damageType: DamageType
  canCrit: boolean
  scalingStat?: 'attack' | 'special'
  scalingRatio?: number   // fraction of scalingStat added to baseAmount
  // 'auto_attack' for auto attacks; an ability id for ability damage; undefined for untagged
  abilityId?: string
  armorPiercePct?: number   // 0–1: fraction of target's defense to ignore (physical only)
  spDefPiercePct?: number   // 0–1: fraction of target's sp. defense to ignore (magic only)
}

export interface HealPayload {
  amount: number
}

export interface Projectile {
  id: string
  sourceId: string
  targetId: string
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
  | { type: 'damage';  targetId: string; amount: number; damageType: DamageType; isCrit: boolean; sourceId: string; abilityId?: string }
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
  | { type: 'vfx';         effectId: 'marowak_spin_strike';       unitId: string }
  | { type: 'vfx';         effectId: 'boomburst_soundwave';       x: number; y: number; sourceId: string }
  | { type: 'vfx';         effectId: 'dragon_slam';               x: number; y: number }
  | { type: 'vfx';         effectId: 'bellibolt_discharge';       unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'quagsire_shield_pop';       x: number; y: number }
  | { type: 'vfx';         effectId: 'celebi_mark_apply';         unitId: string; x: number; y: number }
  | { type: 'vfx';         effectId: 'tapulele_psystrike';        targetId: string; x: number; y: number; rotation?: number }
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
  spellBuffCounters: Map<string, number>  // unitId → Beachy cast stack count
  persistentAoEZones: PersistentAoEZone[]
}

// ─── Combat run result ────────────────────────────────────────────────────────

export interface CombatResult {
  winner: 'player' | 'enemy' | 'draw'
  ticksElapsed: number
  finalState: CombatState
}
