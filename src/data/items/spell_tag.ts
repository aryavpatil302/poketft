import type { ItemModule } from '../../core/types'

// Spell Tag: restore manaRefund mana after each cast. Honored in tickAbilityCast
// after the post-cast mana lock (see ability.ts).
export const spellTag: ItemModule = {
  def: {
    id: 'spell_tag',
    categories: ['attack caster', 'special caster'],
    name: 'Spell Tag',
    description: '+10 Special Attack, +10 Attack. After the holder finishes casting, restore 10 mana.',
    statBonus: { special: 10, attack: 10 },
    iconPath: '/visuals/item icons/spell_tag.png',
    effect: { manaRefund: 10 },   // mana restored after each cast
  },
  passive(unit, _state, def) {
    unit.manaRefundOnCast = (unit.manaRefundOnCast ?? 0) + (def.effect?.manaRefund ?? 10)
  },
}
