Feature: Morelull - Strength Sap

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 damages enemy and heals nearest ally
    Given morelull is placed as player at col 3 row 5 at tier 1
    Given tangela is placed as player at col 2 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "morelull_t1_basic"

  Scenario: Tier 1 attack reduction on nearest enemy
    Given morelull is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "morelull_t1_atk_reduce"

  Scenario: Tier 3 strong magic damage, heavy heal, and deep attack reduction
    Given morelull is placed as player at col 3 row 5 at tier 3
    Given venusaur is placed as player at col 2 row 6 at tier 1
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "morelull_t3_showcase"
