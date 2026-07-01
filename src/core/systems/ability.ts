import type { Unit, CombatState } from '../types'
import { applyManaLock } from './mana'
import { attackCooldownTicks, windupTicks } from './attack'
import { applyDamage } from './damage'
import { removeStatusEffectByStack } from './statusEffect'

// ─── Ability handler interface ────────────────────────────────────────────────

export interface AbilityHandler {
  abilityId: string
  castTimeTicks: number   // animation ticks before effect fires (typically 20–30)
  onCast(unit: Unit, state: CombatState, tier: number): void
}

// ─── Registry ────────────────────────────────────────────────────────────────

const ABILITY_REGISTRY = new Map<string, AbilityHandler>()

export function registerAbility(handler: AbilityHandler): void {
  ABILITY_REGISTRY.set(handler.abilityId, handler)
}

export function getAbility(abilityId: string): AbilityHandler | undefined {
  return ABILITY_REGISTRY.get(abilityId)
}

// ─── Trigger ability (called when unit reaches full mana) ─────────────────────

export function triggerAbility(unit: Unit, state: CombatState): void {
  // Runerigus Wandering Spirit: intercept the cast the moment it would fire —
  // deal damage instead and consume the mark, rather than blocking casts for a duration.
  const wanderingSpirit = unit.statusEffects.find(fx => fx.stackId === 'runerigus_wandering_spirit')
  if (wanderingSpirit) {
    removeStatusEffectByStack(unit, 'runerigus_wandering_spirit')
    unit.silenced = unit.statusEffects.some(fx => fx.id === 'silence')
    const source = state.units.get(wanderingSpirit.sourceUnitId) ?? unit
    applyDamage(source, unit, {
      baseAmount: wanderingSpirit.magnitude ?? 0,
      damageType: 'magic',
      canCrit:    false,
      abilityId:  'runerigus_wandering_spirit',
    }, state)
    state.events.push({ type: 'vfx', effectId: 'wandering_spirit_consume', unitId: unit.id })
    applyManaLock(unit)
    return
  }

  if (unit.silenced) return  // generic silence blocks casts

  const unitDef_abilityId = getUnitAbilityId(unit)
  if (!unitDef_abilityId) return

  const handler = ABILITY_REGISTRY.get(unitDef_abilityId)
  if (!handler) {
    // No handler registered — just reset mana and continue
    applyManaLock(unit)
    return
  }

  unit.state = 'casting'
  unit.abilityCastTimer = handler.castTimeTicks
  unit.isInWindup = false
  unit.attackWindupTimer = 0

  // Cancel any in-flight auto-attack projectiles so they don't arrive alongside the spell
  for (const [id, proj] of state.projectiles) {
    if (proj.sourceId === unit.id && proj.damagePayload?.abilityId === 'auto_attack') {
      state.projectiles.delete(id)
    }
  }

  state.events.push({ type: 'cast', unitId: unit.id, abilityId: unitDef_abilityId })
}

// Tick the cast animation; fires the ability after exactly castTimeTicks ticks
export function tickAbilityCast(unit: Unit, state: CombatState): void {
  unit.abilityCastTimer--
  if (unit.abilityCastTimer > 0) return

  // Set the default post-cast attack cooldown BEFORE firing onCast so abilities can
  // override it (e.g. set attackTimer = 0 for an immediate empowered follow-up attack)
  unit.attackTimer     = attackCooldownTicks(unit) - windupTicks(unit)
  unit.isInWindup      = false
  unit.attackWindupTimer = 0

  // Fire the ability
  const unitDef_abilityId = getUnitAbilityId(unit)
  if (unitDef_abilityId) {
    const handler = ABILITY_REGISTRY.get(unitDef_abilityId)
    if (handler) {
      handler.onCast(unit, state, unit.tier)
    }
  }

  // If the ability set attackTimer = 0 to request an immediate follow-up attack,
  // start the windup on this same tick so there's no visible gap after the cast.
  if (unit.attackTimer === 0 && unit.state === 'casting' && unit.targetId) {
    const tgt = state.units.get(unit.targetId)
    if (tgt && tgt.state !== 'dead') {
      unit.isInWindup      = true
      unit.attackWindupTimer = windupTicks(unit)
      unit.state           = 'attacking'
    }
  }

  applyManaLock(unit)
  // Only reset to idle if onCast didn't set a special state (e.g. 'leaping', 'attacking')
  if (unit.state === 'casting') unit.state = 'idle'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { UNIT_MAP } from '../../data/units'

// Original abilities
import { TangelaAbility }     from '../abilities/tangela'
import { VigorothAbility }    from '../abilities/vigoroth'
import { RibombeeAbility }    from '../abilities/ribombee'
import { VenusaurAbility }    from '../abilities/venusaur'
import { VikavoltAbility }    from '../abilities/vikavolt'
import { ToucannonAbility }   from '../abilities/toucannon'
import { TropiusAbility }     from '../abilities/tropius'
import { TapuBuluAbility }    from '../abilities/tapubulu'

// Volcanic
import { TyphlosionAbility }  from '../abilities/typhlosion'
import { TorkoalAbility }     from '../abilities/torkoal'
import { CharizardAbility }   from '../abilities/charizard'
import { ArmarougeAbility }   from '../abilities/armarouge'

// Cave Crawler
import { GravelerAbility }    from '../abilities/graveler'
import { ExcadrillAbility }   from '../abilities/excadrill'
import { ClaydolAbility }     from '../abilities/claydol'
import { AerodactylAbility }  from '../abilities/aerodactyl'
import { GolettAbility }      from '../abilities/golett'
import { GolurkAbility }      from '../abilities/golurk'
import { MegaGolurkAbility }  from '../abilities/mega_golurk'
import { StonjournerAbility } from '../abilities/stonjourner'
import { DruddigonAbility }   from '../abilities/druddigon'

// Sky Striker
import { ZubatAbility }       from '../abilities/zubat'
import { PidgeottoAbility }   from '../abilities/pidgeotto'
import { GibleAbility }       from '../abilities/gible'
import { NoivernAbility }     from '../abilities/noivern'
import { TalonflameAbility }  from '../abilities/talonflame'
import { RayquazaAbility }    from '../abilities/rayquaza'

// Froststone
import { SnorunAbility }      from '../abilities/snorunt'
import { FroslassAbility }    from '../abilities/froslass'
import { HAvaluggAbility }    from '../abilities/h_avalugg'
import { AbomasnowAbility }   from '../abilities/abomasnow'
import { WeavileAbility }     from '../abilities/weavile'
import { SneaslerAbility }    from '../abilities/sneasler'
import { MamoswineAbility }   from '../abilities/mamoswine'

// River
import { KinglerAbility }     from '../abilities/kingler'
import { KlawfAbility }       from '../abilities/klawf'
import { DrednawAbility }     from '../abilities/drednaw'
import { BarraskewdaAbility } from '../abilities/barraskewda'
import { GrapploctAbility }   from '../abilities/grapploct'
import { WailordAbility }     from '../abilities/wailord'
import { BlastoiseAbility }   from '../abilities/blastoise'
import { TapuFiniAbility }    from '../abilities/tapufini'
import { QuagsireAbility }    from '../abilities/quagsire'

// Temporal Woods
import { MorelullAbility }    from '../abilities/morelull'
import { GogoatAbility }      from '../abilities/gogoat'
import { OranGuruAbility }    from '../abilities/oranguru'
import { CelebiAbility }      from '../abilities/celebi'

// Ruiner
import { UnownAbility }       from '../abilities/unown'
import { MorgremAbility }     from '../abilities/morgrem'
import { SableyeAbility }     from '../abilities/sableye'
import { AbsolAbility }       from '../abilities/absol'
import { XatuAbility }        from '../abilities/xatu'
import { FezandiptiAbility }  from '../abilities/fezandipiti'
import { SpiritombAbility }   from '../abilities/spiritomb'
import { RunerigusAbility }   from '../abilities/runerigus'

// Ascender
import { ARaichuAbility }     from '../abilities/a_raichu'
import { AExeggutorAbility }  from '../abilities/a_exeggutor'
import { AMaRowakAbility }    from '../abilities/a_marowak'

// Beachy
import { PalossandAbility }   from '../abilities/palossand'
import { BelliboltAbility }   from '../abilities/bellibolt'
import { TapuKokoAbility }    from '../abilities/tapukoko'
import { TapuLeleAbility }    from '../abilities/tapulele'

// Shared / multi-trait
import { FerrothornAbility }  from '../abilities/ferrothorn'
import { WheezingAbility }    from '../abilities/wheezing'

// Auto-register all known abilities
registerAbility(TangelaAbility)
registerAbility(VigorothAbility)
registerAbility(RibombeeAbility)
registerAbility(VenusaurAbility)
registerAbility(VikavoltAbility)
registerAbility(ToucannonAbility)
registerAbility(TropiusAbility)
registerAbility(TapuBuluAbility)
registerAbility(TyphlosionAbility)
registerAbility(TorkoalAbility)
registerAbility(CharizardAbility)
registerAbility(ArmarougeAbility)
registerAbility(GravelerAbility)
registerAbility(ExcadrillAbility)
registerAbility(ClaydolAbility)
registerAbility(AerodactylAbility)
registerAbility(GolettAbility)
registerAbility(GolurkAbility)
registerAbility(MegaGolurkAbility)
registerAbility(StonjournerAbility)
registerAbility(DruddigonAbility)
registerAbility(ZubatAbility)
registerAbility(PidgeottoAbility)
registerAbility(GibleAbility)
registerAbility(NoivernAbility)
registerAbility(TalonflameAbility)
registerAbility(RayquazaAbility)
registerAbility(SnorunAbility)
registerAbility(FroslassAbility)
registerAbility(HAvaluggAbility)
registerAbility(AbomasnowAbility)
registerAbility(WeavileAbility)
registerAbility(SneaslerAbility)
registerAbility(MamoswineAbility)
registerAbility(KinglerAbility)
registerAbility(KlawfAbility)
registerAbility(DrednawAbility)
registerAbility(BarraskewdaAbility)
registerAbility(GrapploctAbility)
registerAbility(WailordAbility)
registerAbility(BlastoiseAbility)
registerAbility(TapuFiniAbility)
registerAbility(QuagsireAbility)
registerAbility(MorelullAbility)
registerAbility(GogoatAbility)
registerAbility(OranGuruAbility)
registerAbility(CelebiAbility)
registerAbility(UnownAbility)
registerAbility(MorgremAbility)
registerAbility(SableyeAbility)
registerAbility(AbsolAbility)
registerAbility(XatuAbility)
registerAbility(FezandiptiAbility)
registerAbility(SpiritombAbility)
registerAbility(RunerigusAbility)
registerAbility(ARaichuAbility)
registerAbility(AExeggutorAbility)
registerAbility(AMaRowakAbility)
registerAbility(PalossandAbility)
registerAbility(BelliboltAbility)
registerAbility(TapuKokoAbility)
registerAbility(TapuLeleAbility)
registerAbility(FerrothornAbility)
registerAbility(WheezingAbility)

function getUnitAbilityId(unit: Unit): string | null {
  const def = UNIT_MAP.get(unit.definitionId)
  return def?.ability?.id ?? null
}
