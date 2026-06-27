Feature: Bellibolt - Electrophoresis

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 discharges charge built from auto attacks
    Given bellibolt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "bellibolt_t1_basic"

  Scenario: Tier 1 discharge splits across multiple enemies
    Given bellibolt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "bellibolt_t1_multi"

  Scenario: Tier 3 massive charge discharge
    Given bellibolt is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "bellibolt_t3_showcase"
