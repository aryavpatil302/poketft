import { ALL_UNITS } from '../data/units'
import { makeUnit } from '../core/unitFactory'
import type { Unit } from '../core/types'
import type { OffsetCoord } from '../core/hexGrid'
import { BoardLayer } from '../render/layers/boardLayer'

export class TeamBuilder {
  private selectedUnitId: string | null = null
  private playerUnits: Map<string, Unit> = new Map()  // hexId → Unit
  private onChangeCallback: (() => void) | null = null

  constructor(private container: HTMLElement) {
    this.render()
  }

  onChange(cb: () => void): void {
    this.onChangeCallback = cb
  }

  getPlayerUnits(): Unit[] {
    return [...this.playerUnits.values()]
  }

  // Called when user clicks a hex on the board
  handleHexClick(hex: OffsetCoord): boolean {
    if (!BoardLayer.PLAYER_ROWS.includes(hex.row)) return false

    const key = `${hex.col},${hex.row}`

    if (this.selectedUnitId) {
      // Place the selected unit on this hex (replace if occupied)
      const unit = makeUnit(this.selectedUnitId, 'player', 1)
      unit.hexPos = { col: hex.col, row: hex.row }
      this.playerUnits.set(key, unit)
      this.selectedUnitId = null
      this.onChangeCallback?.()
      this.render()
      return true
    } else {
      // Remove existing unit from this hex (right-click or double-click)
      if (this.playerUnits.has(key)) {
        this.playerUnits.delete(key)
        this.onChangeCallback?.()
        this.render()
        return true
      }
    }
    return false
  }

  handleHexRightClick(hex: OffsetCoord): boolean {
    const key = `${hex.col},${hex.row}`
    if (this.playerUnits.has(key)) {
      this.playerUnits.delete(key)
      this.onChangeCallback?.()
      this.render()
      return true
    }
    return false
  }

  private searchQuery = ''
  private collapsedTraits: Set<string> = new Set(
    ALL_UNITS.map(def => def.traits[0] ?? 'other')
  )

  private render(): void {
    const query = this.searchQuery.toLowerCase()

    // Group units by primary trait, filtered by search
    const groups = new Map<string, typeof ALL_UNITS>()
    for (const def of ALL_UNITS) {
      const name = def.name.toLowerCase()
      const traits = def.traits.join(' ').toLowerCase()
      if (query && !name.includes(query) && !traits.includes(query)) continue
      const primaryTrait = def.traits[0] ?? 'other'
      if (!groups.has(primaryTrait)) groups.set(primaryTrait, [])
      groups.get(primaryTrait)!.push(def)
    }

    const traitColor: Record<string, string> = {
      jungle:  '#3a7a3a',
      beachy:  '#2a6a8a',
      rocky:   '#7a5a2a',
      snowy:   '#4a6a8a',
      spooky:  '#5a3a7a',
      stormy:  '#3a4a8a',
      grassy:  '#4a7a4a',
      other:   '#444',
    }

    const traitSections = [...groups.entries()].map(([trait, units]) => {
      const isOpen = !this.collapsedTraits.has(trait)
      const label = trait.charAt(0).toUpperCase() + trait.slice(1)
      const color = traitColor[trait] ?? '#444'

      const unitButtons = units.map(def => {
        const isSelected = this.selectedUnitId === def.id
        return `
          <button
            data-unit-id="${def.id}"
            style="
              display: flex; align-items: center; justify-content: space-between;
              padding: 5px 8px;
              background: ${isSelected ? '#335599' : '#131e30'};
              border: 1px solid ${isSelected ? '#88aaff' : '#233'};
              color: #cce;
              cursor: pointer;
              border-radius: 4px;
              text-align: left;
              font-size: 11px;
              width: 100%;
            "
          >
            <strong style="color: ${isSelected ? '#aaccff' : '#dde'}">${def.name}</strong>
            <span style="color: #667; font-size: 10px; white-space: nowrap; margin-left: 6px;">★${def.cost}</span>
          </button>
        `
      }).join('')

      return `
        <div style="margin-bottom: 4px;">
          <button
            data-trait="${trait}"
            style="
              display: flex; align-items: center; justify-content: space-between;
              width: 100%; padding: 5px 8px;
              background: ${color}33;
              border: 1px solid ${color}88;
              color: #bbd; cursor: pointer; border-radius: 4px;
              font-size: 11px; font-weight: bold; text-align: left;
            "
          >
            <span>${label} <span style="color:#667;font-weight:normal">(${units.length})</span></span>
            <span style="font-size:10px; color:#aaa">${isOpen ? '▾' : '▸'}</span>
          </button>
          ${isOpen ? `<div style="display:flex;flex-direction:column;gap:3px;margin-top:3px;padding-left:6px">${unitButtons}</div>` : ''}
        </div>
      `
    }).join('')

    this.container.innerHTML = `
      <div style="padding: 8px; display: flex; flex-direction: column; height: 100%;">
        <h3 style="margin: 0 0 6px; font-size: 13px; color: #88aaff;">Units</h3>
        <p style="margin: 0 0 8px; font-size: 11px; color: #aaa;">
          Pick a unit &amp; star level,<br>then click a hex to place it.<br>Right-click to remove.
        </p>
        <input
          id="unit-search"
          type="text"
          placeholder="Search units…"
          value="${this.searchQuery}"
          style="
            padding: 5px 8px; margin-bottom: 8px;
            background: #0e1824; border: 1px solid #334466;
            color: #cce; border-radius: 4px; font-size: 11px; width: 100%;
            box-sizing: border-box;
          "
        />
        <div style="flex: 1; overflow-y: auto;">
          ${groups.size === 0
            ? '<p style="color:#666;font-size:11px;text-align:center">No units found</p>'
            : traitSections
          }
        </div>
      </div>
    `

    // Search input
    const searchEl = this.container.querySelector('#unit-search') as HTMLInputElement
    searchEl?.addEventListener('input', () => {
      this.searchQuery = searchEl.value
      // Expand all groups when searching
      if (searchEl.value) this.collapsedTraits.clear()
      this.render()
    })
    // Keep focus & cursor position after re-render
    if (this.searchQuery) {
      searchEl?.focus()
      searchEl?.setSelectionRange(searchEl.value.length, searchEl.value.length)
    }

    // Trait toggle buttons
    this.container.querySelectorAll('[data-trait]').forEach(btn => {
      btn.addEventListener('click', () => {
        const trait = (btn as HTMLElement).dataset.trait!
        if (this.collapsedTraits.has(trait)) this.collapsedTraits.delete(trait)
        else this.collapsedTraits.add(trait)
        this.render()
      })
    })

    // Unit select buttons
    this.container.querySelectorAll('[data-unit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.unitId!
        this.selectedUnitId = this.selectedUnitId === id ? null : id
        this.render()
      })
    })
  }
}
