import { hexToPixel, BOARD_COLS, BOARD_ROWS, offsetToCube, cubeToOffset, isValidHex } from '../../core/hexGrid'
import { HEX_SIZE, BOARD_PERSP_Y } from '../../core/constants'
import type { OffsetCoord } from '../../core/hexGrid'

export class BoardLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private hoveredHex: OffsetCoord | null = null
  private selectedHex: OffsetCoord | null = null
  private combatActive = false
  private sunny = false
  // Planning-phase "units on board / level" backdrop (e.g. "6/6"); null hides it.
  private countLabel: string | null = null
  private countLabelOk = false   // true when board count meets the level cap
  private terrainPulseColor: string | null = null
  private earthquakeFlashTs = 0
  private cliffFallPulses: Array<{ col: number; row: number; startTs: number }> = []
  private readonly earthquakeImg: HTMLImageElement = (() => {
    const img = new Image()
    img.src = '/visuals/trait icons/earthquake-line.png'
    return img
  })()

  // Player team places in rows 4-7 (bottom half), enemy in rows 0-3 (top half)
  static readonly PLAYER_ROWS = [4, 5, 6, 7]
  static readonly ENEMY_ROWS  = [0, 1, 2, 3]

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  setHovered(hex: OffsetCoord | null)  { this.hoveredHex   = hex  }
  setSelected(hex: OffsetCoord | null) { this.selectedHex  = hex  }
  setCombatActive(active: boolean)        { this.combatActive = active }
  setSunny(active: boolean)               { this.sunny = active }
  setTerrainPulse(color: string | null)   { this.terrainPulseColor = color }
  setEarthquakeFlash(ts: number)          { this.earthquakeFlashTs = ts }
  setBoardCountLabel(label: string | null, ok = false) { this.countLabel = label; this.countLabelOk = ok }

  addCliffFallPulse(col: number, startRow: number, direction: -1 | 1): void {
    const now = performance.now()
    // Must match the 2-1-2-1 tumble pattern in traitEffects.ts
    const stepCols: number[][] = [
      [col - 1, col],
      [col],
      [col - 1, col],
      [col],
    ]
    for (let step = 1; step <= 4; step++) {
      const row = startRow + step * direction
      if (row < 0 || row > 7) continue
      for (const c of stepCols[step - 1]) {
        if (c < 0 || c >= BOARD_COLS) continue
        this.cliffFallPulses.push({ col: c, row, startTs: now + (step - 1) * 100 })
      }
    }
  }

  private drawCountLabel(ctx: CanvasRenderingContext2D): void {
    const cx = this.canvas.width / 2
    const cy = this.canvas.height / 2
    const size = Math.round(this.canvas.height * 0.34)
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `900 ${size}px sans-serif`
    // Green when the board is full for the level, warm amber when there's room
    // to field more. Kept translucent so it stays a backdrop, not a blocker.
    ctx.lineWidth = Math.max(4, size * 0.045)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillStyle = this.countLabelOk ? 'rgba(150, 240, 150, 0.5)' : 'rgba(255, 225, 150, 0.55)'
    ctx.strokeText(this.countLabel!, cx, cy)
    ctx.fillText(this.countLabel!, cx, cy)
    ctx.restore()
  }

  draw(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Board-fill count backdrop: drawn first (before the hex tints and units)
    // so the translucent board and every sprite layer over the top of it —
    // the number reads as a watermark behind the board, never blocking it.
    if (!this.combatActive && this.countLabel) this.drawCountLabel(ctx)

    // Sun tint: subtle orange wash over the board when Volcano's sun is active
    if (this.combatActive && this.sunny) {
      ctx.fillStyle = 'rgba(255, 140, 30, 0.10)'
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    // Earthquake flash: deep-brown saturation burst that fades over 600ms,
    // plus the earthquake icon rumbling in the center beneath all units.
    if (this.combatActive && this.earthquakeFlashTs > 0) {
      const elapsed = performance.now() - this.earthquakeFlashTs
      const FLASH_MS = 600
      if (elapsed < FLASH_MS) {
        const t = 1 - elapsed / FLASH_MS

        ctx.fillStyle = `rgba(75, 40, 8, ${(t * 0.55).toFixed(3)})`
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

        if (this.earthquakeImg.complete && this.earthquakeImg.naturalWidth > 0) {
          const ICON_SIZE = 360
          const cx = this.canvas.width / 2
          const cy = this.canvas.height / 2
          const shakeIntensity = t * t * 14
          const nudgeX = Math.sin(performance.now() * 0.074) * shakeIntensity
          const nudgeY = Math.cos(performance.now() * 0.063 + 1.1) * shakeIntensity
          ctx.save()
          ctx.globalAlpha = t
          ctx.drawImage(
            this.earthquakeImg,
            cx - ICON_SIZE / 2 + nudgeX,
            cy - ICON_SIZE / 2 + nudgeY,
            ICON_SIZE,
            ICON_SIZE,
          )
          ctx.restore()
        }
      }
    }

    ctx.save()
    ctx.scale(1, BOARD_PERSP_Y)

    if (this.combatActive) {
      this.drawHexGridLines(ctx)
      this.drawCliffFallPulses(ctx)
      this.drawFieldBoundary(ctx)
      if (this.terrainPulseColor) this.drawTerrainPulse(ctx)
      ctx.restore()
      return
    }

    // Apply perspective Y-scale for the 3D tilt effect

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const hex = { col, row }
        const center = hexToPixel(hex, HEX_SIZE)
        const isPlayerRow = BoardLayer.PLAYER_ROWS.includes(row)
        const isHovered   = this.hoveredHex?.col === col && this.hoveredHex?.row === row
        const isSelected  = this.selectedHex?.col === col && this.selectedHex?.row === row

        this.drawHex(ctx, center.x, center.y, isPlayerRow, isHovered, isSelected)
      }
    }

    // Subtle divider between enemy and player halves
    const midY = (
      hexToPixel({ col: 0, row: 3 }, HEX_SIZE).y +
      hexToPixel({ col: 0, row: 4 }, HEX_SIZE).y
    ) / 2
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(this.canvas.width, midY)
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.restore()
  }

  // ── Combat overlay: faint hex grid + white outer field boundary ──────────────
  // The dim vignette is drawn on c-dim (full canvas-wrap) in main.ts.

  private drawHexGridLines(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath()
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const { x: cx, y: cy } = hexToPixel({ col, row }, HEX_SIZE)
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i + Math.PI / 6
          const px = cx + HEX_SIZE * Math.cos(angle)
          const py = cy + HEX_SIZE * Math.sin(angle)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
      }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawFieldBoundary(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath()
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        this.traceBoundaryEdges(ctx, { col, row })
      }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // Edge i (vertex i → vertex i+1) faces the neighbor in this cube direction.
  // Pointy-top hex, vertices at 30°+60°*i (canvas y-down coords).
  // Verified: edge 0 goes from 30°→90° (lower-right), so it faces the SE neighbor.
  private static readonly EDGE_DIRS = [
    { q:  0, r:  1, s: -1 },  // edge 0 → SE
    { q: -1, r:  1, s:  0 },  // edge 1 → SW
    { q: -1, r:  0, s:  1 },  // edge 2 → W
    { q:  0, r: -1, s:  1 },  // edge 3 → NW
    { q:  1, r: -1, s:  0 },  // edge 4 → NE
    { q:  1, r:  0, s: -1 },  // edge 5 → E
  ]

  private traceBoundaryEdges(ctx: CanvasRenderingContext2D, hex: OffsetCoord): void {
    const cube = offsetToCube(hex)
    const { x: cx, y: cy } = hexToPixel(hex, HEX_SIZE)
    const verts = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i + Math.PI / 6
      return { x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) }
    })
    for (let i = 0; i < 6; i++) {
      const d = BoardLayer.EDGE_DIRS[i]
      const nc = cubeToOffset({ q: cube.q + d.q, r: cube.r + d.r, s: cube.s + d.s })
      if (!isValidHex(nc)) {
        ctx.moveTo(verts[i].x, verts[i].y)
        ctx.lineTo(verts[(i + 1) % 6].x, verts[(i + 1) % 6].y)
      }
    }
  }

  // ── Terrain pulse: colored glow on the field boundary ────────────────────────

  private drawTerrainPulse(ctx: CanvasRenderingContext2D): void {
    if (!this.terrainPulseColor) return
    // Pulse every ~2 seconds using a sine wave on performance.now()
    const phase = (performance.now() / 2000) * Math.PI * 2
    const t     = (Math.sin(phase) + 1) / 2  // 0 → 1 → 0

    ctx.save()
    ctx.beginPath()
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        this.traceBoundaryEdges(ctx, { col, row })
      }
    }
    ctx.strokeStyle  = this.terrainPulseColor
    ctx.lineWidth    = 2 + t * 5
    ctx.globalAlpha  = 0.25 + t * 0.55
    ctx.lineJoin     = 'round'
    ctx.shadowColor  = this.terrainPulseColor
    ctx.shadowBlur   = 6 + t * 18
    ctx.stroke()
    ctx.restore()
  }

  // ── Cliff fall hex pulses: black fills on the 4 hexes in the fall path ───────

  private drawCliffFallPulses(ctx: CanvasRenderingContext2D): void {
    const PULSE_MS = 500
    const now = performance.now()
    this.cliffFallPulses = this.cliffFallPulses.filter(p => now - p.startTs < PULSE_MS)
    for (const pulse of this.cliffFallPulses) {
      const elapsed = now - pulse.startTs
      if (elapsed < 0) continue
      const t = elapsed / PULSE_MS
      // Sharp flash in, slow fade out
      const alpha = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88
      const { x, y } = hexToPixel({ col: pulse.col, row: pulse.row }, HEX_SIZE)
      ctx.save()
      ctx.globalAlpha = alpha * 0.70
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6
        const px = x + HEX_SIZE * Math.cos(angle)
        const py = y + HEX_SIZE * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = '#3a0a00'
      ctx.fill()
      ctx.restore()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private drawHex(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    isPlayerRow: boolean,
    isHovered: boolean,
    isSelected: boolean,
  ): void {
    // Draw hex path (flat in logical space — ctx.scale handles the tilt)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6
      const x = cx + HEX_SIZE * Math.cos(angle)
      const y = cy + HEX_SIZE * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else         ctx.lineTo(x, y)
    }
    ctx.closePath()

    // Fill colours
    if (isSelected) {
      ctx.fillStyle = 'rgba(255, 220, 60, 0.55)'
    } else if (isHovered) {
      ctx.fillStyle = isPlayerRow
        ? 'rgba(0, 210, 220, 0.50)'
        : 'rgba(255, 90, 70, 0.45)'
    } else if (this.combatActive) {
      ctx.fillStyle = isPlayerRow
        ? 'rgba(0, 170, 200, 0.30)'
        : 'rgba(210, 60, 50, 0.26)'
    } else {
      ctx.fillStyle = isPlayerRow
        ? 'rgba(40, 100, 220, 0.55)'
        : 'rgba(200, 50, 50, 0.50)'
    }
    ctx.fill()

    // Stroke
    if (isSelected) {
      ctx.strokeStyle = '#ffe040'
      ctx.lineWidth   = 2.5
    } else if (isHovered) {
      ctx.strokeStyle = isPlayerRow ? '#00eeff' : '#ff6655'
      ctx.lineWidth   = 2
    } else if (this.combatActive) {
      ctx.strokeStyle = isPlayerRow
        ? 'rgba(0, 220, 255, 0.65)'
        : 'rgba(255, 100, 80, 0.55)'
      ctx.lineWidth   = 1.2
    } else {
      ctx.strokeStyle = isPlayerRow
        ? 'rgba(80, 160, 255, 0.90)'
        : 'rgba(220, 80, 80, 0.85)'
      ctx.lineWidth   = 1.5
    }
    ctx.stroke()

    // Subtle inner glow on combat hexes
    if (this.combatActive && !isSelected && !isHovered) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6
        const r = HEX_SIZE * 0.82
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else         ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = isPlayerRow
        ? 'rgba(0, 200, 255, 0.18)'
        : 'rgba(255, 80, 60, 0.15)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }

  // Board pixel dimensions (canvas is sized to the visual / scaled dimensions)
  static boardWidth(): number {
    return (BOARD_COLS + 0.5) * Math.sqrt(3) * HEX_SIZE
  }

  static boardHeight(): number {
    const logicalH = (BOARD_ROWS - 1) * 1.5 * HEX_SIZE + 2 * HEX_SIZE
    return logicalH * BOARD_PERSP_Y
  }
}
