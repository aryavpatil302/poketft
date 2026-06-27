import { BoardLayer } from './render/layers/boardLayer'
import { UnitLayer } from './render/layers/unitLayer'
import { EffectLayer } from './render/layers/effectLayer'
import { generateEnemyTeam } from './enemy/generator'
import { createCombatState } from './core/combatEngine'
import { hexToPixel, pixelToHex, hexId } from './core/hexGrid'
import { HEX_SIZE, TICK_RATE, BOARD_PERSP_Y } from './core/constants'
import { makeUnit, computeStats } from './core/unitFactory'
import { tickStatusEffects, tickShields } from './core/systems/statusEffect'
import { tickManaLock, isReadyToCast } from './core/systems/mana'
import { tickTargeting } from './core/systems/targeting'
import { tickMovement, tickLeapPixel, recalculatePath } from './core/systems/movement'
import { tickAttack, isInRange, startAttacking } from './core/systems/attack'
import { triggerAbility, tickAbilityCast } from './core/systems/ability'
import { tickProjectiles } from './core/projectile'
import { ALL_UNITS } from './data/units'
import type { CombatState, Unit } from './core/types'
import type { OffsetCoord } from './core/hexGrid'

// Register abilities
import './core/systems/ability'

// ─── Layout constants ─────────────────────────────────────────────────────────

const BOARD_W = BoardLayer.boardWidth()
const BOARD_H = BoardLayer.boardHeight()

// ─── DOM skeleton ─────────────────────────────────────────────────────────────

document.getElementById('app')!.innerHTML = `
  <div id="layout" style="
    display: flex;
    height: 100vh;
    background: #0a0e1a;
    color: #cce;
    font-family: sans-serif;
    overflow: hidden;
    user-select: none;
  ">
    <!-- Left panel: unit roster -->
    <div id="left-panel" style="
      width: 200px;
      flex-shrink: 0;
      border-right: 1px solid #223;
      overflow-y: auto;
      padding: 10px;
      box-sizing: border-box;
    ">
      <h3 style="margin: 0 0 6px; color: #88aaff; font-size: 13px;">Units</h3>
      <p style="margin: 0 0 8px; font-size: 10px; color: #778; line-height: 1.4;">
        Pick a unit &amp; star level,<br>then click a hex to place it.<br>Right-click to remove.
      </p>
      <div id="unit-roster"></div>
    </div>

    <!-- Center: canvas + floating combat bar -->
    <div id="canvas-wrap" style="
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    ">
      <!-- Background image -->
      <div style="
        position: absolute; inset: 0;
        background: url('/visuals/backgrounds/sw_water.jpg') center center / cover no-repeat;
        pointer-events: none;
      "></div>

      <canvas id="c-board"   style="position:absolute;"></canvas>
      <canvas id="c-units"   style="position:absolute;"></canvas>
      <canvas id="c-effects" style="position:absolute;"></canvas>

      <!-- Floating combat controls — bottom-right of canvas area -->
      <div id="combat-bar" style="
        position: absolute; bottom: 14px; right: 14px;
        background: rgba(8,12,24,0.92);
        border: 1px solid #334;
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 220px;
        backdrop-filter: blur(4px);
      ">
        <!-- Row 1: test mode toggle -->
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:#99bbdd;">
          <input type="checkbox" id="chk-test-mode" style="cursor:pointer;" checked>
          Test Mode
          <span style="color:#445;font-size:10px;">(no mirror)</span>
        </label>

        <!-- Row 2: action buttons (always visible) -->
        <div style="display:flex;gap:5px;">
          <button id="btn-start" style="
            flex:2; padding:7px;
            background:#1a4a1a; border:1px solid #44cc44;
            color:#88ff88; cursor:pointer; border-radius:5px;
            font-weight:bold; font-size:12px;
          ">▶ Start</button>
          <button id="btn-pause" style="
            flex:1; padding:7px;
            background:#111; border:1px solid #334;
            color:#778; cursor:pointer; border-radius:5px;
            font-size:12px; opacity:0.4;
          ">⏸</button>
          <button id="btn-stop" style="
            flex:1; padding:7px;
            background:#111; border:1px solid #334;
            color:#778; cursor:pointer; border-radius:5px;
            font-size:12px; opacity:0.4;
          ">■</button>
          <button id="btn-reset" style="
            padding:7px 9px;
            background:#111; border:1px solid #334;
            color:#778; cursor:pointer; border-radius:5px;
            font-size:12px;
          ">↺</button>
        </div>

        <!-- Row 3: speed -->
        <div id="speed-buttons" style="display:flex; gap:3px;">
          ${[0.5, 1, 2, 4].map(s => `
            <button data-spd="${s}" style="
              flex:1; padding:3px 2px;
              background: ${s === 1 ? '#1a3a6a' : '#111'};
              border: 1px solid ${s === 1 ? '#4488cc' : '#333'};
              color: ${s === 1 ? '#88aaff' : '#778'};
              cursor:pointer; border-radius:3px; font-size:10px;
            ">${s}×</button>
          `).join('')}
        </div>

        <!-- Result + tick info -->
        <div id="result-box" style="display:none;
          padding:6px 8px; border-radius:5px;
          text-align:center; font-weight:bold; font-size:12px;
        "></div>
        <div id="combat-info" style="font-size:10px;color:#556;text-align:right;"></div>
      </div>

      <!-- Unit info panel (shown when a unit is clicked during combat) -->
      <div id="unit-info-panel" style="
        display: none;
        position: absolute; top: 14px; left: 14px;
        background: rgba(8,12,24,0.95);
        border: 1px solid #446;
        border-radius: 8px;
        padding: 10px 12px;
        min-width: 200px;
        max-width: 240px;
        font-family: monospace;
        font-size: 11px;
        color: #cce;
        backdrop-filter: blur(4px);
        z-index: 10;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span id="uip-name" style="font-weight:bold;font-size:13px;color:#88aaff;"></span>
          <button id="uip-close" style="
            padding:2px 7px; background:transparent; border:1px solid #334;
            color:#778; cursor:pointer; border-radius:4px; font-size:11px;
          ">✕</button>
        </div>
        <div id="uip-body"></div>
      </div>

      <!-- Panel re-open tab (shown when panel is collapsed) -->
      <button id="btn-open-panel" style="
        display: none;
        position: absolute; top: 50%; right: 0;
        transform: translateY(-50%);
        padding: 10px 5px;
        background: #0e1a2a; border: 1px solid #335; border-right: none;
        color: #88aaff; cursor: pointer;
        border-radius: 6px 0 0 6px; font-size: 12px;
      ">◀</button>
    </div>

    <!-- Right panel: testing tools (collapsible) -->
    <div id="right-panel" style="
      width: 200px;
      flex-shrink: 0;
      border-left: 1px solid #223;
      padding: 10px;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    ">
      <!-- Header with collapse button -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-shrink:0;">
        <h3 style="margin:0;color:#88aaff;font-size:13px;">Test Tools</h3>
        <button id="btn-close-panel" style="
          padding:2px 7px; background:transparent; border:1px solid #334;
          color:#778; cursor:pointer; border-radius:4px; font-size:11px;
        ">✕</button>
      </div>

      <!-- Dummy targets -->
      <div style="margin-bottom:10px;flex-shrink:0;">
        <div style="font-size:10px;color:#556;margin-bottom:4px;">Dummy Targets — select then click hex</div>
        <div id="dummy-buttons" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
      </div>

      <!-- Quick tests -->
      <div style="border-top:1px solid #223;padding-top:8px;display:flex;flex-direction:column;flex:1;min-height:0;">
        <div style="font-size:12px;color:#88aaff;font-weight:bold;margin-bottom:4px;flex-shrink:0;">Quick Tests</div>
        <div style="font-size:10px;color:#445;margin-bottom:6px;flex-shrink:0;">Loads board — then hit Play/Start</div>

        <!-- Search -->
        <input id="test-search" type="text" placeholder="Search saved tests…" style="
          width:100%; padding:4px 6px; margin-bottom:6px;
          background:#0a1220; border:1px solid #335; color:#aabbdd;
          border-radius:4px; font-size:10px; box-sizing:border-box;
          flex-shrink:0;
        ">

        <!-- Scrollable list -->
        <div id="test-buttons-saved" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;"></div>

        <!-- Save row -->
        <div style="margin-top:8px;display:flex;gap:4px;flex-shrink:0;">
          <input id="snapshot-name" type="text" placeholder="Name this board…" style="
            flex:1; min-width:0; padding:4px 6px; background:#0e1a2a;
            border:1px solid #335; color:#aabbdd;
            border-radius:4px; font-size:10px;
          ">
          <button id="btn-snapshot" style="
            padding:4px 8px; background:#1a2a3a; border:1px solid #446;
            color:#88aacc; cursor:pointer; border-radius:4px; font-size:10px;
            white-space:nowrap; flex-shrink:0;
          ">Save</button>
        </div>
      </div>
    </div>
  </div>
`

// ─── Canvas setup ─────────────────────────────────────────────────────────────

const wrap   = document.getElementById('canvas-wrap')!
const cBoard = document.getElementById('c-board')   as HTMLCanvasElement
const cUnits = document.getElementById('c-units')   as HTMLCanvasElement
const cEff   = document.getElementById('c-effects') as HTMLCanvasElement

function resizeCanvases() {
  const wrapW = wrap.clientWidth
  const wrapH = wrap.clientHeight
  const offsetX = Math.max(0, (wrapW - BOARD_W) / 2)
  const offsetY = Math.max(0, (wrapH - BOARD_H) / 2)
  for (const c of [cBoard, cUnits, cEff]) {
    c.width  = BOARD_W
    c.height = BOARD_H
    c.style.width  = `${BOARD_W}px`
    c.style.height = `${BOARD_H}px`
    c.style.left   = `${offsetX}px`
    c.style.top    = `${offsetY}px`
  }
}
resizeCanvases()
window.addEventListener('resize', resizeCanvases)

// ─── Layers ───────────────────────────────────────────────────────────────────

const boardLayer  = new BoardLayer(cBoard)
const unitLayer   = new UnitLayer(cUnits)
const effectLayer = new EffectLayer(cEff)

// ─── Unit roster (left panel) ─────────────────────────────────────────────────

let selectedUnitId: string | null = null
let selectedTier: 1 | 2 | 3 = 1
let rosterSearch = ''
const collapsedTraits = new Set<string>()

const TRAIT_COLOR: Record<string, string> = {
  jungle: '#2e6e2e', beachy: '#1e5a7a', rocky: '#6a4a1e',
  snowy:  '#3a5a7a', spooky: '#4a2e6a', stormy: '#2e3e7a',
  grassy: '#3a6a3a',
}

function renderRoster() {
  const roster = document.getElementById('unit-roster')!
  const query  = rosterSearch.toLowerCase()

  // Build trait groups
  const groups = new Map<string, typeof ALL_UNITS>()
  for (const def of ALL_UNITS) {
    if (def.isDummy) continue
    if (query && !def.name.toLowerCase().includes(query) && !def.traits.join(' ').toLowerCase().includes(query)) continue
    const trait = def.traits[0] ?? 'other'
    if (!groups.has(trait)) groups.set(trait, [])
    groups.get(trait)!.push(def)
  }

  const sections = [...groups.entries()].map(([trait, units]) => {
    const open  = !collapsedTraits.has(trait)
    const label = trait.charAt(0).toUpperCase() + trait.slice(1)
    const col   = TRAIT_COLOR[trait] ?? '#3a3a4a'

    const rows = units.map(def => {
      const sel = selectedUnitId === def.id
      return `
        <div style="overflow:hidden;border-radius:4px;margin-bottom:3px;
          border:1px solid ${sel ? '#6688cc' : '#1e2a3a'};
          background:${sel ? '#1a2c4a' : '#0d1520'};">
          <button data-uid="${def.id}" style="
            width:100%; padding:5px 8px; background:transparent; border:none;
            color:${sel ? '#aaccff' : '#99aacc'}; cursor:pointer; text-align:left; font-size:11px;
            display:flex; align-items:center; justify-content:space-between;
          ">
            <strong>${def.name}</strong>
            <span style="color:#445;font-size:10px;">★${def.cost}</span>
          </button>
          ${sel ? `
            <div style="display:flex;gap:3px;padding:0 6px 5px;">
              ${[1,2,3].map(t => `
                <button data-tier="${t}" style="
                  flex:1; padding:3px;
                  background:${selectedTier===t ? '#2a4a1a' : '#111'};
                  border:1px solid ${selectedTier===t ? '#44cc44' : '#334'};
                  color:${selectedTier===t ? '#88ff88' : '#667'};
                  cursor:pointer; border-radius:3px; font-size:10px;
                ">${'★'.repeat(t)}</button>
              `).join('')}
            </div>
          ` : ''}
        </div>`
    }).join('')

    return `
      <div style="margin-bottom:5px;">
        <button data-trait="${trait}" style="
          width:100%; display:flex; align-items:center; justify-content:space-between;
          padding:4px 8px; border-radius:4px; cursor:pointer; border:none;
          background:${col}55; outline:1px solid ${col}99;
          color:#bbd; font-size:11px; font-weight:bold; text-align:left;
        ">
          <span>${label} <span style="color:#667;font-weight:normal;">(${units.length})</span></span>
          <span style="font-size:10px;color:#889;">${open ? '▾' : '▸'}</span>
        </button>
        ${open ? `<div style="padding-left:6px;margin-top:3px;">${rows}</div>` : ''}
      </div>`
  }).join('')

  roster.innerHTML = `
    <input id="roster-search" type="text" placeholder="Search units…" value="${rosterSearch}" style="
      width:100%; padding:5px 7px; margin-bottom:8px; box-sizing:border-box;
      background:#0a1220; border:1px solid #2a3a50; color:#aabbdd;
      border-radius:4px; font-size:11px; outline:none;
    ">
    ${groups.size === 0
      ? '<p style="color:#445;font-size:11px;text-align:center;margin-top:12px;">No units found</p>'
      : sections}
  `

  const searchEl = roster.querySelector('#roster-search') as HTMLInputElement
  searchEl.addEventListener('input', () => {
    rosterSearch = searchEl.value
    if (rosterSearch) collapsedTraits.clear()
    renderRoster()
  })
  if (rosterSearch) {
    searchEl.focus()
    searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length)
  }

  roster.querySelectorAll('[data-trait]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = (btn as HTMLElement).dataset.trait!
      collapsedTraits.has(t) ? collapsedTraits.delete(t) : collapsedTraits.add(t)
      renderRoster()
    })
  })
  roster.querySelectorAll('[data-uid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.uid!
      selectedUnitId = selectedUnitId === id ? null : id
      renderRoster()
    })
  })
  roster.querySelectorAll('[data-tier]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      selectedTier = parseInt((btn as HTMLElement).dataset.tier!) as 1|2|3
      renderRoster()
    })
  })
}
renderRoster()

// ─── Quick test scenarios ─────────────────────────────────────────────────────

// Each unit stores its own team so snapshots and built-in tests share one format.
interface TestUnit { id: string; tier: 1|2|3; col: number; row: number; team: 'player'|'enemy' }
interface TestScenario { label: string; units: TestUnit[] }


// ─── Snapshot persistence (localStorage) ──────────────────────────────────────

const SNAPSHOT_KEY = 'pokeTFT_saved_tests'

function loadSnapshots(): TestScenario[] {
  try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? '[]') } catch { return [] }
}

function saveSnapshots(snaps: TestScenario[]): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps))
}

function snapshotCurrentBoard(label: string): void {
  if (placedUnits.size === 0) return
  const units: TestUnit[] = []
  for (const u of placedUnits.values()) {
    units.push({ id: u.definitionId, tier: u.tier, col: u.hexPos.col, row: u.hexPos.row, team: u.team })
  }
  const snaps = loadSnapshots()
  snaps.push({ label, units })
  saveSnapshots(snaps)
  renderTestButtons()
}

function deleteSnapshot(idx: number): void {
  const snaps = loadSnapshots()
  snaps.splice(idx, 1)
  saveSnapshots(snaps)
  renderTestButtons()
}

// ─── Load scenario onto board (no auto-start) ─────────────────────────────────

function loadScenario(scenario: TestScenario): void {
  combatRunning = false
  combatState   = null
  placedUnits.clear()
  ;(document.getElementById('chk-test-mode') as HTMLInputElement).checked = true

  for (const u of scenario.units) {
    const unit = makeUnit(u.id, u.team, u.tier)
    unit.hexPos    = { col: u.col, row: u.row }
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
    placedUnits.set(hexId(unit.hexPos), unit)
  }

  setCombatBarState('idle')
  document.getElementById('result-box')!.style.display = 'none'
  document.getElementById('combat-info')!.textContent = ''
}

// ─── Render test button lists ──────────────────────────────────────────────────

function renderTestButtons(): void {
  const query     = ((document.getElementById('test-search') as HTMLInputElement)?.value ?? '').toLowerCase().trim()
  const savedEl   = document.getElementById('test-buttons-saved')!
  const snapshots = loadSnapshots()
  const filtered  = query
    ? snapshots.map((s, i) => ({ s, i })).filter(({ s }) => s.label.toLowerCase().includes(query))
    : snapshots.map((s, i) => ({ s, i }))

  if (snapshots.length === 0) {
    savedEl.innerHTML = `<div style="font-size:10px;color:#445;font-style:italic;padding:2px 0;">No saved tests yet</div>`
    return
  }
  if (filtered.length === 0) {
    savedEl.innerHTML = `<div style="font-size:10px;color:#445;font-style:italic;padding:2px 0;">No matches</div>`
    return
  }

  savedEl.innerHTML = filtered.map(({ s, i }) => `
    <div style="display:flex;gap:3px;margin-bottom:4px;">
      <button data-saved="${i}" style="
        flex:1; min-width:0; padding:5px 8px;
        background:#0e1a1a; border:1px solid #253;
        color:#88ddaa; cursor:pointer; border-radius:4px;
        font-size:11px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      ">${s.label}</button>
      <button data-delete="${i}" style="
        padding:4px 7px; background:#1a0e0e; border:1px solid #533;
        color:#cc6666; cursor:pointer; border-radius:4px; font-size:10px; flex-shrink:0;
      ">✕</button>
    </div>
  `).join('')
  savedEl.querySelectorAll('[data-saved]').forEach(btn => {
    btn.addEventListener('click', () => {
      loadScenario(snapshots[parseInt((btn as HTMLElement).dataset.saved!)])
    })
  })
  savedEl.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteSnapshot(parseInt((btn as HTMLElement).dataset.delete!))
    })
  })
}
renderTestButtons()

function renderDummyButtons(): void {
  const container = document.getElementById('dummy-buttons')!
  const tiers: Array<{ tier: 1|2|3; label: string; hp: string }> = [
    { tier: 1, label: 'Low (1500 HP)',   hp: '1500' },
    { tier: 2, label: 'Mid (2700 HP)',   hp: '2700' },
    { tier: 3, label: 'High (4860 HP)',  hp: '4860' },
  ]
  container.innerHTML = tiers.map(t => `
    <button data-dummy-tier="${t.tier}" style="
      padding: 4px 7px; background: #1a1a2a; border: 1px solid #446;
      color: #99aabb; cursor: pointer; border-radius: 4px;
      font-size: 10px;
    ">${t.label}</button>
  `).join('')

  container.querySelectorAll('[data-dummy-tier]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = parseInt((btn as HTMLElement).dataset.dummyTier!) as 1|2|3
      selectedUnitId = 'dummy'
      selectedTier   = tier
      renderRoster()
    })
  })
}
renderDummyButtons()

// ─── Placed units (player's board) ────────────────────────────────────────────

const placedUnits = new Map<string, Unit>()  // hexId → unit

function getPlacedUnitsArray(): Unit[] {
  return [...placedUnits.values()]
}

function placeUnit(hex: OffsetCoord): void {
  if (!selectedUnitId) return
  const testMode = (document.getElementById('chk-test-mode') as HTMLInputElement).checked

  // Normal mode: player units only on rows 4–7
  // Test mode: any unit on any row; row determines team
  if (!testMode && ![4, 5, 6, 7].includes(hex.row)) return

  const key  = hexId(hex)
  const team = hex.row <= 3 ? 'enemy' : 'player'
  const unit = makeUnit(selectedUnitId, team, selectedTier)
  unit.hexPos = { ...hex }
  unit.visualPos = hexToPixel(hex, HEX_SIZE)
  placedUnits.set(key, unit)
}

function removeUnit(hex: OffsetCoord): void {
  placedUnits.delete(hexId(hex))
}

// ─── Combat state ─────────────────────────────────────────────────────────────

let combatState: CombatState | null = null
let combatRunning = false
let speedMult = 1
let accumulator = 0
let lastTs = 0
let inspectedUnitId: string | null = null

interface UnitSnapshot { definitionId: string; tier: number; hexPos: { col: number; row: number } }
let preCombatSnapshot: UnitSnapshot[] = []
let autoResetTimer: ReturnType<typeof setTimeout> | null = null
let victoryCelebrationTs = 0   // performance.now() when combat ended; 0 = not celebrating

function startCombat(): void {
  const testMode = (document.getElementById('chk-test-mode') as HTMLInputElement).checked

  const allPlaced = getPlacedUnitsArray()
  let playerUnits = allPlaced.filter(u => u.team === 'player')
  let enemyUnits  = allPlaced.filter(u => u.team === 'enemy')

  if (testMode) {
    // Test mode: use exactly what's placed — no mirroring, no auto enemies.
    // Need at least one unit on each side for the win condition to work.
    if (playerUnits.length === 0) {
      const def = makeUnit('tangela', 'player', 1)
      def.hexPos = { col: 3, row: 6 }
      def.visualPos = hexToPixel(def.hexPos, HEX_SIZE)
      playerUnits = [def]
    }
    if (enemyUnits.length === 0) {
      const def = makeUnit('dummy', 'enemy', 1)
      def.hexPos = { col: 3, row: 1 }
      def.visualPos = hexToPixel(def.hexPos, HEX_SIZE)
      enemyUnits = [def]
    }
  } else {
    // Normal mode: all placed units are player side, generate mirrored enemies.
    if (allPlaced.length === 0) {
      const def = makeUnit('tangela', 'player', 1)
      def.hexPos = { col: 3, row: 6 }
      def.visualPos = hexToPixel(def.hexPos, HEX_SIZE)
      playerUnits = [def]
    } else {
      playerUnits = allPlaced
    }
    enemyUnits = generateEnemyTeam(playerUnits)
  }

  // Snapshot player units so we can restore them after combat
  preCombatSnapshot = playerUnits.map(u => ({
    definitionId: u.definitionId,
    tier: u.tier as 1 | 2 | 3,
    hexPos: { ...u.hexPos },
  }))
  if (autoResetTimer !== null) { clearTimeout(autoResetTimer); autoResetTimer = null }

  combatState = createCombatState(playerUnits, enemyUnits)
  combatRunning = true
  accumulator = 0
  lastTs = 0

  // Expose test helpers on window for E2E automation
  ;(window as any).__pokeTFT = {
    weakenUnit(col: number, row: number, hp: number) {
      if (!combatState) return
      for (const unit of combatState.units.values()) {
        if (unit.hexPos.col === col && unit.hexPos.row === row) {
          unit.currentHp = Math.min(hp, unit.maxHp)
        }
      }
    },
    getCombatState: () => combatState,
  }

  boardLayer.setCombatActive(true)
  setCombatBarState('running')
  document.getElementById('result-box')!.style.display = 'none'
  document.getElementById('combat-info')!.textContent = ''
}

function restorePlayerBoard(): void {
  autoResetTimer       = null
  victoryCelebrationTs = 0
  combatRunning        = false
  combatState          = null
  inspectedUnitId = null
  document.getElementById('unit-info-panel')!.style.display = 'none'
  document.getElementById('result-box')!.style.display = 'none'
  document.getElementById('combat-info')!.textContent = ''

  // Rebuild player side from snapshot; enemy side wiped entirely
  placedUnits.clear()
  for (const snap of preCombatSnapshot) {
    const unit = makeUnit(snap.definitionId, 'player', snap.tier as 1 | 2 | 3)
    unit.hexPos    = { ...snap.hexPos }
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
    placedUnits.set(hexId(unit.hexPos), unit)
  }

  boardLayer.setCombatActive(false)
  setCombatBarState('idle')
}

function resetCombat(): void {
  if (autoResetTimer !== null) { clearTimeout(autoResetTimer); autoResetTimer = null }
  victoryCelebrationTs = 0
  combatRunning = false
  combatState   = null
  placedUnits.clear()
  inspectedUnitId = null
  document.getElementById('unit-info-panel')!.style.display = 'none'

  boardLayer.setCombatActive(false)
  setCombatBarState('idle')
  document.getElementById('result-box')!.style.display = 'none'
  document.getElementById('combat-info')!.textContent = ''
}

function tickCombat(state: CombatState): boolean {
  state.tick++
  state.events = []

  tickStatusEffects(state.units, state)
  tickShields(state.units)

  for (const unit of state.units.values()) {
    if (unit.state === 'dead') continue
    if (unit.isDummy) continue   // target dummies: stand still, absorb hits only
    tickManaLock(unit)
    computeStats(unit)

    // Leaping: direct pixel lerp to destination, no targeting or ability interrupts
    if (unit.state === 'leaping') {
      if (tickLeapPixel(unit, state)) unit.state = 'idle'
      continue
    }

    if (unit.state === 'casting') { tickAbilityCast(unit, state); continue }
    if (isReadyToCast(unit))      { triggerAbility(unit, state);  continue }

    tickTargeting(unit, state)
    if (!unit.targetId) continue

    const inRange = isInRange(unit, state)

    switch (unit.state) {
      case 'idle':
        if (inRange) startAttacking(unit)
        else { unit.state = 'moving'; recalculatePath(unit, state) }
        break
      case 'moving':
        if (inRange) { unit.state = 'idle'; unit.path = [] }
        else {
          if (unit.path.length === 0) recalculatePath(unit, state)
          if (unit.path.length > 0) {
            if (tickMovement(unit, state)) recalculatePath(unit, state)
            if (unit.path.length === 0) unit.state = 'idle'
          }
        }
        break
      case 'attacking':
        tickAttack(unit, state)
        break
    }
  }

  tickProjectiles(state)

  let playerAlive = false, enemyAlive = false
  for (const u of state.units.values()) {
    if (u.state !== 'dead') {
      if (u.team === 'player') playerAlive = true
      else enemyAlive = true
    }
  }
  if (!playerAlive || !enemyAlive) {
    state.phase = playerAlive ? 'playerWin' : 'enemyWin'
    return true
  }
  if (state.tick >= 1800) { state.phase = 'combat'; return true }
  return false
}

// ─── Speed buttons ────────────────────────────────────────────────────────────

document.getElementById('speed-buttons')!.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-spd]') as HTMLElement | null
  if (!btn) return
  speedMult = parseFloat(btn.dataset.spd!)
  document.querySelectorAll('[data-spd]').forEach(b => {
    const el = b as HTMLElement
    const active = parseFloat(el.dataset.spd!) === speedMult
    el.style.background = active ? '#1a3a6a' : '#111'
    el.style.borderColor = active ? '#4488cc' : '#333'
    el.style.color = active ? '#88aaff' : '#778'
  })
})

// ─── Combat bar button state ──────────────────────────────────────────────────

function setCombatBarState(state: 'idle' | 'running' | 'paused'): void {
  const btnStart = document.getElementById('btn-start') as HTMLButtonElement
  const btnPause = document.getElementById('btn-pause') as HTMLButtonElement
  const btnStop  = document.getElementById('btn-stop')  as HTMLButtonElement

  if (state === 'idle') {
    btnStart.textContent   = '▶ Start'
    btnStart.style.background = '#1a4a1a'; btnStart.style.borderColor = '#44cc44'
    btnStart.style.color   = '#88ff88'; btnStart.disabled = false
    btnPause.style.opacity = '0.4'; btnPause.disabled = true
    btnStop.style.opacity  = '0.4'; btnStop.disabled  = true
  } else if (state === 'running') {
    btnStart.textContent   = '▶ Start'
    btnStart.style.background = '#111'; btnStart.style.borderColor = '#334'
    btnStart.style.color   = '#556'; btnStart.disabled = true
    btnPause.style.opacity = '1'; btnPause.disabled = false
    btnStop.style.opacity  = '1'; btnStop.disabled  = false
  } else {  // paused
    btnStart.textContent   = '▶ Resume'
    btnStart.style.background = '#1a4a1a'; btnStart.style.borderColor = '#44cc44'
    btnStart.style.color   = '#88ff88'; btnStart.disabled = false
    btnPause.style.opacity = '0.4'; btnPause.disabled = true
    btnStop.style.opacity  = '1'; btnStop.disabled  = false
  }
}

document.getElementById('chk-test-mode')!.addEventListener('change', () => {
  if (combatRunning) resetCombat()
})

document.getElementById('btn-start')!.addEventListener('click', () => {
  if (combatState && !combatRunning) {
    // Resume from pause
    combatRunning = true
    lastTs = 0
    setCombatBarState('running')
  } else if (!combatRunning) {
    startCombat()
  }
})

document.getElementById('btn-pause')!.addEventListener('click', () => {
  if (!combatRunning) return
  combatRunning = false
  setCombatBarState('paused')
})

document.getElementById('btn-stop')!.addEventListener('click', () => {
  resetCombat()
})

document.getElementById('btn-reset')!.addEventListener('click', () => {
  resetCombat()
})

// ─── Test search ─────────────────────────────────────────────────────────────

document.getElementById('test-search')!.addEventListener('input', () => renderTestButtons())

// ─── Panel collapse ───────────────────────────────────────────────────────────

document.getElementById('btn-close-panel')!.addEventListener('click', () => {
  document.getElementById('right-panel')!.style.display = 'none'
  document.getElementById('btn-open-panel')!.style.display = ''
})

document.getElementById('btn-open-panel')!.addEventListener('click', () => {
  document.getElementById('right-panel')!.style.display = ''
  document.getElementById('btn-open-panel')!.style.display = 'none'
})

document.getElementById('uip-close')!.addEventListener('click', () => {
  inspectedUnitId = null
  document.getElementById('unit-info-panel')!.style.display = 'none'
})

function updateUnitInfoPanel(): void {
  const panel = document.getElementById('unit-info-panel')!
  if (!inspectedUnitId || !combatState) { panel.style.display = 'none'; return }

  const unit = combatState.units.get(inspectedUnitId)
  if (!unit || unit.state === 'dead') { panel.style.display = 'none'; inspectedUnitId = null; return }

  const teamColor = unit.team === 'player' ? '#66aaff' : '#ff6666'
  const stars = '★'.repeat(unit.tier)
  document.getElementById('uip-name')!.textContent = `${unit.name} ${stars}`
  document.getElementById('uip-name')!.style.color = teamColor

  const hpPct  = unit.maxHp > 0 ? Math.max(0, unit.currentHp / unit.maxHp) : 0
  const totalShield = unit.shields.reduce((s, sh) => s + sh.value, 0)
  const manaPct = unit.maxMana > 0 ? Math.max(0, Math.min(1, unit.currentMana / unit.maxMana)) : 0

  const barBase = `width:100%;height:8px;background:#1a1a2e;border-radius:3px;overflow:hidden;margin-bottom:2px;`
  const hpColor = unit.team === 'player' ? '#22cc44' : '#cc2222'

  const shieldsHtml = unit.shields.map(sh => {
    const pct = sh.maxValue > 0 ? Math.max(0, sh.value / sh.maxValue) : 0
    const dur = sh.durationTicks >= 0 ? ` ${(sh.durationTicks / 60).toFixed(1)}s` : ''
    return `
      <div style="margin-bottom:4px;">
        <div style="display:flex;justify-content:space-between;color:#aaa;margin-bottom:1px;">
          <span>${sh.sourceAbility.replace(/_/g,' ')}</span>
          <span style="color:#888;">${Math.round(sh.value)} / ${sh.maxValue}${dur}</span>
        </div>
        <div style="${barBase}">
          <div style="height:100%;width:${(pct*100).toFixed(1)}%;background:#888888;border-radius:3px;"></div>
        </div>
      </div>`
  }).join('')

  const statusHtml = unit.statusEffects.length > 0
    ? `<div style="color:#aaa;margin-top:4px;">Status: ${[...new Set(unit.statusEffects.map(s => s.id))].join(', ')}</div>`
    : ''

  document.getElementById('uip-body')!.innerHTML = `
    <div style="margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:1px;">
        <span style="color:#888;">HP</span>
        <span style="color:#aaa;">${Math.round(unit.currentHp)} / ${unit.maxHp}${totalShield > 0 ? ` <span style="color:#888;">(+${Math.round(totalShield)} shield)</span>` : ''}</span>
      </div>
      <div style="${barBase}">
        <div style="height:100%;width:${(hpPct*100).toFixed(1)}%;background:${hpColor};border-radius:3px;display:inline-block;"></div><div style="height:100%;width:${Math.min((1-hpPct)*100, (totalShield/unit.maxHp)*100).toFixed(1)}%;background:#888888;display:inline-block;"></div>
      </div>
    </div>
    ${unit.shields.length > 0 ? `<div style="margin-bottom:6px;"><div style="color:#99aacc;margin-bottom:3px;font-size:10px;">SHIELDS</div>${shieldsHtml}</div>` : ''}
    <div style="margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:1px;">
        <span style="color:#888;">Mana</span>
        <span style="color:#aaa;">${Math.round(unit.currentMana)} / ${unit.maxMana}</span>
      </div>
      <div style="${barBase}">
        <div style="height:100%;width:${(manaPct*100).toFixed(1)}%;background:#3377ff;border-radius:3px;"></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;color:#aaa;margin-bottom:4px;">
      <span style="color:#556;">ATK</span><span>${Math.round(computeStats(unit).attack)}</span>
      <span style="color:#556;">DEF</span><span>${Math.round(computeStats(unit).defense)}</span>
      <span style="color:#556;">SP.DEF</span><span>${Math.round(computeStats(unit).spDefense)}</span>
      <span style="color:#556;">ATK SPD</span><span>${computeStats(unit).attackSpeed.toFixed(2)}/s</span>
      <span style="color:#556;">Range</span><span>${unit.range}</span>
      <span style="color:#556;">State</span><span style="color:#88aaff;">${unit.state}</span>
    </div>
    ${statusHtml}
  `
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

document.getElementById('btn-snapshot')!.addEventListener('click', () => {
  const input = document.getElementById('snapshot-name') as HTMLInputElement
  const label = input.value.trim() || `Board ${loadSnapshots().length + 1}`
  snapshotCurrentBoard(label)
  input.value = ''
})

// ─── Mouse events ─────────────────────────────────────────────────────────────

function eventToHex(e: MouseEvent): OffsetCoord {
  const rect = cEff.getBoundingClientRect()
  // Inverse the perspective Y-scale so hex coords map correctly
  return pixelToHex(e.clientX - rect.left, (e.clientY - rect.top) / BOARD_PERSP_Y, HEX_SIZE)
}

cEff.addEventListener('mousemove', (e) => {
  boardLayer.setHovered(eventToHex(e))
})
cEff.addEventListener('mouseleave', () => {
  boardLayer.setHovered(null)
})
cEff.addEventListener('click', (e) => {
  // During combat: click a unit to inspect it
  if (combatState) {
    const rect = cEff.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const HIT_RADIUS = HEX_SIZE * 0.6
    let best: string | null = null
    let bestDist = Infinity
    for (const unit of combatState.units.values()) {
      if (unit.state === 'dead') continue
      // unit.visualPos is in logical coords; screen y = visualPos.y * BOARD_PERSP_Y
      const dx = unit.visualPos.x - px
      const dy = unit.visualPos.y * BOARD_PERSP_Y - py
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < HIT_RADIUS && d < bestDist) { bestDist = d; best = unit.id }
    }
    if (best) {
      inspectedUnitId = best
      document.getElementById('unit-info-panel')!.style.display = ''
    } else {
      inspectedUnitId = null
      document.getElementById('unit-info-panel')!.style.display = 'none'
    }
    return
  }
  if (combatRunning) return
  const hex = eventToHex(e)
  if (selectedUnitId) {
    placeUnit(hex)
  }
})
cEff.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  if (combatRunning) return
  removeUnit(eventToHex(e))
})

// ─── Render loop ──────────────────────────────────────────────────────────────

const posCache = new Map<string, { x: number; y: number }>()

function frame(ts: number): void {
  requestAnimationFrame(frame)

  if (lastTs === 0) lastTs = ts
  const dt = Math.min((ts - lastTs) / 1000, 0.1) * speedMult
  lastTs = ts

  let done = false
  if (combatRunning && combatState) {
    accumulator += dt
    const step = 1 / TICK_RATE
    const testMode = (document.getElementById('chk-test-mode') as HTMLInputElement).checked
    while (accumulator >= step && !done) {
      accumulator -= step
      done = tickCombat(combatState)
      // In test mode: suppress the tick-limit timeout, but still stop on a real team wipe
      if (testMode && combatState.phase === 'combat') done = false
      for (const [id, u] of combatState.units) posCache.set(id, { ...u.visualPos })
      effectLayer.processEvents(combatState.events, posCache, combatState.units)
    }

    if (done) {
      combatRunning = false
      victoryCelebrationTs = performance.now()
      setCombatBarState('idle')

      const winner = combatState.phase === 'playerWin' ? 'player'
                   : combatState.phase === 'enemyWin'  ? 'enemy'
                   : 'draw'
      const box = document.getElementById('result-box')!
      box.style.display = 'block'
      box.style.background = winner === 'player' ? '#1a4a1a'
                           : winner === 'enemy'  ? '#4a1a1a'
                           : '#2a2a2a'
      box.style.border = `1px solid ${winner === 'player' ? '#44cc44' : winner === 'enemy' ? '#cc4444' : '#888'}`
      box.style.color = winner === 'player' ? '#66ff66' : winner === 'enemy' ? '#ff6666' : '#aaa'
      box.textContent = winner === 'player' ? 'Your team wins!'
                      : winner === 'enemy'  ? 'Enemy wins!'
                      : 'Draw!'

      if (autoResetTimer === null) {
        autoResetTimer = setTimeout(restorePlayerBoard, 5000)
      }
    }

    document.getElementById('combat-info')!.textContent =
      `Tick: ${combatState.tick} (${(combatState.tick / TICK_RATE).toFixed(1)}s)`
  }

  updateUnitInfoPanel()
  boardLayer.draw()

  if (combatState) {
    unitLayer.draw(combatState.units, combatRunning, victoryCelebrationTs, effectLayer.getHealFlashUnits(), effectLayer.getCastAnimations(), combatState.tick)
    effectLayer.draw(combatState)
    unitLayer.drawAllHealthBars(combatState.units)
  } else {
    // Preview placed units
    const preview = new Map<string, Unit>()
    for (const u of placedUnits.values()) preview.set(u.id, u)
    unitLayer.draw(preview, false)
    effectLayer.draw({
      tick: 0, phase: 'setup',
      units: preview, projectiles: new Map(), events: [], hexOccupancy: new Map(),
    })
    unitLayer.drawAllHealthBars(preview)
  }
}

requestAnimationFrame(frame)
