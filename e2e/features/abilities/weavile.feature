Feature: Weavile - Triple Axel

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 three-hit combo with physical, magic AoE, and knockup
    Given weavile is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "weavile_t1_basic"

  Scenario: Tier 1 AoE spin hits enemies adjacent to primary target
    Given weavile is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "weavile_t1_aoe_spin"

  Scenario: Tier 3 devastating triple axel with max HP damage
    Given weavile is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "weavile_t3_showcase"
