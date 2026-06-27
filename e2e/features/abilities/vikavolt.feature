Feature: Vikavolt - Discharge

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 discharge hits most populated row
    Given vikavolt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 3 row 1
    And a low dummy is placed at col 4 row 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vikavolt_t1_row_select"

  Scenario: Tiebreaker targets row with lowest total HP
    Given vikavolt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 1
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vikavolt_tiebreaker_low_hp"

  Scenario: Tier 3 massive discharge stuns full row
    Given vikavolt is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 3 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vikavolt_t3_multi_stun"

  Scenario: Tier 1 does bonus damage to shielded enemies
    Given vikavolt is placed as player at col 3 row 5 at tier 1
    And tangela is placed as player at col 4 row 2 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vikavolt_t1_shield_bonus"
