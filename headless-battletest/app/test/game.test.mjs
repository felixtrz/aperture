// Gameplay invariants for the game app, verified through the headless loop.
// Run: node test/game.test.mjs   (from the app dir)
//
// This suite is the artifact that caught a real regression: adding the patrol
// hazard made the level unwinnable (its collision was Y-agnostic, so jumping
// couldn't avoid it). The fix made the hazard only catch a grounded player;
// `test_winnableByJumping` now passes and `test_hazardBlocksGrounded`
// documents the obstacle.
import { openHeadlessSession, assert, approx, summary } from "./headless-harness.mjs";

const CONFIG = "aperture.headless.config.ts";
const session = () => openHeadlessSession(".", CONFIG, ["--seed", "1"]);

async function test_initialState() {
  console.log("initial state:");
  const s = session();
  await s.ready;
  const sig = (await s.status()).signals;
  assert("score starts 0", sig.score === 0);
  assert("coins start 0", sig.coins === 0);
  assert("hits start 0", sig.hits === 0);
  assert("goalReached starts false", sig.goalReached === false);
  // Player ENTITY spawns at -3.5; the playerX SIGNAL stays 0 until first update.
  await s.tool("ecs_query", { key: "player" });
  const px = (await s.tool("ecs_get_entity")).result.summary.localTransform.translation[0];
  assert("player entity spawns at -3.5", approx(px, -3.5, 1e-3), `got ${px}`);
  assert("playerX signal is 0 pre-update (known quirk)", sig.playerX === 0, `got ${sig.playerX}`);
  await s.close();
}

async function test_gemCollectible() {
  console.log("gem is collectible by moving right:");
  const s = session();
  await s.ready;
  await s.tool("input_action_set", { action: "move", x: 1 });
  await s.step(120);
  const sig = (await s.status()).signals;
  assert("score == 1 after reaching the gem", sig.score === 1, `got ${sig.score}`);
  await s.close();
}

async function test_hazardBlocksGrounded() {
  console.log("grounded run into the hazard is blocked (obstacle works):");
  const s = session();
  await s.ready;
  await s.tool("input_action_set", { action: "move", x: 1 });
  await s.step(420);
  const sig = (await s.status()).signals;
  assert("hazard registers hits on a grounded player", sig.hits >= 1, `hits=${sig.hits}`);
  assert("grounded player cannot reach the goal", sig.goalReached === false);
  assert("player is knocked back behind the hazard", sig.playerX < 0, `playerX=${sig.playerX}`);
  await s.close();
}

async function test_winnableByJumping() {
  console.log("level is winnable by jumping over the hazard:");
  const s = session();
  await s.ready;
  await s.tool("input_action_set", { action: "move", x: 1 });
  for (let i = 0; i < 30; i += 1) {
    await s.inject({ actions: { jump: true } });
    await s.step(1);
    await s.inject({ actions: { jump: false } });
    await s.step(34);
  }
  const sig = (await s.status()).signals;
  assert("reaches the goal", sig.goalReached === true, JSON.stringify(sig));
  assert("cleared the hazard untouched", sig.hits === 0, `hits=${sig.hits}`);
  await s.close();
}

async function test_jumpArc() {
  console.log("jump is a bounded deterministic arc:");
  const s = session();
  await s.ready;
  await s.tool("ecs_query", { key: "player" });
  const y0 = (await s.tool("ecs_get_entity")).result.summary.localTransform.translation[1];
  await s.inject({ actions: { jump: true } });
  await s.step(1);
  await s.inject({ actions: { jump: false } });
  await s.step(6);
  const yMid = (await s.tool("ecs_get_entity")).result.summary.localTransform.translation[1];
  await s.step(40);
  const yEnd = (await s.tool("ecs_get_entity")).result.summary.localTransform.translation[1];
  assert("starts grounded ~0.55", approx(y0, 0.55, 1e-3), `got ${y0}`);
  assert("rises mid-jump", yMid > y0 + 0.3, `yMid=${yMid}`);
  assert("returns to ground", approx(yEnd, 0.55, 1e-3), `got ${yEnd}`);
  await s.close();
}

async function test_determinism() {
  console.log("seed determinism (coin layout):");
  async function coins(seed) {
    const s = openHeadlessSession(".", CONFIG, ["--seed", String(seed)]);
    await s.ready;
    await s.step(85);
    const q = await s.tool("ecs_query", { tags: ["coin"] });
    await s.close();
    return q.result.summaries.map((x) => x.key).sort().join(",");
  }
  const a = await coins(1);
  const b = await coins(1);
  const c = await coins(2);
  assert("seed 1 reproducible", a === b, `${a} vs ${b}`);
  assert("seed 2 differs from seed 1", a !== c, `${a} vs ${c}`);
}

console.log("=== Headless gameplay invariants (game app) ===");
await test_initialState();
await test_gemCollectible();
await test_hazardBlocksGrounded();
await test_winnableByJumping();
await test_jumpArc();
await test_determinism();
summary();
