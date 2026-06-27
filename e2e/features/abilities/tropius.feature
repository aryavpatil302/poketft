Feature: Tropius - Leaf Tornado

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 tornado hits enemies in a straight line
    Given tropius is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 3
    And a low dummy is placed at col 3 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tropius_t1_line"

  Scenario: Tier 1 tornado hits 3 hex wide — enemies off-center in the column are hit
    Given tropius is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tropius_t1_wide"

  Scenario: Tier 1 shield stacks for each enemy hit — more hits means more shield
    Given tropius is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 4 row 2
    And a low dummy is placed at col 3 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tropius_t1_shield_stack"

  Scenario: Tier 3 tornado knockup and massive shield with sustained damage
    Given tropius is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tropius_t3_showcase"
