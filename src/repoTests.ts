// Repo-tracked quick tests. Each JSON file in tests/ is imported here so it
// gets bundled and appears in the sidebar on any machine that pulls the repo.
// In dev mode, saving a local test auto-writes tests/<slug>.json and patches
// this file — commit both to share the test with the rest of the team.

// AUTO-IMPORTS-START
import rayquazaBasic    from '../tests/rayquaza-basic.json'
import tapuLeleBasic    from '../tests/tapu-lele-basic.json'
import fezandipitiBasic from '../tests/fezandipiti-basic.json'
import celebiBasic      from '../tests/celebi-basic.json'
import bounce from '../tests/bounce.json'
import tflame from '../tests/tflame.json'
import multiflame from '../tests/multiflame.json'
import tflameTest from '../tests/tflame-test.json'
import bomburst from '../tests/bomburst.json'
import noivernFullTest from '../tests/noivern-full-test.json'
import rayquazaTest from '../tests/rayquaza-test.json'
import rayBattleTest from '../tests/ray-battle-test.json'
import zubatTest from '../tests/zubat-test.json'
import sableyeTest from '../tests/sableye-test.json'
import singleEnemeySablyeye from '../tests/single-enemey-sablyeye.json'
import ferro from '../tests/ferro.json'
import drill from '../tests/drill.json'
import omYest from '../tests/om-yest.json'
import caveTest from '../tests/cave-test.json'
import dragonTail from '../tests/dragon-tail.json'
import caveTesr from '../tests/cave-tesr.json'
import caveTest2 from '../tests/cave-test-2.json'
import caveTest3Drud from '../tests/cave-test-3-drud.json'
import drednaw from '../tests/drednaw.json'
import bellibolt from '../tests/bellibolt.json'
import quag from '../tests/quag.json'
import fish from '../tests/fish.json'
import fish2 from '../tests/fish-2.json'
import morelull from '../tests/morelull.json'
import morgrem from '../tests/morgrem.json'
import morgrem3 from '../tests/morgrem-3.json'
import monkeyBasic from '../tests/monkey-basic.json'
import celbi from '../tests/celbi.json'
import fez from '../tests/fez.json'
import lele from '../tests/lele.json'
import temporalTest from '../tests/temporal-test.json'
import temporalTest2 from '../tests/temporal-test-2.json'
import temporalTestSStar5Costs from '../tests/temporal-test-s-star-5-costs.json'
// AUTO-IMPORTS-END

export interface RepoTestUnit     { id: string; tier: 1|2|3; col: number; row: number; team: 'player'|'enemy' }
export interface RepoTestScenario { label: string; units: RepoTestUnit[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const REPO_TESTS = [
  // AUTO-LIST-START
  rayquazaBasic,
  tapuLeleBasic,
  fezandipitiBasic,
  celebiBasic,
  bounce,
  tflame,
  multiflame,
  tflameTest,
  bomburst,
  noivernFullTest,
  rayquazaTest,
  rayBattleTest,
  zubatTest,
  sableyeTest,
  singleEnemeySablyeye,
  ferro,
  drill,
  omYest,
  caveTest,
  dragonTail,
  caveTesr,
  caveTest2,
  caveTest3Drud,
  drednaw,
  bellibolt,
  quag,
  fish,
  fish2,
  morelull,
  morgrem,
  morgrem3,
  monkeyBasic,
  celbi,
  fez,
  lele,
  temporalTest,
  temporalTest2,
  temporalTestSStar5Costs,
  // AUTO-LIST-END
] as unknown as RepoTestScenario[]
