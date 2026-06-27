Feature: Noivern - Boomburst

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 boomburst hits all enemies within 3 rows
    Given noivern is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 3 row 3
    And a low dummy is placed at col 4 row 4
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "noivern_t1_multi_row"

  Scenario: Tier 1 boomburst does not hit enemies beyond 3 rows range
    Given noivern is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 3
    And a high dummy is placed at col 3 row 0
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "noivern_t1_range_limit"

  Scenario: Tier 3 massive damage hits all nearby enemies
    Given noivern is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 3 row 3
    And a high dummy is placed at col 4 row 4
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "noivern_t3_showcase"
