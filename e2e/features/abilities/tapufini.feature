Feature: Tapu Fini - Nature's Madness

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 creates whirlpool zone on nearest enemy
    Given tapufini is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapufini_t1_basic"

  Scenario: Tier 1 whirlpool zones damage and reduce defense
    Given tapufini is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapufini_t1_multi"

  Scenario: Tier 3 misty terrain double-cast whirlpool showcase
    Given tapufini is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapufini_t3_showcase"
