Feature: H-Avalugg - Mountain Gale

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 crashes icicles on 3 nearest enemies
    Given h_avalugg is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "h_avalugg_t1_basic"

  Scenario: Tier 2 hits 4 enemies with knockup
    Given h_avalugg is placed as player at col 3 row 5 at tier 2
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    And a low dummy is placed at col 3 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "h_avalugg_t2_quad"

  Scenario: Tier 3 five-target icicle crash with long knockup
    Given h_avalugg is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "h_avalugg_t3_showcase"
