Feature: Klawf - Anger Shell

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 leaps to enemy, gains shield and attack speed
    Given klawf is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "klawf_t1_basic"

  Scenario: Tier 1 sustains with permanent attack bonus while shield holds
    Given klawf is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "klawf_t1_multi"

  Scenario: Tier 3 massive shield and speed burst showcase
    Given klawf is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "klawf_t3_showcase"
