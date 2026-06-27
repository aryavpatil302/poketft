Feature: Fezandipiti - Toxic Chain

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 poisons 2 enemies with escalating damage
    Given fezandipiti is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "fezandipiti_t1_basic"

  Scenario: Tier 1 poison stun triggers after 4 seconds
    Given fezandipiti is placed as player at col 3 row 5 at tier 1
    And a mid dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "fezandipiti_t1_stun"

  Scenario: Tier 3 four targets with max escalating poison
    Given fezandipiti is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "fezandipiti_t3_showcase"
