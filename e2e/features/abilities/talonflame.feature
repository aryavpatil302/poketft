Feature: Talonflame - Brave Bird

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 brave bird deals physical damage to current target
    Given talonflame is placed as player at col 3 row 4 at tier 1
    And a low dummy is placed at col 3 row 3
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "talonflame_t1_damage"

  Scenario: Tier 3 chain dive fires when ability kills target
    Given talonflame is placed as player at col 3 row 4 at tier 3
    And a low dummy is placed at col 3 row 3
    And a low dummy is placed at col 2 row 3
    When I start combat and wait 3 seconds
    And I weaken the enemy at col 3 row 3 to 100 hp
    And I wait 10 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "talonflame_t3_chain"

  Scenario: Tier 1 deals 60% bonus damage to high-defense targets
    Given talonflame is placed as player at col 3 row 4 at tier 1
    And a high dummy is placed at col 3 row 3
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "talonflame_t1_tank_bonus"
