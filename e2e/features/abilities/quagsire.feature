Feature: Quagsire - Unaware

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 shield scales with nearby enemies and taunts adjacent
    Given quagsire is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "quagsire_t1_basic"

  Scenario: Tier 1 shield explodes on expiry dealing AoE chill
    Given quagsire is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 4
    And a low dummy is placed at col 4 row 4
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "quagsire_t1_explode"

  Scenario: Tier 3 massive shield and extended AoE burst
    Given quagsire is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 4
    And a high dummy is placed at col 2 row 4
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "quagsire_t3_showcase"
