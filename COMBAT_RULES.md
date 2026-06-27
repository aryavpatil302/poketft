# PokéTFT Combat Rules Reference

Last updated: 2026-04-14

---

## Targeting

### General Rule
Every tick, every living unit runs `acquireTarget()` — always picks the **nearest living enemy by hex distance**. There is no "sticky" targeting; the target can change every tick if a closer enemy appears.

Ties (equal distance) are broken by the lowest unit ID string (deterministic, prevents flicker).

If no living enemies remain, `targetId = null` → unit stands idle → combat ends.

### Ability-Specific Targeting

| Ability | Who it targets |
|---------|---------------|
| **Vigoroth — Fury Swipes** | **Furthest** living enemy within **4 hex range**. Falls back to current `targetId` if nobody is in range. |
| **Ribombee — Pollen Puff (heal)** | Ally with the **lowest absolute HP** (not percent). Excludes self. If no allies alive, heal puff is silently skipped. |
| **Ribombee — Pollen Puff (damage)** | **Nearest** enemy (same as `acquireTarget`). |

---

## Movement & Pathfinding

### A\* Rules
- A hex is **blocked** if occupied by a *different* unit.
- A unit's **own hex** is never blocked.
- `stopAtRange = unit.range` — A\* stops when the unit is within attack range, not on the target itself.
- If goal is unreachable: returns partial path to the closest reachable hex.
- If surrounded on all sides: path = empty → unit stands idle and waits.

### tickMovement (normal walking)
- `moveProgress` increments by `1 / ticksPerHex` per tick.
- `ticksPerHex = round(60 / moveSpeed)`. Default `moveSpeed = 1.5 hex/sec` → **40 ticks per hex**.
- Visual position is lerped between current hex center and next hex center each tick.
- When `moveProgress ≥ 1.0`: frees old hex in `hexOccupancy`, steps onto new hex, claims it, path shifts.
- Returns `true` on hex step → caller calls `recalculatePath`.

### tickLeapPixel (ability dashes)
- **Pure pixel lerp** — `visualPos` moves in a perfectly straight line from origin pixel to destination pixel over `totalTicks` ticks. No hex-by-hex movement at all.
- `startLeap(unit, dest, state, hasteMagnitude)` is called once at cast time. It stores `(sx,sy)` and `(ex,ey)` on the unit, computes `totalTicks = hexDist × round(TICK_RATE / leapSpeed)`, and frees the origin hex immediately.
- During the leap, `hexPos` stays at the origin — it only jumps to the destination on arrival.
- **Passes through any units** — intermediate hexes are never touched in `hexOccupancy`.
- On arrival: `hexPos = destHex`, destination hex is claimed, `_leap` data is deleted.
- Used exclusively by the `'leaping'` state.

### When recalculatePath is called
1. Unit transitions to `'moving'` state.
2. Every time unit steps onto a new hex (to chase moving targets).
3. When path becomes empty mid-move.

---

## State Machine

```
idle ──────────────── has target + in range ──────────────► attacking
idle ──────────────── has target + out of range ──────────► moving

moving ─────────────── came into range ──────────────────► idle
moving ─────────────── continues stepping ───────────────► moving
moving ─────────────── path empty (surrounded/arrived) ──► idle

attacking ──────────── target out of range ──────────────► moving  (cancels windup)
attacking ──────────── attack cycle ticking ─────────────► attacking

(any) ───────────────── mana full + no lock ─────────────► casting  (interrupts everything)
casting ────────────── animation complete ───────────────► idle

(any) ───────────────── stun/knockUp applied ────────────► stunned / knockedUp
stunned/knockedUp ───── effect expires ──────────────────► idle
```

---

## Attack System

### Timers
| Timer | Purpose |
|-------|---------|
| `attackTimer` | Cooldown ticks remaining before windup starts. Starts at 0 (attack ready). |
| `attackWindupTimer` | Ticks remaining in current windup. Damage fires when this reaches 0. |

Windup = **30% of full cooldown** (`WINDUP_FRACTION = 0.30`).

### Attack flow (one full cycle)
```
attackTimer = 0            → enters windup (isInWindup = true, windupTimer set)
windupTimer counts down    → waiting...
windupTimer = 0            → DAMAGE FIRES, isInWindup = false
                             attackTimer = cooldown − windup (remaining cooldown)
attackTimer counts down    → cooling down...
attackTimer = 0            → back to windup start
```

### Melee vs Ranged
- **Melee (range ≤ 1)**: Instant damage on windup completion.
- **Ranged (range > 1)**: Projectile spawned at windup completion. Travels at 8 px/tick. Damage on impact.

### Windup cancellation
If target exits attack range during windup: attack cancelled, `isInWindup = false`, unit → `'moving'`.

---

## Ability Cast System

### General flow
1. `isReadyToCast()` checks: `manaLockTimer ≤ 0 AND currentMana ≥ maxMana`. Fires **before** the normal state machine — interrupts any state.
2. `state = 'casting'`, cast timer set.
3. Each tick: `abilityCastTimer--`.
4. When timer reaches 0: `onCast()` fires → effect executes.
5. `applyManaLock()`: `currentMana = 0`, `manaLockTimer = 60` (1 second — unit cannot gain mana or recast).
6. `state = 'idle'`.

### Cast times
| Unit | Cast ticks | ≈ seconds |
|------|-----------|-----------|
| Tangela | 20 | 0.33s |
| Vigoroth | 15 | 0.25s |
| Ribombee | 20 | 0.33s |

---

## Ability Specifics

### Tangela — Leaf Guard
- Applies a timed shield (4 seconds = 240 ticks) of value 400/525/685.
- `onExpire` (time runs out OR shield fully absorbed): heals for **50% of remaining shield value**.
- Multiple casts stack as separate shields.

### Vigoroth — Fury Swipes
1. Finds furthest enemy within 4 hexes (falls back to current target if none in range).
2. Finds a free adjacent hex next to that enemy.
3. If no free adjacent hex exists: ability does nothing (no effects applied).
4. **Leap movement**: Vigoroth slides to the destination in a **straight line** at ~5× normal speed (~7.5 hex/sec). The path is computed with `hexLinePath()` (cube-coordinate lerp) — it is a true geometric straight line, not A\*.
5. **Passes through units**: Vigoroth does not claim intermediate hexes during the leap. Other units' `hexOccupancy` entries are left untouched. Only the destination hex is claimed on arrival.
6. Applies shield (150/200/250), `atkSpd_buff`, and `dmg_buff` immediately at cast time (before the leap starts).
7. Buffs are **permanent** until the shield breaks — `onShieldExpire` removes both.
8. `state = 'leaping'` during transit: cannot attack, cast, or retarget. On arrival → `'idle'`, haste removed, nearest enemy re-acquired.

### Ribombee — Pollen Puff
- Launches 2 projectiles simultaneously at cast completion.
- **Heal puff** (green): travels to lowest-HP ally at 10 px/tick, heals 100/175/300 on impact.
- **Damage puff** (purple): travels to nearest enemy at 10 px/tick, deals 100/175/300 magic damage on impact + applies `chill` (−30% attack speed for 1 second).
- Ribombee immediately returns to normal behavior after cast — projectiles fly independently.
- If no ally target: heal puff skipped. If no enemy target: damage puff skipped.

---

## Projectiles

- Track target's **visual position** (pixel-space), not hex position — they follow moving targets.
- Hit detection: when distance to target ≤ `speed + hitRadius`.
- If target dies before impact: projectile removed instantly (no hit).
- Damage projectiles grant mana to the target on hit (`preMitigDmg × 0.07`).
- Heal projectiles do NOT grant mana.

---

## Mana System

| Event | Mana gained | Condition |
|-------|------------|-----------|
| Attacker lands an auto | +10 | `manaLockTimer = 0` |
| Unit takes damage | `floor(preMitigDmg × 0.07)` | `manaLockTimer = 0` |

After casting: `currentMana = 0`, `manaLockTimer = 60` (1 second of no mana gain).

---

## Shields

- Absorb damage **before HP**, front-to-back (index 0 first).
- Multiple shields can stack.
- `durationTicks = -1`: permanent until broken by damage.
- On timer expiry or full absorption: `onExpire(unit, shield)` fires, then shield removed.
- The visual shield ring is shown on units with any active shield > 0.

---

## Known Bugs (to fix)

| Priority | Bug | Location |
|----------|-----|---------|
| **Critical** | Dead unit's hex stays in `hexOccupancy` — blocks pathfinding | `damage.ts` — on death, need `hexOccupancy.delete(hexId(target.hexPos))` |
| **Critical** | Two units can step onto the same hex in the same tick | `combatEngine.ts` tick loop — no destination reservation before movement |
| **Medium** | Vigoroth applies buffs/shield even if leap destination has no free hex | `vigoroth.ts` — wrap all effects inside `if (dest)` |
| **Medium** | `MANA_LOCK_TICKS = 60` (1 second) is very short — fast units can recast quickly | `constants.ts` |
