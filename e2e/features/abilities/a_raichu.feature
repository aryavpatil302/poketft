Feature: A-Raichu - Surge Surfer

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 leaps to enemy and fires 2 surf projectiles
    Given a_raichu is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_raichu_t1_basic"

  Scenario: Tier 1 fires extra projectiles with spell buff stacks
    Given a_raichu is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_raichu_t1_spellbuff"

  Scenario: Tier 3 high damage surfing across the board
    Given a_raichu is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_raichu_t3_showcase"
