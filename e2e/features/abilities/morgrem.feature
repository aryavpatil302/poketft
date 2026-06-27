Feature: Morgrem - Spirit Break

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 gains shield and taunts nearest enemy
    Given morgrem is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "morgrem_t1_basic"

  Scenario: Tier 1 taunt burst fires when effect expires
    Given morgrem is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "morgrem_t1_burst"

  Scenario: Tier 3 large shield and devastating burst at expire
    Given morgrem is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "morgrem_t3_showcase"
