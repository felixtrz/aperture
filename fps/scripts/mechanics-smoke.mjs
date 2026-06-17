#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 5173;
const DT = 1 / 60;
const LOOK_RADIANS_PER_UNIT = 26 / 700;

const argv = parseArgs(process.argv.slice(2));
const port = numberArg(argv, "port", DEFAULT_PORT);
const keepRunning = booleanArg(argv, "keep-running", false);
const freshSession = booleanArg(argv, "fresh-session", false);
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
  if (result.stderr.length > 0) process.stderr.write(result.stderr);

  return {
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
  await waitForGrounded(mcpClient, "reset");
  await releaseInputs(mcpClient);
}

async function provePrimaryMouseShoot(mcpClient) {
  const before = await readFpsState(mcpClient);
  await mcpClient.call("input_pointer_click", {
    x: 0.5,
    y: 0.5,
    button: "left",
  });
  await stepFrames(mcpClient, 4);
  const after = await readFpsState(mcpClient);

  if (after.shotsFired <= before.shotsFired) {
    throw new Error(
      `primary mouse did not fire: before=${before.shotsFired} after=${after.shotsFired}`,
    );
  }

  logProgress("shoot", {
    before: before.shotsFired,
    after: after.shotsFired,
  });
}

async function proveMiddleMouseWeaponToggle(mcpClient) {
  await resetGame(mcpClient);

  const before = await readFpsState(mcpClient);
  const click = await mcpClient.call("input_pointer_click", {
    x: 0.5,
    y: 0.5,
    button: "middle",
  });
  const expectedWeaponIndex = (before.weaponIndex + 1) % 2;
  let after = await readFpsState(mcpClient);
  for (let frame = 0; frame < 30; frame += 1) {
    await stepFrames(mcpClient, 1);
    after = await readFpsState(mcpClient);
    if (after.weaponIndex === expectedWeaponIndex) {
      break;
    }
  }

  if (
    after.weaponIndex !== expectedWeaponIndex ||
    after.shotsFired !== before.shotsFired
  ) {
    throw new Error(
      `middle mouse did not toggle weapon exactly once: ${JSON.stringify({
        before: summarizeState(before),
        after: summarizeState(after),
        click,
      })}`,
    );
  }

  logProgress("middle-switch", {
    before: before.weaponIndex,
    after: after.weaponIndex,
    phase: after.weaponSwitchPhase,
    shotsFired: after.shotsFired,
  });
}

async function proveCameraRelativeForward(mcpClient) {
  await resetGame(mcpClient);
  await aimAtYaw(mcpClient, -Math.PI / 2);

  const before = await readFpsState(mcpClient);
  await mcpClient.call("input_action_set", {
    action: "move",
    x: 0,
    y: 1,
  });
  await stepFrames(mcpClient, 18);
  await mcpClient.call("input_action_set", {
    action: "move",
    x: 0,
    y: 0,
  });
  const after = await readFpsState(mcpClient);

  const dx = after.playerPosition[0] - before.playerPosition[0];
  const dz = after.playerPosition[2] - before.playerPosition[2];
  if (dx <= 0.5 || Math.abs(dz) >= 0.35) {
    throw new Error(
      `camera-relative W failed at yaw -90deg: dx=${dx.toFixed(3)} dz=${dz.toFixed(3)}`,
    );
  }

  logProgress("camera-relative-forward", {
    yaw: Number(after.yaw.toFixed(3)),
    dx: Number(dx.toFixed(3)),
    dz: Number(dz.toFixed(3)),
  });
}

async function proveSpaceJumpTap(mcpClient) {
  await resetGame(mcpClient);

  const before = await readFpsState(mcpClient);
  await mcpClient.call("input_key", {
    key: "Space",
    action: "press",
  });
  await stepFrames(mcpClient, 4);
  const after = await readFpsState(mcpClient);

  if (
    after.verticalVelocity <= 0 ||
    after.jumpsRemaining >= before.jumpsRemaining ||
    after.grounded === true
  ) {
    throw new Error(
      `space jump tap failed: ${JSON.stringify({
        before: summarizeState(before),
        after: summarizeState(after),
      })}`,
    );
  }

  logProgress("jump", {
    verticalVelocity: Number(after.verticalVelocity.toFixed(3)),
    jumpsRemaining: after.jumpsRemaining,
    grounded: after.grounded,
  });
}

async function aimAtYaw(mcpClient, yaw) {
  for (let frame = 0; frame < 180; frame += 1) {
    const state = await readFpsState(mcpClient);
    const yawDelta = angleDelta(yaw, state.yaw);
    const pitchDelta = -state.pitch;

    if (Math.abs(yawDelta) <= 0.018 && Math.abs(pitchDelta) <= 0.018) {
      await mcpClient.call("input_action_set", {
        action: "mouseLook",
        x: 0,
        y: 0,
      });
      await stepFrames(mcpClient, 2);
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
  throw new Error(
    `Could not aim at yaw=${yaw.toFixed(4)}; final yaw=${state.yaw.toFixed(4)} pitch=${state.pitch.toFixed(4)}`,
  );
}

async function waitForGrounded(mcpClient, label) {
  for (let frame = 0; frame < 240; frame += 1) {
    const state = await readFpsState(mcpClient);
    if (state.grounded === true) return;
    if (state.playerPosition[1] < -5) {
      throw new Error(
        `${label} fell before grounding: ${formatVec(state.playerPosition)}`,
      );
    }
    await stepFrames(mcpClient, 1);
  }

  const state = await readFpsState(mcpClient);
  throw new Error(
    `${label} did not ground: ${formatVec(state.playerPosition)}`,
  );
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
  const response = await mcpClient.call("resource_get", { id: "fps.state" });
  const entry =
    response?.result?.resources?.entries?.[0] ??
    response?.result?.entries?.[0] ??
    response?.result?.entry ??
    response?.result;
  const values = entry?.values;
  if (values === undefined) {
    throw new Error(`fps.state was not available: ${JSON.stringify(response)}`);
  }
  return values;
}

function summarizeState(state) {
  return {
    position: state.playerPosition?.map((value) => Number(value.toFixed(3))),
    yaw: Number(state.yaw?.toFixed(3)),
    pitch: Number(state.pitch?.toFixed(3)),
    verticalVelocity: Number(state.verticalVelocity?.toFixed(3)),
    jumpsRemaining: state.jumpsRemaining,
    grounded: state.grounded,
    weaponIndex: state.weaponIndex,
    weaponName: state.weaponName,
    weaponSwitchPhase: state.weaponSwitchPhase,
    shotsFired: state.shotsFired,
  };
}

function logProgress(label, payload) {
  process.stderr.write(`[fps-mechanics] ${label} ${JSON.stringify(payload)}\n`);
}

function angleDelta(target, current) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function formatVec(vec) {
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
    await resetGame(mcp);
    await provePrimaryMouseShoot(mcp);
    await proveMiddleMouseWeaponToggle(mcp);
    await proveCameraRelativeForward(mcp);
    await proveSpaceJumpTap(mcp);
    await releaseInputs(mcp);

    const finalState = await readFpsState(mcp);
    console.log(
      JSON.stringify(
        {
          ok: true,
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
