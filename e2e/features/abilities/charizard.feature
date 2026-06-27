Feature: Charizard - Blast Burn

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 first cast marks enemies
    Given charizard is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "charizard_t1_mark"

  Scenario: Tier 2 second cast executes marked enemies
    Given charizard is placed as player at col 3 row 5 at tier 2
    And a mid dummy is placed at col 3 row 2
    And a mid dummy is placed at col 2 row 1
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "charizard_t2_execute"

  Scenario: Tier 3 marks 4 enemies and executes with massive damage
    Given charizard is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "charizard_t3_showcase"
