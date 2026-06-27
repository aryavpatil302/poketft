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

// Attack windup: total animation = 24% of cooldown (20% faster than the old 30%)
export const WINDUP_FRACTION    = 0.24
// Fraction through the windup at which damage/projectile fires (peak of animation)
export const WINDUP_HIT_FRACTION = 0.40

// Damage constants
export const BLIND_MISS_CHANCE = 0.80     // 80% miss chance when blinded

// Rendering — hex pixel sizes
export const HEX_SIZE = 62               // pixels, flat-top hex circumradius

// Board perspective: Y-axis is compressed to simulate a 3D tilt.
// All canvas drawing and mouse-Y coords must account for this factor.
export const BOARD_PERSP_Y = 0.70
