Feature: Abomasnow - Blizzard

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 creates blizzard AoE zone around self
    Given abomasnow is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "abomasnow_t1_basic"

  Scenario: Tier 1 blizzard damages multiple nearby enemies
    Given abomasnow is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 4
    And a low dummy is placed at col 4 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "abomasnow_t1_multi"

  Scenario: Tier 3 heavy blizzard sustained damage
    Given abomasnow is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 4
    And a high dummy is placed at col 2 row 4
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "abomasnow_t3_showcase"
