#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 5173;
const DT = 1 / 60;
const LOOK_RADIANS_PER_UNIT = 26 / 700;
const DEFAULT_SCREENSHOT = path.join(
  FPS_ROOT,
  ".aperture/runtime/fps-skybox-readback.png",
);

const SKYBOX_VIEW_PROOFS = [
  {
    id: "source-forward-u050",
    yaw: 0,
    sourceUv: [0.5, "upper-center ray"],
  },
  {
    id: "source-left-u025",
    yaw: Math.PI / 2,
    sourceUv: [0.25, "upper-center ray"],
  },
  {
    id: "source-right-u075",
    yaw: -Math.PI / 2,
    sourceUv: [0.75, "upper-center ray"],
  },
  {
    id: "source-back-seam",
    yaw: Math.PI,
    sourceUv: [0, "upper-center ray"],
  },
];

const EXPECTED_RELATIONSHIPS = [
  "source-left-u025 upper-center is warmer/brighter than source-forward-u050",
  "source-forward-u050 upper-center is warmer/brighter than source-right-u075",
  "source-right-u075 and source-back-seam upper-center both land in the darker blue band",
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
      return readFpsState(mcpClient);
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

async function readSkyboxViewSample(mcpClient, view) {
  const state = await aimAtYaw(mcpClient, view.yaw);
  const readback = await mcpClient.call("render_readback_samples", {
    samples: [
      {
        id: `${view.id}-upper-center`,
        x: 0.5,
        y: 0.18,
        coordinateSpace: "normalized",
      },
      {
        id: `${view.id}-upper-left`,
        x: 0.22,
        y: 0.18,
        coordinateSpace: "normalized",
      },
    ],
  });

  if (readback?.ok !== true) {
    throw new Error(
      `Skybox readback failed for ${view.id}: ${JSON.stringify(readback)}`,
    );
  }

  const upperCenter = requiredSample(
    readback.samples,
    `${view.id}-upper-center`,
  );
  const upperLeft = requiredSample(readback.samples, `${view.id}-upper-left`);

  assertSkyPixel(view.id, upperCenter.pixel);
  assertSkyPixel(view.id, upperLeft.pixel);

  return {
    id: view.id,
    yaw: state.yaw,
    pitch: state.pitch,
    sourceUv: view.sourceUv,
    upperCenter,
    upperLeft,
  };
}

function assertSkyboxFrameReport(report) {
  const summary =
    report?.result?.report?.summary ??
    report?.report?.summary ??
    report?.result?.summary ??
    null;
  const counts = summary?.counts;

  if (counts?.skyboxes !== 1 || counts?.diagnostics !== 0) {
    throw new Error(
      `Expected one diagnostic-free extracted skybox; report=${JSON.stringify(report)}`,
    );
  }

  return {
    frame: summary.frame,
    skyboxes: counts.skyboxes,
    diagnostics: counts.diagnostics,
    views: counts.views,
    drawCalls: counts.drawCalls,
  };
}

function assertSkyboxRelationships(samples) {
  const byId = new Map(samples.map((sample) => [sample.id, sample]));
  const forward = byId.get("source-forward-u050");
  const left = byId.get("source-left-u025");
  const right = byId.get("source-right-u075");
  const back = byId.get("source-back-seam");

  if (
    forward === undefined ||
    left === undefined ||
    right === undefined ||
    back === undefined
  ) {
    throw new Error(`Missing skybox samples: ${JSON.stringify(samples)}`);
  }

  const forwardPixel = forward.upperCenter.pixel;
  const leftPixel = left.upperCenter.pixel;
  const rightPixel = right.upperCenter.pixel;
  const backPixel = back.upperCenter.pixel;

  if (leftPixel.r <= forwardPixel.r + 18) {
    throw new Error(
      `Expected source-left to be warmer than source-forward: ${JSON.stringify({ leftPixel, forwardPixel })}`,
    );
  }

  if (forwardPixel.r <= rightPixel.r + 15) {
    throw new Error(
      `Expected source-forward to be warmer than source-right: ${JSON.stringify({ forwardPixel, rightPixel })}`,
    );
  }

  if (Math.abs(rightPixel.r - backPixel.r) > 12) {
    throw new Error(
      `Expected source-right and source-back to remain in the same darker band: ${JSON.stringify({ rightPixel, backPixel })}`,
    );
  }
}

function assertSkyPixel(label, pixel) {
  if (
    pixel.a !== 255 ||
    pixel.b < 180 ||
    pixel.g < 120 ||
    pixel.r < 90 ||
    pixel.b <= pixel.r
  ) {
    throw new Error(
      `${label} sky sample did not look like the source blue/purple sky: ${JSON.stringify(pixel)}`,
    );
  }
}

function requiredSample(samples, id) {
  const sample = samples?.find((candidate) => candidate.id === id);
  if (sample === undefined) {
    throw new Error(`Missing readback sample '${id}'.`);
  }
  return sample;
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

function angleDelta(target, current) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
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
    await resetGame(mcp);

    const frame = assertSkyboxFrameReport(
      await mcp.call("render_get_frame_report", { summaryOnly: true }),
    );
    const samples = [];

    for (const view of SKYBOX_VIEW_PROOFS) {
      const sample = await readSkyboxViewSample(mcp, view);
      samples.push(sample);
    }

    assertSkyboxRelationships(samples);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await mcp.call("browser_screenshot", { path: screenshotPath });

    console.log(
      JSON.stringify(
        {
          ok: true,
          screenshot: screenshotPath,
          frame,
          expectedRelationships: EXPECTED_RELATIONSHIPS,
          samples: samples.map((sample) => ({
            id: sample.id,
            yaw: Number(sample.yaw.toFixed(3)),
            pitch: Number(sample.pitch.toFixed(3)),
            sourceUv: sample.sourceUv,
            upperCenter: sample.upperCenter.pixel,
            upperLeft: sample.upperLeft.pixel,
          })),
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
