Feature: Ribombee - Pollen Puff

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 fires healing puff at lowest HP ally and damage puff at nearest enemy
    Given ribombee is placed as player at col 3 row 5 at tier 1
    And tangela is placed as player at col 2 row 6 at tier 1
    And vigoroth is placed as player at col 4 row 6 at tier 1
    And a ranged attacker is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "ribombee_t1_basic"

  Scenario: Tier 1 attack speed debuff on hit enemy
    Given ribombee is placed as player at col 3 row 5 at tier 1
    And a melee attacker is placed at col 3 row 2
    And a melee attacker is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "ribombee_t1_atkspd_debuff"

  Scenario: Tier 3 enhanced healing and damage with multiple allies
    Given ribombee is placed as player at col 3 row 5 at tier 3
    And tangela is placed as player at col 2 row 6 at tier 3
    And a ranged attacker is placed at col 3 row 2
    And a ranged attacker is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "ribombee_t3_showcase"
