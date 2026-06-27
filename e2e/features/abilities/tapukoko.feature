Feature: TapuKoko - Electric Surge

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 electric surge chains lightning and stuns on next auto
    Given tapukoko is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapukoko_t1_basic"

  Scenario: Tier 1 every 3rd auto fires passive chain lightning
    Given tapukoko is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    And a low dummy is placed at col 4 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapukoko_t1_chain"

  Scenario: Tier 3 electric terrain stacks attack speed repeatedly
    Given tapukoko is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "tapukoko_t3_terrain"
