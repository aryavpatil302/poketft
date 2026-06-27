Feature: A-Exeggutor - Egg Bomb

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 fires dragon hammer projectile at nearest enemy
    Given a_exeggutor is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_exeggutor_t1_basic"

  Scenario: Tier 1 true damage bonus scales with accumulated spell buff
    Given a_exeggutor is placed as player at col 3 row 5 at tier 1
    And a mid dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_exeggutor_t1_spellbuff"

  Scenario: Tier 3 massive dragon hammer with high true damage bonus
    Given a_exeggutor is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_exeggutor_t3_showcase"
