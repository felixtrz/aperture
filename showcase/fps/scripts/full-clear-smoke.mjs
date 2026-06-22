#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 5182;
const DT = 1 / 60;
const LOOK_RADIANS_PER_UNIT = 26 / 700;
const ENEMY_HITBOX_OFFSET_Y = 0.25;
const DEFAULT_SCREENSHOT = path.join(
  FPS_ROOT,
  ".aperture/runtime/fps-full-clear-smoke.png",
);

const ENEMIES = [
  { key: "enemy.0", target: [-3.5, 2.5 + ENEMY_HITBOX_OFFSET_Y, -6] },
  { key: "enemy.1", target: [-9.5, 2.5 + ENEMY_HITBOX_OFFSET_Y, 1.5] },
  { key: "enemy.2", target: [5.5, 3.5 + ENEMY_HITBOX_OFFSET_Y, 9] },
  { key: "enemy.3", target: [15.5, 4 + ENEMY_HITBOX_OFFSET_Y, -7.5] },
];

const ROUTE = [
  { kind: "shoot", enemy: "enemy.0", maxShots: 8 },
  { kind: "move", name: "west jump setup", target: [-2.1, 1.0], radius: 0.35 },
  {
    kind: "move",
    name: "jump to west grass",
    target: [-4.2, 1.7],
    radius: 0.55,
    jump: true,
    jumpDistance: 2.5,
  },
  {
    kind: "move",
    name: "west grass firing point",
    target: [-6.0, 2.4],
    radius: 0.55,
  },
  { kind: "shoot", enemy: "enemy.1", maxShots: 9 },
  {
    kind: "move",
    name: "west grass east edge",
    target: [-3.7, 2.5],
    radius: 0.45,
  },
  {
    kind: "move",
    name: "jump back to start grass",
    target: [-2.0, 2.1],
    radius: 0.55,
    jump: true,
    jumpDistance: 2.2,
  },
  { kind: "move", name: "center edge", target: [1.9, 2.25], radius: 0.3 },
  {
    kind: "move",
    name: "jump to southeast grass corner",
    target: [3.7, 3.9],
    radius: 0.75,
    jump: true,
    jumpDistance: 4.0,
  },
  {
    kind: "move",
    name: "southeast grass center",
    target: [5.0, 5.5],
    radius: 0.55,
  },
  { kind: "shoot", enemy: "enemy.2", maxShots: 9 },
  {
    kind: "move",
    name: "return center north edge",
    target: [2.1, 0.7],
    radius: 0.65,
  },
  {
    kind: "move",
    name: "jump to northeast platform",
    target: [6.8, -2.1],
    radius: 0.7,
    jump: true,
    jumpDistance: 6.0,
    doubleJump: true,
  },
  {
    kind: "move",
    name: "jump to elevated northeast grass",
    target: [12.0, -5.0],
    radius: 0.85,
    jump: true,
    jumpDistance: 6.0,
    doubleJump: true,
  },
  { kind: "shoot", enemy: "enemy.3", maxShots: 10 },
];

const argv = parseArgs(process.argv.slice(2));
const port = numberArg(argv, "port", DEFAULT_PORT);
const keepRunning = booleanArg(argv, "keep-running", false);
const freshSession = booleanArg(argv, "fresh-session", false);
const screenshotPath = stringArg(argv, "screenshot", DEFAULT_SCREENSHOT);
const verbose = booleanArg(argv, "verbose", false);

async function startDevSession(portValue) {
  if (freshSession) {
    await runCommand("pnpm", ["exec", "aperture", "dev", "down"], {
      cwd: FPS_ROOT,
      timeoutMs: 30_000,
    }).catch(() => {});
  }

  const result = await runCommand(
    "pnpm",
    [
      "exec",
      "aperture",
      "dev",
      "up",
      "--headless",
      "--host",
      "127.0.0.1",
      "--port",
      String(portValue),
      "--strict-port",
    ],
    { cwd: FPS_ROOT, timeoutMs: 60_000 },
  );
  process.stderr.write(result.stdout);
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }

  return {
    started: result.stdout.includes("Started Aperture dev session"),
    owned:
      freshSession || result.stdout.includes("Started Aperture dev session"),
  };
}

async function resetGame(mcpClient) {
  await mcpClient.call("ecs_pause", {});
  await mcpClient.call("input_reset", {});
  await mcpClient.call("input_action_set", {
    action: "reset",
    pressed: true,
  });
  await stepFrames(mcpClient, 2);
  await mcpClient.call("input_action_set", {
    action: "reset",
    pressed: false,
  });
  await stepFrames(mcpClient, 4);
}

async function moveTo(mcpClient, step) {
  let jumped = false;
  let doubleJumped = false;
  let framesSinceFirstJump = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let staleFrames = 0;

  for (let frame = 0; frame < (step.maxFrames ?? 720); frame += 1) {
    const state = await readFpsState(mcpClient);
    const position = state.playerPosition;
    const dx = step.target[0] - position[0];
    const dz = step.target[1] - position[2];
    const distance = Math.hypot(dx, dz);

    if (position[1] < -5) {
      throw new Error(
        `${step.name} fell below the level at ${formatVec(position)}`,
      );
    }

    if (distance <= step.radius) {
      await mcpClient.call("input_action_set", { action: "move", x: 0, y: 0 });
      if (step.jump === true) {
        await waitForGrounded(mcpClient, step.name);
      }
      await stepFrames(mcpClient, 4);
      logProgress(
        `move:${step.name}`,
        summarizeState(await readFpsState(mcpClient)),
      );
      return;
    }

    if (distance + 0.02 < bestDistance) {
      bestDistance = distance;
      staleFrames = 0;
    } else {
      staleFrames += 1;
    }

    if (staleFrames > 180) {
      throw new Error(
        `${step.name} stopped making progress; distance=${distance.toFixed(3)} position=${formatVec(position)}`,
      );
    }

    await aimYawAt(mcpClient, [step.target[0], position[1], step.target[1]], {
      pitch: state.pitch,
      tolerance: 0.08,
      maxFrames: 4,
    });

    const aimedState = await readFpsState(mcpClient);
    const aimedDx = step.target[0] - aimedState.playerPosition[0];
    const aimedDz = step.target[1] - aimedState.playerPosition[2];
    const move = localMoveToward(aimedState.yaw, aimedDx, aimedDz);
    await mcpClient.call("input_action_set", {
      action: "move",
      x: move[0],
      y: move[1],
    });

    if (
      step.jump === true &&
      !jumped &&
      distance < (step.jumpDistance ?? 2.8)
    ) {
      jumped = true;
      framesSinceFirstJump = 0;
      await pulseButton(mcpClient, "jump", 2);
    }

    if (
      step.doubleJump === true &&
      jumped &&
      !doubleJumped &&
      state.grounded !== true &&
      state.jumpsRemaining > 0 &&
      framesSinceFirstJump >= (step.doubleJumpAfterFrames ?? 18)
    ) {
      doubleJumped = true;
      await pulseButton(mcpClient, "jump", 2);
    }

    await stepFrames(mcpClient, 3);
    if (jumped && !doubleJumped) {
      framesSinceFirstJump += 3;
    }
  }

  const state = await readFpsState(mcpClient);
  throw new Error(
    `${step.name} did not reach target ${formatVec2(step.target)}; final=${formatVec(state.playerPosition)}`,
  );
}

async function waitForGrounded(mcpClient, label) {
  for (let frame = 0; frame < 240; frame += 1) {
    const state = await readFpsState(mcpClient);
    if (state.playerPosition[1] < -5) {
      throw new Error(
        `${label} fell before landing at ${formatVec(state.playerPosition)}`,
      );
    }
    if (state.grounded === true) {
      return;
    }
    await stepFrames(mcpClient, 1);
  }

  const state = await readFpsState(mcpClient);
  throw new Error(
    `${label} did not land; final=${formatVec(state.playerPosition)}`,
  );
}

async function shootEnemy(mcpClient, step) {
  const enemy = ENEMIES.find((candidate) => candidate.key === step.enemy);
  if (enemy === undefined) {
    throw new Error(`Unknown enemy '${step.enemy}'.`);
  }

  for (let shot = 0; shot < step.maxShots; shot += 1) {
    const before = await readFpsState(mcpClient);
    const healthBefore = before.enemyHealth?.[enemy.key] ?? 0;
    if (healthBefore <= 0) {
      logProgress(`shoot:${enemy.key}`, summarizeState(before));
      return;
    }

    await aimAt(mcpClient, enemy.target, {
      tolerance: 0.018,
      maxFrames: 140,
    });
    await pulseButton(mcpClient, "shoot", 2);
    await stepFrames(mcpClient, 18);

    const after = await readFpsState(mcpClient);
    const healthAfter = after.enemyHealth?.[enemy.key] ?? 0;
    if (verbose) {
      logProgress(`shot:${enemy.key}:${shot + 1}`, {
        shotsFired: after.shotsFired,
        hits: after.hits,
        healthBefore,
        healthAfter,
      });
    }
  }

  const final = await readFpsState(mcpClient);
  throw new Error(
    `${enemy.key} survived ${step.maxShots} shots; health=${final.enemyHealth?.[enemy.key]}`,
  );
}

async function aimAt(mcpClient, target, options = {}) {
  for (let i = 0; i < (options.maxFrames ?? 120); i += 1) {
    const state = await readFpsState(mcpClient);
    const desired = lookAngles(state.playerPosition, target);
    const yawDelta = angleDelta(desired.yaw, state.yaw);
    const pitchDelta = desired.pitch - state.pitch;

    if (
      Math.abs(yawDelta) <= (options.tolerance ?? 0.025) &&
      Math.abs(pitchDelta) <= (options.tolerance ?? 0.025)
    ) {
      await mcpClient.call("input_action_set", {
        action: "mouseLook",
        x: 0,
        y: 0,
      });
      return;
    }

    await mcpClient.call("input_action_set", {
      action: "mouseLook",
      x: clamp(yawDelta / LOOK_RADIANS_PER_UNIT, -1, 1),
      y: clamp(pitchDelta / LOOK_RADIANS_PER_UNIT, -1, 1),
    });
    await stepFrames(mcpClient, 1);
  }

  const state = await readFpsState(mcpClient);
  const desired = lookAngles(state.playerPosition, target);
  throw new Error(
    `Could not aim at ${formatVec(target)}; yawDelta=${angleDelta(
      desired.yaw,
      state.yaw,
    ).toFixed(4)} pitchDelta=${(desired.pitch - state.pitch).toFixed(4)}`,
  );
}

async function aimYawAt(mcpClient, target, options = {}) {
  for (let i = 0; i < (options.maxFrames ?? 8); i += 1) {
    const state = await readFpsState(mcpClient);
    const desired = lookAngles(state.playerPosition, target);
    const yawDelta = angleDelta(desired.yaw, state.yaw);
    const pitchDelta = (options.pitch ?? state.pitch) - state.pitch;

    if (Math.abs(yawDelta) <= (options.tolerance ?? 0.08)) {
      await mcpClient.call("input_action_set", {
        action: "mouseLook",
        x: 0,
        y: 0,
      });
      return;
    }

    await mcpClient.call("input_action_set", {
      action: "mouseLook",
      x: clamp(yawDelta / LOOK_RADIANS_PER_UNIT, -1, 1),
      y: clamp(pitchDelta / LOOK_RADIANS_PER_UNIT, -1, 1),
    });
    await stepFrames(mcpClient, 1);
  }
}

async function pulseButton(mcpClient, action, frames) {
  await mcpClient.call("input_action_set", { action, pressed: true });
  await stepFrames(mcpClient, frames);
  await mcpClient.call("input_action_set", { action, pressed: false });
  await stepFrames(mcpClient, 1);
}

async function stepFrames(mcpClient, count) {
  for (let i = 0; i < count; i += 1) {
    await mcpClient.call("ecs_step", { delta: DT });
  }
}

async function releaseInputs(mcpClient) {
  await mcpClient.call("input_action_set", { action: "move", x: 0, y: 0 });
  await mcpClient.call("input_action_set", { action: "look", x: 0, y: 0 });
  await mcpClient.call("input_action_set", { action: "mouseLook", x: 0, y: 0 });
  for (const action of ["jump", "shoot", "switchWeapon", "reset"]) {
    await mcpClient.call("input_action_set", { action, pressed: false });
  }
}

async function readFpsState(mcpClient) {
  let lastResponse = null;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await mcpClient.call("resource_get", { id: "fps.state" });
    const values =
      fpsStateValuesFromResourceResponse(response) ??
      (await fpsStateValuesFromBrowserStatus(mcpClient));

    if (values !== undefined) {
      return values;
    }

    lastResponse = response;
    await delay(100);
  }

  throw new Error(
    `fps.state was not available: ${JSON.stringify(lastResponse)}`,
  );
}

function fpsStateValuesFromResourceResponse(response) {
  const entry =
    response?.result?.resources?.entries?.[0] ??
    response?.result?.entries?.[0] ??
    response?.result?.entry ??
    response?.result;

  return entry?.values;
}

async function fpsStateValuesFromBrowserStatus(mcpClient) {
  const response = await mcpClient.call("browser_status", {});
  const resources =
    response?.page?.status?.lastWorkerSummary?.resources?.entries ??
    response?.status?.lastWorkerSummary?.resources?.entries ??
    [];
  const entry = resources.find((resource) => resource.id === "fps.state");

  return entry?.values;
}

async function delay(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assertClearState(state) {
  const destroyed = state.enemyDestroyed ?? {};
  const missing = ENEMIES.filter((enemy) => destroyed[enemy.key] !== true).map(
    (enemy) => enemy.key,
  );

  if (
    state.enemiesRemaining !== 0 ||
    state.destroyedEnemies !== ENEMIES.length ||
    state.gameStatus !== "cleared" ||
    missing.length > 0
  ) {
    throw new Error(
      `FPS full-clear smoke failed: ${JSON.stringify(
        {
          enemiesRemaining: state.enemiesRemaining,
          destroyedEnemies: state.destroyedEnemies,
          gameStatus: state.gameStatus,
          missing,
          shotsFired: state.shotsFired,
          hits: state.hits,
          health: state.health,
        },
        null,
        2,
      )}`,
    );
  }
}

function localMoveToward(yaw, dx, dz) {
  const length = Math.hypot(dx, dz);
  if (length <= Number.EPSILON) return [0, 0];

  const nx = dx / length;
  const nz = dz / length;
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  const forward = [-Math.sin(yaw), -Math.cos(yaw)];
  return [
    clamp(nx * right[0] + nz * right[1], -1, 1),
    clamp(nx * forward[0] + nz * forward[1], -1, 1),
  ];
}

function lookAngles(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const distance = Math.hypot(dx, dy, dz) || 1;
  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.asin(clamp(dy / distance, -1, 1)),
  };
}

function angleDelta(target, current) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function summarizeState(state) {
  return {
    health: state.health,
    position: state.playerPosition?.map((value) => Number(value.toFixed(3))),
    yaw: Number(state.yaw?.toFixed(3)),
    pitch: Number(state.pitch?.toFixed(3)),
    shotsFired: state.shotsFired,
    hits: state.hits,
    enemiesRemaining: state.enemiesRemaining,
    destroyedEnemies: state.destroyedEnemies,
    gameStatus: state.gameStatus,
  };
}

function logProgress(label, payload) {
  process.stderr.write(
    `[fps-full-clear] ${label} ${JSON.stringify(payload)}\n`,
  );
}

function formatVec(vec) {
  return `[${vec.map((value) => Number(value).toFixed(3)).join(", ")}]`;
}

function formatVec2(vec) {
  return `[${vec.map((value) => Number(value).toFixed(3)).join(", ")}]`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseArgs(args) {
  const parsed = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.slice(2).split("=", 2);
    if (rawKey.length === 0) continue;
    if (rawValue !== undefined) {
      parsed.set(rawKey, rawValue);
      continue;
    }
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      parsed.set(rawKey, next);
      i += 1;
    } else {
      parsed.set(rawKey, "true");
    }
  }
  return parsed;
}

function stringArg(args, key, fallback) {
  const value = args.get(key);
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberArg(args, key, fallback) {
  const value = Number(args.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function booleanArg(args, key, fallback) {
  if (!args.has(key)) return fallback;
  const value = args.get(key);
  return value !== "false" && value !== "0";
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`${command} ${args.join(" ")} timed out.\n${stderr}`));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

class ApertureMcpClient {
  #cwd;
  #child = null;
  #nextId = 1;
  #buffer = "";
  #pending = new Map();

  constructor(cwd) {
    this.#cwd = cwd;
  }

  async start() {
    this.#child = spawn("pnpm", ["exec", "aperture", "mcp", "stdio"], {
      cwd: this.#cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child.stdout.on("data", (chunk) => this.#readStdout(chunk));
    this.#child.stderr.on("data", (chunk) => {
      if (verbose) process.stderr.write(chunk);
    });
    this.#child.once("exit", (code) => {
      for (const pending of this.#pending.values()) {
        pending.reject(new Error(`aperture mcp stdio exited with ${code}`));
      }
      this.#pending.clear();
    });
    await this.callRaw("initialize", {});
  }

  async stop() {
    if (this.#child === null) return;
    await new Promise((resolve) => {
      this.#child.once("exit", resolve);
      this.#child.stdin.end();
      setTimeout(() => {
        if (this.#child !== null && this.#child.exitCode === null) {
          this.#child.kill("SIGTERM");
        }
      }, 1_000).unref();
    });
    this.#child = null;
  }

  call(name, args) {
    return this.callRaw("tools/call", {
      name,
      arguments: args,
    }).then((message) => message.result?.structuredContent);
  }

  callRaw(method, params) {
    if (this.#child === null) {
      return Promise.reject(new Error("MCP client is not started."));
    }

    const id = this.#nextId;
    this.#nextId += 1;
    const request = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`MCP request '${method}' timed out.`));
      }, 60_000);
      this.#pending.set(id, {
        resolve: (message) => {
          clearTimeout(timeout);
          if (message.error !== undefined) {
            reject(new Error(JSON.stringify(message.error)));
          } else {
            resolve(message);
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.#child.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  #readStdout(chunk) {
    this.#buffer += chunk.toString();
    for (;;) {
      const newline = this.#buffer.indexOf("\n");
      if (newline === -1) return;
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.length === 0) continue;
      const message = JSON.parse(line);
      const pending = this.#pending.get(message.id);
      if (pending === undefined) continue;
      this.#pending.delete(message.id);
      pending.resolve(message);
    }
  }
}

async function main() {
  const devSession = await startDevSession(port);
  const mcp = new ApertureMcpClient(FPS_ROOT);

  try {
    await mcp.start();
    await mcp.call("browser_wait_for_webgpu", { timeoutMs: 30_000 });
    await readFpsState(mcp);
    await resetGame(mcp);

    const initial = await readFpsState(mcp);
    logProgress("initial", summarizeState(initial));

    for (const step of ROUTE) {
      if (step.kind === "move") {
        await moveTo(mcp, step);
      } else {
        await shootEnemy(mcp, step);
      }
    }

    await releaseInputs(mcp);
    await stepFrames(mcp, 12);

    const finalState = await readFpsState(mcp);
    assertClearState(finalState);

    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await mcp.call("browser_screenshot", { path: screenshotPath });

    console.log(
      JSON.stringify(
        {
          ok: true,
          screenshot: screenshotPath,
          state: summarizeState(finalState),
        },
        null,
        2,
      ),
    );
  } finally {
    await releaseInputs(mcp).catch(() => {});
    await mcp.stop();
    if (!keepRunning && devSession.owned) {
      await runCommand("pnpm", ["exec", "aperture", "dev", "down"], {
        cwd: FPS_ROOT,
        timeoutMs: 30_000,
      }).catch(() => {});
    }
  }
}

await main();
