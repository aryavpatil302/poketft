Feature: Tapu Bulu - Nature's Madness

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 doubles HP and gains armor and magic resist
    Given tapubulu is placed as player at col 3 row 5 at tier 1
    And a melee attacker is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapubulu_t1_madness"

  Scenario: Tier 1 every third attack heals Tapu Bulu
    Given tapubulu is placed as player at col 3 row 5 at tier 1
    And a melee attacker is placed at col 3 row 2
    And a melee attacker is placed at col 2 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapubulu_t1_third_attack_heal"

  Scenario: Tier 1 attack speed is capped at 0.5 after cast
    Given tapubulu is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapubulu_t1_slow_atk"

  Scenario: Tier 3 massive HP doubling and overpowered stats
    Given tapubulu is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 40 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapubulu_t3_showcase"
