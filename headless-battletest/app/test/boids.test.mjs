// Invariants for the boids flocking sim, verified through the headless loop.
// Run: node test/boids.test.mjs   (from the app dir)
import { openHeadlessSession, assert, summary } from "./headless-harness.mjs";

const CONFIG = "boids/boids.config.ts";
const BOUND = 8;
const MIN_SPEED = 1.5;
const MAX_SPEED = 4;

async function boidPositions(s) {
  const snap = (await s.tool("ecs_snapshot")).result;
  return snap.summaries
    .filter((e) => (e.key || "").startsWith("boid."))
    .map((e) => e.localTransform.translation);
}

async function test_setupAndContainment() {
  console.log("setup + containment after 300 steps:");
  const s = openHeadlessSession(".", CONFIG, ["--seed", "1"]);
  await s.ready;
  const sig0 = (await s.status()).signals;
  assert("36 boids spawned", sig0.boidCount === 36, `got ${sig0.boidCount}`);
  await s.step(300);
  const positions = await boidPositions(s);
  assert("36 boid entities present", positions.length === 36, `got ${positions.length}`);
  const outOfBounds = positions.filter(
    ([x, y, z]) => Math.abs(x) > BOUND + 1e-3 || Math.abs(z) > BOUND + 1e-3 || Math.abs(y) > 3 + 1e-3,
  );
  assert("all boids stay within bounds (wrap works)", outOfBounds.length === 0, `${outOfBounds.length} escaped`);
  const sig = (await s.status()).signals;
  assert("avgSpeed within [MIN,MAX] (clamp works)", sig.avgSpeed >= MIN_SPEED - 1e-3 && sig.avgSpeed <= MAX_SPEED + 1e-3, `got ${sig.avgSpeed}`);
  assert("center of mass stays bounded", Math.abs(sig.centerX) <= BOUND && Math.abs(sig.centerZ) <= BOUND, `(${sig.centerX},${sig.centerZ})`);
  await s.close();
}

async function test_determinism() {
  console.log("determinism (center of mass after 200 steps):");
  async function centerAfter(seed) {
    const s = openHeadlessSession(".", CONFIG, ["--seed", String(seed)]);
    await s.ready;
    await s.step(200);
    const sig = (await s.status()).signals;
    await s.close();
    return `${sig.centerX.toFixed(9)},${sig.centerZ.toFixed(9)},${sig.avgSpeed.toFixed(9)}`;
  }
  const a = await centerAfter(1);
  const b = await centerAfter(1);
  const c = await centerAfter(2);
  assert("seed 1 reproducible", a === b, `${a} vs ${b}`);
  assert("seed 2 differs", a !== c, `${a} vs ${c}`);
}

console.log("=== Headless invariants (boids sim) ===");
await test_setupAndContainment();
await test_determinism();
summary();
