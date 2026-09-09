// Aggregates every per-species shiny combat effect. Each file in this
// directory calls registerShinyEffect(...) at module load; importing this
// barrel once triggers every registration.

import './klawf'
import './gogoat'
import './sneasler'
import './aerodactyl'
import './morelull'
import './morgrem'
import './oranguru'
import './celebi'
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
import './zubat'
import './druddigon'
import './sableye'
import './excadrill'
// River
import './drednaw'
import './bellibolt'
import './quagsire'
// Barraskewda's shiny effect (Fishous Rend armor pierce) is Category B — it
// lives entirely inside the existing ability file's tickEffect, not a new
// onCombatStart registration here. See src/core/abilities/barraskewda.ts.
// Ruiner: Unown, Stonjourner, Xatu, Claydol (Absol and Spiritomb hook their
// own ability files directly; Runerigus's shiny effect lives in ability.ts
// already — no per-species file needed for either).
import './unown'
import './stonjourner'
import './xatu'
import './claydol'
// Volcano
import './typhlosion'
import './graveler'
import './torkoal'
import './gible'
import './armarouge'
import './a_marowak'
import './wheezing'
import './charizard'
// Misc
import './tapu_koko'
import './latios'
import './latias'
import './salamence'
import './darmanitan'
// Sky Strikers
import './pidgeotto'
import './noivern'
import './rayquaza'
// Wailord and Talonflame's shiny effects hook their own ability files
// directly (src/core/abilities/wailord.ts, talonflame.ts) — no onCombatStart
// registration needed for them.
