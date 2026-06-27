Feature: Excadrill - Drill Run

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 leaps and knocks up furthest enemy
    Given excadrill is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "excadrill_t1_basic"

  Scenario: Tier 1 three empowered AoE attacks after landing
    Given excadrill is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "excadrill_t1_aoe_attacks"

  Scenario: Tier 3 long knockup and powerful drill hits
    Given excadrill is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "excadrill_t3_showcase"
