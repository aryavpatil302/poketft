// Aggregates every per-species shiny combat effect. Each file in this
// directory calls registerShinyEffect(...) at module load; importing this
// barrel once triggers every registration.

// River
import './drednaw'
import './bellibolt'
import './quagsire'
// Barraskewda's shiny effect (Fishous Rend armor pierce) is Category B — it
// lives entirely inside the existing ability file's tickEffect, not a new
// onCombatStart registration here. See src/core/abilities/barraskewda.ts.
