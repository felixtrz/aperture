import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { launchOptions } from "./local-webgpu.mjs";
import {
  verifyLaunch,
  verifyProof,
  installProof,
  actualBrowserArgv,
} from "./verified-webgpu.mjs";
const good = () => ({
  native: true,
  adapters: [{ description: "SwiftShader Device (Subzero)" }],
  devices: [{ adapter: { description: "SwiftShader Device (Subzero)" } }],
  canvasWebGPU: 1,
  webglAttempts: 0,
  submissions: 2,
  draws: 1,
  errors: [],
  deviceLost: [],
});

test("exact requested and actual launch configuration passes", () => {
  const launch = launchOptions("/browser/chromium", "/tmp/dedicated-profile");
  assert.equal(
    verifyLaunch(launch, [launch.executablePath, ...launch.args])
      .sandboxLaunchEnabled,
    true,
  );
});
for (const scenario of [
  "sandbox off",
  "default args on",
  "added flag",
  "missing flag",
  "different adapter",
  "duplicate flag",
]) {
  test(`launch rejects ${scenario}`, () => {
    const requested = launchOptions(
      "/browser/chromium",
      "/tmp/dedicated-profile",
    );
    const argv = [requested.executablePath, ...requested.args];
    if (scenario === "sandbox off") requested.chromiumSandbox = false;
    if (scenario === "default args on") requested.ignoreDefaultArgs = false;
    if (scenario === "added flag") argv.push("--no-sandbox");
    if (scenario === "missing flag") argv.pop();
    if (scenario === "different adapter")
      argv[argv.indexOf("--use-webgpu-adapter=swiftshader")] =
        "--use-webgpu-adapter=default";
    if (scenario === "duplicate flag") argv.push("--headless");
    assert.throws(() => verifyLaunch(requested, argv));
  });
}
test("actual argv lookup fails closed without process identity and detaches CDP", async () => {
  let detached = false;
  const browser = {
    newBrowserCDPSession: async () => ({
      send: async () => ({ processInfo: [] }),
      detach: async () => {
        detached = true;
      },
    }),
  };
  await assert.rejects(actualBrowserArgv(browser, {}), /exactly one browser/);
  assert.equal(detached, true);
});
test("positive native SwiftShader evidence passes", () =>
  assert.deepEqual(verifyProof(good()), good()));
const failures = {
  "missing proof": () => null,
  "non-native API": (p) => ({ ...p, native: false }),
  "missing adapter": (p) => ({ ...p, adapters: [] }),
  "missing device": (p) => ({ ...p, devices: [] }),
  "physical adapter": (p) => ({ ...p, adapters: [{ description: "NVIDIA" }] }),
  "unidentified adapter": (p) => ({ ...p, adapters: [{}] }),
  "unlinked device": (p) => ({ ...p, devices: [{ adapter: null }] }),
  "wrong device adapter": (p) => ({
    ...p,
    devices: [{ adapter: { description: "Intel" } }],
  }),
  "WebGL fallback": (p) => ({ ...p, webglAttempts: 1 }),
  "missing WebGPU canvas": (p) => ({ ...p, canvasWebGPU: 0 }),
  "no submissions": (p) => ({ ...p, submissions: 0 }),
  "no draws": (p) => ({ ...p, draws: 0 }),
  "GPU error": (p) => ({ ...p, errors: ["Validation failed"] }),
  "device lost": (p) => ({ ...p, deviceLost: [{ reason: "unknown" }] }),
};
for (const [name, change] of Object.entries(failures))
  test(`proof rejects ${name}`, () =>
    assert.throws(() => verifyProof(change(good()))));
test("console/page/network errors fail the run", () =>
  assert.throws(() => verifyProof(good(), ["page failed"])));
test("instrumentation reports unavailable native WebGPU", () => {
  const context = { navigator: {} };
  runInNewContext(`(${installProof.toString()})()`, context);
  assert.equal(context.__APERTURE_VERIFIED_GPU__.native, false);
  assert.equal(
    context.__APERTURE_VERIFIED_GPU__.errors[0],
    "Native WebGPU unavailable",
  );
});
test("instrumentation forwards real arguments, links adapters/devices, counts rendering and errors", async () => {
  const calls = [],
    listeners = {};
  class GPUQueue {
    submit(...args) {
      calls.push(["submit", args]);
    }
    async onSubmittedWorkDone() {}
  }
  class GPUDevice {
    constructor() {
      this.queue = new GPUQueue();
      this.label = "test";
      this.lost = new Promise(() => {});
    }
    addEventListener(name, fn) {
      listeners[name] = fn;
    }
  }
  class GPUAdapter {
    constructor() {
      this.info = { description: "SwiftShader Device" };
    }
    async requestDevice(...args) {
      calls.push(["device", args]);
      return new GPUDevice();
    }
  }
  class HTMLCanvasElement {
    getContext(type) {
      calls.push(["canvas", type]);
      return {};
    }
  }
  class GPURenderPassEncoder {
    draw(...args) {
      calls.push(["draw", args]);
    }
  }
  const context = {
    navigator: {
      gpu: {
        async requestAdapter(...args) {
          calls.push(["adapter", args]);
          return new GPUAdapter();
        },
      },
    },
    GPUAdapter,
    GPUDevice,
    GPUQueue,
    HTMLCanvasElement,
    GPURenderPassEncoder,
    addEventListener: (name, fn) => {
      listeners[name] = fn;
    },
    requestAnimationFrame: (fn) => fn(),
  };
  runInNewContext(`(${installProof.toString()})()`, context);
  const adapter = await context.navigator.gpu.requestAdapter({
    powerPreference: "low-power",
  });
  const device = await adapter.requestDevice({ label: "real" });
  new HTMLCanvasElement().getContext("webgpu");
  new GPURenderPassEncoder().draw(3);
  device.queue.submit(["commands"]);
  const proof = await context.__APERTURE_WAIT_GPU__();
  assert.equal(proof.native, false, "Mocks must not count as native API proof");
  assert.equal(proof.devices[0].adapter.description, "SwiftShader Device");
  assert.equal(proof.submissions, 1);
  assert.equal(proof.draws, 1);
  assert.equal(proof.canvasWebGPU, 1);
  assert.deepEqual(calls[0], ["adapter", [{ powerPreference: "low-power" }]]);
  assert.deepEqual(calls[1], ["device", [{ label: "real" }]]);
  new HTMLCanvasElement().getContext("webgl2");
  assert.equal(proof.webglAttempts, 1);
  listeners.uncapturederror({ error: { message: "bad shader" } });
  listeners.unhandledrejection({ reason: "failed promise" });
  assert.deepEqual([...proof.errors], ["bad shader", "failed promise"]);
});

test("CLI environment defaults remain explicit and command-line values take precedence", async () => {
  const { parseOptions } = await import("./verified-webgpu.mjs");
  assert.deepEqual(
    parseOptions([], {
      APERTURE_WEBGPU_RUNTIME: "/runtime",
      APERTURE_TMP_RUN: "/scratch",
    }),
    { runtimeRoot: "/runtime", scratchRoot: "/scratch" },
  );
  assert.equal(
    parseOptions(["--runtime", "/other"], {
      APERTURE_WEBGPU_RUNTIME: "/runtime",
    }).runtimeRoot,
    "/other",
  );
  for (const args of [
    ["--no-sandbox"],
    ["--url"],
    ["--url", "--output"],
    ["--url", "x", "--url", "y"],
    ["--flags", "x"],
  ]) {
    assert.throws(() => parseOptions(args, {}), /CLI option/);
  }
});
test("invalid configuration fails before loading or launching a runtime", async () => {
  const { runVerifiedScene } = await import("./verified-webgpu.mjs");
  const good = {
    runtimeRoot: "/runtime",
    scratchRoot: "/scratch",
    outputPath: "/result.json",
    url: "http://127.0.0.1:1234/",
  };
  for (const change of [
    { runtimeRoot: "relative" },
    { scratchRoot: undefined },
    { outputPath: "relative" },
    { screenshotPath: "/result.json" },
    { bundlePath: "/result.json" },
    { bundlePath: "relative" },
    { url: "https://example.com/" },
    { readyGlobal: "nested.value" },
    { timeout: 0 },
  ]) {
    await assert.rejects(runVerifiedScene({ ...good, ...change }));
  }
});

for (const bundle of [false, true]) {
  for (const screenshot of [false, true]) {
    test(`optional paths: bundle=${bundle}, screenshot=${screenshot} reach runtime validation`, async (t) => {
      const { mkdtemp, readFile, rm } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { runVerifiedScene } = await import("./verified-webgpu.mjs");
      const root = await mkdtemp(join(tmpdir(), "verified-option-paths-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const outputPath = join(root, "report.json");
      await assert.rejects(
        runVerifiedScene({
          runtimeRoot: join(root, "missing-runtime"),
          scratchRoot: root,
          url: "http://127.0.0.1:1234/",
          outputPath,
          ...(bundle ? { bundlePath: join(root, "bundle.json") } : {}),
          ...(screenshot ? { screenshotPath: join(root, "image.png") } : {}),
        }),
        /Verified rendering failed/,
      );
      const report = JSON.parse(await readFile(outputPath, "utf8"));
      assert.equal(report.status, "failed");
      assert.match(report.error, /ENOENT/);
      assert.deepEqual(report.viewport, { width: 800, height: 600 });
    });
  }
}

test("provided output/input path collisions reject before runtime loading", async () => {
  const { runVerifiedScene } = await import("./verified-webgpu.mjs");
  const base = {
    runtimeRoot: "/runtime",
    scratchRoot: "/scratch",
    outputPath: "/result.json",
    url: "http://127.0.0.1:1234/",
  };
  for (const change of [
    { bundlePath: "/result.json" },
    { screenshotPath: "/result.json" },
    { bundlePath: "/same", screenshotPath: "/same" },
    { bundlePath: "/scratch/../result.json" },
  ]) {
    await assert.rejects(
      runVerifiedScene({ ...base, ...change }),
      /paths must be distinct/,
    );
  }
});

test("CLI viewport dimensions use the same validated bounds as the API", async () => {
  const { parseOptions, validateViewport, MAX_VIEWPORT_DIMENSION } =
    await import("./verified-webgpu.mjs");
  assert.deepEqual(
    parseOptions(["--width", "1254", "--height", "1254"], {}).viewport,
    { width: 1254, height: 1254 },
  );
  assert.deepEqual(parseOptions(["--width", "1254"], {}).viewport, {
    width: 1254,
    height: 600,
  });
  assert.deepEqual(parseOptions(["--height", "1254"], {}).viewport, {
    width: 800,
    height: 1254,
  });
  assert.equal(
    parseOptions([], {}).viewport,
    undefined,
    "API supplies unchanged 800x600 default",
  );
  for (const value of [1, MAX_VIEWPORT_DIMENSION]) {
    assert.deepEqual(validateViewport({ width: value, height: value }), {
      width: value,
      height: value,
    });
  }
  for (const value of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    MAX_VIEWPORT_DIMENSION + 1,
    "1254",
    undefined,
  ]) {
    assert.throws(
      () => validateViewport({ width: value, height: 600 }),
      /width must be/,
    );
    assert.throws(
      () => validateViewport({ width: 800, height: value }),
      /height must be/,
    );
  }
  for (const value of [
    "0",
    "-1",
    "1.5",
    "NaN",
    "Infinity",
    String(MAX_VIEWPORT_DIMENSION + 1),
    "",
  ]) {
    assert.throws(() => parseOptions(["--width", value], {}), /width must be/);
    assert.throws(
      () => parseOptions(["--height", value], {}),
      /height must be/,
    );
  }
  assert.throws(
    () => parseOptions(["--width", "1", "--width", "2"], {}),
    /duplicate CLI option/,
  );
});

test("API rejects invalid viewport before runtime loading", async () => {
  const { runVerifiedScene } = await import("./verified-webgpu.mjs");
  for (const viewport of [
    null,
    {},
    { width: 0, height: 1 },
    { width: 1, height: 16385 },
  ]) {
    await assert.rejects(
      runVerifiedScene({
        runtimeRoot: "/runtime",
        scratchRoot: "/scratch",
        outputPath: "/report.json",
        url: "http://127.0.0.1:1234/",
        viewport,
      }),
      /viewport|width|height/,
    );
  }
});
