// Simulation rate
export const TICK_RATE = 60  // ticks per second

// Mana gains
export const MANA_PER_AUTO_HIT   = 10     // attacker gains this on each auto hit
export const MANA_PER_DAMAGE_PCT = 0.07   // defender gains floor(preMitigDmg × this)

// Post-cast mana suppression
export const MANA_LOCK_TICKS = TICK_RATE  // 1 second

// Unit defaults
export const DEFAULT_MOVE_SPEED = 1.5     // hexes per second
export const TICKS_PER_HEX = Math.round(TICK_RATE / DEFAULT_MOVE_SPEED)  // 40

// Hard global cap on attack speed, attacks per second. Clamped in computeStats
// (unitFactory.ts) so it's a true global cap — every consumer of ComputedStats
// (combat cadence, the unit-panel display, damage-split math, etc.) sees the
// same already-capped number, not a raw uncapped value that only gets clamped
// at one specific call site.
export const MAX_ATTACK_SPEED = 3

// Attack windup: total animation = 24% of cooldown (20% faster than the old 30%)
export const WINDUP_FRACTION    = 0.24
// Fraction through the windup at which damage/projectile fires (peak of animation)
export const WINDUP_HIT_FRACTION = 0.40

// Damage constants
export const BLIND_MISS_CHANCE = 0.80     // 80% miss chance when blinded

// Overtime: after 30s a combat enters overtime to force a result. Every unit
// deals more and takes more, so stalemates resolve fast.
export const OVERTIME_START_TICK    = 30 * TICK_RATE  // 1800
export const OVERTIME_DAMAGE_AMP    = 0.30            // +30% outgoing damage
export const OVERTIME_DURABILITY_LOSS = 0.30          // -30% armor & sp. defense

// Rendering — hex pixel sizes
export const HEX_SIZE = 62               // pixels, flat-top hex circumradius

// Board perspective: Y-axis is compressed to simulate a 3D tilt.
// All canvas drawing and mouse-Y coords must account for this factor.
export const BOARD_PERSP_Y = 0.70

// Extra transparent canvas space above the board on the unit layer, so overlays
// drawn above a top-row unit (stun/knockup icons, marks, airborne stretch,
// health bars) aren't clipped by the canvas top edge. The unit canvas is grown
// and shifted up by this much, and its draw is translated down to compensate,
// so on-board positions are unchanged. See resizeCanvases + UnitLayer.draw.
export const OVERLAY_HEADROOM = 100
