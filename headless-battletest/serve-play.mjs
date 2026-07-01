#!/usr/bin/env node
// Drives `aperture headless serve` as an interactive inner loop: boots the
// runner once, then reads state / steers the basket / steps — the boot-once
// autopilot an agent developing Starfall would use. Compares an AUTOPLAY run
// (steer toward the lowest star) against a PASSIVE run (no input) from the same
// seed to prove input actually changes the simulation.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(
  appDir,
  "node_modules/@aperture-engine/cli/dist/bin/aperture.js",
);

function openSession(seed) {
  const child = spawn(
    "node",
    [cli, "headless", "serve", "aperture.headless.config.ts", "--seed", String(seed)],
    { cwd: appDir },
  );
  const rl = createInterface({ input: child.stdout });
  const pending = new Map();
  let nextId = 1;
  let ready;
  const readyPromise = new Promise((resolve) => (ready = resolve));

  rl.on("line", (line) => {
    if (line.trim().length === 0) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.ready === true && msg.id === undefined) {
      ready(msg);
      return;
    }
    const resolver = pending.get(msg.id);
    if (resolver) {
      pending.delete(msg.id);
      resolver(msg);
    }
  });
  child.stderr.on("data", (d) => process.stderr.write(`[serve ${seed}] ${d}`));

  function send(cmd, params = {}) {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ id, cmd, params }) + "\n");
    });
  }
  return { child, send, readyPromise };
}

// Pull basket x and the lowest (smallest-y) star x from a get-status response.
function readScene(status) {
  const summaries = status?.entities?.summaries ?? [];
  let basketX = 0;
  let lowestStar = null;
  for (const e of summaries) {
    const t = e.localTransform?.translation;
    if (!t) continue;
    if (e.key === "basket") basketX = t[0];
    if (typeof e.key === "string" && e.key.startsWith("star.")) {
      if (lowestStar === null || t[1] < lowestStar.y) {
        lowestStar = { x: t[0], y: t[1], key: e.key };
      }
    }
  }
  return { basketX, lowestStar };
}

async function run({ seed, autoplay, ticks, framesPerTick }) {
  const s = openSession(seed);
  await s.readyPromise;
  for (let tick = 0; tick < ticks; tick++) {
    const status = (await s.send("get-status")).result;
    if (autoplay) {
      const { basketX, lowestStar } = readScene(status);
      let x = 0;
      if (lowestStar) {
        const dx = lowestStar.x - basketX;
        x = Math.max(-1, Math.min(1, dx * 1.5)); // proportional steer, clamped
      }
      await s.send("tool", { name: "input_action_set", arguments: { action: "move", x } });
    }
    await s.send("step", { frames: framesPerTick });
  }
  const finalStatus = (await s.send("get-status")).result;
  await s.send("shutdown");
  s.child.stdin.end();
  return finalStatus.signals;
}

const ticks = 120;
const framesPerTick = 4; // 120*4 = 480 frames = 8s sim
const passive = await run({ seed: 1, autoplay: false, ticks, framesPerTick });
const autoplay = await run({ seed: 1, autoplay: true, ticks, framesPerTick });

console.log(JSON.stringify({ frames: ticks * framesPerTick, passive, autoplay }, null, 2));
