// Aggregates every per-species shiny combat effect. Each file in this
// directory calls registerShinyEffect(...) at module load; importing this
// barrel once triggers every registration.

// Sky Strikers
import './pidgeotto'
import './noivern'
import './rayquaza'
// Wailord and Talonflame's shiny effects hook their own ability files
// directly (src/core/abilities/wailord.ts, talonflame.ts) — no onCombatStart
// registration needed for them.
