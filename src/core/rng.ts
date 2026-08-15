// Injectable RNG for combat's gameplay-affecting randomness (crit rolls, target
// tie-breaks, bounce/pool target picks). Defaults to Math.random so live games
// are unaffected; the training CLI (src/econ/train.ts) swaps in a seeded
// generator via runSimulation's rng param so repeated evaluations of a
// candidate genome see the same combat outcomes as its rivals (common random
// numbers), making candidate comparisons noise-free instead of luck-dependent.
//
// Math.random() calls elsewhere in core (projectile/unit id generation) are
// left alone — they only need uniqueness, not determinism.

export type Rng = () => number

// null = no override → read the GLOBAL Math.random fresh on every call (not a
// captured reference at module-load time), so code/tests that monkey-patch
// Math.random after this module loads still take effect, exactly like calling
// Math.random() directly used to.
let override: Rng | null = null

export function combatRng(): number {
  return (override ?? Math.random)()
}

export function setCombatRng(rng: Rng | null): void {
  override = rng
}
