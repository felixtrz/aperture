// TDD via the headless loop: write the double-jump invariant first, watch it
// fail against the single-jump implementation, then implement until green.
import { openHeadlessSession, assert, approx, summary } from "./headless-harness.mjs";

const CONFIG = "aperture.headless.config.ts";
const session = () => openHeadlessSession(".", CONFIG, ["--seed", "1"]);

async function playerY(s) {
  await s.tool("ecs_query", { key: "player" });
  return (await s.tool("ecs_get_entity")).result.summary.localTransform.translation[1];
}

// Single jump apex (~6 steps after a press) for reference.
async function test_singleJumpApex() {
  console.log("single jump apex:");
  const s = session();
  await s.ready;
  await s.inject({ actions: { jump: true } });
  await s.step(1);
  await s.inject({ actions: { jump: false } });
  await s.step(8);
  const y = await playerY(s);
  assert("single jump rises above 1.2", y > 1.2, `y=${y}`);
  await s.close();
}

// Double jump: a second press while airborne should push noticeably higher
// than a single jump at the same point in the arc.
async function test_doubleJumpHigher() {
  console.log("double jump goes higher than single:");
  const single = session();
  await single.ready;
  await single.inject({ actions: { jump: true } });
  await single.step(1);
  await single.inject({ actions: { jump: false } });
  await single.step(18); // near apex/descending for a single jump
  const ySingle = await playerY(single);
  await single.close();

  const dbl = session();
  await dbl.ready;
  await dbl.inject({ actions: { jump: true } });
  await dbl.step(1);
  await dbl.inject({ actions: { jump: false } });
  await dbl.step(9); // mid-air
  await dbl.inject({ actions: { jump: true } }); // second jump
  await dbl.step(1);
  await dbl.inject({ actions: { jump: false } });
  await dbl.step(8);
  const yDouble = await playerY(dbl);
  await dbl.close();

  assert("double jump higher than single at comparable time", yDouble > ySingle + 0.3, `single=${ySingle} double=${yDouble}`);
}

// Max airborne height when spamming jump every frame must equal the
// exactly-two-jumps apex (the 3rd+ presses in one airtime are ignored).
async function maxHeight(presses) {
  const s = session();
  await s.ready;
  let maxY = 0;
  // `presses` = number of distinct jump presses (with a release between each).
  for (let p = 0; p < presses; p += 1) {
    await s.inject({ actions: { jump: true } });
    await s.step(1);
    await s.inject({ actions: { jump: false } });
    await s.step(3);
    const y = await playerY(s);
    if (y > maxY) maxY = y;
  }
  for (let i = 0; i < 30; i += 1) {
    await s.step(1);
    const y = await playerY(s);
    if (y > maxY) maxY = y;
  }
  await s.close();
  return maxY;
}

async function test_noTripleJump() {
  console.log("no triple jump (max 2 — extra presses ignored):");
  const two = await maxHeight(2);
  const five = await maxHeight(5);
  assert("5 presses reaches no higher than 2 (3rd+ ignored)", approx(two, five, 0.05), `two=${two} five=${five}`);
}

console.log("=== double-jump TDD ===");
await test_singleJumpApex();
await test_doubleJumpHigher();
await test_noTripleJump();
summary();
