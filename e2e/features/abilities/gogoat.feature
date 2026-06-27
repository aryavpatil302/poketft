Feature: Gogoat - Grass Pelt

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 three empowered autos healing self and ally
    Given gogoat is placed as player at col 3 row 5 at tier 1
    Given tangela is placed as player at col 2 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "gogoat_t1_basic"

  Scenario: Tier 1 sustained healing keeps team alive
    Given gogoat is placed as player at col 3 row 5 at tier 1
    Given ribombee is placed as player at col 2 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "gogoat_t1_sustained"

  Scenario: Tier 3 powerful horn attacks and large heals
    Given gogoat is placed as player at col 3 row 5 at tier 3
    Given venusaur is placed as player at col 2 row 6 at tier 1
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "gogoat_t3_showcase"
