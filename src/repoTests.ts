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
import klawf from '../tests/klawf.json'
import gogoat from '../tests/gogoat.json'
import gogoat2 from '../tests/gogoat-2.json'
import sneasler from '../tests/sneasler.json'
import sneasler2 from '../tests/sneasler-2.json'
import aero from '../tests/aero.json'
import aero2 from '../tests/aero-2.json'
import aero22 from '../tests/aero-2-2.json'
import snorunt from '../tests/snorunt.json'
import ascenderTest from '../tests/ascender-test.json'
import froslass from '../tests/froslass.json'
import weavile from '../tests/weavile.json'
import weavile3 from '../tests/weavile-3.json'
import avalugg from '../tests/avalugg.json'
import avalugg2 from '../tests/avalugg-2.json'
import randTest from '../tests/rand-test.json'
import randTest2 from '../tests/rand-test-2.json'
import fishP2 from '../tests/fish-p2.json'
import snow from '../tests/snow.json'
import mamo from '../tests/mamo.json'
import mamo2 from '../tests/mamo-2.json'
import frostVFire from '../tests/frost-v-fire.json'
import bounce3 from '../tests/bounce-3.json'
import tflame3 from '../tests/tflame-3.json'
import multiflame3 from '../tests/multiflame-3.json'
import tflameTest3 from '../tests/tflame-test-3.json'
import bomburst3 from '../tests/bomburst-3.json'
import noivernFullTest3 from '../tests/noivern-full-test-3.json'
import rayquazaTest3 from '../tests/rayquaza-test-3.json'
import rayBattleTest3 from '../tests/ray-battle-test-3.json'
import zubatTest3 from '../tests/zubat-test-3.json'
import sableyeTest3 from '../tests/sableye-test-3.json'
import singleEnemeySablyeye3 from '../tests/single-enemey-sablyeye-3.json'
import ferro3 from '../tests/ferro-3.json'
import drill3 from '../tests/drill-3.json'
import omYest3 from '../tests/om-yest-3.json'
import caveTest4 from '../tests/cave-test-4.json'
import dragonTail3 from '../tests/dragon-tail-3.json'
import caveTesr3 from '../tests/cave-tesr-3.json'
import caveTest23 from '../tests/cave-test-2-3.json'
import caveTest3Drud3 from '../tests/cave-test-3-drud-3.json'
import drednaw3 from '../tests/drednaw-3.json'
import bellibolt3 from '../tests/bellibolt-3.json'
import board67 from '../tests/board-67.json'
import board672 from '../tests/board-67-2.json'
import barraCrokscrewPromoterRiverSkyStrikerVsToucannonSpellweaverJungleBruiserRoughneck from '../tests/barra-crokscrew-promoter-river-sky-striker-vs-toucannon-spellweaver-jungle-bruiser-roughneck.json'
import pt from '../tests/pt.json'
import jgVsVol from '../tests/jg-vs-vol.json'
import gTest from '../tests/g-test.json'
import gTest2 from '../tests/g-test-2.json'
import jg1 from '../tests/jg-1.json'
import finiBulu from '../tests/fini-bulu.json'
import healing3 from '../tests/healing-3.json'
import rayGeneration from '../tests/ray-generation.json'
import rayJg from '../tests/ray-jg.json'
import beacy from '../tests/beacy.json'
import beachyRaichuKingler from '../tests/beachy-raichu-kingler.json'
import kinglerTest from '../tests/kingler-test.json'
import kinglerTest2 from '../tests/kingler-test-2.json'
import kinglerTest3 from '../tests/kingler-test-3.json'
import aRaichi from '../tests/a-raichi.json'
import twoStarRaiTest from '../tests/2-star-rai-test.json'
import sand5Beachy from '../tests/sand-5-beachy.json'
import beachy8 from '../tests/beachy-8.json'
import eggTest from '../tests/egg-test.json'
import blastTest from '../tests/blast-test.json'
import iiniTest from '../tests/iini-test.json'
import buluTest from '../tests/bulu-test.json'
import finiBeach from '../tests/fini-beach.json'
import fini9 from '../tests/fini-9.json'
import temporal9 from '../tests/temporal-9.json'
import volcano9 from '../tests/volcano-9.json'
import volcano59 from '../tests/volcano-5-9.json'
import birdTest from '../tests/bird-test.json'
import birdTest2 from '../tests/bird-test-2.json'
import skyStrikerPromoter from '../tests/sky-striker-promoter.json'
import StarTy from '../tests/3-star-ty.json'
import arm259 from '../tests/arm-2-5-9.json'
import Cave5 from '../tests/5-cave.json'
import Cave3Lvl6 from '../tests/3-cave-lvl-6.json'
import cave8 from '../tests/cave-8.json'
import river4 from '../tests/river-4.json'
import riverPassTest from '../tests/river-pass-test.json'
import Star3Dred from '../tests/3-star-dred.json'
import riverDred3VsSubsCave from '../tests/river-dred-3-vs-subs-cave.json'
import temp2 from '../tests/temp-2.json'
import temp22 from '../tests/temp-2-2.json'
import temp4 from '../tests/temp-4.json'
import jungle9 from '../tests/jungle-9.json'
import temp6 from '../tests/temp-6.json'
import Ruiner7 from '../tests/7-ruiner.json'
import Ruiner5 from '../tests/5-ruiner.json'
import ruiner3 from '../tests/ruiner-3.json'
import bounce4 from '../tests/bounce-4.json'
import tflame4 from '../tests/tflame-4.json'
import multiflame4 from '../tests/multiflame-4.json'
import tflameTest4 from '../tests/tflame-test-4.json'
import bomburst4 from '../tests/bomburst-4.json'
import noivernFullTest4 from '../tests/noivern-full-test-4.json'
import rayquazaTest4 from '../tests/rayquaza-test-4.json'
import rayBattleTest4 from '../tests/ray-battle-test-4.json'
import zubatTest4 from '../tests/zubat-test-4.json'
import sableyeTest4 from '../tests/sableye-test-4.json'
import singleEnemeySablyeye4 from '../tests/single-enemey-sablyeye-4.json'
import ferro4 from '../tests/ferro-4.json'
import drill4 from '../tests/drill-4.json'
import omYest4 from '../tests/om-yest-4.json'
import caveTest5 from '../tests/cave-test-5.json'
import dragonTail4 from '../tests/dragon-tail-4.json'
import caveTesr4 from '../tests/cave-tesr-4.json'
import caveTest24 from '../tests/cave-test-2-4.json'
import caveTest3Drud4 from '../tests/cave-test-3-drud-4.json'
import drednaw4 from '../tests/drednaw-4.json'
import bellibolt4 from '../tests/bellibolt-4.json'
import quag3 from '../tests/quag-3.json'
import fish4 from '../tests/fish-4.json'
import fish23 from '../tests/fish-2-3.json'
import morelull3 from '../tests/morelull-3.json'
import morgrem4 from '../tests/morgrem-4.json'
import morgrem33 from '../tests/morgrem-3-3.json'
import monkeyBasic3 from '../tests/monkey-basic-3.json'
import celbi3 from '../tests/celbi-3.json'
import fez3 from '../tests/fez-3.json'
import lele3 from '../tests/lele-3.json'
import temporalTest4 from '../tests/temporal-test-4.json'
import temporalTest23 from '../tests/temporal-test-2-3.json'
import temporalTestSStar5Costs3 from '../tests/temporal-test-s-star-5-costs-3.json'
import unown4 from '../tests/unown-4.json'
import bounce5 from '../tests/bounce-5.json'
import tflame5 from '../tests/tflame-5.json'
import multiflame5 from '../tests/multiflame-5.json'
import tflameTest5 from '../tests/tflame-test-5.json'
import bomburst5 from '../tests/bomburst-5.json'
import noivernFullTest5 from '../tests/noivern-full-test-5.json'
import rayquazaTest5 from '../tests/rayquaza-test-5.json'
import rayBattleTest5 from '../tests/ray-battle-test-5.json'
import zubatTest5 from '../tests/zubat-test-5.json'
import sableyeTest5 from '../tests/sableye-test-5.json'
import singleEnemeySablyeye5 from '../tests/single-enemey-sablyeye-5.json'
import ferro5 from '../tests/ferro-5.json'
import drill5 from '../tests/drill-5.json'
import omYest5 from '../tests/om-yest-5.json'
import caveTest6 from '../tests/cave-test-6.json'
import dragonTail5 from '../tests/dragon-tail-5.json'
import caveTesr5 from '../tests/cave-tesr-5.json'
import caveTest25 from '../tests/cave-test-2-5.json'
import caveTest3Drud5 from '../tests/cave-test-3-drud-5.json'
import drednaw5 from '../tests/drednaw-5.json'
import bellibolt5 from '../tests/bellibolt-5.json'
import quag4 from '../tests/quag-4.json'
import fish5 from '../tests/fish-5.json'
import fish24 from '../tests/fish-2-4.json'
import morelull4 from '../tests/morelull-4.json'
import morgrem5 from '../tests/morgrem-5.json'
import morgrem34 from '../tests/morgrem-3-4.json'
import monkeyBasic4 from '../tests/monkey-basic-4.json'
import celbi4 from '../tests/celbi-4.json'
import fez4 from '../tests/fez-4.json'
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
  klawf,
  gogoat,
  gogoat2,
  sneasler,
  sneasler2,
  aero,
  aero2,
  aero22,
  snorunt,
  ascenderTest,
  froslass,
  weavile,
  weavile3,
  avalugg,
  avalugg2,
  randTest,
  randTest2,
  fishP2,
  snow,
  mamo,
  mamo2,
  frostVFire,
  bounce3,
  tflame3,
  multiflame3,
  tflameTest3,
  bomburst3,
  noivernFullTest3,
  rayquazaTest3,
  rayBattleTest3,
  zubatTest3,
  sableyeTest3,
  singleEnemeySablyeye3,
  ferro3,
  drill3,
  omYest3,
  caveTest4,
  dragonTail3,
  caveTesr3,
  caveTest23,
  caveTest3Drud3,
  drednaw3,
  bellibolt3,
  board67,
  board672,
  barraCrokscrewPromoterRiverSkyStrikerVsToucannonSpellweaverJungleBruiserRoughneck,
  pt,
  jgVsVol,
  gTest,
  gTest2,
  jg1,
  finiBulu,
  healing3,
  rayGeneration,
  rayJg,
  beacy,
  beachyRaichuKingler,
  kinglerTest,
  kinglerTest2,
  kinglerTest3,
  aRaichi,
  twoStarRaiTest,
  sand5Beachy,
  beachy8,
  eggTest,
  blastTest,
  iiniTest,
  buluTest,
  finiBeach,
  fini9,
  temporal9,
  volcano9,
  volcano59,
  birdTest,
  birdTest2,
  skyStrikerPromoter,
  StarTy,
  arm259,
  Cave5,
  Cave3Lvl6,
  cave8,
  river4,
  riverPassTest,
  Star3Dred,
  riverDred3VsSubsCave,
  temp2,
  temp22,
  temp4,
  jungle9,
  temp6,
  Ruiner7,
  Ruiner5,
  ruiner3,
  bounce4,
  tflame4,
  multiflame4,
  tflameTest4,
  bomburst4,
  noivernFullTest4,
  rayquazaTest4,
  rayBattleTest4,
  zubatTest4,
  sableyeTest4,
  singleEnemeySablyeye4,
  ferro4,
  drill4,
  omYest4,
  caveTest5,
  dragonTail4,
  caveTesr4,
  caveTest24,
  caveTest3Drud4,
  drednaw4,
  bellibolt4,
  quag3,
  fish4,
  fish23,
  morelull3,
  morgrem4,
  morgrem33,
  monkeyBasic3,
  celbi3,
  fez3,
  lele3,
  temporalTest4,
  temporalTest23,
  temporalTestSStar5Costs3,
  unown4,
  bounce5,
  tflame5,
  multiflame5,
  tflameTest5,
  bomburst5,
  noivernFullTest5,
  rayquazaTest5,
  rayBattleTest5,
  zubatTest5,
  sableyeTest5,
  singleEnemeySablyeye5,
  ferro5,
  drill5,
  omYest5,
  caveTest6,
  dragonTail5,
  caveTesr5,
  caveTest25,
  caveTest3Drud5,
  drednaw5,
  bellibolt5,
  quag4,
  fish5,
  fish24,
  morelull4,
  morgrem5,
  morgrem34,
  monkeyBasic4,
  celbi4,
  fez4,
  // AUTO-LIST-END
] as unknown as RepoTestScenario[]
