Feature: Typhlosion - Eruption

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 eruption hits nearest enemy
    Given typhlosion is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "typhlosion_t1_basic"

  Scenario: Tier 1 eruption with multiple enemies (hits only nearest)
    Given typhlosion is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "typhlosion_t1_multi"

  Scenario: Tier 3 eruption hits 3 enemies
    Given typhlosion is placed as player at col 3 row 5 at tier 3
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "typhlosion_t3_triple"
