# External Integrations

**Analysis Date:** 2026-08-16

## APIs & External Services

**None detected.** The application is fully client-side with no external API dependencies.

**Local Development API Endpoints (Vite plugins):**
- `POST /api/save-test` - Saves a combat test scenario to `tests/` directory and auto-registers in `src/repoTests.ts`
  - Payload: `{ label: string; units: unknown[] }` (JSON)
  - Response: `{ ok: boolean; filename?: string; error?: string }`
  - Implementation: `vite.config.ts` save-test plugin
  
- `GET /api/trait-diagram-data` - Returns current units and traits for live trait diagram editor
  - Response: `{ units: Array<{id, name, cost, types, spritePath}>; traits: Array<{id, name}> }`
  - Implementation: `vite.config.ts` trait-diagram-api plugin (uses server.ssrLoadModule)

- `POST /api/save-traits` - Updates unit trait assignments in `src/data/units.ts`
  - Payload: `{ traits: Record<string, string[]> }` (unit IDs to trait arrays)
  - Response: `{ ok: boolean; changed?: number; error?: string }`
  - Implementation: `vite.config.ts` trait-diagram-api plugin (line-based file rewrite)

## Data Storage

**Databases:**
- None (no backend database)

**File Storage:**
- Local filesystem only:
  - `src/data/units.ts` - Unit definitions (JSON-like object declarations)
  - `src/data/items.ts` - Item definitions
  - `src/data/traits.ts` - Trait definitions
  - `tests/` - Combat test scenarios (JSON snapshots, auto-generated via `/api/save-test`)
  - `public/visuals/` - Sprite sheets, backgrounds, trait icons, animation assets
  - ML training outputs: `src/econ/botNames.ts`, `src/econ/constants.ts` (generated from training scripts)

**Caching:**
- Browser localStorage only (no server-side caching)
  - Key: `PKTFT_SNAPSHOT` - Combat test snapshots
  - Key: `CALIB_KEY` - ML calibration parameters (win probability predictions)
  - Key: `BATTLELOG_KEY` - Battle feature vectors for online learning

## Authentication & Identity

**Auth Provider:**
- None (single-player, no user accounts)

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking)
- Errors logged to console only

**Logs:**
- Console only (development and browser console)
- E2E test logs via Cucumber reporter (HTML/JSON)

## CI/CD & Deployment

**Hosting:**
- None configured (fully client-side, distributable as static assets)
- Output: `dist/` directory (Vite build output)

**CI Pipeline:**
- None (no CI/CD configuration detected)
- Manual build: `npm run build` → `dist/`

## Environment Configuration

**Required env vars:**
- None (fully client-side, no configuration needed)

**Secrets location:**
- No secrets in codebase (verified no .env files committed)

## Data Flow

**Training Scripts (Node.js, headless):**
1. `npm run train-bots` → Reads `src/data/units.ts`, generates `src/econ/botNames.ts`
2. `npm run train-comps` → Generates composition affinity mappings to `src/econ/trainCompositionAffinities.ts`
3. `npm run train-catalog` → Generates catalog index to `src/econ/catalogIndex.ts`
4. `npm run train-all` → Runs all training pipelines

**Game Loop (Browser):**
1. Player places units on board (canvas clicks) → stored in memory
2. Combat runs → `src/core/combatEngine.ts` advances ticks
3. After combat → rounds tracked via `src/econ/bots.ts` (opponent generation, ML delta predictions)
4. ML calibration → stored in localStorage via `src/enemy/calibration.ts`
5. Battle features → stored in localStorage via `src/enemy/battleLog.ts`

**Test Scenario Flow:**
1. Player names a combat board scenario
2. `POST /api/save-test` → Vite plugin receives JSON, writes to `tests/{slug}.json`
3. Plugin patches `src/repoTests.ts` to import and register new test
4. On next restart, test appears in "Quick Tests" list

## Webhooks & Callbacks

**Incoming:**
- None (no webhook receivers)

**Outgoing:**
- None (no outgoing webhooks)

## External Assets

**CDN/Hosting:**
- None (all assets served locally)
- Sprites and backgrounds in `public/visuals/` bundled with build

---

*Integration audit: 2026-08-16*
