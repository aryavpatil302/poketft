import { BoardLayer } from './render/layers/boardLayer'
import { activeTerrainPulseColor, activeTerrainLabel } from './core/systems/terrain'
import { UnitLayer } from './render/layers/unitLayer'
import { EffectLayer } from './render/layers/effectLayer'
import { calcBoardProfile, getThresholds } from './enemy/boardPower'
import { boardFeat, appendBattle, loadBattleLog, type BoardFeat } from './enemy/battleLog'
import {
  loadCalibration, predictWinProb, recordAndLearn, resetCalibration, recentBrier,
  type CalibParams,
} from './enemy/calibration'
import { createCombatState, advanceCombatTick } from './core/combatEngine'
import { hexToPixel, pixelToHex, hexId, getNeighbors, isValidHex, hexDistance, BOARD_COLS, BOARD_ROWS } from './core/hexGrid'
import { HEX_SIZE, TICK_RATE, BOARD_PERSP_Y, OVERLAY_HEADROOM } from './core/constants'
import { makeUnit, computeStats } from './core/unitFactory'
// Per-tick combat systems now live behind combatEngine.advanceCombatTick — the
// live loop shares one implementation with the headless sim (no more duplicate
// tick machine in main.ts).
import { ALL_UNITS, UNIT_MAP } from './data/units'
import { ITEM_MAP } from './data/items'
import { TRAIT_MAP } from './data/traits'
import { loadRun, saveRun as persistRunToStorage, clearRun, newRun, type RunState, type PlayerEcon, type BoardEntry } from './econ/runState'
import { rollShop, reroll as shopReroll, buyUnit, sellFromBench, sellFromBoard } from './econ/shop'
import { buyXp, xpToNext, boardCap } from './econ/xp'
import { botSeats, botPlanRound, econBoardPower } from './econ/bots'
import { checkGameOver } from './econ/botMatches'
import { isCreepRound, creepRoundDef, isItemRound, rollItemChoices } from './econ/creeps'
import {
  REROLL_COST, XP_BUY_COST, sellValue, copiesHeld, stageLabel, SHOP_ODDS,
  BASE_INCOME_BY_ROUND, BASE_INCOME_CAP, MAX_INTEREST, streakBonus, WIN_BONUS, XP_PER_ROUND,
} from './econ/constants'
import { startPlanning, resolveRound, pairSeats, type RoundResult, type FightLog } from './game/round'
import { createPlaybackState, applyFrame, playbackLength, playbackWinner } from './game/playback'
import { RoomClient } from './net/roomClient'
import { parseLobbyCode, partyHost, newLobbyCode, shareableLobbyUrl } from './net/lobbyUrl'
import { showTitleScreen, hideTitleScreen } from './ui/titleScreen'
import { showLobbyScreen, updateLobbyScreen, setLobbyMessage, hideLobbyScreen } from './ui/lobbyScreen'
import { pickGuestName } from './net/guestNames'
import { TRAIT_TOOLTIPS } from './data/traitTooltips'
import { REPO_TESTS } from './repoTests'
import type { CombatState, Unit, ItemDefinition } from './core/types'
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
    background: #0a0e1a url('/visuals/backgrounds/pixel_beach.png') center center / cover no-repeat;
    color: #cce;
    font-family: sans-serif;
    overflow: hidden;
    user-select: none;
  ">
    <!-- Left panel: unit roster (test mode only; opaque so it reads over the grass) -->
    <div id="left-panel" style="
      width: 200px;
      flex-shrink: 0;
      background: #0a0e1a;
      border-right: 1px solid #223;
      overflow-y: auto;
      padding: 10px;
      box-sizing: border-box;
    ">
      <!-- Enemy trait badges (test mode: when enemy units are placed pre-combat) -->
      <div id="enemy-traits-section" style="display:none;">
        <div style="font-size:9px;color:#cc6666;letter-spacing:.04em;margin-bottom:3px;opacity:0.8;">ENEMY</div>
        <div id="enemy-traits"></div>
        <div style="border-top:1px solid #2a1a1a;margin:4px 0 6px;"></div>
      </div>

      <!-- Active trait badges (updates as units are placed) -->
      <div id="active-traits" style="margin-bottom:8px;"></div>

      <div id="roster-section">
        <h3 style="margin: 0 0 6px; color: #88aaff; font-size: 13px;">Units</h3>
        <p style="margin: 0 0 8px; font-size: 10px; color: #778; line-height: 1.4;">
          Pick a unit &amp; star level,<br>then click a hex to place it.<br>Right-click to remove.
        </p>
        <div id="unit-roster"></div>
      </div>
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
      <!-- Grass background comes from #layout so it spans the full window
           (including behind the transparent econ-mode lobby panel). -->


      <canvas id="c-dim"    style="position:absolute;left:0;top:0;pointer-events:none;"></canvas>
      <canvas id="c-board"   style="position:absolute;"></canvas>
      <canvas id="c-ground"  style="position:absolute;"></canvas>
      <canvas id="c-units"   style="position:absolute;"></canvas>
      <canvas id="c-effects" style="position:absolute;"></canvas>

      <!-- Delibird item round overlay: Delibird swoops in, hops, then a tray of
           3 items expands from the centre. Populated + animated in main.ts
           (startItemRound). pointer-events gated so only the item cards are
           clickable while the tray is open. -->
      <div id="delibird-round" style="
        display:none;position:absolute;inset:0;z-index:16;pointer-events:none;
        font-family:sans-serif;
      ">
        <div id="delibird-anchor" style="
          position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);
        ">
          <!-- Tray sits directly above Delibird's head; hidden until the hops
               finish (revealed in startItemRound), so it never flashes early. -->
          <div id="delibird-tray-wrap" style="
            position:absolute;left:50%;bottom:100%;margin-bottom:22px;transform:translateX(-50%);
            display:none;justify-content:center;
          ">
            <div id="delibird-tray" style="
              display:flex;justify-content:center;gap:22px;padding:16px 20px;box-sizing:border-box;
              background:rgba(8,12,24,0.82);border:2px solid #6aa4ff;border-radius:14px;
              box-shadow:0 0 24px rgba(60,120,255,0.35);backdrop-filter:blur(3px);
            "></div>
          </div>
          <img id="delibird-sprite" src="/visuals/sprites/misc/delibird_sprite.webp"
            style="width:150px;height:auto;object-fit:contain;image-rendering:pixelated;
                   filter:drop-shadow(0 6px 10px rgba(0,0,0,0.45));display:block;">
        </div>
      </div>

      <!-- Volcano sun icon: spinning at upper-left outside the board when sun is active -->
      <img id="sun-effect"
        src="/visuals/trait icons/sun-effect.png"
        style="
          display:none;position:absolute;width:94px;height:94px;
          z-index:12;pointer-events:none;
          animation:sunSpin 5s linear infinite;
          filter:drop-shadow(0 0 14px rgba(255,180,0,0.85));
          transform-origin:center;
        "
      />

      <!-- Terrain indicator: shown during combat when a tapu sets active terrain -->
      <div id="terrain-indicator" style="
        display:none;position:absolute;left:8px;top:40px;
        z-index:6;pointer-events:none;
        height:62px;box-sizing:border-box;
        display:none;align-items:center;gap:8px;
        padding:6px 10px;
        background:#12192a;border-radius:4px;
        font-size:11px;color:#99aacc;font-family:sans-serif;
        border:1px solid #2a3a50;
      ">
        <span id="terrain-indicator-dot" style="
          display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;
        "></span>
        <span id="terrain-indicator-name" style="font-weight:bold;letter-spacing:.04em;"></span>
      </div>

      <!-- Trait overlay: shown during combat in place of the hidden sidebar -->
      <div id="trait-overlay" style="
        display:none;position:absolute;left:8px;top:78px;
        z-index:5;pointer-events:none;max-height:90%;overflow:hidden;
      ">
        <div id="trait-overlay-inner"></div>
      </div>

      <!-- Combat timer bar: flush across the top of the board, pixel-HP-bar
           styled (chunky border); drains right-to-left. Countdown number
           sits right below it. -->
      <div id="combat-timer-bar" style="
        display:none;position:absolute;left:50%;top:0;
        transform:translateX(-50%);
        z-index:11;pointer-events:none;
        width:${BOARD_W}px;
      ">
        <div style="width:100%;height:14px;box-sizing:border-box;position:relative;overflow:hidden;
          border:2px solid #0a0d14;background:#10131a;image-rendering:pixelated;">
          <div id="combat-timer-fill" style="position:absolute;left:0;top:0;height:100%;width:100%;background:#44cc44;"></div>
        </div>
        <div id="combat-timer-label" style="
          text-align:center;margin-top:4px;
          font-size:20px;font-weight:bold;color:#ffffff;
          font-family:'Courier New',monospace;
          text-shadow:2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000;letter-spacing:.06em;
        ">30</div>
      </div>

      <!-- Planning-phase countdown: same look as the combat timer, shown
           between rounds (economy mode only) until combat auto-starts -->
      <div id="planning-timer-bar" style="
        display:none;position:absolute;left:50%;top:0;
        transform:translateX(-50%);
        z-index:11;pointer-events:none;
        width:${BOARD_W}px;
      ">
        <div style="width:100%;height:14px;box-sizing:border-box;position:relative;overflow:hidden;
          border:2px solid #0a0d14;background:#10131a;image-rendering:pixelated;">
          <div id="planning-timer-fill" style="position:absolute;left:0;top:0;height:100%;width:100%;background:#44cc44;"></div>
        </div>
        <div id="planning-timer-label" style="
          text-align:center;margin-top:4px;
          font-size:20px;font-weight:bold;color:#ffffff;
          font-family:'Courier New',monospace;
          text-shadow:2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000;letter-spacing:.06em;
        ">30</div>
      </div>

      <!-- Overtime banner -->
      <div id="overtime-box" style="
        display:none;position:absolute;left:50%;top:10px;transform:translateX(-50%);
        z-index:10;pointer-events:none;
        background:rgba(180,60,0,0.85);border:1px solid #ff8833;border-radius:6px;
        padding:5px 16px;font-size:13px;font-weight:bold;color:#ffcc88;
        font-family:sans-serif;text-shadow:0 0 8px rgba(0,0,0,0.8);
        letter-spacing:.06em;
      ">⚡ OVERTIME — 2× speed</div>

      <!-- Power delta label: shown during generated-board combat. Sits just
           below the round indicator, which now owns the top-right corner. -->
      <div id="power-delta" style="
        display:none;position:absolute;right:8px;top:38px;
        z-index:6;pointer-events:none;
        font-size:12px;font-weight:bold;font-family:sans-serif;
        text-shadow:0 0 6px rgba(0,0,0,0.8);
      "></div>

      <!-- Enemy trait overlay: mirrors player overlay on the right during combat -->
      <div id="enemy-trait-overlay" style="
        display:none;position:absolute;right:8px;top:80px;
        z-index:5;pointer-events:none;max-height:90%;overflow:hidden;
      ">
        <div id="enemy-trait-overlay-inner"></div>
      </div>

      <!-- Round / opponent indicator (economy mode) — upper-LEFT corner,
           deliberately OUT of the centre column so the enemy bench row can sit
           just above the board's top edge without colliding with it. The
           terrain indicator below it is offset down to make room. -->
      <div id="round-indicator" style="
        display:none;position:absolute;left:8px;top:8px;
        z-index:11;pointer-events:none;text-align:center;
        color:#cde;font-family:sans-serif;
        background:rgba(8,12,24,0.85);border:1px solid #334;border-radius:8px;
        padding:8px 20px;letter-spacing:.04em;white-space:nowrap;
      "></div>

      <!-- Enemy bench row: read-only mirror of the opponent's bench, shown only
           during combat (see renderEnemyBenchRow) — sits below the timer/round
           indicator, on the opponent's side of the board. Its top offset is set
           dynamically in resizeCanvases (anchored to the board's real top
           edge, not a fixed guess) so it never overlaps the board. -->
      <div id="enemy-bench-row" style="
        display:none;position:absolute;left:50%;transform:translateX(-50%);
        z-index:11;pointer-events:none;gap:0;align-items:stretch;
      "></div>

      <!-- Economy bar: bench strip + HUD/shop (always visible in economy mode) -->
      <div id="econ-wrap" style="
        display:none;position:absolute;left:50%;bottom:0;transform:translateX(-50%);
        z-index:14;flex-direction:column;align-items:center;gap:4px;
        font-family:sans-serif;
      ">
        <div id="bench-row" style="display:flex;gap:0;align-items:stretch;"></div>
        <div id="econ-bar" style="
          background:rgba(8,12,24,0.92);border:1px solid #334;border-bottom:none;
          border-radius:10px 10px 0 0;
          padding:8px 12px 6px;display:flex;gap:10px;align-items:stretch;
          backdrop-filter:blur(4px);
        "></div>
      </div>

      <!-- Item bench: uncommitted items, bottom-left. 4 per page (2×2); a ▲▼
           pager below (see renderItemBench) moves between pages. Height is set to
           the shop bar's (econ-bar) at layout time so their top edges line up —
           see alignItemBench; the content is sized to fit that height. -->
      <div id="item-bench" style="
        display:none;position:absolute;left:14px;bottom:0;z-index:15;
        flex-direction:column;
        background:rgba(8,12,24,0.92);border:1px solid #334;border-bottom:none;
        border-radius:10px 10px 0 0;padding:8px 10px 10px;font-family:sans-serif;
        backdrop-filter:blur(4px);width:120px;box-sizing:border-box;
      ">
        <div style="font-size:12px;font-weight:bold;color:#88aaff;margin-bottom:4px;flex-shrink:0;">Items</div>
        <div id="item-bench-slots" style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
          flex:1;min-height:0;overflow:hidden;
        "></div>
      </div>

      <!-- Game over / victory overlay -->
      <div id="gameover-box" style="
        display:none;position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);
        z-index:30;background:rgba(8,12,24,0.96);border:2px solid #556;border-radius:12px;
        padding:26px 40px;text-align:center;font-family:sans-serif;
      "></div>

      <!-- Floating combat controls — bottom-right of canvas area. z-index kept
           above every other canvas overlay (board/unit layers, econ bar,
           game-over box) so nothing can render on top of it. -->
      <div id="combat-bar" style="
        position: absolute; bottom: 14px; right: 14px; z-index: 40;
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
        <!-- Drag handle (top-right corner) — click & drag to reposition the panel -->
        <div id="combat-bar-drag" title="Drag to move" style="
          position:absolute; top:0; right:26px;
          width:26px; height:26px;
          display:flex; align-items:center; justify-content:center;
          cursor:grab; color:#66809f; font-size:13px; line-height:1;
          user-select:none;
        ">✥</div>

        <!-- Collapse toggle (top-right corner) -->
        <button id="btn-combat-bar-collapse" title="Collapse panel" style="
          position:absolute; top:0; right:0;
          width:26px; height:26px; padding:0;
          display:flex; align-items:center; justify-content:center;
          background:transparent; border:none;
          cursor:pointer; color:#66809f; font-size:11px; line-height:1;
          border-top-right-radius:8px;
        ">▾</button>

        <!-- Row 1: test mode toggle (stays visible when collapsed) -->
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:#99bbdd;padding-right:44px;box-sizing:border-box;">
          <input type="checkbox" id="chk-test-mode" style="cursor:pointer;">
          Test Mode
          <span style="color:#445;font-size:10px;">(free placement)</span>
        </label>

        <!-- Collapsible body: everything below the Test Mode row -->
        <div id="combat-bar-body" style="display:flex;flex-direction:column;gap:6px;">
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:6px;">
          <div style="display:flex;align-items:center;gap:6px;min-width:0;">
            <img id="uip-sprite" style="width:26px;height:26px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;display:none;">
            <span id="uip-name" style="font-weight:bold;font-size:13px;color:#88aaff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
          </div>
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
      <!-- Lobby scoreboard (economy mode) -->
      <div id="lobby-panel" style="display:none;flex-shrink:0;margin-bottom:10px;"></div>

      <!-- Live damage meter (shown during combat, both modes) -->
      <div id="damage-meter-section" style="
        display:none;flex-shrink:0;margin-bottom:10px;
        background:rgba(10,14,26,0.85);border:1px solid #2a3550;border-radius:6px;
        padding:6px 8px;box-sizing:border-box;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:9px;color:#8899cc;letter-spacing:.04em;opacity:0.8;">DAMAGE</span>
          <button id="dmg-meter-collapse" style="background:transparent;border:none;color:#889;cursor:pointer;font-size:11px;padding:0 2px;">▾</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
          <div style="display:flex;background:#151c30;border-radius:3px;overflow:hidden;">
            <button id="dmg-meter-tab-mine" style="padding:2px 7px;font-size:9px;border:none;cursor:pointer;background:#3a5ca0;color:#fff;">Mine</button>
            <button id="dmg-meter-tab-enemy" style="padding:2px 7px;font-size:9px;border:none;cursor:pointer;background:transparent;color:#889;">Enemy</button>
          </div>
          <div style="display:flex;background:#151c30;border-radius:3px;overflow:hidden;">
            <button id="dmg-meter-stat-dealt" style="padding:2px 7px;font-size:9px;border:none;cursor:pointer;background:#555;color:#fff;">Dealt</button>
            <button id="dmg-meter-stat-taken" style="padding:2px 7px;font-size:9px;border:none;cursor:pointer;background:transparent;color:#889;">Taken</button>
          </div>
        </div>
        <div id="damage-meter" style="margin-top:6px;overflow-y:auto;max-height:280px;"></div>
      </div>

      <!-- Header with collapse button -->
      <div id="test-tools-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-shrink:0;">
        <h3 style="margin:0;color:#88aaff;font-size:13px;">Test Tools</h3>
        <button id="btn-close-panel" style="
          padding:2px 7px; background:transparent; border:1px solid #334;
          color:#778; cursor:pointer; border-radius:4px; font-size:11px;
        ">✕</button>
      </div>

      <!-- Dummy targets -->
      <div id="test-tools-dummies" style="margin-bottom:10px;flex-shrink:0;">
        <div style="font-size:10px;color:#556;margin-bottom:4px;">Test Units — select then click hex</div>
        <div id="dummy-buttons" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
      </div>

      <!-- Quick tests -->
      <div id="test-tools-tests" style="border-top:1px solid #223;padding-top:8px;display:flex;flex-direction:column;flex:1;min-height:0;">
        <div style="font-size:12px;color:#88aaff;font-weight:bold;margin-bottom:4px;flex-shrink:0;">Quick Tests</div>
        <div style="font-size:10px;color:#445;margin-bottom:6px;flex-shrink:0;">Loads board — then hit Play/Start</div>

        <!-- Search -->
        <input id="test-search" type="text" placeholder="Search tests…" style="
          width:100%; padding:4px 6px; margin-bottom:6px;
          background:#0a1220; border:1px solid #335; color:#aabbdd;
          border-radius:4px; font-size:10px; box-sizing:border-box;
          flex-shrink:0;
        ">

        <!-- Scrollable list: repo tests (from git) then local tests -->
        <div style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;">
          <div style="font-size:9px;color:#557;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Repo</div>
          <div id="test-buttons-repo"></div>
          <div style="border-top:1px solid #223;margin:6px 0 5px;"></div>
          <div style="font-size:9px;color:#557;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;">Local</div>
          <div id="test-buttons-saved"></div>
        </div>

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
        <!-- Push all local tests to repo (dev only) -->
        <button id="btn-push-all-tests" style="
          margin-top:5px; width:100%; padding:4px 8px;
          background:#101820; border:1px solid #334;
          color:#667; cursor:pointer; border-radius:4px; font-size:9px;
        ">⬆ Push local → repo</button>
      </div>
    </div>
  </div>
`

// ─── Canvas setup ─────────────────────────────────────────────────────────────

const wrap   = document.getElementById('canvas-wrap')!
const cDim    = document.getElementById('c-dim')     as HTMLCanvasElement
const cBoard  = document.getElementById('c-board')   as HTMLCanvasElement
const cGround = document.getElementById('c-ground')  as HTMLCanvasElement
const cUnits  = document.getElementById('c-units')   as HTMLCanvasElement
const cEff    = document.getElementById('c-effects') as HTMLCanvasElement

// Board offset within canvas-wrap (updated by resizeCanvases)
let boardOffsetX = 0
let boardOffsetY = 0

// econPhase declared ahead of the "Economy mode" section below because
// resizeCanvases reads it and runs immediately at module init (before that
// section's own declarations would otherwise execute) — same reason
// combatState is hoisted above the placed-units section.
type EconPhase = 'planning' | 'combat' | 'itemRound' | 'gameOver'
let econPhase: EconPhase = 'planning'

// Economy mode reserves a strip at the bottom of canvas-wrap for the bench +
// shop bar; the board (and everything anchored to it) shifts up to make room.
// Measured from the real DOM element (not a guessed constant) so the board
// always sits flush just above whatever the bench/shop bar actually render at.
const ECON_BOTTOM_FALLBACK = 292
const ECON_BOARD_GAP = 6

// Half-height of a fielded unit's sprite in logical canvas coordinates —
// mirrors unitLayer.ts's private SPRITE_HALF constant, needed here to anchor
// the hover-card tooltip to a board unit's actual sprite top (see
// econBoardHover / positionTooltipNearPoint).
const BOARD_SPRITE_HALF = HEX_SIZE * 0.80
// Health/mana bars float above the sprite (unitLayer.ts drawHealthBars:
// ABOVE_GAP + HP_H + INTER_GAP + MANA_H = 4 + 5 + 2 + 3) — clear those too,
// so the tooltip starts above the bars rather than just above the sprite.
const BOARD_BARS_CLEARANCE = 14

// Bench cell/sprite sizing (used by benchCellHTML further down).
const BENCH_CELL_W = 91
// A thin "spot" strip, not a container — 75% shorter than a square cell so
// the (full-size) unit visibly stands on top of it instead of sitting inside it.
// Anchored to the bottom edge (see benchCellHTML), so the row's bottom stays
// flush against the shop bar as this shrinks.
const BENCH_CELL_H = Math.round(BENCH_CELL_W * 0.25)
// Sprite size for a bench unit — the visible size of the pokemon on the bench.
const BENCH_SPRITE_W = 76
const BENCH_SPRITE_H = 60
// The unit sprite + its bars are bottom-anchored inside the (short) visible
// cell and overflow well above it (see benchCellHTML's "standing on the
// spot" layout). Each bench-cell's own DOM box is padded out to this full
// height too — both so clicks land anywhere near the sprite (not just the
// thin visible strip), and so bench-row's offsetHeight (which resizeCanvases
// reads via econWrapH to anchor the board above it) already includes this
// overflow without needing a separate manual correction.
const BENCH_BAR_STACK_H = 10        // HP bar (6) + mana bar (4), flush together
const BENCH_SPRITE_MARGIN_TOP = 3
const BENCH_VISUAL_OVERFLOW = Math.max(0,
  (BENCH_BAR_STACK_H + BENCH_SPRITE_MARGIN_TOP + BENCH_SPRITE_H) - BENCH_CELL_H)

// Floor for the enemy bench row's top — clears the combat/planning timer bar
// (14px bar + ~26px countdown label at top:0). The round indicator lives in
// the top-left corner precisely so it doesn't compete for this space. The
// board is never moved to make room — it stays anchored flush above the
// player's bench.
const ENEMY_BENCH_MIN_TOP = 46
// Breathing room between the enemy bench row's bottom edge and the board's
// top edge, so it reads as a separate strip rather than being welded on.
const ENEMY_BENCH_BOARD_GAP = 16

// The opponent's bench is informational (read-only), so it's rendered at 80%
// of the player's own bench scale — same layout/box model, just smaller. Its
// own derived metrics are used for both the cell markup and the row's
// positioning math, so the two can never drift apart.
const ENEMY_BENCH_SCALE = 0.8
const s80 = (n: number): number => Math.round(n * ENEMY_BENCH_SCALE)
const E_BENCH_CELL_W   = s80(BENCH_CELL_W)
const E_BENCH_CELL_H   = s80(BENCH_CELL_H)
const E_BENCH_SPRITE_W = s80(BENCH_SPRITE_W)
const E_BENCH_SPRITE_H = s80(BENCH_SPRITE_H)
const E_BENCH_BAR_W    = s80(52)
const E_BENCH_HP_H     = s80(6)
const E_BENCH_MANA_H   = s80(4)
const E_BENCH_STAR     = s80(10)
const E_BENCH_ITEM     = s80(20)
const E_BENCH_SPRITE_MARGIN_TOP = s80(BENCH_SPRITE_MARGIN_TOP)
const E_BENCH_VISUAL_OVERFLOW = Math.max(0,
  (E_BENCH_HP_H + E_BENCH_MANA_H + E_BENCH_SPRITE_MARGIN_TOP + E_BENCH_SPRITE_H) - E_BENCH_CELL_H)
// Full height of the row's DOM box (visible strip + upward sprite overflow).
const E_BENCH_ROW_H = E_BENCH_CELL_H + E_BENCH_VISUAL_OVERFLOW

// Set true once the user drags the combat/test-mode panel, so resizeCanvases stops
// auto-anchoring it to the bottom-right and it stays wherever they put it.
let combatBarMoved = false

function resizeCanvases() {
  const wrapW = wrap.clientWidth
  const wrapH = wrap.clientHeight
  const econ = econActive()
  const econWrapH = document.getElementById('econ-wrap')?.offsetHeight || 0
  const bottomSpace = econ ? (econWrapH || ECON_BOTTOM_FALLBACK) : 0
  boardOffsetX = Math.max(0, (wrapW - BOARD_W) / 2)
  // Economy mode: anchor the board just above the bench (small fixed gap)
  // instead of centering it in the leftover space — test mode stays centered.
  // (econWrapH already includes the bench sprites' upward overflow now that
  // each bench-cell's own DOM box is padded out to match — see
  // BENCH_VISUAL_OVERFLOW above.)
  boardOffsetY = econ
    ? Math.max(4, wrapH - BOARD_H - bottomSpace - ECON_BOARD_GAP)
    : Math.max(4, (wrapH - BOARD_H - bottomSpace) / 2)
  // c-dim covers the full canvas-wrap so the dim overlay can extend beyond the board
  cDim.width  = wrapW
  cDim.height = wrapH
  cDim.style.width  = `${wrapW}px`
  cDim.style.height = `${wrapH}px`
  for (const c of [cBoard, cGround]) {
    c.width  = BOARD_W
    c.height = BOARD_H
    c.style.width  = `${BOARD_W}px`
    c.style.height = `${BOARD_H}px`
    c.style.left   = `${boardOffsetX}px`
    c.style.top    = `${boardOffsetY}px`
  }
  // The unit AND effect layers get extra headroom above the board so top-row
  // overlays (stun/knockup icons, health bars) and above-head VFX (Celebi /
  // Spiritomb marks, airborne) aren't clipped. Each is grown upward and its
  // draw translated down by the same amount, so content still lines up with the
  // board hexes. cEff is also the mouse hit-test surface, so eventToHex / the
  // click + hover handlers subtract OVERLAY_HEADROOM to map back to board space.
  for (const c of [cUnits, cEff]) {
    c.width  = BOARD_W
    c.height = BOARD_H + OVERLAY_HEADROOM
    c.style.width  = `${BOARD_W}px`
    c.style.height = `${BOARD_H + OVERLAY_HEADROOM}px`
    c.style.left   = `${boardOffsetX}px`
    c.style.top    = `${boardOffsetY - OVERLAY_HEADROOM}px`
  }
  // Trait overlays: first badge top-aligns with the board's top edge
  for (const id of ['trait-overlay', 'enemy-trait-overlay']) {
    const el = document.getElementById(id)
    if (el) el.style.top = `${boardOffsetY}px`
  }
  // Enemy bench row: sits just above the board's top edge (ENEMY_BENCH_BOARD_GAP
  // of breathing room), mirroring how the board itself anchors above the
  // player's own bench at the bottom. The board is never pushed down to make
  // room (that gap between the player's bench and their board is deliberate),
  // so on a viewport too short to fit the row it clamps at ENEMY_BENCH_MIN_TOP
  // rather than displacing the board. Horizontal centering is CSS
  // (left:50% + translateX(-50%)), matching the board's own centering.
  {
    const el = document.getElementById('enemy-bench-row')
    if (el) el.style.top = `${Math.max(ENEMY_BENCH_MIN_TOP, boardOffsetY - ENEMY_BENCH_BOARD_GAP - E_BENCH_ROW_H)}px`
  }
  // Keep the combat controls clear of the shop strip (measured post-render,
  // so this always matches the econ-wrap's real height, not a guess)
  const showEconPanels = econ && econPhase !== 'gameOver'
  if (!combatBarMoved) document.getElementById('combat-bar')!.style.bottom = showEconPanels ? `${bottomSpace + 20}px` : '14px'
  alignItemBench()
}
resizeCanvases()
window.addEventListener('resize', resizeCanvases)

// ─── Layers ───────────────────────────────────────────────────────────────────

const boardLayer  = new BoardLayer(cBoard)
const unitLayer   = new UnitLayer(cUnits)
const effectLayer = new EffectLayer(cEff, cGround)

// ─── Dim overlay (c-dim covers full canvas-wrap; only the hex field is dimmed) ──

const cDimCtx = cDim.getContext('2d')!

function drawDimOverlay(active: boolean): void {
  cDimCtx.clearRect(0, 0, cDim.width, cDim.height)
  if (!active) return

  // Fill just the hex field polygons with 50% black; the surround stays bright.
  cDimCtx.fillStyle = 'rgba(0,0,0,0.5)'
  cDimCtx.save()
  // Shift to where the board sits within canvas-wrap, then apply the same
  // perspective Y-scale used by boardLayer so hexes align precisely.
  cDimCtx.translate(boardOffsetX, boardOffsetY)
  cDimCtx.scale(1, BOARD_PERSP_Y)
  cDimCtx.beginPath()
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const { x, y } = hexToPixel({ col, row }, HEX_SIZE)
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6
        const px = x + HEX_SIZE * Math.cos(angle)
        const py = y + HEX_SIZE * Math.sin(angle)
        if (i === 0) cDimCtx.moveTo(px, py)
        else         cDimCtx.lineTo(px, py)
      }
      cDimCtx.closePath()
    }
  }
  cDimCtx.fill()
  cDimCtx.restore()
}

// The econ-mode lobby panel is transparent grass that sits outside the c-dim
// canvas, so the board dim doesn't reach it. Darken it to the same 50% black
// during combat so the whole surround dims together.
function dimSidePanel(active: boolean): void {
  if (!econActive()) return
  document.getElementById('right-panel')!.style.background = active ? 'rgba(0,0,0,0.5)' : 'transparent'
}

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

// ─── Active trait display ──────────────────────────────────────────────────────

// ─── Rendered trait badges ────────────────────────────────────────────────────
// DOM/CSS re-creation of the old pre-rendered badge PNGs. Layout mirrors the
// reference art (e.g. beachy_1.png inactive, beachy_3.png bronze):
//   pointy-top hexagon (grey/bronze/silver/gold) + trait glyph, overlapping a
//   rounded banner with count box, trait name, and breakpoint row.

const TRAIT_BADGE_HEIGHT = 62
const TRAIT_BADGE_WIDTH  = 180

// Pointy-top hexagon (matches hexagon-icon.png): vertices at top/bottom center
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

// Breakpoint tier fills sampled from the reference badge art
const HEX_FILL_INACTIVE = '#6b6b6b'
const HEX_FILL_BRONZE   = '#a87c4f'   // beachy_3.png
const HEX_FILL_SILVER   = '#bfcad3'   // beachy_5.png
const HEX_FILL_GOLD     = '#f0c95c'   // volcanic_8.png / sky_striker_4.png

// Glyph filenames in /visuals/trait icons/main icons/ that don't follow the
// `${trait}_trait_icon.png` convention
const GLYPH_OVERRIDES: Record<string, string> = {
  cave_crawler: 'cave_trait_icon.png',
  quickclaw:    'quick_striker_trait_icon.png',
  volcanic:     'volcano_trait_icon.png',
  shock_spirit: 'shock_spirit_trait_icon.webp',
  wave_spirit:  'wave_spirt_trait_icon.svg',
  earth_spirit: 'earth_spirt_trait_icon.png',
  mind_spirit:  'mind_spirt_icon.png',
  soul_bonded:  'soul_bound_trait_icon.png',
}

// Glyph rendering: every glyph draws in a fixed 30px contain-fit box, then a
// per-trait scale normalizes the VISIBLE art to a uniform size (~36×34 max).
// The source PNGs have wildly different transparent padding — e.g. sky
// striker's eagle fills only 28%×62% of its canvas while spellweaver fills
// 100%. Scales below are derived from each icon's measured opaque-pixel
// bounding box (ImageMagick `-alpha extract -trim`); the hexagon clip-path
// makes any transparent-margin overflow crop-safe.
const GLYPH_BOX = 30
const GLYPH_SCALE_DEFAULT = 1.15
const GLYPH_SCALE: Record<string, number> = {
  ascender:       1.00,
  beachy:         1.55,
  bruiser:        0.89,
  cave_crawler:   1.17,
  corkscrew:      1.13,
  crashout:       1.18,
  froststone:     1.13,
  jungle:         1.13,
  keen_eye:       1.00,
  mystic:         1.00,
  promoter:       1.32,
  quickclaw:      1.16,
  river:          2.53,
  rogue:          1.00,
  roughneck:      1.21,
  ruiner:         2.00,
  shock_spirit:   1.70,
  sky_striker:    3.51,
  soul_bonded:    1.28,
  spellweaver:    0.79,
  stalwart:       1.00,
  substitutor:    2.83,
  temporal_woods: 2.15,
  volcanic:       1.00,
}

function traitDisplayName(trait: string): string {
  return trait.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Hexagon fill by breakpoint level. The FINAL threshold of a trait is always
// gold (sky_striker_4.png is gold at 2 thresholds); intermediates step
// bronze → silver.
function hexFillForLevel(level: number, maxLevel: number): string {
  if (level <= 0) return HEX_FILL_INACTIVE
  if (level >= maxLevel) return HEX_FILL_GOLD
  return level === 1 ? HEX_FILL_BRONZE : HEX_FILL_SILVER
}

function traitBadgeHTML(trait: string, count: number): string {
  const thresholds = getThresholds(trait)
  const level      = thresholds.filter(t => count >= t).length
  const active     = level > 0
  const name       = traitDisplayName(trait)
  const glyphFile  = GLYPH_OVERRIDES[trait] ?? `${trait}_trait_icon.png`
  const glyphSrc   = `/visuals/trait icons/main icons/${glyphFile}`
  const glyphScale = GLYPH_SCALE[trait] ?? GLYPH_SCALE_DEFAULT

  // Hexagon: white border + grey fill + white glyph when inactive;
  // black border + tier fill + black glyph when active.
  const hexBorder = active ? '#111111' : '#ffffff'
  const hexFill   = hexFillForLevel(level, thresholds.length)
  // Glyph art is black-on-transparent: brightness(0) normalizes to black,
  // invert(1) flips to white for the inactive state.
  const glyphFilter = active ? 'brightness(0)' : 'brightness(0) invert(1)'

  const hexH = 58, hexW = Math.round(hexH * 0.866)  // pointy-top aspect

  const hexagonHtml = `
    <div style="position:absolute;left:0;top:2px;width:${hexW}px;height:${hexH}px;
                clip-path:${HEX_CLIP};background:${hexBorder};z-index:1;">
      <div style="position:absolute;inset:3px;clip-path:${HEX_CLIP};background:${hexFill};
                  display:flex;align-items:center;justify-content:center;">
        <img src="${glyphSrc}" alt="${name}"
          style="width:${GLYPH_BOX}px;height:${GLYPH_BOX}px;object-fit:contain;filter:${glyphFilter};transform:scale(${glyphScale});"
          onerror="this.style.display='none'">
      </div>
    </div>`

  let bannerHtml: string
  if (active) {
    // Highlight only the highest reached threshold (matches reference art)
    const highest = thresholds.filter(t => count >= t).pop()
    const bpHtml = thresholds.map(t => `
      <span style="color:${t === highest ? '#ffffff' : '#9a9a9a'};">${t}</span>
    `).join(`<span style="color:#9a9a9a;"> &gt; </span>`)

    bannerHtml = `
      <div style="position:absolute;left:${Math.round(hexW * 0.5)}px;right:0;top:8px;bottom:8px;
                  background:#58585c;border-radius:9px;z-index:0;
                  display:flex;align-items:center;gap:7px;
                  padding-left:${Math.round(hexW * 0.62)}px;box-sizing:border-box;">
        <div style="flex-shrink:0;min-width:24px;height:30px;border-radius:6px;background:#909094;
                    display:flex;align-items:center;justify-content:center;
                    font-size:16px;font-weight:bold;color:#ffffff;padding:0 3px;">${count}</div>
        <div style="display:flex;flex-direction:column;line-height:1.25;min-width:0;">
          <span style="font-size:13px;font-weight:bold;color:#ffffff;
                       white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
          <span style="font-size:11px;font-weight:bold;">${bpHtml}</span>
        </div>
      </div>`
  } else {
    const next = thresholds.find(t => count < t) ?? thresholds[thresholds.length - 1]
    bannerHtml = `
      <div style="position:absolute;left:${Math.round(hexW * 0.5)}px;right:0;top:8px;bottom:8px;
                  background:#dcdcdc;border-radius:9px;z-index:0;
                  display:flex;flex-direction:column;justify-content:center;line-height:1.25;
                  padding-left:${Math.round(hexW * 0.62)}px;box-sizing:border-box;">
        <span style="font-size:13px;font-weight:bold;color:#999999;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
        <span style="font-size:11px;font-weight:bold;color:#999999;">${count} / ${next}</span>
      </div>`
  }

  return `
    <div style="position:relative;width:${TRAIT_BADGE_WIDTH}px;height:${TRAIT_BADGE_HEIGHT}px;
                margin-bottom:5px;font-family:sans-serif;">
      ${bannerHtml}
      ${hexagonHtml}
    </div>`
}

// ─── Trait list: tier sort + pagination ───────────────────────────────────────
// Traits sort Gold → Silver → Bronze → Inactive (then count, then name).
// Lists show at most TRAIT_PAGE_SIZE badges; longer lists page with ▲/▼.

const TRAIT_PAGE_SIZE = 8
const traitPages    = new Map<string, number>()                    // containerId → page
const traitListData = new Map<string, Array<[string, number]>>()   // containerId → entries

// 3 = gold (final threshold), 2 = silver, 1 = bronze, 0 = inactive —
// mirrors hexFillForLevel so the sort order matches the badge colors.
function traitTierRank(trait: string, count: number): number {
  const thresholds = getThresholds(trait)
  const level = thresholds.filter(t => count >= t).length
  if (level <= 0) return 0
  if (level >= thresholds.length) return 3
  return level === 1 ? 1 : 2
}

function sortTraitEntries(counts: Map<string, number>): Array<[string, number]> {
  return [...counts.entries()].sort((a, b) => {
    const rankDiff = traitTierRank(b[0], b[1]) - traitTierRank(a[0], a[1])
    if (rankDiff !== 0) return rankDiff
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })
}

function renderTraitListInto(containerId: string): void {
  const el = document.getElementById(containerId)
  if (!el) return
  const entries = traitListData.get(containerId) ?? []
  const maxPage = Math.max(0, Math.ceil(entries.length / TRAIT_PAGE_SIZE) - 1)
  const page    = Math.min(traitPages.get(containerId) ?? 0, maxPage)
  traitPages.set(containerId, page)

  const team = containerId.startsWith('enemy') ? 'enemy' : 'player'
  const shown = entries.slice(page * TRAIT_PAGE_SIZE, (page + 1) * TRAIT_PAGE_SIZE)
  let html = shown.map(([trait, count]) => `
    <div class="trait-badge" data-trait="${trait}" data-count="${count}" data-team="${team}"
         style="pointer-events:auto;">${traitBadgeHTML(trait, count)}</div>`).join('')

  if (entries.length > TRAIT_PAGE_SIZE) {
    const btn = (dir: number, symbol: string, disabled: boolean) => `
      <button onclick="window.__traitPage('${containerId}',${dir})" ${disabled ? 'disabled' : ''}
        style="pointer-events:auto;width:28px;height:18px;border:none;border-radius:4px;
               background:${disabled ? '#33363e' : '#58585c'};color:${disabled ? '#666' : '#ffffff'};
               font-size:10px;line-height:1;padding:0;cursor:${disabled ? 'default' : 'pointer'};">${symbol}</button>`
    const row = (inner: string) => `
      <div style="display:flex;justify-content:center;width:${TRAIT_BADGE_WIDTH}px;margin-bottom:5px;">${inner}</div>`
    // ▲ above the list, ▼ below — each only shown when there is a page in that direction
    html = (page > 0 ? row(btn(-1, '▲', false)) : '')
         + html
         + (page < maxPage ? row(btn(1, '▼', false)) : '')
  }
  el.innerHTML = html
}

;(window as any).__traitPage = (containerId: string, dir: number) => {
  traitPages.set(containerId, (traitPages.get(containerId) ?? 0) + dir)
  renderTraitListInto(containerId)
}

// ─── Trait hover tooltip ──────────────────────────────────────────────────────
// Single fixed-position tooltip shared by every trait badge (sidebar and both
// combat overlays). Content is built lazily on hover so the on-board species
// highlighting is always current.

const TOOLTIP_WIDTH = 252
const COST_BORDER: Record<number, string> = {
  1: '#9aa0a6',   // grey
  2: '#45b45f',   // green
  3: '#3b82d8',   // blue
  4: '#a855f7',   // purple
  5: '#e8b03e',   // golden yellow
}

const tooltipEl = document.createElement('div')
tooltipEl.id = 'trait-tooltip'
tooltipEl.style.cssText = `
  display:block;position:fixed;z-index:100;pointer-events:none;
  opacity:0;transition:opacity 0.3s ease;
  width:${TOOLTIP_WIDTH}px;box-sizing:border-box;
  background:rgba(8,8,12,0.88);border:1px solid #3a3a44;border-radius:8px;
  padding:10px 12px;color:#ffffff;font-family:sans-serif;font-size:12px;line-height:1.4;
`
document.body.appendChild(tooltipEl)

// Fade-in/out for every tooltip type (trait badge, lobby row, shop card,
// bench cell, fielded-unit hover). `currentTooltipSource` gates the fade so
// moving the mouse within the SAME hovered target doesn't keep restarting the
// animation — only switching to a genuinely new target re-triggers it.
let currentTooltipSource: string | null = null

function tooltipFadeIn(): void {
  // Restart the CSS transition: drop to 0 with transitions off, force a
  // reflow, then re-enable the transition and animate back up to 1.
  tooltipEl.style.transition = 'none'
  tooltipEl.style.opacity = '0'
  void tooltipEl.offsetWidth
  tooltipEl.style.transition = 'opacity 0.3s ease'
  tooltipEl.style.opacity = '1'
}

function tooltipHide(): void {
  tooltipEl.style.transition = 'opacity 0.3s ease'
  tooltipEl.style.opacity = '0'
}

// Marks `source` as the active hover target; fades in only if it's new.
// Returns true when this is a fresh show (caller should (re)build content).
function ensureTooltipShown(source: string): boolean {
  const isNew = currentTooltipSource !== source
  currentTooltipSource = source
  if (isNew) tooltipFadeIn()
  return isNew
}

function tooltipHiddenReset(): void {
  currentTooltipSource = null
  tooltipHide()
}

// Species of this trait currently fielded by a team (unique, matches trait counts)
function fieldedTraitSpecies(trait: string, team: 'player' | 'enemy'): Set<string> {
  const source: Iterable<Unit> = team === 'enemy' && combatState
    ? combatState.units.values()
    : placedUnits.values()
  const fielded = new Set<string>()
  for (const unit of source) {
    if (unit.isDummy || unit.team !== team) continue
    if (unit.types.includes(trait)) fielded.add(unit.definitionId)
  }
  return fielded
}

function traitTooltipHTML(trait: string, count: number, team: 'player' | 'enemy'): string {
  const name       = traitDisplayName(trait)
  const thresholds = getThresholds(trait)
  const tooltip    = TRAIT_TOOLTIPS[trait]
  const def        = TRAIT_MAP.get(trait)
  const active     = [...thresholds].reverse().find(t => count >= t)  // highest reached

  // Summary paragraph — condensed copy, falling back to the first threshold text
  const summary = tooltip?.summary
    ?? def?.thresholds[0]?.description.replace(/^\(\d+\)\s*/, '')
    ?? ''

  // Breakpoint lines: active one white, the rest grey
  const bpLines = thresholds.map((t, i) => {
    const text  = tooltip?.breakpoints[i]
      ?? def?.thresholds[i]?.description.replace(/^\(\d+\)\s*/, '')
      ?? ''
    const isActive = t === active
    return `<div style="color:${isActive ? '#ffffff' : '#8a8a92'};font-weight:${isActive ? 'bold' : 'normal'};">
      (${t}) ${text}</div>`
  }).join('')

  // Unit grid: every species with this trait, cost-colored border,
  // fielded species fully visible, the rest dimmed
  const fielded = fieldedTraitSpecies(trait, team)
  const members = ALL_UNITS
    .filter(u => !u.isDummy && u.cost > 0 && u.types.includes(trait))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
  const unitsHtml = members.map(u => `
    <div title="${u.name}" style="
      width:34px;height:34px;box-sizing:border-box;flex-shrink:0;
      border:2px solid ${COST_BORDER[u.cost] ?? '#9aa0a6'};border-radius:4px;
      background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;
      opacity:${fielded.has(u.id) ? 1 : 0.35};">
      <img src="${u.spritePath}" alt="${u.name}"
        style="width:28px;height:28px;object-fit:contain;image-rendering:pixelated;"
        onerror="this.style.display='none'">
    </div>`).join('')

  return `
    <div style="font-size:13px;font-weight:bold;margin-bottom:6px;">${name}</div>
    <div style="color:#d8d8de;margin-bottom:8px;">${summary}</div>
    <div style="font-size:11px;margin-bottom:8px;">${bpLines}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">${unitsHtml}</div>`
}

function showTraitTooltip(badge: HTMLElement): void {
  const trait = badge.dataset.trait
  if (!trait) return
  const count = parseInt(badge.dataset.count ?? '0', 10)
  const team  = badge.dataset.team === 'enemy' ? 'enemy' : 'player'
  ensureTooltipShown(`trait:${trait}:${team}`)

  tooltipEl.style.width = `${TOOLTIP_WIDTH}px`
  tooltipEl.innerHTML = traitTooltipHTML(trait, count, team)

  // Open toward the board: right of the badge when it fits, else left
  const rect = badge.getBoundingClientRect()
  const openRight = rect.right + 10 + TOOLTIP_WIDTH <= window.innerWidth
  const left = openRight ? rect.right + 10 : rect.left - TOOLTIP_WIDTH - 10
  tooltipEl.style.left = `${Math.max(4, left)}px`
  tooltipEl.style.top  = `${rect.top}px`
  // Keep on screen vertically
  const ttRect = tooltipEl.getBoundingClientRect()
  let top = rect.top
  if (ttRect.bottom > window.innerHeight - 6) {
    top = Math.max(6, window.innerHeight - 6 - ttRect.height)
    tooltipEl.style.top = `${top}px`
  }

  // Speech-bubble arrow on the badge-facing edge, vertically aligned with the
  // badge's hexagon center (clamped inside the box)
  const badgeCenterY = rect.top + rect.height / 2
  const arrowY = Math.max(14, Math.min(ttRect.height - 14, badgeCenterY - top))
  const bg = 'rgba(8,8,12,0.88)'
  const line = '#3a3a44'
  const tri = (offset: number, size: number, color: string) => openRight
    ? `left:-${offset}px;border-top:${size}px solid transparent;border-bottom:${size}px solid transparent;border-right:${size}px solid ${color};`
    : `right:-${offset}px;border-top:${size}px solid transparent;border-bottom:${size}px solid transparent;border-left:${size}px solid ${color};`
  tooltipEl.insertAdjacentHTML('beforeend', `
    <div style="position:absolute;width:0;height:0;top:${arrowY - 9}px;${tri(9, 9, line)}"></div>
    <div style="position:absolute;width:0;height:0;top:${arrowY - 8}px;${tri(7, 8, bg)}"></div>`)
}

document.addEventListener('mouseover', (e) => {
  const target = e.target as HTMLElement
  const badge = target.closest?.('.trait-badge') as HTMLElement | null
  if (badge) { showTraitTooltip(badge); return }
  const lobbyRow = target.closest?.('.lobby-row') as HTMLElement | null
  if (lobbyRow) { showLobbyTooltip(lobbyRow); return }
  const shopCard = target.closest?.('.shop-card') as HTMLElement | null
  if (shopCard) { showShopCardTooltip(shopCard); return }
  const benchCell = target.closest?.('.bench-cell') as HTMLElement | null
  if (benchCell) { showBenchCardTooltip(benchCell); return }
  // Board-unit hover (canvas, not a DOM element) manages its own source —
  // don't clobber it here.
  if (currentTooltipSource?.startsWith('board:')) return
  tooltipHiddenReset()
})

// Scouting tooltip: hover a lobby row to see that player's current board
// Traits actually active on a board right now — unique species per trait,
// filtered to traits that clear their first activation threshold. This is
// deliberately NOT persona.lines (a bot's target-comp preference/identity,
// which can differ from what's actually fielded at any given moment).
function activeTraitsOnBoard(board: BoardEntry[]): Array<[string, number]> {
  const counts = new Map<string, number>()
  const seenDefs = new Set<string>()
  for (const entry of board) {
    if (seenDefs.has(entry.definitionId)) continue
    seenDefs.add(entry.definitionId)
    const def = UNIT_MAP.get(entry.definitionId)
    if (!def) continue
    for (const t of def.types) {
      if (NON_DISPLAY_TRAITS.has(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  const active = [...counts.entries()].filter(([trait, count]) => getThresholds(trait).some(t => count >= t))
  return sortTraitEntries(new Map(active))
}

function showLobbyTooltip(row: HTMLElement): void {
  const pi = Number(row.dataset.pi)
  const p = run.players[pi]
  if (!p || p.eliminated) { tooltipHiddenReset(); return }
  ensureTooltipShown(`lobby:${pi}`)
  tooltipEl.style.width = `${TOOLTIP_WIDTH}px`

  const activeTraits = activeTraitsOnBoard(p.board)
  const lineLabel = activeTraits.length > 0
    ? activeTraits.map(([t]) => traitDisplayName(t)).join(' · ')
    : (p.personaId === null ? 'That’s you' : 'No active traits')
  const power = Math.round(econBoardPower(p) * 10) / 10

  const cells = p.board.map(u => {
    const def = UNIT_MAP.get(u.definitionId)
    if (!def) return ''
    const border = COST_BORDER[def.cost] ?? '#9aa0a6'
    return `<div style="width:34px;border:2px solid ${border};border-radius:4px;background:#0a0e1a;padding:1px;">
      <img src="${def.spritePath}" style="width:28px;height:24px;object-fit:contain;image-rendering:pixelated;display:block;margin:0 auto;" onerror="this.style.display='none'">
      <div style="text-align:center;line-height:1;font-size:8px;color:${STAR_COLORS[u.tier]};">${'★'.repeat(u.tier)}</div>
    </div>`
  }).join('')

  tooltipEl.innerHTML = `
    <div style="font-weight:bold;color:#88aaff;margin-bottom:2px;">${p.name}
      <span style="color:#667;font-weight:normal;">Lv ${p.level} · ${goldIconHTML(11)} ${p.gold} · power ${power}</span></div>
    <div style="font-size:10px;color:#99aacc;margin-bottom:6px;">${lineLabel}</div>
    ${p.board.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:3px;max-width:230px;">${cells}</div>`
      : '<div style="font-size:10px;color:#667;">No units fielded yet</div>'}`
  const rect = row.getBoundingClientRect()
  const ttRect = tooltipEl.getBoundingClientRect()
  tooltipEl.style.left = `${Math.max(4, rect.left - ttRect.width - 10)}px`
  tooltipEl.style.top  = `${Math.min(rect.top, window.innerHeight - ttRect.height - 8)}px`
}

function setTraitList(containerId: string, entries: Array<[string, number]>): void {
  traitListData.set(containerId, entries)
  renderTraitListInto(containerId)
}

// 'Golem' is a `types` tag on the Ruiner summons (Golett/Golurk/Mega Golurk)
// used purely as internal metadata (e.g. distinguishing summon kind) — it's
// not a real trait and should never render as a sidebar badge.
const NON_DISPLAY_TRAITS = new Set(['Golem'])

function renderTraitDisplay(): void {
  // Auto-spawn/despawn Ascender pillars to match the current board before we
  // read it (no-op during combat). This is the shared post-board-change hook.
  reconcileAscenderPillars()

  // Count unique species per trait, player team only.
  // During combat read from combatState so auto-generated boards (empty-board
  // starts) show their traits too; otherwise from the placed bench.
  const source: Iterable<Unit> = combatState
    ? combatState.units.values()
    : placedUnits.values()

  const counts = new Map<string, number>()
  const seenDefs = new Set<string>()
  for (const unit of source) {
    if (unit.isDummy || unit.team !== 'player') continue
    if (seenDefs.has(unit.definitionId)) continue
    seenDefs.add(unit.definitionId)
    for (const t of unit.types) {
      if (NON_DISPLAY_TRAITS.has(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }

  const sorted = counts.size > 0 ? sortTraitEntries(counts) : []
  setTraitList('active-traits', sorted)
  setTraitList('trait-overlay-inner', sorted)

  const overlay = overlayModeActive()
  document.getElementById('active-traits')!.style.display = overlay ? 'none' : ''
  document.getElementById('trait-overlay')!.style.display = overlay ? 'block' : 'none'
}

function renderTerrainIndicator(): void {
  const el   = document.getElementById('terrain-indicator')!
  const dot  = document.getElementById('terrain-indicator-dot')!
  const name = document.getElementById('terrain-indicator-name')!

  const terrain = combatState?.terrain ?? null
  const label   = terrain ? activeTerrainLabel(terrain) : null
  const color   = terrain ? activeTerrainPulseColor(terrain) : null

  if (label && color) {
    el.style.display     = 'flex'
    dot.style.background = color
    dot.style.boxShadow  = `0 0 6px ${color}`
    name.style.color     = color
    name.textContent     = label
  } else {
    el.style.display = 'none'
  }
}

function renderCombatTimer(): void {
  const bar   = document.getElementById('combat-timer-bar')!
  const fill  = document.getElementById('combat-timer-fill')!
  const label = document.getElementById('combat-timer-label')!
  if (!combatState) {
    bar.style.display = 'none'
    return
  }
  bar.style.display = 'block'
  const tick     = combatState.tick
  const overtime = tick >= 1800

  // Each phase counts down from 1800 ticks (30s); overtime resets and drains at 2x real speed
  const phaseTick = overtime ? tick - 1800 : tick
  const remaining = Math.max(0, 1 - phaseTick / 1800)  // 1.0 → 0.0

  fill.style.width = `${remaining * 100}%`

  let barColor: string
  if (overtime) {
    barColor = '#ff3333'
  } else if (remaining > 0.5) {
    barColor = '#44cc44'
  } else if (remaining > 0.2) {
    barColor = '#ffcc00'
  } else {
    barColor = '#ff3333'
  }
  fill.style.background = barColor

  const secsLeft = overtime
    ? Math.ceil((3600 - tick) / TICK_RATE)
    : Math.ceil((1800 - tick) / TICK_RATE)
  label.textContent = `${Math.max(0, secsLeft)}`
  label.style.color = overtime ? '#ff9966' : '#ffffff'
}

// Planning-phase deadline: mirrors renderCombatTimer's look. Ticks down from
// PLANNING_TIME_LIMIT_MS and calls startCombat() once when it hits zero —
// purely a UI/wall-clock countdown, it never drives bot logic (bots already
// planned their round once in resolveBotRound right when planning began).
function renderPlanningTimer(): void {
  const bar   = document.getElementById('planning-timer-bar')!
  const fill  = document.getElementById('planning-timer-fill')!
  const label = document.getElementById('planning-timer-label')!

  // In a lobby the ROOM owns the countdown and fires resolution itself. A
  // local timer here would run its own startCombat() and fork this client's
  // game state away from the server's. Plan 04-05 replaces this guard with
  // the real server-driven countdown rendered from the `phase` message's
  // absolute deadline.
  if (isNetworked()) {
    bar.style.display = 'none'
    return
  }

  if (planningTimerStartTs === null || combatState || econPhase !== 'planning') {
    bar.style.display = 'none'
    return
  }

  const elapsedMs = performance.now() - planningTimerStartTs
  if (elapsedMs >= PLANNING_TIME_LIMIT_MS) {
    bar.style.display = 'none'
    planningTimerStartTs = null   // clear first — startCombat re-derives everything from econ state
    startCombat()
    return
  }

  bar.style.display = 'block'
  const remaining = Math.max(0, 1 - elapsedMs / PLANNING_TIME_LIMIT_MS)
  fill.style.width = `${remaining * 100}%`
  fill.style.background = remaining > 0.5 ? '#44cc44' : remaining > 0.2 ? '#ffcc00' : '#ff3333'
  label.textContent = `${Math.max(0, Math.ceil((PLANNING_TIME_LIMIT_MS - elapsedMs) / 1000))}`
}

function renderSunEffect(): void {
  const el = document.getElementById('sun-effect') as HTMLImageElement
  const sunny = combatState?.terrain.sunny ?? false
  if (!sunny) {
    el.style.display = 'none'
    return
  }
  // Position just outside the upper-left corner of the board field.
  // The board canvas sits at (boardOffsetX, boardOffsetY) within canvas-wrap;
  // hex (0,0) center is at roughly (54, 43) within that canvas, so the boundary
  // corner is near (boardOffsetX, boardOffsetY). Place the icon centered there.
  const size = 94
  el.style.left    = `${boardOffsetX - size + 8}px`
  el.style.top     = `${boardOffsetY - size + 8}px`
  el.style.display = 'block'
}

function renderEnemyTraitDisplay(): void {
  const section = document.getElementById('enemy-traits-section')

  // Hidden during combat — the enemy trait panel is a planning-phase tool;
  // during combat the damage meter (renderDamageMeter) takes the sidebar,
  // and enemy traits remain available via the per-unit hover tooltip.
  if (combatState) {
    if (section) section.style.display = 'none'
    document.getElementById('enemy-trait-overlay')!.style.display = 'none'
    setTraitList('enemy-traits', [])
    setTraitList('enemy-trait-overlay-inner', [])
    return
  }

  const source: Iterable<Unit> = placedUnits.values()

  const counts = new Map<string, number>()
  const seenDefs = new Set<string>()
  for (const unit of source) {
    if (unit.isDummy || unit.team !== 'enemy') continue
    if (seenDefs.has(unit.definitionId)) continue
    seenDefs.add(unit.definitionId)
    for (const t of unit.types) {
      if (NON_DISPLAY_TRAITS.has(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }

  const overlay = overlayModeActive()
  document.getElementById('enemy-trait-overlay')!.style.display = (overlay && counts.size > 0) ? 'block' : 'none'

  if (counts.size === 0) {
    if (section) section.style.display = 'none'
    setTraitList('enemy-traits', [])
    setTraitList('enemy-trait-overlay-inner', [])
    return
  }

  const sorted = sortTraitEntries(counts)
  if (section) section.style.display = overlay ? 'none' : ''
  setTraitList('enemy-traits', sorted)
  setTraitList('enemy-trait-overlay-inner', sorted)
}

// ─── Live damage meter ──────────────────────────────────────────────────────
// Per-unit stacked bars for the player's own team, live during combat (and
// playback — Unit.dmgDealt/dmgTaken round-trip through FightFrame the same
// way position/HP do). Dealt: physical red, magic blue, true white. Taken:
// physical dark red, magic dark blue, true white. Sorted by total dealt,
// matching the reference layout the user is replicating.
type DmgColorMap = { physical: string; magic: string; true: string }
const DMG_DEALT_COLOR: DmgColorMap = { physical: '#e04444', magic: '#4477e0', true: '#e8e8e8' }
const DMG_TAKEN_COLOR: DmgColorMap = { physical: '#7a1f1f', magic: '#1f2f7a', true: '#e8e8e8' }

// Leaderboard-style bar: overall length is this row's share of the row with
// the highest total (so units compare at a glance, not just self-composition),
// and the filled portion is itself split by damage type (physical/magic/true)
// in proportion to how much of this unit's total each type contributed. The
// number is overlaid on the bar, matching the reference layout.
// One persistent row's element refs, built once per unit id and reused every
// render — reusing the SAME bar-fill element across renders is what lets the
// CSS width transition below actually animate (a freshly created element has
// no "previous width" to animate from; innerHTML-per-frame would only ever
// show the final state).
interface DamageMeterRow {
  el: HTMLElement
  fill: HTMLElement
  segs: Record<'physical' | 'magic' | 'true', HTMLElement>
}

// Separate row maps per stat — switching Dealt/Taken keeps each its own set
// of persistent elements (and therefore its own running CSS transition state)
// instead of repurposing one row's bar for two different meanings.
const damageMeterRows: Record<'dealt' | 'taken', Map<string, DamageMeterRow>> = { dealt: new Map(), taken: new Map() }
let damageMeterTeam: 'player' | 'enemy' = 'player'
let damageMeterStat: 'dealt' | 'taken' = 'dealt'
let damageMeterCollapsed = false

const DMG_BAR_HEIGHT = 12   // thin bar, per reference layout

function updateBarFill(row: DamageMeterRow, dmg: { physical: number; magic: number; true: number }, maxTotal: number): void {
  const total = dmg.physical + dmg.magic + dmg.true
  const barPct = maxTotal > 0 ? Math.max(total > 0 ? 3 : 0, total / maxTotal * 100) : 0
  row.fill.style.width = `${barPct.toFixed(2)}%`
  for (const k of ['physical', 'magic', 'true'] as const) {
    row.segs[k].style.width = total > 0 ? `${(dmg[k] / total * 100).toFixed(2)}%` : '0%'
  }
  ;(row.el.querySelector('.dmg-num') as HTMLElement).textContent = String(Math.round(total))
}

function getOrCreateDamageMeterRow(u: Unit, stat: 'dealt' | 'taken'): DamageMeterRow {
  const map = damageMeterRows[stat]
  const existing = map.get(u.id)
  if (existing) return existing

  const def = UNIT_MAP.get(u.definitionId)
  const name = def?.name ?? u.definitionId
  const stars = '★'.repeat(u.tier)
  const colors = stat === 'dealt' ? DMG_DEALT_COLOR : DMG_TAKEN_COLOR

  const el = document.createElement('div')
  el.style.marginBottom = '6px'
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
      <img src="${def?.spritePath ?? ''}" style="width:18px;height:18px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;" onerror="this.style.display='none'">
      <span style="font-size:10px;color:#aabbdd;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>
      <span style="font-size:9px;color:#dd9;flex-shrink:0;">${stars}</span>
    </div>
    <div style="height:${DMG_BAR_HEIGHT}px;background:#1a1e2a;border-radius:3px;overflow:hidden;position:relative;">
      <div class="dmg-fill" style="width:0%;height:100%;display:flex;transition:width 0.25s ease;">
        <div class="dmg-seg-physical" style="width:0%;height:100%;background:${colors.physical};transition:width 0.25s ease;"></div>
        <div class="dmg-seg-magic" style="width:0%;height:100%;background:${colors.magic};transition:width 0.25s ease;"></div>
        <div class="dmg-seg-true" style="width:0%;height:100%;background:${colors.true};transition:width 0.25s ease;"></div>
      </div>
      <span class="dmg-num" style="position:absolute;left:5px;top:50%;transform:translateY(-50%);font-size:9px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.9);font-weight:600;"></span>
    </div>`

  const row: DamageMeterRow = {
    el,
    fill: el.querySelector('.dmg-fill') as HTMLElement,
    segs: {
      physical: el.querySelector('.dmg-seg-physical') as HTMLElement,
      magic: el.querySelector('.dmg-seg-magic') as HTMLElement,
      true: el.querySelector('.dmg-seg-true') as HTMLElement,
    },
  }
  map.set(u.id, row)
  return row
}

function renderDamageMeter(): void {
  const section = document.getElementById('damage-meter-section')
  if (!section) return

  if (!combatState) {
    section.style.display = 'none'
    // Next combat starts with fresh rows, fresh bars — detach elements too,
    // not just the Map bookkeeping (clear() alone would leave orphaned rows
    // sitting in `body`, waiting to be found by the next render's cleanup).
    for (const row of damageMeterRows.dealt.values()) row.el.remove()
    for (const row of damageMeterRows.taken.values()) row.el.remove()
    damageMeterRows.dealt.clear()
    damageMeterRows.taken.clear()
    return
  }

  const allUnits = [...combatState.units.values()].filter(u => !u.isDummy)
  if (allUnits.length === 0) {
    section.style.display = 'none'
    return
  }
  section.style.display = 'block'

  // Tab styling reflects the active selection every render, not just on
  // click — keeps it correct even if renderDamageMeter runs before the click
  // handlers below have wired the initial state into the DOM.
  const mineTab = document.getElementById('dmg-meter-tab-mine')!
  const enemyTab = document.getElementById('dmg-meter-tab-enemy')!
  mineTab.style.background = damageMeterTeam === 'player' ? '#3a5ca0' : 'transparent'
  mineTab.style.color = damageMeterTeam === 'player' ? '#fff' : '#889'
  enemyTab.style.background = damageMeterTeam === 'enemy' ? '#a03a3a' : 'transparent'
  enemyTab.style.color = damageMeterTeam === 'enemy' ? '#fff' : '#889'

  const dealtTab = document.getElementById('dmg-meter-stat-dealt')!
  const takenTab = document.getElementById('dmg-meter-stat-taken')!
  dealtTab.style.background = damageMeterStat === 'dealt' ? '#555' : 'transparent'
  dealtTab.style.color = damageMeterStat === 'dealt' ? '#fff' : '#889'
  takenTab.style.background = damageMeterStat === 'taken' ? '#555' : 'transparent'
  takenTab.style.color = damageMeterStat === 'taken' ? '#fff' : '#889'

  const body = document.getElementById('damage-meter')!
  document.getElementById('dmg-meter-collapse')!.textContent = damageMeterCollapsed ? '▸' : '▾'
  body.style.display = damageMeterCollapsed ? 'none' : 'block'
  if (damageMeterCollapsed) return

  const units = allUnits.filter(u => u.team === damageMeterTeam)
  if (units.length === 0) {
    body.innerHTML = `<div style="font-size:9px;color:#556;">No ${damageMeterTeam === 'player' ? 'ally' : 'enemy'} units.</div>`
    return
  }

  const statOf = (u: Unit) => damageMeterStat === 'dealt' ? u.dmgDealt : u.dmgTaken
  const totalOf = (u: Unit) => { const d = statOf(u); return d.physical + d.magic + d.true }
  const sorted = [...units].sort((a, b) => totalOf(b) - totalOf(a))
  const max = Math.max(1, ...sorted.map(totalOf))

  // Drop rows for units no longer in this list (switched tabs, unit removed,
  // or — the common case — a new round started with a fresh set of unit ids
  // and the previous round's rows are now stale). Removing from the Map
  // alone isn't enough: the row's element stays in `body` until explicitly
  // detached, so a pruned-but-still-mounted row would sit frozen at last
  // round's numbers, and eventually pile up as visible stale entries.
  const map = damageMeterRows[damageMeterStat]
  const liveIds = new Set(sorted.map(u => u.id))
  for (const [id, row] of map) {
    if (!liveIds.has(id)) { row.el.remove(); map.delete(id) }
  }

  // Detach any element still sitting in `body` that doesn't belong to the
  // currently active stat's map — e.g. the Dealt rows, left mounted after
  // switching to the Taken tab (each stat has its own separate row set; a
  // tab switch doesn't touch the other stat's elements otherwise).
  const activeEls = new Set([...map.values()].map(r => r.el))
  for (const child of [...body.children]) {
    if (!activeEls.has(child as HTMLElement)) child.remove()
  }

  // Reorder is instant (no slide animation — a getBoundingClientRect-based
  // FLIP version forced a layout read/write per row per tick and was
  // noticeably laggy at combat tick rate). Bar width/number still animate
  // via updateBarFill's CSS transition, which is cheap (no layout reads).
  for (const u of sorted) {
    const row = getOrCreateDamageMeterRow(u, damageMeterStat)
    updateBarFill(row, statOf(u), max)
    body.appendChild(row.el)   // moves if already present — sets the new order
  }
}

// ─── Power delta display ───────────────────────────────────────────────────────

let lastPowerDelta: number | null = null
let lastWinProb:    number | null = null

// Battle pending calibration feedback — captured at combat start, resolved at combat end
interface PendingBattle {
  pf: BoardFeat
  ef: BoardFeat
  rawDelta: number
  predWin: number
  unitIds: Set<string>   // starting combat units (summons/cliffs excluded from margin)
}
let pendingBattle: PendingBattle | null = null
let calibParams: CalibParams = loadCalibration()

function renderPowerDelta(): void {
  const el = document.getElementById('power-delta')
  if (!el) return
  // Win chance / power delta is a testing aid, not a real-game feature — hide
  // it during economy mode so a real match doesn't spoil its own outcome.
  // Calibration recording (predictWinProb / recordAndLearn) is unaffected;
  // only this display is gated.
  if (econActive() || lastPowerDelta === null) {
    el.style.display = 'none'
    el.textContent = ''
    return
  }
  const sign = lastPowerDelta >= 0 ? '+' : ''
  const pct  = (lastPowerDelta * 100).toFixed(1)
  el.style.display = 'block'
  if (lastWinProb !== null) {
    // Calibrated prediction up front, raw power delta in parentheses
    const winPct = Math.round(lastWinProb * 100)
    el.style.color = lastWinProb >= 0.5 ? '#55cc55' : '#ff5555'
    el.textContent = `Win chance ${winPct}% (enemy ${sign}${pct}%)`
  } else {
    const label = lastPowerDelta >= 0 ? 'Enemy stronger' : 'Enemy weaker'
    el.style.color   = lastPowerDelta >= 0 ? '#ff5555' : '#55cc55'
    el.textContent   = `${label} (${sign}${pct}%)`
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function renderRoster() {
  const roster = document.getElementById('unit-roster')!
  const query  = rosterSearch.toLowerCase()

  // Build trait groups
  const groups = new Map<string, typeof ALL_UNITS>()
  for (const def of ALL_UNITS) {
    if (def.isDummy) continue
    if (query && !def.name.toLowerCase().includes(query) && !def.types.join(' ').toLowerCase().includes(query)) continue
    const trait = def.types[0] ?? 'other'
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
  const scenario: TestScenario = { label, units }
  const snaps = loadSnapshots()
  snaps.push(scenario)
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
  const query   = ((document.getElementById('test-search') as HTMLInputElement)?.value ?? '').toLowerCase().trim()
  const repoEl  = document.getElementById('test-buttons-repo')!
  const savedEl = document.getElementById('test-buttons-saved')!

  // ── Repo tests (read-only, from git) ──────────────────────────────────────
  const filteredRepo = REPO_TESTS.filter(s => !query || s.label.toLowerCase().includes(query))
  repoEl.innerHTML = filteredRepo.length === 0
    ? `<div style="font-size:10px;color:#445;font-style:italic;padding:2px 0;">${query ? 'No matches' : 'None'}</div>`
    : filteredRepo.map((s, i) => `
        <button data-repo="${i}" style="
          display:block; width:100%; margin-bottom:4px; padding:5px 8px;
          background:#0e1818; border:1px solid #253;
          color:#88ddaa; cursor:pointer; border-radius:4px;
          font-size:11px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        ">${s.label}</button>
      `).join('')
  repoEl.querySelectorAll('[data-repo]').forEach(btn => {
    btn.addEventListener('click', () => {
      loadScenario(filteredRepo[parseInt((btn as HTMLElement).dataset.repo!)])
    })
  })

  // ── Local tests (localStorage, saveable/deleteable) ───────────────────────
  const snapshots    = loadSnapshots()
  // Reverse so most-recently saved appears first; keep original index for delete
  const reversedSnapshots = snapshots.map((s, i) => ({ s, i })).reverse()
  const filteredLocal = query
    ? reversedSnapshots.filter(({ s }) => s.label.toLowerCase().includes(query))
    : reversedSnapshots

  if (snapshots.length === 0) {
    savedEl.innerHTML = `<div style="font-size:10px;color:#445;font-style:italic;padding:2px 0;">No local tests yet</div>`
    return
  }
  if (filteredLocal.length === 0) {
    savedEl.innerHTML = `<div style="font-size:10px;color:#445;font-style:italic;padding:2px 0;">No matches</div>`
    return
  }

  savedEl.innerHTML = filteredLocal.map(({ s, i }) => `
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

function getAscenderLevel(): number {
  const species = new Set(
    [...placedUnits.values()]
      .filter(u => u.team === 'player' && u.types.includes('ascender'))
      .map(u => u.definitionId)
  )
  return species.size >= 4 ? 4 : species.size >= 2 ? 2 : 0
}

function renderDummyButtons(): void {
  const container = document.getElementById('dummy-buttons')!
  const btnStyle = `padding: 4px 7px; background: #1a1a2a; border: 1px solid #446;
    color: #99aabb; cursor: pointer; border-radius: 4px; font-size: 10px;`

  const tiers: Array<{ tier: 1|2|3; label: string }> = [
    { tier: 1, label: 'Low (1500 HP)'  },
    { tier: 2, label: 'Mid (2700 HP)'  },
    { tier: 3, label: 'High (4860 HP)' },
  ]
  const attackers: Array<{ unitId: string; label: string; tier: 1|2|3 }> = [
    { unitId: 'dummy_melee',  label: 'Melee ★',    tier: 1 },
    { unitId: 'dummy_melee',  label: 'Melee ★★',   tier: 2 },
    { unitId: 'dummy_melee',  label: 'Melee ★★★',  tier: 3 },
    { unitId: 'dummy_ranged', label: 'Ranged ★',   tier: 1 },
    { unitId: 'dummy_ranged', label: 'Ranged ★★',  tier: 2 },
    { unitId: 'dummy_ranged', label: 'Ranged ★★★', tier: 3 },
  ]

  // Ascender pillars (cliffs) are no longer placed by hand — they auto-spawn
  // and reposition via reconcileAscenderPillars during planning.
  container.innerHTML =
    tiers.map(t => `<button data-dummy-tier="${t.tier}" style="${btnStyle}">${t.label}</button>`).join('') +
    attackers.map(a => `<button data-dummy-unit="${a.unitId}" data-dummy-atk-tier="${a.tier}" style="${btnStyle}">${a.label}</button>`).join('')

  container.querySelectorAll('[data-dummy-tier]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = parseInt((btn as HTMLElement).dataset.dummyTier!) as 1|2|3
      selectedUnitId = 'dummy'
      selectedTier   = tier
      renderRoster()
    })
  })

  container.querySelectorAll('[data-dummy-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement
      selectedUnitId = el.dataset.dummyUnit!
      selectedTier   = parseInt(el.dataset.dummyAtkTier!) as 1|2|3
      renderRoster()
    })
  })
}
// ─── Placed units (player's board) ────────────────────────────────────────────

// Declared ahead of the section below because renderTraitDisplay reads it and
// runs once at module init (before the "Combat state" section executes)
let combatState: CombatState | null = null

const placedUnits = new Map<string, Unit>()  // hexId → unit
let placementCounter = 0                      // increments each time a unit is placed
renderTraitDisplay()
renderDummyButtons()

function getPlacedUnitsArray(): Unit[] {
  return [...placedUnits.values()]
}

function placeUnit(hex: OffsetCoord): void {
  if (!selectedUnitId) return
  if (econActive()) return   // economy mode places units via the bench, not the roster
  const testMode = (document.getElementById('chk-test-mode') as HTMLInputElement).checked

  // Normal mode: player units only on rows 4–7
  // Test mode: any unit on any row; row determines team
  if (!testMode && ![4, 5, 6, 7].includes(hex.row)) return

  const key  = hexId(hex)
  const team = hex.row <= 3 ? 'enemy' : 'player'
  const unit = makeUnit(selectedUnitId, team, selectedTier)
  unit.hexPos = { ...hex }
  unit.visualPos = hexToPixel(hex, HEX_SIZE)
  unit.placedAt = ++placementCounter
  placedUnits.set(key, unit)
  renderTraitDisplay()
  renderEnemyTraitDisplay()
  renderDamageMeter()
  renderDummyButtons()
}

function removeUnit(hex: OffsetCoord): void {
  placedUnits.delete(hexId(hex))
  renderTraitDisplay()
  renderEnemyTraitDisplay()
  renderDamageMeter()
  renderDummyButtons()
}

// ─── Economy mode (TFT meta systems) ─────────────────────────────────────────
// Normal mode IS economy mode: a persistent run vs 5 bot opponents with gold,
// XP, shop, bench, and combining. Test mode keeps the free placement tools.

let run: RunState = loadRun() ?? newRun(botSeats())
// econPhase itself is declared above resizeCanvases (which reads it and runs
// immediately at module init) — see the "econPhase declared ahead" comment
// near boardOffsetY. Set its real starting value here now that `run` exists.
econPhase = run.gameOver ? 'gameOver' : 'planning'
// The unit currently "picked up" and attached to the cursor (from bench or
// board) — cleared from its source slot immediately on pickup, so the source
// slot renders empty until it's placed somewhere. See heldUnitEl below.
let heldUnit: { definitionId: string; tier: 1 | 2 | 3; item?: string } | null = null
// Where heldUnit was picked up from — if it's placed on top of an occupied
// slot, the displaced unit goes here (a true swap) instead of being attached
// to the cursor itself.
let heldFrom: { kind: 'bench'; slot: number } | { kind: 'board'; hex: OffsetCoord } | null = null
let currentOpponentIndex = -1        // captured at combat start for settlement
let lastSettlementLine = ''
// Snapshot of the human's gold/bench occupancy taken immediately before a
// resolveRound() call — applyRoundResult diffs against these to derive the
// quake-reward summary (crawler count, quake gold) without resolveRound
// reporting rewards per seat. Set by snapshotPreRound(), read once by the
// following applyRoundResult() call.
let preRoundGold = 0
let preRoundBenchOccupied = 0
// The seat this client controls. Single-player leaves this at 0. Phase 3/4
// (room server + client networking) will set this from the room's seat
// assignment once a lobby can host more than one human.
let localSeatIndex = 0

// ─── Networked lobby (Phase 4) ────────────────────────────────────────────────

// Non-null exactly when this tab was opened at `/?lobby=<code>`. Everything
// that must behave differently in a lobby branches on isNetworked(), and the
// solo path is byte-for-byte unchanged whenever this stays null.
let net: RoomClient | null = null

function isNetworked(): boolean { return net !== null }

// True once the socket has dropped or been refused. Input stops here rather
// than silently doing nothing: RoomClient already no-ops a send outside
// 'open', but a click that looks accepted and then never changes anything is
// worse than a click that visibly does nothing behind an explanatory banner.
let netDropped = false

// The connection-status banner. Deliberately appended to document.body and
// NOT to #app: renderEconUI() and updateEconVisibility() rebuild subtrees
// inside #app wholesale, and a banner living in there would be wiped by the
// next re-render — exactly when the player most needs to still see it.
let netStatusEl: HTMLDivElement | null = null

function setNetStatusBanner(text: string | null): void {
  if (netStatusEl === null) {
    if (text === null) return
    const el = document.createElement('div')
    el.id = 'net-status-banner'
    el.style.cssText = [
      'position: fixed', 'top: 12px', 'left: 50%', 'transform: translateX(-50%)',
      'z-index: 9999', 'padding: 8px 16px', 'border-radius: 6px',
      'background: #0a0e1a', 'border: 1px solid #ff6666', 'color: #ff6666',
      'font-family: monospace', 'font-size: 12px', 'letter-spacing: 0.5px',
      'box-shadow: 0 2px 12px rgba(0,0,0,0.6)', 'pointer-events: none',
      'transition: opacity 0.3s ease',
    ].join('; ')
    document.body.appendChild(el)
    netStatusEl = el
  }
  if (text === null) {
    netStatusEl.style.opacity = '0'
    netStatusEl.style.display = 'none'
    return
  }
  netStatusEl.textContent = text
  netStatusEl.style.display = 'block'
  netStatusEl.style.opacity = '1'
}

// Every saveRun call site in this file funnels through this wrapper rather
// than the imported one. In a networked session the RunState on screen is the
// SERVER's, and writing it to localStorage would overwrite the player's own
// solo save — so the write is skipped wholesale here, once, instead of being
// audited across ~24 call sites (a count plans 04-03/04-04 only grow).
function saveRun(state: RunState): void {
  if (isNetworked()) return
  persistRunToStorage(state)
}

// Adopts a server-owned RunState wholesale and re-renders from it.
//
// Deliberately does NOT call saveRun: this state belongs to the room, not to
// this browser, and persisting it would clobber the player's solo run. (The
// wrapper above would refuse the write anyway — this is the second lock on
// the same door, and the reason the function body has no persistence step at
// all.)
function applyServerSnapshot(snapshot: RunState): void {
  run = snapshot
  syncRunToBoard()
  renderEconUI()
  renderTraitDisplay()
}

// `opts.isHost` is a UI HINT ONLY — it decides which control the Lobby Screen
// renders, nothing more. The server independently resolves the acting seat
// from the sender's connection identity and rejects a `start` from any seat
// but 0 with 'not-host' (party/lobby.ts), so a guest that forced the button
// into existence in devtools would still be refused. This flag is never the
// authority; it is a guess the welcome frame below then corrects.
function bootNetworked(code: string, opts: { isHost: boolean }): void {
  const shareUrl = shareableLobbyUrl(location.origin, code)
  let isHost = opts.isHost

  // Shown BEFORE connecting, so the host has a link to copy during the
  // handshake rather than after it, and a guest opening a link never sees a
  // blank page while the socket comes up.
  showLobbyScreen({ shareUrl, isHost, onStart: () => net?.sendStart() })

  const client = new RoomClient({
    host: partyHost(),
    // Already validated against LOBBY_CODE_ALPHABET by parseLobbyCode before
    // reaching here (T-04-02), so it is safe as a room name.
    room: code,
    // Cosmetic only. party/seats.ts's sanitizeDisplayName is the trust
    // boundary on the far side of this, and src/ui/lobbyScreen.ts escapes
    // whatever comes back regardless of what any client sent.
    name: pickGuestName(),
  })
  net = client

  client.onMessage(m => {
    if (m.t === 'welcome') {
      // The server is the sole seat authority — this client renders whatever
      // seat it was given, it never picks one.
      localSeatIndex = m.seat
      applyServerSnapshot(m.snapshot)
      updateLobbyScreen({ seats: m.lobby, localSeat: m.seat })

      // Correct the hint from the server's answer. This is what makes a HOST
      // REFRESH work: that tab re-enters through the `?lobby=` boot branch,
      // which cannot know it created the room, so it starts as a guest and is
      // promoted here when the room hands seat 0 back to it.
      if ((m.seat === 0) !== isHost) {
        isHost = m.seat === 0
        showLobbyScreen({ shareUrl, isHost, onStart: () => net?.sendStart() })
        updateLobbyScreen({ seats: m.lobby, localSeat: m.seat })
      }

      // Joining a room whose round loop is already running: there is nothing
      // to wait for, so skip the Lobby Screen entirely rather than showing a
      // Start button for a game that has already started.
      if (m.phase !== 'lobby') {
        hideLobbyScreen()
        econPhase = 'planning'
        updateEconVisibility()
      }
    } else if (m.t === 'snapshot') {
      applyServerSnapshot(m.snapshot)
    } else if (m.t === 'lobby') {
      // The live "Current players" list. party/lobby.ts broadcasts a fresh
      // view on BOTH connect and close, and lobbyView derives `human` from
      // live occupancy — so this is equally what makes a friend appear when
      // they join and disappear when they drop, with no client-side polling.
      updateLobbyScreen({ seats: m.lobby, localSeat: localSeatIndex })
    } else if (m.t === 'phase' && m.phase === 'planning') {
      // THE single dismissal path for both clients. Neither tab leaves the
      // lobby on a local click — the host's Start only sends a frame; both
      // tabs leave on the server's broadcast, which is exactly what keeps
      // host and guest in step.
      hideLobbyScreen()
      econPhase = 'planning'
      updateEconVisibility()
    }
  })

  client.onStatus((status, reason) => {
    if (status === 'closed') {
      netDropped = true
      setNetStatusBanner('Lobby connection lost — reload the page to rejoin.')
    } else if (status === 'rejected' && reason === 'not-seated') {
      netDropped = true
      setNetStatusBanner('This lobby is full — every seat is already taken.')
      // The Lobby Screen deliberately STAYS UP with an explanation on it.
      // Falling through to the solo game would silently drop this player into
      // a different game than the one they were invited to, and a blank
      // screen explains nothing. Spectating a full lobby is explicitly v2
      // (HARD-03), so a clear refusal is the correct terminal state.
      setLobbyMessage(
        'This lobby is full — every seat is already taken. '
        + 'Ask your friend to start a new one, or reload to try again.',
      )
    }
    // Critically, neither branch clears `run`, clears placedUnits, or
    // re-renders from an empty state. The LAST SERVER SNAPSHOT stays exactly
    // as it is on screen: a frozen but correct board is the right failure
    // mode, and reconnect/resync is explicitly v2 (HARD-01).
  })

  client.connect()
}

function econActive(): boolean {
  const chk = document.getElementById('chk-test-mode') as HTMLInputElement | null
  return chk ? !chk.checked : false
}

// Test mode always shows traits as a floating overlay on the canvas (no boxed
// sidebar section) — the same treatment economy mode only uses during actual
// combat, when the sidebars are hidden. Test mode keeps its sidebars (unit
// roster, dummy/test tools) visible at all times; only the trait boxes swap
// for the overlay.
// Trait badges render as the on-canvas overlay in economy mode (the play view
// has no left sidebar to put them in) and as boxed sidebar sections in test
// mode (the dev view keeps both sidebars up, combat or not).
function overlayModeActive(): boolean {
  return econActive()
}

function humanEcon(): PlayerEcon { return run.players[localSeatIndex] }

function playerBoardUnitCount(): number {
  let n = 0
  for (const u of placedUnits.values()) if (u.team === 'player' && !u.isDummy) n++
  return n
}

// placedUnits is the live source of truth during planning; run.board is the
// serialized form. Sync both ways at the phase boundaries.
function syncBoardToRun(): void {
  humanEcon().board = [...placedUnits.values()]
    .filter(u => u.team === 'player' && !u.isDummy)
    .map(u => ({ definitionId: u.definitionId, tier: u.tier as 1 | 2 | 3, hexPos: { ...u.hexPos }, item: u.items[0] }))
}

// The open player-half hex nearest the bottom-left corner, or null if the
// player half is full. Player rows are 4–7; (col 0, row 7) is bottom-left.
function closestOpenPlayerHexToBottomLeft(): OffsetCoord | null {
  const anchorCol = 0
  const anchorRow = BOARD_ROWS - 1
  let best: OffsetCoord | null = null
  let bestDist = Infinity
  for (const row of BoardLayer.PLAYER_ROWS) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (placedUnits.has(hexId({ col, row }))) continue
      const dc = col - anchorCol
      const dr = row - anchorRow
      const dist = dc * dc + dr * dr
      if (dist < bestDist) { bestDist = dist; best = { col, row } }
    }
  }
  return best
}

// ─── Ascender pillars (cliffs) ────────────────────────────────────────────────
function isCliffId(id: string): boolean { return id === 'cliff_l' || id === 'cliff_r' }

// Open player-half hex nearest `anchor` (BFS by hex distance), or null if none.
function nearestOpenPlayerHex(anchor: OffsetCoord): OffsetCoord | null {
  let best: OffsetCoord | null = null
  let bestDist = Infinity
  for (const row of BoardLayer.PLAYER_ROWS) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (placedUnits.has(hexId({ col, row }))) continue
      const d = hexDistance({ col, row }, anchor)
      if (d < bestDist) { bestDist = d; best = { col, row } }
    }
  }
  return best
}

function spawnCliff(defId: string, anchor: OffsetCoord): void {
  // Prefer an open hex directly adjacent to the ascender, else the nearest open
  // player hex (so a pillar always appears even on a crowded board).
  const adj = getNeighbors(anchor).find(h =>
    isValidHex(h) && BoardLayer.PLAYER_ROWS.includes(h.row) && !placedUnits.has(hexId(h)))
  const hex = adj ?? nearestOpenPlayerHex(anchor)
  if (!hex) return
  const cliff = makeUnit(defId, 'player', 1)
  cliff.hexPos = { ...hex }
  cliff.visualPos = hexToPixel(cliff.hexPos, HEX_SIZE)
  placedUnits.set(hexId(hex), cliff)
}

// Last known hex for each Ascender pillar, remembered on the human's run state so a
// pillar re-appears where it sat last phase — surviving both the board rebuild between
// planning phases (placedUnits is cleared by syncRunToBoard) AND a page reload (it
// serializes with the run).
function cliffPosStore(): Record<string, OffsetCoord> {
  const h = humanEcon()
  if (!h.cliffPositions) h.cliffPositions = {}
  return h.cliffPositions
}

// Restore a pillar at its remembered hex if that hex is still a free player hex;
// otherwise fall back to spawning next to the ascender.
function restoreOrSpawnCliff(defId: string, anchor: OffsetCoord): void {
  const saved = cliffPosStore()[defId]
  if (saved && isValidHex(saved) && BoardLayer.PLAYER_ROWS.includes(saved.row) && !placedUnits.has(hexId(saved))) {
    const cliff = makeUnit(defId, 'player', 1)
    cliff.hexPos = { ...saved }
    cliff.visualPos = hexToPixel(cliff.hexPos, HEX_SIZE)
    placedUnits.set(hexId(saved), cliff)
    return
  }
  spawnCliff(defId, anchor)
}

// Keep the player's Ascender pillars in sync with the trait during planning.
// (2)→1 pillar (cliff_L), (4)→2 pillars (cliff_L + cliff_R). Pillars auto-spawn
// next to an ascender unit, despawn the instant the trait deactivates, and are
// never placed by hand. No-op during combat (placedUnits isn't the live board).
function reconcileAscenderPillars(): void {
  if (combatState) return

  const level = getAscenderLevel()
  const desired: string[] = level >= 4 ? ['cliff_l', 'cliff_r'] : level >= 2 ? ['cliff_l'] : []

  // Remove any pillar whose variant isn't wanted (level dropped, or an extra R).
  const present = new Map<string, OffsetCoord>()
  for (const [key, u] of [...placedUnits.entries()]) {
    if (u.team !== 'player' || !isCliffId(u.definitionId)) continue
    if (!desired.includes(u.definitionId) || present.has(u.definitionId)) {
      placedUnits.delete(key)   // unwanted variant or a duplicate
    } else {
      present.set(u.definitionId, u.hexPos)
      cliffPosStore()[u.definitionId] = { ...u.hexPos }   // remember for next phase
    }
  }

  // Restore any missing variant at its remembered hex, else spawn next to an ascender.
  const missing = desired.filter(id => !present.has(id))
  if (missing.length === 0) return
  const ascender = [...placedUnits.values()].find(u => u.team === 'player' && u.types.includes('ascender'))
  if (!ascender) return   // shouldn't happen (level>=2 implies an ascender exists)
  for (const id of missing) {
    restoreOrSpawnCliff(id, ascender.hexPos)
    const placed = [...placedUnits.values()].find(u => u.definitionId === id)
    if (placed) cliffPosStore()[id] = { ...placed.hexPos }   // record the restored/spawned hex
  }
}

// If the player is a higher level than the number of units they've fielded and
// still has bench units, auto-field the leftmost bench units — each into the
// open hex nearest the bottom-left — until the board is full for their level or
// the bench/board runs out. Runs once at combat start (economy mode) so a
// player who forgot to place up to their level still fights at full strength.
function autoFieldFromBench(): void {
  const h = humanEcon()
  while (playerBoardUnitCount() < h.level) {
    const slot = h.bench.findIndex(b => b !== null)
    if (slot === -1) break                 // bench empty
    const hex = closestOpenPlayerHexToBottomLeft()
    if (!hex) break                        // player half full
    const entry = h.bench[slot]!
    const unit = makeUnit(entry.definitionId, 'player', entry.tier)
    unit.hexPos = { ...hex }
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
    placedUnits.set(hexId(hex), unit)
    h.bench[slot] = null
  }
}

function syncRunToBoard(): void {
  placedUnits.clear()
  for (const e of humanEcon().board) {
    const unit = makeUnit(e.definitionId, 'player', e.tier)
    unit.hexPos = { ...e.hexPos }
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
    unit.placedAt = ++placementCounter
    if (e.item) unit.items = [e.item]
    placedUnits.set(hexId(unit.hexPos), unit)
  }
}

// Fresh runs start "post stage 1": everyone gets a small stake and the bots
// take their first shopping turn so round 1 isn't six empty boards.
function initFreshRun(): void {
  for (const p of run.players) p.gold = 5
  // Two ascending passes, not one merged pass: every human shop roll must draw
  // from the shared pool before any bot purchase, matching today's draw order.
  for (const p of run.players) {
    if (p.personaId === null) rollShop(p, run.pool)
  }
  for (const p of run.players) {
    if (p.personaId !== null) botPlanRound(run, p, 0)
  }
  // Announce round 1's matchup per seat, the same pairing call resolveRound
  // uses to announce every later round — so the Vs {name} indicator has
  // something to read before the very first planning phase.
  const pairings = pairSeats(run, roundSeedFor(run))
  for (const p of run.players) p.nextOpponent = -1
  for (const pair of pairings) {
    run.players[pair.a].nextOpponent = pair.b
    if (pair.b !== -1) run.players[pair.b].nextOpponent = pair.a
  }
  saveRun(run)
}

function isFreshRun(): boolean {
  return run.round === 1 &&
    run.players.every(p => p.board.length === 0 && p.bench.every(b => b === null))
}

// ─── Econ UI renderers ────────────────────────────────────────────────────────

const ECON_BTN = 'padding:5px 8px;background:#1a2a3a;border:1px solid #446;color:#88aacc;cursor:pointer;border-radius:5px;font-size:11px;font-weight:bold;'
const STAR_COLORS: Record<number, string> = { 1: '#b06830', 2: '#9ab0c8', 3: '#d4a017' }

// Gold currency icon — inline so it scales with the surrounding text size.
// `id` is only set for the main HUD icon, which pulses on gold gain/spend.
function goldIconHTML(sizePx = 12, id?: string): string {
  return `<img${id ? ` id="${id}"` : ''} src="/visuals/gui icons/oran_berry.webp" style="width:${sizePx}px;height:${sizePx}px;object-fit:contain;vertical-align:-2px;" onerror="this.style.display='none'">`
}

function starPips(tier: number): string {
  return `<span style="color:${STAR_COLORS[tier]};font-size:9px;letter-spacing:1px;">${'★'.repeat(tier)}</span>`
}

// ─── Held-unit cursor ──────────────────────────────────────────────────────
// A unit "picked up" from the bench or board follows the mouse until placed.
// Rendered at bench-sprite size regardless of where it came from.
const heldUnitEl = document.createElement('img')
heldUnitEl.id = 'held-unit-cursor'
heldUnitEl.style.cssText = `
  position:fixed;left:0;top:0;pointer-events:none;z-index:200;display:none;
  width:${BENCH_SPRITE_W}px;height:${BENCH_SPRITE_H}px;object-fit:contain;image-rendering:pixelated;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,0.6));transform:translate(-50%,-50%);
`
document.body.appendChild(heldUnitEl)

// Tracked independent of whether a unit is currently held, so a pickup
// triggered by a click (which fires no mousemove of its own) can still snap
// the cursor sprite to the right spot immediately instead of rendering at
// wherever it was last left from a previous held unit.
let lastMouseX = 0
let lastMouseY = 0

document.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  if (heldItem) { heldItemEl.style.left = `${e.clientX}px`; heldItemEl.style.top = `${e.clientY}px` }
  if (!heldUnit) return
  heldUnitEl.style.left = `${e.clientX}px`
  heldUnitEl.style.top = `${e.clientY}px`
  updateShopSellHover()
})

function pickUpUnit(definitionId: string, tier: 1 | 2 | 3, from: { kind: 'bench'; slot: number } | { kind: 'board'; hex: OffsetCoord }, item?: string): void {
  heldUnit = { definitionId, tier, item }
  heldFrom = from
  heldUnitEl.src = UNIT_MAP.get(definitionId)?.spritePath ?? ''
  // Toggling display:none → block restarts any CSS animation whose class is
  // still attached — clear a leftover rejection flash so it doesn't replay
  // on a fresh pickup that hasn't been rejected.
  heldUnitEl.classList.remove('held-unit-rejected')
  heldUnitEl.style.left = `${lastMouseX}px`
  heldUnitEl.style.top = `${lastMouseY}px`
  heldUnitEl.style.display = 'block'
}

function dropHeldUnit(): void {
  heldUnit = null
  heldFrom = null
  heldUnitEl.classList.remove('held-unit-rejected', 'held-unit-sell-mode')
  heldUnitEl.style.display = 'none'
  hoveringShopToSell = false
  hideShopSellOverlay()
}

// ─── Held item (cursor) ────────────────────────────────────────────────────
// A bare item picked up from the item bench or removed from a unit (via `r`),
// attached to the cursor until dropped on a unit or back on the item bench.
let heldItem: string | null = null
// The unit the cursor is currently hovering (board or bench), for the `r` remove key.
let hoverUnitRef: { kind: 'board'; hex: OffsetCoord } | { kind: 'bench'; slot: number } | null = null

const heldItemEl = document.createElement('img')
heldItemEl.id = 'held-item-cursor'
heldItemEl.style.cssText = `
  position:fixed;left:0;top:0;pointer-events:none;z-index:201;display:none;
  width:34px;height:34px;object-fit:contain;image-rendering:pixelated;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,0.6));transform:translate(-50%,-50%);
`
document.body.appendChild(heldItemEl)

function pickUpItem(itemId: string): void {
  heldItem = itemId
  heldItemEl.src = ITEM_MAP.get(itemId)?.iconPath ?? ''
  heldItemEl.style.left = `${lastMouseX}px`
  heldItemEl.style.top = `${lastMouseY}px`
  heldItemEl.style.display = 'block'
}

function dropHeldItem(): void {
  heldItem = null
  heldItemEl.style.display = 'none'
}

// Attach the held item to a unit; any item it already had returns to the item
// bench (one item per unit). Returns true if an item was actually placed.
function equipHeldItemOn(unit: Unit): boolean {
  if (!heldItem) return false
  const prev = unit.items[0]
  unit.items = [heldItem]
  if (prev) humanEcon().itemBench.push(prev)
  dropHeldItem()
  return true
}

// ─── Drag-to-sell over the shop bar ────────────────────────────────────────
// Holding a unit and hovering it over the shop bar offers to sell it instead
// of placing it: the shop dims, a "Sell (X)" label appears along its bottom
// edge, and the held sprite flashes grey. Clicking while in this state sells.

const shopSellOverlayEl = document.createElement('div')
shopSellOverlayEl.id = 'shop-sell-overlay'
shopSellOverlayEl.style.cssText = `
  position:fixed;display:none;z-index:150;pointer-events:none;box-sizing:border-box;cursor:pointer;
`
document.body.appendChild(shopSellOverlayEl)
shopSellOverlayEl.addEventListener('click', () => sellHeldUnit())

let hoveringShopToSell = false

function hideShopSellOverlay(): void {
  shopSellOverlayEl.style.display = 'none'
  shopSellOverlayEl.style.pointerEvents = 'none'
  document.getElementById('econ-bar')?.classList.remove('shop-sell-dim')
}

function showShopSellOverlay(rect: DOMRect): void {
  if (!heldUnit) return
  const def = UNIT_MAP.get(heldUnit.definitionId)
  const value = def ? sellValue(def.cost, heldUnit.tier) : 0
  shopSellOverlayEl.style.left   = `${rect.left}px`
  shopSellOverlayEl.style.top    = `${rect.top}px`
  shopSellOverlayEl.style.width  = `${rect.width}px`
  shopSellOverlayEl.style.height = `${rect.height}px`
  // Text sits at the 75% mark — between the box's middle and its bottom edge
  // — via an absolutely-positioned child (top:75% is relative to this
  // element's own height, unlike percentage padding which is not).
  shopSellOverlayEl.innerHTML = `<span style="position:absolute;left:50%;top:75%;transform:translate(-50%,-50%);
    white-space:nowrap;color:#fff;font-weight:bold;font-size:22.5px;font-family:sans-serif;
    text-shadow:0 1px 3px rgba(0,0,0,0.9);background:rgba(40,40,40,0.85);border-radius:16px;
    padding:6px 16px;">Sell (${goldIconHTML(19)} ${value})</span>`
  shopSellOverlayEl.style.display = 'block'
  shopSellOverlayEl.style.pointerEvents = 'auto'
  document.getElementById('econ-bar')?.classList.add('shop-sell-dim')
}

// Checked on every mousemove while a unit is held (see the listener above).
function updateShopSellHover(): void {
  if (!heldUnit) return
  const barEl = document.getElementById('econ-bar')
  const rect = barEl && barEl.offsetParent !== null ? barEl.getBoundingClientRect() : null
  const over = rect !== null &&
    lastMouseX >= rect.left && lastMouseX <= rect.right &&
    lastMouseY >= rect.top && lastMouseY <= rect.bottom
  if (over) {
    if (!hoveringShopToSell) { hoveringShopToSell = true; heldUnitEl.classList.add('held-unit-sell-mode') }
    showShopSellOverlay(rect!)
  } else if (hoveringShopToSell) {
    hoveringShopToSell = false
    heldUnitEl.classList.remove('held-unit-sell-mode')
    hideShopSellOverlay()
  }
}

// Sells the currently-held unit directly (it isn't in any bench/board slot
// while held, so this can't reuse sellFromBench/sellFromBoard).
function sellHeldUnit(): void {
  if (!heldUnit) return
  const def = UNIT_MAP.get(heldUnit.definitionId)
  if (def) {
    const h = humanEcon()
    h.gold += sellValue(def.cost, heldUnit.tier)
    run.pool[heldUnit.definitionId] = (run.pool[heldUnit.definitionId] ?? 0) + copiesHeld(heldUnit.tier)
    if (heldUnit.item) h.itemBench.push(heldUnit.item)   // sold-while-held: item returns to the item bench
  }
  dropHeldUnit()
  saveRun(run)
  renderEconUI()
}

// A unit displaced by placing the held unit on top of it goes back to
// wherever the held unit was originally picked up from (a true swap) —
// creates a live board Unit if that origin was a hex, or a plain bench entry.
function placeDisplacedUnitAtOrigin(occupant: { definitionId: string; tier: 1 | 2 | 3; item?: string }, origin: { kind: 'bench'; slot: number } | { kind: 'board'; hex: OffsetCoord }): void {
  const h = humanEcon()
  if (origin.kind === 'bench') {
    h.bench[origin.slot] = { ...occupant }
  } else {
    const unit = makeUnit(occupant.definitionId, 'player', occupant.tier)
    unit.hexPos = { ...origin.hex }
    unit.visualPos = hexToPixel(origin.hex, HEX_SIZE)
    unit.placedAt = ++placementCounter
    if (occupant.item) unit.items = [occupant.item]
    placedUnits.set(hexId(origin.hex), unit)
  }
}

// Rejection feedback: clicked a board hex to place the held unit, but the
// board is already at its level cap. Restart the pulse/rumble even if it's
// already mid-animation from a rapid double-click.
function flashHeldUnitRejected(): void {
  heldUnitEl.classList.remove('held-unit-rejected')
  void heldUnitEl.offsetWidth
  heldUnitEl.classList.add('held-unit-rejected')
}

// Safety net: if planning ends (combat starts, phase transitions, mode swap)
// while a unit is still attached to the cursor, put it back rather than
// silently losing it.
function returnHeldUnitToBench(): void {
  if (!heldUnit) return
  const h = humanEcon()
  // Pillars can't go on the bench — just drop it; reconcile respawns it next
  // time the board is read (e.g. entering the next planning phase).
  if (!isCliffId(heldUnit.definitionId)) {
    const emptyIdx = h.bench.findIndex(b => b === null)
    if (emptyIdx !== -1) h.bench[emptyIdx] = { ...heldUnit }
  }
  dropHeldUnit()
}

// Brief "star up" celebration: after a buy completes a 2★/3★ combine, the
// resulting bench slot (or board hex) flashes — grow 50%, gain the tier's
// saturation, rumble — for one 0.5s pulse. Timer-driven (not tick-driven) so
// it plays during planning, outside the combat tick loop.
let benchStarFlash: { definitionId: string; tier: number } | null = null

function triggerBenchStarFlash(definitionId: string, tier: number): void {
  benchStarFlash = { definitionId, tier }
  renderBenchRow()
  setTimeout(() => {
    if (benchStarFlash?.definitionId === definitionId && benchStarFlash.tier === tier) {
      benchStarFlash = null
      renderBenchRow()
    }
  }, 500)
}

function benchCellHTML(slot: number): string {
  const b = humanEcon().bench[slot]
  const def = b ? UNIT_MAP.get(b.definitionId) : undefined
  // While a unit is attached to the cursor, highlight empty slots as valid drop targets.
  const isDropTarget = heldUnit !== null && !b

  const borderColor = isDropTarget ? '#88aaff' : b ? (COST_BORDER[def?.cost ?? 1] ?? '#9aa0a6') : '#2c3850'
  const fill = b ? '#141c2e' : 'rgba(12,18,32,0.6)'

  let content = ''
  if (b && def) {
    // Star-scaled max HP → same ticked green bar as fielded units
    const maxHp = Math.round(def.baseStats.hp * Math.pow(1.8, b.tier - 1))
    const segs = Math.max(1, Math.min(20, Math.ceil(maxHp / 200)))
    const segPct = 100 / segs
    const manaPct = def.baseStats.maxMana > 0
      ? Math.min(100, (def.baseStats.startMana / def.baseStats.maxMana) * 100)
      : 0
    const flashing = benchStarFlash && benchStarFlash.definitionId === b.definitionId && benchStarFlash.tier === b.tier
    // Star-level diamond, tinted per tier and attached flush against the left
    // edge of the HP bar — same treatment as fielded units' health bars
    // (unitLayer.ts drawHealthBars), reproduced here with a mix-blend-mode
    // overlay standing in for the canvas 'color' composite trick.
    const STAR_SIZE = 10
    const starColor = STAR_COLORS[b.tier]
    // The hop (hover) and star-up flash both animate this wrapper — the unit
    // itself hops, not the table cell it sits in. Bottom-anchored (not
    // inset:0) so the sprite's feet land on the cell's bottom edge and the
    // rest of the unit — bars included — overflows upward above the thin
    // cell, standing on top of the spot rather than being boxed inside it.
    content = `
      <div class="bench-unit-visual${flashing ? ' bench-star-up-flash' : ''}" style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;box-sizing:border-box;pointer-events:none;">
        <div style="position:relative;width:52px;">
          <div style="position:absolute;left:${-1 - STAR_SIZE}px;top:${(6 + 2) / 2 - STAR_SIZE / 2}px;width:${STAR_SIZE}px;height:${STAR_SIZE}px;isolation:isolate;">
            <img src="/visuals/sprites/star_level.png" style="position:absolute;inset:0;width:100%;height:100%;" onerror="this.parentElement.style.display='none'">
            <div style="position:absolute;inset:0;background:${starColor};mix-blend-mode:color;"></div>
          </div>
          <div style="width:52px;height:6px;border:1px solid #0a0d14;background:
            repeating-linear-gradient(90deg, transparent 0 calc(${segPct}% - 1px), #10131a calc(${segPct}% - 1px) ${segPct}%), #22cc44;">
          </div>
          <div style="width:52px;height:4px;border:1px solid #0a0d14;border-top:none;background:#0d1a33;">
            <div style="height:100%;width:${manaPct}%;background:#3377ff;"></div>
          </div>
        </div>
        <img class="bench-unit-sprite" src="${def.spritePath}" style="width:${BENCH_SPRITE_W}px;height:${BENCH_SPRITE_H}px;object-fit:contain;image-rendering:pixelated;margin-top:3px;pointer-events:auto;cursor:pointer;" onerror="this.style.display='none'">
        ${b.item ? `<img src="${ITEM_MAP.get(b.item)?.iconPath ?? ''}" style="position:absolute;right:0;bottom:8px;width:20px;height:20px;object-fit:contain;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.7));" onerror="this.style.display='none'">` : ''}
      </div>`
  }

  const sellHint = b && def
    ? ` title="${def.name} ${b.tier}★ — right-click to sell for ${sellValue(def.cost, b.tier)}g"`
    : ''

  // The outer cell is a tall hit-box (short visible border-box + the sprite's
  // full upward overflow — see BENCH_VISUAL_OVERFLOW) so clicking anywhere
  // near a unit's sprite/bars (not just the thin visible strip) hits this
  // slot — no need to click exactly on the small cell. The border/background
  // move to an inner box pinned to the bottom, so nothing looks different.
  return `<div class="bench-cell${b ? ' bench-cell-occupied' : ''}" data-slot="${slot}"${sellHint} style="
    position:relative;width:${BENCH_CELL_W}px;height:${BENCH_CELL_H + BENCH_VISUAL_OVERFLOW}px;box-sizing:border-box;
    ${slot > 0 ? 'margin-left:-1px;' : ''}
    ${isDropTarget ? 'z-index:1;' : ''}
    cursor:${b ? 'pointer' : 'default'};
  ">
    <div style="position:absolute;left:0;right:0;bottom:0;height:${BENCH_CELL_H}px;box-sizing:border-box;
      border:1px solid ${borderColor};background:${fill};pointer-events:none;"></div>
    ${content}
  </div>`
}

// Per-trait glyph size inside the unit/shop CARD trait rows. 1 = the default
// 10px glyph; edit any entry to grow/shrink just that trait's card icon
// (independent of the larger sidebar badges' GLYPH_SCALE above). Tune one by one.
const CARD_GLYPH_SCALE: Record<string, number> = {
  jungle:         1,
  beachy:         1.5,
  bruiser:        1,
  roughneck:      1,
  stalwart:       1,
  promoter:       1,
  volcanic:       1,
  sky_striker:    2.9,
  cave_crawler:   1,
  river:          2,
  temporal_woods: 2,
  ruiner:         1.5,
  ascender:       1,
  froststone:     1,
  quickclaw:      1,
  corkscrew:      1,
  spellweaver:    1,
  keen_eye:       1,
  mystic:         1,
  crashout:       1,
  substitutor:    2.03,
  shock_spirit:   2,
  rogue:          1,
  soul_bonded:    1,
  wave_spirit:    1,
  zen:            1,
}

// Mini trait row for a shop card: white glyph inside a small grey hexagon,
// trait name beside it (TFT card style)
function cardTraitRowHTML(trait: string): string {
  const file = GLYPH_OVERRIDES[trait] ?? `${trait}_trait_icon.png`
  const scale = CARD_GLYPH_SCALE[trait] ?? 1
  return `<div style="display:flex;align-items:center;gap:4px;">
    <div style="width:14px;height:15px;clip-path:${HEX_CLIP};background:#5a5f68;flex-shrink:0;
                display:flex;align-items:center;justify-content:center;">
      <img src="/visuals/trait icons/main icons/${file}"
        style="width:10px;height:10px;object-fit:contain;filter:brightness(0) invert(1);transform:scale(${scale});"
        onerror="this.style.display='none'">
    </div>
    <span style="font-size:9px;color:#e8ecf4;text-shadow:0 1px 2px rgba(0,0,0,0.9);white-space:nowrap;">${traitDisplayName(trait)}</span>
  </div>`
}

// Wide, short cards like the TFT shop: art on the right, trait rows overlaid
// lower-left, cost-colored name strip along the bottom.
const SHOP_CARD_W = 152
const SHOP_CARD_H = 110

// Star-up marker for the shop card corner — tinted silver/gold (fill only;
// the black outline stays black via mix-blend-mode 'color', same trick as
// the bench star-level diamond). The tint overlay is also mask-clipped to
// the star's own silhouette, otherwise its solid fill paints as an opaque
// box everywhere the star PNG is transparent.
function starUpIconHTML(color: string, size = 10): string {
  const maskCss = `-webkit-mask-image:url('/visuals/gui icons/star-up.png');mask-image:url('/visuals/gui icons/star-up.png');
    -webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
    -webkit-mask-position:center;mask-position:center;`
  return `<div style="position:relative;width:${size}px;height:${size}px;isolation:isolate;flex-shrink:0;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));">
    <img src="/visuals/gui icons/star-up.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.style.display='none'">
    <div style="position:absolute;inset:0;background:${color};mix-blend-mode:color;${maskCss}"></div>
  </div>`
}

function shopCardHTML(slot: number): string {
  const h = humanEcon()
  const defId = h.shop[slot]
  if (!defId) {
    return `<div style="width:${SHOP_CARD_W}px;height:${SHOP_CARD_H}px;border:1px solid #223;border-radius:6px;
      box-sizing:border-box;background:rgba(0,0,0,0.35);"></div>`
  }
  const def = UNIT_MAP.get(defId)
  if (!def) return ''
  const border = COST_BORDER[def.cost] ?? '#9aa0a6'
  const affordable = h.gold >= def.cost
  const traitRows = def.types.slice(0, 3).map(cardTraitRowHTML).join('')

  // Already owned (bench or board) → small pokeball marker, upper-left.
  const owned = h.bench.some(b => b?.definitionId === defId) || h.board.some(u => u.definitionId === defId)

  // Buying this card would complete a combine right now → pulse in size AND
  // glow the tier color it's about to become (silver = 2★, gold = 3★).
  let c1 = 0, c2 = 0
  for (const b of h.bench) if (b && b.definitionId === defId) { if (b.tier === 1) c1++; else if (b.tier === 2) c2++ }
  for (const u of h.board) if (u.definitionId === defId) { if (u.tier === 1) c1++; else if (u.tier === 2) c2++ }
  const starUpTier = c1 === 2 ? (c2 === 2 ? 3 : 2) : null
  const tierPulseClass = starUpTier === 3 ? 'tier-pulse-gold' : starUpTier === 2 ? 'tier-pulse-silver' : ''
  const starUpPulseClass = starUpTier ? 'shop-card-owned' : ''
  const tierBgPulseClass = starUpTier === 3 ? 'tier-bg-pulse-gold' : starUpTier === 2 ? 'tier-bg-pulse-silver' : ''
  const starUpIconsHtml = starUpTier === 3
    ? Array(3).fill(0).map(() => starUpIconHTML(HEX_FILL_GOLD)).join('')
    : starUpTier === 2
      ? Array(2).fill(0).map(() => starUpIconHTML(HEX_FILL_SILVER)).join('')
      : ''

  return `<div class="shop-card ${starUpPulseClass} ${tierPulseClass}" data-slot="${slot}" style="
    width:${SHOP_CARD_W}px;height:${SHOP_CARD_H}px;border:2px solid ${border};border-radius:6px;box-sizing:border-box;
    cursor:pointer;position:relative;overflow:hidden;
    opacity:${affordable ? '1' : '0.45'};
  ">
    <div style="width:100%;height:100%;display:flex;flex-direction:column;position:relative;
      background:linear-gradient(180deg, rgba(26,32,48,0.96), rgba(10,14,24,0.96));
    ">
      ${tierBgPulseClass ? `<div class="${tierBgPulseClass}" style="position:absolute;inset:0;z-index:0;"></div>` : ''}
      <img src="${def.spritePath}" style="
        position:absolute;right:2px;top:2px;
        width:86px;height:82px;object-fit:contain;image-rendering:pixelated;" onerror="this.style.display='none'">
      ${starUpIconsHtml ? `<div style="position:absolute;right:3px;top:3px;display:flex;gap:2px;z-index:2;">${starUpIconsHtml}</div>` : ''}
      ${owned ? `<img src="/visuals/gui icons/pokeball_owned.png" style="
        position:absolute;left:3px;top:3px;width:16px;height:16px;object-fit:contain;
        z-index:2;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));" onerror="this.style.display='none'">` : ''}
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:2px;padding:0 5px 3px;position:relative;z-index:1;">
        ${traitRows}
      </div>
      <div style="background:${border};color:#0a0e1a;font-size:10px;font-weight:bold;
        display:flex;justify-content:space-between;align-items:center;padding:2px 6px;position:relative;z-index:1;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:112px;">${def.name}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;">${goldIconHTML(11)}${def.cost}</span>
      </div>
    </div>
  </div>`
}

// ─── Unit card tooltip (shop hover / bench hover / fielded-unit click) ────────
// TFT-style card: traits upper-left, portrait + cost mid-upper-left, stats on
// the right, ability description along the bottom.

const UNIT_CARD_WIDTH = 430

// Keen Eye mana regen for defId on the given team — mirrors the trait's
// actual math (applyKeenEye in traitEffects.ts): +1/+2 mana per second
// team-wide at 2/4/6 unique Keen Eye species, with Keen Eye units themselves
// getting the 25%/50%/75% multiplier on top. Null = trait inactive.
// Source: live combatState during combat (reads the real fielded team,
// player or enemy); otherwise the player's planning-phase board.
function keenEyeRegenBonus(defId: string, team: 'player' | 'enemy' = 'player'): number | null {
  const source: Iterable<Unit> = combatState ? combatState.units.values() : placedUnits.values()
  const keenSpecies = new Set<string>()
  for (const u of source) {
    if (u.isDummy || u.team !== team) continue
    if (u.types.includes('keen_eye')) keenSpecies.add(u.definitionId)
  }
  const n = keenSpecies.size
  if (n < 2) return null
  const tier = n >= 6 ? 3 : n >= 4 ? 2 : 1   // 2/4/6 breakpoints
  const baseRegen = tier                     // +1 / +2 / +3 per second
  const bonus = tier * 0.25                  // 25% / 50% / 75% for keen eye units
  const isKeen = UNIT_MAP.get(defId)?.types.includes('keen_eye') ?? false
  return isKeen ? Math.round(baseRegen * (1 + bonus)) : baseRegen
}

// `liveUnit` sources actual current HP/mana from a real Unit (fielded during
// planning or mid-combat) so the card stays live-accurate; omitted for shop/
// bench previews, which show a full-health, start-mana snapshot instead.
function unitCardHTML(defId: string, tier: 1 | 2 | 3, liveUnit?: Unit): string {
  const def = UNIT_MAP.get(defId)
  if (!def) return ''
  const preview = makeUnit(defId, 'player', tier)
  const stats = computeStats(preview)
  const border = COST_BORDER[def.cost] ?? '#9aa0a6'

  const traitCol = def.types.map(cardTraitRowHTML).join('')

  const maxHp = liveUnit ? liveUnit.maxHp : stats.maxHp
  const curHp = liveUnit ? Math.round(liveUnit.currentHp) : maxHp
  const maxMana = liveUnit ? liveUnit.maxMana : def.baseStats.maxMana
  const curMana = liveUnit ? Math.round(liveUnit.currentMana) : def.baseStats.startMana

  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (curHp / maxHp) * 100)) : 0
  const manaPct = maxMana > 0 ? Math.max(0, Math.min(100, (curMana / maxMana) * 100)) : 0
  const regenBonus = maxMana > 0 ? keenEyeRegenBonus(defId) : null

  const statRow = (label: string, value: string) =>
    `<span style="color:#667;">${label}</span><span style="color:#dde;text-align:right;">${value}</span>`

  const statsHtml = `
    <div style="display:grid;grid-template-columns:auto auto;gap:1px 10px;font-size:10px;align-content:start;justify-content:end;">
      ${statRow('ATK', `${Math.round(stats.attack)}`)}
      ${statRow('AP', `${Math.round(stats.special)}%`)}
      ${statRow('ARMOR', `${Math.round(stats.defense)}`)}
      ${statRow('MR', `${Math.round(stats.spDefense)}`)}
      ${statRow('AS', `${Math.min(stats.attackSpeed, 5).toFixed(2)}`)}
      ${statRow('RANGE', `${stats.range}`)}
      ${statRow('CRIT', `${Math.round(stats.critChance * 100)}%`)}
    </div>`

  // Fielded units (liveUnit set) skip the ability icon — just name + description
  const abilityHtml = def.ability ? `
    <div style="display:flex;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #2a3550;">
      ${liveUnit ? '' : `<img src="/visuals/ability_icons/${def.ability.id}.webp" style="
        width:38px;height:38px;object-fit:contain;border-radius:5px;flex-shrink:0;
        border:1px solid #334;background:#0a0e1a;"
        onerror="this.remove()">`}
      <div style="min-width:0;">
        <div style="font-weight:bold;color:#e8b04e;font-size:11px;margin-bottom:3px;">${def.ability.name}</div>
        <div style="font-size:10px;color:#c7cede;line-height:1.4;">${def.ability.description}</div>
      </div>
    </div>` : ''

  return `<div style="width:100%;box-sizing:border-box;font-family:sans-serif;">
    <div style="display:flex;gap:10px;align-items:flex-start;">
      <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;padding-top:2px;">
        ${traitCol}
      </div>
      <div style="position:relative;width:56px;height:56px;flex-shrink:0;">
        <div style="position:absolute;inset:0;border:2px solid ${border};border-radius:6px;
          background:#0a0e1a;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <img src="${def.spritePath}" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated;" onerror="this.style.display='none'">
        </div>
        <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);white-space:nowrap;">${starPips(tier)}</div>
        <div style="position:absolute;bottom:-5px;left:-5px;background:${border};color:#0a0e1a;
          font-size:9px;font-weight:bold;border-radius:50%;width:16px;height:16px;
          display:flex;align-items:center;justify-content:center;border:1px solid #0a0e1a;">${def.cost}</div>
      </div>
      <div style="flex:1;min-width:0;padding-top:2px;">
        <div style="font-weight:bold;color:#e8ecf4;font-size:13px;margin-bottom:5px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${def.name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <div style="width:56px;height:6px;flex-shrink:0;background:#101828;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${hpPct}%;background:#22cc44;"></div>
          </div>
          <span style="font-size:10px;color:#a8e0b0;white-space:nowrap;">${curHp}/${maxHp}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:56px;height:4px;flex-shrink:0;background:#0d1a33;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${manaPct}%;background:#3377ff;"></div>
          </div>
          <span style="font-size:10px;color:#9db8e8;white-space:nowrap;">${maxMana > 0 ? `${curMana}/${maxMana}` : '—'}${
            regenBonus ? ` <span style="color:#5ad0e8;">+${regenBonus}</span>` : ''
          }</span>
        </div>
      </div>
      <div style="flex-shrink:0;">${statsHtml}</div>
    </div>
    ${abilityHtml}
  </div>`
}

// Downward-pointing speech-bubble arrow, centered on the tooltip's bottom
// edge, aimed at the unit below — same two-triangle (outline + fill) trick
// as the trait tooltip's arrow, just rotated to point down instead of sideways.
function appendUnitCardArrow(): void {
  const bg   = 'rgba(8,8,12,0.88)'
  const line = '#3a3a44'
  tooltipEl.insertAdjacentHTML('beforeend', `
    <div style="position:absolute;width:0;height:0;left:50%;bottom:-9px;transform:translateX(-9px);
      border-left:9px solid transparent;border-right:9px solid transparent;border-top:9px solid ${line};"></div>
    <div style="position:absolute;width:0;height:0;left:50%;bottom:-7px;transform:translateX(-8px);
      border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ${bg};"></div>`)
}

// Small fixed gap between the arrow tip and the unit anchor point below —
// the box should sit just above the sprite, not float far above it.
const UNIT_CARD_CLEARANCE = 14

function positionTooltipAboveRect(rect: { left: number; top: number; width: number }): void {
  const ttRect = tooltipEl.getBoundingClientRect()
  const left = Math.max(4, Math.min(window.innerWidth - ttRect.width - 4, rect.left + rect.width / 2 - ttRect.width / 2))
  const top  = Math.max(4, rect.top - ttRect.height - UNIT_CARD_CLEARANCE)
  tooltipEl.style.left = `${left}px`
  tooltipEl.style.top  = `${top}px`
  appendUnitCardArrow()
}

// `y` should be the top of the unit's sprite (not the raw cursor position),
// so the gap stays small and consistent regardless of where on the unit the
// mouse happens to be hovering.
function positionTooltipNearPoint(x: number, y: number): void {
  const ttRect = tooltipEl.getBoundingClientRect()
  const left = Math.max(4, Math.min(window.innerWidth - ttRect.width - 4, x - ttRect.width / 2))
  const top  = Math.max(4, Math.min(window.innerHeight - ttRect.height - 4, y - ttRect.height - UNIT_CARD_CLEARANCE))
  tooltipEl.style.left = `${left}px`
  tooltipEl.style.top  = `${top}px`
  appendUnitCardArrow()
}

function showShopCardTooltip(card: HTMLElement): void {
  const slot = Number(card.dataset.slot)
  const defId = humanEcon().shop[slot]
  if (!defId) { tooltipHiddenReset(); return }
  ensureTooltipShown(`shop:${slot}:${defId}`)
  tooltipEl.style.width = `${UNIT_CARD_WIDTH}px`
  tooltipEl.innerHTML = unitCardHTML(defId, 1)
  positionTooltipAboveRect(card.getBoundingClientRect())
}

function showBenchCardTooltip(cell: HTMLElement): void {
  const slot = Number(cell.dataset.slot)
  const b = humanEcon().bench[slot]
  if (!b) { tooltipHiddenReset(); return }
  ensureTooltipShown(`bench:${slot}:${b.definitionId}:${b.tier}`)
  tooltipEl.style.width = `${UNIT_CARD_WIDTH}px`
  tooltipEl.innerHTML = unitCardHTML(b.definitionId, b.tier)
  // The bench unit's visual (bars + sprite) is bottom-anchored and overflows
  // above the cell's own (short) box — anchor to the actual top of the bar
  // stack, not the cell's bounding rect, so the tooltip starts above the
  // health bar rather than overlapping the sprite.
  const cellRect = cell.getBoundingClientRect()
  const visualTop = cellRect.bottom - (BENCH_BAR_STACK_H + BENCH_SPRITE_MARGIN_TOP + BENCH_SPRITE_H)
  positionTooltipAboveRect({ left: cellRect.left, top: visualTop, width: cellRect.width })
}

// Shown on hover (continuous, cursor-following reposition) AND on click of a
// fielded board unit. `sourceKey` gates the FADE so repeated calls while
// hovering the SAME unit only reposition — but content always rebuilds, so
// HP/mana stay live-accurate while a fight is in progress.
function showBoardUnitCardAt(defId: string, tier: 1 | 2 | 3, x: number, y: number, sourceKey: string, liveUnit?: Unit): void {
  ensureTooltipShown(sourceKey)
  tooltipEl.style.width = `${UNIT_CARD_WIDTH}px`
  tooltipEl.innerHTML = unitCardHTML(defId, tier, liveUnit)
  positionTooltipNearPoint(x, y)
}

// ─── Item hover card (item bench) ─────────────────────────────────────────────
const ITEM_CARD_WIDTH = 250
// Title-case an archetype id ("attack fighter" → "Attack Fighter") for display.
const itemCategoryLabel = (c: string) => c.replace(/\b\w/g, m => m.toUpperCase())

// Human-readable "+N Stat" lines derived from an item's flat + percent bonuses.
function itemStatLines(def: ItemDefinition): string[] {
  const sb = def.statBonus
  const lines: string[] = []
  if (sb.hp)        lines.push(`+${sb.hp} Health`)
  if (sb.attack)    lines.push(`+${sb.attack} Attack`)
  if (sb.special)   lines.push(`+${sb.special} Special Attack`)
  if (sb.defense)   lines.push(`+${sb.defense} Defense`)
  if (sb.spDefense) lines.push(`+${sb.spDefense} Sp. Defense`)
  if (sb.attackSpeed) lines.push(`+${Math.round(sb.attackSpeed * 100)}% Attack Speed`)
  if (sb.critChance)  lines.push(`+${Math.round(sb.critChance * 100)}% Crit Chance`)
  if (sb.critDamage)  lines.push(`+${Math.round(sb.critDamage * 100)}% Crit Damage`)
  if (sb.startMana) lines.push(`+${sb.startMana} Starting Mana`)
  if (def.attackSpeedPct)   lines.push(`+${Math.round(def.attackSpeedPct * 100)}% Attack Speed`)
  if (def.adaptiveForcePct) lines.push(`+${Math.round(def.adaptiveForcePct * 100)}% Adaptive Force`)
  if (def.adaptiveForce)    lines.push(`+${def.adaptiveForce} Adaptive Force`)
  if (def.moveSpeedPct)     lines.push(`+${Math.round(def.moveSpeedPct * 100)}% Move Speed`)
  return lines
}

// The item's effect text = its description with the leading stats sentence
// stripped, so the tooltip doesn't repeat the stats block above it. Stats are
// always the first sentence; the effect is whatever follows. "Sp. Defense"
// contains a period, so split on the first ". " that is followed by a capital
// letter starting a new word (the effect sentence) rather than a mid-stat abbrev.
function itemEffectText(def: ItemDefinition): string {
  const m = def.description.match(/^(.*?[.!])\s+([A-Z].*)$/s)
  // If the tail still begins with "Defense"/"Attack" it was an abbrev split — fall
  // back to the full description in that case.
  if (m && !/^(Defense|Attack|Sp)\b/.test(m[2])) return m[2]
  return def.description
}

function itemCardHTML(itemId: string): string {
  const def = ITEM_MAP.get(itemId)
  if (!def) return ''
  const cat = def.categories?.length ? def.categories.map(itemCategoryLabel).join(' · ') : ''
  const stats = itemStatLines(def)
  const effect = itemEffectText(def)
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:${stats.length || effect ? '8px' : '0'};">
      ${def.iconPath ? `<img src="${def.iconPath}" style="width:40px;height:40px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
      <div>
        <div style="font-size:15px;font-weight:bold;color:#fff;">${def.name}</div>
        ${cat ? `<div style="font-size:11px;color:#88aaff;">${cat}</div>` : ''}
      </div>
    </div>
    ${stats.length ? `<div style="color:#7fd97f;font-size:12px;line-height:1.5;margin-bottom:6px;">${stats.join('<br>')}</div>` : ''}
    ${effect ? `<div style="color:#cfd6e4;font-size:12px;line-height:1.45;">${effect}</div>` : ''}`
}

// Shared item hover card — used by both the item bench and Delibird's item tray.
function showItemCardTooltip(itemId: string, anchorEl: HTMLElement, sourceKey: string): void {
  ensureTooltipShown(sourceKey)
  tooltipEl.style.width = `${ITEM_CARD_WIDTH}px`
  tooltipEl.innerHTML = itemCardHTML(itemId)
  positionTooltipAboveRect(anchorEl.getBoundingClientRect())
}

function showItemBenchTooltip(slotEl: HTMLElement): void {
  const idx = Number(slotEl.dataset.itemIdx)
  const id = humanEcon().itemBench[idx]
  if (!id) { tooltipHiddenReset(); return }
  showItemCardTooltip(id, slotEl, `item:${idx}:${id}`)
}

// Brief background flash on a button, restartable even mid-animation.
function flashEconButton(id: string): void {
  const btn = document.getElementById(id)
  if (!btn) return
  btn.classList.remove('econ-btn-flash')
  void btn.offsetWidth
  btn.classList.add('econ-btn-flash')
}

// Shared by the button click handlers and the (d)/(f) keyboard shortcuts.
// The flash has to fire AFTER renderEconUI() rebuilds the bar's HTML (the
// button is a fresh DOM node each render), otherwise the class gets wiped
// before the animation ever plays.
function performBuyXp(): void {
  if (econPhase === 'gameOver') return
  if (buyXp(humanEcon())) {
    saveRun(run); renderEconUI()
    flashEconButton('btn-buy-xp')
  }
}

function performReroll(): void {
  if (econPhase === 'gameOver') return
  if (net !== null) {
    // Input stops at a drop. Every dispatch plans 04-03 and 04-04 add inherits
    // this gate by construction, since they all sit behind the same branch.
    if (netDropped) return
    // Send the intent and wait. The gold/shop change becomes visible only
    // when the server's own `snapshot` broadcast comes back — applying it
    // locally first would fork this client's economy from the room's for as
    // long as the round lasts. The flash is the immediate feedback instead.
    net.sendAction({ t: 'reroll' })
    flashEconButton('btn-reroll')
    return
  }
  if (shopReroll(humanEcon(), run.pool)) {
    saveRun(run); renderEconUI()
    flashEconButton('btn-reroll')
  }
}

// Sells whatever bench/board unit is currently hover-tooltipped (see
// currentTooltipSource — 'bench:<slot>:...' or 'board:<hexId>').
function sellHoveredUnit(): void {
  const src = currentTooltipSource
  if (!src) return
  if (src.startsWith('bench:') && (econPhase === 'planning' || econPhase === 'combat')) {
    const slot = Number(src.split(':')[1])
    if (sellFromBench(run, humanEcon(), slot)) { saveRun(run); renderEconUI() }
  } else if (src.startsWith('board:') && econPhase === 'planning') {
    const key = src.slice('board:'.length)
    const unit = placedUnits.get(key)
    if (unit) econBoardSell(unit.hexPos)
  }
}

document.addEventListener('keydown', (e) => {
  if (!econActive() || econPhase === 'gameOver') return
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  if (e.key === 'd' || e.key === 'D') performReroll()
  else if (e.key === 'f' || e.key === 'F') performBuyXp()
  else if (e.key === 'e' || e.key === 'E') sellHoveredUnit()
  else if (e.key === 'r' || e.key === 'R') removeHoveredItem()
})

// `r` over a unit (board or bench) that holds an item pulls the item onto the
// cursor (planning only), to be re-placed on another unit or the item bench.
function removeHoveredItem(): void {
  if (econPhase !== 'planning' || heldItem || !hoverUnitRef) return
  if (hoverUnitRef.kind === 'board') {
    const u = placedUnits.get(hexId(hoverUnitRef.hex))
    if (!u || !u.items[0]) return
    const id = u.items[0]
    u.items = []
    pickUpItem(id); syncBoardToRun(); saveRun(run); renderEconUI()
  } else {
    const b = humanEcon().bench[hoverUnitRef.slot]
    if (!b || !b.item) return
    const id = b.item
    b.item = undefined
    pickUpItem(id); saveRun(run); renderEconUI()
  }
}

// Gold-change pulse on the HUD icon — compared against gold as of the last
// renderEconBar() call, since the icon is a brand-new DOM node every render
// (bar.innerHTML is rebuilt wholesale) and so can't remember its own history.
let lastRenderedGold: number | null = null

function renderEconBar(): void {
  const bar = document.getElementById('econ-bar')
  if (!bar) return
  const h = humanEcon()
  const need = xpToNext(h.level)
  const xpPct = need ? Math.min(100, (h.xp / need) * 100) : 100
  // One tick per 4 exp, spanning the whole bar (not just the filled portion)
  // so ticks stay at fixed spacing as the fill grows.
  const xpTicks = need ? Math.max(1, Math.round(need / 4)) : 1
  const xpTickPct = 100 / xpTicks
  const boardCount = playerBoardUnitCount()
  const capped = boardCount >= boardCap(h)
  const streakIcon = h.streak >= 3 ? '🔥' : h.streak <= -3 ? '❄️' : ''

  // Shop odds strip for the current level, dot colored per cost tier
  const odds = SHOP_ODDS[Math.max(1, Math.min(10, h.level))]
  const oddsHtml = odds.map((p, i) => `
    <span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:${p > 0 ? '#aabbcc' : '#445'};">
      <span style="width:6px;height:6px;border-radius:50%;background:${COST_BORDER[i + 1]};display:inline-block;
        opacity:${p > 0 ? 1 : 0.35};"></span>${p}%
    </span>`).join('')

  bar.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <!-- Top strip: level + xp progress | odds | gold | streak | board cap -->
      <div style="display:flex;align-items:center;gap:12px;padding:0 2px;">
        <div style="display:flex;align-items:center;gap:6px;min-width:150px;">
          <span style="font-size:13px;font-weight:bold;color:#e8ecf4;">Lvl. ${h.level}</span>
          <span style="font-size:10px;color:#8899aa;">${need !== null ? `${h.xp}/${need}` : 'MAX'}</span>
          <div style="position:relative;flex:1;height:5px;box-sizing:border-box;border:1px solid #66aaff;
            background:#101828;border-radius:3px;overflow:hidden;min-width:44px;">
            <div style="position:absolute;inset:0;width:${xpPct}%;background:#66aaff;"></div>
            ${need !== null ? `<div style="position:absolute;inset:0;background:
              repeating-linear-gradient(90deg, transparent 0 calc(${xpTickPct}% - 1px), rgba(0,0,0,0.4) calc(${xpTickPct}% - 1px) ${xpTickPct}%);
            "></div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;">${oddsHtml}</div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
          <span style="font-size:15px;font-weight:bold;color:#f0c95c;">${goldIconHTML(16, 'gold-hud-icon')} ${h.gold}</span>
          ${streakIcon ? `<span style="font-size:12px;color:#ff9955;">${streakIcon} ${Math.abs(h.streak)}</span>` : ''}
          <span style="font-size:11px;color:#cc6666;">♥ ${h.hp}</span>
          <span style="font-size:10px;color:${capped ? '#ff6666' : '#667'};">Board ${boardCount}/${boardCap(h)}</span>
        </div>
      </div>
      <!-- Bottom row: Buy XP / Reroll stacked on the left, then the 5 cards, then lock -->
      <div style="display:flex;gap:8px;align-items:stretch;">
        <div style="display:flex;flex-direction:column;gap:6px;width:92px;">
          <button id="btn-buy-xp" style="${ECON_BTN};flex:1;">Buy XP (f)<br><span style="font-size:10px;color:#f0c95c;">${goldIconHTML(10)} ${XP_BUY_COST}</span></button>
          <button id="btn-reroll" style="${ECON_BTN};flex:1;">Reroll ↻ (d)<br><span style="font-size:10px;color:#f0c95c;">${goldIconHTML(10)} ${REROLL_COST}</span></button>
        </div>
        <div id="shop-cards" style="display:flex;gap:6px;">
          ${[0, 1, 2, 3, 4].map(shopCardHTML).join('')}
        </div>
        <div style="display:flex;align-items:center;">
          <button id="btn-shop-lock" title="Lock shop" style="${ECON_BTN};font-size:15px;
            ${h.shopLocked ? 'background:#4a3a1a;border-color:#e8b03e;color:#e8b03e;' : ''}">🔒</button>
        </div>
      </div>
    </div>`

  if (lastRenderedGold !== null && h.gold !== lastRenderedGold) {
    const icon = document.getElementById('gold-hud-icon')
    icon?.classList.add(h.gold > lastRenderedGold ? 'gold-icon-earn' : 'gold-icon-spend')
  }
  lastRenderedGold = h.gold

  // Shop economy actions work during combat too (TFT-style); only the board
  // itself is locked while fighting.
  document.getElementById('btn-buy-xp')?.addEventListener('click', performBuyXp)
  document.getElementById('btn-reroll')?.addEventListener('click', performReroll)
  document.getElementById('btn-shop-lock')?.addEventListener('click', () => {
    if (econPhase === 'gameOver') return
    humanEcon().shopLocked = !humanEcon().shopLocked
    saveRun(run); renderEconUI()
  })
  bar.querySelectorAll<HTMLElement>('.shop-card').forEach(card => {
    card.addEventListener('click', () => {
      if (econPhase === 'gameOver') return
      const slot = Number(card.dataset.slot)
      const res = buyUnit(run, humanEcon(), slot)
      if (res.ok) {
        // A combine may have upgraded a board unit — refresh placed units
        // (during combat the fighting copies are snapshots; the upgrade shows
        // up when the next planning phase rebuilds the board)
        if (res.combined?.upgrades.some(u => u.placedOnBoard) && econPhase === 'planning') syncRunToBoard()
        saveRun(run); renderEconUI(); renderTraitDisplay()
        for (const up of res.combined?.upgrades ?? []) {
          if (up.placedOnBoard && econPhase === 'planning') {
            const boardEntry = humanEcon().board.find(u => u.definitionId === up.definitionId && u.tier === up.to)
            const unit = boardEntry ? placedUnits.get(hexId(boardEntry.hexPos)) : undefined
            if (unit) unitLayer.flashStarUp(unit.id)
          } else if (!up.placedOnBoard) {
            triggerBenchStarFlash(up.definitionId, up.to)
          }
        }
      }
    })
  })
}

// Cave Crawler earthquake rewards for the human are now rolled authoritatively
// inside resolveRound at settlement time (src/game/round.ts's settleSeat),
// not live per-quake during the fight. onLivePlayerQuake and its bench-spawn
// animation hook are removed rather than kept alongside the authoritative
// roll — running both would grant the reward twice. See applyRoundResult for
// the settlement-time summary this replaces.

function renderBenchRow(): void {
  const row = document.getElementById('bench-row')
  if (!row) return
  row.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(benchCellHTML).join('')
  row.querySelectorAll<HTMLElement>('.bench-cell').forEach(cell => {
    const slot = Number(cell.dataset.slot)
    cell.addEventListener('click', (e) => {
      // Bench pick-up/rearrange/sell works mid-combat too (TFT-style) — only
      // the board itself (placing/swapping live units) stays planning-only,
      // enforced separately: econBoardClick gates on 'planning', and while
      // combat is actually running the board click listener never reaches it
      // (it's intercepted for unit-inspection instead).
      if (econPhase !== 'planning' && econPhase !== 'combat') return
      const h = humanEcon()

      // Holding an item: click a benched unit to equip it (displaced item → bench).
      if (heldItem) {
        const b = h.bench[slot]
        if (b) {
          const prev = b.item
          b.item = heldItem
          if (prev) h.itemBench.push(prev)
          dropHeldItem()
          saveRun(run); renderEconUI()
        }
        return
      }

      if (heldUnit) {
        // Ascender pillars can't be benched — reject and keep holding so the
        // player can drop it back on a board hex.
        if (isCliffId(heldUnit.definitionId)) { flashHeldUnitRejected(); return }
        // Place the held unit here — if occupied, the occupant swaps back to
        // wherever the held unit came from, and holding ends.
        const occupant = h.bench[slot]
        h.bench[slot] = { ...heldUnit }
        if (occupant && heldFrom) placeDisplacedUnitAtOrigin(occupant, heldFrom)
        dropHeldUnit()
        saveRun(run)
        renderEconUI(); renderTraitDisplay()
        return
      }

      // Nothing held — only a direct click on the unit's own sprite picks it up
      const target = e.target as HTMLElement
      const b = h.bench[slot]
      if (b && target.classList.contains('bench-unit-sprite')) {
        h.bench[slot] = null
        pickUpUnit(b.definitionId, b.tier, { kind: 'bench', slot }, b.item)
        saveRun(run)
        renderBenchRow()
      }
    })
    cell.addEventListener('contextmenu', e => {
      e.preventDefault()
      if (econPhase === 'gameOver') return   // bench sells allowed mid-combat
      if (sellFromBench(run, humanEcon(), slot)) {
        saveRun(run); renderEconUI()
      }
    })
    // Track bench hover so `r` can pull the item off a benched unit.
    cell.addEventListener('mouseenter', () => { hoverUnitRef = { kind: 'bench', slot } })
    cell.addEventListener('mouseleave', () => { if (hoverUnitRef?.kind === 'bench' && hoverUnitRef.slot === slot) hoverUnitRef = null })
  })
}

// Read-only mirror of benchCellHTML for the opponent's bench — same visuals
// (star diamond, HP/mana bars, item icon) minus every interactive affordance
// (no click/sell/drag, no drop-target highlight, no star-up flash — that's a
// human-only mechanic). Takes the bench entry directly since it isn't reading
// from humanEcon().
function enemyBenchCellHTML(entry: { definitionId: string; tier: 1 | 2 | 3; item?: string } | null, slot: number): string {
  const def = entry ? UNIT_MAP.get(entry.definitionId) : undefined
  const borderColor = entry ? (COST_BORDER[def?.cost ?? 1] ?? '#9aa0a6') : '#2c3850'
  const fill = entry ? '#141c2e' : 'rgba(12,18,32,0.6)'

  let content = ''
  if (entry && def) {
    const maxHp = Math.round(def.baseStats.hp * Math.pow(1.8, entry.tier - 1))
    const segs = Math.max(1, Math.min(20, Math.ceil(maxHp / 200)))
    const segPct = 100 / segs
    const manaPct = def.baseStats.maxMana > 0
      ? Math.min(100, (def.baseStats.startMana / def.baseStats.maxMana) * 100)
      : 0
    const starColor = STAR_COLORS[entry.tier]
    content = `
      <div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;box-sizing:border-box;pointer-events:none;">
        <div style="position:relative;width:${E_BENCH_BAR_W}px;">
          <div style="position:absolute;left:${-1 - E_BENCH_STAR}px;top:${(E_BENCH_HP_H + 2) / 2 - E_BENCH_STAR / 2}px;width:${E_BENCH_STAR}px;height:${E_BENCH_STAR}px;isolation:isolate;">
            <img src="/visuals/sprites/star_level.png" style="position:absolute;inset:0;width:100%;height:100%;" onerror="this.parentElement.style.display='none'">
            <div style="position:absolute;inset:0;background:${starColor};mix-blend-mode:color;"></div>
          </div>
          <div style="width:${E_BENCH_BAR_W}px;height:${E_BENCH_HP_H}px;border:1px solid #0a0d14;background:
            repeating-linear-gradient(90deg, transparent 0 calc(${segPct}% - 1px), #10131a calc(${segPct}% - 1px) ${segPct}%), #22cc44;">
          </div>
          <div style="width:${E_BENCH_BAR_W}px;height:${E_BENCH_MANA_H}px;border:1px solid #0a0d14;border-top:none;background:#0d1a33;">
            <div style="height:100%;width:${manaPct}%;background:#3377ff;"></div>
          </div>
        </div>
        <img src="${def.spritePath}" style="width:${E_BENCH_SPRITE_W}px;height:${E_BENCH_SPRITE_H}px;object-fit:contain;image-rendering:pixelated;margin-top:${E_BENCH_SPRITE_MARGIN_TOP}px;" onerror="this.style.display='none'">
        ${entry.item ? `<img src="${ITEM_MAP.get(entry.item)?.iconPath ?? ''}" style="position:absolute;right:0;bottom:${s80(8)}px;width:${E_BENCH_ITEM}px;height:${E_BENCH_ITEM}px;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.7));" onerror="this.style.display='none'">` : ''}
      </div>`
  }

  const title = entry && def ? ` title="${def.name} ${entry.tier}★"` : ''
  return `<div${title} style="
    position:relative;width:${E_BENCH_CELL_W}px;height:${E_BENCH_ROW_H}px;box-sizing:border-box;
    ${slot > 0 ? 'margin-left:-1px;' : ''}
  ">
    <div style="position:absolute;left:0;right:0;bottom:0;height:${E_BENCH_CELL_H}px;box-sizing:border-box;
      border:1px solid ${borderColor};background:${fill};"></div>
    ${content}
  </div>`
}

// Shown only while econPhase === 'combat' against a real bot opponent (hidden
// for creep rounds, item rounds, test mode, and outside combat) — mirrors the
// resolved opponent's bench (currentOpponentIndex, captured at combat start)
// on their side of the board, read-only.
function renderEnemyBenchRow(): void {
  const row = document.getElementById('enemy-bench-row')
  if (!row) return
  const opp = econActive() && econPhase === 'combat' && currentOpponentIndex >= 1
    ? run.players[currentOpponentIndex]
    : null
  if (!opp) { row.style.display = 'none'; return }
  row.style.display = 'flex'
  row.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    .map(slot => enemyBenchCellHTML(opp.bench[slot], slot))
    .join('')
}

// Two lines: the stage label (e.g. "Stage 3-3") above whoever you're facing.
// The absolute round number is deliberately omitted — the stage label already
// encodes it (3-3 = stage 3, round 3 of that stage) and the opponent is the
// part worth reading at a glance.
function renderRoundIndicator(): void {
  const el = document.getElementById('round-indicator')
  if (!el) return
  if (!econActive() || econPhase === 'gameOver') { el.style.display = 'none'; return }
  el.style.display = 'block'

  const opponent = isItemRound(run.round)
    ? "Delibird's Gift"                                     // non-combat round — no opponent
    : isCreepRound(run.round)
      ? `Vs ${creepRoundDef(run.round)?.name ?? 'Creeps'}`   // fixed PvE board, not a bot
      : (() => { const opp = run.players[run.players[localSeatIndex].nextOpponent ?? -1]; return opp ? `Vs ${opp.name}` : '' })()

  // Built as elements with textContent (not innerHTML) so opponent names are
  // never interpreted as markup.
  el.replaceChildren()
  const stageLine = document.createElement('div')
  stageLine.style.cssText = 'font-size:15px;font-weight:bold;opacity:0.8;'
  stageLine.textContent = `Stage ${stageLabel(run.round)}`
  el.appendChild(stageLine)
  if (opponent) {
    const oppLine = document.createElement('div')
    oppLine.style.cssText = 'font-size:24px;font-weight:bold;margin-top:2px;'
    oppLine.textContent = opponent
    el.appendChild(oppLine)
  }
}

function renderLobby(): void {
  const panel = document.getElementById('lobby-panel')
  if (!panel) return
  if (!econActive()) { panel.style.display = 'none'; return }
  panel.style.display = 'block'

  const rows = run.players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.eliminated ? -1 : b.p.hp) - (a.p.eliminated ? -1 : a.p.hp))
    .map(({ p, i }) => {
      const isOpp = i === run.players[localSeatIndex].nextOpponent && !p.eliminated && !isCreepRound(run.round) && !isItemRound(run.round)
      const hpPct = Math.max(0, p.hp)
      const hpColor = p.hp > 60 ? '#44cc44' : p.hp > 30 ? '#ffcc00' : '#ff4444'
      return `<div class="lobby-row" data-pi="${i}" style="
        padding:5px 7px;margin-bottom:4px;border-radius:6px;
        border:1px solid ${isOpp ? '#cc4444' : '#223'};
        background:${isOpp ? 'rgba(80,20,20,0.35)' : 'rgba(8,12,24,0.6)'};
        opacity:${p.eliminated ? '0.4' : '1'};
      ">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#cde;">
          <span style="${p.eliminated ? 'text-decoration:line-through;color:#667;' : ''}font-weight:bold;">
            ${isOpp ? '⚔ ' : ''}${p.name}</span>
          <span style="color:#88aaff;">Lv ${p.level}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:3px;">
          <div style="flex:1;height:5px;background:#101828;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${hpPct}%;background:${hpColor};"></div>
          </div>
          <span style="font-size:10px;color:#99aacc;min-width:22px;text-align:right;">${p.eliminated ? '✝' : p.hp}</span>
        </div>
      </div>`
    }).join('')

  panel.innerHTML = `<h3 style="margin:0 0 6px;color:#88aaff;font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,0.9);">Lobby</h3>${rows}`
}

function renderEconUI(): void {
  renderEconBar()
  renderBenchRow()
  renderEnemyBenchRow()
  renderItemBench()
  renderLobby()
  renderRoundIndicator()
}

// The item bench: uncommitted items as clickable icons, 4 per page (2×2). Click
// one to pick it up (attach to cursor); click empty space in the bench while
// holding to drop it back. A ▲▼ pager below moves between pages. Slot/grid sizes
// are kept compact so the whole panel fits within the shop bar's height (the two
// are top-aligned — see alignItemBench).
const ITEM_BENCH_PAGE_SIZE = 4
const ITEM_SLOT_PX = 40
let itemBenchPage = 0

function renderItemBench(): void {
  const slots = document.getElementById('item-bench-slots')
  if (!slots) return
  const items = humanEcon().itemBench
  const maxPage = Math.max(0, Math.ceil(items.length / ITEM_BENCH_PAGE_SIZE) - 1)
  itemBenchPage = Math.max(0, Math.min(itemBenchPage, maxPage))   // clamp (items may have been removed)
  const start = itemBenchPage * ITEM_BENCH_PAGE_SIZE
  const shown = items.slice(start, start + ITEM_BENCH_PAGE_SIZE)

  // Fixed-width 2-column grid, centered — so the right column can never be clipped.
  const grid = `<div style="display:grid;grid-template-columns:${ITEM_SLOT_PX}px ${ITEM_SLOT_PX}px;gap:5px;justify-content:center;">${
    shown.map((id, i) => {
      const def = ITEM_MAP.get(id)
      const absIdx = start + i
      const icon = Math.round(ITEM_SLOT_PX * 0.8)
      return `<div class="item-slot" data-item-idx="${absIdx}" style="
        width:${ITEM_SLOT_PX}px;height:${ITEM_SLOT_PX}px;border:1px solid #335;border-radius:6px;background:#0e1a2a;
        display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <img class="item-slot-visual" src="${def?.iconPath ?? ''}" style="width:${icon}px;height:${icon}px;object-fit:contain;image-rendering:pixelated;pointer-events:none;" onerror="this.style.display='none'">
      </div>`
    }).join('')
  }</div>`

  // Single compact pager row below the grid (constant height, so the panel height
  // is stable): ▲ previous / ▼ next, each disabled at the ends. Hidden entirely
  // when everything fits on one page.
  const pager = maxPage > 0 ? (() => {
    const btn = (dir: number, symbol: string, disabled: boolean) => `
      <button ${disabled ? 'disabled' : `onclick="window.__itemBenchPage(event,${dir})"`}
        style="width:44px;height:15px;border:none;border-radius:4px;
               background:${disabled ? '#2a2d35' : '#58585c'};color:${disabled ? '#556' : '#fff'};
               font-size:10px;line-height:1;padding:0;cursor:${disabled ? 'default' : 'pointer'};">${symbol}</button>`
    return `<div style="display:flex;gap:6px;justify-content:center;flex-shrink:0;">
      ${btn(-1, '▲', itemBenchPage === 0)}${btn(1, '▼', itemBenchPage >= maxPage)}
    </div>`
  })() : ''

  slots.innerHTML = grid + pager

  slots.querySelectorAll<HTMLElement>('.item-slot').forEach(el => {
    el.addEventListener('click', (e) => {
      if (heldItem) return   // holding: let the click bubble to the bench-drop handler
      // Picking up: stop the event so it doesn't bubble to the container's drop
      // handler, which would see the just-set heldItem and instantly re-drop it.
      e.stopPropagation()
      const idx = Number(el.dataset.itemIdx)
      const id = humanEcon().itemBench[idx]
      if (!id) return
      humanEcon().itemBench.splice(idx, 1)
      tooltipHiddenReset()   // slot is about to be re-rendered away — drop its hover card
      pickUpItem(id)
      saveRun(run); renderItemBench()
    })
    // Hover card (name / stats / effect), like a unit hover — not while carrying an
    // item. mousemove too, so the card still shows if a slot re-renders under a
    // stationary cursor (the item is hopping but mouseenter never fired).
    const showHover = () => {
      if (heldItem) return
      const id = humanEcon().itemBench[Number(el.dataset.itemIdx)]
      if (id && currentTooltipSource === `item:${el.dataset.itemIdx}:${id}`) return
      showItemBenchTooltip(el)
    }
    el.addEventListener('mouseenter', showHover)
    el.addEventListener('mousemove', showHover)
    el.addEventListener('mouseleave', () => tooltipHiddenReset())
  })
  requestAnimationFrame(alignItemBench)
}

;(window as any).__itemBenchPage = (e: Event, dir: number) => {
  e.stopPropagation()   // don't let the click reach the bench-drop handler
  itemBenchPage += dir
  renderItemBench()
}

// Align the item bench's top edge with the shop bar (econ-bar): both are anchored
// bottom:0 in the same parent, so setting equal heights makes their tops line up.
// The panel's content is sized (compact slots + a single pager row) to fit inside
// this height — see renderItemBench.
function alignItemBench(): void {
  const box = document.getElementById('item-bench')
  const bar = document.getElementById('econ-bar')
  if (!box || !bar) return
  const h = bar.offsetHeight
  if (h > 0) box.style.height = `${h}px`
}

// Drop a held item back onto the item bench (click anywhere in the box while holding).
document.getElementById('item-bench')!.addEventListener('click', () => {
  if (!heldItem) return
  humanEcon().itemBench.push(heldItem)
  dropHeldItem()
  saveRun(run); renderItemBench()
})

// Show/hide all economy vs test-tools UI based on the mode checkbox.
// The shop + bench stay visible DURING combat (TFT lets you shop mid-fight);
// only game over hides them.
function updateEconVisibility(): void {
  const econ = econActive()
  const showEconPanels = econ && econPhase !== 'gameOver'
  document.getElementById('econ-wrap')!.style.display = showEconPanels ? 'flex' : 'none'
  document.getElementById('item-bench')!.style.display = showEconPanels ? 'flex' : 'none'
  document.getElementById('roster-section')!.style.display = econ ? 'none' : ''
  document.getElementById('lobby-panel')!.style.display = econ ? 'block' : 'none'
  for (const id of ['test-tools-header', 'test-tools-dummies', 'test-tools-tests']) {
    const el = document.getElementById(id)
    if (el) el.style.display = econ ? 'none' : ''
  }
  renderRoundIndicator()
  if (econ) renderEconUI()
  // Economy mode shows the canvas trait overlay, test mode the boxed sidebar
  // sections (see overlayModeActive) — refresh on every mode toggle.
  renderTraitDisplay()
  renderEnemyTraitDisplay()
  renderDamageMeter()
  applyLayoutMode()
  requestAnimationFrame(resizeCanvases)
}

// ─── Planning phase / game over transitions ──────────────────────────────────

// A per-run salt chosen once at boot, mixed with the round number, so each
// round's economy randomness (pairing, bot planning, item and crawler rolls)
// differs round to round without persisting a counter anywhere. Combat itself
// stays on unseeded Math.random per this project's decision to stream
// recorded fight logs rather than deterministically replay them — this seed
// governs ONLY the economy side of resolveRound. Phase 3 replaces this with a
// server-chosen seed derived from the room id and the round.
const roundSeedSalt = Math.floor(Math.random() * 0x7fffffff)
function roundSeedFor(state: RunState): number {
  return (state.round * 2654435761 + roundSeedSalt) >>> 0
}

// Captures the human's gold and bench occupancy immediately before a
// resolveRound() call, so applyRoundResult can diff against them afterward —
// resolveRound settles every seat internally and does not report Cave Crawler
// earthquake rewards per seat, so the summary line has to be reconstructed
// from a before/after snapshot instead.
function snapshotPreRound(): void {
  const h = humanEcon()
  preRoundGold = h.gold
  preRoundBenchOccupied = h.bench.filter(b => b !== null).length
}

// Reads this seat's SeatFightResult out of a resolved round, sets the
// opponent-preview index, builds the settlement summary line, resolves
// game-over for this seat, and persists. Called once per resolveRound() call
// (item round, creep round, and PvP round all funnel through here) — the
// single settlement path, replacing the old inline combat-end block.
//
// The income figure comes from the seat's pendingIncome delta (pendingIncome
// is banked to 0 by startPlanning at the start of every planning phase, so
// its value here IS this round's total — no second settleRound call needed).
// The base/interest/streak/win breakdown is recomputed from the same
// read-only formulas settleRound itself uses, against the gold snapshot
// snapshotPreRound captured just before resolveRound ran; hpLost comes
// straight from the seat's SeatFightResult.
function applyRoundResult(res: RoundResult): void {
  const mine = res.seats.find(s => s.seat === localSeatIndex)
  currentOpponentIndex = mine?.opponentSeat ?? -1

  if (mine) {
    const econ = humanEcon()
    const total = econ.pendingIncome
    const base = BASE_INCOME_BY_ROUND[res.round - 1] ?? BASE_INCOME_CAP
    const interest = Math.min(MAX_INTEREST, Math.floor(preRoundGold / 10))
    const streakGold = streakBonus(econ.streak)
    const winGold = mine.won ? WIN_BONUS : 0

    const prefix = res.kind === 'creep' ? `Cleared ${creepRoundDef(res.round)?.name ?? 'creeps'} · ` : ''
    lastSettlementLine =
      prefix +
      `+${total}g · base ${base} · interest ${interest}` +
      (streakGold ? ` · streak ${streakGold}` : '') +
      (winGold ? ` · win ${winGold}` : '') +
      ` | +${XP_PER_ROUND} XP` +
      (mine.hpLost ? ` · −${mine.hpLost} HP` : '')

    // Cave Crawler earthquake rewards for the human are now granted
    // authoritatively inside resolveRound (superseding the removed live
    // onLivePlayerQuake roll) — reconstruct the summary from the before/after
    // snapshot rather than a per-seat report resolveRound doesn't produce.
    const goldFromQuakes = Math.max(0, econ.gold - preRoundGold)
    const crawlersSpawned = Math.max(0, econ.bench.filter(b => b !== null).length - preRoundBenchOccupied)
    if (crawlersSpawned > 0 || goldFromQuakes > 0) {
      const parts: string[] = []
      if (crawlersSpawned > 0) parts.push(`+${crawlersSpawned} crawler${crawlersSpawned > 1 ? 's' : ''}`)
      if (goldFromQuakes > 0) parts.push(`+${goldFromQuakes}g quake`)
      lastSettlementLine += ` · ${parts.join(' · ')}`
    }
  }

  run.gameOver = checkGameOver(run, localSeatIndex)
  saveRun(run)
  renderEconUI()
}

function startPlanningPhase(rollIfUnlocked: boolean): void {
  econPhase = 'planning'
  returnHeldUnitToBench()
  const h = humanEcon()
  if (rollIfUnlocked) {
    // Banks every living seat's pendingIncome then rolls each unlocked (or
    // all-null) seat's shop — the round-engine's own planning step.
    startPlanning(run)
  } else {
    // Resume: bank but never roll — the persisted shop is what the player
    // left. Two callers want this: the boot path and the New Run button in
    // enterGameOver, both of which pass rollIfUnlocked=false to resume a
    // persisted/fresh shop without re-rolling it.
    if (h.pendingIncome) { h.gold += h.pendingIncome; h.pendingIncome = 0 }
  }
  syncRunToBoard()
  saveRun(run)
  updateEconVisibility()
  renderTraitDisplay()
  // Economy mode only — test mode is untimed free placement. Bots already
  // planned their round inside resolveRound right before this; this deadline
  // only auto-starts the human's next combat, it never touches bot logic.
  planningTimerStartTs = econActive() ? performance.now() : null
}

function enterGameOver(kind: 'win' | 'loss'): void {
  econPhase = 'gameOver'
  planningTimerStartTs = null
  updateEconVisibility()
  const box = document.getElementById('gameover-box')!
  const placement = kind === 'win' ? 1 : run.players.filter(p => !p.eliminated).length + 1
  box.style.display = 'block'
  box.style.borderColor = kind === 'win' ? '#e8b03e' : '#663333'
  box.innerHTML = `
    <div style="font-size:26px;font-weight:bold;color:${kind === 'win' ? '#f0c95c' : '#ff6666'};margin-bottom:6px;">
      ${kind === 'win' ? '🏆 VICTORY' : `DEFEAT — ${placement}${placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th'} place`}
    </div>
    <div style="font-size:12px;color:#99aacc;margin-bottom:16px;">Survived to round ${run.round} (stage ${stageLabel(run.round)})</div>
    <button id="btn-new-run" style="${ECON_BTN};font-size:14px;padding:9px 26px;">New Run</button>`
  document.getElementById('btn-new-run')!.addEventListener('click', () => {
    clearRun()
    run = newRun(botSeats())
    placedUnits.clear()
    initFreshRun()
    box.style.display = 'none'
    startPlanningPhase(false)
  })
}

// ─── Delibird item round (carousel) ───────────────────────────────────────────
// A non-combat round: Delibird swoops in, hops three times, then a tray of three
// random items expands from the centre. The player clicks one to keep it; the
// round then settles like a bye and advances.
const DELIBIRD_SWOOP_MS = 760
const DELIBIRD_HOPS_MS   = 1260

// Every item the human currently holds — uncommitted (item bench), on benched
// units, and on units placed on the board — so item rounds never re-offer a dupe.
function humanOwnedItems(): string[] {
  const h = humanEcon()
  const ids = [...h.itemBench]
  for (const b of h.bench) if (b?.item) ids.push(b.item)
  for (const u of getPlacedUnitsArray()) if (u.team === 'player' && u.items[0]) ids.push(u.items[0])
  return ids
}

function startItemRound(): void {
  econPhase = 'itemRound'
  planningTimerStartTs = null
  returnHeldUnitToBench()
  unitLayer.setHoveredUnit(null)
  updateEconVisibility()
  renderRoundIndicator()
  saveRun(run)

  const overlay  = document.getElementById('delibird-round')!
  const sprite   = document.getElementById('delibird-sprite')!
  const trayWrap = document.getElementById('delibird-tray-wrap') as HTMLElement
  const tray     = document.getElementById('delibird-tray') as HTMLElement
  overlay.style.display = 'block'
  overlay.style.pointerEvents = 'none'
  trayWrap.style.display = 'none'    // stays hidden until the hops finish
  tray.style.pointerEvents = 'none'
  tray.classList.remove('open')
  tray.innerHTML = ''

  // Phase 1 — swoop in from the left.
  sprite.classList.remove('delibird-swoop', 'delibird-hops')
  void (sprite as HTMLElement).offsetWidth   // restart animation
  sprite.classList.add('delibird-swoop')

  const choices = rollItemChoices(humanOwnedItems())

  // Phase 2 — three hops at varied angles.
  window.setTimeout(() => {
    sprite.classList.remove('delibird-swoop')
    void (sprite as HTMLElement).offsetWidth
    sprite.classList.add('delibird-hops')
  }, DELIBIRD_SWOOP_MS)

  // Phase 3 — reveal the item tray, expanding outward from the centre.
  window.setTimeout(() => {
    tray.innerHTML = choices.map(id => {
      const def = ITEM_MAP.get(id)
      return `<div class="delibird-item" data-item-id="${id}" style="
        width:96px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;flex-shrink:0;">
        <div class="delibird-item-visual" style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;
          background:rgba(20,30,50,0.9);border:1px solid #3a5a88;border-radius:10px;">
          <img src="${def?.iconPath ?? ''}" style="width:58px;height:58px;object-fit:contain;image-rendering:pixelated;pointer-events:none;" onerror="this.style.display='none'">
        </div>
        <div style="font-size:12px;font-weight:bold;color:#cfe0ff;text-align:center;white-space:nowrap;">${def?.name ?? id}</div>
      </div>`
    }).join('')
    // Target width = 3 cards (96) + gaps (22) + horizontal padding (2×20).
    const trayW = choices.length * 96 + Math.max(0, choices.length - 1) * 22 + 40
    tray.style.setProperty('--tray-w', `${trayW}px`)
    trayWrap.style.display = 'flex'    // now the jumps are done — reveal it
    tray.style.pointerEvents = 'auto'
    void tray.offsetWidth              // reflow so the width transition plays from 0
    tray.classList.add('open')
    tray.querySelectorAll<HTMLElement>('.delibird-item').forEach(el => {
      const id = el.dataset.itemId!
      const key = `delibird:${id}`
      el.addEventListener('click', () => finishItemRound(id))
      // Same hover card as the item bench: name / stats / effect. Driven off
      // mousemove as well as mouseenter — when the tray expands or an item hops
      // under a stationary cursor, CSS :hover activates (the item jumps) but
      // mouseenter never fires, so mousemove guarantees the card still appears.
      const show = () => { if (currentTooltipSource !== key) showItemCardTooltip(id, el, key) }
      el.addEventListener('mouseenter', show)
      el.addEventListener('mousemove', show)
      el.addEventListener('mouseleave', () => tooltipHiddenReset())
    })
  }, DELIBIRD_SWOOP_MS + DELIBIRD_HOPS_MS)
}

function finishItemRound(itemId: string | undefined): void {
  if (econPhase !== 'itemRound') return
  econPhase = 'planning'   // claim immediately so a double-click can't run this twice

  const overlay  = document.getElementById('delibird-round')!
  const trayWrap = document.getElementById('delibird-tray-wrap')!
  const tray     = document.getElementById('delibird-tray')!
  tray.style.pointerEvents = 'none'
  tray.classList.remove('open')
  trayWrap.style.display = 'none'
  overlay.style.display = 'none'
  tooltipHiddenReset()   // drop the hover card — the tray is being torn down

  if (itemId) humanEcon().itemBench.push(itemId)

  // Settle like a bye: income + XP, no HP loss / streak; bots take their bye,
  // pick an item, and plan — all inside resolveRound's item-round branch.
  snapshotPreRound()
  const res = resolveRound(run, roundSeedFor(run))
  applyRoundResult(res)
  const picked = itemId ? ITEM_MAP.get(itemId)?.name ?? itemId : 'nothing'
  lastSettlementLine = `Delibird · took ${picked} · ${lastSettlementLine}`

  if (run.gameOver) { enterGameOver(run.gameOver); return }
  startPlanningPhase(true)
  renderEconUI()
}

// Drop the held unit onto a player hex, creating its live Unit instance.
function placeHeldUnitOnHex(hex: OffsetCoord): void {
  const key = hexId(hex)
  const unit = makeUnit(heldUnit!.definitionId, 'player', heldUnit!.tier)
  unit.hexPos = { ...hex }
  unit.visualPos = hexToPixel(hex, HEX_SIZE)
  unit.placedAt = ++placementCounter
  if (heldUnit!.item) unit.items = [heldUnit!.item]
  placedUnits.set(key, unit)
}

// Handle a planning-phase click on the board canvas. Returns true if consumed.
function econBoardClick(hex: OffsetCoord, _clientX: number, _clientY: number): boolean {
  if (!econActive() || econPhase !== 'planning') return false
  const key = hexId(hex)
  const h = humanEcon()

  // Holding an item: click a player unit on the board to equip it.
  if (heldItem) {
    const target = placedUnits.get(key)
    if (target && target.team === 'player' && !target.isDummy) {
      equipHeldItemOn(target)
      syncBoardToRun()
      saveRun(run)
      renderEconUI()
    }
    return true   // consume the click either way (keep holding if it missed)
  }

  if (heldUnit) {
    if (![4, 5, 6, 7].includes(hex.row)) return true   // not a player hex — consume the click, keep holding

    const occupant = placedUnits.get(key)
    if (occupant) {
      // True swap: the occupant goes back to wherever the held unit came
      // from, and holding ends — it doesn't get attached to the cursor.
      const origin = heldFrom
      const occItem = occupant.items[0]
      placedUnits.delete(key)
      placeHeldUnitOnHex(hex)
      dropHeldUnit()
      if (origin) placeDisplacedUnitAtOrigin({ definitionId: occupant.definitionId, tier: occupant.tier as 1 | 2 | 3, item: occItem }, origin)
    } else {
      // Pillars don't count toward the board cap, so they're never blocked by it.
      if (!isCliffId(heldUnit.definitionId) && playerBoardUnitCount() >= boardCap(h)) { flashHeldUnitRejected(); return true }
      placeHeldUnitOnHex(hex)
      dropHeldUnit()
    }
    syncBoardToRun()
    saveRun(run)
    renderEconUI(); renderTraitDisplay()
    return true
  }

  // Nothing held — pick up the unit on this hex, if any
  const unit = placedUnits.get(key)
  if (unit && unit.team === 'player') {
    placedUnits.delete(key)
    pickUpUnit(unit.definitionId, unit.tier as 1 | 2 | 3, { kind: 'board', hex }, unit.items[0])
    syncBoardToRun()
    saveRun(run)
    renderBenchRow()
    return true
  }
  return false
}

// Hover a fielded unit during planning to preview its card (cursor-following;
// only fades in when the hovered hex changes, per ensureTooltipShown).
// Live combat uses the existing upper-left unit-info-panel instead.
function econBoardHover(e: MouseEvent): void {
  if (!econActive() || econPhase !== 'planning') {
    if (currentTooltipSource?.startsWith('board:')) tooltipHiddenReset()
    unitLayer.setHoveredUnit(null)
    return
  }
  const hex = eventToHex(e)
  const key = hexId(hex)
  const unit = placedUnits.get(key)
  if (unit && unit.team === 'player') {
    // Anchor to the unit's own sprite top (not the raw cursor position) so
    // the tooltip sits a consistent, small gap above it regardless of where
    // on the unit the mouse happens to be.
    const rect = cEff.getBoundingClientRect()
    const anchorX = rect.left + unit.visualPos.x
    // rect.top is OVERLAY_HEADROOM above the board (cEff is grown upward) — add it
    // back so the anchor lands on the unit's on-screen sprite top.
    const anchorY = rect.top + OVERLAY_HEADROOM + unit.visualPos.y * BOARD_PERSP_Y - (BOARD_SPRITE_HALF + BOARD_BARS_CLEARANCE) * BOARD_PERSP_Y
    showBoardUnitCardAt(unit.definitionId, unit.tier as 1 | 2 | 3, anchorX, anchorY, `board:${key}`)
    unitLayer.setHoveredUnit(unit.id)
    hoverUnitRef = { kind: 'board', hex }
  } else {
    if (currentTooltipSource?.startsWith('board:')) tooltipHiddenReset()
    unitLayer.setHoveredUnit(null)
    hoverUnitRef = null
  }
}

// Right-click during planning = sell the board unit under the cursor
function econBoardSell(hex: OffsetCoord): boolean {
  if (!econActive() || econPhase !== 'planning') return false
  const key = hexId(hex)
  const unit = placedUnits.get(key)
  if (!unit || unit.team !== 'player') return false
  if (isCliffId(unit.definitionId)) return true   // Ascender pillars can't be sold — consume the click
  syncBoardToRun()
  const idx = humanEcon().board.findIndex(e => e.hexPos.col === hex.col && e.hexPos.row === hex.row)
  if (idx === -1) return false
  sellFromBoard(run, humanEcon(), idx)
  placedUnits.delete(key)
  syncBoardToRun()
  saveRun(run)
  renderEconUI()
  renderTraitDisplay()
  return true
}

// ─── Combat state ─────────────────────────────────────────────────────────────
// (combatState itself is declared above the placed-units section)

let combatRunning = false
let speedMult = 1
let inOvertime = false
let accumulator = 0
let lastTs = 0
let inspectedUnitId: string | null = null
// The recorded log an economy fight is replaying, and the next frame index
// to apply. Non-null iff the game is currently playing back a resolveRound
// fight; both null/zero when combatRunning is a live test-mode simulation
// (playbackLog null then discriminates "test-mode ticking" from "replaying"
// in frame()'s per-tick branch) or when no combat is running at all.
let playbackLog: FightLog | null = null
let playbackIndex = 0

interface UnitSnapshot { definitionId: string; tier: number; hexPos: { col: number; row: number }; item?: string }
let preCombatSnapshot: UnitSnapshot[] = []
let autoResetTimer: ReturnType<typeof setTimeout> | null = null
let victoryCelebrationTs = 0   // performance.now() when combat ended; 0 = not celebrating
let earthquakeFlashTs    = 0   // performance.now() of last earthquake VFX; 0 = none

// Planning-phase deadline: economy mode only (never test mode) gives the
// human a fixed window to shop/place before combat auto-starts. Bots don't
// get any extra actions from this — they already plan exactly once per round
// inside resolveRound (combat start, see startCombat), so ticking this
// countdown must never itself call botPlanRound.
const PLANNING_TIME_LIMIT_MS = 30000
let planningTimerStartTs: number | null = null   // null = no countdown running

function startCombat(): void {
  // In a lobby the server resolves the round and streams back the fight it
  // recorded; re-simulating locally would produce a DIFFERENT outcome from
  // the one the server settled against (COMBAT-02). Plan 04-06 replaces this
  // guard with playback of the server's log.
  if (isNetworked()) return

  const testMode = (document.getElementById('chk-test-mode') as HTMLInputElement).checked

  // Delibird item round (economy mode only): no combat — the player picks one of
  // three offered items. Runs its own overlay sequence, then advances the round.
  if (!testMode && econActive() && econPhase !== 'itemRound' && !run.gameOver && isItemRound(run.round)) {
    startItemRound()
    return
  }
  if (econPhase === 'itemRound') return   // already mid-carousel — ignore repeat Start

  returnHeldUnitToBench()   // never lose a unit still attached to the cursor
  planningTimerStartTs = null
  playbackLog = null
  playbackIndex = 0

  const allPlaced = getPlacedUnitsArray()
  let playerUnits = allPlaced.filter(u => u.team === 'player')
  let enemyUnits  = allPlaced.filter(u => u.team === 'enemy')

  if (testMode) {
    // Test mode: use exactly what's placed — no mirroring, no auto enemies.
    // Need at least one unit on each side for the win condition to work.
    // Unlike economy mode, test mode has no RunState and no round to
    // resolve — it still builds a live CombatState and ticks it directly.
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

    preCombatSnapshot = playerUnits.map(u => ({
      definitionId: u.definitionId,
      tier: u.tier as 1 | 2 | 3,
      hexPos: { ...u.hexPos },
      item: u.items[0],
    }))
    if (autoResetTimer !== null) { clearTimeout(autoResetTimer); autoResetTimer = null }
    combatState = createCombatState(playerUnits, enemyUnits, undefined)
  } else {
    // Economy mode: the round is fought and settled by resolveRound BEFORE
    // any frame is drawn — the browser then plays back the recorded log
    // rather than simulating the fight itself.
    if (econPhase === 'gameOver' || run.gameOver) return
    // Fill the board up to the player's level from the bench before locking in.
    autoFieldFromBench()
    playerUnits = getPlacedUnitsArray().filter(u => u.team === 'player')
    syncBoardToRun()   // the engine reads run.players[..].board — commit first

    econPhase = 'combat'
    updateEconVisibility()
    unitLayer.setHoveredUnit(null)

    snapshotPreRound()
    const res = resolveRound(run, roundSeedFor(run))
    applyRoundResult(res)   // settles, advances the round, announces next matchup

    const mine = res.seats.find(s => s.seat === localSeatIndex)

    if (!mine || mine.logIndex === null) {
      // A bye (odd seat out) — nothing to watch. Settlement already ran
      // above; go straight to the next planning phase / game over.
      lastWinProb = null
      lastPowerDelta = 0
      pendingBattle = null
      combatState = null
      combatRunning = false
      saveRun(run)
      if (run.gameOver) { enterGameOver(run.gameOver); return }
      startPlanningPhase(true)
      return
    }

    playbackLog = res.logs[mine.logIndex]
    playbackIndex = 0
    if (playbackLog.seatB === localSeatIndex) {
      // Defensive only: src/game/round.ts's resolvePvpRound always records a
      // human-vs-bot fight with the human as seatA, so this should be
      // unreachable in single-player. A human-vs-human pairing (Phase 4) has
      // no single correct seatA choice from inside that seat-agnostic
      // function and would hit this — flag it loudly rather than silently
      // rendering the human's own board flipped and colored 'enemy'.
      console.warn('[playback] local seat recorded as seatB of its own fight log — rendering may be mirrored (expected only for a future human-vs-human matchup)')
    }
    combatState = createPlaybackState(playbackLog)

    // Rebuild placedUnits from this seat's committed board — resolveRound
    // may have moved the round forward and reset planning-phase state, so
    // rebuild explicitly rather than trusting placedUnits' pre-fight contents.
    placedUnits.clear()
    for (const e of humanEcon().board) {
      const unit = makeUnit(e.definitionId, 'player', e.tier)
      unit.hexPos = { ...e.hexPos }
      unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
      if (e.item) unit.items = [e.item]
      placedUnits.set(hexId(unit.hexPos), unit)
    }
    playerUnits = getPlacedUnitsArray().filter(u => u.team === 'player')
    preCombatSnapshot = playerUnits.map(u => ({
      definitionId: u.definitionId,
      tier: u.tier as 1 | 2 | 3,
      hexPos: { ...u.hexPos },
      item: u.items[0],
    }))
    if (autoResetTimer !== null) { clearTimeout(autoResetTimer); autoResetTimer = null }

    // Win prediction + calibration setup, now after resolveRound, keyed on
    // the opponent resolveRound actually paired this seat against.
    if (mine.opponentSeat >= 0) {
      const opp = run.players[mine.opponentSeat]
      const enemyBoardUnits = opp.board.map(e2 => {
        const u = makeUnit(e2.definitionId, 'enemy', e2.tier)
        u.hexPos = { col: e2.hexPos.col, row: 7 - e2.hexPos.row }
        u.visualPos = hexToPixel(u.hexPos, HEX_SIZE)
        if (e2.item) u.items = [e2.item]
        return u
      })
      calibParams = loadCalibration()
      const pProfile = calcBoardProfile(playerUnits)
      const eProfile = calcBoardProfile(enemyBoardUnits)
      lastPowerDelta = pProfile.power > 0 ? (eProfile.power - pProfile.power) / pProfile.power : 0
      const pf = boardFeat(pProfile)
      const ef = boardFeat(eProfile)
      const pred = predictWinProb(pf, ef, calibParams)
      lastWinProb = pred.p
      pendingBattle = {
        pf, ef,
        rawDelta: lastPowerDelta,
        predWin: pred.p,
        unitIds: new Set([...playerUnits, ...enemyBoardUnits].map(u => u.id)),
      }
    } else {
      // Creep round (opponentSeat -1) — not calibration data, matching today.
      lastWinProb = null
      lastPowerDelta = 0
      pendingBattle = null
    }

    saveRun(run)
  }

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
    getCalibration: () => ({ ...calibParams, brier30: recentBrier(calibParams) }),
    getBattleLog:   () => loadBattleLog(),
    resetCalibration: () => { calibParams = resetCalibration() },
  }

  boardLayer.setCombatActive(true)
  setCombatBarState('running')
  document.getElementById('result-box')!.style.display = 'none'
  document.getElementById('combat-info')!.textContent = ''
  applyLayoutMode()
}

function restorePlayerBoard(): void {
  autoResetTimer       = null
  victoryCelebrationTs = 0
  inOvertime           = false
  document.getElementById('overtime-box')!.style.display = 'none'
  combatRunning        = false
  combatState          = null
  playbackLog = null
  playbackIndex        = 0
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
    if (snap.item) unit.items = [snap.item]
    placedUnits.set(hexId(unit.hexPos), unit)
  }

  boardLayer.setCombatActive(false)
  unitLayer.setTailwind(false)
  boardLayer.setSunny(false)
  boardLayer.setTerrainPulse(null)
  boardLayer.setEarthquakeFlash(0)
  earthquakeFlashTs = 0
  unitLayer.setRingPassAnim(null)
  setCombatBarState('idle')
  renderCombatTimer()
  renderSunEffect()
  renderTerrainIndicator()
  renderTraitDisplay()
  renderEnemyTraitDisplay()
  renderDamageMeter()
  applyLayoutMode()

  // Economy mode: next planning phase (fresh shop) or the run is over
  if (econActive()) {
    if (run.gameOver) enterGameOver(run.gameOver)
    else startPlanningPhase(true)
  }
}

// Layout belongs to the mode, not to the combat phase. Test mode is the dev
// view: both sidebars stay up the whole time (roster + test tools), so units
// can be searched and placed mid-session. Economy mode is the play view: board,
// shop/bench, lobby and the canvas trait overlay only — the left roster panel
// is gone entirely and the right panel carries just the lobby scoreboard.
function applyLayoutMode(): void {
  const testMode = !econActive()
  document.getElementById('left-panel')!.style.display = testMode ? '' : 'none'
  // The right panel stays mounted in both modes (test tools / lobby). Width is
  // set explicitly rather than via display:none so the inner flex scroll
  // container keeps its computed height.
  const rp = document.getElementById('right-panel')!
  rp.style.display = 'flex'
  rp.style.width = '200px'
  rp.style.minWidth = '200px'
  rp.style.padding = '10px'
  // Test mode keeps an opaque dark panel so the Test Tools read clearly. The
  // play view drops the panel background entirely so the Lobby (its rows carry
  // their own translucent cards) floats directly over the grass.
  if (testMode) {
    rp.style.background = '#0a0e1a'
    rp.style.borderLeft = '1px solid #223'
  } else {
    rp.style.background = 'transparent'
    rp.style.borderLeft = 'none'
  }
  document.getElementById('btn-open-panel')!.style.display = 'none'
  // Trait overlay vs boxed-sidebar display is owned by renderTraitDisplay /
  // renderEnemyTraitDisplay (see overlayModeActive) — called right below.
  if (!combatState) { lastPowerDelta = null; lastWinProb = null; pendingBattle = null }
  renderTraitDisplay()
  renderEnemyTraitDisplay()
  renderDamageMeter()
  renderPowerDelta()
  // Recenter the board after the sidebar layout change settles.
  requestAnimationFrame(resizeCanvases)
}

function resetCombat(): void {
  if (autoResetTimer !== null) { clearTimeout(autoResetTimer); autoResetTimer = null }
  victoryCelebrationTs = 0
  inOvertime = false
  document.getElementById('overtime-box')!.style.display = 'none'
  combatRunning = false
  combatState   = null
  playbackLog   = null
  playbackIndex = 0
  placedUnits.clear()
  inspectedUnitId = null
  document.getElementById('unit-info-panel')!.style.display = 'none'

  boardLayer.setCombatActive(false)
  boardLayer.setSunny(false)
  setCombatBarState('idle')
  lastPowerDelta = null
  lastWinProb = null
  pendingBattle = null
  renderTraitDisplay()
  renderEnemyTraitDisplay()
  renderDamageMeter()
  document.getElementById('result-box')!.style.display = 'none'
  document.getElementById('combat-info')!.textContent = ''
  applyLayoutMode()

  // Economy mode: a mid-combat reset now abandons a REPLAY, not a round. In
  // the pre-engine game a reset here really did discard an unconsumed round
  // (no settlement had happened yet); now resolveRound already fought and
  // settled the round back in startCombat, before the first frame was even
  // drawn, so the round this replay was showing is already resolved and
  // banked. A reset stops watching it and goes to planning for the
  // ALREADY-ADVANCED round — it does not, and cannot, replay an unconsumed
  // round anymore. This is a deliberate behaviour change from before this
  // plan (see 02-05-SUMMARY.md), not a bug: the player keeps every gold/XP/HP
  // change the fight they didn't finish watching already applied.
  if (econActive()) {
    if (run.gameOver) enterGameOver(run.gameOver)
    else startPlanningPhase(false)
  }
}

// Test-mode-only tick body (economy mode replays a recorded log via
// applyFrame instead — see frame()'s playbackLog branch). Still shares its
// per-tick engine call with the headless sim so test-mode combat and every
// simulation run identical movement/attack/cast logic; only the terminal
// win/loss + overtime handling below is live-specific.
function tickCombat(state: CombatState): boolean {
  advanceCombatTick(state)

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
  if (!inOvertime && state.tick >= 1800) {
    inOvertime = true
    document.getElementById('overtime-box')!.style.display = 'block'
  }
  // Safety valve: draw after 30 extra seconds of overtime (tick 3600)
  if (state.tick >= 3600) { state.phase = 'combat'; return true }
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
  returnHeldUnitToBench()
  if (econActive()) {
    // Back to economy mode: discard test placements, restore the run board
    if (run.gameOver) enterGameOver(run.gameOver)
    else startPlanningPhase(false)
  } else {
    // Into test mode: hide econ UI, keep whatever is placed for testing
    planningTimerStartTs = null
    document.getElementById('gameover-box')!.style.display = 'none'
    updateEconVisibility()
  }
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

// Make the combat/test-mode panel draggable by its top-right handle. Switches the
// panel to left/top anchoring on first drag (clearing the default bottom/right),
// flags combatBarMoved so resizeCanvases stops re-anchoring it, and clamps it to
// stay on-screen relative to its offset parent.
;(() => {
  const bar = document.getElementById('combat-bar') as HTMLElement | null
  const handle = document.getElementById('combat-bar-drag') as HTMLElement | null
  if (!bar || !handle) return
  let dragging = false
  let startX = 0, startY = 0, startLeft = 0, startTop = 0

  const onMove = (e: MouseEvent) => {
    if (!dragging) return
    const parent = (bar.offsetParent as HTMLElement | null) ?? document.body
    const maxLeft = Math.max(0, parent.clientWidth - bar.offsetWidth)
    const maxTop = Math.max(0, parent.clientHeight - bar.offsetHeight)
    const left = Math.min(maxLeft, Math.max(0, startLeft + (e.clientX - startX)))
    const top = Math.min(maxTop, Math.max(0, startTop + (e.clientY - startY)))
    bar.style.left = `${left}px`
    bar.style.top = `${top}px`
  }
  const onUp = () => {
    dragging = false
    handle.style.cursor = 'grab'
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    // On first drag, convert from bottom/right anchoring to left/top at the current spot.
    if (!combatBarMoved) {
      const parent = (bar.offsetParent as HTMLElement | null) ?? document.body
      const pr = parent.getBoundingClientRect()
      const br = bar.getBoundingClientRect()
      bar.style.left = `${br.left - pr.left}px`
      bar.style.top = `${br.top - pr.top}px`
      bar.style.right = 'auto'
      bar.style.bottom = 'auto'
      combatBarMoved = true
    }
    dragging = true
    startX = e.clientX; startY = e.clientY
    startLeft = parseFloat(bar.style.left) || 0
    startTop = parseFloat(bar.style.top) || 0
    handle.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  })
})()

// Collapse toggle for the combat/test-mode panel — hides everything below the
// Test Mode row (start/pause/stop/reset, speed, result box) so it can be
// shrunk out of the way without losing the Test Mode checkbox.
;(() => {
  const btn = document.getElementById('btn-combat-bar-collapse') as HTMLButtonElement | null
  const body = document.getElementById('combat-bar-body') as HTMLElement | null
  if (!btn || !body) return
  let collapsed = false
  btn.addEventListener('click', () => {
    collapsed = !collapsed
    body.style.display = collapsed ? 'none' : 'flex'
    btn.textContent = collapsed ? '▸' : '▾'
    btn.title = collapsed ? 'Expand panel' : 'Collapse panel'
  })
})()

document.getElementById('btn-pause')!.addEventListener('click', () => {
  if (!combatRunning) return
  combatRunning = false
  setCombatBarState('paused')
})

document.getElementById('btn-stop')!.addEventListener('click', () => {
  resetCombat()
})

document.getElementById('btn-reset')!.addEventListener('click', () => {
  if (econActive()) {
    // Economy mode: abandon the current run and start a fresh one
    if (!confirm('End this run and start a new one?')) return
    resetCombat()   // full combat/VFX teardown (safe outside combat too)
    document.getElementById('gameover-box')!.style.display = 'none'
    clearRun()
    run = newRun(botSeats())
    placedUnits.clear()
    initFreshRun()
    startPlanningPhase(false)
    return
  }
  resetCombat()
})

// ─── Test search ─────────────────────────────────────────────────────────────

document.getElementById('test-search')!.addEventListener('input', () => renderTestButtons())

// ─── Panel collapse ───────────────────────────────────────────────────────────

document.getElementById('btn-close-panel')!.addEventListener('click', () => {
  document.getElementById('right-panel')!.style.display = 'none'
  document.getElementById('btn-open-panel')!.style.display = ''
})

document.getElementById('dmg-meter-tab-mine')!.addEventListener('click', () => {
  damageMeterTeam = 'player'
  renderDamageMeter()
})
document.getElementById('dmg-meter-tab-enemy')!.addEventListener('click', () => {
  damageMeterTeam = 'enemy'
  renderDamageMeter()
})
document.getElementById('dmg-meter-stat-dealt')!.addEventListener('click', () => {
  damageMeterStat = 'dealt'
  renderDamageMeter()
})
document.getElementById('dmg-meter-stat-taken')!.addEventListener('click', () => {
  damageMeterStat = 'taken'
  renderDamageMeter()
})
document.getElementById('dmg-meter-collapse')!.addEventListener('click', () => {
  damageMeterCollapsed = !damageMeterCollapsed
  renderDamageMeter()
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

  const spriteEl = document.getElementById('uip-sprite') as HTMLImageElement
  const spritePath = UNIT_MAP.get(unit.definitionId)?.spritePath
  if (spritePath && !unit.isDummy) {
    spriteEl.src = spritePath
    spriteEl.style.display = ''
  } else {
    spriteEl.style.display = 'none'
  }

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

  const beachVibesHtml = (unit.types.includes('beachy') && combatState)
    ? (() => {
        const stacks = combatState.spellBuffCounters.get(unit.id) ?? 0
        return `
          <div style="margin-top:6px;padding:5px 8px;background:#0a1a2e;border:1px solid #1e4060;border-radius:5px;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#38bdf8;font-size:11px;font-weight:bold;">Beach Vibes</span>
            <span style="color:#7dd3fc;font-weight:bold;">${stacks}</span>
          </div>`
      })()
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
        <span style="color:#aaa;">${Math.round(unit.currentMana)} / ${unit.maxMana}${(() => {
          const regen = unit.maxMana > 0 ? keenEyeRegenBonus(unit.definitionId, unit.team) : null
          return regen ? ` <span style="color:#5ad0e8;">+${regen}/s</span>` : ''
        })()}</span>
      </div>
      <div style="${barBase}">
        <div style="height:100%;width:${(manaPct*100).toFixed(1)}%;background:#3377ff;border-radius:3px;"></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;color:#aaa;margin-bottom:4px;">
      <span style="color:#556;">ATK</span><span>${Math.round(computeStats(unit).attack)}</span>
      <span style="color:#556;">SP.ATK</span><span>${Math.round(computeStats(unit).special)}</span>
      <span style="color:#556;">DEF</span><span>${Math.round(computeStats(unit).defense)}</span>
      <span style="color:#556;">SP.DEF</span><span>${Math.round(computeStats(unit).spDefense)}</span>
      <span style="color:#556;">ATK SPD</span><span>${Math.min(computeStats(unit).attackSpeed, 5).toFixed(2)}/s</span>
      <span style="color:#556;">CRIT</span><span>${Math.round(computeStats(unit).critChance * 100)}%</span>
      ${computeStats(unit).omnivamp > 0 ? `<span style="color:#556;">OMNIVAMP</span><span style="color:#4ecdc4;">${Math.round(computeStats(unit).omnivamp * 100)}%</span>` : ''}
      ${(() => {
        // Durability = combined % modifier on defense + spDefense from all sources
        let mult = 1
        for (const fx of unit.statusEffects) {
          const mag = fx.magnitude ?? 0
          if (mag === 0) continue
          if (fx.id === 'aqua_ring_durability' || fx.id === 'iron_barbs_durability' ||
              fx.id === 'fez_durability' || fx.id === 'mystic_durability') {
            mult *= 1 + mag
          } else if (fx.id === 'mystic_sunder') {
            mult *= 1 - mag
          }
        }
        const pct = Math.round((mult - 1) * 100)
        if (pct === 0) return ''
        const color = pct > 0 ? '#4ecdc4' : '#e06c6c'
        const sign  = pct > 0 ? '+' : ''
        return `<span style="color:#556;">DURABILITY</span><span style="color:${color};">${sign}${pct}%</span>`
      })()}
      ${(() => {
        // Damage amp = additive sum of all damage_amp statuses (matches applyDamage)
        let amp = 0
        for (const fx of unit.statusEffects) {
          if (fx.id === 'damage_amp') amp += fx.magnitude ?? 0
        }
        const pct = Math.round(amp * 100)
        if (pct === 0) return ''
        const raging = unit.statusEffects.some(fx => fx.stackId === 'crashout_rage')
        const color = raging ? '#ff6b5e' : '#e0a05c'
        return `<span style="color:#556;">DMG AMP</span><span style="color:${color};">+${pct}%</span>`
      })()}
      ${(() => {
        const hsp = computeStats(unit).healShieldPower
        const hbFx = unit.statusEffects.find(fx => fx.id === 'healBlock')
        const effective = Math.round((1 + hsp) * (hbFx?.magnitude ? (1 - hbFx.magnitude) : 1) * 100)
        const color = effective > 100 ? '#7ecba1' : effective < 100 ? '#e06c6c' : '#aaa'
        return `<span style="color:#556;">HEAL/SHIELD</span><span style="color:${color};">${effective}%</span>`
      })()}
      <span style="color:#556;">Range</span><span>${unit.range}</span>
      <span style="color:#556;">State</span><span style="color:#88aaff;">${unit.state}</span>
    </div>
    ${(() => {
      const ability = UNIT_MAP.get(unit.definitionId)?.ability
      if (!ability) return ''
      return `<div style="margin:6px 0;padding-top:6px;border-top:1px solid #223;">
        <div style="color:#e8b04e;font-weight:bold;font-size:10px;margin-bottom:2px;">${ability.name}</div>
        <div style="color:#99aacc;font-size:10px;line-height:1.4;font-family:sans-serif;">${ability.description}</div>
      </div>`
    })()}
    ${statusHtml}
    ${beachVibesHtml}
  `
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

document.getElementById('btn-snapshot')!.addEventListener('click', () => {
  const input = document.getElementById('snapshot-name') as HTMLInputElement
  const label = input.value.trim() || `Board ${loadSnapshots().length + 1}`
  snapshotCurrentBoard(label)
  input.value = ''
})

// Push every local test to the repo in one click (dev only).
// After clicking, commit tests/*.json and src/repoTests.ts to share with the team.
document.getElementById('btn-push-all-tests')!.addEventListener('click', async () => {
  if (!import.meta.env.DEV) return
  const btn = document.getElementById('btn-push-all-tests') as HTMLButtonElement
  btn.textContent = '⏳ Pushing…'
  btn.disabled    = true
  const snaps     = loadSnapshots()
  for (const snap of snaps) {
    await fetch('/api/save-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snap),
    }).catch(() => {})
  }
  btn.textContent = `✓ Done (${snaps.length} pushed)`
  setTimeout(() => { btn.textContent = '⬆ Push local → repo'; btn.disabled = false }, 3000)
})

// ─── Mouse events ─────────────────────────────────────────────────────────────

function eventToHex(e: MouseEvent): OffsetCoord {
  const rect = cEff.getBoundingClientRect()
  // cEff is grown upward by OVERLAY_HEADROOM, so subtract it to get board-space y,
  // then inverse the perspective Y-scale so hex coords map correctly.
  return pixelToHex(e.clientX - rect.left, (e.clientY - rect.top - OVERLAY_HEADROOM) / BOARD_PERSP_Y, HEX_SIZE)
}

cEff.addEventListener('mousemove', (e) => {
  boardLayer.setHovered(eventToHex(e))
  econBoardHover(e)
})
cEff.addEventListener('mouseleave', () => {
  boardLayer.setHovered(null)
  if (currentTooltipSource?.startsWith('board:')) tooltipHiddenReset()
  unitLayer.setHoveredUnit(null)
})
cEff.addEventListener('click', (e) => {
  // During combat: click a unit to inspect it
  if (combatState) {
    const rect = cEff.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top - OVERLAY_HEADROOM   // cEff grown upward by headroom
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
  if (econBoardClick(hex, e.clientX, e.clientY)) return   // economy mode: bench/board move semantics
  if (selectedUnitId) {
    placeUnit(hex)
  }
})
cEff.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  if (combatRunning) return
  const hex = eventToHex(e)
  if (econBoardSell(hex)) return    // economy mode: right-click = sell
  if (econActive()) return          // never free-delete in economy mode
  removeUnit(hex)
})

// ─── Render loop ──────────────────────────────────────────────────────────────

const posCache = new Map<string, { x: number; y: number }>()

function frame(ts: number): void {
  requestAnimationFrame(frame)

  if (lastTs === 0) lastTs = ts
  const dt = Math.min((ts - lastTs) / 1000, 0.1) * speedMult * (inOvertime ? 2 : 1)
  lastTs = ts

  let done = false
  if (combatRunning && combatState) {
    accumulator += dt
    const step = 1 / TICK_RATE
    const testMode = (document.getElementById('chk-test-mode') as HTMLInputElement).checked
    while (accumulator >= step && !done) {
      accumulator -= step
      if (playbackLog) {
        // Economy mode: advance the recorded log instead of ticking a live
        // sim — the browser never runs a combat tick for an economy fight;
        // the outcome it shows is the outcome resolveRound already settled
        // at combat start.
        if (playbackIndex >= playbackLength(playbackLog)) {
          done = true
        } else {
          const f = playbackLog.frames[playbackIndex++]
          applyFrame(combatState, f)
          // Live combat populated combatState.units in full at fight start,
          // so the trait panels (which read combatState.units) had data
          // immediately. Playback builds combatState empty and fills it in
          // as frames apply — nothing else re-renders the panels as that
          // happens, so re-render here each tick to pick up the roster
          // (including any mid-fight summons/despawns changing trait counts).
          renderTraitDisplay()
          renderEnemyTraitDisplay()
          renderDamageMeter()
          // The overtime speed-up survives playback: a live fight flipped
          // this at tick 1800, so the recorded frame reaching that tick
          // triggers the same 2× speed and banner.
          if (!inOvertime && f.tick >= 1800) {
            inOvertime = true
            document.getElementById('overtime-box')!.style.display = 'block'
          }
        }
      } else {
        // Test mode only — tickCombat's header comment records that.
        done = tickCombat(combatState)
        // In test mode: suppress the tick-limit timeout, but still stop on a real team wipe
        if (testMode && combatState.phase === 'combat') done = false
        renderDamageMeter()
      }
      for (const [id, u] of combatState.units) posCache.set(id, { ...u.visualPos })
      for (const ev of combatState.events) {
        if (ev.type === 'vfx' && ev.effectId === 'earthquake') {
          // The screen flash is presentation and must still fire during
          // playback. The crawler/gold reward itself is now rolled
          // authoritatively at settlement (resolveRound), not live per quake
          // — see applyRoundResult's quake-reward summary.
          earthquakeFlashTs = performance.now()
        }
        if (ev.type === 'vfx' && ev.effectId === 'cliff_fall') {
          unitLayer.addCliffFall({ x: ev.x, y: ev.y, direction: ev.direction, col: ev.col, isLeft: ev.isLeft })
          boardLayer.addCliffFallPulse(ev.col, ev.row, ev.direction)
        }
        if (ev.type === 'vfx' && ev.effectId === 'aqua_ring_pass') {
          unitLayer.setRingPassAnim({
            fromX: ev.fromX, fromY: ev.fromY,
            toX: ev.toX, toY: ev.toY,
            toUnitId: ev.toUnitId,
            startTs: performance.now(),
            level: ev.level,
          })
        }
      }
      effectLayer.processEvents(combatState.events, posCache, combatState.units)
    }

    if (done) {
      inOvertime = false
      document.getElementById('overtime-box')!.style.display = 'none'
      combatRunning = false
      victoryCelebrationTs = performance.now()
      effectLayer.clearCastAnimations()
      setCombatBarState('idle')

      // Playback's winner is the recorded field verbatim, never re-derived
      // from reconstructed unit state — see playbackWinner's own comment and
      // T-02-20 in this plan's threat model. Test mode still reads phase.
      const winner = playbackLog ? playbackWinner(playbackLog)
                   : combatState.phase === 'playerWin' ? 'player'
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

      // Calibration feedback: record this battle and refit the model.
      // Skipped for test-mode combats (no pendingBattle was captured).
      if (pendingBattle) {
        const y: 0 | 0.5 | 1 = winner === 'player' ? 1 : winner === 'enemy' ? 0 : 0.5

        // Margin: winner's mean surviving HP fraction over their STARTING units
        let margin = 0
        if (winner !== 'draw') {
          const winTeam = winner === 'player' ? 'player' : 'enemy'
          let sum = 0
          let count = 0
          for (const u of combatState.units.values()) {
            if (u.team !== winTeam || u.isDummy) continue
            if (!pendingBattle.unitIds.has(u.id)) continue  // exclude summons
            sum += u.state !== 'dead' ? u.currentHp / u.maxHp : 0
            count++
          }
          margin = count > 0 ? sum / count : 0
        }

        const records = appendBattle({
          t: Date.now(),
          pf: pendingBattle.pf,
          ef: pendingBattle.ef,
          rawDelta: pendingBattle.rawDelta,
          predWin: pendingBattle.predWin,
          y,
          margin,
        })
        calibParams = recordAndLearn(records)
        console.log('[calib]', {
          n: calibParams.n,
          k: +calibParams.k.toFixed(3),
          b: +calibParams.b.toFixed(3),
          w: {
            trait: +calibParams.w.trait.toFixed(3),
            tier3: +calibParams.w.tier3.toFixed(3),
            cost3: +calibParams.w.cost3.toFixed(3),
          },
          brier30: recentBrier(calibParams)?.toFixed(3) ?? 'n/a',
          predicted: pendingBattle.predWin.toFixed(2),
          outcome: y,
        })
        pendingBattle = null
      }

      // Economy settlement already happened in startCombat (resolveRound +
      // applyRoundResult, before this fight was even shown) — just surface
      // the settlement line the browser has been holding in lastSettlementLine
      // since combat start.
      if (playbackLog) {
        box.innerHTML = `${box.textContent}<div style="font-size:10px;font-weight:normal;margin-top:4px;opacity:0.85;">${lastSettlementLine}</div>`
      }

      if (autoResetTimer === null) {
        autoResetTimer = setTimeout(restorePlayerBoard, 5000)
      }
    }

    document.getElementById('combat-info')!.textContent =
      `Tick: ${combatState.tick} (${(combatState.tick / TICK_RATE).toFixed(1)}s)`
  }

  updateUnitInfoPanel()
  renderCombatTimer()
  renderPlanningTimer()
  renderSunEffect()
  renderTerrainIndicator()
  drawDimOverlay(combatRunning)
  dimSidePanel(false)
  unitLayer.setTailwind(!!(combatState?.tailwind && (combatState.tailwind.player || combatState.tailwind.enemy)))
  boardLayer.setSunny(combatState?.terrain.sunny ?? false)
  boardLayer.setTerrainPulse(combatState ? activeTerrainPulseColor(combatState.terrain) : null)
  boardLayer.setEarthquakeFlash(earthquakeFlashTs)
  // Planning-phase board-fill watermark: units fielded / level cap (e.g. "6/6").
  if (econActive() && econPhase === 'planning' && !combatState) {
    const lvl = humanEcon().level
    const cnt = playerBoardUnitCount()
    boardLayer.setBoardCountLabel(`${cnt}/${lvl}`, cnt >= lvl)
  } else {
    boardLayer.setBoardCountLabel(null)
  }
  boardLayer.draw()

  if (combatState) {
    unitLayer.draw(combatState.units, combatRunning, victoryCelebrationTs, effectLayer.getHealFlashUnits(), effectLayer.getCastAnimations(), combatState.tick)
    unitLayer.drawItems(combatState.units)
    effectLayer.draw(combatState)
    unitLayer.drawAllHealthBars(combatState.units)
  } else {
    // Preview placed units
    const preview = new Map<string, Unit>()
    for (const u of placedUnits.values()) preview.set(u.id, u)

    // Show ruiner stone on precombat board if trait is active
    const ruinerSpeciesInBuilder = new Set(
      [...placedUnits.values()].filter(u => u.types.includes('ruiner')).map(u => u.definitionId)
    )
    if (ruinerSpeciesInBuilder.size >= 3) {
      const stoneHex = { col: 3, row: 4 }
      const stonePx  = hexToPixel(stoneHex, HEX_SIZE)
      const stone: Unit = {
        id: 'ruiner_stone_preview', definitionId: 'ruiner_stone', name: 'Ruiner Stone',
        team: 'player', tier: 1,
        hexPos: stoneHex, visualPos: stonePx,
        moveProgress: 0, path: [],
        maxHp: 999999, currentHp: 999999, maxMana: 0, currentMana: 0,
        attack: 0, special: 0, defense: 0, spDefense: 0,
        attackSpeed: 0, critChance: 0, critDamage: 1, range: 0, moveSpeed: 0,
        isDummy: true, state: 'idle', targetId: null,
        attackTimer: 0, attackWindupTimer: 0, isInWindup: false, pendingCrit: false,
        manaLockTimer: 0, abilityCastTimer: 0,
        items: [], types: ['ruiner_stone'], statusEffects: [], shields: [],
        attackModifiers: [], passiveAttackHandlers: [], passiveCastHandlers: [],
        role: undefined, placedAt: 0,
        attackCount: 0, damageTakenThisCombat: 0, damageDealtThisCombat: 0,
        dmgDealt: { physical: 0, magic: 0, true: 0 }, dmgTaken: { physical: 0, magic: 0, true: 0 },
        traitDmg: {}, traitHeal: {}, traitShield: {}, traitMitigated: {}, traitCount: {},
        silenced: false, whirlpooled: false, marks: [],
        incomingDamageMult: 1.0, _computedStats: null,
      }
      preview.set(stone.id, stone)
    }

    unitLayer.draw(preview, false)
    unitLayer.drawItems(preview)
    effectLayer.draw({
      tick: 0, phase: 'setup',
      units: preview, projectiles: new Map(), events: [], hexOccupancy: new Map(),
      terrain: { electric: false, psychic: false, grassy: false, misty: false, sunny: false },
      tailwind: { player: false, enemy: false },
      earthquakeCounts: new Map(),
      spellBuffCounters: new Map(),
      persistentAoEZones: [],
    })
    unitLayer.drawAllHealthBars(preview)
  }
}

// ─── Boot: Title Screen, or straight into a lobby by link ────────────────────

// Today's solo boot, lifted verbatim out of the old module-scope boot block
// and given a name. The statements are byte-for-byte what ran before the
// Title Screen existed — this is a move, not a rewrite, because
// 04-UI-SPEC.md requires Start Solo Game to reach the CURRENT solo game with
// no behavioural change.
//
// Nothing between the old boot block and here depended on it having already
// run: `run` is initialised at module scope and `econPhase` already defaults
// from `run.gameOver`, so deferring these statements behind a button changes
// only WHEN they run, never what they do.
function bootSolo(): void {
  if (econActive()) {
    if (isFreshRun()) initFreshRun()
    if (run.gameOver) enterGameOver(run.gameOver)
    else startPlanningPhase(false)   // resume persisted shop; roll only if empty
  } else {
    updateEconVisibility()
  }
}

// Creates a room and becomes its host. 04-UI-SPEC.md Flow step 4.
//
// Once set, the URL's lobby code is the SOLE source of truth for which room
// this tab belongs to — the boot router below reads it before anything else,
// so a refresh after creation reconnects to the same room rather than minting
// a second orphan one, and a second click on an already-created lobby is a
// no-op rather than an abandoned room (T-04-11).
function onMultiplayer(): void {
  if (net !== null) return
  if (parseLobbyCode(location.search) !== null) return

  const code = newLobbyCode()
  history.replaceState(null, '', shareableLobbyUrl(location.origin, code))
  hideTitleScreen()
  bootNetworked(code, { isHost: true })
}

// The single switch between the solo path and the networked path — everything
// downstream branches on isNetworked(). A `?lobby=` that is absent, malformed,
// or outside the code alphabet falls through to the Title Screen, whose Start
// Solo Game button reaches the solo boot unchanged from before Phase 4.
const bootLobbyCode = parseLobbyCode(location.search)

if (bootLobbyCode !== null) {
  // Flow step 1: a link-opened tab never sees the Title Screen. It starts as
  // a guest because the URL alone cannot say who created the room; the
  // welcome frame promotes it if the server hands it seat 0, which is what
  // makes a HOST'S OWN REFRESH land back on a Start button.
  bootNetworked(bootLobbyCode, { isHost: false })
} else {
  showTitleScreen({ onSolo: () => { hideTitleScreen(); bootSolo() }, onMultiplayer })
}

// Starts unconditionally in both branches, so the canvas is already warm
// behind the overlay and dismissing a screen reveals a live board rather than
// a first frame.
requestAnimationFrame(frame)
