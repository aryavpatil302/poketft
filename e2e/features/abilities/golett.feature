Feature: Golett - Shadow Punch

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 every 4th auto fires shadow punch
    Given golett is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "golett_t1_basic"

  Scenario: Tier 1 shadow punch AoE splashes nearby enemies
    Given golett is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "golett_t1_aoe"

  Scenario: Tier 3 powerful shadow punch AoE
    Given golett is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "golett_t3_showcase"
