Feature: Gible - Bite

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 leaps and stuns a nearby enemy
    Given gible is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "gible_t1_basic"

  Scenario: Tier 1 leap picks random enemy in range
    Given gible is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 3
    And a low dummy is placed at col 4 row 3
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "gible_t1_multi"

  Scenario: Tier 3 long stun and heavy physical damage
    Given gible is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "gible_t3_showcase"
