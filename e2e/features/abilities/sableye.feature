Feature: Sableye - Power Gem

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 odd cast applies magic damage and charm
    Given sableye is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "sableye_t1_odd_cast"

  Scenario: Tier 1 alternating casts (even cast gives shield and speed)
    Given sableye is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "sableye_t1_even_cast"

  Scenario: Tier 3 high-damage charm plus strong shield cycle
    Given sableye is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "sableye_t3_showcase"
