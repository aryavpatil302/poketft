# Technology Stack

**Analysis Date:** 2026-08-16

## Languages

**Primary:**
- TypeScript 5.4.0 - All source code, builds to ES2022 (client) and ES2022 (Node.js scripts)

**Secondary:**
- JavaScript (generated, consumed only at runtime)
- Markdown - Documentation

## Runtime

**Environment:**
- Node.js (development only; app runs in browsers)
- ES2022 target compilation

**Package Manager:**
- npm 10.9.2
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vite 5.2.0 - Build tool, dev server with custom plugins for test-saving and trait-diagram API
- No frontend framework (vanilla TypeScript + Canvas 2D API)

**Testing:**
- Vitest 1.6.0 - Unit test runner (`.test.ts` files in `src/core/abilities/`, `src/econ/`, etc.)
- Cucumber.js 12.9.0 - BDD/E2E test runner for `.feature` files in `e2e/features/`
- Selenium WebDriver 4.44.0 - Browser automation (E2E tests)
- ChromeDriver 148.0.4 - Chrome browser driver for Selenium

**Build/Dev:**
- TypeScript 5.4.0 - Language compiler
- tsx 4.22.3 - TypeScript executor for Node.js scripts (training, simulations)

**Blog/Docs:**
- Astro 4.16.0 - Static site generator (located in `/blog/`)

## Key Dependencies

**Critical:**
- None (zero runtime dependencies for main app)
- All game logic is self-contained in `src/core/`, `src/econ/`, `src/render/`, `src/enemy/`

**Infrastructure:**
- Vite plugins (built-in, no external dependency)
  - `save-test` plugin: POST `/api/save-test` to persist test scenarios to `tests/` directory
  - `trait-diagram-api` plugin: GET/POST `/api/trait-diagram-data` and `/api/save-traits` for live trait editing

**Development:**
- @types/node 26.1.1 - Node.js type definitions
- Cucumber ecosystem packages (gherkin, messages, formatters, etc.) - All managed as transitive deps of @cucumber/cucumber

## Configuration

**Environment:**
- No `.env` files required (client-side only)
- Configuration embedded in TypeScript source:
  - Unit definitions: `src/data/units.ts`
  - Item definitions: `src/data/items.ts`
  - Trait definitions: `src/data/traits.ts`
  - Combat constants: `src/core/constants.ts`
  - Economy constants: `src/econ/constants.ts`

**Build:**
- `vite.config.ts` - Main Vite configuration (custom plugins for test/trait APIs)
- `tsconfig.json` - TypeScript compiler options (strict mode, ES2022 target, bundler module resolution)
- `package.json` - Scripts section includes:
  - `dev` - Vite dev server
  - `build` - TypeScript + Vite build
  - `preview` - Preview built app
  - `test` - Vitest single run
  - `test:watch` - Vitest watch mode
  - `test:e2e` - Cucumber feature tests
  - `train-bots`, `train-comps`, `train-catalog`, `grow-catalog`, `train-all` - ML training scripts
  - `sim-bots` - Bot league simulation

## Platform Requirements

**Development:**
- Node.js 20+ (Cucumber.js requires 20 || 22 || >=24)
- npm 10+
- git (for development workflow)

**Production:**
- Modern browser with:
  - Canvas 2D API
  - ES2022 support
  - localStorage API (for snapshot persistence)
  - localStorage for ML calibration data persistence
- No server runtime required (fully client-side)

---

*Stack analysis: 2026-08-16*
