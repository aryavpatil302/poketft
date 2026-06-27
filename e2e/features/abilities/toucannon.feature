Feature: Toucannon - Beak Blast

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 beak blast fires at target and explodes in 1 hex radius
    Given toucannon is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "toucannon_t1_aoe"

  Scenario: Tier 1 explosion heals allies in blast radius
    Given toucannon is placed as player at col 3 row 5 at tier 1
    And tangela is placed as player at col 2 row 4 at tier 1
    And a melee attacker is placed at col 3 row 2
    And a melee attacker is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "toucannon_t1_ally_heal"

  Scenario: Tier 3 massive single-target blast
    Given toucannon is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    And a high dummy is placed at col 4 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "toucannon_t3_showcase"
