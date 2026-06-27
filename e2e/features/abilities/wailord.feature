Feature: Wailord - Bounce

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 belly flops to center and stuns nearby enemies
    Given wailord is placed as player at col 3 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "wailord_t1_basic"

  Scenario: Tier 1 AoE stun hits multiple enemies in center
    Given wailord is placed as player at col 3 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "wailord_t1_multi_stun"

  Scenario: Tier 3 massive AoE and enormous shield
    Given wailord is placed as player at col 3 row 6 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "wailord_t3_showcase"
