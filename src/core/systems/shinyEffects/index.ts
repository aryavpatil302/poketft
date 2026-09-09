// Aggregates every per-species shiny combat effect. Each file in this
// directory calls registerShinyEffect(...) at module load; importing this
// barrel once triggers every registration.

// Ruiner: Unown, Stonjourner (Xatu, Claydol join below; Absol and Spiritomb
// hook their own ability files directly; Runerigus's shiny effect lives in
// ability.ts already — no per-species file needed for either).
import './unown'
import './stonjourner'
