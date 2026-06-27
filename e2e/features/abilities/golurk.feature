Feature: Golurk - Poltergeist

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 every 3rd auto fires shadow punch and gains shield
    Given golurk is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "golurk_t1_basic"

  Scenario: Tier 1 shadow punch AoE with accumulated shields
    Given golurk is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "golurk_t1_shield_stack"

  Scenario: Tier 3 massive AoE shadow punch with large shields
    Given golurk is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 4 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "golurk_t3_showcase"
