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
import unown from '../tests/unown.json'
import unown2 from '../tests/unown-2.json'
import stone from '../tests/stone.json'
import absol from '../tests/absol.json'
import wak from '../tests/wak.json'
import wakChain from '../tests/wak-chain.json'
import xatu from '../tests/xatu.json'
import doll from '../tests/doll.json'
import doll2 from '../tests/doll-2.json'
import doll3 from '../tests/doll-3.json'
import spirttomb from '../tests/spirttomb.json'
import tomb from '../tests/tomb.json'
import rune from '../tests/rune.json'
import ruinerNoGolemTest from '../tests/ruiner-no-golem-test.json'
import ruinerNoGolemTest2 from '../tests/ruiner-no-golem-test-2.json'
import ruinerTV2 from '../tests/ruiner-t-v2.json'
import megaGolurk from '../tests/mega-golurk.json'
import ruinerV3 from '../tests/ruiner-v3.json'
import golett from '../tests/golett.json'
import bounce2 from '../tests/bounce-2.json'
import tflame2 from '../tests/tflame-2.json'
import multiflame2 from '../tests/multiflame-2.json'
import tflameTest2 from '../tests/tflame-test-2.json'
import bomburst2 from '../tests/bomburst-2.json'
import noivernFullTest2 from '../tests/noivern-full-test-2.json'
import rayquazaTest2 from '../tests/rayquaza-test-2.json'
import rayBattleTest2 from '../tests/ray-battle-test-2.json'
import zubatTest2 from '../tests/zubat-test-2.json'
import sableyeTest2 from '../tests/sableye-test-2.json'
import singleEnemeySablyeye2 from '../tests/single-enemey-sablyeye-2.json'
import ferro2 from '../tests/ferro-2.json'
import drill2 from '../tests/drill-2.json'
import omYest2 from '../tests/om-yest-2.json'
import caveTest3 from '../tests/cave-test-3.json'
import dragonTail2 from '../tests/dragon-tail-2.json'
import caveTesr2 from '../tests/cave-tesr-2.json'
import caveTest22 from '../tests/cave-test-2-2.json'
import caveTest3Drud2 from '../tests/cave-test-3-drud-2.json'
import drednaw2 from '../tests/drednaw-2.json'
import bellibolt2 from '../tests/bellibolt-2.json'
import quag2 from '../tests/quag-2.json'
import fish3 from '../tests/fish-3.json'
import fish22 from '../tests/fish-2-2.json'
import morelull2 from '../tests/morelull-2.json'
import morgrem2 from '../tests/morgrem-2.json'
import morgrem32 from '../tests/morgrem-3-2.json'
import monkeyBasic2 from '../tests/monkey-basic-2.json'
import celbi2 from '../tests/celbi-2.json'
import fez2 from '../tests/fez-2.json'
import lele2 from '../tests/lele-2.json'
import temporalTest3 from '../tests/temporal-test-3.json'
import temporalTest22 from '../tests/temporal-test-2-2.json'
import temporalTestSStar5Costs2 from '../tests/temporal-test-s-star-5-costs-2.json'
import unown3 from '../tests/unown-3.json'
import stone2 from '../tests/stone-2.json'
import absol2 from '../tests/absol-2.json'
import wak2 from '../tests/wak-2.json'
import wakChain2 from '../tests/wak-chain-2.json'
import xatu2 from '../tests/xatu-2.json'
import doll4 from '../tests/doll-4.json'
import spirttomb2 from '../tests/spirttomb-2.json'
import tomb2 from '../tests/tomb-2.json'
import rune2 from '../tests/rune-2.json'
import ruinerNoGolemTest3 from '../tests/ruiner-no-golem-test-3.json'
import ruinerTV22 from '../tests/ruiner-t-v2-2.json'
import megaGolurk2 from '../tests/mega-golurk-2.json'
import ruinerV32 from '../tests/ruiner-v3-2.json'
import golett2 from '../tests/golett-2.json'
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
  unown,
  unown2,
  stone,
  absol,
  wak,
  wakChain,
  xatu,
  doll,
  doll2,
  doll3,
  spirttomb,
  tomb,
  rune,
  ruinerNoGolemTest,
  ruinerNoGolemTest2,
  ruinerTV2,
  megaGolurk,
  ruinerV3,
  golett,
  bounce2,
  tflame2,
  multiflame2,
  tflameTest2,
  bomburst2,
  noivernFullTest2,
  rayquazaTest2,
  rayBattleTest2,
  zubatTest2,
  sableyeTest2,
  singleEnemeySablyeye2,
  ferro2,
  drill2,
  omYest2,
  caveTest3,
  dragonTail2,
  caveTesr2,
  caveTest22,
  caveTest3Drud2,
  drednaw2,
  bellibolt2,
  quag2,
  fish3,
  fish22,
  morelull2,
  morgrem2,
  morgrem32,
  monkeyBasic2,
  celbi2,
  fez2,
  lele2,
  temporalTest3,
  temporalTest22,
  temporalTestSStar5Costs2,
  unown3,
  stone2,
  absol2,
  wak2,
  wakChain2,
  xatu2,
  doll4,
  spirttomb2,
  tomb2,
  rune2,
  ruinerNoGolemTest3,
  ruinerTV22,
  megaGolurk2,
  ruinerV32,
  golett2,
  // AUTO-LIST-END
] as unknown as RepoTestScenario[]
