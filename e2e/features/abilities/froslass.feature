Feature: Froslass - Icy Wind

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 blizzard line hits enemies in a straight line
    Given froslass is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "froslass_t1_basic"

  Scenario: Tier 1 falloff damage to multiple enemies in line
    Given froslass is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 3 row 1
    And a low dummy is placed at col 3 row 0
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "froslass_t1_falloff"

  Scenario: Tier 3 massive blizzard line with heavy chill
    Given froslass is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 3 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "froslass_t3_showcase"
