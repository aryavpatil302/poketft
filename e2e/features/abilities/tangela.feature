Feature: Tangela - Leaf Guard

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 shield absorbs melee damage
    Given tangela is placed as player at col 3 row 5 at tier 1
    And a melee attacker is placed at col 3 row 2
    And a melee attacker is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tangela_t1_shield_melee"

  Scenario: Tier 1 shield absorbs ranged damage
    Given tangela is placed as player at col 3 row 5 at tier 1
    And a ranged attacker is placed at col 3 row 2
    And a ranged attacker is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tangela_t1_shield_ranged"

  Scenario: Tier 3 large shield holds against sustained mixed damage
    Given tangela is placed as player at col 3 row 5 at tier 3
    And a melee attacker is placed at col 3 row 2
    And a ranged attacker is placed at col 4 row 1
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tangela_t3_shield_mixed"
