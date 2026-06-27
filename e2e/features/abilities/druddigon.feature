Feature: Druddigon - Dragon Tail

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 deals physical damage to nearest enemy
    Given druddigon is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "druddigon_t1_basic"

  Scenario: Tier 1 knockup triggers when target HP is lower
    Given druddigon is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "druddigon_t1_knockup"

  Scenario: Tier 3 heavy physical damage showcase
    Given druddigon is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "druddigon_t3_showcase"
