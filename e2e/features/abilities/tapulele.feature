Feature: Tapu Lele - Nature's Madness

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 AoE psychic blast hits enemies in 4-hex radius
    Given tapulele is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapulele_t1_basic"

  Scenario: Tier 1 second cast deals true damage on psychic terrain
    Given tapulele is placed as player at col 3 row 5 at tier 1
    And a mid dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapulele_t1_terrain"

  Scenario: Tier 3 massive psychic radius blast
    Given tapulele is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 1 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapulele_t3_showcase"
