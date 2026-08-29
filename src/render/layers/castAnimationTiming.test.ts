import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TyphlosionAbility } from '../../core/abilities/typhlosion'
import { ArmarougeAbility } from '../../core/abilities/armarouge'

// This is a source-text assertion rather than a behavioural one: the timing
// literals (`apexAt`/`total`) are inlined per-branch across seven cast blocks
// in effectLayer.ts by long-standing convention, and extracting them into
// shared constants for one ability would break that convention. There is also
// no Canvas/DOM harness in this repo to observe the animation directly, so we
// pin the invariant at the source level instead.
//
// The invariant this guards is real: src/core/systems/ability.ts emits the
// `cast` event at cast START, immediately after setting
// `abilityCastTimer = castTimeTicks`. The ability's actual effect (the
// fireball/cannon launch) therefore fires `castTimeTicks` ticks LATER.
// Retuning `castTimeTicks` on an ability without retuning its `apexAt` to
// match would silently desync the lean-and-snap animation from the moment
// the projectile actually launches, with no other signal that it happened.

const EFFECT_LAYER_PATH = join(__dirname, 'effectLayer.ts')
const effectLayerSource = readFileSync(EFFECT_LAYER_PATH, 'utf-8')

function extractCastAnimation(abilityId: string): { apexAt: number; total: number } {
  const branchMarker = `ev.abilityId === '${abilityId}'`
  const branchIndex = effectLayerSource.indexOf(branchMarker)
  if (branchIndex === -1) {
    throw new Error(`Could not find cast branch for abilityId '${abilityId}' in effectLayer.ts`)
  }

  const pushMarker = 'castAnimations.push('
  const pushIndex = effectLayerSource.indexOf(pushMarker, branchIndex)
  if (pushIndex === -1) {
    throw new Error(`Could not find castAnimations.push(...) following '${abilityId}' branch`)
  }

  // Grab a generous window of source after the push call — enough to contain
  // the full object literal, but bounded so we don't accidentally read into
  // an unrelated later branch.
  const window = effectLayerSource.slice(pushIndex, pushIndex + 400)

  const apexAtMatch = window.match(/apexAt:\s*(-?\d+)/)
  const totalMatch = window.match(/total:\s*(-?\d+)/)

  if (!apexAtMatch || !totalMatch) {
    throw new Error(`Could not parse apexAt/total from castAnimations.push(...) for '${abilityId}'`)
  }

  return { apexAt: Number(apexAtMatch[1]), total: Number(totalMatch[1]) }
}

describe('cast animation timing — apexAt bound to castTimeTicks', () => {
  it('typhlosion_eruption apexAt equals TyphlosionAbility.castTimeTicks, and total exceeds apexAt', () => {
    const { apexAt, total } = extractCastAnimation('typhlosion_eruption')
    expect(apexAt).toBe(TyphlosionAbility.castTimeTicks)
    expect(total).toBeGreaterThan(apexAt)
  })

  it('armarouge_armor_cannon apexAt equals ArmarougeAbility.castTimeTicks, and total exceeds apexAt (existing, already-correct pairing)', () => {
    const { apexAt, total } = extractCastAnimation('armarouge_armor_cannon')
    expect(apexAt).toBe(ArmarougeAbility.castTimeTicks)
    expect(total).toBeGreaterThan(apexAt)
  })
})
