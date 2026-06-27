Feature: Blastoise - Hydro Cannons

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 passive hydro shots on each auto for 5 seconds
    Given blastoise is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "blastoise_t1_basic"

  Scenario: Tier 1 hydro cannon spam against multiple enemies
    Given blastoise is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "blastoise_t1_multi"

  Scenario: Tier 3 rapid fire hydro cannon showcase
    Given blastoise is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "blastoise_t3_showcase"
