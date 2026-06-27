Feature: Ferrothorn - Iron Barbs

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 gains retaliation shield from Iron Barbs
    Given ferrothorn is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "ferrothorn_t1_basic"

  Scenario: Tier 1 iron barbs survives multiple attackers
    Given ferrothorn is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "ferrothorn_t1_multi"

  Scenario: Tier 3 large shield and extended retaliation window
    Given ferrothorn is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "ferrothorn_t3_showcase"
