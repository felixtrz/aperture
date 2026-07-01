#!/usr/bin/env node
// Plays the extended Starfall through the headless serve loop to verify the new
// progression mechanics: combo/multiplier (autoplay) and game-over (passive).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(appDir, "node_modules/@aperture-engine/cli/dist/bin/aperture.js");

function session(seed) {
  const child = spawn("node", [cli, "headless", "serve", "aperture.headless.config.ts", "--seed", String(seed)], { cwd: appDir });
  const rl = createInterface({ input: child.stdout });
  const pending = new Map(); let nextId = 1, rr;
  const ready = new Promise((r) => (rr = r));
  rl.on("line", (l) => { if (!l.trim()) return; let m; try { m = JSON.parse(l); } catch { return; } if (m.ready && m.id === undefined) return rr(m); const p = pending.get(m.id); if (p) { pending.delete(m.id); p(m); } });
  child.stderr.on("data", () => {});
  const send = (cmd, params = {}) => new Promise((res) => { const id = nextId++; pending.set(id, res); child.stdin.write(JSON.stringify({ id, cmd, params }) + "\n"); });
  return { child, send, ready };
}

function scene(status) {
  const summaries = status?.entities?.summaries ?? [];
  let basketX = 0, lowest = null;
  for (const e of summaries) {
    const t = e.localTransform?.translation; if (!t) continue;
    if (e.key === "basket") basketX = t[0];
    if (typeof e.key === "string" && e.key.startsWith("star.") && (lowest === null || t[1] < lowest.y)) lowest = { x: t[0], y: t[1] };
  }
  return { basketX, lowest };
}

async function play({ seed, autoplay, maxTicks }) {
  const s = session(seed); await s.ready;
  let gameOverTick = null, peakMultiplier = 1;
  for (let tick = 0; tick < maxTicks; tick++) {
    const status = (await s.send("get-status")).result;
    peakMultiplier = Math.max(peakMultiplier, Number(status.signals.multiplier ?? 1));
    if (status.signals.gameOver === true && gameOverTick === null) gameOverTick = tick;
    if (autoplay) {
      const { basketX, lowest } = scene(status);
      const x = lowest ? Math.max(-1, Math.min(1, (lowest.x - basketX) * 1.5)) : 0;
      await s.send("tool", { name: "input_action_set", arguments: { action: "move", x } });
    }
    await s.send("step", { frames: 4 });
  }
  const final = (await s.send("get-status")).result.signals;
  await s.send("shutdown"); s.child.stdin.end();
  return { final, gameOverTick, peakMultiplier };
}

const passive = await play({ seed: 1, autoplay: false, maxTicks: 400 });
const auto = await play({ seed: 1, autoplay: true, maxTicks: 250 });
console.log("PASSIVE (no input):", JSON.stringify({ ...passive.final, gameOverTick: passive.gameOverTick }));
console.log("AUTOPLAY (catch):  ", JSON.stringify({ ...auto.final, peakMultiplier: auto.peakMultiplier }));
