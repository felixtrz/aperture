// Conway's Game of Life invariants, verified through the headless loop.
import { openHeadlessSession, assert, summary } from "./headless-harness.mjs";
import { readFileSync } from "node:fs";
const CONFIG = "life/life.config.ts";

async function test_invariants() {
  console.log("GoL invariants (block still life + blinker oscillator):");
  const s = openHeadlessSession(".", CONFIG, ["--seed", "1"]);
  await s.ready;
  const horiz = [];
  let liveStable = true;
  for (let i = 0; i < 6; i += 1) {
    const sig = (await s.status()).signals;
    if (sig.liveCount !== 7) liveStable = false;
    horiz.push(sig.blinkerHorizontal);
    await s.step(1);
  }
  assert("liveCount conserved at 7 (block 4 + blinker 3)", liveStable, JSON.stringify(horiz));
  assert("blinker oscillates period-2", horiz[0] === true && horiz[1] === false && horiz[2] === true && horiz[3] === false);
  await s.close();
}

async function test_determinism() {
  console.log("GoL is deterministic across runs:");
  async function digest() {
    const s = openHeadlessSession(".", CONFIG, ["--seed", "1"]);
    await s.ready;
    await s.step(10);
    await s.bundle("/tmp/life.det.bundle.json", { digest: true });
    await s.close();
    return JSON.parse(readFileSync("/tmp/life.det.bundle.json", "utf8")).digest.hash;
  }
  const a = await digest();
  const b = await digest();
  assert("identical digest across runs", a === b, `${a} vs ${b}`);
}

console.log("=== Headless invariants (Game of Life) ===");
await test_invariants();
await test_determinism();
summary();
