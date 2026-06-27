Feature: Kingler - Crabhammer

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 empowered physical attack on next auto
    Given kingler is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "kingler_t1_basic"

  Scenario: Tier 1 spell buff increases crabhammer damage
    Given kingler is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "kingler_t1_spellbuff"

  Scenario: Tier 3 massive crabhammer with accumulated spell buff
    Given kingler is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "kingler_t3_showcase"
