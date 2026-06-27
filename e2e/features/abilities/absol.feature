Feature: Absol - Night Slash

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 night slash hits adjacent enemy
    Given absol is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "absol_t1_basic"

  Scenario: Tier 1 AoE hits multiple adjacent enemies and heals
    Given absol is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 4
    And a low dummy is placed at col 4 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "absol_t1_multi"

  Scenario: Tier 3 devastating Night Slash with large heal
    Given absol is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 4
    And a high dummy is placed at col 2 row 4
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "absol_t3_showcase"
