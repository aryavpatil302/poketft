Feature: Snorunt - Ice Body

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 shield activates and explodes with AoE chill
    Given snorunt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "snorunt_t1_shield_explode"

  Scenario: Tier 1 AoE chill on expiry hits multiple nearby enemies
    Given snorunt is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 4
    And a low dummy is placed at col 2 row 4
    And a low dummy is placed at col 4 row 4
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "snorunt_t1_aoe_chill"

  Scenario: Tier 3 large shield and devastating frost burst
    Given snorunt is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 4
    And a high dummy is placed at col 2 row 4
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "snorunt_t3_showcase"
