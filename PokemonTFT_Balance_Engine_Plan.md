# Pokemon TFT Balance Engine — Full Design Plan

> **Status:** Design phase — come back to this when ready to build.
> This is a side project separate from the AI Agent Mastery learning path,
> though it uses the same skills (LangGraph, sub-agents, hooks, skills, simulation data).

---

## What You're Building (Big Picture)

```
Simulation Engine → Battle Data → AI Player Agents → Upvoting Layer → Dev Dashboard
      ↑                                                                      ↓
      └──────────────────── Balance Decisions ───────────────────────────────┘
```

Three distinct systems that connect:

1. **Combat Simulator** — Python engine mimicking TFT's fight loop
2. **AI Playtest Layer** — Claude Code agents acting as player archetypes
3. **Feedback Aggregation** — Reddit-style upvoting surfaces signal from noise

---

## On Avoiding Costly APIs

You can run this almost entirely through Claude Code's subscription with no per-token API billing.

Claude Code's CLI has a **headless (non-interactive) mode**:

```bash
claude -p "Here is battle data: $(cat battle_data.json). You are a casual player. Give feedback on what felt overpowered or unfair."
```

This runs Claude Code as a subprocess from your Python simulation pipeline. Since Claude Code is subscription-based (~$100/month Max plan), you're paying a flat rate no matter how many agent runs you trigger. That's the entire cost structure difference:

| Approach | Cost Model | 100 simulation runs |
|---|---|---|
| Direct Anthropic API | Per token | ~$5–$40 depending on model |
| Claude Code CLI (`claude -p`) | Flat subscription | $0 marginal cost |
| Claude Code sub-agents | Flat subscription | $0 marginal cost |
| Ollama (local) | Free | $0 |

**Strategy:** Run the simulation in Python (zero cost), collect data to JSON, then selectively invoke Claude Code agents on **interesting cases** — outlier battles, specific unit combos, anomaly-flagged runs. You don't need an agent on every single battle, just the ones that surface anomalies.

---

## Phase 1 — Combat Simulation Engine

### Core Data Model

```
Pokemon
├── base_stats: hp, attack, defense, sp_attack, sp_defense, speed, mana
├── ability: { name, description, trigger, effect_fn }
├── traits: [list of trait names]
├── origin: [Kanto, Johto, Water-type, etc.]
└── cost_tier: 1–5

Board
├── hex_grid: 4×7 hexagonal layout (TFT standard)
├── player_units: list of placed Pokemon (max 9)
└── enemy_units: list

BattleState
├── round_number
├── tick: int (combat runs in discrete ticks)
├── all_units: list of active Pokemon
├── events: list of BattleEvent (every action logged)
└── is_over: bool
```

### Combat Loop (TFT Faithful)

```python
def run_battle(player_board, enemy_board) -> BattleData:
    state = BattleState(player_board, enemy_board)

    while not state.is_over:
        for unit in state.get_attack_ready_units():    # sorted by speed
            target = unit.find_target(state)           # nearest enemy
            unit.auto_attack(target, state)            # basic attack
            if unit.mana >= unit.max_mana:
                unit.cast_ability(state)               # ability fires

        apply_status_effects(state)                    # burn, freeze, etc.
        check_deaths(state)
        state.tick += 1

    return state.compile_battle_data()
```

### What to Log Per Battle (The Data Layer)

The goal is maximum metadata granularity — every lever you might want to pull for balancing should have data behind it. The schema is split into three layers: **battle-level summary**, **per-unit full breakdown**, and **raw event log**.

```json
{
  "battle_id": "uuid",
  "winner": "player",
  "duration_ticks": 187,
  "duration_seconds_equivalent": 9.35,
  "round": 4,
  "stage": "3-2",
  "player_team_cost": 18,
  "enemy_team_cost": 17,
  "trait_bonuses_active": [
    { "trait": "Fire-type", "tier": 3, "units": ["Charizard", "Flareon", "Magmar"], "effect": "+30% ability damage" },
    { "trait": "Kanto", "tier": 2, "units": ["Charizard", "Blastoise"], "effect": "+15 starting mana" }
  ],
  "anomaly_flags": [
    "Charizard dealt 42% of total damage — exceeds 35% outlier threshold",
    "Blastoise never cast its ability — died before reaching full mana"
  ],

  "per_unit": [
    {
      "name": "Charizard",
      "team": "player",
      "traits": ["Kanto", "Fire-type"],
      "cost_tier": 4,
      "star_level": 2,
      "items": ["Rabadon's Deathcap", "Spear of Shojin"],
      "position": { "hex_col": 3, "hex_row": 2 },

      "survivability": {
        "survived": true,
        "time_alive_ticks": 187,
        "time_alive_pct": 1.0,
        "hp_remaining": 412,
        "hp_remaining_pct": 0.27,
        "hp_max": 1500,
        "deaths": 0
      },

      "auto_attack_output": {
        "total_auto_damage": 1102,
        "total_auto_hits": 14,
        "avg_auto_damage_per_hit": 78.7,
        "auto_crit_count": 3,
        "auto_crit_damage": 312,
        "auto_crit_rate_actual": 0.21,
        "damage_by_target": [
          { "target": "Blastoise", "hits": 8, "total_damage": 640, "crits": 2 },
          { "target": "Snorlax",   "hits": 6, "total_damage": 462, "crits": 1 }
        ]
      },

      "ability_output": {
        "ability_name": "Flamethrower",
        "total_casts": 3,
        "total_spell_damage": 1745,
        "avg_damage_per_cast": 581.7,
        "min_damage_cast": 510,
        "max_damage_cast": 648,
        "cast_ticks": [23, 89, 151],
        "intervals_between_casts": [66, 62],
        "avg_ticks_between_casts": 64.0,
        "first_cast_tick": 23,
        "time_to_first_cast_ticks": 23,
        "mana_gained_from_autos": 140,
        "mana_gained_from_being_hit": 30,
        "mana_gained_from_items": 48,
        "mana_wasted_at_death": 0,
        "damage_by_target_by_cast": [
          {
            "cast_index": 1, "tick": 23,
            "targets": [
              { "target": "Blastoise", "damage": 412, "was_killing_blow": false },
              { "target": "Snorlax",   "damage": 98,  "was_killing_blow": false }
            ]
          },
          {
            "cast_index": 2, "tick": 89,
            "targets": [
              { "target": "Blastoise", "damage": 510, "was_killing_blow": true },
              { "target": "Vaporeon",  "damage": 138, "was_killing_blow": false }
            ]
          },
          {
            "cast_index": 3, "tick": 151,
            "targets": [
              { "target": "Snorlax",  "damage": 587, "was_killing_blow": false }
            ]
          }
        ],
        "multi_target": true,
        "avg_targets_hit_per_cast": 1.67
      },

      "damage_summary": {
        "total_damage_dealt": 2847,
        "auto_damage_pct": 0.387,
        "spell_damage_pct": 0.613,
        "damage_share_of_team_pct": 0.42,
        "kills": 2,
        "killing_blow_sources": { "ability": 1, "auto": 1 },
        "overkill_damage": 127,
        "damage_to_tanks_pct": 0.61,
        "damage_to_carries_pct": 0.39
      },

      "damage_taken": {
        "total_damage_taken": 1203,
        "auto_damage_taken": 780,
        "spell_damage_taken": 423,
        "damage_taken_by_source": [
          { "source": "Blastoise", "auto_damage": 310, "spell_damage": 200, "total": 510 },
          { "source": "Snorlax",   "auto_damage": 470, "spell_damage": 223, "total": 693 }
        ],
        "times_hit_by_auto": 11,
        "times_hit_by_spell": 4
      },

      "shielding": {
        "total_shield_applied": 0,
        "shields_granted": []
      },

      "healing": {
        "total_healing_received": 0,
        "total_healing_done_to_others": 0,
        "self_healing_done": 0,
        "healing_events": []
      },

      "status_effects_applied": [
        { "effect": "Burn", "target": "Blastoise", "tick": 23, "duration_ticks": 6, "total_damage": 84 },
        { "effect": "Burn", "target": "Snorlax",   "tick": 151, "duration_ticks": 6, "total_damage": 72 }
      ],
      "status_effects_received": [],

      "positioning": {
        "avg_distance_to_nearest_enemy": 2.1,
        "repositioned": false,
        "was_focused_by_enemies": false,
        "times_targeted_by_auto": 11,
        "times_targeted_by_spell": 4
      }
    },

    {
      "name": "Vaporeon",
      "team": "player",
      "traits": ["Johto", "Water-type", "Support"],
      "cost_tier": 2,
      "star_level": 2,
      "items": ["Warmog's Armor"],
      "position": { "hex_col": 1, "hex_row": 3 },

      "survivability": {
        "survived": false,
        "time_alive_ticks": 134,
        "time_alive_pct": 0.716,
        "hp_remaining": 0,
        "hp_remaining_pct": 0.0,
        "hp_max": 900,
        "deaths": 1,
        "death_tick": 134,
        "killed_by": "Snorlax",
        "killing_blow_type": "auto"
      },

      "auto_attack_output": {
        "total_auto_damage": 220,
        "total_auto_hits": 5,
        "avg_auto_damage_per_hit": 44.0,
        "auto_crit_count": 0,
        "auto_crit_damage": 0,
        "auto_crit_rate_actual": 0.0,
        "damage_by_target": [
          { "target": "Snorlax", "hits": 5, "total_damage": 220, "crits": 0 }
        ]
      },

      "ability_output": {
        "ability_name": "Aqua Ring",
        "total_casts": 2,
        "total_healing_done": 480,
        "avg_healing_per_cast": 240,
        "min_healing_cast": 220,
        "max_healing_cast": 260,
        "cast_ticks": [41, 98],
        "intervals_between_casts": [57],
        "avg_ticks_between_casts": 57.0,
        "first_cast_tick": 41,
        "time_to_first_cast_ticks": 41,
        "mana_gained_from_autos": 50,
        "mana_gained_from_being_hit": 60,
        "mana_gained_from_items": 0,
        "mana_wasted_at_death": 45,
        "healing_by_target_by_cast": [
          {
            "cast_index": 1, "tick": 41,
            "targets": [
              { "target": "Charizard", "healing": 130, "overhealing": 0 },
              { "target": "Vaporeon",  "healing": 90,  "overhealing": 0 }
            ]
          },
          {
            "cast_index": 2, "tick": 98,
            "targets": [
              { "target": "Charizard", "healing": 160, "overhealing": 20 },
              { "target": "Vaporeon",  "healing": 100, "overhealing": 0 }
            ]
          }
        ],
        "total_overhealing": 20,
        "overhealing_pct": 0.04,
        "multi_target": true,
        "avg_targets_healed_per_cast": 2.0
      },

      "damage_summary": {
        "total_damage_dealt": 220,
        "auto_damage_pct": 1.0,
        "spell_damage_pct": 0.0,
        "damage_share_of_team_pct": 0.03,
        "kills": 0,
        "killing_blow_sources": {},
        "overkill_damage": 0
      },

      "damage_taken": {
        "total_damage_taken": 900,
        "auto_damage_taken": 650,
        "spell_damage_taken": 250,
        "damage_taken_by_source": [
          { "source": "Snorlax",   "auto_damage": 650, "spell_damage": 0,   "total": 650 },
          { "source": "Blastoise", "auto_damage": 0,   "spell_damage": 250, "total": 250 }
        ],
        "times_hit_by_auto": 13,
        "times_hit_by_spell": 2
      },

      "shielding": {
        "total_shield_applied": 350,
        "shields_granted": [
          {
            "cast_index": 1, "tick": 41,
            "targets": [
              {
                "target": "Charizard",
                "shield_amount": 200,
                "shield_duration_ticks": 30,
                "damage_absorbed": 200,
                "was_fully_broken": true,
                "tick_broken": 58,
                "ticks_lasted": 17
              }
            ]
          },
          {
            "cast_index": 2, "tick": 98,
            "targets": [
              {
                "target": "Charizard",
                "shield_amount": 150,
                "shield_duration_ticks": 30,
                "damage_absorbed": 80,
                "was_fully_broken": false,
                "expired_naturally": true,
                "ticks_lasted": 30,
                "remaining_when_expired": 70
              }
            ]
          }
        ],
        "total_damage_absorbed_by_shields": 280,
        "shields_broken_count": 1,
        "shields_expired_count": 1
      },

      "healing": {
        "total_healing_received": 190,
        "healing_received_from": [{ "source": "Vaporeon (self)", "amount": 190 }],
        "total_healing_done_to_others": 290,
        "healing_done_by_target": [
          { "target": "Charizard", "amount": 290, "overhealing": 20 }
        ],
        "self_healing_done": 190,
        "healing_events": [
          { "tick": 41, "healed": "Charizard", "amount": 130 },
          { "tick": 41, "healed": "Vaporeon",  "amount": 90  },
          { "tick": 98, "healed": "Charizard", "amount": 160, "overhealing": 20 },
          { "tick": 98, "healed": "Vaporeon",  "amount": 100 }
        ]
      },

      "status_effects_applied": [],
      "status_effects_received": [
        { "effect": "Silence", "source": "Blastoise", "tick": 110, "duration_ticks": 8, "casts_prevented": 0 }
      ],

      "positioning": {
        "avg_distance_to_nearest_enemy": 3.4,
        "repositioned": false,
        "was_focused_by_enemies": true,
        "times_targeted_by_auto": 13,
        "times_targeted_by_spell": 2
      }
    }
  ],

  "battle_wide_stats": {
    "total_damage_dealt_player": 6780,
    "total_damage_dealt_enemy": 5210,
    "total_healing_player": 670,
    "total_healing_enemy": 0,
    "total_shielding_player": 350,
    "total_shielding_enemy": 0,
    "total_overhealing_player": 20,
    "total_spell_casts_player": 8,
    "total_spell_casts_enemy": 6,
    "first_kill_tick": 89,
    "first_kill_unit": "Blastoise",
    "first_kill_by": "Charizard",
    "last_unit_standing": "Charizard"
  },

  "raw_event_log": [
    { "tick": 1,   "type": "auto_attack", "actor": "Charizard", "target": "Blastoise", "damage": 78,  "crit": false },
    { "tick": 3,   "type": "auto_attack", "actor": "Snorlax",   "target": "Vaporeon",  "damage": 120, "crit": false },
    { "tick": 23,  "type": "ability_cast","actor": "Charizard", "ability": "Flamethrower", "targets": ["Blastoise","Snorlax"], "damage": [412, 98] },
    { "tick": 23,  "type": "status_apply","actor": "Charizard", "target": "Blastoise", "effect": "Burn", "duration_ticks": 6 },
    { "tick": 24,  "type": "burn_tick",   "actor": "Charizard", "target": "Blastoise", "damage": 14 },
    { "tick": 41,  "type": "ability_cast","actor": "Vaporeon",  "ability": "Aqua Ring", "targets": ["Charizard","Vaporeon"], "healing": [130, 90], "shield": [200, 0] },
    { "tick": 58,  "type": "shield_break","shield_holder": "Charizard", "broken_by": "Snorlax", "remaining_shield": 0, "overflow_damage": 47 },
    { "tick": 89,  "type": "ability_cast","actor": "Charizard", "ability": "Flamethrower", "targets": ["Blastoise","Vaporeon"], "damage": [510, 138] },
    { "tick": 89,  "type": "death",       "unit": "Blastoise",  "killed_by": "Charizard", "killing_blow_type": "ability", "hp_at_death": 0, "overkill": 42 },
    { "tick": 134, "type": "death",       "unit": "Vaporeon",   "killed_by": "Snorlax",   "killing_blow_type": "auto",    "hp_at_death": 0, "mana_at_death": 45 }
  ]
}
```

### Why Each Field Matters for Balancing

| Field | Balance lever it informs |
|---|---|
| `auto_damage_pct` vs `spell_damage_pct` | Whether to tune base attack or ability power |
| `time_to_first_cast_ticks` | Mana cost / mana gain rate tuning |
| `avg_ticks_between_casts` | Attack speed, mana gen, item interactions |
| `mana_wasted_at_death` | Whether unit dies before contributing — may need more HP or less mana cost |
| `damage_by_target` | Whether a unit is always hitting the same tank and being wasted |
| `damage_absorbed_by_shields` | Whether shields are too strong (blocking too much) |
| `was_fully_broken` + `ticks_lasted` | Shield duration vs damage pressure balance |
| `overhealing` + `overhealing_pct` | Whether healing is wasted — healer may be over-tuned if always overhealing |
| `casts_prevented` (on silence events) | Whether CC is actually impacting ability output |
| `was_focused_by_enemies` | Positioning and threat assessment AI behavior |
| `kills` + `killing_blow_type` | Whether the carry closes with autos or abilities — informs which stat to nerf |
| `overkill_damage` | Whether unit is wildly over-dealing on its target — wasted damage |
| `mana_at_death` | Dying with full mana = never cast = effectively a 0-ability unit that round |

The `anomaly_flags` array is automatically populated by Python when statistical thresholds are breached (e.g., one unit > 35% damage share, `time_to_first_cast` > 80% of battle duration, overhealing > 40%). These flagged battles are the ones you feed to Claude agents — not every battle.

---

## Phase 2 — Claude Code Agent Architecture

### File Structure

```
.claude/
├── agents/
│   ├── casual-player.md        ← Persona: plays for fun, values "feel"
│   ├── meta-chaser.md          ← Persona: optimizes for winrate
│   ├── creative-player.md      ← Persona: values unique combos
│   ├── new-player.md           ← Persona: confused by complexity/unclear abilities
│   └── balance-analyst.md      ← Aggregator: reads all feedback, finds themes
├── skills/
│   ├── analyze-battle/
│   │   └── SKILL.md            ← /analyze-battle [battle_id]
│   ├── balance-report/
│   │   └── SKILL.md            ← /balance-report [unit_name]
│   └── run-playtest/
│       └── SKILL.md            ← /run-playtest [num_battles]
└── hooks/
    └── hooks.json              ← Auto-trigger analysis on new battle data
```

### Example Sub-Agent Definition

`.claude/agents/casual-player.md`:

```markdown
---
name: casual-player
description: Simulates a casual Pokemon TFT player who values fun, strong-feeling units, and clear gameplay. Use when collecting subjective player feedback on battle data.
model: claude-haiku-4-5-20251001
tools:
  - Read
---

You are Alex, a casual Pokemon TFT player. You've been playing for 3 weeks.
You care about:
- Whether units FEEL powerful and satisfying to play
- Whether abilities are visually clear (you hate when you don't understand why you lost)
- Whether your favourite Pokemon are worth using
- Whether the game seems fair

When shown battle data, respond AS ALEX — in first person, casual tone.
React emotionally first, then give specific feedback.
End with: what you'd post on the subreddit about this.

Format your response as JSON:
{
  "reaction": "emotional first impression",
  "strong_units": ["unit names that felt too strong"],
  "weak_units": ["unit names that felt useless"],
  "clarity_issues": ["anything confusing"],
  "subreddit_post": "what you'd write on r/PokemonTFT",
  "upvote_keywords": ["short phrases others might agree with"]
}
```

### Player Persona Archetypes

| Agent | Persona | What They Care About |
|---|---|---|
| `casual-player` | Alex, 3 weeks in | Fun, feel, favourite Pokemon viability |
| `meta-chaser` | Jordan, theorycrafts spreadsheets | Winrate, efficiency, optimal comps |
| `creative-player` | Sam, finds niche synergies | Combo depth, unique interactions |
| `new-player` | Riley, first TFT experience | Clarity, whether abilities make sense |
| `balance-analyst` | Aggregator (no persona) | Themes across all feedback, ranked issues |

### The Upvoting System

The `upvote_keywords` field is the mechanism. After all player agents run, the `balance-analyst` agent:
1. Counts how many agents used similar keywords
2. Groups overlapping feedback by theme
3. Produces a ranked list — most-agreed-upon concerns first

```python
# Python orchestrator
import subprocess, json

def run_player_agents(battle_data_path: str) -> list[dict]:
    personas = ["casual-player", "meta-chaser", "creative-player", "new-player"]
    feedback = []

    for persona in personas:
        result = subprocess.run(
            ["claude", "--agent", persona, "-p",
             f"Read {battle_data_path} and give your player feedback."],
            capture_output=True, text=True
        )
        feedback.append(json.loads(result.stdout))

    return feedback

def aggregate_feedback(all_feedback: list[dict]) -> dict:
    # Count keyword frequency across all agents
    keyword_counts = {}
    for fb in all_feedback:
        for kw in fb.get("upvote_keywords", []):
            keyword_counts[kw] = keyword_counts.get(kw, 0) + 1

    # Sort by "upvotes" (agreement count)
    ranked = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)
    return {"ranked_feedback": ranked, "raw": all_feedback}
```

The balance analyst agent then reads the aggregated file and produces a structured balance report for you as the developer.

---

## Phase 3 — Claude Code Hooks & Skills

### PostToolUse Hook

Automatically triggers player analysis whenever new battle data is written:

```json
// .claude/hooks/hooks.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "python scripts/check_for_anomalies.py $CLAUDE_TOOL_OUTPUT_FILE && echo 'Anomaly detected — running player agents' && python scripts/run_player_feedback.py"
          }
        ]
      }
    ]
  }
}
```

### Skill: `/analyze-battle [battle_id]`

`.claude/skills/analyze-battle/SKILL.md`:

```yaml
---
name: analyze-battle
description: Deep statistical analysis of a specific battle. Use when investigating balance anomalies.
allowed-tools: Read, Bash
---

Read data/battles/$ARGUMENTS.json and produce:
1. Statistical summary (damage distribution, outlier units)
2. Trait synergy effectiveness
3. Ability cast efficiency (damage per cast)
4. Whether any unit exceeded 35% damage share (balance red flag)
5. Comparison to baseline averages from data/baselines.json
```

### Skill: `/balance-report [unit_name]`

`.claude/skills/balance-report/SKILL.md`:

```yaml
---
name: balance-report
description: Aggregate balance view for a specific Pokemon across all recent battles
context: fork
agent: Explore
allowed-tools: Read, Bash
---

Search data/battles/ for all battles involving $ARGUMENTS.
Compute across all found battles:
- Average damage share %
- Win rate when present
- Average ability casts before death
- Player agent feedback frequency (how often flagged as OP/weak)
- Upvote score from data/feedback/aggregated.json

Output a balance verdict: OVERTUNED / BALANCED / UNDERTUNED with supporting data.
```

### Skill: `/run-playtest [num_battles]`

`.claude/skills/run-playtest/SKILL.md`:

```yaml
---
name: run-playtest
description: Run a full playtest cycle — simulate battles, collect data, run all player agents, aggregate feedback
disable-model-invocation: true
allowed-tools: Bash
---

Run a complete playtest cycle:
1. Bash: python simulator/run_battles.py --count $ARGUMENTS
2. Bash: python scripts/flag_anomalies.py
3. Bash: python scripts/run_player_feedback.py
4. Bash: python scripts/aggregate_upvotes.py
5. Read the final report at data/feedback/latest_report.json and summarize for the developer
```

---

## Phase 4 — Agent Teams for Parallel Playtesting

When you want a full playtest session across many unit combinations, use Claude Code's experimental agent teams. The team lead spawns one teammate per Pokemon being evaluated simultaneously:

```
/run-playtest 100

Team lead: spawns teammates
├── Teammate A: evaluates Charizard across 100 battles
├── Teammate B: evaluates Mewtwo across 100 battles
├── Teammate C: evaluates Snorlax across 100 battles
└── Teammate D: evaluates trait "Fire-type 3" across 100 battles

Each teammate: runs /balance-report [unit], gives structured verdict
Team lead: synthesizes all verdicts into a single patch notes draft
```

Enable agent teams:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## Phase 5 — Developer Dashboard

A simple Streamlit app reading your JSON data files.

### Data Folder Structure

```
data/
├── battles/           ← raw battle JSON files
├── baselines/         ← rolling averages (recalculated each run)
├── feedback/
│   ├── raw/           ← individual agent feedback per battle
│   ├── aggregated/    ← upvote-ranked feedback
│   └── reports/       ← balance analyst final reports
└── patch_history/     ← what was changed and when
```

### Dashboard Panels

- **Hot units** — highest recent damage share average
- **Community complaints** — top upvoted feedback keywords this week
- **Balance drift** — chart showing each unit's stats across patch history
- **Patch suggestion queue** — ranked list of what agents most agree needs changing

---

## Recommended Build Order

| Phase | What to build | Notes |
|---|---|---|
| 1 | Pokemon data model + board representation | Pure Python, no AI needed yet |
| 2 | Core combat loop (auto attacks, ability triggers) | Most complex engineering piece |
| 3 | Battle data recorder + JSON output | Get clean data before adding AI |
| 4 | Anomaly flagging logic (Python, no AI) | Statistical thresholds in code |
| 5 | Claude Code sub-agent personas + headless runner | AI layer snaps on here |
| 6 | Upvote aggregation + balance analyst agent | Surfaces signal from noise |
| 7 | Skills + hooks wiring | Automation layer |
| 8 | Streamlit dashboard | Dev-facing visibility |

**Key principle:** Build Phases 1–4 first in pure Python. The AI layer is only as useful as the data underneath it. Once you can run 100 battles and get clean, structured JSON, the Claude Code integration is straightforward to add.

---

## Future Ideas

- **Patch note generator** — balance analyst drafts human-readable patch notes from the data, you edit and approve
- **Meta prediction agent** — given current unit stats, predict which 3-unit combos will dominate next patch
- **Historical comparison** — compare balance health across patch versions with rolling baselines
- **Streaming tournament mode** — run round-robin tournaments between all Pokemon, generate tier list from results
- **Player retention signal** — track whether "fun" feedback (from casual-player agent) is trending up or down across patches — a proxy for whether balance changes are making the game more or less enjoyable