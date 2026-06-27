Feature: Oranguru - Stored Power

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 adds wave damage on each auto for 5 seconds
    Given oranguru is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "oranguru_t1_basic"

  Scenario: Tier 1 mana gain every 5 waves
    Given oranguru is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "oranguru_t1_mana_gain"

  Scenario: Tier 3 heavy wave damage with frequent mana gains
    Given oranguru is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "oranguru_t3_showcase"
