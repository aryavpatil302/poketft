import type { Unit } from '../../core/types'
import { HEX_SIZE, BOARD_PERSP_Y, WINDUP_HIT_FRACTION, TICK_RATE, OVERLAY_HEADROOM } from '../../core/constants'
import { hexToPixel } from '../../core/hexGrid'
import { UNIT_MAP } from '../../data/units'
import { ITEM_MAP } from '../../data/items'
import { windupTicks, attackCooldownTicks } from '../../core/systems/attack'

// Lazy image cache for equipped-item icons drawn beside units.
const itemIconCache = new Map<string, HTMLImageElement>()
function itemIcon(path: string): HTMLImageElement {
  let img = itemIconCache.get(path)
  if (!img) { img = new Image(); img.src = path; itemIconCache.set(path, img) }
  return img
}

const UNIT_RADIUS    = HEX_SIZE * 0.55
const SPRITE_HALF    = HEX_SIZE * 0.80   // sprite drawn as a square, 80% of hex size
const WAILORD_CAST_TICKS = 5   // must match castTimeTicks in wailord.ts
const DOT_SIZE       = 5
const DOT_GAP        = 3

// ─── Health bar layout (all drawn above the unit) ─────────────────────────────
const BAR_W       = HEX_SIZE * 1.1   // fixed width for all units
const HP_H        = 5                 // px height of HP bar
const MANA_H      = 3                 // px height of mana bar
const INTER_GAP   = 2                 // gap between HP bar and mana bar
const ABOVE_GAP   = 4                 // gap between unit top and bottom of mana bar
const HP_PER_TICK = 200               // HP each tick segment represents
const TICK_SEP    = 1                 // px gap between tick segments

// CC icons (stun/knockup) sit above the HP bar, left-aligned, stacking rightward
const CC_ICON_SIZE  = 26
const CC_ICON_GAP   = 3
const CC_ICON_Y_GAP = 3   // gap between icon bottom and top of HP bar

const STATUS_COLORS: Record<string, string> = {
  leech_seed:       '#22cc44',
  chill:            '#88ddff',
  atkSpd_buff:      '#88ff44',
  dmg_buff:         '#ff8866',
  burn:             '#ff3322',
  armorBuff:        '#aaaaaa',
  spDefBuff:        '#bb44ff',
  tapubulu_madness: '#00ffee',
}

// Melee strike animation constants
const MELEE_PULLBACK_PX = 10    // how far back before the lunge
const MELEE_STRIKE_PX   = 50   // how far forward at peak of strike
// Peak nudge (px) for ranged units — sinusoidal over the windup
const RANGED_JERK_PX = 10

// ─── Sprite system ────────────────────────────────────────────────────────────
// Animated sprites use <video> elements (WebM VP9).  Video playback is hardware-
// accelerated and never throttled by Chrome — drawImage(video) always returns
// the current frame.  Static PNGs use HTMLImageElement.
//
// Loader tries a .webm sidecar for any .gif path; falls back to <img> if absent.

type SpriteEntry =
  | { kind: 'loading' }
  | { kind: 'video';  video: HTMLVideoElement }
  | { kind: 'static'; img: HTMLImageElement }
  | { kind: 'error' }

const spriteCache = new Map<string, SpriteEntry>()

const ironDefenseImg = new Image()
ironDefenseImg.src = '/visuals/ability_icons/iron_defense.webp'

const unawareVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/Unaware.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

const toxicChainVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/toxic_chain.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

const spirtBreakVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/spirt_break.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

const ironBarbsImg = new Image()
ironBarbsImg.src = '/visuals/ability_icons/iron_barbs.webp'

const aquaRingImg = new Image()
aquaRingImg.src = '/visuals/trait icons/aquaring.png'

// Returns a CSS filter string that shifts the aqua ring image to progressively deeper blue.
// Level 2 = light cyan-blue, 3 = mid blue, 4 = deep saturated blue.
function aquaRingLevelFilter(level: number): string {
  if (level >= 4) return 'saturate(3.0) brightness(0.65) hue-rotate(15deg)'
  if (level >= 3) return 'saturate(1.8) brightness(0.82)'
  return 'saturate(1.0) brightness(1.0)'  // level 2 — natural tint
}

const starLevelImg = new Image()
starLevelImg.src = '/visuals/sprites/star_level.png'

const stunIconImg = new Image()
stunIconImg.src = '/visuals/CC/stun_purple.png'

const knockupIconImg = new Image()
knockupIconImg.src = '/visuals/CC/knockup.png'

const enragedImg = new Image()
enragedImg.src = '/visuals/ability_icons/enraged.png'

const megaRayquazaImg = new Image()
megaRayquazaImg.src = '/visuals/sprites/sky_strikers/mega-rayquaza-sprite.webp'

// Darmanitan Zen form sprite — swapped in while 'zen_form' is active.
const darmanitanZenImg = new Image()
darmanitanZenImg.src = '/visuals/sprites/misc/darmanitan_zen_sprite.png'

// Flair Blitz fire — drawn behind Darmanitan (rotated 90°) during the blitz dash.
const flairBlitzImg = new Image()
flairBlitzImg.src = '/visuals/ability_icons/flair_blitz.webp'

const tailwindImg = new Image()
tailwindImg.src = '/visuals/trait icons/tailwind.png'

const temporalWoodsEffectImg = new Image()
temporalWoodsEffectImg.src = '/visuals/trait icons/temporal-forest-effect.webp'

const ruinerStoneImg = new Image()
ruinerStoneImg.src = '/visuals/trait icons/ruiner_stone.png'

const cliffLImg = new Image()
cliffLImg.src = '/visuals/trait icons/cliff-l.png'

const cliffRImg = new Image()
cliffRImg.src = '/visuals/trait icons/cliff-r.png'

const megaEvoImg = new Image()
megaEvoImg.src = '/visuals/sprites/sky_strikers/mega-evo-sprite.png'

const iceMarkImg = new Image()
iceMarkImg.src = '/visuals/trait icons/ice-mark.png'

// Videos must be in the DOM for Chrome to advance their playback clock.
// A 1×1 invisible container at (0,0) keeps them in the layout without showing.
let _videoContainer: HTMLDivElement | null = null
function getVideoContainer(): HTMLDivElement {
  if (!_videoContainer) {
    _videoContainer = document.createElement('div')
    _videoContainer.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    document.body.appendChild(_videoContainer)
  }
  return _videoContainer
}

async function loadSprite(definitionId: string, url: string): Promise<void> {
  const lower = url.toLowerCase()

  // Try WebM video for any gif path (or an explicit .webm path)
  const webmUrl = lower.endsWith('.gif')
    ? url.slice(0, -4) + '.webm'
    : lower.endsWith('.webm') ? url : null

  if (webmUrl) {
    try {
      const video = document.createElement('video')
      video.loop        = true
      video.muted       = true
      video.playsInline = true
      video.preload     = 'auto'
      getVideoContainer().appendChild(video)

      await new Promise<void>((resolve, reject) => {
        video.oncanplay = () => resolve()
        video.onerror   = () => reject(new Error('video load failed'))
        video.src = webmUrl
      })

      await video.play()
      spriteCache.set(definitionId, { kind: 'video', video })
      return
    } catch {
      // WebM unavailable or failed — fall through to static img
    }
  }

  const img = new Image()
  img.onload  = () => spriteCache.set(definitionId, { kind: 'static', img })
  img.onerror = () => spriteCache.set(definitionId, { kind: 'error' })
  img.src = url
}

/** Returns the current drawable for this sprite. */
function getSprite(definitionId: string): HTMLImageElement | HTMLVideoElement | null | undefined {
  const cached = spriteCache.get(definitionId)
  if (cached === undefined) {
    const def = UNIT_MAP.get(definitionId)
    if (!def?.spritePath) { spriteCache.set(definitionId, { kind: 'error' }); return null }
    spriteCache.set(definitionId, { kind: 'loading' })
    loadSprite(definitionId, def.spritePath)
    return undefined
  }

  switch (cached.kind) {
    case 'loading': return undefined
    case 'error':   return null
    case 'static':  return cached.img
    case 'video':   return cached.video
  }
}

// Shadow bone fire — looping video drawn behind A-Marowak while shadow bone is charged
const shadowBoneFireVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/shadow_bone_fire.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

// Bulu aura — looping video, loaded once, drawn under the sprite when in madness
const buluAuraVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/bulu_aura.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

// Claydol Gravity field — looping video drawn around airborne enemies
const gravityVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/gravity.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

// Destiny Bond aura — always shown behind Spiritomb while alive
const destinyBondVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/destiny_bond.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

// Ice Body shield — looping video drawn behind Snorunt while shield is active
const iceBodyVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/ice_body.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

// Magic Bounce shield — looping video drawn behind Xatu while shield is active
const magicBounceVideo = (() => {
  const v = document.createElement('video')
  v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
  v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const attach = () => { document.body.appendChild(v); v.src = '/visuals/ability_icons/magic_bounce.webm'; v.play().catch(() => {}) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true })
  else attach()
  return v
})()

// ─── Layer ────────────────────────────────────────────────────────────────────

export class UnitLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private knockupStartTime = new Map<string, number>()   // unitId → Date.now() when knockup began
  private unitSeenAlive   = new Set<string>()            // unitIds observed as non-dead at least once
  private deathFadeMap    = new Map<string, { deathTime: number; unit: Unit; done: boolean }>()  // unitId → fade state
  private tailwindActive  = false
  private ringPassAnim: { fromX: number; fromY: number; toX: number; toY: number; toUnitId: string; startTs: number; level: number } | null = null
  private cliffFalls: Array<{ startTs: number; x: number; y: number; direction: -1|1; col: number; isLeft: boolean }> = []
  private starUpFlashes  = new Map<string, number>()   // unitId → performance.now() flash start
  private buluAuraPulse  = new Map<string, { lastCount: number; startTs: number }>()  // Tapu Bulu aura pulse on auto attack
  private hoveredUnitId: string | null = null           // pre-combat planning hover, for the hop nudge

  setTailwind(active: boolean) { this.tailwindActive = active }
  setRingPassAnim(anim: typeof this.ringPassAnim) { this.ringPassAnim = anim }
  // Brief "star up" celebration for a unit that just combined into its next
  // tier: grows 50%, gains saturation, rumbles — a single 0.5s pulse.
  flashStarUp(unitId: string) { this.starUpFlashes.set(unitId, performance.now()) }
  // Same hover hop as shop cards / bench cells, but for a board unit under the
  // cursor during planning. Only meaningful pre-combat — the caller is
  // responsible for clearing it once combat starts.
  setHoveredUnit(unitId: string | null) { this.hoveredUnitId = unitId }
  addCliffFall(f: { x: number; y: number; direction: -1|1; col: number; isLeft: boolean }) {
    this.cliffFalls.push({ ...f, startTs: performance.now() })
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  draw(units: Map<string, Unit>, _activeCombat: boolean, victoryCelebrationTs = 0, healFlashUnits?: Map<string, number>, castAnims?: import('./effectLayer').CastAnimation[], tick = 0): void {
    const ctx = this.ctx
    // Reset any leftover transform from the previous frame, clear the full
    // (headroom-padded) canvas, then shift all drawing down by the headroom so
    // top-row overlays have room above the board instead of being clipped.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.translate(0, OVERLAY_HEADROOM)

    // Victory bounce: gentle bob for surviving units after combat ends
    const celebBob = victoryCelebrationTs > 0
      ? Math.sin((performance.now() - victoryCelebrationTs) / 1000 * Math.PI * 3) * 8
      : 0

    // Match the board layer's perspective Y-scale
    ctx.save()
    ctx.scale(1, BOARD_PERSP_Y)

    // Detect alive→dead transitions and draw fading death sprites
    {
      const FADE_MS = 300
      const now = performance.now()
      for (const [id, unit] of units) {
        if (unit.state !== 'dead') {
          this.unitSeenAlive.add(id)
        } else if (this.unitSeenAlive.has(id) && !this.deathFadeMap.has(id)) {
          this.deathFadeMap.set(id, { deathTime: now, unit, done: false })
        }
      }
      for (const [, entry] of this.deathFadeMap) {
        if (entry.done) continue
        const elapsed = now - entry.deathTime
        if (elapsed >= FADE_MS) { entry.done = true; continue }
        const alpha = 1 - elapsed / FADE_MS
        // Brief rumble at the moment of death — decays over first 120ms
        const RUMBLE_MS = 120
        let shakeX = 0, shakeY = 0
        if (elapsed < RUMBLE_MS) {
          const decay = 1 - elapsed / RUMBLE_MS
          const intensity = decay * decay * 7
          shakeX = Math.sin(now * 0.15) * intensity
          shakeY = Math.cos(now * 0.12 + 0.8) * intensity
        }
        ctx.save()
        ctx.filter = `opacity(${alpha.toFixed(3)})`
        this.drawUnit(ctx, entry.unit, shakeX, shakeY, undefined, 0, 1, 1, tick, false)
        ctx.restore()
      }
    }

    // First pass: draw Unaware bubble under all sprites
    if (unawareVideo.readyState >= 2) {
      for (const unit of units.values()) {
        if (unit.state === 'dead') continue
        if (!unit.shields.some(s => s.sourceAbility === 'quagsire_unaware')) continue
        const auraSize = SPRITE_HALF * 3.2
        ctx.save()
        ctx.globalAlpha = 0.85
        ctx.drawImage(unawareVideo, unit.visualPos.x - auraSize / 2, unit.visualPos.y - auraSize / 2, auraSize, auraSize)
        ctx.restore()
      }
    }

    // First pass: draw Fezandipiti toxic chains under all sprites
    if (toxicChainVideo.readyState >= 2) {
      for (const target of units.values()) {
        if (target.state === 'dead') continue
        const chainFx = target.statusEffects.find(fx => fx.stackId === `fez_chain_${target.id}`)
        if (!chainFx) continue
        const source = units.get(chainFx.sourceUnitId)
        if (!source || source.state === 'dead') continue

        const dx    = target.visualPos.x - source.visualPos.x
        const dy    = target.visualPos.y - source.visualPos.y
        const dist  = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)
        const chainH = HEX_SIZE * 0.18   // thin beam
        const alpha  = Math.min(1, chainFx.durationTicks / 15) * 0.80  // fade out last 15 ticks

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(source.visualPos.x, source.visualPos.y)
        ctx.rotate(angle)
        ctx.drawImage(toxicChainVideo, 0, -chainH / 2, dist, chainH)
        ctx.restore()
      }
    }

    // First pass: draw Spirit Break aura under Morgrem
    if (spirtBreakVideo.readyState >= 2) {
      for (const unit of units.values()) {
        if (unit.state === 'dead') continue
        if (!unit.statusEffects.some(fx => fx.stackId === 'morgrem_spirit_break_aura')) continue
        const auraSize = HEX_SIZE * 4.2
        ctx.save()
        ctx.globalAlpha = 0.90
        ctx.drawImage(spirtBreakVideo, unit.visualPos.x - auraSize / 2, unit.visualPos.y - auraSize / 2, auraSize, auraSize)
        ctx.restore()
      }
    }

    // First pass: draw Spiritomb Destiny Bond aura under all units
    if (destinyBondVideo.readyState >= 2) {
      for (const unit of units.values()) {
        if (unit.state === 'dead' || unit.definitionId !== 'spiritomb') continue
        const auraSize = HEX_SIZE * Math.sqrt(3) * 2.8
        ctx.save()
        ctx.globalAlpha = 0.85
        ctx.drawImage(destinyBondVideo, unit.visualPos.x - auraSize / 2, unit.visualPos.y - auraSize / 2, auraSize, auraSize)
        ctx.restore()
      }
    }

    // First pass: draw tailwind icon behind sky strikers that actually HAVE tailwind.
    // Gated on each unit's own tailwind status effect (not a global flag), so only
    // the team whose sky strikers summoned it shows the icon — never the other team.
    if (this.tailwindActive && tailwindImg.complete && tailwindImg.naturalWidth > 0) {
      for (const unit of units.values()) {
        if (unit.state === 'dead' || !unit.types.includes('sky_striker')) continue
        if (!unit.statusEffects.some(fx => fx.stackId === 'sky_striker_tailwind')) continue
        const boosted  = unit.statusEffects.some(fx => fx.stackId === 'sky_striker_kill_boost')
        const size    = SPRITE_HALF * 1.3
        const offsetX = SPRITE_HALF * 1.1 + (boosted ? Math.sin(performance.now() * 0.04) * 3 : 0)
        const offsetY = boosted ? Math.cos(performance.now() * 0.05) * 2 : 0
        ctx.save()
        ctx.globalAlpha = boosted ? 0.95 : 0.75
        ctx.drawImage(
          tailwindImg,
          unit.visualPos.x + offsetX - size / 2,
          unit.visualPos.y + offsetY - size / 2,
          size, size,
        )
        ctx.restore()
      }
    }

    for (const unit of units.values()) {
      if (unit.state === 'dead') continue

      // Ruiner stone: custom rendering, skip all unit logic
      if (unit.definitionId === 'ruiner_stone' && ruinerStoneImg.complete && ruinerStoneImg.naturalWidth > 0) {
        const stoneFx   = unit.statusEffects.find(fx => fx.stackId === 'ruiner_stone')
        const proximity = stoneFx?.magnitude ?? 0  // 0=far, 1=at threshold
        const freq      = 0.04 + proximity * 0.14  // slow shake → fast shake
        const intensity = proximity * proximity * 7
        const rx = Math.sin(performance.now() * freq) * intensity
        const ry = Math.cos(performance.now() * freq * 0.75 + 1.1) * intensity * 0.5
        const SIZE   = SPRITE_HALF * 1.92 * 0.7   // 30% smaller
        const HEIGHT = SIZE * 1.2                 // stretched 20% taller
        ctx.save()
        ctx.globalAlpha = 1.0
        ctx.drawImage(ruinerStoneImg, unit.visualPos.x - SIZE / 2 + rx, unit.visualPos.y - HEIGHT / 2 + ry, SIZE, HEIGHT)
        ctx.restore()
        continue
      }

      // Cliff: custom rendering, skip all unit logic
      if ((unit.definitionId === 'cliff_l' || unit.definitionId === 'cliff_r')) {
        const img = unit.definitionId === 'cliff_l' ? cliffLImg : cliffRImg
        if (img.complete && img.naturalWidth > 0) {
          // HP-based shake so it visually reacts when hit
          const hpRatio = unit.currentHp / unit.maxHp
          const shake = hpRatio < 1 ? (1 - hpRatio) * 4 : 0
          const rx = Math.sin(performance.now() * 0.05) * shake
          const ry = Math.cos(performance.now() * 0.04 + 1.3) * shake * 0.5
          const W = SPRITE_HALF * 1.4
          const H = SPRITE_HALF * 2.8
          ctx.save()
          ctx.drawImage(img, unit.visualPos.x - W / 2 + rx, unit.visualPos.y - H * 0.60 + ry, W, H)
          ctx.restore()
        }
        continue
      }

      // Compute attack nudge offset during windup
      let nudgeX = 0
      let nudgeY = 0
      let spriteRotate = 0
      let nudgeScaleX = 1
      let nudgeScaleY = 1
      let starFlashP = 0
      // Declared here (not inside the !celebrating wrap below) because the
      // gravity-field VFX draw further down still needs it even mid-celebration.
      const gravityFx = unit.statusEffects.find(fx => fx.stackId === 'claydol_gravity_target')

      // Once combat has ended, every ongoing per-state pose/rumble/spin below
      // is skipped — units just do the victory hop (celebBob) instead of
      // whatever animation they happened to be frozen mid-playing.
      const celebrating = victoryCelebrationTs > 0

      if (!celebrating) {
      // Hover hop (planning phase only): same motion as the shop-card/bench
      // hover hop, but 30% shorter — 7% of the sprite's height vs 10%.
      if (unit.id === this.hoveredUnitId) {
        const hopAmp = SPRITE_HALF * 2 * 0.07
        const t = (performance.now() / 1000) % 1
        nudgeY -= Math.sin(t * Math.PI) * hopAmp
      }

      // Star-up flash: grow 50%, gain saturation, rumble slightly — 0.5s pulse
      const starFlashStart = this.starUpFlashes.get(unit.id)
      if (starFlashStart !== undefined) {
        const STAR_FLASH_MS = 500
        const elapsed = performance.now() - starFlashStart
        if (elapsed >= STAR_FLASH_MS) {
          this.starUpFlashes.delete(unit.id)
        } else {
          const t = elapsed / STAR_FLASH_MS
          // Quick rise, hold, ease out
          starFlashP = t < 0.2 ? t / 0.2 : t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3)
          const growScale = 1 + 0.5 * starFlashP
          nudgeScaleX *= growScale
          nudgeScaleY *= growScale
          const rumble = starFlashP * 6
          nudgeX += Math.sin(performance.now() * 0.12) * rumble
          nudgeY += Math.cos(performance.now() * 0.10 + 0.5) * rumble
        }
      }

      // Cave Crawler earthquake rumble: shake for ~0.4s after each quake
      const eqRumble = unit.statusEffects.find(fx => fx.stackId === 'cave_crawler_earthquake_rumble')
      if (eqRumble && eqRumble.magnitude) {
        const decay = eqRumble.durationTicks / eqRumble.magnitude  // 1→0 as effect expires
        const intensity = decay * decay * 7
        nudgeX += Math.sin(performance.now() * 0.055) * intensity
        nudgeY += Math.cos(performance.now() * 0.048 + 1.3) * intensity
      }

      // Ruiner golem arise: pulse 50% bigger and rumble in place over the
      // spawn window (invulnerability for the same duration is enforced in
      // damage.ts via this same 'ruiner_arise' status effect).
      const ariseFx = unit.statusEffects.find(fx => fx.stackId === 'ruiner_arise')
      if (ariseFx && ariseFx.magnitude) {
        const t = 1 - ariseFx.durationTicks / ariseFx.magnitude  // 0→1
        const pulse = Math.sin(t * Math.PI)  // 0→1→0 over the spawn window
        const sc = 1 + 0.5 * pulse
        nudgeScaleX = sc
        nudgeScaleY = sc
        const shake = pulse * 9
        nudgeX += Math.sin(performance.now() * 0.10) * shake
        nudgeY += Math.cos(performance.now() * 0.08 + 0.7) * shake * 0.6
      }

      // Tapu Koko cast: quick rumble + size surge for the (short) cast duration,
      // then he goes straight back to autoing
      if (unit.definitionId === 'tapu_koko' && unit.state === 'casting') {
        const TOTAL = 24  // matches TAPUKOKO_RUMBLE_TICKS / castTimeTicks
        const t = 1 - Math.max(0, unit.abilityCastTimer) / TOTAL  // 0→1 over the rumble
        const pulse = Math.sin(t * Math.PI)                        // swell then settle
        const intensity = pulse * 5
        nudgeX += Math.sin(performance.now() * 0.09) * intensity
        nudgeY += Math.cos(performance.now() * 0.075 + 0.6) * intensity
        const sc = 1 + 0.30 * pulse
        nudgeScaleX = sc
        nudgeScaleY = sc
      }

      // Latios/Latias: gentle side-to-side sway while channeling their orb
      if ((unit.definitionId === 'latios' || unit.definitionId === 'latias') && unit.state === 'casting') {
        nudgeX += Math.sin(performance.now() * 0.012) * 10
      }

      // Salamence: cast rumble that grows him into his permanent Enraged size
      if (unit.definitionId === 'salamence') {
        if (unit.state === 'casting') {
          const TOTAL = 24  // matches SALAMENCE_RUMBLE_TICKS / castTimeTicks
          const t = 1 - Math.max(0, unit.abilityCastTimer) / TOTAL  // 0→1 over the rumble
          const intensity = Math.sin(t * Math.PI) * 5
          nudgeX += Math.sin(performance.now() * 0.09) * intensity
          nudgeY += Math.cos(performance.now() * 0.075 + 0.6) * intensity
          const sc = 1 + 0.20 * t  // grow into the enraged size during the rumble
          nudgeScaleX *= sc
          nudgeScaleY *= sc
        } else if (unit.statusEffects.some(fx => fx.id === 'salamence_enraged')) {
          // Permanently 20% larger while Enraged (rest of combat)
          nudgeScaleX *= 1.20
          nudgeScaleY *= 1.20
        }
      }

      // Klawf: fast side-to-side scuttle while Anger Shell is active (empowered state)
      if (unit.definitionId === 'klawf' && unit.statusEffects.some(fx => fx.stackId === 'klawf_speed')) {
        nudgeX += Math.sin(performance.now() * 0.045) * 7
      }

      // Drednaw flip (cast + pre-auto): hop up and spin, only when not in windup
      const drednawFlip = unit.statusEffects.find(fx => fx.stackId === 'drednaw_flip')
      if (drednawFlip && drednawFlip.magnitude && !unit.isInWindup) {
        const t = 1 - drednawFlip.durationTicks / drednawFlip.magnitude
        nudgeY -= Math.sin(t * Math.PI) * 26
        spriteRotate = t * Math.PI * 2
      }

      // Knock-up: single hop arc on impact, then stationary (stunned) until effect expires
      if (unit.state === 'knockedUp') {
        if (!this.knockupStartTime.has(unit.id)) this.knockupStartTime.set(unit.id, Date.now())
        const elapsed = Date.now() - this.knockupStartTime.get(unit.id)!
        const HOP_MS = 550
        if (elapsed < HOP_MS) nudgeY += -Math.sin((elapsed / HOP_MS) * Math.PI) * 46
      } else {
        this.knockupStartTime.delete(unit.id)
      }
      if (unit.isInWindup && unit.targetId) {
        const target = units.get(unit.targetId)
        if (target && target.state !== 'dead') {
          const dx = target.visualPos.x - unit.visualPos.x
          const dy = target.visualPos.y - unit.visualPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 0) {
            const nx = dx / dist
            const ny = dy / dist
            if (unit.range <= 1) {
              const activeMod = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null
              const total    = activeMod?.extendedWindupTicks ?? windupTicks(unit)
              const elapsed  = total - unit.attackWindupTimer
              const progress = total > 0 ? elapsed / total : 0

              const isKinglerCrabhammer = unit.definitionId === 'kingler' &&
                unit.attackModifiers.some(m => m.id.startsWith('kingler_crabhammer_'))

              // Arc fury swipe applies to Vigoroth's empowered autos and to
              // Salamence for the rest of combat once Enraged (Outrage)
              const hasFuryShield = (unit.definitionId === 'vigoroth' &&
                unit.shields.some(s => s.sourceAbility === 'vigoroth_fury_swipes'))
                || (unit.definitionId === 'salamence' &&
                unit.statusEffects.some(fx => fx.id === 'salamence_enraged'))

              const isAMarowakSwing = unit.definitionId === 'a_marowak' &&
                unit.attackModifiers.length > 0 &&
                unit.attackModifiers[0].id === 'a_marowak_bone'

              const weavileModId = unit.definitionId === 'weavile' && unit.attackModifiers.length > 0
                ? unit.attackModifiers[0].id : null

              if (weavileModId === 'weavile_1') {
                // Fast 70px lunge — empowered mod 1 attack
                const PULL = 6, LUNGE = 70
                const H = WINDUP_HIT_FRACTION
                let scale: number
                if (progress < 0.15) {
                  scale = -(progress / 0.15) * PULL
                } else if (progress < H) {
                  const p = (progress - 0.15) / (H - 0.15)
                  scale = -PULL + p * p * (LUNGE + PULL)
                } else {
                  const p = (progress - H) / (1 - H)
                  scale = LUNGE * (1 - p)
                }
                nudgeX = nx * scale
                nudgeY = ny * scale
              } else if (weavileModId === 'weavile_2') {
                // CW spin + circular orbit through adjacent hex area
                const H = WINDUP_HIT_FRACTION
                const ORBIT_R = 55
                if (progress < H) {
                  const t = progress / H
                  spriteRotate = t * t * Math.PI * 2  // accelerating 360° CW spin
                  const orbitAngle = Math.atan2(ny, nx) + t * Math.PI * 2
                  nudgeX = Math.cos(orbitAngle) * ORBIT_R
                  nudgeY = Math.sin(orbitAngle) * ORBIT_R
                } else {
                  const t = (progress - H) / (1 - H)
                  spriteRotate = Math.PI * 2 * (1 - t)
                  // Return from target-side position back to center
                  const returnAngle = Math.atan2(ny, nx)
                  nudgeX = Math.cos(returnAngle) * ORBIT_R * (1 - t)
                  nudgeY = Math.sin(returnAngle) * ORBIT_R * (1 - t)
                }
              } else if (weavileModId === 'weavile_3') {
                // Long cockback then explosive slam forward 70px
                const PULL = 20, LUNGE = 70
                const COCK_LEAN = -0.4
                const H = WINDUP_HIT_FRACTION
                let scale: number
                if (progress < 0.30) {
                  const t = progress / 0.30
                  scale = -(t * t) * PULL
                  spriteRotate = COCK_LEAN * (t * t)
                } else if (progress < 0.35) {
                  scale = -PULL
                  spriteRotate = COCK_LEAN
                } else if (progress < H) {
                  const t = (progress - 0.35) / (H - 0.35)
                  scale = -PULL + t * (PULL + LUNGE)
                  spriteRotate = COCK_LEAN + (0.2 - COCK_LEAN) * t
                } else {
                  const t = (progress - H) / (1 - H)
                  const ease = 1 - (1 - t) * (1 - t)
                  scale = LUNGE * (1 - ease)
                  spriteRotate = 0.2 * (1 - ease)
                }
                nudgeX = nx * scale
                nudgeY = ny * scale
              } else if (isAMarowakSwing) {
                const dir = unit.attackModifiers[0].swingDir ?? 1
                // dir=-1 → first strike: cock CCW (-120°), swing CW to +120° at hit, follow to +155°
                // dir=+1 → second strike: mirrored
                const COCK_ROT     = dir *  120 * (Math.PI / 180)
                const STRIKE_ROT   = dir * -120 * (Math.PI / 180)  // apex — damage fires here
                const FOLLOW_ROT   = dir * -155 * (Math.PI / 180)  // overshoot follow-through
                const H            = WINDUP_HIT_FRACTION            // 0.40
                const COCK_END     = 0.16                           // 0–16%: rotate to cock
                const PAUSE_END    = 0.22                           // 16–22%: hold at cock
                const FOLLOW_PEAK  = 0.58                           // 40–58%: follow-through arc
                // 22–40%: slower swing arc into apex (18% of windup)
                if (progress < COCK_END) {
                  const t    = progress / COCK_END
                  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
                  spriteRotate = COCK_ROT * ease
                  nudgeX = nx * (-ease * 10)
                  nudgeY = ny * (-ease * 10)
                } else if (progress < PAUSE_END) {
                  spriteRotate = COCK_ROT
                  nudgeX = nx * (-10)
                  nudgeY = ny * (-10)
                } else if (progress < H) {
                  const t    = (progress - PAUSE_END) / (H - PAUSE_END)
                  const ease = 1 - (1 - t) * (1 - t)  // ease-out: decelerates into hit
                  spriteRotate = COCK_ROT + (STRIKE_ROT - COCK_ROT) * ease
                  nudgeX = nx * (-10 + ease * 43)
                  nudgeY = ny * (-10 + ease * 43)
                } else if (progress < FOLLOW_PEAK) {
                  // Follow-through: continue past apex, ease-out so it slows at peak
                  const t    = (progress - H) / (FOLLOW_PEAK - H)
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = STRIKE_ROT + (FOLLOW_ROT - STRIKE_ROT) * ease
                  nudgeX = nx * (33 - ease * 12)   // slight pullback as swing continues
                  nudgeY = ny * (33 - ease * 12)
                } else {
                  // Return to neutral from follow-through position
                  const t    = (progress - FOLLOW_PEAK) / (1 - FOLLOW_PEAK)
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = FOLLOW_ROT * (1 - ease)
                  nudgeX = nx * 21 * (1 - ease)
                  nudgeY = ny * 21 * (1 - ease)
                }
              } else if (unit.definitionId === 'pidgeotto' &&
                         unit.attackModifiers[0]?.id === 'pidgeotto_wing_slap') {
                // Each Wing Slap auto is its own full windup; direction alternates via swingDir.
                // swingDir= 1: CW cock (+40°) → CCW strike (−55°) → return  [right wing]
                // swingDir=-1: CCW cock (−40°) → CW strike (+55°) → return  [left wing]
                const dir      = unit.attackModifiers[0].swingDir ?? 1
                const H        = WINDUP_HIT_FRACTION
                const COCK_ROT   = dir *  65 * (Math.PI / 180)
                const STRIKE_ROT = dir * -90 * (Math.PI / 180)

                if (progress < 0.20) {
                  const t = progress / 0.20
                  spriteRotate = COCK_ROT * (t * t)
                  nudgeX = nx * (-t * 8)
                  nudgeY = ny * (-t * 8)
                } else if (progress < H) {
                  // Linear snap into strike — percussive feel
                  const t = (progress - 0.20) / (H - 0.20)
                  spriteRotate = COCK_ROT + (STRIKE_ROT - COCK_ROT) * t
                  nudgeX = nx * (-8 + t * 36)
                  nudgeY = ny * (-8 + t * 36)
                } else {
                  // Ease-out return to neutral
                  const t    = (progress - H) / (1 - H)
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = STRIKE_ROT * (1 - ease)
                  nudgeX = nx * 28 * (1 - ease)
                  nudgeY = ny * 28 * (1 - ease)
                }
              } else if (isKinglerCrabhammer) {
                // CCW hammer + forward lunge peaking at damage frame, then return
                const H = WINDUP_HIT_FRACTION         // 0.40
                const SMASH = -75 * (Math.PI / 180)   // CCW rotation at impact
                const LUNGE = 24                       // forward px at impact
                if (progress < H) {
                  const t = progress / H
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = ease * SMASH
                  nudgeX += nx * ease * LUNGE
                  nudgeY += ny * ease * LUNGE
                } else {
                  const t = (progress - H) / (1 - H)
                  spriteRotate = SMASH * (1 - t)
                  nudgeX += nx * LUNGE * (1 - t)
                  nudgeY += ny * LUNGE * (1 - t)
                }
              } else if (hasFuryShield) {
                // Arc fury swipe: fast lateral sweep → explosive forward snap → hold → return
                const side = unit.team === 'player' ? 1 : -1
                const px = -ny * side   // perpendicular unit vector
                const py =  nx * side
                const SWIPE_FWD = 60    // forward reach toward the target
                const SWIPE_LAT = 92    // lateral reach of the arc (doubled)
                let fwd: number, lat: number
                if (progress < 0.38) {
                  // Strike: lateral sweeps in fast, forward snaps with ease-in²
                  const t = progress / 0.38
                  fwd = t * t * SWIPE_FWD
                  lat = Math.sin(t * Math.PI * 0.65) * SWIPE_LAT
                } else if (progress < 0.55) {
                  // Brief hold at impact
                  const t = (progress - 0.38) / 0.17
                  fwd = SWIPE_FWD * (1 - t * 0.2)
                  lat = SWIPE_LAT * 0.15 * (1 - t)
                } else {
                  // Return to neutral
                  const t = (progress - 0.55) / 0.45
                  fwd = SWIPE_FWD * 0.8 * (1 - t)
                  lat = 0
                }
                nudgeX = nx * fwd + px * lat
                nudgeY = ny * fwd + py * lat
              } else if (unit.definitionId === 'drednaw' &&
                         unit.statusEffects.some(fx => fx.stackId === 'drednaw_razor_shell_active')) {
                // Pierce lunge: hop+spin → pull-back → explosive shell-first charge
                const PULL = 8, LUNGE = 170
                if (progress < 0.10) {
                  const ft = progress / 0.10
                  spriteRotate = ft * Math.PI * 2
                  nudgeY = -Math.sin(ft * Math.PI) * 26
                  nudgeX = 0
                } else if (progress < 0.18) {
                  const p = (progress - 0.10) / 0.08
                  const scale = -(p * p) * PULL
                  nudgeX = nx * scale
                  nudgeY = ny * scale
                } else if (progress < 0.40) {
                  const p = (progress - 0.18) / 0.22
                  const scale = -PULL + p * p * (LUNGE + PULL)
                  nudgeX = nx * scale
                  nudgeY = ny * scale
                } else if (progress < 0.55) {
                  nudgeX = nx * LUNGE
                  nudgeY = ny * LUNGE
                } else {
                  const p = (progress - 0.55) / 0.45
                  const scale = LUNGE * (1 - p)
                  nudgeX = nx * scale
                  nudgeY = ny * scale
                }
              } else if (unit.attackModifiers.some(m => m.id === 'gogoat_horn') ||
                         unit.statusEffects.some(fx => fx.stackId === 'gogoat_lunge')) {
                // Empowered healing headbutt: hop strike — he jumps forward into the
                // target (no pull-back), arcing up then landing exactly on the hit
                // frame, then eases back out of the lunge during recovery.
                const H        = WINDUP_HIT_FRACTION
                const LUNGE_PX = 70
                const HOP_PX   = 40
                if (progress < H) {
                  const t = progress / H
                  nudgeX = nx * t * t * LUNGE_PX
                  nudgeY = ny * t * t * LUNGE_PX - Math.sin(t * Math.PI) * HOP_PX
                } else {
                  const t = (progress - H) / (1 - H)
                  nudgeX = nx * LUNGE_PX * (1 - t)
                  nudgeY = ny * LUNGE_PX * (1 - t)
                }
              } else if (unit.attackModifiers.some(m => m.id === 'shadow_punch_empowered')) {
                // CCW cock → continue winding CCW during pause → CW lunge → return
                const H          = WINDUP_HIT_FRACTION
                const PULL_PX    = 20
                const LUNGE_PX   = 58
                const COCK_ROT   = -30 * (Math.PI / 180)   // initial CCW at end of pull-back
                const WIND_ROT   = -42 * (Math.PI / 180)   // fully wound CCW at end of pause
                const STRIKE_ROT =  25 * (Math.PI / 180)   // CW rotation at impact
                let punchScale: number
                if (progress < 0.22) {
                  const t = progress / 0.22
                  punchScale   = -(t * t) * PULL_PX
                  spriteRotate = COCK_ROT * (t * t)
                } else if (progress < 0.30) {
                  const t = (progress - 0.22) / 0.08
                  punchScale   = -PULL_PX
                  spriteRotate = COCK_ROT + (WIND_ROT - COCK_ROT) * t
                } else if (progress < H) {
                  const t = (progress - 0.30) / (H - 0.30)
                  punchScale   = -PULL_PX + t * (PULL_PX + LUNGE_PX)
                  spriteRotate = WIND_ROT + (STRIKE_ROT - WIND_ROT) * t
                } else {
                  const t    = (progress - H) / (1 - H)
                  const ease = 1 - (1 - t) * (1 - t)
                  punchScale   = LUNGE_PX * (1 - ease)
                  spriteRotate = STRIKE_ROT * (1 - ease)
                }
                nudgeX = nx * punchScale
                nudgeY = ny * punchScale
              } else if (unit.definitionId === 'drednaw' &&
                         unit.statusEffects.some(fx => fx.stackId === 'drednaw_razor_shell_active')) {
                // Wide CW arc sweep: cock CCW → lunge forward with sweeping rotation → follow-through
                const H         = WINDUP_HIT_FRACTION   // 0.40
                const COCK_ROT  = -80 * (Math.PI / 180)
                const SWEEP_ROT = +105 * (Math.PI / 180)
                const LUNGE_PX  = 30

                if (progress < 0.18) {
                  const t    = progress / 0.18
                  const ease = t * t
                  spriteRotate = COCK_ROT * ease
                  nudgeX = nx * (-ease * 10)
                  nudgeY = ny * (-ease * 10)
                } else if (progress < H) {
                  const t    = (progress - 0.18) / (H - 0.18)
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = COCK_ROT + (SWEEP_ROT * 0.35 - COCK_ROT) * ease
                  nudgeX = nx * (-10 + ease * (10 + LUNGE_PX))
                  nudgeY = ny * (-10 + ease * (10 + LUNGE_PX))
                } else if (progress < 0.68) {
                  const t    = (progress - H) / (0.68 - H)
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = SWEEP_ROT * 0.35 + ease * (SWEEP_ROT - SWEEP_ROT * 0.35)
                  nudgeX = nx * (LUNGE_PX * (1 - t * 0.4))
                  nudgeY = ny * (LUNGE_PX * (1 - t * 0.4))
                } else {
                  const t    = (progress - 0.68) / 0.32
                  const ease = 1 - (1 - t) * (1 - t)
                  spriteRotate = SWEEP_ROT * (1 - ease)
                  nudgeX = nx * LUNGE_PX * 0.6 * (1 - ease)
                  nudgeY = ny * LUNGE_PX * 0.6 * (1 - ease)
                }
              } else {
                const isBuluMadness = unit.definitionId === 'tapu_bulu' &&
                  unit.statusEffects.some(e => e.id === 'tapubulu_madness')

                if (isBuluMadness) {
                  // Enlarged form: cock back → swing forward → return, lunging the same
                  // distance as a normal auto. The cock-back ramps up 30% each auto across
                  // the 3-auto cycle (normal → more → most) then resets. The cock-back grows
                  // +100% of the base each auto, reaching a full 90° lean-back on the 3rd.
                  // The empowered 3rd auto (the heal swing) also lunges 25% further.
                  const cyc        = unit.attackCount % 3   // 0 = 1st auto, 1 = 2nd, 2 = 3rd
                  const cockMult   = 1 + 1.0 * cyc          // ×1 → ×2 → ×3, then resets
                  const isEmpoweredThird = cyc === 2
                  const dir        = nx >= 0 ? 1 : -1
                  const PULLBACK   = 14 * cockMult  // base heavier cock-back (normal auto = 6), ramped
                  const strikePx   = isEmpoweredThird ? MELEE_STRIKE_PX * 1.25 : MELEE_STRIKE_PX  // matches normal; +25% on the 3rd
                  const COCK_ROT   = dir * (-30 * cockMult) * (Math.PI / 180)  // 30° → 60° → 90° lean-back
                  const STRIKE_ROT = dir * (isEmpoweredThird ? 22 : 16) * (Math.PI / 180)
                  let scale: number
                  if (progress < 0.15) {
                    const t = progress / 0.15
                    scale = -t * PULLBACK
                    spriteRotate = COCK_ROT * t
                  } else if (progress < 0.40) {
                    const p = (progress - 0.15) / 0.25
                    scale = -PULLBACK + p * p * (strikePx + PULLBACK)
                    spriteRotate = COCK_ROT + p * p * (STRIKE_ROT - COCK_ROT)
                  } else {
                    const p = (progress - 0.40) / 0.60
                    scale = strikePx * (1 - p)
                    spriteRotate = STRIKE_ROT * (1 - p)
                  }
                  nudgeX = nx * scale
                  nudgeY = ny * scale
                } else {
                  // Standard 3-phase melee animation: cock back → swing forward → return.
                  // The sprite tilts back during the windup, rotates forward toward the
                  // enemy through the strike, then settles upright on the way back. Crits
                  // lunge 1.5× further and swing a bit harder.
                  const strikePx  = unit.pendingCrit ? MELEE_STRIKE_PX * 1.5 : MELEE_STRIKE_PX
                  const dir       = nx >= 0 ? 1 : -1   // tilt toward the enemy's side
                  const COCK_ROT   = dir * -8  * (Math.PI / 180)  // lean back during windup
                  const STRIKE_ROT = dir * (unit.pendingCrit ? 22 : 16) * (Math.PI / 180)  // pitch forward at impact
                  let scale: number
                  if (progress < 0.15) {
                    const t = progress / 0.15
                    scale = -t * MELEE_PULLBACK_PX
                    spriteRotate = COCK_ROT * t                       // ease into the cock-back
                  } else if (progress < 0.40) {
                    const p = (progress - 0.15) / 0.25
                    scale = -MELEE_PULLBACK_PX + p * p * (strikePx + MELEE_PULLBACK_PX)
                    spriteRotate = COCK_ROT + p * p * (STRIKE_ROT - COCK_ROT)  // swing forward
                  } else {
                    const p = (progress - 0.40) / 0.60
                    scale = strikePx * (1 - p)
                    spriteRotate = STRIKE_ROT * (1 - p)               // return upright
                  }
                  nudgeX = nx * scale
                  nudgeY = ny * scale
                }
              }
            } else if (unit.definitionId === 'oranguru'
                && unit.statusEffects.some(fx => fx.stackId === 'oranguru_stored_power')) {
              // Fan swipe: smooth sweep that starts and ends at center (no cross-cycle jitter)
              const total    = windupTicks(unit)
              const elapsed  = total - unit.attackWindupTimer
              const progress = total > 0 ? elapsed / total : 0
              // sin(π·p) is 0 at p=0 and p=1 so there's no discontinuity between attacks
              const sweep = Math.sin(progress * Math.PI)
              // Lateral (perpendicular-left) sweep at peak, small forward lean
              const perpX = -ny, perpY = nx  // left of forward direction
              nudgeX = perpX * sweep * 11 + nx * sweep * 3
              nudgeY = perpY * sweep * 11 + ny * sweep * 3
              spriteRotate = -sweep * (16 * Math.PI / 180)
            } else {
              const total    = windupTicks(unit)
              const elapsed  = total - unit.attackWindupTimer
              const progress = total > 0 ? elapsed / total : 0
              const scale    = Math.sin(progress * Math.PI) * RANGED_JERK_PX
              nudgeX = nx * scale
              nudgeY = ny * scale
            }
          }
        }
      }

      // Cast animation nudge
      const anim = castAnims?.find(a => a.unitId === unit.id)
      if (anim) {
        const p = anim.remaining / anim.total   // 1 → 0 over duration
        if (anim.type === 'shake') {
          nudgeX += Math.sin(p * Math.PI * 6) * 5 * p
        } else if (anim.type === 'bigShake' || anim.type === 'ws_consume_shake') {
          // Wider, faster multi-axis shake — used for impactful transformations
          nudgeX += Math.sin(p * Math.PI * 8) * 12 * p
          nudgeY += Math.sin(p * Math.PI * 8 + Math.PI / 2) * 8 * p
        } else if (anim.type === 'hop') {
          nudgeY += -Math.sin(p * Math.PI) * 18
          spriteRotate += Math.cos((1 - p) * Math.PI) * (12 * Math.PI / 180)
        } else if (anim.type === 'excadrill_land') {
          // Small landing hop plus a ground-rumble shake as he pops back to full size
          nudgeY += -Math.sin(p * Math.PI) * 14
          nudgeX += Math.sin(p * Math.PI * 10) * 6 * p
          nudgeY += Math.sin(p * Math.PI * 10 + Math.PI / 2) * 4 * p
        } else if (anim.type === 'hold_hop') {
          const elapsed  = anim.total - anim.remaining
          const apexAt   = anim.apexAt ?? Math.round(anim.total * 0.5)
          const holdEnd  = apexAt + 6
          const HOP_H    = 32
          if (elapsed < apexAt) {
            // Ease-in rise: sin(t * π/2) goes 0 → 1
            nudgeY += -Math.sin((elapsed / apexAt) * Math.PI / 2) * HOP_H
          } else if (elapsed < holdEnd) {
            // Hold at apex with rapid shake
            const st = (elapsed - apexAt) / (holdEnd - apexAt)
            nudgeY += -HOP_H
            nudgeX += Math.sin(st * Math.PI * 8) * 5 * (1 - st)
          } else {
            // Ease-out fall: sin((1-t) * π/2) goes 1 → 0
            const t = (elapsed - holdEnd) / (anim.total - holdEnd)
            nudgeY += -Math.sin((1 - t) * Math.PI / 2) * HOP_H
          }
        } else if (anim.type === 'flap') {
          // Tropius: a big high jump that peaks right as the tornado launches, then
          // lands over the tail, with a light wing-flutter riding on top. He also
          // grows 20% at the apex and shrinks back to normal on the way down.
          const elapsed = anim.total - anim.remaining
          const apexAt  = anim.apexAt ?? Math.round(anim.total * 0.6)
          const JUMP_H  = 58
          let hFrac: number   // 0 on the ground → 1 at the apex
          if (elapsed < apexAt) {
            // Rise: ease-out up to the apex
            hFrac = Math.sin((elapsed / apexAt) * (Math.PI / 2))
          } else {
            // Fall back down after launching
            const t = (elapsed - apexAt) / (anim.total - apexAt)
            hFrac = Math.cos(t * (Math.PI / 2))
          }
          nudgeY += -hFrac * JUMP_H
          // Wing-flutter shimmer during the leap
          nudgeY += -Math.abs(Math.sin(elapsed * 0.9)) * 4
          // Grow up to +20% at the apex, back to normal on landing
          const grow = 1 + 0.2 * hFrac
          nudgeScaleX *= grow
          nudgeScaleY *= grow
        } else if (anim.type === 'dart') {
          const elapsed  = anim.total - anim.remaining
          const apexAt   = anim.apexAt ?? anim.total / 2
          let dartFrac: number
          if (elapsed < apexAt) {
            // Lunge out: ease-in with sin curve
            dartFrac = Math.sin((elapsed / apexAt) * Math.PI / 2)
          } else {
            // Snap back: linear
            dartFrac = 1 - (elapsed - apexAt) / (anim.total - apexAt)
          }
          const dartDist = dartFrac * 38
          nudgeX += (anim.dirX ?? 0) * dartDist
          nudgeY += (anim.dirY ?? 0) * dartDist
        } else if (anim.type === 'dart_rumble') {
          // Vikavolt: the sharp forward lunge plus a rapid electric rumble that
          // peaks through the lunge (strongest at the apex, fades at the ends).
          const elapsed  = anim.total - anim.remaining
          const apexAt   = anim.apexAt ?? anim.total / 2
          let dartFrac: number
          if (elapsed < apexAt) {
            dartFrac = Math.sin((elapsed / apexAt) * Math.PI / 2)
          } else {
            dartFrac = 1 - (elapsed - apexAt) / (anim.total - apexAt)
          }
          const dartDist = dartFrac * 38
          nudgeX += (anim.dirX ?? 0) * dartDist
          nudgeY += (anim.dirY ?? 0) * dartDist
          // Rumble: high-frequency multi-axis jitter scaled by the lunge intensity
          const rumble = 5 * dartFrac
          nudgeX += Math.sin(elapsed * 2.4) * rumble
          nudgeY += Math.cos(elapsed * 3.1) * rumble
        } else if (anim.type === 'hop_dart') {
          // Ribombee: a quick little hop, land completely, THEN a forward lunge that
          // peaks exactly when the projectile launches, then snaps back.
          const elapsed = anim.total - anim.remaining
          const apexAt  = anim.apexAt ?? anim.total / 2
          // Phase 1 — hop up and fully back down over the first HOP_DUR frames
          const HOP_DUR = Math.min(12, apexAt)
          const HOP_H   = 15
          if (elapsed < HOP_DUR) {
            nudgeY += -Math.sin((elapsed / HOP_DUR) * Math.PI) * HOP_H
          }
          // Phase 2 — only after fully landing, spring forward, peaking at the launch
          const LUNGE_START = HOP_DUR
          let dartFrac = 0
          if (elapsed >= LUNGE_START && elapsed < apexAt) {
            dartFrac = Math.sin(((elapsed - LUNGE_START) / (apexAt - LUNGE_START)) * Math.PI / 2)
          } else if (elapsed >= apexAt) {
            dartFrac = 1 - (elapsed - apexAt) / (anim.total - apexAt)
          }
          const dartDist = dartFrac * 34
          nudgeX += (anim.dirX ?? 0) * dartDist
          nudgeY += (anim.dirY ?? 0) * dartDist
        } else if (anim.type === 'whirlpool_swirl') {
          // Tapu Fini: sweep in a wide, shallow oval — spiraling outward then back to
          // center — as if stirring up a whirlpool. Radius grows 0→1→0 so she starts
          // and ends at rest; LOOPS controls how many revolutions she carves.
          const progress = 1 - anim.remaining / anim.total  // 0 → 1
          const A = 34, B = 13          // wide oval: broad horizontally, shallow vertically
          const LOOPS = 1.5
          const r = Math.sin(progress * Math.PI)            // envelope: out then back in
          const theta = progress * LOOPS * Math.PI * 2
          nudgeX += A * r * Math.cos(theta)
          nudgeY += B * r * Math.sin(theta)
        } else if (anim.type === 'apex_hop') {
          // Clean jump whose apex is timed to the ability launch (apexAt = castTimeTicks):
          // ease up to the peak, then ease back down. Ability fires exactly at the apex.
          const elapsed = anim.total - anim.remaining
          const apexAt  = anim.apexAt ?? Math.round(anim.total * 0.5)
          const JUMP_H  = 34
          if (elapsed < apexAt) {
            nudgeY += -Math.sin((elapsed / apexAt) * (Math.PI / 2)) * JUMP_H
          } else {
            const t = (elapsed - apexAt) / (anim.total - apexAt)
            nudgeY += -Math.cos(t * (Math.PI / 2)) * JUMP_H
          }
        } else if (anim.type === 'sway') {
          // Rhythmic side-to-side sway — 2 full oscillations fading out
          const t = 1 - anim.remaining / anim.total  // 0 → 1
          nudgeX += Math.sin(t * Math.PI * 4) * 9 * (1 - t)
        } else if (anim.type === 'cock_toss') {
          // Gradual CW cock-back to 65°, then swing straight forward to 0 (no hold pause).
          // The egg launches at castTimeTicks, which lands partway into this forward swing,
          // so it releases as the arm comes through rather than while still cocked back.
          const elapsed = anim.total - anim.remaining
          const apexAt  = anim.apexAt ?? 30
          const MAX_ROT = 65 * (Math.PI / 180)
          if (elapsed < apexAt) {
            const t = elapsed / apexAt
            spriteRotate = t * t * MAX_ROT          // ease-in: slow start, reaches full tilt
          } else {
            const t = (elapsed - apexAt) / (anim.total - apexAt)
            spriteRotate = MAX_ROT * (1 - t)        // swing forward to neutral
          }
        } else if (anim.type === 'hammer_swing') {
          // Club swing: quick CW wind-up → dramatic CCW downswing (mirrored for 2nd strike)
          const elapsed = anim.total - anim.remaining
          const dx  = anim.dirX ?? 0
          const dy  = anim.dirY ?? 0
          const dir = anim.swingDir ?? 1   // 1 = CW raise → CCW slam; -1 = mirror
          const WINDUP_END = 6             // quick CW cock (raises club)
          const STRIKE_END = 16            // dramatic CCW downswing (impact)
          // angles: wind-up is small CW (+), strike is large CCW (-)
          const WINDUP_ROT = dir *  28 * (Math.PI / 180)
          const STRIKE_ROT = dir * -75 * (Math.PI / 180)
          if (elapsed < WINDUP_END) {
            const t = elapsed / WINDUP_END
            spriteRotate = WINDUP_ROT * Math.sin(t * Math.PI / 2)   // ease into raise
            nudgeX -= dx * t * 6
            nudgeY -= dy * t * 6
          } else if (elapsed < STRIKE_END) {
            const t = (elapsed - WINDUP_END) / (STRIKE_END - WINDUP_END)
            const ease = t * t   // accelerate into the swing
            spriteRotate = WINDUP_ROT + (STRIKE_ROT - WINDUP_ROT) * ease
            nudgeX += dx * ease * 24   // lunge forward as club swings down
            nudgeY += dy * ease * 24
          } else {
            // Ease back to neutral
            const t    = (elapsed - STRIKE_END) / (anim.total - STRIKE_END)
            const ease = 1 - (1 - t) * (1 - t)
            spriteRotate = STRIKE_ROT * (1 - ease)
            nudgeX += dx * 24 * (1 - ease)
            nudgeY += dy * 24 * (1 - ease)
          }
        } else if (anim.type === 'unown_spin') {
          // Spin to a random angle and snap back — projectile fires when sprite returns to 0°
          const elapsed = anim.total - anim.remaining
          const t = elapsed / anim.total
          const ta = anim.targetAngle ?? Math.PI
          if (t < 0.5) {
            spriteRotate = ta * Math.sin((t / 0.5) * Math.PI * 0.5)
          } else {
            spriteRotate = ta * Math.cos(((t - 0.5) / 0.5) * Math.PI * 0.5)
          }
        } else if (anim.type === 'absol_slash') {
          // Sprite spins one full CW rotation aligned with the sweeping blade
          const elapsed = anim.total - anim.remaining
          const t = elapsed / anim.total
          spriteRotate = (anim.startAngle ?? 0) + t * Math.PI * 2
        } else if (anim.type === 'spin') {
          // Marowak orbits all 6 adjacent hex positions while spinning her sprite
          const elapsed = anim.total - anim.remaining
          const t = elapsed / anim.total
          // Orbit radius = pointy-top hex horizontal spacing (distance to same-row neighbor)
          const orbitRadius = HEX_SIZE * Math.sqrt(3)
          // Smooth radius envelope: ease in first 12%, constant, ease out last 12%
          const FADE = 0.12
          let r: number
          if (t < FADE) {
            r = orbitRadius * (t / FADE)
          } else if (t > 1 - FADE) {
            r = orbitRadius * ((1 - t) / FADE)
          } else {
            r = orbitRadius
          }
          const angle = t * Math.PI * 2   // one full CW orbit
          nudgeX += r * Math.cos(angle)
          nudgeY += r * Math.sin(angle) * BOARD_PERSP_Y  // compress Y for board perspective
          spriteRotate = angle * 2   // spin twice as fast as the orbit
        } else if (anim.type === 'claydol_gravity') {
          // Claydol: rapid Y-flip hop up → hold at apex → descend after slam
          const RISE    = anim.apexAt ?? 12
          const HOLD    = anim.total - RISE * 2
          const elapsed = anim.total - anim.remaining
          const HOP_H   = 52
          if (elapsed < RISE) {
            const t = elapsed / RISE
            nudgeY -= Math.sin(t * Math.PI / 2) * HOP_H
            nudgeScaleX = (Math.floor(elapsed / 4) % 2 === 0) ? 1 : -1  // rapid flip every 4 ticks
          } else if (elapsed < RISE + HOLD) {
            nudgeY -= HOP_H
            const holdElapsed = elapsed - RISE
            nudgeScaleX = (Math.floor(holdElapsed / 8) % 2 === 0) ? 1 : -1  // slower flip at apex
          } else {
            const t = (elapsed - RISE - HOLD) / RISE
            nudgeY -= Math.sin((1 - t) * Math.PI / 2) * HOP_H
          }
        } else if (anim.type === 'slam_land') {
          // Enemies: squash flat on impact, then spring back
          const elapsed   = anim.total - anim.remaining
          const IMPACT    = 8
          if (elapsed < IMPACT) {
            const t = elapsed / IMPACT
            nudgeScaleX = 1 + t * 0.65
            nudgeScaleY = 1 - t * 0.58
          } else {
            const t      = (elapsed - IMPACT) / (anim.total - IMPACT)
            const spring = Math.exp(-t * 4) * Math.cos(t * Math.PI * 3.5)
            nudgeScaleX  = 1 + spring * 0.35
            nudgeScaleY  = 1 - spring * 0.28
          }
        } else if (anim.type === 'rune_charge_lunge') {
          // Runerigus: squash-charge build-up (pulling back), then snap-lunge forward
          // toward the target as the spirit hand launches, then ease back to neutral.
          const elapsed    = anim.total - anim.remaining
          const CHARGE_END = anim.apexAt ?? 10
          const LUNGE_END  = CHARGE_END + 8
          const dx = anim.dirX ?? 0
          const dy = anim.dirY ?? 0
          if (elapsed < CHARGE_END) {
            const t = elapsed / CHARGE_END
            nudgeScaleX = 1 + t * 0.30
            nudgeScaleY = 1 - t * 0.26
            nudgeX -= dx * t * 5
            nudgeY -= dy * t * 5
          } else if (elapsed < LUNGE_END) {
            const t = (elapsed - CHARGE_END) / (LUNGE_END - CHARGE_END)
            const ease = t * t
            nudgeScaleX = 1.30 - ease * 0.55
            nudgeScaleY = 0.74 + ease * 0.50
            nudgeX += dx * (ease * 22 - 5)
            nudgeY += dy * (ease * 22 - 5)
          } else {
            const t     = (elapsed - LUNGE_END) / (anim.total - LUNGE_END)
            const ease  = 1 - (1 - t) * (1 - t)
            nudgeScaleX = 0.75 + ease * 0.25
            nudgeScaleY = 1.24 - ease * 0.24
            nudgeX += dx * 17 * (1 - ease)
            nudgeY += dy * 17 * (1 - ease)
          }
        } else if (anim.type === 'dire_claw_swipe') {
          // Phase 1 (0-8): pull LEFT (CW perp of forward direction)
          // Phase 2 (8-20): arc through center sweeping UP and RIGHT to apex
          // Phase 3 (20-35): return to center
          const elapsed   = anim.total - anim.remaining
          const PULL_END  = 8
          const APEX      = anim.apexAt ?? 20
          const fdX = anim.dirX ?? 0
          const fdY = anim.dirY ?? 0
          // CW perp of forward = screen-left when facing enemy
          const lX = fdY,  lY = -fdX
          const DIST = 22

          if (elapsed <= PULL_END) {
            // Ease left
            const t    = elapsed / PULL_END
            const frac = Math.sin(t * Math.PI / 2)
            nudgeX += lX * DIST * frac
            nudgeY += lY * DIST * frac
            spriteRotate += frac * (-14 * Math.PI / 180)
          } else if (elapsed <= APEX) {
            // Sweep: angle sweeps from π/2 (full left) → -π/4 (forward-right)
            const t          = (elapsed - PULL_END) / (APEX - PULL_END)
            const startAngle = Math.PI / 2
            const endAngle   = -Math.PI / 4
            const angle      = startAngle + t * (endAngle - startAngle)
            // sin(angle)*perpL + cos(angle)*forward; bulge slightly outward mid-arc
            const R = DIST * (1 + 0.25 * Math.sin(t * Math.PI))
            nudgeX += (Math.sin(angle) * lX + Math.cos(angle) * fdX) * R
            nudgeY += (Math.sin(angle) * lY + Math.cos(angle) * fdY) * R
            // Lean into sweep: -14° at left → +10° at apex
            spriteRotate += (-14 + t * 24) * Math.PI / 180
          } else {
            // Return from apex position to center
            const t         = (elapsed - APEX) / (anim.total - APEX)
            const apexAngle = -Math.PI / 4
            const apexX     = (Math.sin(apexAngle) * lX + Math.cos(apexAngle) * fdX) * DIST
            const apexY     = (Math.sin(apexAngle) * lY + Math.cos(apexAngle) * fdY) * DIST
            const ease      = (1 - t) * (1 - t)
            nudgeX += apexX * ease
            nudgeY += apexY * ease
            spriteRotate += 10 * Math.PI / 180 * ease
          }
        }
      }
      // Noivern pre-cast buildup shake — intensifies in the last half of the cast timer
      if (unit.definitionId === 'noivern' && unit.state === 'casting') {
        const NOIVERN_CAST_T = 20
        const progress = 1 - unit.abilityCastTimer / NOIVERN_CAST_T
        if (progress > 0.4) {
          const phaseT = (progress - 0.4) / 0.6
          const intensity = phaseT * phaseT * 5
          nudgeX += Math.sin(tick * 1.35) * intensity
          nudgeY += Math.cos(tick * 1.05 + 0.6) * intensity
        }
      }
      // Rayquaza: evo shake → mega rumble → motion blur during flight
      if (unit.definitionId === 'rayquaza') {
        const evoShakeFx = unit.statusEffects.find(fx => fx.id === 'rayquaza_evo_shake')
        if (evoShakeFx) {
          // Intensifies over 36 ticks: 0 → 10px at peak
          const progress  = 1 - evoShakeFx.durationTicks / 36
          const intensity = progress * 10
          nudgeX += Math.sin(tick * 1.9 + 0.3) * intensity
          nudgeY += Math.cos(tick * 1.5 + 1.1) * intensity
        }
        if (unit.statusEffects.some(fx => fx.id === 'rayquaza_pre_grab_rumble')) {
          // Gentle power-up rumble as mega form charges for the grab
          nudgeX += Math.sin(tick * 2.3) * 3.5
          nudgeY += Math.cos(tick * 1.8 + 0.8) * 2.5
        }
        if (unit.statusEffects.some(fx => fx.id === 'rayquaza_flying')) {
          nudgeScaleX = 3.0
          nudgeScaleY = 0.55
        }
      }
      // Darmanitan: rumble on every Zen form shift (enter and exit)
      if (unit.definitionId === 'darmanitan') {
        const shift = unit.statusEffects.find(fx => fx.stackId === 'zen_shift')
        if (shift) {
          const progress  = 1 - shift.durationTicks / (shift.magnitude ?? 30)
          const intensity = Math.sin(progress * Math.PI) * 5
          nudgeX += Math.sin(tick * 2.6)       * intensity
          nudgeY += Math.cos(tick * 2.0 + 0.5) * intensity
        }
      }
      // Ferrothorn: activation rumble + per-hit scale pulse
      if (unit.definitionId === 'ferrothorn') {
        const rumble = unit.statusEffects.find(fx => fx.id === 'ferrothorn_rumble')
        if (rumble) {
          const progress  = 1 - rumble.durationTicks / 18
          const intensity = Math.sin(progress * Math.PI) * 4
          nudgeX += Math.sin(tick * 2.8)       * intensity
          nudgeY += Math.cos(tick * 2.1 + 0.4) * intensity
        }
        const hitFlash = unit.statusEffects.find(fx => fx.id === 'ferrothorn_hit_flash')
        if (hitFlash) {
          // Scale decays from 1.03 → 1.0 as durationTicks counts down from 10 → 0
          const s = 1.0 + 0.10 * (hitFlash.durationTicks / 10)
          nudgeScaleX = s
          nudgeScaleY = s
        }
      }
      // Excadrill: each empowered auto whips him in a full circle through the
      // surrounding hexes and back to his own, spinning as he goes. Driven off
      // windup progress (not a castAnim) so it re-runs per auto and always ends
      // where it started — the radius envelope is 0 at both ends of the windup.
      if (unit.definitionId === 'excadrill' && unit.isInWindup
          && unit.attackModifiers.length > 0 && unit.attackModifiers[0].id === 'excadrill_drill') {
        const wt      = windupTicks(unit)
        const elapsed = wt - unit.attackWindupTimer
        const t       = Math.min(1, Math.max(0, elapsed / Math.max(1, wt)))
        const angle   = t * Math.PI * 2                 // one full CW orbit over the windup
        const orbitRadius = HEX_SIZE * Math.sqrt(3)     // distance to a same-row neighbour
        const FADE = 0.18                               // ease out from / back into his own hex
        const r = t < FADE       ? orbitRadius * (t / FADE)
                : t > 1 - FADE   ? orbitRadius * ((1 - t) / FADE)
                :                  orbitRadius
        nudgeX += r * Math.cos(angle)
        nudgeY += r * Math.sin(angle) * BOARD_PERSP_Y   // compress Y for board perspective
        spriteRotate = angle * 2                        // two sprite rotations per orbit
      }
      // Tapu Lele: escalating rumble during 2s channel (intensifies toward damage)
      if (unit.definitionId === 'tapu_lele') {
        const channelFx = unit.statusEffects.find(fx => fx.stackId === 'tapulele_channel')
        if (channelFx) {
          const progress  = 1 - channelFx.durationTicks / (2 * TICK_RATE)  // 0 → 1
          const intensity = Math.pow(progress, 1.5) * 9                     // accelerates toward end
          nudgeX += Math.sin(tick * 4.3)       * intensity
          nudgeY += Math.cos(tick * 3.9 + 1.1) * intensity
        }
      }
      // Fezandipiti: rumble on cast
      if (unit.definitionId === 'fezandipiti') {
        const rumbleFx = unit.statusEffects.find(fx => fx.stackId === 'fez_rumble')
        if (rumbleFx) {
          const progress  = 1 - rumbleFx.durationTicks / rumbleFx.magnitude!
          const intensity = Math.sin(progress * Math.PI) * 5
          nudgeX += Math.sin(tick * 4.1)       * intensity
          nudgeY += Math.cos(tick * 3.7 + 0.5) * intensity
        }
      }
      // Celebi: hop + full spin on cast
      if (unit.definitionId === 'celebi') {
        const hopFx = unit.statusEffects.find(fx => fx.stackId === 'celebi_hop')
        if (hopFx) {
          const progress = 1 - hopFx.durationTicks / hopFx.magnitude!
          nudgeY      -= Math.sin(progress * Math.PI) * 22
          spriteRotate = progress * Math.PI * 2
        }
      }
      // Crashout rage entry: hop + rumble while briefly invulnerable (any crashout unit)
      {
        const rageEnterFx = unit.statusEffects.find(fx => fx.stackId === 'crashout_rage_enter')
        if (rageEnterFx && rageEnterFx.magnitude) {
          const progress = 1 - rageEnterFx.durationTicks / rageEnterFx.magnitude
          // Hop: single arc over the first 60% of the animation
          if (progress < 0.6) {
            nudgeY -= Math.sin((progress / 0.6) * Math.PI) * 26
          }
          // Rumble: builds in as the hop lands, shakes through the rest
          const rumbleT = Math.max(0, (progress - 0.35) / 0.65)
          const intensity = Math.sin(rumbleT * Math.PI) * 6
          nudgeX += Math.sin(tick * 4.2)       * intensity
          nudgeY += Math.cos(tick * 3.4 + 0.6) * intensity
        }
      }
      // Morelull: shake on mushroom launch
      if (unit.definitionId === 'morelull') {
        const shakeFx = unit.statusEffects.find(fx => fx.stackId === 'morelull_shake')
        if (shakeFx) {
          const progress  = 1 - shakeFx.durationTicks / shakeFx.magnitude!
          const intensity = Math.sin(progress * Math.PI) * 5
          nudgeX += Math.sin(tick * 3.5)       * intensity
          nudgeY += Math.cos(tick * 2.8 + 0.4) * intensity
        }
      }
      // Morgrem: rumble on cast, then hard slap at aura end
      if (unit.definitionId === 'morgrem') {
        const rumbleFx = unit.statusEffects.find(fx => fx.stackId === 'morgrem_rumble')
        if (rumbleFx) {
          const progress  = 1 - rumbleFx.durationTicks / rumbleFx.magnitude!
          const intensity = Math.sin(progress * Math.PI) * 6
          nudgeX += Math.sin(tick * 3.8)       * intensity
          nudgeY += Math.cos(tick * 3.1 + 0.7) * intensity
        }
        const slapFx = unit.statusEffects.find(fx => fx.stackId === 'morgrem_slap')
        if (slapFx) {
          const progress = 1 - slapFx.durationTicks / slapFx.magnitude!
          const mTarget = unit.targetId ? units.get(unit.targetId) : undefined
          let mnx = 0, mny = 0
          if (mTarget) {
            const mdx = mTarget.visualPos.x - unit.visualPos.x
            const mdy = mTarget.visualPos.y - unit.visualPos.y
            const md  = Math.sqrt(mdx * mdx + mdy * mdy)
            if (md > 0) { mnx = mdx / md; mny = mdy / md }
          }
          // Perpendicular directions for lateral sweep
          const perpLx = -mny, perpLy = mnx   // left of forward
          const perpRx =  mny, perpRy = -mnx  // right of forward
          const WIND_ROT   =  62 * Math.PI / 180   // +62° CW wind-up
          const STRIKE_ROT = -95 * Math.PI / 180   // end rotation at contact
          const MAX_LUNGE  = 65
          if (progress < 0.22) {
            // wind-up: lean CW, nudge back-left
            const t = progress / 0.22
            const ease = t * t
            spriteRotate  = WIND_ROT * ease
            nudgeX += mnx * (-ease * 10) + perpLx * (ease * 7)
            nudgeY += mny * (-ease * 10) + perpLy * (ease * 7)
          } else if (progress < 0.68) {
            // strike: 157° sweep CCW, deep lunge forward, sweep right
            const t    = (progress - 0.22) / (0.68 - 0.22)
            const ease = t * t
            spriteRotate  = WIND_ROT + (STRIKE_ROT - WIND_ROT) * ease
            nudgeX += mnx * (-10 + ease * (MAX_LUNGE + 10)) + perpRx * (ease * 9)
            nudgeY += mny * (-10 + ease * (MAX_LUNGE + 10)) + perpRy * (ease * 9)
          } else {
            // recover
            const t = (progress - 0.68) / (1 - 0.68)
            spriteRotate  = STRIKE_ROT * (1 - t)
            nudgeX += mnx * MAX_LUNGE * (1 - t * t)
            nudgeY += mny * MAX_LUNGE * (1 - t * t)
          }
        }
      }
      // Sableye: launch shake as gems fire
      if (unit.definitionId === 'sableye') {
        const rumble = unit.statusEffects.find(fx => fx.id === 'sableye_rumble')
        if (rumble) {
          const progress  = 1 - rumble.durationTicks / 15
          const intensity = Math.sin(progress * Math.PI) * 5  // arc: builds then fades
          nudgeX += Math.sin(tick * 3.2)       * intensity
          nudgeY += Math.cos(tick * 2.7 + 0.5) * intensity
        }
      }
      // Druddigon Dragon Tail: CCW cock-back → fast CW tail sweep reaching peak at onCast
      if (unit.definitionId === 'druddigon' && unit.state === 'casting') {
        const CAST_T     = 32
        const COCK_END   = 0.28   // 0-28%: ease-out CCW cock
        const PAUSE_END  = 0.38   // 28-38%: hold at cock
        const COCK_ROT   = -95 * (Math.PI / 180)
        const STRIKE_ROT = 115 * (Math.PI / 180)

        const elapsed  = CAST_T - unit.abilityCastTimer
        const progress = elapsed / CAST_T

        // Compute forward direction toward target for lunge nudge
        const dTarget = unit.targetId ? units.get(unit.targetId) : undefined
        let dnx = 0, dny = 0
        if (dTarget && dTarget.state !== 'dead') {
          const ddx = dTarget.visualPos.x - unit.visualPos.x
          const ddy = dTarget.visualPos.y - unit.visualPos.y
          const dDist = Math.sqrt(ddx * ddx + ddy * ddy)
          if (dDist > 0) { dnx = ddx / dDist; dny = ddy / dDist }
        }

        if (progress < COCK_END) {
          const t = progress / COCK_END
          const ease = 1 - (1 - t) * (1 - t)
          spriteRotate = COCK_ROT * ease
          nudgeX += dnx * (-ease * 8)
          nudgeY += dny * (-ease * 8)
        } else if (progress < PAUSE_END) {
          spriteRotate = COCK_ROT
          nudgeX += dnx * (-8)
          nudgeY += dny * (-8)
        } else {
          const t    = (progress - PAUSE_END) / (1 - PAUSE_END)
          const ease = t * t
          spriteRotate = COCK_ROT + (STRIKE_ROT - COCK_ROT) * ease
          nudgeX += dnx * (-8 + ease * 34)
          nudgeY += dny * (-8 + ease * 34)
        }
      }
      // Barraskewda: full spinning lunge after landing (barraskewda_strike status drives it)
      if (unit.definitionId === 'barraskewda' && unit.state !== 'leaping') {
        const strikeFx = unit.statusEffects.find(fx => fx.stackId === 'barraskewda_strike')
        if (strikeFx?.magnitude) {
          const progress = 1 - (strikeFx.durationTicks / strikeFx.magnitude)

          const bTarget = unit.targetId ? units.get(unit.targetId) : undefined
          let bnx = 0, bny = 0
          if (bTarget) {
            const bdx = bTarget.visualPos.x - unit.visualPos.x
            const bdy = bTarget.visualPos.y - unit.visualPos.y
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy)
            if (bdist > 0) { bnx = bdx / bdist; bny = bdy / bdist }
          }

          // Full CW rotation over the animation
          spriteRotate = progress * 2 * Math.PI

          // Lunge: ease-in forward to peak at 65%, then pull back
          const LUNGE_PEAK = 0.65
          const MAX_LUNGE  = 65
          const lunge = progress < LUNGE_PEAK
            ? MAX_LUNGE * ((progress / LUNGE_PEAK) ** 2)
            : MAX_LUNGE * (1 - (progress - LUNGE_PEAK) / (1 - LUNGE_PEAK))
          nudgeX += bnx * lunge
          nudgeY += bny * lunge
        }
      }

      // Corkscrew dash: deep through-and-back lunge + fast multi-spin, driven by
      // the corkscrew_dash status (like Barraskewda's strike) rather than windup
      // phase timing — so it always plays fully, including for mega Rayquaza.
      if (unit.state !== 'leaping') {
        const dashFx = unit.statusEffects.find(fx => fx.stackId === 'corkscrew_dash')
        if (dashFx?.magnitude) {
          const p = 1 - dashFx.durationTicks / dashFx.magnitude  // 0 → 1 over the dash
          const cTarget = unit.targetId ? units.get(unit.targetId) : undefined
          let cnx = 0, cny = 0
          if (cTarget && cTarget.state !== 'dead') {
            const cdx = cTarget.visualPos.x - unit.visualPos.x
            const cdy = cTarget.visualPos.y - unit.visualPos.y
            const cd  = Math.sqrt(cdx * cdx + cdy * cdy)
            if (cd > 0) { cnx = cdx / cd; cny = cdy / cd }
          }
          // Lunge through the target (peak at 40%), then corkscrew back
          const LUNGE = 170
          const lunge = p < 0.4 ? LUNGE * (p / 0.4) : LUNGE * (1 - (p - 0.4) / 0.6)
          nudgeX += cnx * lunge
          nudgeY += cny * lunge
          // 3 full accelerating spins — emphasizes the empowered corkscrew hit
          spriteRotate = p * p * Math.PI * 6
        }
      }

      // Grabbed unit: 40% smaller while held; motion blur when off-board during flight
      if (unit.statusEffects.some(fx => fx.id === 'rayquaza_grabbed')) {
        if (unit.visualPos.x > 800) {
          nudgeScaleX = 1.8   // 3.0 * 0.6
          nudgeScaleY = 0.33  // 0.55 * 0.6
        } else {
          nudgeScaleX = 0.6
          nudgeScaleY = 0.6
        }
      }

      // Claydol Gravity target — float upward and spin while airborne
      if (gravityFx) {
        // Restart the video from frame 0 on the first tick of each new cast
        if (gravityFx.durationTicks === (gravityFx.magnitude ?? 90)) {
          gravityVideo.currentTime = 0
          if (gravityVideo.paused) gravityVideo.play().catch(() => {})
        }
        const TOTAL   = gravityFx.magnitude ?? 90
        const RISE    = 12
        const elapsed = TOTAL - gravityFx.durationTicks
        const floatFrac = elapsed < RISE ? Math.sin((elapsed / RISE) * Math.PI / 2) : 1.0
        nudgeY -= floatFrac * 56
        spriteRotate = elapsed * (Math.PI / 15)  // ~4 full rotations over 90 ticks
      }
      }  // end !celebrating

      const isOrbitSpinning = unit.definitionId === 'a_marowak' &&
        (castAnims?.some(a => a.unitId === unit.id && a.type === 'spin') ?? false)
      const wsConsumeAnim = castAnims?.find(a => a.unitId === unit.id && a.type === 'ws_consume_shake')
      const wsConsumeTintP = wsConsumeAnim ? wsConsumeAnim.remaining / wsConsumeAnim.total : 0
      this.drawUnit(ctx, unit, nudgeX, nudgeY - celebBob, healFlashUnits, spriteRotate, nudgeScaleX, nudgeScaleY, tick, isOrbitSpinning, wsConsumeTintP, starFlashP)

      // Temporal Woods debuff indicator — sways above the affected unit
      const twDebuff = unit.statusEffects.find(fx => fx.stackId === 'temporal_woods_debuff')
      if (twDebuff && temporalWoodsEffectImg.complete && temporalWoodsEffectImg.naturalWidth > 0) {
        const level  = twDebuff.magnitude ?? 2
        const iw     = temporalWoodsEffectImg.naturalWidth
        const ih     = temporalWoodsEffectImg.naturalHeight
        const scale  = ih > 0 ? (SPRITE_HALF * 1.12) / ih : 1
        const dw     = iw * scale
        const dh     = ih * scale
        const ux     = unit.visualPos.x
        const uy     = unit.visualPos.y - SPRITE_HALF * 1.2
        const sway   = Math.sin(performance.now() * 0.0018 + unit.visualPos.x * 0.01) * 0.32

        const drawIcon = (filter: string, offsetX = 0) => {
          ctx.save()
          ctx.translate(ux + offsetX, uy)
          ctx.rotate(sway)
          ctx.filter = filter
          ctx.globalAlpha = 0.92
          ctx.drawImage(temporalWoodsEffectImg, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }

        if (level >= 6) {
          drawIcon('sepia(1) hue-rotate(270deg) saturate(5) brightness(1.15)', -dw * 0.18)
          drawIcon('sepia(1) hue-rotate(240deg) saturate(5) brightness(0.9)',   dw * 0.18)
        } else if (level >= 4) {
          drawIcon('sepia(1) hue-rotate(240deg) saturate(5) brightness(0.9)')
        } else {
          drawIcon('sepia(1) hue-rotate(270deg) saturate(5) brightness(1.15)')
        }
      }

      // Froststone marks — flower pattern near the unit's feet, consume animation on clear
      if (iceMarkImg.complete && iceMarkImg.naturalWidth > 0) {
        const consumeAnim = unit.statusEffects.find(fx => fx.stackId === 'froststone_consume_anim')
        const markFx      = unit.statusEffects.find(fx => fx.stackId === 'froststone_mark')
        const stacks      = markFx?.magnitude ?? 0

        if (consumeAnim || stacks > 0) {
          const MARK_RADIUS = 13
          const MARK_SIZE   = 20
          const cx = unit.visualPos.x
          const cy = unit.visualPos.y + SPRITE_HALF * 0.38

          if (consumeAnim) {
            // Spin all 5 marks outward and fade
            const total = consumeAnim.magnitude ?? 45
            const t     = 1 - consumeAnim.durationTicks / total
            const alpha = 0.8 * (1 - t)
            const r     = MARK_RADIUS + t * 24
            for (let i = 0; i < 5; i++) {
              const base  = -Math.PI / 2 + i * (2 * Math.PI / 5)
              const angle = base + t * Math.PI * 4
              ctx.save()
              ctx.globalAlpha = alpha
              ctx.translate(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
              ctx.rotate(angle + Math.PI / 2)
              ctx.drawImage(iceMarkImg, -MARK_SIZE / 2, -MARK_SIZE / 2, MARK_SIZE, MARK_SIZE)
              ctx.restore()
            }
          } else {
            for (let i = 0; i < stacks; i++) {
              const angle = -Math.PI / 2 + i * (2 * Math.PI / 5)
              ctx.save()
              ctx.globalAlpha = 0.8
              ctx.translate(cx + MARK_RADIUS * Math.cos(angle), cy + MARK_RADIUS * Math.sin(angle))
              ctx.rotate(angle + Math.PI / 2)
              ctx.drawImage(iceMarkImg, -MARK_SIZE / 2, -MARK_SIZE / 2, MARK_SIZE, MARK_SIZE)
              ctx.restore()
            }
          }
        }
      }

      // Gravity field — anchored to the unit's current visual position (not hex grid origin)
      if (gravityFx && gravityVideo.readyState >= 2) {
        const baseY = unit.visualPos.y + HEX_SIZE * 0.5
        const gW    = Math.round(HEX_SIZE * Math.sqrt(3) * 1.2)
        const gH    = Math.round(HEX_SIZE * 2.4)
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.drawImage(gravityVideo, unit.visualPos.x - gW / 2, baseY - gH, gW, gH)
        ctx.restore()
      }
    }

    // Flying Aqua Ring pass animation — two phases: pulse at death pos, then fly to target
    if (this.ringPassAnim && aquaRingImg.complete && aquaRingImg.naturalWidth > 0) {
      const PULSE_MS  = 125
      const FLIGHT_MS = 300
      const TOTAL_MS  = PULSE_MS + FLIGHT_MS
      const { fromX, fromY, toX, toY, toUnitId, startTs, level } = this.ringPassAnim
      const elapsed = performance.now() - startTs
      const toUnit  = units.get(toUnitId)
      if (elapsed >= TOTAL_MS || !toUnit) {
        this.ringPassAnim = null
      } else {
        const SIZE = SPRITE_HALF * 2.2
        ctx.save()
        ctx.filter = aquaRingLevelFilter(level)

        if (elapsed < PULSE_MS) {
          // Phase 1: ring stays at the dead unit's position and pulses 50% larger once
          const pt    = elapsed / PULSE_MS      // 0 → 1
          const pulse = Math.sin(pt * Math.PI) * 0.5  // 0 → 0.5 → 0
          ctx.globalAlpha = 0.92
          ctx.translate(fromX, fromY)
          ctx.scale(1 + pulse, 1 + pulse)
          ctx.drawImage(aquaRingImg, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
        } else {
          // Phase 2: ring flies from fromX/Y to target, squashing along the travel direction
          const ft     = (elapsed - PULSE_MS) / FLIGHT_MS  // 0 → 1
          const cx     = fromX + (toX - fromX) * ft
          const cy     = fromY + (toY - fromY) * ft - Math.sin(ft * Math.PI) * 40
          const angle  = Math.atan2(toY - fromY, toX - fromX)
          const squash = Math.sin(ft * Math.PI) * 0.38
          ctx.globalAlpha = 0.92
          ctx.translate(cx, cy)
          ctx.rotate(angle)
          ctx.scale(1 + squash, 1 - squash * 0.55)
          ctx.drawImage(aquaRingImg, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
        }

        ctx.restore()
      }
    }

    // ─── Cliff fall animations ─────────────────────────────────────────────────
    {
      const FALL_MS    = 750
      const CRUMBLE_MS = 200
      const VERT_STEP  = HEX_SIZE * 1.5  // world-space y per hex row
      const ROTATIONS  = 2.0             // full spins during the tumble
      const now = performance.now()
      for (let i = this.cliffFalls.length - 1; i >= 0; i--) {
        const fall    = this.cliffFalls[i]
        const elapsed = now - fall.startTs
        if (elapsed > FALL_MS + CRUMBLE_MS) { this.cliffFalls.splice(i, 1); continue }

        const img = fall.isLeft ? cliffLImg : cliffRImg
        if (!img.complete || !img.naturalWidth) continue

        const t     = Math.min(1, elapsed / FALL_MS)
        const eased = t * t * (3 - 2 * t)  // smoothstep for position
        const alpha = elapsed > FALL_MS ? 1 - (elapsed - FALL_MS) / CRUMBLE_MS : 1

        const spriteW = SPRITE_HALF * 1.4
        const spriteH = SPRITE_HALF * 2.8

        // Sprite anchor: visualPos.y - H*0.60 + H*0.50 = visualPos.y - H*0.10
        const startCenterY = fall.y - spriteH * 0.10

        // Translate forward along the column (tumbling over affected hexes)
        const travelY  = fall.direction * eased * 4 * VERT_STEP
        const currentY = startCenterY + travelY

        // Rolling spin: top face moves backward relative to travel direction.
        // direction=-1 (player, moving up): clockwise = +angle; direction=1: CCW = -angle.
        const angle = -fall.direction * t * ROTATIONS * Math.PI * 2

        const shake = (1 - t) * 3
        const rx = Math.sin(now * 0.18 + i) * shake
        const ry = Math.cos(now * 0.14 + i * 1.3) * shake * 0.5

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(fall.x + rx, currentY + ry)
        ctx.rotate(angle)
        // Centered on pivot so the rock tumbles around its own centre
        ctx.drawImage(img, -spriteW / 2, -spriteH / 2, spriteW, spriteH)
        ctx.restore()

        // Dust trail behind the tumbling cliff
        if (t > 0.1) {
          const trailLen  = Math.abs(travelY)
          const trailTopY = fall.direction === -1 ? currentY : startCenterY
          const dustX     = fall.x - spriteW * 0.3
          ctx.save()
          ctx.globalAlpha = alpha * 0.22 * (1 - t * 0.5)
          ctx.fillStyle = '#a08060'
          ctx.fillRect(dustX, trailTopY, spriteW * 0.6, trailLen)
          ctx.restore()
        }
      }
    }

    ctx.restore()
  }

  /** Draw HP + mana bars and status dots for all living units. Call this last so bars render above everything. */
  // Equipped-item icon, drawn to the right of each unit. Called in both planning
  // (preview) and combat, since neither path shares an overlay pass.
  drawItems(units: Map<string, Unit>): void {
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(0, OVERLAY_HEADROOM)
    ctx.save()
    ctx.scale(1, BOARD_PERSP_Y)
    for (const unit of units.values()) {
      if (unit.state === 'dead') continue
      const itemId = unit.items[0]
      if (!itemId) continue
      const path = ITEM_MAP.get(itemId)?.iconPath
      if (!path) continue
      const img = itemIcon(path)
      if (!img.complete || img.naturalWidth === 0) continue
      // Contain-fit into a 28px box so non-square icons keep their aspect ratio.
      const box = 28
      const scale = box / Math.max(img.naturalWidth, img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      // Counter-scale out the board's vertical perspective compression (like the
      // sprite path) so the icon isn't squished — anchor stays on the perspective
      // plane, but the image itself is drawn with square pixels.
      const ax = unit.visualPos.x + SPRITE_HALF * 0.5
      const ay = unit.visualPos.y - dh * 0.15
      ctx.save()
      ctx.translate(ax, ay)
      ctx.scale(1, 1 / BOARD_PERSP_Y)
      ctx.drawImage(img, 0, 0, dw, dh)
      ctx.restore()
    }
    ctx.restore()
  }

  drawAllHealthBars(units: Map<string, Unit>): void {
    const ctx = this.ctx
    // Same headroom offset as draw() (this runs after it, on the same canvas,
    // and must not clear — it draws bars/CC icons on top of the sprites).
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(0, OVERLAY_HEADROOM)
    ctx.save()
    ctx.scale(1, BOARD_PERSP_Y)
    for (const unit of units.values()) {
      if (unit.state === 'dead' || unit.definitionId === 'ruiner_stone') continue
      this.drawHealthBars(ctx, unit)
      this.drawStatusDots(ctx, unit)

      // Salamence Enraged: anger mark floating over the head, left side of the sprite
      if (unit.definitionId === 'salamence'
          && unit.statusEffects.some(fx => fx.id === 'salamence_enraged')
          && enragedImg.complete && enragedImg.naturalWidth > 0) {
        const size = 24
        const ex = unit.visualPos.x - SPRITE_HALF * 0.9 - size / 2
        const ey = unit.visualPos.y - SPRITE_HALF * 0.25 - size / 2
        ctx.drawImage(enragedImg, ex, ey, size, size)
      }
    }
    ctx.restore()
  }

  private drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, nudgeX: number, nudgeY: number, healFlashUnits?: Map<string, number>, spriteRotate = 0, nudgeScaleX = 1, nudgeScaleY = 1, tick = 0, isOrbitSpinning = false, wsConsumeTintP = 0, starFlashP = 0): void {
    const x = unit.visualPos.x + nudgeX
    const y = unit.visualPos.y + nudgeY

    if (unit.isDummy) {
      this.drawDummy(ctx, unit, x, y)
      return
    }

    // Iron Defense passive: draw rocky shield aura under sprite
    const hasIronDefense = unit.shields.some(s => s.sourceAbility === 'graveler_iron_defense')
    if (hasIronDefense && ironDefenseImg.complete && ironDefenseImg.naturalWidth > 0) {
      const auraSize = SPRITE_HALF * 2.4
      ctx.save()
      ctx.globalAlpha = 0.75
      ctx.drawImage(ironDefenseImg, x - auraSize / 2, y - auraSize / 2, auraSize, auraSize)
      ctx.restore()
    }

    // Iron Barbs active: draw shield aura under Ferrothorn
    const hasIronBarbs = unit.statusEffects.some(fx => fx.id === 'iron_barbs')
    if (hasIronBarbs && ironBarbsImg.complete && ironBarbsImg.naturalWidth > 0) {
      const auraSize = SPRITE_HALF * 2.6
      ctx.save()
      ctx.globalAlpha = 0.80
      ctx.drawImage(ironBarbsImg, x - auraSize / 2, y - auraSize / 2, auraSize, auraSize)
      ctx.restore()
    }

    // Aqua Ring: squish-squash aura behind the ring holder, tinted by threshold level
    const aquaRingFx = unit.statusEffects.find(fx => fx.stackId === 'aqua_ring')
    if (aquaRingFx && aquaRingImg.complete && aquaRingImg.naturalWidth > 0) {
      const t = performance.now() * 0.0028
      const scaleX = 1 + Math.sin(t) * 0.13
      const scaleY = 1 / scaleX
      const ringSize = SPRITE_HALF * 3.2
      ctx.save()
      ctx.globalAlpha = 0.82
      ctx.filter = aquaRingLevelFilter(aquaRingFx.magnitude ?? 2)
      ctx.translate(x, y)
      ctx.scale(scaleX, scaleY)
      ctx.drawImage(aquaRingImg, -ringSize / 2, -ringSize / 2, ringSize, ringSize)
      ctx.restore()
    }

    // Pale yellow shield glow behind unit sprite
    const totalShield = unit.shields.reduce((s, sh) => s + sh.value, 0)
    if (totalShield > 0) {
      ctx.beginPath()
      ctx.arc(x, y, SPRITE_HALF + 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 235, 80, 0.18)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, SPRITE_HALF + 3, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 245, 160, 0.45)'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    const sprite = getSprite(unit.definitionId)

    if (sprite) {
      // Undo Y-perspective compression for the sprite so it stands upright.
      // Fit the image within SPRITE_HALF*2 box while preserving natural aspect ratio.
      const def = UNIT_MAP.get(unit.definitionId)
      const spriteScale = def?.spriteScale ?? 1
      const thickFatActive  = unit.statusEffects.some(fx => fx.stackId === 'thick_fat')
      const aquaRingSizeFx  = unit.statusEffects.find(fx => fx.stackId === 'aqua_ring_size')
      const aquaRingScale   = aquaRingSizeFx?.magnitude ?? 1
      const half = SPRITE_HALF * spriteScale * aquaRingScale * (thickFatActive ? 1.1 : 1)
      const iw = sprite instanceof HTMLVideoElement
        ? sprite.videoWidth
        : (sprite.naturalWidth  || sprite.width)
      const ih = sprite instanceof HTMLVideoElement
        ? sprite.videoHeight
        : (sprite.naturalHeight || sprite.height)
      const scale = ih > 0 ? Math.min(half * 2 / iw, half * 2 / ih) : 1
      const dw = iw * scale
      const dh = ih * scale
      const leapRaw = unit.state === 'leaping'
        ? (unit as any)._leap as { tick: number; total: number; sx: number; sy: number; ex: number; ey: number } | undefined
        : undefined
      const leap = unit.definitionId === 'vigoroth' ? leapRaw : undefined
      const isRaichuDash      = unit.definitionId === 'a_raichu'    && !!leapRaw
      const isBarraskewdaDash = unit.definitionId === 'barraskewda' && !!leapRaw
      const isGibleLeap       = unit.definitionId === 'gible'       && !!leapRaw
      const isWailordBounce    = unit.definitionId === 'wailord'     && !!leapRaw
      const isTalonflameStrike = unit.definitionId === 'talonflame' && !!leapRaw
      const isExcadrillTunnel  = unit.definitionId === 'excadrill'  && !!leapRaw
      const isAbsolDash        = unit.definitionId === 'absol'      && !!leapRaw
      const isDarmanitanDash   = unit.definitionId === 'darmanitan' && !!leapRaw
      // Outbound when the leap's pixel destination is far from the home hex (visual-only leaps
      // keep hexPos at home, so the return leap's destination ≈ home pixel).
      const isTalonflameOutbound = isTalonflameStrike && leapRaw
        ? (() => { const hp = hexToPixel(unit.hexPos, HEX_SIZE); return Math.hypot(leapRaw.ex - hp.x, leapRaw.ey - hp.y) > HEX_SIZE * 0.5 })()
        : false
      const leapT = leapRaw ? Math.min(1, leapRaw.tick / Math.max(1, leapRaw.total)) : 0

      if (leap) {
        // Vigoroth: spinning ghost trail
        const trailSteps = 3
        const dashDirX = leap.total > 0 ? (leap.ex - leap.sx) / Math.hypot(leap.ex - leap.sx, leap.ey - leap.sy) : 0
        const dashDirY = leap.total > 0 ? (leap.ey - leap.sy) / Math.hypot(leap.ex - leap.sx, leap.ey - leap.sy) : 0
        const trailSpacing = 14
        for (let i = trailSteps; i >= 1; i--) {
          const trailAlpha = (1 - i / (trailSteps + 1)) * 0.35 * Math.sin(leapT * Math.PI)
          const tx = x - dashDirX * i * trailSpacing
          const ty = y - dashDirY * i * trailSpacing
          const trailAngle = leapT * Math.PI * 2 - (i * 0.4)
          ctx.save()
          ctx.globalAlpha = trailAlpha
          ctx.translate(tx, ty)
          ctx.scale(1, 1 / BOARD_PERSP_Y)
          ctx.rotate(trailAngle)
          ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      } else if (isAbsolDash && leapRaw) {
        // Absol: dark-purple afterimage trail
        const trailSteps = 3
        const dashDirX = leapRaw.total > 0 ? (leapRaw.ex - leapRaw.sx) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        const dashDirY = leapRaw.total > 0 ? (leapRaw.ey - leapRaw.sy) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        for (let i = trailSteps; i >= 1; i--) {
          const trailAlpha = (1 - i / (trailSteps + 1)) * 0.28 * Math.sin(leapT * Math.PI)
          const tx = x - dashDirX * i * 11
          const ty = y - dashDirY * i * 11
          ctx.save()
          ctx.globalAlpha = trailAlpha
          ctx.filter = 'brightness(0.4) saturate(2) hue-rotate(260deg)'
          ctx.translate(tx, ty)
          ctx.scale(1, 1 / BOARD_PERSP_Y)
          ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      } else if (isDarmanitanDash && leapRaw) {
        // Darmanitan: fiery red afterimage — longer, denser trail with a glowing
        // red tint to sell the speed and power of the Flair Blitz.
        const trailSteps = 5
        const dashDirX = leapRaw.total > 0 ? (leapRaw.ex - leapRaw.sx) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        const dashDirY = leapRaw.total > 0 ? (leapRaw.ey - leapRaw.sy) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        for (let i = trailSteps; i >= 1; i--) {
          const trailAlpha = (1 - i / (trailSteps + 1)) * 0.45 * Math.sin(leapT * Math.PI)
          const tx = x - dashDirX * i * 13
          const ty = y - dashDirY * i * 13
          ctx.save()
          ctx.globalAlpha = trailAlpha
          // saturate + sepia + hue-rotate forces every ghost toward vivid red
          ctx.filter = 'brightness(1.05) saturate(4) sepia(0.6) hue-rotate(-28deg)'
          ctx.translate(tx, ty)
          ctx.scale(1, 1 / BOARD_PERSP_Y)
          ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      } else if (isRaichuDash && leapRaw) {
        // Raichu: blue-tinted speed trail, no spin
        const trailSteps = 3
        const dashDirX = leapRaw.total > 0 ? (leapRaw.ex - leapRaw.sx) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        const dashDirY = leapRaw.total > 0 ? (leapRaw.ey - leapRaw.sy) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        for (let i = trailSteps; i >= 1; i--) {
          const trailAlpha = (1 - i / (trailSteps + 1)) * 0.3 * Math.sin(leapT * Math.PI)
          const tx = x - dashDirX * i * 12
          const ty = y - dashDirY * i * 12
          ctx.save()
          ctx.globalAlpha = trailAlpha
          ctx.translate(tx, ty)
          ctx.scale(1, 1 / BOARD_PERSP_Y)
          ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      } else if (isBarraskewdaDash && leapRaw) {
        // Barraskewda: cyan-tinted speed trail
        const trailSteps = 3
        const bdDirX = leapRaw.total > 0 ? (leapRaw.ex - leapRaw.sx) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        const bdDirY = leapRaw.total > 0 ? (leapRaw.ey - leapRaw.sy) / Math.hypot(leapRaw.ex - leapRaw.sx, leapRaw.ey - leapRaw.sy) : 0
        for (let i = trailSteps; i >= 1; i--) {
          const trailAlpha = (1 - i / (trailSteps + 1)) * 0.32 * Math.sin(leapT * Math.PI)
          const tx = x - bdDirX * i * 13
          const ty = y - bdDirY * i * 13
          ctx.save()
          ctx.globalAlpha = trailAlpha
          ctx.filter = 'brightness(1.3) saturate(3) hue-rotate(160deg)'
          ctx.translate(tx, ty)
          ctx.scale(1, 1 / BOARD_PERSP_Y)
          ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      } else if (isTalonflameStrike && leapRaw && isTalonflameOutbound) {
        // Talonflame: fiery orange afterimage trail — only during outbound strikes
        const trailSteps = 4
        const tdx = leapRaw.ex - leapRaw.sx
        const tdy = leapRaw.ey - leapRaw.sy
        const tmag = Math.hypot(tdx, tdy) || 1
        const tdirX = tdx / tmag
        const tdirY = tdy / tmag
        for (let i = trailSteps; i >= 1; i--) {
          const trailAlpha = (1 - i / (trailSteps + 1)) * 0.45 * leapT
          const tx = x - tdirX * i * 9
          const ty = y - tdirY * i * 9
          ctx.save()
          ctx.globalAlpha = trailAlpha
          ctx.translate(tx, ty)
          ctx.scale(1, 1 / BOARD_PERSP_Y)
          ctx.filter = `saturate(5) brightness(1.6) sepia(0.7)`
          ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      }

      ctx.save()
      ctx.translate(x, y)
      // Wailord Bounce: visual arc so the unit rises and falls through the air instead of sliding
      if (isWailordBounce) {
        const arcPeak = 90  // pixels high at mid-leap (screen space, before perspective)
        ctx.translate(0, -Math.sin(leapT * Math.PI) * arcPeak)
      }
      // Talonflame cockback: recoil opposite to travel direction before the lunge.
      // leapT 0→0.55 sweeps a sin bump (0 → peak at 0.275 → 0), giving a slow wind-up then fast snap.
      if (isTalonflameOutbound && leapRaw) {
        const tdx = leapRaw.ex - leapRaw.sx
        const tdy = leapRaw.ey - leapRaw.sy
        const tmag = Math.hypot(tdx, tdy) || 1
        const pullbackPx = leapT < 0.55 ? Math.sin((leapT / 0.55) * Math.PI) * 20 : 0
        ctx.translate(-tdx / tmag * pullbackPx, -tdy / tmag * pullbackPx)
      }
      ctx.scale(1, 1 / BOARD_PERSP_Y)

      // ── Shadow bone fire — drawn before sprite so it appears behind Marowak ──
      const hasModifiers  = unit.definitionId === 'a_marowak' &&
        unit.attackModifiers.some(m => m.id === 'a_marowak_bone' || m.id === 'a_marowak_bone_3')
      const hasShadowBone = hasModifiers || isOrbitSpinning
      if (hasShadowBone && shadowBoneFireVideo.readyState >= 2) {
        const cooldown = attackCooldownTicks(unit)
        let base: number
        let rapidPulse = 0
        if (isOrbitSpinning) {
          base = 1.0  // full saturation during spin finish
        } else if (unit.isInWindup) {
          const wt      = windupTicks(unit)
          const elapsed = wt - unit.attackWindupTimer
          const hitTick = Math.max(1, Math.round(wt * WINDUP_HIT_FRACTION))
          base = 0.55 + 0.45 * Math.min(1, elapsed / hitTick)
          // Fast flicker as strike approaches — frequency increases near hit
          const nearness = Math.min(1, elapsed / hitTick)
          rapidPulse = 0.35 * nearness * Math.abs(Math.sin(tick * (0.3 + nearness * 0.7)))
        } else {
          const countdown = unit.attackTimer / Math.max(1, cooldown)
          base = 0.15 + 0.35 * Math.max(0, 1 - countdown)
        }
        const slowPulse  = 0.10 * Math.sin(tick * 0.14)
        const saturation = Math.max(0.3, Math.min(3.2, (base + rapidPulse) * 2.2 + slowPulse))
        const fw = SPRITE_HALF * 2.8
        const fh = SPRITE_HALF * 2.4
        ctx.save()
        ctx.filter = `saturate(${saturation.toFixed(2)})`
        ctx.drawImage(shadowBoneFireVideo, -fw / 2, -fh * 0.72, fw, fh)
        ctx.restore()
      }

      // ── Flair Blitz fire — drawn before sprite so it appears behind Darmanitan,
      //    rotated 90° so the flame reads as jet-fire powering his dash ──
      if (unit.definitionId === 'darmanitan'
          && unit.statusEffects.some(fx => fx.stackId === 'flair_blitz_active')
          && flairBlitzImg.complete && flairBlitzImg.naturalWidth > 0) {
        const fw = SPRITE_HALF * 1.82   // 30% smaller than the original 2.6
        const fh = SPRITE_HALF * 1.82
        ctx.save()
        // Push the flame behind/below him, shifted right, and lay it on its side
        ctx.translate(SPRITE_HALF * 0.35, SPRITE_HALF * 0.15)
        ctx.rotate(Math.PI / 2)
        ctx.globalAlpha = 0.9
        ctx.drawImage(flairBlitzImg, -fw / 2, -fh / 2, fw, fh)
        ctx.restore()
      }

      // ── Ice Body shield — drawn before sprite so it appears behind Snorunt ──
      const hasIceBody = unit.definitionId === 'snorunt' &&
        unit.shields.some(s => s.sourceAbility === 'snorunt_ice_body')
      if (hasIceBody && iceBodyVideo.readyState >= 2) {
        const pulse = 0.80 + 0.20 * Math.sin(tick * 0.12)
        const iSize = HEX_SIZE * 1.6
        ctx.save()
        ctx.globalAlpha = pulse
        ctx.drawImage(iceBodyVideo, -iSize / 2, -iSize / 2, iSize, iSize)
        ctx.restore()
      }

      // ── Magic Bounce shield — drawn before sprite so it appears behind Xatu ──
      const hasMagicBounce = unit.definitionId === 'xatu' &&
        unit.shields.some(s => s.sourceAbility === 'xatu_magic_bounce')
      if (hasMagicBounce && magicBounceVideo.readyState >= 2) {
        const pulse  = 0.75 + 0.25 * Math.sin(tick * 0.09)
        const bSize  = SPRITE_HALF * 3.0
        ctx.save()
        ctx.globalAlpha = pulse
        ctx.drawImage(magicBounceVideo, -bSize / 2, -bSize / 2, bSize, bSize)
        ctx.restore()
      }

      const flashAlpha = healFlashUnits?.get(unit.id)
      if (flashAlpha !== undefined) {
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.012)
        ctx.shadowColor = `rgba(60, 255, 100, ${flashAlpha * pulse})`
        ctx.shadowBlur = 22
      }
      if (isAbsolDash) {
        // Horizontal stretch + vertical squish — quick predatory lunge feel
        const squishT = Math.sin(leapT * Math.PI)
        ctx.scale(1 + squishT * 0.45, 1 - squishT * 0.32)
        ctx.shadowColor = `rgba(80, 0, 140, ${0.75 * squishT})`
        ctx.shadowBlur = 18 * squishT
      } else if (isExcadrillTunnel) {
        // Drill spin: shrink 40%, 70% opacity, fast continuous rotation, brown earth tint
        ctx.rotate(leapT * Math.PI * 2 * 3)  // 3 full spins
        ctx.scale(0.6, 0.6)
        ctx.globalAlpha = 0.7
      } else if (isGibleLeap) {
        // Fast spin: 4 full rotations over the leap arc
        ctx.rotate(leapT * Math.PI * 2 * 4)
        const squish = 1 - Math.sin(leapT * Math.PI) * 0.15
        ctx.scale(1 / squish, squish)
      } else if (leap) {
        const blurPx = Math.round(Math.sin(leapT * Math.PI) * 3)
        if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`
        ctx.rotate(leapT * Math.PI * 2)
        const squish = 1 - Math.sin(leapT * Math.PI) * 0.15
        ctx.scale(1 / squish, squish)
      } else if (isRaichuDash) {
        // Horizontal stretch + vertical squish for speed feel, blue glow
        const squishT = Math.sin(leapT * Math.PI)
        ctx.scale(1 + squishT * 0.35, 1 - squishT * 0.25)
        ctx.shadowColor = `rgba(100, 180, 255, ${0.9 * squishT})`
        ctx.shadowBlur = 22 * squishT
      } else if (isBarraskewdaDash) {
        // Cyan speed blur + stretch along dash direction
        const squishT = Math.sin(leapT * Math.PI)
        const blurPx  = Math.round(squishT * 3)
        if (blurPx > 0) ctx.filter = `blur(${blurPx}px) brightness(1.15) saturate(2)`
        ctx.scale(1 + squishT * 0.40, 1 - squishT * 0.28)
        ctx.shadowColor = `rgba(0, 210, 240, ${0.85 * squishT})`
        ctx.shadowBlur = 20 * squishT
      } else if (isTalonflameStrike) {
        // Outbound: orange only fires during the STRIKE portion (after the cockback ends at leapT=0.55).
        // strikeProgress² gives a slow build that explodes into peak saturation at the moment of contact.
        // Return: faint residual glow that fades out as Talonflame dashes home.
        const strikeProgress = isTalonflameOutbound && leapT > 0.55 ? (leapT - 0.55) / 0.45 : 0
        const fireT = isTalonflameOutbound ? strikeProgress * strikeProgress : (1 - leapT) * 0.20
        ctx.filter = `saturate(${(1 + fireT * 7).toFixed(2)}) brightness(${(1 + fireT * 0.6).toFixed(2)})`
        ctx.shadowColor = `rgba(255, 110, 0, ${fireT * 0.9})`
        ctx.shadowBlur = 30 * fireT
        const stretchT = Math.sin(leapT * Math.PI) * (isTalonflameOutbound ? 1.0 : 0.4)
        ctx.scale(1 + stretchT * 0.30, 1 - stretchT * 0.22)
      } else if (isWailordBounce) {
        // Arc is handled by the translate above. Squash/stretch reinforces each phase:
        //  0-15%  : push-off squash — wide and flat as Wailord shoves off the ground
        // 15-80%  : airborne stretch — elongated in the direction of travel (vertical on this board)
        // 80-100% : slam squash — extreme flatten as Wailord crashes down on the target
        let scaleX: number, scaleY: number
        if (leapT < 0.15) {
          const p = leapT / 0.15
          // Wide/flat push-off
          scaleY = 1.0 - p * 0.42        // 1.0 → 0.58
          scaleX = 1.0 + p * 0.55        // 1.0 → 1.55
        } else if (leapT < 0.80) {
          // Narrow/tall in air
          scaleY = 1.38
          scaleX = 1 / 1.38
        } else {
          // Slam — ease-in² into extreme squash
          const p = (leapT - 0.80) / 0.20
          scaleY = 1.38 - p * p * (1.38 - 0.38)  // 1.38 → 0.38
          scaleX = 1 / Math.max(0.28, scaleY)
        }
        ctx.scale(scaleX, scaleY)
      } else {
        // Wheezing: brief squash-and-stretch every 0.5s when gas is active (synced with puff pulses)
        const PUFF_INTERVAL = 30
        const isWheezingPuffing = unit.definitionId === 'wheezing' &&
          unit.statusEffects.some(fx => fx.id === 'wheezing_gas_active')
        if (isWheezingPuffing) {
          const phase = (tick % PUFF_INTERVAL) / PUFF_INTERVAL  // 0→1 per cycle
          const pulse = Math.sin(phase * Math.PI)                // 0→1→0 per cycle
          const scaleX = 1 + pulse * 0.18   // widen as it puffs
          const scaleY = 1 - pulse * 0.14   // flatten slightly
          ctx.scale(scaleX, scaleY)
        }
        if (unit.definitionId === 'wailord') {
          const castFx  = unit.state === 'casting' && unit.abilityCastTimer > 0
          const squashFx = unit.statusEffects.find(e => e.id === 'wailord_squash')
          if (castFx) {
            // Very brief squat (5 ticks) before launching — linear is fine at this speed
            const p      = 1 - unit.abilityCastTimer / WAILORD_CAST_TICKS
            const scaleY = 1 - p * 0.38   // 1.0 → 0.62
            ctx.scale(1 / Math.max(0.30, scaleY), scaleY)
          } else if (squashFx?.magnitude) {
            // Landing spring-back: dampened oscillation after impact
            const p      = 1 - squashFx.durationTicks / squashFx.magnitude  // 0→1
            const spring = Math.exp(-p * 5) * Math.cos(p * Math.PI * 2.5)
            const scaleY = 1 - spring * 0.48  // 0.52 at impact → springs ~1.07 → settles 1.0
            ctx.scale(1 / Math.max(0.30, scaleY), scaleY)
          }
        }
        if (spriteRotate !== 0) ctx.rotate(spriteRotate)
        if (nudgeScaleX !== 1 || nudgeScaleY !== 1) ctx.scale(nudgeScaleX, nudgeScaleY)
      }
      // Xatu: flip across Y axis while the empowered Magic Bounce attack is queued
      if (unit.definitionId === 'xatu' && unit.isInWindup && unit.attackModifiers.some(m => m.id === 'xatu_bounce_shot')) {
        ctx.scale(-1, 1)
      }

      const hasMadness = unit.definitionId === 'tapu_bulu' &&
        unit.statusEffects.some(e => e.id === 'tapubulu_madness')
      if (hasMadness) {
        ctx.scale(1.3, 1.3)
        // Aura drawn under sprite, in the scaled local space
        if (buluAuraVideo.readyState >= 2) {
          // Brief grow + rumble pulse each time he auto-attacks (attackCount ticks up)
          const prev = this.buluAuraPulse.get(unit.id)
          if (prev === undefined) {
            this.buluAuraPulse.set(unit.id, { lastCount: unit.attackCount, startTs: 0 })
          } else if (unit.attackCount !== prev.lastCount) {
            prev.lastCount = unit.attackCount
            prev.startTs = performance.now()
          }
          const ps = this.buluAuraPulse.get(unit.id)!
          const PULSE_MS = 260
          const elapsed  = ps.startTs > 0 ? performance.now() - ps.startTs : PULSE_MS
          const pulse    = elapsed < PULSE_MS ? Math.sin((elapsed / PULSE_MS) * Math.PI) : 0  // 0→1→0
          const auraH    = SPRITE_HALF * 2.0 * (1 + pulse * 0.28)   // grow up to +28% at the peak
          const rumbleAmp = pulse * 5
          const rx = Math.sin(elapsed * 0.12) * rumbleAmp
          const ry = Math.cos(elapsed * 0.15) * rumbleAmp
          // Green saturation ramps across the 3-auto cycle — a little after the 1st auto,
          // a lot after the 2nd, back to normal after the 3rd.
          const cyc    = unit.attackCount % 3
          const greenF = cyc === 1 ? 0.25 : cyc === 2 ? 0.7 : 0
          ctx.save()
          ctx.globalAlpha = 0.62
          if (greenF > 0) {
            ctx.filter = `saturate(${(1 + greenF * 2.5).toFixed(2)}) hue-rotate(${Math.round(greenF * 25)}deg) brightness(${(1 + greenF * 0.15).toFixed(2)})`
          }
          ctx.drawImage(buluAuraVideo, -auraH / 2 + rx, -auraH / 2 + ry, auraH, auraH)
          ctx.restore()
        }
      }
      // Swap to mega sprite once evo animation ends (is_mega is only added after evo_shake expires)
      let finalSprite: HTMLImageElement | HTMLVideoElement = sprite
      let finalDw = dw
      let finalDh = dh
      if (unit.definitionId === 'rayquaza'
          && unit.statusEffects.some(fx => fx.id === 'rayquaza_is_mega')
          && megaRayquazaImg.complete && megaRayquazaImg.naturalWidth > 0) {
        const mIw    = megaRayquazaImg.naturalWidth
        const mIh    = megaRayquazaImg.naturalHeight
        const mScale = mIh > 0 ? Math.min(half * 2 / mIw, half * 2 / mIh) : 1
        finalSprite = megaRayquazaImg
        finalDw     = mIw * mScale
        finalDh     = mIh * mScale
      }
      // Darmanitan: swap to Zen sprite while in Zen form (shielded)
      if (unit.definitionId === 'darmanitan'
          && unit.statusEffects.some(fx => fx.stackId === 'zen_form')
          && darmanitanZenImg.complete && darmanitanZenImg.naturalWidth > 0) {
        const zIw    = darmanitanZenImg.naturalWidth
        const zIh    = darmanitanZenImg.naturalHeight
        const zScale = zIh > 0 ? Math.min(half * 2 / zIw, half * 2 / zIh) : 1
        finalSprite = darmanitanZenImg
        finalDw     = zIw * zScale
        finalDh     = zIh * zScale
      }
      // Excadrill Drill Run: earthy brown tint while tunneling underground
      if (isExcadrillTunnel) {
        ctx.filter = 'sepia(1) saturate(1.8) brightness(0.8)'
      }
      // Crashout rage: saturated red tint while the low-team-health damage amp is active.
      // Crashout units only — the team-wide amp never tints non-crashout allies.
      if (unit.types.includes('crashout') &&
          unit.statusEffects.some(fx => fx.stackId === 'crashout_rage')) {
        ctx.filter = 'sepia(0.35) hue-rotate(-25deg) saturate(2.4) brightness(1.05)'
      }
      // Wandering Spirit consume: deep purple saturation for the shake duration
      if (wsConsumeTintP > 0) {
        ctx.filter = `hue-rotate(280deg) saturate(${(1 + wsConsumeTintP * 7).toFixed(2)}) brightness(${(0.75 + wsConsumeTintP * 0.1).toFixed(2)})`
      }
      // Morgrem slap: deep blue saturation during strike phase
      if (unit.definitionId === 'morgrem') {
        const mSlapFx = unit.statusEffects.find(fx => fx.stackId === 'morgrem_slap')
        if (mSlapFx) {
          const sp = 1 - mSlapFx.durationTicks / mSlapFx.magnitude!
          if (sp >= 0.22 && sp < 0.68) {
            const t = (sp - 0.22) / (0.68 - 0.22)
            const intensity = Math.sin(t * Math.PI)
            ctx.filter = `hue-rotate(225deg) saturate(${(1 + intensity * 9).toFixed(1)}) brightness(${(1 - intensity * 0.25).toFixed(2)})`
          }
        }
      }
      // Triple Axel: icy blue tint for the entire empowered 3-attack sequence
      if (unit.definitionId === 'weavile' &&
          unit.statusEffects.some(fx => fx.stackId === 'triple_axel_mana_lock')) {
        ctx.filter = 'hue-rotate(200deg) saturate(2.5) brightness(1.2)'
      }
      // Star-up celebration: saturation surge on top of any other active tint
      if (starFlashP > 0) {
        ctx.filter = `saturate(${(1 + starFlashP * 2.2).toFixed(2)}) brightness(${(1 + starFlashP * 0.2).toFixed(2)})`
      }
      ctx.drawImage(finalSprite, -finalDw / 2, -finalDh / 2, finalDw, finalDh)

      // Mega evo flash overlay (fades in then out over 36-tick evo shake)
      if (unit.definitionId === 'rayquaza') {
        const evoFx = unit.statusEffects.find(fx => fx.id === 'rayquaza_evo_shake')
        if (evoFx && megaEvoImg.complete && megaEvoImg.naturalWidth > 0) {
          const progress = 1 - evoFx.durationTicks / 36
          const alpha    = (progress < 0.5 ? progress * 2 : (1 - progress) * 2) * 0.9
          const ovSize   = SPRITE_HALF * 3.2
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.drawImage(megaEvoImg, -ovSize / 2, -ovSize / 2, ovSize, ovSize)
          ctx.restore()
        }
      }

      ctx.restore()
    } else {
      // Fallback circle with text when no sprite loaded yet
      ctx.beginPath()
      ctx.arc(x, y, UNIT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = unit.team === 'player'
        ? (unit.state === 'casting' ? '#88aaff' : '#3366cc')
        : (unit.state === 'casting' ? '#ff8888' : '#cc3333')
      ctx.fill()
      ctx.strokeStyle = unit.team === 'player' ? '#6699ff' : '#ff6666'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.font = `bold 10px sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(unit.name.slice(0, 7), x, y)
    }

  }

  // ─── CC icons (stun/knockup), stacked left-to-right above the HP bar ────────
  // Stun always takes the leftmost slot; knockup takes the next slot to the
  // right if stun is also active, so the two never overlap.

  private drawCCIcons(ctx: CanvasRenderingContext2D, unit: Unit, bx: number, hpTop: number): void {
    const isStunned   = unit.statusEffects.some(fx => fx.id === 'stun')
    const isKnockedUp = unit.statusEffects.some(fx => fx.id === 'knockUp')
    if (!isStunned && !isKnockedUp) return

    const iconY = hpTop - CC_ICON_Y_GAP - CC_ICON_SIZE
    let iconX = bx

    if (isStunned && stunIconImg.complete && stunIconImg.naturalWidth > 0) {
      ctx.drawImage(stunIconImg, iconX, iconY, CC_ICON_SIZE, CC_ICON_SIZE)
      iconX += CC_ICON_SIZE + CC_ICON_GAP
    }

    if (isKnockedUp && knockupIconImg.complete && knockupIconImg.naturalWidth > 0) {
      // Slight up/down bob for the duration of the knock-up
      const bob = Math.sin(performance.now() * 0.010) * 1.5
      ctx.drawImage(knockupIconImg, iconX, iconY + bob, CC_ICON_SIZE, CC_ICON_SIZE)
    }
  }

  // ─── Ticked HP bar + shield extension + mana bar, all above the unit ────────

  private drawHealthBars(ctx: CanvasRenderingContext2D, unit: Unit): void {
    const cx = unit.visualPos.x
    const cy = unit.visualPos.y
    const bx = cx - BAR_W / 2

    // Clamp so bars never go above the canvas top (e.g. top-row enemy units)
    const totalBarH = HP_H + INTER_GAP + MANA_H
    const idealHpTop = cy - SPRITE_HALF - ABOVE_GAP - totalBarH
    const hpTop   = Math.max(2, idealHpTop)
    const manaTop = hpTop + HP_H + INTER_GAP

    this.drawCCIcons(ctx, unit, bx, hpTop)

    // ── HP + shield ticked bar ─────────────────────────────────────────────────
    // effectiveMax is frozen at (currentHp + shield) at the moment of cast, stored on
    // the shield itself. This keeps tick count stable while shield absorbs damage —
    // only the grey portion shrinks; green never moves. After shield expires, reverts
    // to maxHp-based ticks.
    const totalShield  = unit.shields.reduce((s, sh) => s + sh.value, 0)
    const frozenMax    = unit.shields.reduce((m, sh) => Math.max(m, sh.effectiveMaxHp ?? 0), 0)
    // Bar scale must fit HP + shield. Use the largest of:
    //   • max HP (the normal bar),
    //   • the cast-time frozen extension (keeps green stable as the shield absorbs), and
    //   • current HP + current shield — so later healing (or stacked shields) can never
    //     push the shield past the end of the bar, which used to silently clip it.
    const effectiveMax = totalShield > 0
      ? Math.max(unit.maxHp, frozenMax, unit.currentHp + totalShield)
      : unit.maxHp
    const numHpTicks   = Math.max(1, Math.min(20, Math.ceil(effectiveMax / HP_PER_TICK)))
    const hpColor      = unit.team === 'player' ? '#22cc44' : '#cc2222'

    // ── Star level diamond — flush against the left edge of the HP bar ────────
    // Tinted via 'color' blend mode: preserves the image's black border (L=0
    // luminosity stays black) while replacing the pink fill's hue+saturation.
    const STAR_SIZE = 10
    const starX = bx - 1 - STAR_SIZE  // right edge of diamond touches bar's left edge
    const starY = hpTop - 1 + (HP_H + 2) / 2 - STAR_SIZE / 2
    const starColor = unit.tier === 3 ? '#d4a017'
                    : unit.tier === 2 ? '#9ab0c8'
                    : '#b06830'
    if (!unit.isDummy && starLevelImg.complete && starLevelImg.naturalWidth > 0) {
      ctx.save()
      ctx.drawImage(starLevelImg, starX, starY, STAR_SIZE, STAR_SIZE)
      ctx.globalCompositeOperation = 'color'
      ctx.fillStyle = starColor
      ctx.fillRect(starX, starY, STAR_SIZE, STAR_SIZE)
      ctx.restore()
    }

    ctx.fillStyle = '#111'
    ctx.fillRect(bx - 1, hpTop - 1, BAR_W + 2, HP_H + 2)

    const tickW      = (BAR_W - (numHpTicks - 1) * TICK_SEP) / numHpTicks
    const hpFrac     = (unit.currentHp / effectiveMax) * numHpTicks
    const shieldFrac = (totalShield   / effectiveMax) * numHpTicks

    for (let i = 0; i < numHpTicks; i++) {
      const tx = bx + i * (tickW + TICK_SEP)

      const hpFill     = Math.max(0, Math.min(1, hpFrac - i))
      const shieldFill = Math.max(0, Math.min(1 - hpFill, (hpFrac + shieldFrac) - i - hpFill))

      ctx.fillStyle = '#1c1c1c'
      ctx.fillRect(tx, hpTop, tickW, HP_H)

      if (hpFill > 0) {
        ctx.fillStyle = hpColor
        ctx.fillRect(tx, hpTop, Math.ceil(tickW * hpFill), HP_H)
      }
      if (shieldFill > 0) {
        ctx.fillStyle = '#888888'
        ctx.fillRect(tx + Math.floor(tickW * hpFill), hpTop, Math.ceil(tickW * shieldFill), HP_H)
      }
    }

    // ── Mana bar (hidden when maxMana = 0, e.g. after Tapu Bulu transforms) ──
    if (unit.maxMana > 0) {
      const manaFrac = Math.max(0, Math.min(1, unit.currentMana / unit.maxMana))
      ctx.fillStyle = '#0d1a33'
      ctx.fillRect(bx - 1, manaTop - 1, BAR_W + 2, MANA_H + 2)
      ctx.fillStyle = '#3377ff'
      ctx.fillRect(bx, manaTop, manaFrac * BAR_W, MANA_H)
    }
  }

  // ─── Dummy rendering ─────────────────────────────────────────────────────────

  private drawDummy(ctx: CanvasRenderingContext2D, unit: Unit, x: number, y: number): void {
    const r = UNIT_RADIUS
    const sprite = getSprite(unit.definitionId)

    // Shadow
    ctx.beginPath()
    ctx.ellipse(x, y + r - 4, r * 0.6, r * 0.2, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fill()

    if (sprite) {
      const def = UNIT_MAP.get(unit.definitionId)
      const spriteScale = def?.spriteScale ?? 1
      const half = SPRITE_HALF * spriteScale
      const iw = sprite instanceof HTMLVideoElement ? sprite.videoWidth  : (sprite.naturalWidth  || sprite.width)
      const ih = sprite instanceof HTMLVideoElement ? sprite.videoHeight : (sprite.naturalHeight || sprite.height)
      const scale = ih > 0 ? Math.min(half * 2 / iw, half * 2 / ih) : 1
      const dw = iw * scale
      const dh = ih * scale
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, 1 / BOARD_PERSP_Y)
      ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
      ctx.restore()
    } else {
      // Fallback crosshair
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = '#444455'
      ctx.fill()
      ctx.strokeStyle = '#888899'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.strokeStyle = 'rgba(200,200,210,0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x + r * 0.7, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.7); ctx.lineTo(x, y + r * 0.7); ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(200,200,210,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // HP bar above (same tick system, no mana)
    this.drawHealthBars(ctx, unit)

    // HP number label below dummy
    ctx.font = 'bold 8px sans-serif'
    ctx.fillStyle = '#ccccdd'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.strokeText(`${unit.currentHp}`, x, y + r + 3)
    ctx.fillText(`${unit.currentHp}`, x, y + r + 3)

    this.drawStatusDots(ctx, unit)
  }

  // ─── Status dots (below unit) ─────────────────────────────────────────────────

  private drawStatusDots(
    ctx: CanvasRenderingContext2D,
    unit: { visualPos: { x: number; y: number }; statusEffects: Array<{ id: string }> },
  ): void {
    const seen      = new Set<string>()
    const activeIds: string[] = []
    for (const fx of unit.statusEffects) {
      if (!seen.has(fx.id) && fx.id in STATUS_COLORS) {
        seen.add(fx.id)
        activeIds.push(fx.id)
      }
    }
    if (activeIds.length === 0) return

    const dotY    = unit.visualPos.y + SPRITE_HALF + 14
    const totalW  = activeIds.length * (DOT_SIZE + DOT_GAP) - DOT_GAP
    let dotX      = unit.visualPos.x - totalW / 2 + DOT_SIZE / 2

    for (const id of activeIds) {
      ctx.beginPath()
      ctx.arc(dotX, dotY, DOT_SIZE / 2, 0, Math.PI * 2)
      ctx.fillStyle   = STATUS_COLORS[id]
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth   = 0.8
      ctx.stroke()
      dotX += DOT_SIZE + DOT_GAP
    }
  }
}
