Feature: Grapploct - Octolock

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 stuns 2 enemies and gains attack from SpellBuff
    Given grapploct is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "grapploct_t1_basic"

  Scenario: Tier 2 stuns 3 enemies
    Given grapploct is placed as player at col 3 row 5 at tier 2
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    And a low dummy is placed at col 4 row 1
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "grapploct_t2_triple_stun"

  Scenario: Tier 3 massive stun to 4 enemies with permanent attack gain
    Given grapploct is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 2 row 1
    And a high dummy is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "grapploct_t3_showcase"
