import type { CombatState, CombatEvent } from '../../core/types'
import type { Projectile } from '../../core/types'
import { hexToPixel } from '../../core/hexGrid'
import { HEX_SIZE, BOARD_PERSP_Y, TICK_RATE, OVERLAY_HEADROOM } from '../../core/constants'

const leafImg = new Image()
leafImg.src = '/visuals/ability_icons/tangela_leaf.webp'

const dragonSlamImg = new Image()
dragonSlamImg.src = '/visuals/ability_icons/dragon-scent-slam.webp'

const hpIceImg = new Image()
hpIceImg.src = '/visuals/ability_icons/ice_hidden_power.webp'
const hpFireImg = new Image()
hpFireImg.src = '/visuals/ability_icons/fire_hidden_power.webp'
const hpElectricImg = new Image()
hpElectricImg.src = '/visuals/ability_icons/electric_hidden_power.webp'

const poisonStingImg = new Image()
poisonStingImg.src = '/visuals/ability_icons/poison_sting.webp'

const powerGemImg = new Image()
powerGemImg.src = '/visuals/ability_icons/power_gem.webp'

const powerSpotImg = new Image()
powerSpotImg.src = '/visuals/ability_icons/power_spot.webp'

const nightSlashImg = new Image()
nightSlashImg.src = '/visuals/ability_icons/night_slash.webp'

const shadowPunchImg = new Image()
shadowPunchImg.src = '/visuals/ability_icons/shadow_punch.webp'

const direclawImg = new Image()
direclawImg.src = '/visuals/ability_icons/dire_claw.webp'

const ancientPowerSingleImg = new Image()
ancientPowerSingleImg.src = '/visuals/ability_icons/ancient_power_single.webp'

const icyWindImg = new Image()
icyWindImg.src = '/visuals/ability_icons/icy_wind.webp'

// Per-unit auto-attack sprites, drawn with the sprite's tip pointed at the target.
// Each unit looks for /visuals/auto_attacks/<definitionId>_auto.png (e.g. vikavolt →
// vikavolt_auto.png). Images are created lazily and cached; a missing file never
// reports naturalWidth>0, so units without art fall back to the default dot. Drop a
// new "<pokemonName>_auto.png" into that folder and the unit uses it automatically.
const AUTO_SPRITE_HEIGHT = 22   // default render height in px; width scales to preserve aspect
// Per-unit render-height overrides for autos that shouldn't use the default size.
const AUTO_SPRITE_HEIGHT_OVERRIDES: Record<string, number> = {
  vikavolt:   AUTO_SPRITE_HEIGHT * 2,     // double size
  toucannon:  AUTO_SPRITE_HEIGHT * 1.3,   // +30%
  typhlosion: AUTO_SPRITE_HEIGHT * 2,     // double size
  armarouge:  AUTO_SPRITE_HEIGHT * 2,     // double size
  charizard:  AUTO_SPRITE_HEIGHT * 2,     // double size
  a_raichu:    AUTO_SPRITE_HEIGHT * 1.5,   // +50%
  a_exeggutor: AUTO_SPRITE_HEIGHT * 2,     // double size
  blastoise:   AUTO_SPRITE_HEIGHT * 1.5,     // double size
  tapu_fini: AUTO_SPRITE_HEIGHT * 3,
  noivern: AUTO_SPRITE_HEIGHT * 3,
  zubat: AUTO_SPRITE_HEIGHT * 1.5,
  morelull: AUTO_SPRITE_HEIGHT * 2,
  oranguru: AUTO_SPRITE_HEIGHT * 2,
  celebi: AUTO_SPRITE_HEIGHT * 1.5,
  tapu_lele: AUTO_SPRITE_HEIGHT * 3,
  unown: AUTO_SPRITE_HEIGHT * 1.8,
  claydol: AUTO_SPRITE_HEIGHT * 2,
  runerigus: AUTO_SPRITE_HEIGHT * 2.5,
  latios: AUTO_SPRITE_HEIGHT * 2, 
  froslass: AUTO_SPRITE_HEIGHT * 1.5, 
  abomasnow: AUTO_SPRITE_HEIGHT * 3,
  creep_g_slowbro: AUTO_SPRITE_HEIGHT * 3,
  sableye: AUTO_SPRITE_HEIGHT * 2
}

const autoSpriteCache = new Map<string, HTMLImageElement>()
function getAutoSprite(definitionId: string): HTMLImageElement {
  let img = autoSpriteCache.get(definitionId)
  if (!img) {
    img = new Image()
    img.src = `/visuals/auto_attacks/${definitionId}_auto.png`
    autoSpriteCache.set(definitionId, img)
  }
  return img
}

const avalancheImg = new Image()
avalancheImg.src = '/visuals/ability_icons/avalanche.webp'

// Looping WebM video for Tangela's cast animation (created after makeLoopingVideo is defined below)
let tangelaCastVideo: HTMLVideoElement

const pollenPuffPink = new Image()
pollenPuffPink.src = '/visuals/ability_icons/pollen_puff_pink.webp'

const pollenPuffYellow = new Image()
pollenPuffYellow.src = '/visuals/ability_icons/pollen_puff_yellow.webp'

function makeLoopingVideo(src: string): HTMLVideoElement {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = src; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
}

const leechSeedVideo     = makeLoopingVideo('/visuals/ability_icons/leech_seed.webm')
const unawarePopVideo    = makeLoopingVideo('/visuals/ability_icons/Unaware.webm')
tangelaCastVideo       = makeLoopingVideo('/visuals/ability_icons/tangela_cast.webm')
const dischargeVideo       = makeLoopingVideo('/visuals/ability_icons/discharge.webm')
function spawnOneShot(src: string): HTMLVideoElement {
  const v = document.createElement('video')
  v.muted       = true
  v.playsInline = true
  v.loop        = false
  v.preload     = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(v)
  v.src = src
  v.play().catch(() => {})
  return v
}

const leechSeedOg = new Image()
leechSeedOg.src = '/visuals/ability_icons/leech_seed_og.webp'

const beakBlastImg = new Image()
beakBlastImg.src = '/visuals/ability_icons/beak_blast_orange.webp'

// Latios/Latias orb tints applied to pollen_puff_yellow.webp
const LATIOS_BLUE_FILTER = 'hue-rotate(170deg) saturate(2) brightness(1.1)'
const LATIOS_BLUE_GLOW   = '#4FA8FF'
const LATIAS_RED_FILTER  = 'hue-rotate(-55deg) saturate(2.4) brightness(1.05)'
const LATIAS_RED_GLOW    = '#FF5A6E'

const surgeSurferImg = new Image()
surgeSurferImg.src = '/visuals/ability_icons/Surge_Surfer.webp'

const surgeSurferBlueImg = new Image()
surgeSurferBlueImg.src = '/visuals/ability_icons/Surge_Surfer_blue.webp'
const eggBombVideo    = makeLoopingVideo('/visuals/ability_icons/egg_bomb.webm')
const eruptionVideo   = makeLoopingVideo('/visuals/ability_icons/eruption.webm')
const whiteSmokeVideo = makeLoopingVideo('/visuals/ability_icons/white_smoke.webm')
const hydrocannonImg = new Image()
hydrocannonImg.src = '/visuals/ability_icons/hydrocannon.webp'
const armorCannonImg = new Image()
armorCannonImg.src = '/visuals/ability_icons/armor_cannon.webp'
const armorCannonExplosionImg = new Image()
armorCannonExplosionImg.src = '/visuals/ability_icons/armor_cannon_explosion.png'
const smogImg = new Image()
smogImg.src = '/visuals/ability_icons/smog.webp'
const strengthSapImg = new Image()
strengthSapImg.src = '/visuals/ability_icons/strength_sap.webp'
const storedPowerImg = new Image()
storedPowerImg.src = '/visuals/ability_icons/stored_power.webp'
const fireballImg = new Image()
fireballImg.src = '/visuals/ability_icons/fireball.webp'
// whirlpool: per-instance video spawned on cast (loop=true)
let leechDrainCanvas: HTMLCanvasElement | null = null

function getLeechDrainCanvas(): HTMLCanvasElement | null {
  if (leechDrainCanvas) return leechDrainCanvas
  if (!leechSeedOg.complete || !leechSeedOg.naturalWidth) return null
  const c = document.createElement('canvas')
  c.width  = leechSeedOg.naturalWidth
  c.height = leechSeedOg.naturalHeight
  const oc = c.getContext('2d')!
  oc.drawImage(leechSeedOg, 0, 0)
  oc.globalCompositeOperation = 'source-atop'
  oc.fillStyle = 'rgba(30, 210, 60, 0.78)'
  oc.fillRect(0, 0, c.width, c.height)
  leechDrainCanvas = c
  return c
}

// ─── Floating numbers ─────────────────────────────────────────────────────────

interface FloatingNumber {
  x: number
  y: number
  text: string
  color: string
  tick: number
  maxTick: number
}

// ─── VFX effect types ─────────────────────────────────────────────────────────

interface DischargeRowEffect {
  kind: 'discharge_row'
  targetRow: number
  tick: number
  maxTick: number
}

interface BeakBlastEffect {
  kind: 'beak_blast'
  x: number
  y: number
  tick: number
  maxTick: number
  video: HTMLVideoElement   // per-explosion video element, plays once from t=0
}

interface CastGlowEffect {
  kind: 'cast_glow'
  unitId: string
  tick: number
  maxTick: number
}

interface LeafShieldEffect {
  kind: 'leaf_shield'
  unitId: string
  tick: number
  maxTick: number
  shieldSeen?: boolean      // true once totalShield > 0 has been observed
  shieldExpiredTick?: number
}

interface SandShakeEffect {
  kind: 'sand_shake'
  unitId: string   // tracked unit — effect follows their live visualPos
  x: number        // fallback if unit is dead/gone
  y: number
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface TornadoEffect {
  kind: 'tornado'
  x: number
  y: number
  dirX: number
  dirY: number
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface WhirlpoolEffect {
  kind: 'whirlpool'
  unitId: string    // follows this unit's visual position each frame
  sourceId: string  // Tapu Fini — effect dies if she does
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface WhiteSmokeEffect {
  kind: 'white_smoke'
  unitId: string
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface CannonExplosionEffect {
  kind: 'cannon_explosion'
  x: number
  y: number
  tick: number
  maxTick: number
  large?: boolean  // true for AoE auto-attack explosions (drawn bigger)
}

interface SmogPuffEffect {
  kind: 'smog_puff'
  x: number      // current position (updated each tick)
  y: number
  dirX: number   // velocity vector (toward neighboring hex)
  dirY: number
  angle: number  // radians — right side of image faces outward
  tick: number
  maxTick: number
}

interface BlastBurnMarkEffect {
  kind: 'blast_burn_mark'
  unitId: string
  video: HTMLVideoElement  // looping blast_burn_mark.webm, per marked unit
  tick: number
  maxTick: number
}

interface BlastBurnDetonateEffect {
  kind: 'blast_burn_detonate'
  unitId: string
  x: number; y: number  // fallback position if unit is already dead
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface BoomburstBurstEffect {
  kind: 'boomburst_burst'
  cx: number   // Noivern's center X (fixed)
  cy: number   // Noivern's center Y (fixed)
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface DragonSlamEffect {
  kind: 'dragon_slam'
  cx: number
  cy: number
  tick: number
  maxTick: number
}

interface BelliboltDischargeEffect {
  kind: 'bellibolt_discharge'
  unitId: string
  x: number   // fallback if unit is gone
  y: number
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface TapuKokoChainEffect {
  kind: 'tapukoko_chain'
  unitId: string
  x: number   // fallback if unit is gone
  y: number
  fromX: number  // struck unit's position — the bolt arcs from here to (x, y)
  fromY: number
  tick: number
  maxTick: number
  empowered: boolean       // cast-empowered chains render blue instead of yellow
}

interface LatiosChargeEffect {
  kind: 'latios_charge'
  unitId: string
  tick: number
  maxTick: number    // matches the ability's channel ticks — orb grows over the channel
  filter: string     // blue tint for Latios, red for Latias
  glow: string
}

interface LusterPurgeBurstEffect {
  kind: 'luster_purge_burst'
  x: number
  y: number
  tick: number
  maxTick: number
  maxSize: number    // covers the ability's blast radius
  filter: string
  glow: string
}

interface QuagsireShieldPopEffect {
  kind: 'quagsire_shield_pop'
  x: number
  y: number
  tick: number
  maxTick: number
}

interface PsystrikeEffect {
  kind: 'tapulele_psystrike'
  targetId: string
  video: HTMLVideoElement   // one-shot psystrike.webm, 2s
  tick: number
  maxTick: number           // 120 frames ≈ 2 seconds
  rotation: number          // radians — extra casts on same target are rotated apart
}

interface CelebiFsMarkEffect {
  kind: 'celebi_fs_mark'
  unitId: string
  video: HTMLVideoElement  // one-shot future_sight.webm timed to 2s
  tick: number
  maxTick: number          // 2 * TICK_RATE = 120
}

interface UnownElectricRingEffect {
  kind: 'unown_electric_ring'
  x: number
  y: number
  tick: number
  maxTick: number
}

interface AbsolNightSlashEffect {
  kind: 'absol_night_slash'
  unitId: string
  startAngle: number
  tick: number
  maxTick: number
}

interface ShadowBoneFireEffect {
  kind: 'shadow_bone_fire'
  x: number
  y: number
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface DestinyMarkEffect {
  kind: 'destiny_mark'
  unitId: string        // marked enemy
  spiritombId: string   // for alive-check
  video: HTMLVideoElement
  tick: number
  maxTick: number       // 99999 = permanent until effect is gone
}

interface WanderingSpiritArmEffect {
  kind: 'wandering_spirit_arm'
  sourceId: string       // Runerigus
  targetId: string       // marked enemy — arm's hand end stays attached here
  video: HTMLVideoElement
  tick: number
  maxTick: number        // 99999 = permanent until mark is consumed/cleared
  consumeAt?: number     // tick at which the mark was consumed — triggers rumble + fade-out
}

interface ShadowPunchGhostEffect {
  kind: 'shadow_punch_ghost'
  sourceId: string
  primaryTargetId: string
  dirX: number
  dirY: number
  tick: number
  maxTick: number     // 99999 until fly event arrives; set to tick+FLY_TICKS on fly
  firedAt?: number    // tick when the fly event arrived
}

interface ShadowPunchStrikeEffect {
  kind: 'shadow_punch_strike'
  x: number
  y: number
  dirX: number
  dirY: number
  speed: number   // px/tick
  angle: number   // radians — image facing direction (toward target)
  tick: number
  maxTick: number
}

interface DireClawEffect {
  kind: 'dire_claw'
  hexPositions: { x: number; y: number }[]
  angle: number   // radians — forward direction (Sneasler → target)
  tick: number
  maxTick: number
}

interface AncientPowerCastEffect {
  kind: 'ancient_power_cast'
  unitId: string         // follows Aerodactyl's live position
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface AvalancheFallEffect {
  kind: 'avalanche_fall'
  unitId: string
  x: number    // snapshot fallback if unit is dead
  y: number
  tick: number
  maxTick: number
  hoverTicks: number
}

interface BlizzardEffect {
  kind: 'blizzard'
  x: number
  y: number
  zoneId: string
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface BlizzardUnitEffect {
  kind: 'blizzard_unit'
  targetId: string
  zoneId: string
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

interface ThickFatEffect {
  kind: 'thick_fat'
  unitId: string
  tick: number
  maxTick: number
  video: HTMLVideoElement
}

type VfxEffect = DischargeRowEffect | BeakBlastEffect | CastGlowEffect | LeafShieldEffect | TornadoEffect | SandShakeEffect | WhirlpoolEffect | WhiteSmokeEffect | CannonExplosionEffect | SmogPuffEffect | BlastBurnMarkEffect | BlastBurnDetonateEffect | BoomburstBurstEffect | DragonSlamEffect | BelliboltDischargeEffect | TapuKokoChainEffect | LatiosChargeEffect | LusterPurgeBurstEffect | QuagsireShieldPopEffect | PsystrikeEffect | CelebiFsMarkEffect | UnownElectricRingEffect | AbsolNightSlashEffect | ShadowBoneFireEffect | DestinyMarkEffect | WanderingSpiritArmEffect | ShadowPunchGhostEffect | ShadowPunchStrikeEffect | DireClawEffect | AncientPowerCastEffect | AvalancheFallEffect | BlizzardEffect | BlizzardUnitEffect | ThickFatEffect

interface DrainProjectile {
  currentPos: { x: number; y: number }
  venusaurId: string
  speed: number
}

export interface CastAnimation {
  unitId: string
  type: 'shake' | 'hop' | 'dart' | 'hop_dart' | 'dart_rumble' | 'hold_hop' | 'flap' | 'bigShake' | 'cock_toss' | 'sway' | 'hammer_swing' | 'spin' | 'unown_spin' | 'absol_slash' | 'claydol_gravity' | 'slam_land' | 'rune_charge_lunge' | 'ws_consume_shake' | 'dire_claw_swipe' | 'excadrill_land' | 'whirlpool_swirl' | 'apex_hop'
  targetAngle?: number  // radians — used by unown_spin
  startAngle?: number   // radians — used by absol_slash (blade start direction)
  remaining: number
  total: number
  dirX?: number    // unit vector toward target (dart only)
  dirY?: number
  apexAt?: number  // frame index of peak displacement (defaults to total/2)
  swingDir?: number  // 1 = CW wind-up → CCW strike; -1 = mirrored
}

const UNIT_RADIUS = HEX_SIZE * 0.80  // mirrors unitLayer SPRITE_HALF for cast glow sizing

// ─── EffectLayer ──────────────────────────────────────────────────────────────

export class EffectLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private groundCanvas: HTMLCanvasElement | null = null
  private groundCtx: CanvasRenderingContext2D | null = null
  private floaters: FloatingNumber[] = []
  private vfxEffects: VfxEffect[]    = []
  private animTick = 0
  private healFlashTicks  = new Map<string, number>()
  private castAnimations: CastAnimation[] = []
  private drainProjectiles: DrainProjectile[] = []

  constructor(canvas: HTMLCanvasElement, groundCanvas?: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    if (groundCanvas) {
      this.groundCanvas = groundCanvas
      this.groundCtx = groundCanvas.getContext('2d')!
    }
  }

  // Called each combat tick — spawns effects from events
  processEvents(events: CombatEvent[], _unitPositions: Map<string, { x: number; y: number }>, units?: Map<string, import('../../core/types').Unit>): void {
    for (const ev of events) {
      // ── Floating numbers ────────────────────────────────────────────────────
      if (ev.type === 'damage' && ev.amount > 0) {
        const pos = _unitPositions.get(ev.targetId)
        if (pos) {
          const color = ev.damageType === 'physical' ? '#ff8888'
                      : ev.damageType === 'magic'    ? '#cc88ff'
                                                     : '#ffffff'
          this.floaters.push({
            x: pos.x + (Math.random() * 20 - 10),
            y: pos.y - 16,
            text: ev.isCrit ? `${ev.amount}!` : `${ev.amount}`,
            color: ev.isCrit ? '#ffff44' : color,
            tick: 0, maxTick: 60,
          })
        }
      }
      if (ev.type === 'heal' && ev.amount > 0) {
        const pos = _unitPositions.get(ev.targetId)
        if (pos) {
          this.floaters.push({
            x: pos.x + (Math.random() * 16 - 8),
            y: pos.y - 16,
            text: `+${ev.amount}`,
            color: '#44ff88',
            tick: 0, maxTick: 60,
          })
        }
      }

      // ── Ability-specific VFX ────────────────────────────────────────────────
      if (ev.type === 'vfx') {
        if (ev.effectId === 'discharge_row') {
          this.vfxEffects.push({
            kind: 'discharge_row',
            targetRow: ev.targetRow,
            tick: 0,
            maxTick: 50,
          })
        }
        if (ev.effectId === 'tornado') {
          this.vfxEffects.push({
            kind: 'tornado',
            x: ev.x, y: ev.y,
            dirX: ev.dirX, dirY: ev.dirY,
            tick: 0,
            maxTick: 100,  // long enough to cross the board at 7 px/tick
            video: (() => { const v = spawnOneShot('/visuals/ability_icons/tornado.webm'); v.loop = true; return v })(),
          })
        }
        if (ev.effectId === 'beak_blast_explosion') {
          this.vfxEffects.push({
            kind: 'beak_blast',
            x: ev.x,
            y: ev.y,
            tick: 0,
            maxTick: 40,   // ~0.67s at 60 ticks/s matches the 20-frame 30fps WebM
            video: spawnOneShot('/visuals/ability_icons/beak_blast_explosion.webm'),
          })
        }
        if (ev.effectId === 'blastoise_sway') {
          // Brief side-to-side sway as Blastoise enters cannon mode
          this.castAnimations.push({ unitId: ev.unitId, type: 'sway', remaining: 28, total: 28 })
        }
        if (ev.effectId === 'torkoal_white_smoke') {
          const sv = spawnOneShot('/visuals/ability_icons/white_smoke.webm')
          sv.loop = true
          this.vfxEffects.push({
            kind: 'white_smoke',
            unitId: ev.unitId,
            tick: 0,
            maxTick: ev.durationTicks,
            video: sv,
          })
        }
        if (ev.effectId === 'tapufini_whirlpool') {
          const wv = spawnOneShot('/visuals/ability_icons/whirlpool.webm')
          wv.loop = true
          this.vfxEffects.push({
            kind: 'whirlpool',
            unitId: ev.unitId,
            sourceId: ev.sourceId,
            tick: 0,
            maxTick: 999999,
            video: wv,
          })
        }
        if (ev.effectId === 'scorching_sands') {
          this.vfxEffects.push({
            kind: 'sand_shake',
            unitId: ev.unitId,
            x: ev.x,
            y: ev.y,
            tick: 0,
            maxTick: 240,  // 4 seconds — matches burn duration
            video: (() => { const v = spawnOneShot('/visuals/ability_icons/scorching_sands_shake.webm'); v.loop = true; return v })(),
          })
        }
        if (ev.effectId === 'wheezing_gas_puff') {
          // 6 unit direction vectors for pointy-top hex neighbors
          const dirs = [
            { dx:  1,    dy:  0    },
            { dx:  0.5,  dy:  0.866 },
            { dx: -0.5,  dy:  0.866 },
            { dx: -1,    dy:  0    },
            { dx: -0.5,  dy: -0.866 },
            { dx:  0.5,  dy: -0.866 },
          ]
          const travel = HEX_SIZE * 1.2  // pixels to fly outward
          const maxTick = 18
          for (const d of dirs) {
            this.vfxEffects.push({
              kind: 'smog_puff',
              x: ev.x, y: ev.y,
              dirX: d.dx * travel / maxTick,
              dirY: d.dy * travel / maxTick,
              angle: Math.atan2(d.dy, d.dx),
              tick: 0, maxTick,
            })
          }
        }
        if (ev.effectId === 'armarouge_cannon_explosion') {
          this.vfxEffects.push({
            kind: 'cannon_explosion',
            x: ev.x,
            y: ev.y,
            tick: 0,
            maxTick: 30,
            large: ev.large,
          })
        }
        if (ev.effectId === 'blast_burn_mark_apply') {
          // Avoid duplicate mark effects for the same unit
          const alreadyMarked = this.vfxEffects.some(e => e.kind === 'blast_burn_mark' && e.unitId === ev.unitId)
          if (!alreadyMarked) {
            const v = document.createElement('video')
            v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
            v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
            document.body.appendChild(v)
            v.src = '/visuals/ability_icons/blast_burn_mark.webm'
            v.play().catch(() => {})
            this.vfxEffects.push({ kind: 'blast_burn_mark', unitId: ev.unitId, video: v, tick: 0, maxTick: 99999 })
          }
        }
        if (ev.effectId === 'blast_burn_detonate') {
          this.vfxEffects.push({
            kind: 'blast_burn_detonate',
            unitId: ev.unitId,
            x: ev.x, y: ev.y,
            tick: 0, maxTick: 40,
            video: spawnOneShot('/visuals/ability_icons/blast_burn_detonation.webm'),
          })
        }
        if (ev.effectId === 'tapulele_psystrike') {
          const v = document.createElement('video')
          v.loop = false; v.muted = true; v.playsInline = true; v.preload = 'auto'
          v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
          document.body.appendChild(v)
          v.src = '/visuals/ability_icons/psystrike.webm'
          v.play().catch(() => {})
          this.vfxEffects.push({ kind: 'tapulele_psystrike', targetId: ev.targetId, video: v, tick: 0, maxTick: 120, rotation: ev.rotation ?? 0 })
        }
        if (ev.effectId === 'celebi_mark_apply') {
          const alreadyMarked = this.vfxEffects.some(e => e.kind === 'celebi_fs_mark' && e.unitId === ev.unitId)
          if (!alreadyMarked) {
            const v = document.createElement('video')
            v.loop = false; v.muted = true; v.playsInline = true; v.preload = 'auto'
            v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
            document.body.appendChild(v)
            v.src = '/visuals/ability_icons/future_sight.webm'
            v.play().catch(() => {})
            this.vfxEffects.push({ kind: 'celebi_fs_mark', unitId: ev.unitId, video: v, tick: 0, maxTick: 120 })
          }
        }
      }

      // ── Leech drain visual projectile ───────────────────────────────────────
      if (ev.type === 'leech_drain') {
        const srcPos = _unitPositions.get(ev.sourceUnitId)
        if (srcPos) {
          this.drainProjectiles.push({
            currentPos: { ...srcPos },
            venusaurId: ev.venusaurId,
            speed: 6,
          })
        }
      }

      // ── Cast effects ────────────────────────────────────────────────────────
      if (ev.type === 'cast') {
        if (ev.abilityId === 'latios_luster_purge') {
          this.vfxEffects.push({ kind: 'latios_charge', unitId: ev.unitId, tick: 0, maxTick: 45,
            filter: LATIOS_BLUE_FILTER, glow: LATIOS_BLUE_GLOW })
        }
        if (ev.abilityId === 'latias_mist_ball') {
          this.vfxEffects.push({ kind: 'latios_charge', unitId: ev.unitId, tick: 0, maxTick: 75,
            filter: LATIAS_RED_FILTER, glow: LATIAS_RED_GLOW })
        }
        if (ev.abilityId === 'tangela_leaf_guard') {
          this.vfxEffects.push({ kind: 'leaf_shield', unitId: ev.unitId, tick: 0, maxTick: 360 })
          this.castAnimations.push({ unitId: ev.unitId, type: 'shake', remaining: 14, total: 14 })
        }
        if (ev.abilityId === 'venusaur_leech_seed' || ev.abilityId === 'gogoat_grass_pelt') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'hop', remaining: 20, total: 20 })
        }
        if (ev.abilityId === 'tapufini_natures_madness') {
          // Sweep in a wide oval to stir up the whirlpool (spirals out then back in)
          this.castAnimations.push({ unitId: ev.unitId, type: 'whirlpool_swirl', remaining: 26, total: 26 })
        }
        if (ev.abilityId === 'zubat_poison_sting') {
          // Jump; apex lands on the launch tick (apexAt = castTimeTicks=15), then descends
          this.castAnimations.push({ unitId: ev.unitId, type: 'apex_hop', remaining: 28, total: 28, apexAt: 15 })
        }
        if (ev.abilityId === 'ribombee_pollen_puff') {
          const caster = units?.get(ev.unitId)
          const target = caster?.targetId ? units?.get(caster.targetId) : undefined
          let dirX = 0, dirY = 0
          if (caster && target) {
            const dx = target.visualPos.x - caster.visualPos.x
            const dy = target.visualPos.y - caster.visualPos.y
            const d  = Math.sqrt(dx * dx + dy * dy)
            if (d > 0) { dirX = dx / d; dirY = dy / d }
          }
          // Small hop early, then lunge out peaking at the launch (apex = cast time),
          // then snap back. total=32: hop (0–14) → lunge (peaks 20) → snap back (20–32).
          this.castAnimations.push({ unitId: ev.unitId, type: 'hop_dart', remaining: 32, total: 32, apexAt: 20, dirX, dirY })
        }
        if (ev.abilityId === 'froslass_icy_wind') {
          const caster = units?.get(ev.unitId)
          const target = caster?.targetId ? units?.get(caster.targetId) : undefined
          let dirX = 0, dirY = -1
          if (caster && target) {
            const dx = target.visualPos.x - caster.visualPos.x
            const dy = target.visualPos.y - caster.visualPos.y
            const d  = Math.sqrt(dx * dx + dy * dy)
            if (d > 0) { dirX = dx / d; dirY = dy / d }
          }
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 28, total: 28, apexAt: 20, dirX, dirY })
        }
        if (ev.abilityId === 'toucannon_beak_blast') {
          // castTimeTicks=20 → apexAt=20 so hop peaks exactly when shot fires
          this.castAnimations.push({ unitId: ev.unitId, type: 'hold_hop', remaining: 38, total: 38, apexAt: 20 })
        }
        if (ev.abilityId === 'tropius_leaf_tornado') {
          // Big high jump that peaks right as the tornado launches (apex = castTimeTicks=20),
          // then lands over the tail.
          this.castAnimations.push({ unitId: ev.unitId, type: 'flap', remaining: 34, total: 34, apexAt: 20 })
        }
        if (ev.abilityId === 'tapubulu_natures_madness') {
          // Big impactful shake to emphasize the size growth on transformation
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 32, total: 32 })
        }
        if (ev.abilityId === 'palossand_scorching_sands') {
          // Palossand shakes as it erupts the ground
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 25, total: 25 })
        }
        if (ev.abilityId === 'klawf_anger_shell') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'shake', remaining: 14, total: 14 })
        }
        if (ev.abilityId === 'a_marowak_shadow_bone') {
          // Heavy rumble as he winds up the bone club — sells the weight before the swings land
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 16, total: 16 })
        }
        if (ev.abilityId === 'snorunt_ice_body') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'shake', remaining: 18, total: 18 })
        }
        if (ev.abilityId === 'sneasler_dire_claw') {
          const caster = units?.get(ev.unitId)
          const target = caster?.targetId ? units?.get(caster.targetId) : undefined
          let dirX = 0, dirY = -1
          if (caster && target) {
            const dx = target.visualPos.x - caster.visualPos.x
            const dy = target.visualPos.y - caster.visualPos.y
            const len = Math.hypot(dx, dy)
            if (len > 0) { dirX = dx / len; dirY = dy / len }
          }
          // total=35: 8 pull-left, 12 arc up-right (apex=20 = when swipe fires), 15 return
          this.castAnimations.push({ unitId: ev.unitId, type: 'dire_claw_swipe', remaining: 35, total: 35, apexAt: 20, dirX, dirY })
        }
        if (ev.abilityId === 'h_avalugg_mountain_gale') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 36, total: 36 })
        }
        if (ev.abilityId === 'abomasnow_blizzard') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 36, total: 36 })
        }
        if (ev.abilityId === 'aerodactyl_ancient_power') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 30, total: 30 })
          // Only create the overlay once — guard against a second cast event firing
          if (!this.vfxEffects.some(e => e.kind === 'ancient_power_cast' && (e as AncientPowerCastEffect).unitId === ev.unitId)) {
            const v = spawnOneShot('/visuals/ability_icons/ancient_power.webm')
            v.loop = true  // loop forever until Aerodactyl dies
            this.vfxEffects.push({ kind: 'ancient_power_cast', unitId: ev.unitId, video: v, tick: 0, maxTick: 999999 })
          }
        }
        if (ev.abilityId === 'stonjourner_power_spot') {
          // Lunge away from the nearest ally (toward whom the rock will travel from)
          const caster = units?.get(ev.unitId)
          let dirX = 0, dirY = 0
          if (caster && units) {
            let nearestAlly: import('../../core/types').Unit | undefined
            let bestD = Infinity
            for (const u of units.values()) {
              if (u.id === caster.id || u.team !== caster.team || u.state === 'dead') continue
              const d = Math.hypot(u.visualPos.x - caster.visualPos.x, u.visualPos.y - caster.visualPos.y)
              if (d < bestD) { bestD = d; nearestAlly = u }
            }
            if (nearestAlly) {
              const dx = caster.visualPos.x - nearestAlly.visualPos.x
              const dy = caster.visualPos.y - nearestAlly.visualPos.y
              const len = Math.hypot(dx, dy)
              if (len > 0) { dirX = dx / len; dirY = dy / len }
            }
          }
          // Short lunge away (18 ticks: 10 out, 8 back)
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 18, total: 18, apexAt: 10, dirX, dirY })
        }
        if (ev.abilityId === 'a_exeggutor_egg_bomb') {
          // 30 ticks cock-back, then a forward swing (30→45) — the egg launches partway
          // through the swing so it releases as the arm comes forward, not while cocked back.
          this.castAnimations.push({ unitId: ev.unitId, type: 'cock_toss', remaining: 45, total: 45, apexAt: 30 })
        }
        if (ev.abilityId === 'armarouge_armor_cannon') {
          const caster = units?.get(ev.unitId)
          const target = caster?.targetId ? units?.get(caster.targetId) : undefined
          let dirX = 0, dirY = -1
          if (caster && target) {
            const dx = target.visualPos.x - caster.visualPos.x
            const dy = target.visualPos.y - caster.visualPos.y
            const len = Math.hypot(dx, dy)
            if (len > 0) { dirX = dx / len; dirY = dy / len }
          }
          // Lean forward toward target then snap back (cannon recoil)
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 30, total: 30, apexAt: 20, dirX, dirY })
        }
        if (ev.abilityId === 'charizard_blast_burn') {
          const caster = units?.get(ev.unitId)
          const target = caster?.targetId ? units?.get(caster.targetId) : undefined
          let dirX = 0, dirY = 0
          if (caster && target) {
            const dx = target.visualPos.x - caster.visualPos.x
            const dy = target.visualPos.y - caster.visualPos.y
            const d  = Math.sqrt(dx * dx + dy * dy)
            if (d > 0) { dirX = dx / d; dirY = dy / d }
          } else if (caster) {
            // No target — lunge toward nearest enemy
            let nearest: import('../../core/types').Unit | undefined
            let bestD = Infinity
            for (const u of (units?.values() ?? [])) {
              if (u.team === caster.team || u.state === 'dead') continue
              const d = Math.hypot(u.visualPos.x - caster.visualPos.x, u.visualPos.y - caster.visualPos.y)
              if (d < bestD) { bestD = d; nearest = u }
            }
            if (nearest) {
              const dx = nearest.visualPos.x - caster.visualPos.x
              const dy = nearest.visualPos.y - caster.visualPos.y
              const d  = Math.hypot(dx, dy)
              if (d > 0) { dirX = dx / d; dirY = dy / d }
            }
          }
          // Vicious snap lunge: fast forward burst (apex at 7), slower recovery
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 22, total: 22, apexAt: 7, dirX, dirY })
        }
        if (ev.abilityId === 'unown_hidden_power') {
          // Spin to a random angle (60°–180°, either direction) then snap back on launch
          const targetAngle = (Math.PI / 3 + Math.random() * (Math.PI * 2 / 3)) * (Math.random() < 0.5 ? 1 : -1)
          this.castAnimations.push({ unitId: ev.unitId, type: 'unown_spin', remaining: 40, total: 40, targetAngle })
        }
        if (ev.abilityId === 'vikavolt_discharge') {
          const caster = units?.get(ev.unitId)
          const target = caster?.targetId ? units?.get(caster.targetId) : undefined
          let dirX = 0, dirY = 0
          if (caster && target) {
            const dx = target.visualPos.x - caster.visualPos.x
            const dy = target.visualPos.y - caster.visualPos.y
            const d  = Math.sqrt(dx * dx + dy * dy)
            if (d > 0) { dirX = dx / d; dirY = dy / d }
          }
          // Sharp fast lunge with an electric rumble: quick snap forward (apex at 8), fast return
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart_rumble', remaining: 18, total: 18, apexAt: 8, dirX, dirY })
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'gible_bite_lunge') {
        // Quick snap forward into the target at the bite (apex at 7), fast return —
        // separate from the leap that closed the distance to get here.
        this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 22, total: 22, apexAt: 7, dirX: ev.dirX, dirY: ev.dirY })
      }
      if (ev.type === 'vfx' && ev.effectId === 'marowak_hammer_swing') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'hammer_swing', remaining: 26, total: 26, dirX: ev.dirX, dirY: ev.dirY, swingDir: ev.swingDir })
      }
      if (ev.type === 'vfx' && ev.effectId === 'marowak_shadow_bone_cone') {
        // Deep forward lunge on the 3rd auto
        this.castAnimations.push({ unitId: ev.unitId, type: 'hammer_swing', remaining: 26, total: 26, dirX: ev.dirX, dirY: ev.dirY, swingDir: 1 })
        // Purple flame erupts briefly at each affected hex (target + cone)
        const FIRE_TICKS = 40
        for (const pos of ev.hexPositions) {
          this.vfxEffects.push({ kind: 'shadow_bone_fire', x: pos.x, y: pos.y, tick: 0, maxTick: FIRE_TICKS, video: spawnOneShot('/visuals/ability_icons/shadow_bone_fire.webm') })
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'boomburst_soundwave') {
        this.vfxEffects.push({
          kind: 'boomburst_burst',
          cx: ev.x, cy: ev.y,
          tick: 0,
          maxTick: 39,  // matches ~0.65s WebM duration at 60fps
          video: spawnOneShot('/visuals/ability_icons/boomburst_soundwave.webm'),
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'dragon_slam') {
        this.vfxEffects.push({
          kind: 'dragon_slam',
          cx: ev.x, cy: ev.y,
          tick: 0,
          maxTick: 35,  // ~0.58s fade-out
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'stonjourner_rock_hit') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 20, total: 20 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'xatu_bounce_shot_hit') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 16, total: 16 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'claydol_gravity_cast') {
        // rise(12) + hold(90) + fall(12) = 114 ticks; apexAt marks end of rise
        this.castAnimations.push({ unitId: ev.unitId, type: 'claydol_gravity', remaining: 114, total: 114, apexAt: 12 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'claydol_gravity_slam') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'slam_land', remaining: 28, total: 28 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'spiritomb_mark_apply') {
        // Rumble on Spiritomb at cast
        this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 16, total: 16 })
        // Marks are permanent and stack — each cast adds a new mark video without removing old ones.
        const v = document.createElement('video')
        v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
        v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
        document.body.appendChild(v)
        v.src = '/visuals/ability_icons/destiny_mark.webm'
        v.play().catch(() => {})
        this.vfxEffects.push({ kind: 'destiny_mark', unitId: ev.targetId, spiritombId: ev.unitId, video: v, tick: 0, maxTick: 99999 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'wandering_spirit_mark_apply') {
        const caster = units?.get(ev.unitId)
        const target = units?.get(ev.targetId)
        let dirX = 0, dirY = 1
        if (caster && target) {
          const dx = target.visualPos.x - caster.visualPos.x
          const dy = target.visualPos.y - caster.visualPos.y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d > 0) { dirX = dx / d; dirY = dy / d }
        }
        // Squash-charge then lunge once — skip if a lunge is already queued (3-star fires multiple events)
        if (!this.castAnimations.some(a => a.unitId === ev.unitId && a.type === 'rune_charge_lunge')) {
          this.castAnimations.push({ unitId: ev.unitId, type: 'rune_charge_lunge', remaining: 26, total: 26, apexAt: 10, dirX, dirY })
        }

        const v = document.createElement('video')
        v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
        v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
        document.body.appendChild(v)
        v.src = '/visuals/ability_icons/wandering_spirit.webm'
        v.play().catch(() => {})
        this.vfxEffects.push({ kind: 'wandering_spirit_arm', sourceId: ev.unitId, targetId: ev.targetId, video: v, tick: 0, maxTick: 99999 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'wandering_spirit_consume') {
        const RUMBLE_TICKS = 14
        for (const e of this.vfxEffects) {
          if (e.kind === 'wandering_spirit_arm' && e.targetId === ev.unitId && e.consumeAt === undefined) {
            e.consumeAt = e.tick
            e.maxTick   = e.tick + RUMBLE_TICKS
          }
        }
        this.castAnimations.push({ unitId: ev.unitId, type: 'ws_consume_shake', remaining: RUMBLE_TICKS, total: RUMBLE_TICKS })
      }
      if (ev.type === 'vfx' && ev.effectId === 'absol_night_slash') {
        const SLASH_TICKS = 13   // faster full-rotation spin
        this.castAnimations.push({ unitId: ev.unitId, type: 'absol_slash', remaining: SLASH_TICKS, total: SLASH_TICKS, startAngle: ev.startAngle })
        this.vfxEffects.push({ kind: 'absol_night_slash', unitId: ev.unitId, startAngle: ev.startAngle, tick: 0, maxTick: SLASH_TICKS })
      }
      if (ev.type === 'vfx' && ev.effectId === 'unown_hp_electric_ring') {
        this.vfxEffects.push({
          kind: 'unown_electric_ring',
          x: ev.x, y: ev.y,
          tick: 0, maxTick: 24,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'quagsire_shield_pop') {
        this.vfxEffects.push({
          kind: 'quagsire_shield_pop',
          x: ev.x,
          y: ev.y,
          tick: 0,
          maxTick: 22,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'bellibolt_discharge') {
        this.vfxEffects.push({
          kind: 'bellibolt_discharge',
          unitId: ev.unitId,
          x: ev.x,
          y: ev.y,
          tick: 0,
          maxTick: 60,
          video: spawnOneShot('/visuals/ability_icons/Electrophoresis.webm'),
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'luster_purge_burst') {
        this.vfxEffects.push({
          kind: 'luster_purge_burst',
          x: ev.x,
          y: ev.y,
          tick: 0,
          maxTick: 28,
          maxSize: HEX_SIZE * 8.0,   // 3-hex blast
          filter: LATIOS_BLUE_FILTER,
          glow: LATIOS_BLUE_GLOW,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'mist_ball_burst') {
        this.vfxEffects.push({
          kind: 'luster_purge_burst',
          x: ev.x,
          y: ev.y,
          tick: 0,
          maxTick: 28,
          maxSize: HEX_SIZE * 5.6,   // 2-hex blast
          filter: LATIAS_RED_FILTER,
          glow: LATIAS_RED_GLOW,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'tapukoko_chain') {
        this.vfxEffects.push({
          kind: 'tapukoko_chain',
          unitId: ev.unitId,
          x: ev.x,
          y: ev.y,
          fromX: ev.fromX,
          fromY: ev.fromY,
          tick: 0,
          maxTick: 20,
          empowered: ev.empowered,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'shadow_punch_appear') {
        this.vfxEffects.push({
          kind: 'shadow_punch_ghost',
          sourceId: ev.sourceId,
          primaryTargetId: ev.targetId,
          dirX: ev.dirX,
          dirY: ev.dirY,
          tick: 0,
          maxTick: 99999,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'shadow_punch_fly') {
        const FLY_TICKS = 22
        for (const e of this.vfxEffects) {
          if (e.kind === 'shadow_punch_ghost' && e.sourceId === ev.sourceId && e.firedAt === undefined) {
            e.firedAt = e.tick
            e.maxTick = e.tick + FLY_TICKS
          }
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'shadow_punch_strike') {
        const srcPos = _unitPositions.get(ev.sourceId)
        const tgtPos = _unitPositions.get(ev.targetId)
        if (srcPos) {
          const STRIKE_TICKS = 18
          let totalDist = HEX_SIZE * 2.0
          if (tgtPos) {
            const dx = tgtPos.x - srcPos.x
            const dy = tgtPos.y - srcPos.y
            totalDist = Math.sqrt(dx * dx + dy * dy) + HEX_SIZE * 0.8
          }
          this.vfxEffects.push({
            kind: 'shadow_punch_strike',
            x: srcPos.x,
            y: srcPos.y,
            dirX: ev.dirX,
            dirY: ev.dirY,
            speed: totalDist / STRIKE_TICKS,
            angle: Math.atan2(ev.dirY, ev.dirX),
            tick: 0,
            maxTick: STRIKE_TICKS,
          })
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'sneasler_dire_claw') {
        this.vfxEffects.push({
          kind:         'dire_claw',
          hexPositions: ev.hexPositions,
          angle:        ev.angle,
          tick:         0,
          maxTick:      28,
        })
      }
      if (ev.type === 'vfx' && ev.effectId === 'h_avalugg_avalanche') {
        for (const pos of ev.positions) {
          this.vfxEffects.push({
            kind:       'avalanche_fall',
            unitId:     pos.unitId,
            x:          pos.x,
            y:          pos.y,
            tick:       0,
            maxTick:    ev.hoverTicks + 18,
            hoverTicks: ev.hoverTicks,
          })
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'h_avalugg_impact') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'slam_land', remaining: 28, total: 28 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'excadrill_land') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'excadrill_land', remaining: 20, total: 20 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'mamoswine_thick_fat_start') {
        // Replace any existing thick_fat effect for this unit (recast)
        this.vfxEffects = this.vfxEffects.filter(e => {
          if (e.kind === 'thick_fat' && (e as ThickFatEffect).unitId === ev.unitId) {
            e.video.pause(); e.video.remove(); return false
          }
          return true
        })
        const v = spawnOneShot('/visuals/ability_icons/thick_fat.webm')
        v.loop = true
        this.vfxEffects.push({ kind: 'thick_fat', unitId: ev.unitId, tick: 0, maxTick: 5 * TICK_RATE, video: v })
        this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 28, total: 28 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'mamoswine_thick_fat_end') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'shake', remaining: 18, total: 18 })
      }
      if (ev.type === 'vfx' && ev.effectId === 'abomasnow_blizzard_start') {
        // Big burst blizzard — short-lived, just for the cast animation
        if (!this.vfxEffects.some(e => e.kind === 'blizzard' && (e as BlizzardEffect).zoneId === ev.zoneId)) {
          const v = spawnOneShot('/visuals/ability_icons/blizzard.webm')
          this.vfxEffects.push({ kind: 'blizzard', x: ev.x, y: ev.y, zoneId: ev.zoneId, tick: 0, maxTick: 35, video: v })
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'abomasnow_blizzard_unit') {
        // Mini blizzard that follows the affected unit for the blizzard duration
        const v = spawnOneShot('/visuals/ability_icons/blizzard.webm')
        v.loop = true
        this.vfxEffects.push({ kind: 'blizzard_unit', targetId: ev.targetId, zoneId: ev.zoneId, tick: 0, maxTick: 4 * TICK_RATE, video: v })
      }
    }
  }

  /** Returns active cast animations for unitLayer to apply as sprite nudges. */
  getCastAnimations(): CastAnimation[] {
    return this.castAnimations
  }

  /** Cuts off all in-flight cast animations (shake/spin/rumble/dart/etc.) —
   * used at combat end so the victory-bob hop isn't fighting a leftover
   * ability animation on units that survived mid-cast. */
  clearCastAnimations(): void {
    this.castAnimations = []
  }

  /** Returns unit IDs currently in the heal-flash window, with alpha 0–1. */
  getHealFlashUnits(): Map<string, number> {
    const out = new Map<string, number>()
    for (const [id, remaining] of this.healFlashTicks) {
      if (remaining > 0) out.set(id, remaining / 45)
    }
    return out
  }

  draw(state: CombatState): void {
    const ctx = this.ctx
    // Reset to identity for a full clear, then shift all drawing down by the
    // headroom. The effect canvas carries the same top headroom as the unit
    // canvas (grown upward, drawing shifted down by the same amount) so
    // above-head VFX like Celebi / Spiritomb marks on a top-row unit aren't
    // clipped. The ground canvas is separate and stays un-shifted.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.translate(0, OVERLAY_HEADROOM)

    // Draw ground-level VFX (under units) on the ground canvas
    if (this.groundCtx && this.groundCanvas) {
      const gctx = this.groundCtx
      gctx.clearRect(0, 0, this.groundCanvas.width, this.groundCanvas.height)
      gctx.save()
      gctx.scale(1, BOARD_PERSP_Y)  // match unitLayer perspective
      for (const effect of this.vfxEffects) {
        if (effect.kind === 'blizzard')        this.drawBlizzard(gctx, effect, state)
        if (effect.kind === 'blizzard_unit')   this.drawBlizzardUnit(gctx, effect as BlizzardUnitEffect, state)
        if (effect.kind === 'thick_fat')  this.drawThickFat(gctx, effect, state)
      }
      gctx.restore()
    }

    this.animTick++

    ctx.save()
    ctx.scale(1, BOARD_PERSP_Y)

    // ── Planted leech seeds — icon at bottom of seeded unit's sprite ──────────
    if (leechSeedVideo.readyState >= 2) {
      for (const unit of state.units.values()) {
        if (unit.state === 'dead') continue
        const isSeeded = unit.statusEffects.some(fx => fx.id === 'leech_seed')
        if (!isSeeded) continue
        const seedSize = 40
        const bottomY  = unit.visualPos.y + UNIT_RADIUS * 0.9
        ctx.drawImage(leechSeedVideo,
          unit.visualPos.x - seedSize / 2,
          bottomY - seedSize / 2,
          seedSize, seedSize)
      }
    }

    // ── Tick down heal flash + cast animations ────────────────────────────────
    for (const [unitId, remaining] of this.healFlashTicks) {
      if (remaining <= 0) this.healFlashTicks.delete(unitId)
      else this.healFlashTicks.set(unitId, remaining - 1)
    }
    this.castAnimations = this.castAnimations
      .map(a => ({ ...a, remaining: a.remaining - 1 }))
      .filter(a => a.remaining > 0)

    // ── Drain projectiles (visual-only seeds flying to Venusaur) ─────────────
    const drainImg = getLeechDrainCanvas()
    const aliveDrain: DrainProjectile[] = []
    for (const dp of this.drainProjectiles) {
      const venusaur = state.units.get(dp.venusaurId)
      if (!venusaur || venusaur.state === 'dead') continue
      const tx = venusaur.visualPos.x
      const ty = venusaur.visualPos.y
      const dx = tx - dp.currentPos.x
      const dy = ty - dp.currentPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= dp.speed + 8) {
        // Arrived — trigger heal flash on Venusaur
        const cur = this.healFlashTicks.get(dp.venusaurId) ?? 0
        this.healFlashTicks.set(dp.venusaurId, Math.max(cur, 45))
      } else {
        dp.currentPos.x += (dx / dist) * dp.speed
        dp.currentPos.y += (dy / dist) * dp.speed
        if (drainImg) {
          const sz = 22
          ctx.drawImage(drainImg, dp.currentPos.x - sz / 2, dp.currentPos.y - sz / 2, sz, sz)
        }
        aliveDrain.push(dp)
      }
    }
    this.drainProjectiles = aliveDrain

    // ── Projectiles ───────────────────────────────────────────────────────────
    for (const proj of state.projectiles.values()) {
      this.drawProjectile(ctx, proj, state)
    }

    // ── VFX effects ───────────────────────────────────────────────────────────
    const aliveVfx: VfxEffect[] = []
    for (const effect of this.vfxEffects) {
      effect.tick++
      if (effect.tick > effect.maxTick) {
        if (effect.kind === 'beak_blast' || effect.kind === 'tornado' || effect.kind === 'sand_shake' || effect.kind === 'whirlpool' || effect.kind === 'white_smoke' || effect.kind === 'blast_burn_mark' || effect.kind === 'blast_burn_detonate' || effect.kind === 'boomburst_burst' || effect.kind === 'bellibolt_discharge' || effect.kind === 'tapulele_psystrike' || effect.kind === 'celebi_fs_mark' || effect.kind === 'destiny_mark' || effect.kind === 'wandering_spirit_arm' || effect.kind === 'ancient_power_cast' || effect.kind === 'blizzard' || effect.kind === 'blizzard_unit' || effect.kind === 'thick_fat') {
          effect.video.pause()
          effect.video.remove()
        }
        // dragon_slam uses a static image — no cleanup needed
        continue
      }

      switch (effect.kind) {
        case 'discharge_row':    this.drawDischargeRow(ctx, effect); break
        case 'beak_blast':       this.drawBeakBlast(ctx, effect);    break
        case 'tornado':          this.drawTornado(ctx, effect);      break
        case 'cast_glow':        this.drawCastGlow(ctx, effect, state); break
        case 'leaf_shield':      this.drawLeafShield(ctx, effect, state); break
        case 'sand_shake':       this.drawSandShake(ctx, effect, state);    break
        case 'whirlpool':          this.drawWhirlpool(ctx, effect, state);       break
        case 'white_smoke':        this.drawWhiteSmoke(ctx, effect, state);      break
        case 'cannon_explosion':    this.drawCannonExplosion(ctx, effect);           break
        case 'smog_puff':           this.drawSmogPuff(ctx, effect);                 break
        case 'blast_burn_mark':     this.drawBlastBurnMark(ctx, effect, state);     break
        case 'blast_burn_detonate': this.drawBlastBurnDetonate(ctx, effect, state); break
        case 'boomburst_burst':     this.drawBoomburstBurst(ctx, effect); break
        case 'dragon_slam':             this.drawDragonSlam(ctx, effect);               break
        case 'bellibolt_discharge':     this.drawBelliboltDischarge(ctx, effect, state); break
        case 'tapukoko_chain':          this.drawTapuKokoChain(ctx, effect, state);      break
        case 'latios_charge':           this.drawLatiosCharge(ctx, effect, state);       break
        case 'luster_purge_burst':      this.drawLusterPurgeBurst(ctx, effect);          break
        case 'quagsire_shield_pop':         this.drawQuagsireShieldPop(ctx, effect);              break
        case 'tapulele_psystrike':          this.drawPsystrike(ctx, effect, state);               break
        case 'celebi_fs_mark':              this.drawCelebiFsMark(ctx, effect, state);             break
        case 'unown_electric_ring':         this.drawUnownElectricRing(ctx, effect);               break
        case 'absol_night_slash':           this.drawAbsolNightSlash(ctx, effect, state);           break
        case 'shadow_bone_fire':            this.drawShadowBoneFire(ctx, effect);                  break
        case 'destiny_mark':                this.drawDestinyMark(ctx, effect, state);               break
        case 'wandering_spirit_arm':         this.drawWanderingSpiritArm(ctx, effect, state);         break
        case 'shadow_punch_ghost':           this.drawShadowPunchGhost(ctx, effect, state);           break
        case 'shadow_punch_strike':          this.drawShadowPunchStrike(ctx, effect);                  break
        case 'dire_claw':                    this.drawDireClaw(ctx, effect);                           break
        case 'ancient_power_cast':           this.drawAncientPowerCast(ctx, effect, state);            break
        case 'avalanche_fall':               this.drawAvalancheFall(ctx, effect, state);               break
        case 'blizzard':                     break  // drawn on ground canvas in draw() preamble
        case 'blizzard_unit':                break  // drawn on ground canvas in draw() preamble
        case 'thick_fat':                    break  // drawn on ground canvas in draw() preamble
      }
      aliveVfx.push(effect)
    }
    this.vfxEffects = aliveVfx

    // ── Floating numbers ──────────────────────────────────────────────────────
    const alive: FloatingNumber[] = []
    for (const f of this.floaters) {
      f.tick++
      if (f.tick > f.maxTick) continue

      const progress = f.tick / f.maxTick
      const alpha    = progress < 0.5 ? 1 : 1 - (progress - 0.5) / 0.5
      const rise     = progress * 30

      ctx.globalAlpha = alpha
      ctx.font = `bold ${f.text.endsWith('!') ? 14 : 12}px sans-serif`
      ctx.fillStyle   = f.color
      ctx.strokeStyle = '#000000'
      ctx.lineWidth   = 2
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText(f.text, f.x, f.y - rise)
      ctx.fillText(f.text, f.x, f.y - rise)
      ctx.globalAlpha = 1

      alive.push(f)
    }
    this.floaters = alive

    ctx.restore()
  }

  // ─── Discharge Row (WebM) ─────────────────────────────────────────────────

  private drawDischargeRow(ctx: CanvasRenderingContext2D, effect: DischargeRowEffect): void {
    if (dischargeVideo.readyState < 2) return

    const progress = effect.tick / effect.maxTick
    // Fast flash-in, slow fade-out
    const alpha = progress < 0.12 ? progress / 0.12 : Math.max(0, 1 - (progress - 0.12) / 0.88)

    const rowCenter = hexToPixel({ col: 3, row: effect.targetRow }, HEX_SIZE).y
    const halfH     = HEX_SIZE * 1.2
    const topY      = rowCenter - halfH
    const rowH      = halfH * 2
    const W         = this.canvas.width

    // Tile the discharge video across the full row band
    const vidNatW = dischargeVideo.videoWidth  || 64
    const vidNatH = dischargeVideo.videoHeight || 64
    const tileW   = rowH * (vidNatW / vidNatH)   // scale to fit row height
    const tiles   = Math.ceil(W / tileW) + 1

    ctx.save()
    ctx.globalAlpha = alpha
    for (let i = 0; i < tiles; i++) {
      ctx.drawImage(dischargeVideo, i * tileW, topY, tileW, rowH)
    }
    ctx.restore()
  }

  // ─── Tornado (Tropius) ────────────────────────────────────────────────────

  private drawTornado(ctx: CanvasRenderingContext2D, effect: TornadoEffect): void {
    const SPEED = 7   // px per tick
    effect.x += effect.dirX * SPEED
    effect.y += effect.dirY * SPEED

    if (effect.video.readyState < 2) return
    const size = HEX_SIZE * 3
    ctx.drawImage(effect.video, effect.x - size / 2, effect.y - size / 2, size, size)
  }

  // ─── Beak Blast Explosion ─────────────────────────────────────────────────

  private drawBeakBlast(ctx: CanvasRenderingContext2D, effect: BeakBlastEffect): void {
    const vid = effect.video
    if (vid.readyState < 2) return
    const size = HEX_SIZE * 5.0
    ctx.drawImage(vid, effect.x - size / 2, effect.y - size / 2, size, size)
  }

  // ─── Sand Shake (Palossand) ───────────────────────────────────────────────

  private drawSandShake(ctx: CanvasRenderingContext2D, effect: SandShakeEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (unit?.state === 'dead') { effect.tick = effect.maxTick + 1; return }
    const vid = effect.video
    if (vid.readyState < 2) return
    const cx = unit ? unit.visualPos.x : effect.x
    const cy = unit ? unit.visualPos.y : effect.y
    const size = HEX_SIZE * 0.85
    const shakeX = Math.sin(effect.tick * 0.5) * 11
    const baseY = cy + HEX_SIZE * 0.5
    ctx.drawImage(vid, cx - size / 2 + shakeX, baseY - size / 2, size, size)
  }

  // ─── White Smoke (Torkoal) ───────────────────────────────────────────────

  private drawWhiteSmoke(ctx: CanvasRenderingContext2D, effect: WhiteSmokeEffect, state?: CombatState): void {
    const unit = state?.units.get(effect.unitId)
    if (!unit || unit.state === 'dead') {
      effect.tick = effect.maxTick + 1
      return
    }
    const vid = effect.video
    if (vid.readyState < 2) return
    const size = HEX_SIZE * 1.8
    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.drawImage(vid, unit.visualPos.x - size / 2, unit.visualPos.y - size / 2, size, size)
    ctx.restore()
  }

  // ─── Cannon Explosion (Armarouge) ────────────────────────────────────────

  private drawCannonExplosion(ctx: CanvasRenderingContext2D, effect: CannonExplosionEffect): void {
    if (!armorCannonExplosionImg.complete || !armorCannonExplosionImg.naturalWidth) return
    const t = effect.tick / effect.maxTick
    const maxSize = effect.large ? HEX_SIZE * 4.5 : HEX_SIZE * 2.8
    const size = HEX_SIZE * 0.4 + maxSize * t  // expands from small to large
    const alpha = 0.75 * (1 - t)               // fades out as it expands
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(armorCannonExplosionImg, effect.x - size / 2, effect.y - size / 2, size, size)
    ctx.restore()
  }

  // ─── Smog Puff (Wheezing) ────────────────────────────────────────────────

  private drawSmogPuff(ctx: CanvasRenderingContext2D, effect: SmogPuffEffect): void {
    if (!smogImg.complete || !smogImg.naturalWidth) return
    const t = effect.tick / effect.maxTick
    const size = HEX_SIZE * (0.35 + 0.3 * t)
    const alpha = 0.85 * (1 - t * 0.7)
    effect.x += effect.dirX
    effect.y += effect.dirY
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(effect.x, effect.y)
    ctx.rotate(effect.angle)  // right side of image faces outward
    ctx.drawImage(smogImg, -size / 2, -size / 2, size, size)
    ctx.restore()
  }

  // ─── Destiny Mark (loops on marked enemy while effect is active) ────────────

  private drawDestinyMark(ctx: CanvasRenderingContext2D, effect: DestinyMarkEffect, state: CombatState): void {
    const unit      = state.units.get(effect.unitId)
    const spiritomb = state.units.get(effect.spiritombId)
    const isActive  = unit && unit.state !== 'dead'
                   && spiritomb && spiritomb.state !== 'dead'
                   && unit.statusEffects.some(fx => fx.stackId === 'spiritomb_destiny_mark')
    if (!isActive) { effect.tick = effect.maxTick + 1; return }
    if (effect.video.readyState < 2) return
    const size   = HEX_SIZE * 0.55
    const barTop = unit.visualPos.y - HEX_SIZE * 0.80 - 16
    ctx.drawImage(effect.video, unit.visualPos.x - size / 2, barTop - size, size, size)
  }

  // ─── Wandering Spirit arm (Runerigus) ────────────────────────────────────
  // Stretches from Runerigus to the marked enemy, hand-end always touching the
  // target; rumbles briefly and fades out the moment the mark is consumed.

  private drawWanderingSpiritArm(ctx: CanvasRenderingContext2D, effect: WanderingSpiritArmEffect, state: CombatState): void {
    const source = state.units.get(effect.sourceId)
    const target = state.units.get(effect.targetId)
    const stillMarked = target?.statusEffects.some(fx => fx.stackId === 'runerigus_wandering_spirit') ?? false
    const isActive = !!source && source.state !== 'dead' && !!target && target.state !== 'dead'
                  && (effect.consumeAt !== undefined || stillMarked)
    if (!isActive) { effect.tick = effect.maxTick + 1; return }
    if (effect.video.readyState < 2) return

    let tx = target!.visualPos.x
    let ty = target!.visualPos.y

    if (effect.consumeAt !== undefined) {
      const shakeElapsed = effect.tick - effect.consumeAt
      const decay = Math.max(0, 1 - shakeElapsed / 14)
      const intensity = decay * 6
      tx += Math.sin(effect.tick * 1.7) * intensity
      ty += Math.cos(effect.tick * 1.4 + 0.5) * intensity
    }

    const sx = source!.visualPos.x
    const sy = source!.visualPos.y
    const fullDx = tx - sx
    const fullDy = ty - sy
    const fullDist = Math.sqrt(fullDx * fullDx + fullDy * fullDy)
    if (fullDist < 1) return
    const angle = Math.atan2(fullDy, fullDx)

    // Grow the arm out from Runerigus to the target over a short window after the
    // charge/lunge settles, rather than popping in at full length.
    const GROW_DELAY = 12
    const GROW_TICKS = 16
    const growElapsed = effect.tick - GROW_DELAY
    if (growElapsed <= 0) return
    const growT = Math.min(1, growElapsed / GROW_TICKS)
    const growEase = 1 - (1 - growT) * (1 - growT)  // ease-out
    const dist = fullDist * growEase

    if (dist < 4) return

    const vw = effect.video.videoWidth
    const vh = effect.video.videoHeight
    if (!vw || !vh) return

    const armHeight  = HEX_SIZE * 0.42
    const handLen    = HEX_SIZE * 0.55   // fixed on-screen size — never stretched
    const handHeight = armHeight * 1.7
    const overshoot  = HEX_SIZE * 0.15   // pushes the hand past the target's center so it sits over the sprite, not just touching its tip
    const handSrcFrac = 0.35             // left ~35% of the source video is the hand; the rest is the tapering tendril

    const handSrcW = vw * handSrcFrac
    const tendrilSrcW = vw - handSrcW

    const handEndX   = dist + overshoot          // farthest reach (fingertips), past the target
    const handStartX = handEndX - handLen        // wrist, where the hand meets the tendril
    const tendrilLen = Math.max(0, handStartX)   // stretches to fill the rest of the gap back to Runerigus

    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(angle)
    // Pivot at the hand's farthest reach point, then mirror so the video's native left
    // edge (fingertips) lands there while everything else trails back toward Runerigus.
    ctx.translate(handEndX, 0)
    ctx.scale(-1, 1)
    // Hand: drawn at a fixed size (no stretch) so it stays proportioned over the target.
    ctx.drawImage(effect.video, 0, 0, handSrcW, vh, 0, -handHeight / 2, handLen, handHeight)
    // Tendril: the only part that stretches, filling the gap between the hand and Runerigus.
    if (tendrilLen > 0) {
      ctx.drawImage(effect.video, handSrcW, 0, tendrilSrcW, vh, handLen, -armHeight / 2, tendrilLen, armHeight)
    }
    ctx.restore()
  }

  // ─── Blast Burn mark (follows marked unit, loops until mark is gone) ─────

  private drawBlastBurnMark(ctx: CanvasRenderingContext2D, effect: BlastBurnMarkEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (!unit || unit.state === 'dead' || !unit.marks.some(m => m.id === 'charizard_flame_mark')) {
      effect.tick = effect.maxTick + 1
      return
    }
    if (effect.video.readyState < 2) return
    const size = HEX_SIZE * 0.45
    // Position above the HP bar: cy - SPRITE_HALF(0.80) - ABOVE_GAP(4) - totalBarH(10) - size/2 - 2
    const barTop = unit.visualPos.y - HEX_SIZE * 0.80 - 16
    ctx.drawImage(effect.video, unit.visualPos.x - size / 2, barTop - size, size, size)
  }

  // ─── Blast Burn detonate (one-shot explosion on the unit) ─────────────────

  private drawBlastBurnDetonate(ctx: CanvasRenderingContext2D, effect: BlastBurnDetonateEffect, state: CombatState): void {
    if (effect.video.readyState < 2) return
    const unit = state.units.get(effect.unitId)
    const x = unit?.visualPos.x ?? effect.x
    const y = unit?.visualPos.y ?? effect.y
    const t = effect.tick / effect.maxTick
    const size = HEX_SIZE * (1.4 + t * 0.6)
    const alpha = 1 - t * 0.4
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(effect.video, x - size / 2, y - size / 2 - HEX_SIZE * 0.2, size, size)
    ctx.restore()
  }

  // ─── Tapu Lele psystrike (one-shot webm centered over target) ───────────────

  private drawPsystrike(ctx: CanvasRenderingContext2D, effect: PsystrikeEffect, state: CombatState): void {
    const unit = state.units.get(effect.targetId)
    if (!unit || unit.state === 'dead') { effect.tick = effect.maxTick + 1; return }
    if (effect.video.readyState < 2) return
    const size = HEX_SIZE * 2.4
    ctx.save()
    ctx.translate(unit.visualPos.x, unit.visualPos.y)
    ctx.rotate(effect.rotation)
    ctx.drawImage(effect.video, -size / 2, -size / 2, size, size)
    ctx.restore()
  }

  // ─── Celebi Future Sight mark (floats above unit, descends before detonation) ──

  private drawCelebiFsMark(ctx: CanvasRenderingContext2D, effect: CelebiFsMarkEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (!unit || unit.state === 'dead' || !unit.marks.some(m => m.id.startsWith('celebi_mark_'))) {
      effect.tick = effect.maxTick + 1
      return
    }
    if (effect.video.readyState < 2) return

    const progress = effect.tick / effect.maxTick  // 0 → 1 over 2 seconds
    const DESCENT_START = 0.86  // only last 14% → very fast snap down

    if (progress < DESCENT_START) {
      // Float above the unit (above HP bar, same anchor as blast_burn_mark)
      const size   = HEX_SIZE * 0.55
      const barTop = unit.visualPos.y - HEX_SIZE * 0.80 - 16
      ctx.drawImage(effect.video, unit.visualPos.x - size / 2, barTop - size, size, size)
    } else {
      // Fast descent onto unit — grows 200% (×3 the hover size)
      const t         = (progress - DESCENT_START) / (1 - DESCENT_START)  // 0→1 in last 14%
      const ease      = t * t
      const startSize = HEX_SIZE * 0.55
      const endSize   = HEX_SIZE * 3.8                                     // 200% growth
      const size      = startSize + (endSize - startSize) * ease
      const barTop    = unit.visualPos.y - HEX_SIZE * 0.80 - 16
      const startY    = barTop - startSize / 2
      const endY      = unit.visualPos.y
      const cy        = startY + (endY - startY) * ease
      ctx.save()
      ctx.globalAlpha = 1 - ease * 0.15
      ctx.drawImage(effect.video, unit.visualPos.x - size / 2, cy - size / 2, size, size)
      ctx.restore()
    }
  }

  // ─── Whirlpool (Tapu Fini) ────────────────────────────────────────────────

  private drawWhirlpool(ctx: CanvasRenderingContext2D, effect: WhirlpoolEffect, state?: CombatState): void {
    const unit = state?.units.get(effect.unitId)
    const fini = state?.units.get(effect.sourceId)
    // Kill effect if target is dead/unwhirlpooled OR if Tapu Fini herself died
    if (!unit || unit.state === 'dead' || !unit.whirlpooled || fini?.state === 'dead') {
      effect.tick = effect.maxTick + 1
      return
    }
    const vid = effect.video
    if (vid.readyState < 2) return
    const w = HEX_SIZE * 1.6
    const h = HEX_SIZE * 0.9
    const baseY = unit.visualPos.y + HEX_SIZE * 0.5
    ctx.drawImage(vid, unit.visualPos.x - w / 2, baseY - h / 2, w, h)
  }

  // ─── Cast Glow ────────────────────────────────────────────────────────────

  private drawCastGlow(ctx: CanvasRenderingContext2D, effect: CastGlowEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (!unit || unit.state === 'dead') return

    const progress    = effect.tick / effect.maxTick
    const alpha       = 1 - progress
    const pulseRadius = UNIT_RADIUS + 4 + progress * 20

    const isPlayer = unit.team === 'player'
    ctx.beginPath()
    ctx.arc(unit.visualPos.x, unit.visualPos.y, pulseRadius, 0, Math.PI * 2)
    ctx.strokeStyle = isPlayer
      ? `rgba(100,180,255,${alpha * 0.9})`
      : `rgba(255,100,100,${alpha * 0.9})`
    ctx.lineWidth = 3 - progress * 2
    ctx.stroke()
  }

  // ─── Leaf Shield (Tangela) ────────────────────────────────────────────────

  private drawLeafShield(ctx: CanvasRenderingContext2D, effect: LeafShieldEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (!unit || unit.state === 'dead') return
    if (!leafImg.complete || leafImg.naturalWidth === 0) return

    const totalShield = unit.shields.reduce((s, sh) => s + sh.value, 0)

    // Only start watching for expiry once the shield has actually been applied
    if (totalShield > 0) {
      effect.shieldSeen = true
    } else if (effect.shieldSeen && effect.shieldExpiredTick === undefined) {
      effect.shieldExpiredTick = effect.tick
    }

    const FADE_IN  = 8
    const FADE_OUT = 20
    let alpha: number
    if (effect.shieldExpiredTick !== undefined) {
      const elapsed = effect.tick - effect.shieldExpiredTick
      alpha = Math.max(0, 1 - elapsed / FADE_OUT)
      if (elapsed >= FADE_OUT) { effect.tick = effect.maxTick + 1; return }
    } else {
      alpha = Math.min(1, effect.tick / FADE_IN)
    }

    if (tangelaCastVideo.readyState < 2) return

    const size = 128
    ctx.globalAlpha = alpha
    ctx.drawImage(tangelaCastVideo, unit.visualPos.x - size / 2, unit.visualPos.y - size / 2, size, size)
    ctx.globalAlpha = 1
  }

  // ─── Projectile ───────────────────────────────────────────────────────────

  private drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile, state?: CombatState): void {
    if (proj.abilityId === 'tropius_leaf_tornado') return  // tornado visual handled by TornadoEffect

    // Resolved once: fixed-position projectiles have no targetId
    const projTarget = proj.targetId ? state?.units.get(proj.targetId) : undefined

    if (proj.abilityId === 'unown_hidden_power_ice' || proj.abilityId === 'unown_hidden_power_fire' || proj.abilityId === 'unown_hidden_power_electric') {
      const img = proj.abilityId === 'unown_hidden_power_ice'      ? hpIceImg
                : proj.abilityId === 'unown_hidden_power_fire'     ? hpFireImg
                                                                    : hpElectricImg
      const size = 44
      if (img.complete && img.naturalWidth > 0) {
        // Spin the icon as it travels
        const target = projTarget
        const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
        const ty = target?.visualPos.y ?? proj.currentPos.y
        const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
        ctx.save()
        ctx.translate(proj.currentPos.x, proj.currentPos.y)
        ctx.rotate(angle)
        ctx.drawImage(img, -size / 2, -size / 2, size, size)
        ctx.restore()
        return
      }
    }

    if (proj.abilityId === 'tapukoko_chain_carrier') return  // invisible companion — chain fires on landing

    if ((proj.abilityId === 'latios_luster_purge_orb' || proj.abilityId === 'latias_mist_ball_orb')
        && pollenPuffYellow.complete && pollenPuffYellow.naturalWidth > 0) {
      // Fully-charged orb arcing toward the enemy cluster — blue for Latios, red for Latias
      const isLatias = proj.abilityId === 'latias_mist_ball_orb'
      const dx = proj.currentPos.x - proj.startPos.x
      const dy = proj.currentPos.y - proj.startPos.y
      const travelled = Math.sqrt(dx * dx + dy * dy)
      const t = proj.launchDist && proj.launchDist > 0 ? Math.min(1, travelled / proj.launchDist) : 0
      const arcOffset = (proj.arcHeight ?? 0) * Math.sin(Math.PI * t)
      const size = 64
      const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.06
      ctx.save()
      ctx.filter = isLatias ? LATIAS_RED_FILTER : LATIOS_BLUE_FILTER
      ctx.shadowColor = isLatias ? LATIAS_RED_GLOW : LATIOS_BLUE_GLOW
      ctx.shadowBlur  = 24
      ctx.drawImage(pollenPuffYellow,
        proj.currentPos.x - (size * pulse) / 2,
        proj.currentPos.y - arcOffset - (size * pulse) / 2,
        size * pulse, size * pulse)
      ctx.restore()
      return
    }

    if (proj.abilityId === 'tapukoko_bolt' || proj.abilityId === 'tapukoko_bolt_big'
        || proj.abilityId === 'tapukoko_bolt_surge') {
      // Cast-empowered bolt is the blue variant; every 3rd passive auto is big yellow
      const isSurge = proj.abilityId === 'tapukoko_bolt_surge'
      const img = isSurge ? surgeSurferBlueImg : surgeSurferImg
      if (!img.complete || img.naturalWidth === 0) return
      const target = projTarget
      const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const size = proj.abilityId === 'tapukoko_bolt' ? 26 : 46  // mini bolts; 3rd/empowered are big
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle - Math.PI * 0.25)   // bolt image points top-right; offset to aim tip at target
      ctx.drawImage(img, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if (proj.abilityId === 'a_raichu_surge_surfer' && surgeSurferImg.complete && surgeSurferImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const size = 36
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle - Math.PI * 0.25)   // bolt image points top-right; offset to aim tip at target
      ctx.drawImage(surgeSurferImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if (proj.abilityId === 'toucannon_beak_blast' && beakBlastImg.complete && beakBlastImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const size = 40
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle + Math.PI * 0.25)
      // Reflect across top-left→bottom-right diagonal (swap x↔y) to correct orientation
      ctx.transform(0, 1, 1, 0, 0, 0)
      ctx.drawImage(beakBlastImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }
    if (proj.abilityId === 'ribombee_pollen_puff') {
      const img  = proj.healPayload ? pollenPuffYellow : pollenPuffPink
      const size = 28
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, proj.currentPos.x - size / 2, proj.currentPos.y - size / 2, size, size)
        return
      }
    }

    if (proj.abilityId === 'stonjourner_power_spot' && powerSpotImg.complete && powerSpotImg.naturalWidth > 0) {
      const size = 48
      ctx.drawImage(powerSpotImg, proj.currentPos.x - size / 2, proj.currentPos.y - size / 2, size, size)
      return
    }

    if ((proj.abilityId === 'sableye_power_gem_damage' || proj.abilityId === 'sableye_power_gem_shield')
        && powerGemImg.complete && powerGemImg.naturalWidth > 0) {
      const size = 42
      ctx.save()
      if (proj.abilityId === 'sableye_power_gem_shield') {
        // Shift red gem → blue for shield cast
        ctx.filter = 'hue-rotate(220deg) saturate(2) brightness(1.2)'
      }
      ctx.drawImage(powerGemImg, proj.currentPos.x - size / 2, proj.currentPos.y - size / 2, size, size)
      ctx.restore()
      return
    }

    if (proj.abilityId === 'zubat_poison_sting' && poisonStingImg.complete && poisonStingImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const size = 32
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      // Image tip (ring) is at upper-right (~45° above horizontal) — offset by π/4 to align with target
      ctx.rotate(angle + Math.PI / 4)
      ctx.drawImage(poisonStingImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if ((proj.abilityId === 'oranguru_stored_power' || proj.abilityId === 'oranguru_stored_power_emp')
        && storedPowerImg.complete && storedPowerImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const isEmp = proj.abilityId === 'oranguru_stored_power_emp'
      const size = isEmp ? 52 : 34  // empowered is 50% bigger
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle)  // chevrons point right in image → no offset
      ctx.drawImage(storedPowerImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if ((proj.abilityId === 'morelull_strength_sap' || proj.abilityId === 'morelull_strength_sap_heal')
        && strengthSapImg.complete && strengthSapImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? (proj.currentPos.x + 1)
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const isHeal = proj.abilityId === 'morelull_strength_sap_heal'
      const size = isHeal ? 39 : 63
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle + Math.PI / 2)  // caps point up in image → +90° to aim cap at target
      if (isHeal) ctx.filter = 'hue-rotate(100deg) saturate(2.5) brightness(0.85)'
      ctx.drawImage(strengthSapImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if ((proj.abilityId === 'blast_burn_fireball' || proj.abilityId === 'blast_burn_powerful_fireball' || proj.abilityId === 'blast_burn_execute_fireball') && fireballImg.complete && fireballImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? proj.currentPos.x
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const size = proj.abilityId === 'blast_burn_execute_fireball' ? 96
                 : proj.abilityId === 'blast_burn_powerful_fireball' ? 64
                 : 38
      ctx.save()
      if (proj.abilityId === 'blast_burn_execute_fireball') {
        ctx.filter = 'hue-rotate(210deg) saturate(2) brightness(1.2)'
      }
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle - Math.PI * 0.75)  // lower-left (head) of fireball.webp faces target
      ctx.drawImage(fireballImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    // Hydro Cannon: second shot + regular autos while blastoise_mode is active
    const isHydro = proj.abilityId === 'blastoise_hydro_cannons' ||
      (proj.abilityId === 'auto_attack' &&
        state?.units.get(proj.sourceId)?.statusEffects.some(fx => fx.id === 'blastoise_mode'))
    if (isHydro && hydrocannonImg.complete && hydrocannonImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? proj.currentPos.x
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      const size = 36
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle - Math.PI / 2)  // image points up; rotate to face target
      ctx.drawImage(hydrocannonImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if ((proj.abilityId === 'a_exeggutor_egg_bomb' || proj.abilityId === 'a_exeggutor_egg_bounce') && eggBombVideo.readyState >= 2) {
      const dx = proj.currentPos.x - proj.startPos.x
      const dy = proj.currentPos.y - proj.startPos.y
      const travelled = Math.sqrt(dx * dx + dy * dy)
      const t = proj.launchDist && proj.launchDist > 0 ? Math.min(1, travelled / proj.launchDist) : 0
      const arcOffset = (proj.arcHeight ?? 0) * Math.sin(Math.PI * t)
      const size = proj.abilityId === 'a_exeggutor_egg_bounce' ? 45 : 70
      ctx.drawImage(eggBombVideo,
        proj.currentPos.x - size / 2,
        proj.currentPos.y - size / 2 - arcOffset,
        size, size)
      return
    }

    if (proj.abilityId === 'typhlosion_eruption' && eruptionVideo.readyState >= 2) {
      const dx = proj.currentPos.x - proj.startPos.x
      const dy = proj.currentPos.y - proj.startPos.y
      const travelled = Math.sqrt(dx * dx + dy * dy)
      const t = proj.launchDist && proj.launchDist > 0 ? Math.min(1, travelled / proj.launchDist) : 0
      const arcOffset = (proj.arcHeight ?? 0) * Math.sin(Math.PI * t)
      const visualX = proj.currentPos.x
      const visualY = proj.currentPos.y - arcOffset
      const target = projTarget
      const tx = target?.visualPos.x ?? proj.currentPos.x
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - visualY, tx - visualX)
      const size = 70
      ctx.save()
      ctx.translate(visualX, visualY)
      ctx.rotate(angle - Math.PI / 2)  // tip of image points up; rotate to face target
      ctx.drawImage(eruptionVideo, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if (proj.abilityId === 'torkoal_white_smoke' && whiteSmokeVideo.readyState >= 2) {
      const size = 64
      ctx.drawImage(whiteSmokeVideo, proj.currentPos.x - size / 2, proj.currentPos.y - size / 2, size, size)
      return
    }

    // Armor Cannon beam (main cast) and cannon-mode auto attacks.
    // The auto's abilityId is baked into the projectile at launch (via AttackModifier.visualId)
    // so it persists in flight even after the 3-second window closes.
    const isCannonBeam = proj.abilityId === 'armarouge_armor_cannon'
    const isCannonAuto = proj.abilityId === 'armarouge_cannon_auto'
    if ((isCannonBeam || isCannonAuto) && armorCannonImg.complete && armorCannonImg.naturalWidth > 0) {
      const target = projTarget
      const tx = target?.visualPos.x ?? proj.currentPos.x
      const ty = target?.visualPos.y ?? proj.currentPos.y
      const angle = Math.atan2(ty - proj.currentPos.y, tx - proj.currentPos.x)
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      // Missile head is on the LEFT of the image; rotate so left (-x) faces target direction
      ctx.rotate(angle - Math.PI)
      if (isCannonBeam) {
        // Stretched horizontal: long blast feeling
        ctx.drawImage(armorCannonImg, -80, -32, 160, 64)
      } else {
        // Empowered auto: elongated along travel axis, narrow cross-section
        ctx.drawImage(armorCannonImg, -52, -22, 104, 44)
      }
      ctx.restore()
      return
    }

    // Ancient Power: spinning rock auto-attack (from buffed Aerodactyl) — full size.
    // Plain auto-attack projectiles have proj.abilityId === undefined; the 'auto_attack'
    // tag lives inside damagePayload.abilityId, so we check there instead.
    const isAncientPowerAuto = !proj.abilityId
      && proj.damagePayload?.abilityId === 'auto_attack'
      && state?.units.get(proj.sourceId)?.statusEffects.some(fx => fx.stackId === 'aerodactyl_ancient_power_applied')
    if (isAncientPowerAuto && ancientPowerSingleImg.complete && ancientPowerSingleImg.naturalWidth > 0) {
      const size = 36
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(this.animTick * 0.22)  // fast spin
      ctx.drawImage(ancientPowerSingleImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    // Ancient Power: bounced rock (passive — smaller, from target to farthest enemy)
    if (proj.abilityId === 'aerodactyl_ancient_power_rock'
        && ancientPowerSingleImg.complete && ancientPowerSingleImg.naturalWidth > 0) {
      const size = 30
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(this.animTick * 0.28)  // slightly faster spin for the smaller rock
      ctx.drawImage(ancientPowerSingleImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    // Frosslass Icy Wind: spinning snowflake travels in a line
    if (proj.abilityId === 'froslass_icy_wind' && icyWindImg.complete && icyWindImg.naturalWidth > 0) {
      const size = 38
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(this.animTick * 0.18)
      ctx.drawImage(icyWindImg, -size / 2, -size / 2, size, size)
      ctx.restore()
      return
    }

    if (proj.abilityId === 'venusaur_leech_seed' && leechSeedVideo.readyState >= 2) {
      // Arc: compute t from how far the seed has travelled
      const dx = proj.currentPos.x - proj.startPos.x
      const dy = proj.currentPos.y - proj.startPos.y
      const travelled = Math.sqrt(dx * dx + dy * dy)
      const t = proj.launchDist && proj.launchDist > 0 ? Math.min(1, travelled / proj.launchDist) : 0
      const arcOffset = (proj.arcHeight ?? 0) * Math.sin(Math.PI * t)
      const size = 32
      ctx.drawImage(leechSeedVideo,
        proj.currentPos.x - size / 2,
        proj.currentPos.y - size / 2 - arcOffset,
        size, size)
      return
    }

    // Per-unit auto-attack sprite (<definitionId>_auto.png), drawn with its tip pointed
    // at the target. Plain autos carry no proj.abilityId; the 'auto_attack' tag lives in
    // damagePayload. Units without an art file fall through to the default dot below.
    const autoSource = (!proj.abilityId && proj.damagePayload?.abilityId === 'auto_attack')
      ? state?.units.get(proj.sourceId) : undefined
    const autoImg = autoSource ? getAutoSprite(autoSource.definitionId) : undefined
    if (autoImg && autoImg.complete && autoImg.naturalWidth > 0) {
      // Heading toward the tracked target (fall back to travel direction)
      const tgt = proj.targetId ? state?.units.get(proj.targetId) : undefined
      let dirX = proj.currentPos.x - proj.startPos.x
      let dirY = proj.currentPos.y - proj.startPos.y
      if (tgt) { dirX = tgt.visualPos.x - proj.currentPos.x; dirY = tgt.visualPos.y - proj.currentPos.y }
      const len = Math.hypot(dirX, dirY) || 1
      dirX /= len; dirY /= len
      const angle = Math.atan2(dirX, -dirY)  // rotate the sprite's tip (image-up) toward the heading
      const H = AUTO_SPRITE_HEIGHT_OVERRIDES[autoSource!.definitionId] ?? AUTO_SPRITE_HEIGHT
      const W = H * (autoImg.naturalWidth / autoImg.naturalHeight)
      ctx.save()
      ctx.translate(proj.currentPos.x, proj.currentPos.y)
      ctx.rotate(angle)
      ctx.drawImage(autoImg, -W / 2, -H / 2, W, H)
      ctx.restore()
      return
    }

    ctx.beginPath()
    ctx.arc(proj.currentPos.x, proj.currentPos.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = proj.healPayload ? '#44ff88'
                  : proj.abilityId   ? '#cc88ff'
                                     : '#ffcc44'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 1
    ctx.stroke()
  }

  // ─── Boomburst (Noivern) ─────────────────────────────────────────────────
  // Plays the boomburst_soundwave.webm centered on Noivern. The WebM contains
  // 16 rays emanating from center at set angles, tips forming a clean circle.

  private drawBoomburstBurst(ctx: CanvasRenderingContext2D, effect: BoomburstBurstEffect): void {
    if (effect.video.readyState < 2) return
    const size = HEX_SIZE * 13
    const x    = effect.cx - size / 2
    const y    = effect.cy - size / 2

    // Top half — draw normally, clipped to the upper half of the bounding box
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, size, size / 2)
    ctx.clip()
    ctx.drawImage(effect.video, x, y, size, size)
    ctx.restore()

    // Bottom half — flip vertically around the centre, clipped to the lower half
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, effect.cy, size, size / 2)
    ctx.clip()
    ctx.translate(effect.cx, effect.cy)
    ctx.scale(1, -1)
    ctx.drawImage(effect.video, -size / 2, -size / 2, size, size)
    ctx.restore()
  }

  // ─── Dragon Slam (Rayquaza) ───────────────────────────────────────────────
  // Static explosion image centered on the slam hex, fading out over ~35 ticks.
  // Size covers the 2-hex AoE radius.

  private drawDragonSlam(ctx: CanvasRenderingContext2D, effect: DragonSlamEffect): void {
    if (!dragonSlamImg.complete || dragonSlamImg.naturalWidth === 0) return
    const alpha = (1 - effect.tick / effect.maxTick) * 1.2  // 30% more opaque at start (capped by globalAlpha clamp)
    const size  = HEX_SIZE * 7   // ~420px — covers 2-hex AoE radius
    ctx.save()
    ctx.globalAlpha = Math.min(alpha, 1.0)
    // Neon green tint: shift hue from red/yellow → green, boost saturation and brightness
    ctx.filter = 'hue-rotate(120deg) saturate(2.5) brightness(1.4)'
    ctx.drawImage(dragonSlamImg, effect.cx - size / 2, effect.cy - size / 2, size, size)
    ctx.restore()
  }

  // ─── Quagsire Shield Pop (Unaware) ──────────────────────────────────────

  private drawQuagsireShieldPop(ctx: CanvasRenderingContext2D, effect: QuagsireShieldPopEffect): void {
    if (unawarePopVideo.readyState < 2) return
    const t = effect.tick / effect.maxTick
    // BASE_SIZE matches the live shield bubble drawn in unitLayer
    const BASE = HEX_SIZE * 2.56   // matches unitLayer aura: SPRITE_HALF(0.8) * 3.2 = HEX_SIZE * 2.56

    // Four phases: grow → squash → stretch → shrink+fade
    let sx = 1, sy = 1, alpha = 1
    if (t < 0.28) {
      const p = t / 0.28
      const s = 1.0 + 1.3 * p          // 1.0 → 2.3
      sx = s; sy = s
    } else if (t < 0.50) {
      const p = (t - 0.28) / 0.22
      sx = 2.3 + 0.6 * p               // 2.3 → 2.9  (wide)
      sy = 2.3 - 0.9 * p               // 2.3 → 1.4  (squash)
    } else if (t < 0.72) {
      const p = (t - 0.50) / 0.22
      sx = 2.9 - 1.4 * p               // 2.9 → 1.5  (narrow)
      sy = 1.4 + 1.4 * p               // 1.4 → 2.8  (stretch)
    } else {
      const p = (t - 0.72) / 0.28
      sx    = 1.5 * (1 - p)
      sy    = 2.8 * (1 - p)
      alpha = 1 - p
    }

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(effect.x, effect.y)
    ctx.scale(sx, sy)
    ctx.drawImage(unawarePopVideo, -BASE / 2, -BASE / 2, BASE, BASE)
    ctx.restore()
  }

  // ─── Bellibolt Discharge (Electrophoresis) ───────────────────────────────

  private drawBelliboltDischarge(ctx: CanvasRenderingContext2D, effect: BelliboltDischargeEffect, state: CombatState): void {
    const vid = effect.video
    if (vid.readyState < 2) return
    const unit = state.units.get(effect.unitId)
    const cx = unit ? unit.visualPos.x : effect.x
    const cy = unit ? unit.visualPos.y : effect.y
    const size = HEX_SIZE * 5.5
    ctx.save()
    ctx.globalAlpha = 1.0
    ctx.drawImage(vid, cx - size / 2, cy - size / 2, size, size)
    ctx.restore()
  }

  // Jagged bolt arcing out of the struck unit toward each chained target —
  // yellow for the passive chain, blue for the cast-empowered chain.
  private drawLightningArc(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, alpha: number, empowered: boolean): void {
    const dx = toX - fromX, dy = toY - fromY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 4) return
    const segments = Math.max(3, Math.round(dist / 20))
    const nx = -dy / dist, ny = dx / dist  // perpendicular unit vector for jitter

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = empowered ? '#8FD6FF' : '#FFEA6E'
    ctx.shadowColor = empowered ? '#3B9EFF' : '#F5D94E'
    ctx.shadowBlur  = empowered ? 14 : 8
    ctx.lineWidth   = empowered ? 4.5 : 2.5
    ctx.lineJoin    = 'round'
    ctx.lineCap     = 'round'
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    for (let i = 1; i < segments; i++) {
      const p = i / segments
      const jitter = (Math.sin(i * 12.9898) * 43758.5453 % 1 - 0.5) * (empowered ? 16 : 10)
      ctx.lineTo(fromX + dx * p + nx * jitter, fromY + dy * p + ny * jitter)
    }
    ctx.lineTo(toX, toY)
    ctx.stroke()
    ctx.restore()
  }

  private drawTapuKokoChain(ctx: CanvasRenderingContext2D, effect: TapuKokoChainEffect, state: CombatState): void {
    // Struck unit itself has no arc — it's the source the lightning radiates
    // from, not a jump target
    const isJump = effect.fromX !== effect.x || effect.fromY !== effect.y
    if (!isJump) return

    const unit = state.units.get(effect.unitId)
    const cx = unit ? unit.visualPos.x : effect.x
    const cy = unit ? unit.visualPos.y : effect.y
    const t = effect.tick / effect.maxTick
    const alpha = Math.max(0, 1 - t)
    this.drawLightningArc(ctx, effect.fromX, effect.fromY, cx, cy, alpha, effect.empowered)
  }

  // Latios/Latias channel: tinted orb charging above the head, growing over the channel
  private drawLatiosCharge(ctx: CanvasRenderingContext2D, effect: LatiosChargeEffect, state: CombatState): void {
    if (!pollenPuffYellow.complete || pollenPuffYellow.naturalWidth === 0) return
    const unit = state.units.get(effect.unitId)
    // Orb dies with the channel — if no longer casting (interrupted/dead), drop it
    if (!unit || unit.state !== 'casting') { effect.tick = effect.maxTick + 1; return }

    const t    = Math.min(1, effect.tick / effect.maxTick)
    const size = 14 + (64 - 14) * t   // grows until very large by the end of the channel
    const cx   = unit.visualPos.x
    const cy   = unit.visualPos.y - HEX_SIZE * 1.15 - size * 0.3

    ctx.save()
    ctx.filter = effect.filter
    ctx.shadowColor = effect.glow
    ctx.shadowBlur  = 10 + 20 * t
    ctx.drawImage(pollenPuffYellow, cx - size / 2, cy - size / 2, size, size)
    ctx.restore()
  }

  // Luster Purge / Mist Ball burst: orb detonates and expands over the blast radius
  private drawLusterPurgeBurst(ctx: CanvasRenderingContext2D, effect: LusterPurgeBurstEffect): void {
    if (!pollenPuffYellow.complete || pollenPuffYellow.naturalWidth === 0) return
    const t = effect.tick / effect.maxTick
    const minSize = HEX_SIZE * 1.6
    const size  = minSize + (effect.maxSize - minSize) * Math.sqrt(t)  // fast initial expansion
    const alpha = Math.max(0, 1 - t)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.filter = effect.filter
    ctx.shadowColor = effect.glow
    ctx.shadowBlur  = 26
    ctx.drawImage(pollenPuffYellow, effect.x - size / 2, effect.y - size / 2, size, size)
    ctx.restore()
  }

  private drawUnownElectricRing(ctx: CanvasRenderingContext2D, effect: UnownElectricRingEffect): void {
    if (!hpElectricImg.complete || !hpElectricImg.naturalWidth) return
    const t      = effect.tick / effect.maxTick
    // Expand from half-size to ~1-hex radius coverage over the duration
    const minSize = HEX_SIZE * 1.2
    const maxSize = HEX_SIZE * 3.6   // covers the 1-hex neighbor ring
    const size   = minSize + (maxSize - minSize) * t
    const alpha  = Math.max(0, 1 - t)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(hpElectricImg, effect.x - size / 2, effect.y - size / 2, size, size)
    ctx.restore()
  }

  private drawShadowBoneFire(ctx: CanvasRenderingContext2D, effect: ShadowBoneFireEffect): void {
    if (effect.video.readyState < 2) return
    const t     = effect.tick / effect.maxTick
    const size  = HEX_SIZE * 2.8
    const alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(effect.video, effect.x - size / 2, effect.y - size / 2, size, size)
    ctx.restore()
  }

  private drawBlizzard(ctx: CanvasRenderingContext2D, effect: BlizzardEffect, _state: CombatState): void {
    if (effect.video.readyState < 2) return

    // Cover the full 1-hex radius; caller has already applied ctx.scale(1, BOARD_PERSP_Y)
    const SIZE  = HEX_SIZE * 6.0
    const fade  = effect.tick > effect.maxTick - 10 ? (effect.maxTick - effect.tick) / 10 : 1
    const alpha = Math.min(effect.tick / 10, 1) * fade

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.translate(effect.x, effect.y)
    ctx.drawImage(effect.video, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
    ctx.restore()
  }

  private drawBlizzardUnit(ctx: CanvasRenderingContext2D, effect: BlizzardUnitEffect, state: CombatState): void {
    const unit = state.units.get(effect.targetId)
    if (!unit || unit.state === 'dead') { effect.tick = effect.maxTick + 1; return }
    // Expire when the blizzard_chill status is gone (unit left range or effect was cleared)
    if (!unit.statusEffects.some(fx => fx.stackId?.includes(effect.zoneId) && fx.id === 'blizzard_chill')) {
      effect.tick = effect.maxTick + 1; return
    }
    if (effect.video.readyState < 2) return

    const SIZE  = HEX_SIZE * 2.6
    const alpha = Math.min(effect.tick / 12, 0.82)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(unit.visualPos.x, unit.visualPos.y)
    ctx.drawImage(effect.video, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
    ctx.restore()
  }

  private drawThickFat(ctx: CanvasRenderingContext2D, effect: ThickFatEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (!unit || unit.state === 'dead') { effect.tick = effect.maxTick + 1; return }
    // Expire early if the status effect has already been removed (e.g. combat ended)
    if (!unit.statusEffects.some(fx => fx.stackId === 'thick_fat')) { effect.tick = effect.maxTick + 1; return }
    if (effect.video.readyState < 2) return

    const SIZE  = HEX_SIZE * 2.975  // 3.5 * 0.85
    const alpha = effect.tick < 8 ? effect.tick / 8 : 1
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(unit.visualPos.x, unit.visualPos.y)
    ctx.drawImage(effect.video, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
    ctx.restore()
  }

  private drawAvalancheFall(ctx: CanvasRenderingContext2D, effect: AvalancheFallEffect, state: CombatState): void {
    if (!avalancheImg.complete || !avalancheImg.naturalWidth) return
    const unit = state.units.get(effect.unitId)
    const cx = unit ? unit.visualPos.x : effect.x
    const cy = unit ? unit.visualPos.y : effect.y
    const HOVER_Y = -85   // px above unit center (above health bar)
    const SIZE    = HEX_SIZE * 1.4

    let drawY: number, alpha = 1, sx = 1, sy = 1

    if (effect.tick < effect.hoverTicks) {
      const t      = effect.tick / effect.hoverTicks
      const appear = Math.min(1, effect.tick / 8)
      const bob    = Math.sin(t * Math.PI * 4) * 3
      drawY = cy + HOVER_Y + bob
      alpha = appear
    } else {
      const FALL   = effect.maxTick - effect.hoverTicks
      const ft     = (effect.tick - effect.hoverTicks) / FALL
      const ease   = ft * ft
      drawY = cy + HOVER_Y * (1 - ease)
      if (ft > 0.6) {
        const s = (ft - 0.6) / 0.4
        sx = 1 + s * 0.4
        sy = 1 - s * 0.35
      }
      alpha = ft > 0.8 ? 1 - (ft - 0.8) / 0.2 : 1
    }

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.translate(cx, drawY)
    ctx.scale(sx, sy)
    ctx.drawImage(avalancheImg, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
    ctx.restore()
  }

  private drawAbsolNightSlash(ctx: CanvasRenderingContext2D, effect: AbsolNightSlashEffect, state?: CombatState): void {
    if (!nightSlashImg.complete || !nightSlashImg.naturalWidth) return
    const unit = state?.units.get(effect.unitId)
    if (!unit || unit.state === 'dead') return
    const { x, y } = unit.visualPos
    const t     = effect.tick / effect.maxTick
    const angle = effect.startAngle + t * Math.PI * 2
    // Fade out over last 25%
    const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1

    // Blade base starts inside the sprite (negative innerR) and extends to the 1-hex ring
    const outerR   = HEX_SIZE * Math.sqrt(3)  // ~107px — center of adjacent hexes
    const innerR   = -8                        // base overlaps sprite so it appears to jut from his head
    const bladeLen = outerR - innerR           // ~115px

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x, y)
    ctx.rotate(angle)  // point radially outward in the sweep direction
    // Draw image as a square along the radial axis; half above, half below the line
    ctx.drawImage(nightSlashImg, innerR, -bladeLen * 0.5, bladeLen, bladeLen)
    ctx.restore()
  }

  private drawShadowPunchGhost(ctx: CanvasRenderingContext2D, effect: ShadowPunchGhostEffect, state: CombatState): void {
    if (!shadowPunchImg.complete || !shadowPunchImg.naturalWidth) return
    const target = state.units.get(effect.primaryTargetId)
    if (!target || target.state === 'dead') { effect.maxTick = 0; return }
    const source = state.units.get(effect.sourceId)
    if (!source || source.state === 'dead') { effect.maxTick = 0; return }

    const W = HEX_SIZE * 1.3
    const H = HEX_SIZE * 0.9
    const GHOST_DIST        = HEX_SIZE * 0.95
    const MATERIALIZE_TICKS = 120
    // Ghost faces toward the caster (into the target from behind)
    const ghostAngle = Math.atan2(-effect.dirY, -effect.dirX)
    // Ghost sits behind the target on the far side from the caster
    const ghostX = target.visualPos.x + effect.dirX * GHOST_DIST
    const ghostY = target.visualPos.y + effect.dirY * GHOST_DIST

    ctx.save()

    if (effect.firedAt === undefined) {
      // Materialize: 90% transparent → 0% transparent (alpha 0.10 → 1.0) over 2 seconds
      const alpha = 0.10 + Math.min(effect.tick / MATERIALIZE_TICKS, 1) * 0.90
      ctx.globalAlpha = alpha
      ctx.translate(ghostX, ghostY)
      ctx.rotate(ghostAngle)
      ctx.drawImage(shadowPunchImg, -W / 2, -H / 2, W, H)
    } else {
      // Fly: punch travels from behind the target through and past toward the caster
      const FLY_TICKS = effect.maxTick - effect.firedAt
      const t         = Math.min((effect.tick - effect.firedAt) / FLY_TICKS, 1)
      const ease      = 1 - (1 - t) * (1 - t)
      const endX      = target.visualPos.x - effect.dirX * HEX_SIZE * 1.5
      const endY      = target.visualPos.y - effect.dirY * HEX_SIZE * 1.5
      const alpha     = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1
      ctx.globalAlpha = alpha
      ctx.translate(ghostX + ease * (endX - ghostX), ghostY + ease * (endY - ghostY))
      ctx.rotate(ghostAngle)
      ctx.drawImage(shadowPunchImg, -W / 2, -H / 2, W, H)
    }

    ctx.restore()
  }

  private drawShadowPunchStrike(ctx: CanvasRenderingContext2D, effect: ShadowPunchStrikeEffect): void {
    if (!shadowPunchImg.complete || !shadowPunchImg.naturalWidth) return
    effect.x += effect.dirX * effect.speed
    effect.y += effect.dirY * effect.speed
    const t     = effect.tick / effect.maxTick
    const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1
    const W = HEX_SIZE * 1.3
    const H = HEX_SIZE * 0.9
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(effect.x, effect.y)
    ctx.rotate(effect.angle)
    ctx.drawImage(shadowPunchImg, -W / 2, -H / 2, W, H)
    ctx.restore()
  }

  private drawDireClaw(ctx: CanvasRenderingContext2D, effect: DireClawEffect): void {
    if (!direclawImg.complete || !direclawImg.naturalWidth) return

    // Center on the middle hex position
    const cx = effect.hexPositions.reduce((s, p) => s + p.x, 0) / effect.hexPositions.length
    const cy = effect.hexPositions.reduce((s, p) => s + p.y, 0) / effect.hexPositions.length

    // Quick fade-in (5 ticks), hold, fade-out over last 10 ticks
    let alpha: number
    if (effect.tick < 5) {
      alpha = effect.tick / 5
    } else if (effect.tick < effect.maxTick - 10) {
      alpha = 1
    } else {
      alpha = (effect.maxTick - effect.tick) / 10
    }

    // Span the 3-hex row perpendicular to the attack direction
    const W = HEX_SIZE * 3.0
    const H = HEX_SIZE * 2.2

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.translate(cx, cy)
    // Undo the outer BOARD_PERSP_Y scale before rotating so the angle isn't distorted
    // by the Y-squish, then re-apply it for the image itself.
    ctx.scale(1, 1 / BOARD_PERSP_Y)
    ctx.rotate(effect.angle - Math.PI / 2)  // flipped: outer curve faces away from Sneasler
    ctx.scale(1, BOARD_PERSP_Y)
    ctx.drawImage(direclawImg, -W / 2, -H / 2, W, H)
    ctx.restore()
  }

  private drawAncientPowerCast(ctx: CanvasRenderingContext2D, effect: AncientPowerCastEffect, state: CombatState): void {
    const unit = state.units.get(effect.unitId)
    if (!unit || unit.state === 'dead') {
      // Expire immediately so the video gets paused and removed
      effect.tick = effect.maxTick + 1
      return
    }
    if (effect.video.readyState < 2) return

    // Brief fade-in on cast; stays at full opacity for the rest of combat
    const alpha = effect.tick < 8 ? effect.tick / 8 : 1

    const size = HEX_SIZE * 3.8
    const { x, y } = unit.visualPos
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x, y)
    ctx.scale(1, BOARD_PERSP_Y)
    ctx.drawImage(effect.video, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
}
