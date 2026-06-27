Feature: Celebi - Future Sight

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 marks 2 enemies with amplified incoming damage
    Given celebi is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "celebi_t1_basic"

  Scenario: Tier 2 marks 3 enemies with detonation burst
    Given celebi is placed as player at col 3 row 5 at tier 2
    And a mid dummy is placed at col 3 row 2
    And a mid dummy is placed at col 2 row 1
    And a mid dummy is placed at col 4 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "celebi_t2_triple_mark"

  Scenario: Tier 3 massive detonation across 4 marked enemies
    Given celebi is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "celebi_t3_showcase"
