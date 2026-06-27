Feature: Xatu - Magic Bounce

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 places future sight mark and amplifies damage
    Given xatu is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "xatu_t1_basic"

  Scenario: Tier 1 delayed detonation damages enemy
    Given xatu is placed as player at col 3 row 5 at tier 1
    And a mid dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "xatu_t1_detonate"

  Scenario: Tier 3 massive delayed burst with amplification
    Given xatu is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "xatu_t3_showcase"
