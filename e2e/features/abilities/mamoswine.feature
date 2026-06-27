Feature: Mamoswine - Thick Fat

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 gains armor and spDef buffs then attacks with stat bonus damage
    Given mamoswine is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "mamoswine_t1_basic"

  Scenario: Tier 1 passive auto attack bonus damages multiple enemies
    Given mamoswine is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 2
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "mamoswine_t1_multi"

  Scenario: Tier 3 massive armor buffs with powerful magic autos
    Given mamoswine is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "mamoswine_t3_showcase"
