// Invariants for the platformer level, verified through the headless loop.
// Exercises a non-trivial character controller: gravity, platform landing,
// fall-death over a pit, double-jump traversal, coin pickup, and win.
import { openHeadlessSession, assert, approx, summary } from "./headless-harness.mjs";

const CONFIG = "platformer/platformer.config.ts";
const session = () => openHeadlessSession(".", CONFIG, ["--seed", "1"]);
const sig = async (s) => (await s.status()).signals;

async function moveRight(s, x = 1) {
  await s.tool("input_gamepad_set", { index: 0, axes: [x, 0, 0, 0] });
}
async function jump(s) {
  await s.inject({ actions: { jump: true } });
  await s.step(1);
  await s.inject({ actions: { jump: false } });
}

async function test_landsOnPlatform() {
  console.log("player lands on the ground strip:");
  const s = session();
  await s.ready;
  await s.step(40);
  const g = await sig(s);
  assert("grounded after falling to platform", g.grounded === true, JSON.stringify(g));
  assert("rests at platform-top height (~0.45)", approx(g.playerY, 0.45, 0.05), `y=${g.playerY}`);
  await s.close();
}

async function test_fallDeathInPit() {
  console.log("walking into the pit (no jump) = fall-death + respawn:");
  const s = session();
  await s.ready;
  await s.step(40); // settle
  await moveRight(s, 1);
  await s.step(140); // walk off the ground strip into the pit
  const g = await sig(s);
  assert("died at least once falling into the pit", g.deaths >= 1, `deaths=${g.deaths}`);
  assert("respawned to the left ground strip", g.playerX < -2, `x=${g.playerX}`);
  await s.close();
}

async function test_crossAndWin() {
  console.log("double-jump across the pit and reach the goal:");
  const s = session();
  await s.ready;
  await s.step(40);
  await moveRight(s, 1);
  // Jump (and double-jump) while crossing the pit; once past it, stop jumping
  // so the player lands and walks to the goal grounded.
  for (let i = 0; i < 120; i += 1) {
    const g = await sig(s);
    if (g.won) break;
    if (g.playerX < 2.5) await jump(s);
    await s.step(4);
  }
  const g = await sig(s);
  assert("reached the goal (won)", g.won === true, JSON.stringify(g));
  assert("collected at least one coin en route", g.coins >= 1, `coins=${g.coins}`);
  await s.close();
}

console.log("=== Headless invariants (platformer) ===");
await test_landsOnPlatform();
await test_fallDeathInPit();
await test_crossAndWin();
summary();
