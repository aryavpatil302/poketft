Feature: Spiritomb - Destiny Bond

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 creates AoE zone and marks distant enemy
    Given spiritomb is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 0 row 0
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "spiritomb_t1_zone"

  Scenario: Tier 1 zone damages nearby enemies over time
    Given spiritomb is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 4
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "spiritomb_t1_multi"

  Scenario: Tier 3 heavy zone damage with far-enemy mirror
    Given spiritomb is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 4
    And a high dummy is placed at col 0 row 0
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "spiritomb_t3_showcase"
