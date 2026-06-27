Feature: Barraskewda - Fishous Rend

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 leaps to lowest HP enemy and deals physical damage
    Given barraskewda is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "barraskewda_t1_basic"

  Scenario: Tier 1 targets lowest HP enemy in group
    Given barraskewda is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a mid dummy is placed at col 2 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "barraskewda_t1_target"

  Scenario: Tier 3 massive physical dive and mana drain
    Given barraskewda is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "barraskewda_t3_showcase"
