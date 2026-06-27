Feature: Drednaw - Razor Shell

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 adds AoE splash passive for 5 seconds
    Given drednaw is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "drednaw_t1_basic"

  Scenario: Tier 1 splash damages nearby enemies on each auto
    Given drednaw is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "drednaw_t1_splash"

  Scenario: Tier 3 heavy splash damage window
    Given drednaw is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "drednaw_t3_showcase"
