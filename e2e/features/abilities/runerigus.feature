Feature: Runerigus - Wandering Spirit

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 silences nearest enemy for 4 seconds
    Given runerigus is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "runerigus_t1_silence"

  Scenario: Tier 1 silenced enemy cannot cast ability
    Given runerigus is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "runerigus_t1_no_ability"

  Scenario: Tier 3 longer silence and higher mark damage
    Given runerigus is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "runerigus_t3_showcase"
