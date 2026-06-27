Feature: Stonjourner - Power Spot

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 heals self and steals defense from ally
    Given stonjourner is placed as player at col 3 row 5 at tier 1
    Given tangela is placed as player at col 2 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "stonjourner_t1_basic"

  Scenario: Tier 1 defense steal makes Stonjourner tankier
    Given stonjourner is placed as player at col 3 row 5 at tier 1
    Given venusaur is placed as player at col 2 row 6 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "stonjourner_t1_steal"

  Scenario: Tier 3 big heal and massive defense transfer
    Given stonjourner is placed as player at col 3 row 5 at tier 3
    Given venusaur is placed as player at col 2 row 6 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "stonjourner_t3_showcase"
