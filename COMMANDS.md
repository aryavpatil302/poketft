# Commands Reference

All the CLI commands for developing, testing, simulating, and training the Pokemon TFT simulator.

---

## Development

### `npm run dev`
Starts the Vite dev server (hot-reload). Open the printed localhost URL to play.
Normal mode is the full economy game (shop, bench, 5 bot opponents); check the
**Test Mode** box in the bottom-right panel for free unit placement and the dev tools.

### `npm run build`
Type-checks the whole project (`tsc`) then produces a production bundle with Vite.

### `npm run preview`
Serves the last production build locally so you can sanity-check it before deploying.

---

## Testing

### `npm test`
Runs the entire vitest suite once (unit tests for abilities, traits, combat systems,
and the whole `src/econ/` economy: shop odds, combining, income, bots, bot matches).

### `npm run test:watch`
Same suite, but stays running and re-runs affected tests when files change.

### `npx vitest run <path>`
Run one suite directly, e.g. `npx vitest run src/econ/bots.test.ts` — much faster
than the full suite when iterating on one system.

### `npm run test:e2e`
Runs the Cucumber/Selenium browser end-to-end features in `e2e/features/`.
Needs Chrome; the dev server is driven automatically.

---

## Bot training (machine learning)

### `npm run train-bots`
Retrains the 5 bot personas' decision weights via an evolution strategy
(population-based reinforcement learning) and overwrites `src/econ/trainedGenomes.ts`.

**How it works:** every numeric knob a bot uses — target level, gold reserves,
the HP thresholds for "I'm dying, spend everything" and "I'm safe, bank then
power-spike", and all the shop-scoring weights (star-up value, trait synergy,
raw cost preference…) — lives in a per-persona `BotGenome` (~15 floats).
Each generation, every persona's current best genome is mutated into a small
population of candidates; each candidate is evaluated by playing full simulated
5-bot games (the real combat sim + real shared-pool economy, headless) against
the *other* personas' current bests — competitive self-play, so personas keep
adapting to each other. The best candidate survives (fitness = average placement
+ remaining HP). Persona identity (name, trait biases) is never evolved, so
Rilla stays a recognizable hyperroller, Kass a fast-8 climber, etc.

**Training is cumulative:** each run seeds from the previously trained genomes,
so re-running keeps improving rather than starting over. The game itself never
trains — it just loads `trainedGenomes.ts`, falling back to hand-tuned defaults
field-by-field if the file is missing entries.

**When to re-run:** after adding/changing units or traits, after balance changes,
or just to let the bots keep improving. A default run takes ~20 minutes.

Flags (defaults shown):
```
npx tsx src/econ/train.ts \
  --generations 15   # evolution epochs
  --population 6     # candidates per persona per generation
  --games 5          # simulated games per candidate (more = less noisy fitness)
  --rounds 22        # max rounds per simulated game
  --sigma 0.15       # mutation strength (fraction of each field's natural scale)
  --seed 1           # RNG seed — same seed + same code = same result
```
Quick smoke test that the harness works: `npx tsx src/econ/train.ts --generations 2 --population 3 --games 2`

---

## Headless simulation tools

### `npx tsx src/sim/run.ts --player <units> --enemy <units> [--trials 100] [--verbose]`
Runs headless combat between two hand-specified boards and prints win rates,
damage stats, and per-unit performance. Unit format is `id:tier`, comma-separated;
positions are auto-assigned.
```
npx tsx src/sim/run.ts --player vikavolt:1 --enemy dummy:1,dummy:1,dummy:1 --trials 100
npx tsx src/sim/run.ts --player tangela:2,kingler:1 --enemy dummy_melee:1 --trials 50 --verbose
```
Useful for balance-checking a single unit or ability change without opening the game.

### `npx tsx src/sim/calibrate.ts [--boards 200] [--trials 100]`
Offline prior-fitting for the win-probability model: generates random plausible
boards, sims them for ground-truth win rates, and **prints suggested** calibration
constants (k, b, feature weights) vs. the current hand-tuned ones. Read-only —
it never writes files or localStorage; applying its suggestions to
`src/enemy/calibration.ts` / `boardPower.ts` is a manual decision.

---

## In-game shortcuts (economy mode)

Not CLI commands, but easy to forget:

| Key | Action |
|-----|--------|
| `d` | Reroll the shop (2g) |
| `f` | Buy XP (4g) |
| `e` | Sell the unit currently hovered (bench or board) |
| Right-click | Sell a bench/board unit |
| Click unit sprite | Pick up unit (follows cursor); click a hex/slot to place, drag over the shop to sell |

---

## Where learned/persistent state lives

| localStorage key | Contents |
|---|---|
| `pokeTFT_run_v1` | Your current run (gold, HP, board, bench, bot economies, shared pool) |
| `pokeTFT_battles_v1` | Battle-outcome log (≤300 records) feeding the win% model |
| `pokeTFT_calib_v1` | Online-learned win-probability calibration parameters |

Bot genomes are **not** in localStorage — they're code (`src/econ/trainedGenomes.ts`),
produced by `npm run train-bots` and checked into the repo.
