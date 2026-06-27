export type CombatPhaseUI = 'setup' | 'running' | 'paused' | 'done'

export class CombatControls {
  private speedMultiplier = 1
  private phase: CombatPhaseUI = 'setup'
  private onStartCallback: (() => void) | null = null
  private onSpeedChangeCallback: ((speed: number) => void) | null = null

  constructor(private container: HTMLElement) {
    this.render()
  }

  onStart(cb: () => void): void { this.onStartCallback = cb }
  onSpeedChange(cb: (speed: number) => void): void { this.onSpeedChangeCallback = cb }

  getSpeed(): number { return this.speedMultiplier }

  setPhase(phase: CombatPhaseUI): void {
    this.phase = phase
    this.render()
  }

  showResult(winner: 'player' | 'enemy' | 'draw'): void {
    this.phase = 'done'
    this.render(winner)
  }

  private render(winner?: 'player' | 'enemy' | 'draw'): void {
    const canStart = this.phase === 'setup'

    this.container.innerHTML = `
      <div style="padding: 8px; display: flex; flex-direction: column; gap: 8px;">
        ${winner ? `
          <div style="
            padding: 10px;
            background: ${winner === 'player' ? '#1a4a1a' : winner === 'enemy' ? '#4a1a1a' : '#2a2a2a'};
            border: 1px solid ${winner === 'player' ? '#44cc44' : winner === 'enemy' ? '#cc4444' : '#888'};
            border-radius: 6px;
            text-align: center;
            font-weight: bold;
            color: ${winner === 'player' ? '#66ff66' : winner === 'enemy' ? '#ff6666' : '#aaa'};
            font-size: 14px;
          ">
            ${winner === 'player' ? '🏆 Your team wins!' : winner === 'enemy' ? '💀 Enemy wins!' : '⚖️ Draw!'}
          </div>
        ` : ''}

        <button id="btn-start" style="
          padding: 10px;
          background: ${canStart ? '#1a5c1a' : '#2a2a2a'};
          border: 1px solid ${canStart ? '#44cc44' : '#555'};
          color: ${canStart ? '#88ff88' : '#666'};
          cursor: ${canStart ? 'pointer' : 'not-allowed'};
          border-radius: 6px;
          font-weight: bold;
          font-size: 13px;
        ">
          ${this.phase === 'running' ? '⚔️ Fighting...' : this.phase === 'done' ? '↺ Reset' : '▶ Start Combat'}
        </button>

        <div style="display: flex; gap: 4px;">
          ${[0.5, 1, 2, 4].map(spd => `
            <button data-speed="${spd}" style="
              flex: 1;
              padding: 5px;
              background: ${this.speedMultiplier === spd ? '#1a3a6a' : '#111'};
              border: 1px solid ${this.speedMultiplier === spd ? '#4488cc' : '#333'};
              color: ${this.speedMultiplier === spd ? '#88aaff' : '#888'};
              cursor: pointer;
              border-radius: 4px;
              font-size: 11px;
            ">${spd}×</button>
          `).join('')}
        </div>
      </div>
    `

    const startBtn = this.container.querySelector('#btn-start') as HTMLButtonElement
    startBtn?.addEventListener('click', () => {
      if (this.phase === 'setup' || this.phase === 'done') {
        this.onStartCallback?.()
      }
    })

    this.container.querySelectorAll('[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.speedMultiplier = parseFloat((btn as HTMLElement).dataset.speed!)
        this.onSpeedChangeCallback?.(this.speedMultiplier)
        this.render()
      })
    })
  }
}
