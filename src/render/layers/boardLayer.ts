import { hexToPixel, BOARD_COLS, BOARD_ROWS } from '../../core/hexGrid'
import { HEX_SIZE, BOARD_PERSP_Y } from '../../core/constants'
import type { OffsetCoord } from '../../core/hexGrid'

export class BoardLayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private hoveredHex: OffsetCoord | null = null
  private selectedHex: OffsetCoord | null = null
  private combatActive = false

  // Player team places in rows 4-7 (bottom half), enemy in rows 0-3 (top half)
  static readonly PLAYER_ROWS = [4, 5, 6, 7]
  static readonly ENEMY_ROWS  = [0, 1, 2, 3]

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  setHovered(hex: OffsetCoord | null)  { this.hoveredHex   = hex  }
  setSelected(hex: OffsetCoord | null) { this.selectedHex  = hex  }
  setCombatActive(active: boolean)     { this.combatActive = active }

  draw(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Hide hex grid during combat — logic is unaffected, only visuals are suppressed
    if (this.combatActive) return

    // Apply perspective Y-scale for the 3D tilt effect
    ctx.save()
    ctx.scale(1, BOARD_PERSP_Y)

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
