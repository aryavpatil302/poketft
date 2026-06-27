Feature: Aerodactyl - Ancient Power

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 permanently buffs all stats and adds passive rock throw
    Given aerodactyl is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "aerodactyl_t1_basic"

  Scenario: Tier 1 rock projectile fires at furthest enemy each auto
    Given aerodactyl is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 0 row 0
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "aerodactyl_t1_rock_target"

  Scenario: Tier 3 massive stat boosts and rapid rock fire
    Given aerodactyl is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    And a high dummy is placed at col 1 row 1
    When I start combat and wait 25 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "aerodactyl_t3_showcase"
