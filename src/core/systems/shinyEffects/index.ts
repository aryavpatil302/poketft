// Aggregates every per-species shiny combat effect. Each file in this
// directory calls registerShinyEffect(...) at module load; importing this
// barrel once triggers every registration.

// Beachy
import './kingler'
import './a_raichu'
import './palossand'
import './blastoise'
// A-Exeggutor and Tapu Fini's shiny effects hook directly into their own
// ability files (a_exeggutor.ts / tapufini.ts) instead of registering here —
// their effects modify a specific cast/hit, not combat-start state, so they
// have no onCombatStart to register (same shape as wave 1's Runerigus/
// Ferrothorn engine hooks, which also have no shinyEffects/ file).
