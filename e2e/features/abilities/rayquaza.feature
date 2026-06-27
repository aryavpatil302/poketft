Feature: Rayquaza - Dragon Ascent

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 ascends with target then slams
    Given rayquaza is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "rayquaza_t1_basic"

  Scenario: Tier 1 slam AoE hits nearby enemies
    Given rayquaza is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "rayquaza_t1_aoe_slam"

  Scenario: Tier 3 devastating true damage slam
    Given rayquaza is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "rayquaza_t3_showcase"
