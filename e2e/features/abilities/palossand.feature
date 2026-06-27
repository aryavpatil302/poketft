Feature: Palossand - Scorching Sands

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 sand tomb hits 2 enemies with burn
    Given palossand is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "palossand_t1_basic"

  Scenario: Tier 2 sand tomb hits 3 enemies
    Given palossand is placed as player at col 3 row 5 at tier 2
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "palossand_t2_triple"

  Scenario: Tier 3 with spell buff stacks — massive sand tomb damage
    Given palossand is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "palossand_t3_showcase"
