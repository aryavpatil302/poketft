Feature: Wheezing - Poison Gas

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 creates poison AoE zone around self
    Given wheezing is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "wheezing_t1_zone"

  Scenario: Tier 1 zone damages multiple nearby enemies
    Given wheezing is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 4
    And a low dummy is placed at col 4 row 4
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "wheezing_t1_multi"

  Scenario: Tier 3 extended zone with heavy armor stacking
    Given wheezing is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 4
    And a high dummy is placed at col 2 row 4
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "wheezing_t3_showcase"
