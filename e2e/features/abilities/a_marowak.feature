Feature: A-Marowak - Shadow Bone

  Background:
    Given the battle simulator is open in test mode

  Scenario: Tier 1 three-hit bone combo with heal
    Given a_marowak is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    When I start combat and wait 15 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_marowak_t1_basic"

  Scenario: Tier 1 bone combo against multiple enemies
    Given a_marowak is placed as player at col 3 row 5 at tier 1
    And a low dummy is placed at col 3 row 2
    And a low dummy is placed at col 2 row 1
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_marowak_t1_multi"

  Scenario: Tier 3 powerful third hit and large self-heal
    Given a_marowak is placed as player at col 3 row 5 at tier 3
    And a high dummy is placed at col 3 row 2
    When I start combat and wait 20 seconds
    Then combat should have run without JavaScript errors
    And a screenshot is taken named "a_marowak_t3_showcase"
