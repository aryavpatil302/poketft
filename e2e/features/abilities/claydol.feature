Feature: Claydol - Gravity

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 lifts 2 enemies and slams them
    Given claydol is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "claydol_t1_lift_slam"

  Scenario: Tier 1 slam AoE hits nearby enemies
    Given claydol is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "claydol_t1_aoe_slam"

  Scenario: Tier 3 massive cosmic slam damage
    Given claydol is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "claydol_t3_showcase"
