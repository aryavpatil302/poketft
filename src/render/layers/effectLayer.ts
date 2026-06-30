import type { CombatState, CombatEvent } from '../../core/types'
import type { Projectile } from '../../core/types'
import { hexToPixel } from '../../core/hexGrid'
import { HEX_SIZE, BOARD_PERSP_Y } from '../../core/constants'

const leafImg = new Image()
leafImg.src = '/visuals/ability_icons/tangela_leaf.webp'

const dragonSlamImg = new Image()
dragonSlamImg.src = '/visuals/ability_icons/dragon-scent-slam.webp'

const poisonStingImg = new Image()
poisonStingImg.src = '/visuals/ability_icons/poison_sting.webp'

const powerGemImg = new Image()
powerGemImg.src = '/visuals/ability_icons/power_gem.webp'

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

const surgeSurferImg = new Image()
surgeSurferImg.src = '/visuals/ability_icons/Surge_Surfer.webp'
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

type VfxEffect = DischargeRowEffect | BeakBlastEffect | CastGlowEffect | LeafShieldEffect | TornadoEffect | SandShakeEffect | WhirlpoolEffect | WhiteSmokeEffect | CannonExplosionEffect | SmogPuffEffect | BlastBurnMarkEffect | BlastBurnDetonateEffect | BoomburstBurstEffect | DragonSlamEffect | BelliboltDischargeEffect | QuagsireShieldPopEffect | PsystrikeEffect | CelebiFsMarkEffect

interface DrainProjectile {
  currentPos: { x: number; y: number }
  venusaurId: string
  speed: number
}

export interface CastAnimation {
  unitId: string
  type: 'shake' | 'hop' | 'dart' | 'hold_hop' | 'flap' | 'bigShake' | 'cock_toss' | 'sway' | 'squash_launch' | 'hammer_swing' | 'spin'
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
  private floaters: FloatingNumber[] = []
  private vfxEffects: VfxEffect[]    = []
  private animTick = 0
  private healFlashTicks  = new Map<string, number>()
  private castAnimations: CastAnimation[] = []
  private drainProjectiles: DrainProjectile[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
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
        if (ev.abilityId === 'tangela_leaf_guard') {
          this.vfxEffects.push({ kind: 'leaf_shield', unitId: ev.unitId, tick: 0, maxTick: 360 })
          this.castAnimations.push({ unitId: ev.unitId, type: 'shake', remaining: 14, total: 14 })
        }
        if (ev.abilityId === 'venusaur_leech_seed') {
          this.castAnimations.push({ unitId: ev.unitId, type: 'hop', remaining: 20, total: 20 })
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
          // total=28: 20 frames lunge out (apex = cast time), 8 frames snap back
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 28, total: 28, apexAt: 20, dirX, dirY })
        }
        if (ev.abilityId === 'toucannon_beak_blast') {
          // castTimeTicks=20 → apexAt=20 so hop peaks exactly when shot fires
          this.castAnimations.push({ unitId: ev.unitId, type: 'hold_hop', remaining: 38, total: 38, apexAt: 20 })
        }
        if (ev.abilityId === 'tropius_leaf_tornado') {
          // 2 rapid up-down flaps during cast (total matches castTimeTicks + a little tail)
          this.castAnimations.push({ unitId: ev.unitId, type: 'flap', remaining: 26, total: 26 })
        }
        if (ev.abilityId === 'tapubulu_natures_madness') {
          // Big impactful shake to emphasize the size growth on transformation
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 32, total: 32 })
        }
        if (ev.abilityId === 'palossand_scorching_sands') {
          // Palossand shakes as it erupts the ground
          this.castAnimations.push({ unitId: ev.unitId, type: 'bigShake', remaining: 25, total: 25 })
        }
        if (ev.abilityId === 'a_exeggutor_egg_bomb') {
          // 30 ticks cock-back, 5 tick pause, 10 tick snap — egg launches at snap start
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
        if (ev.abilityId === 'typhlosion_eruption') {
          // Quick squash-then-stretch: squash down, snap tall to emphasize launch, recover
          this.castAnimations.push({ unitId: ev.unitId, type: 'squash_launch', remaining: 28, total: 28 })
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
          // Sharp fast lunge: quick snap forward (apex at 8), fast return
          this.castAnimations.push({ unitId: ev.unitId, type: 'dart', remaining: 18, total: 18, apexAt: 8, dirX, dirY })
        }
      }
      if (ev.type === 'vfx' && ev.effectId === 'marowak_hammer_swing') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'hammer_swing', remaining: 26, total: 26, dirX: ev.dirX, dirY: ev.dirY, swingDir: ev.swingDir })
      }
      if (ev.type === 'vfx' && ev.effectId === 'marowak_spin_strike') {
        this.castAnimations.push({ unitId: ev.unitId, type: 'spin', remaining: 18, total: 18 })
        // (fire effect handled by unitLayer via modifier check)
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
    }
  }

  /** Returns active cast animations for unitLayer to apply as sprite nudges. */
  getCastAnimations(): CastAnimation[] {
    return this.castAnimations
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
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
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
        if (effect.kind === 'beak_blast' || effect.kind === 'tornado' || effect.kind === 'sand_shake' || effect.kind === 'whirlpool' || effect.kind === 'white_smoke' || effect.kind === 'blast_burn_mark' || effect.kind === 'blast_burn_detonate' || effect.kind === 'boomburst_burst' || effect.kind === 'bellibolt_discharge' || effect.kind === 'tapulele_psystrike' || effect.kind === 'celebi_fs_mark') {
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
        case 'quagsire_shield_pop':         this.drawQuagsireShieldPop(ctx, effect);              break
        case 'tapulele_psystrike':          this.drawPsystrike(ctx, effect, state);               break
        case 'celebi_fs_mark':              this.drawCelebiFsMark(ctx, effect, state);             break
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

    if (proj.abilityId === 'a_raichu_surge_surfer' && surgeSurferImg.complete && surgeSurferImg.naturalWidth > 0) {
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
      const target = state?.units.get(proj.targetId)
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
}
