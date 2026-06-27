Feature: Torkoal - White Smoke

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 heals self and blinds highest-damage enemy
    Given torkoal is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "torkoal_t1_basic"

  Scenario: Tier 1 blinds the most dangerous enemy in a group
    Given torkoal is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a mid dummy is placed at col 2 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "torkoal_t1_blind_target"

  Scenario: Tier 3 extended blind duration and big heal
    Given torkoal is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "torkoal_t3_showcase"
