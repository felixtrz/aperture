// TDD via the headless loop: a dash ability (new input action). Write the
// invariant first (dash covers more ground than walking; dash respects a
// cooldown), watch it fail, then add the `dash` action + logic.
import { openHeadlessSession, assert, summary } from "./headless-harness.mjs";

const CONFIG = "aperture.headless.config.ts";
const session = () => openHeadlessSession(".", CONFIG, ["--seed", "1"]);

async function playerX(s) {
  return (await s.status()).signals.playerX;
}

async function test_dashCoversMoreGround() {
  console.log("dash covers more ground than walking:");
  const walk = session();
  await walk.ready;
  await walk.tool("input_action_set", { action: "move", x: 1 });
  await walk.step(30);
  const walkX = await playerX(walk);
  await walk.close();

  const dash = session();
  await dash.ready;
  await dash.tool("input_action_set", { action: "move", x: 1 });
  await dash.inject({ actions: { dash: true } });
  await dash.step(1);
  await dash.inject({ actions: { dash: false } });
  await dash.step(29);
  const dashX = await playerX(dash);
  await dash.close();

  assert("dash ends further right than walk", dashX > walkX + 0.4, `walk=${walkX} dash=${dashX}`);
}

async function test_dashCooldown() {
  console.log("dash respects a cooldown (second immediate dash is weaker):");
  const s = session();
  await s.ready;
  await s.tool("input_action_set", { action: "move", x: 1 });
  // First dash
  await s.inject({ actions: { dash: true } });
  await s.step(1);
  await s.inject({ actions: { dash: false } });
  await s.step(5);
  const afterFirst = await playerX(s);
  // Immediate second dash (should be on cooldown → little extra)
  await s.inject({ actions: { dash: true } });
  await s.step(1);
  await s.inject({ actions: { dash: false } });
  await s.step(5);
  const afterSecond = await playerX(s);
  // 6 frames of walking alone ≈ 0.3 units; a successful dash would add much more.
  assert("second dash on cooldown adds no big burst", afterSecond - afterFirst < 0.6, `first=${afterFirst} second=${afterSecond}`);
  await s.close();
}

console.log("=== dash TDD ===");
await test_dashCoversMoreGround();
await test_dashCooldown();
summary();
