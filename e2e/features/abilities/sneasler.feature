Feature: Sneasler - Dire Claw

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 physical damage and poison on nearest enemy
    Given sneasler is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "sneasler_t1_basic"

  Scenario: Tier 1 critical hit when target is already poisoned
    Given sneasler is placed as player at col 3 row 5 at tier 1
    And a mid dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "sneasler_t1_crit_poison"

  Scenario: Tier 3 devastating claws with heavy poison
    Given sneasler is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "sneasler_t3_showcase"
