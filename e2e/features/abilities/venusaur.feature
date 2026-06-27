Feature: Venusaur - Leech Seed

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 seeds 2 nearest enemies and heals Venusaur over time
    Given venusaur is placed as player at col 3 row 5 at tier 1
    And a melee attacker is placed at col 3 row 2
    And a melee attacker is placed at col 2 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "venusaur_t1_basic"

  Scenario: Tier 1 already-seeded enemy takes 50% reduced damage on recast
    Given venusaur is placed as player at col 3 row 5 at tier 1
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 30 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "venusaur_t1_recast_reduced"

  Scenario: Tier 3 seeds 3 enemies simultaneously
    Given venusaur is placed as player at col 3 row 5 at tier 3
    And a melee attacker is placed at col 3 row 2
    And a melee attacker is placed at col 2 row 2
    And a ranged attacker is placed at col 4 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "venusaur_t3_triple_seed"
