<!-- refreshed: 2026-08-16 -->
# Codebase Concerns

**Analysis Date:** 2026-08-16

## Missing Critical Features

**Round-3 item reward system:**
- **What's missing:** Creep round 3 (the final creep round) should grant an item reward to the player, matching TFT mechanics. Currently no-op.
- **Files:** `src/main.ts:4316`
- **Blocks:** Players cannot progress through the economy without item rewards
- **Workaround:** None — gameplay progression is incomplete
- **Priority:** High
- **Fix approach:** Implement `rollItemChoices()` equivalent for creep rounds and integrate item selection UI into the combat flow after round 3

## Code Quality & Type Safety

**Excessive `any` type casts and type escapes:**
- **Issue:** 187 instances of `any`, `@ts-ignore`, `@ts-nocheck`, and type assertion workarounds throughout the codebase
- **Files:** Scattered across all system files; notable: `src/core/combatEngine.ts:79` (casting to `any` to access `_leap` field), `src/repoTests.ts:276`, `src/main.ts:942` (window cast)
- **Impact:** Type safety eroded; refactoring becomes risky; IDE assistance reduced
- **Current mitigation:** TypeScript strict mode may be disabled or partially applied
- **Recommendations:** 
  - Enable `noImplicitAny: true` in `tsconfig.json`
  - Replace private field access casts with public accessors or getters
  - Replace `(window as any).__*` with proper module exports
  - Audit and eliminate type escapes incrementally per module

**Type safety in private field access:**
- **What happens:** Code casts Unit to `any` to access the private `_leap` field (e.g., `!(unit as any)._leap`)
- **Why it's wrong:** Bypasses type checking; if `_leap` is renamed or removed, compiler won't catch it
- **Do this instead:** Export `_leap` as a public readonly property or create a getter: `hasLeap(): boolean`
- **File:** `src/core/combatEngine.ts:79`

**Global window API exposure:**
- **What happens:** Debug/admin functions exposed to window via type-cast: `(window as any).__traitPage`, `(window as any).__itemBenchPage`, `(window as any).__pokeTFT`
- **Why it's wrong:** Untyped, unmaintained, no API contract; easily broken by refactoring
- **Do this instead:** Export typed interfaces or use a proper admin UI panel
- **Files:** `src/main.ts:942`, `src/main.ts:3108`, `src/main.ts:3592`

## Architecture & Maintainability

**Monolithic main.ts file (4428 lines):**
- **Problem:** Single file controls rendering, event handling, UI, economy phases, combat integration, and test utilities
- **Files:** `src/main.ts`
- **Impact:** 
  - Difficult to locate and modify specific behaviors
  - High test surface area but no test file (see Testing section below)
  - Risk of accidental global state mutations
  - Onboarding new developers is slow
- **Scaling limit:** At ~5000 lines, maintainability degrades sharply
- **Improvement path:** 
  - Extract render layers into separate modules (bench rendering, shop UI, econ panel)
  - Move event listeners to a dedicated event manager module
  - Separate economy phase orchestration into `src/ui/econPhase.ts`
  - Create `src/ui/testMode.ts` for test utilities

**Repeated video loading pattern in unitLayer.ts:**
- **What happens:** Eight hardcoded IIFE functions (unawareVideo, toxicChainVideo, spiritBreakVideo, shadowBoneFireVideo, buluAuraVideo, gravityVideo, destinyBondVideo, iceBodyVideo, magicBounceVideo) each create a hidden video element with identical boilerplate
- **Why it's wrong:** Not scalable; adding a new ability video requires 10+ lines of duplicated code
- **Do this instead:** Create a generic video factory function that loads a video path on-demand
- **Files:** `src/render/layers/unitLayer.ts:71–292` (repeating pattern)
- **Fix approach:**
  ```typescript
  function loadBackgroundVideo(path: string): HTMLVideoElement {
    const v = document.createElement('video')
    v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
    getVideoContainer().appendChild(v)
    v.src = path; v.play().catch(() => {})
    return v
  }
  ```
  Then replace all IIFEs with: `const myVideo = loadBackgroundVideo('/path.webm')`

**Global mutable state in main.ts:**
- **Issue:** Module-level variables mutated during gameplay (boardOffsetX, boardOffsetY, econPhase, collapsedTraits, selectedUnit, heldUnit, etc.)
- **Files:** `src/main.ts:519–722`
- **Impact:** State mutations are hard to trace; no clear ownership; race conditions possible
- **Fragile:** If game phase changes unexpectedly, several globals can become inconsistent
- **Fix approach:** Encapsulate state in a single AppState object, pass to event handlers

## Testing Gaps

**No tests for core integration points:**
- **Untested files:**
  - `src/main.ts` (4428 lines, zero tests) — orchestrates the entire app
  - `src/core/combatEngine.ts` — all combat tick logic
  - `src/core/projectile.ts` — no dedicated test file
  - `src/ui/combatControls.ts` — event handling
  - `src/ui/teamBuilder.ts` — unit placement logic
  - `src/econ/shop.ts`, `src/econ/runState.ts`, `src/econ/income.ts` — economy core logic
  - `src/enemy/generator.ts`, `src/enemy/boardPower.ts` — bot generation (tested indirectly via botLeague)
  - 30+ files in `src/econ/` lack test files

- **Risk:** Bugs introduced in untested code paths can propagate into production gameplay. No safety net for refactoring.
- **Priority:** Medium/High for core systems (combatEngine, shop, economy), Low for UI
- **Test coverage:** Estimated <40% of source lines; strong in ability system (~95%), weak in orchestration/integration

**Fragile areas with minimal/no tests:**
- Economy phase transitions (`src/econ/botMatches.ts` — how opponents are selected and matched)
- Item reward system (partially untested; round-3 items not tested because feature is incomplete)
- Bot composition/unit selection logic (partially trained, lightly tested)

## Performance Bottlenecks

**Large render layer files:**
- **unitLayer.ts (2688 lines):** Handles all unit rendering — sprite loading, HP/mana bars, items, status effects, CC icons
  - Risk: Monolithic renderer may have frame-rate drops with 8+ units on board
  - Mitigation: Consider breaking into sprite renderer, bar renderer, effect renderer subclasses
  
- **effectLayer.ts (2543 lines):** All visual effects — damage numbers, heal pops, projectile trails, ability VFX
  - Risk: VFX can pile up (many projectiles + damage numbers simultaneously)
  - Mitigation: Implement particle pooling and frame-rate limiting for VFX density

- **learnedCompositionAffinities.ts (31KB generated file):** Training data baked into source
  - Risk: Increases bundle size; not meant to be hand-edited
  - Fix approach: Move generated file outside src/ (into data/ or public/), update build pipeline to exclude from version control

**Untrained code paths (ML system):**
- Bot composition selection falls back to hand-coded heuristics when training data is unavailable
  - Risk: Opponents may not scale correctly if trained data is stale or missing

## Dependencies at Risk

**External training pipeline dependency:**
- **Risk:** Three training scripts (`train.ts`, `trainCompositionAffinities.ts`, `trainCatalogComps.ts`) must be run periodically to update bot behavior
- **Impact:** If training pipeline breaks or is skipped, bot difficulty and team composition diversity decay
- **Mitigation:** Automate training in CI/CD; version and commit training outputs
- **Migration plan:** Move training to a cloud service (e.g., Lambda on schedule) rather than manual runs

**Selenium/Chromedriver dev dependency:**
- **Risk:** Outdated chromedriver (^148.0.4) may not work with newer Chrome versions
- **Impact:** E2E tests (`src/**/*.feature`, Cucumber) may fail silently in CI
- **Mitigation:** Add a version check to CI; pin to latest stable chromedriver monthly

## Fragile Areas

**Video loading in unitLayer.ts:**
- **Files:** `src/render/layers/unitLayer.ts:71–292`
- **Why fragile:** 
  - Promise rejections in `video.play()` are silently caught but not logged
  - If a video fails to load, there's no fallback (users see a blank spot)
  - Adding a new ability video is error-prone (easy to copy-paste wrong path)
- **Safe modification:** 
  - Always test video paths exist before deployment
  - Add console.warn when a video fails to load
  - Use the generic factory pattern (see "Repeated video loading pattern" above)
- **Test coverage:** No tests for video loading or failure scenarios

**Hex grid path-finding (A*):**
- **Files:** `src/core/hexGrid.ts:182–220` (pathfinding implementation)
- **Why fragile:** 
  - No unit tests for edge cases (unreachable destination, off-grid positions)
  - Movement reconciliation is complex; occupancy conflicts can arise
- **Safe modification:** 
  - Add hexGrid tests for all corner cases (walls, boundaries, multi-unit collision)
  - Test reconcileHexOccupancy after every unit move
- **Test coverage:** `src/core/hexGrid.test.ts` has 328 lines but focused on coordinate math, not pathfinding

**Trait effect system (traitEffects.ts):**
- **Files:** `src/core/systems/traitEffects.ts:1635 lines`
- **Why fragile:**
  - Each trait's special effects are hardcoded inline; easy to accidentally break one while adding another
  - No isolation between traits; side effects can bleed through
- **Safe modification:**
  - Refactor each trait into a plugin module (e.g., `src/core/traits/volcano.ts`)
  - Add per-trait test files
  - Avoid direct mutation of state; use immutable updates
- **Test coverage:** `src/core/systems/traitEffects.test.ts` (409 lines) covers ~60% of trait logic

**Ability registration system:**
- **Files:** `src/core/systems/ability.ts` (309 lines, no test file)
- **Why fragile:**
  - Abilities are registered globally via side effects: `import './core/systems/ability'` in main.ts
  - No validation that all unit ability IDs have been registered
  - If an ability definition file is forgotten, it silently fails to register
- **Safe modification:**
  - Create an ability registry with validation
  - Add a bootstrap check that logs warnings for missing registrations
  - Add `src/core/systems/ability.test.ts`
- **Test coverage:** Zero

## Scaling Limits

**Bot opponent pool:**
- **Current capacity:** At most 5 simultaneous bot opponents (hardcoded in `src/econ/bots.ts`)
- **Limit:** Human-readable bot persona data is hand-curated; scaling requires manual work
- **Scaling path:** 
  - Generate bot personas procedurally (vary stats and trait weights)
  - Store personas in a database rather than source code

**Combat state complexity:**
- **Units field:** Map of unit ID → Unit object; each Unit has ~30+ properties plus nested arrays (statusEffects, shields, marks, etc.)
- **Current capacity:** Tested with 8 units per side (16 total); likely fine up to 10/side
- **Limit:** Beyond ~20 total units, per-tick computation becomes O(n²) (every unit targeting every other)
- **Scaling path:** 
  - Optimize targeting with spatial partitioning (hex grid zones)
  - Profile combat tick with 16/side and 20/side unit counts
  - Consider lazy evaluation of threat distance

**Rendered unit count:**
- **Current capacity:** Smooth rendering observed up to 16 units on board
- **Limit:** Canvas drawImage() calls per frame; beyond ~30–40 active sprites, frame rate drops on lower-end hardware
- **Scaling path:** Sprite batching (group nearby units, render as texture atlas)

## Security Considerations

**No input validation on bot opponent selection:**
- **Risk:** Users can manually call `window.__pokeTFT.setOpponent()` with invalid values
- **Files:** `src/main.ts:3592` (window API exposure)
- **Mitigation:** Remove/restrict public APIs or add validation; log attempts
- **Recommendations:** Restrict access to dev mode only; add authentication if multi-user

**Inline CSS in HTML template:**
- **Risk:** If user input is interpolated into the DOM (unlikely in current code, but possible in future), XSS vectors open
- **Files:** `src/main.ts:46–150` (DOM skeleton with inline styles)
- **Mitigation:** Use template literals carefully; sanitize any user-facing text; consider moving styles to external CSS
- **Recommendations:** Use a templating engine with auto-escaping (e.g., Handlebars)

**Console debugging functions left in production:**
- **What's exposed:** `window.__pokeTFT` and similar debug APIs allow anyone with dev console access to manipulate game state
- **Risk:** Low (requires developer console + knowledge), but still an issue
- **Mitigation:** Disable/remove debug APIs in production builds; gate behind `NODE_ENV === 'development'`
- **Files:** `src/main.ts:3592`, `src/main.ts:942`, `src/main.ts:3108`

## Observability & Debugging

**Console logs for debugging scattered throughout:**
- **Issue:** `console.log`, `console.error`, and `console.warn` used inconsistently for status, errors, and performance traces
- **Files:** 
  - `src/core/combatEngine.ts:249–269` (combat event logging)
  - `src/econ/train.ts` (training progress)
  - `src/main.ts:4265` (calibration logging)
- **Impact:** Hard to enable/disable logging by module; production builds contain debug output
- **Fix approach:** 
  - Create a logger utility with log levels (debug, info, warn, error)
  - Provide a way to filter logs by module
  - Strip debug logs from production builds

**No structured error reporting:**
- **Issue:** Errors in video loading, sprite loading, and network calls are silently caught
- **Risk:** Subtle bugs go unnoticed (e.g., a missing asset breaks rendering, but user sees nothing)
- **Mitigation:** Implement error boundary; log errors with context to a dashboard/local storage

## Technical Debt Summary

| Area | Severity | Impact | Effort to Fix |
|------|----------|--------|---------------|
| Round-3 item rewards | High | Blocks progression | Medium |
| Type safety (`any` casts) | High | Maintainability, refactoring | High |
| main.ts monolith | High | Maintainability, testing | High |
| Repeated video pattern | Medium | Maintainability, extensibility | Low |
| Combat engine tests | Medium | Regression risk | Medium |
| Global state | Medium | Fragility, debugging | Medium |
| Generated training data in src/ | Low | Bundle size, maintainability | Low |
| Console logging | Low | Observability, prod clutter | Low |

---

*Concerns audit: 2026-08-16*
