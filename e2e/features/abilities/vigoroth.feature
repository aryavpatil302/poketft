Feature: Vigoroth - Fury Swipes

  Background:
    Given the battle simulator is open in test mode

  Scenario: Leaps to furthest enemy in a straight column
    Given vigoroth is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 3 row 3
    And a low dummy is placed at col 3 row 1
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vigoroth_leap_straight"

  Scenario: Leaps to furthest enemy when dummies are spread across columns
    Given vigoroth is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 2 row 4
    And a low dummy is placed at col 4 row 3
    And a low dummy is placed at col 3 row 1
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vigoroth_leap_spread"

  Scenario: Tier 3 leaps to furthest enemy in diagonal arrangement
    Given vigoroth is placed as player at col 3 row 5 at tier 3
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 3
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "vigoroth_t3_leap_diagonal"
