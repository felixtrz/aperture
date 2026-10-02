import assert from "node:assert/strict";
import { readFile, writeFile, realpath } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve, isAbsolute } from "node:path";
import {
  loadRuntime,
  launchOptions,
  localRequestPolicy,
  withLocalWebGPU,
} from "./local-webgpu.mjs";

export function verifyLaunch(requested, actualArgv) {
  const profile = requested.args
    ?.find((x) => x.startsWith("--user-data-dir="))
    ?.slice(16);
  assert.deepEqual(
    requested,
    launchOptions(requested.executablePath, profile),
    "Launch configuration differs from the approved configuration",
  );
  assert.ok(
    Array.isArray(actualArgv) && actualArgv.length > 1,
    "Actual browser argv missing",
  );
  assert.deepEqual(
    [...actualArgv.slice(1)].sort(),
    [...requested.args].sort(),
    "Actual browser flags differ from the approved flags",
  );
  return { requested, actualArgv, sandboxLaunchEnabled: true };
}

// Installed before any scene script. All observed API calls forward to native APIs.
// Trusted local scenes only: this is a correctness gate, not hostile-code attestation.
export function installProof() {
  const proof = {
    native: false,
    adapters: [],
    devices: [],
    canvasWebGPU: 0,
    webglAttempts: 0,
    submissions: 0,
    draws: 0,
    errors: [],
    deviceLost: [],
  };
  const devices = [];
  const native = (fn) =>
    typeof fn === "function" &&
    Function.prototype.toString.call(fn).includes("[native code]");
  globalThis.__APERTURE_VERIFIED_GPU__ = proof;
  globalThis.__APERTURE_WAIT_GPU__ = async () => {
    await Promise.all(
      devices.map((device) => device.queue.onSubmittedWorkDone()),
    );
    await new Promise((resolve) =>
      globalThis.requestAnimationFrame(() =>
        globalThis.requestAnimationFrame(resolve),
      ),
    );
    return proof;
  };
  const wrapCanvas = (proto) => {
    const original = proto?.getContext;
    if (!original) return;
    proto.getContext = function (type, ...args) {
      if (
        ["webgl", "webgl2", "experimental-webgl"].includes(
          String(type).toLowerCase(),
        )
      )
        proof.webglAttempts++;
      const result = original.call(this, type, ...args);
      if (type === "webgpu" && result) proof.canvasWebGPU++;
      return result;
    };
  };
  wrapCanvas(globalThis.HTMLCanvasElement?.prototype);
  wrapCanvas(globalThis.OffscreenCanvas?.prototype);
  if (
    !globalThis.navigator.gpu ||
    !globalThis.GPUAdapter ||
    !globalThis.GPUDevice
  ) {
    proof.errors.push("Native WebGPU unavailable");
    return;
  }
  const requestAdapter = globalThis.navigator.gpu.requestAdapter;
  const requestDevice = globalThis.GPUAdapter.prototype.requestDevice;
  const submit = globalThis.GPUQueue?.prototype.submit;
  proof.native = [requestAdapter, requestDevice, submit].every(native);
  const adapterInfo = new WeakMap();
  globalThis.navigator.gpu.requestAdapter = async function (...args) {
    try {
      const adapter = await requestAdapter.apply(this, args);
      if (!adapter) {
        proof.errors.push("requestAdapter returned null");
        return adapter;
      }
      const info = adapter.info ?? (await adapter.requestAdapterInfo?.());
      const record = Object.fromEntries(
        ["vendor", "architecture", "device", "description"].map((key) => [
          key,
          info?.[key] ?? "",
        ]),
      );
      adapterInfo.set(adapter, record);
      proof.adapters.push(record);
      return adapter;
    } catch (error) {
      proof.errors.push(String(error));
      throw error;
    }
  };
  globalThis.GPUAdapter.prototype.requestDevice = async function (...args) {
    try {
      const device = await requestDevice.apply(this, args);
      proof.devices.push({
        adapter: adapterInfo.get(this) ?? null,
        label: device.label,
      });
      devices.push(device);
      device.addEventListener("uncapturederror", (event) =>
        proof.errors.push(event.error.message),
      );
      device.lost.then((info) =>
        proof.deviceLost.push({ reason: info.reason, message: info.message }),
      );
      const originalSubmit = device.queue.submit;
      device.queue.submit = function (...args) {
        const result = originalSubmit.apply(this, args);
        proof.submissions++;
        return result;
      };
      return device;
    } catch (error) {
      proof.errors.push(String(error));
      throw error;
    }
  };
  for (const proto of [
    globalThis.GPURenderPassEncoder?.prototype,
    globalThis.GPURenderBundleEncoder?.prototype,
  ]) {
    if (!proto) continue;
    for (const method of [
      "draw",
      "drawIndexed",
      "drawIndirect",
      "drawIndexedIndirect",
    ]) {
      const original = proto[method];
      proto[method] = function (...args) {
        const result = original.apply(this, args);
        proof.draws++;
        return result;
      };
    }
  }
  globalThis.addEventListener("unhandledrejection", (event) =>
    proof.errors.push(String(event.reason)),
  );
}

export function verifyProof(proof, errors = []) {
  assert.equal(proof?.native, true, "Native WebGPU API proof missing");
  assert.ok(proof.adapters?.length > 0, "No native adapter observed");
  assert.ok(proof.devices?.length > 0, "No native device observed");
  const swiftshader = (info) =>
    info && /swiftshader/i.test(Object.values(info).join(" "));
  assert.ok(
    proof.adapters.every(swiftshader),
    "Non-SwiftShader or unidentified adapter",
  );
  assert.ok(
    proof.devices.every((device) => swiftshader(device.adapter)),
    "Device is not linked to a proven SwiftShader adapter",
  );
  assert.equal(proof.webglAttempts, 0, "WebGL fallback attempted");
  assert.ok(proof.canvasWebGPU > 0, "No WebGPU canvas observed");
  assert.ok(
    proof.submissions > 0 && proof.draws > 0,
    "No actual WebGPU rendering work observed",
  );
  assert.deepEqual(proof.errors, [], "WebGPU or unhandled errors");
  assert.deepEqual(proof.deviceLost, [], "WebGPU device lost");
  assert.deepEqual(errors, [], "Page, console, network, or browser errors");
  return proof;
}

export async function actualBrowserArgv(browser, requested) {
  const session = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await session.send("SystemInfo.getProcessInfo");
    const process = processInfo.filter((p) => p.type === "browser");
    assert.equal(
      process.length,
      1,
      "Cannot identify exactly one browser process",
    );
    const pid = process[0].id;
    assert.ok(Number.isSafeInteger(pid) && pid > 0, "Invalid browser PID");
    const argv = (await readFile(`/proc/${pid}/cmdline`, "utf8"))
      .split("\0")
      .filter(Boolean);
    assert.equal(
      await realpath(`/proc/${pid}/exe`),
      await realpath(requested.executablePath),
      "Actual browser executable differs",
    );
    return argv;
  } finally {
    await session.detach();
  }
}

// Runner-supported dimensions, not a promise that every host can allocate them.
export const MAX_VIEWPORT_DIMENSION = 16384;

export function validateViewport(viewport) {
  assert.ok(
    viewport && typeof viewport === "object",
    "viewport must be an object",
  );
  for (const key of ["width", "height"]) {
    assert.ok(
      Number.isInteger(viewport[key]) &&
        viewport[key] > 0 &&
        viewport[key] <= MAX_VIEWPORT_DIMENSION,
      key + " must be an integer from 1 to " + MAX_VIEWPORT_DIMENSION,
    );
  }
  return { width: viewport.width, height: viewport.height };
}

export async function runVerifiedScene({
  runtimeRoot,
  url,
  scratchRoot,
  outputPath,
  screenshotPath,
  readyGlobal = "__APERTURE_RENDER_STATUS__",
  bundlePath,
  timeout = 120000,
  viewport = { width: 800, height: 600 },
}) {
  for (const [key, value] of Object.entries({
    runtimeRoot,
    scratchRoot,
    outputPath,
  })) {
    assert.ok(
      typeof value === "string" && isAbsolute(value),
      key + " must be an absolute path",
    );
  }
  for (const [key, value] of Object.entries({ bundlePath, screenshotPath })) {
    assert.ok(
      value === undefined || (typeof value === "string" && isAbsolute(value)),
      key + " must be an absolute path",
    );
  }
  const providedPaths = [outputPath, bundlePath, screenshotPath]
    .filter((value) => value !== undefined)
    .map((value) => resolve(value));
  assert.equal(
    new Set(providedPaths).size,
    providedPaths.length,
    "Input bundle, output report and screenshot paths must be distinct",
  );
  viewport = validateViewport(viewport);
  assert.ok(
    /^[A-Za-z_$][\w$]*$/.test(readyGlobal),
    "readyGlobal must be one global variable name",
  );
  assert.ok(
    Number.isFinite(timeout) && timeout > 0,
    "Positive timeout required",
  );
  const origin = new URL(url).origin;
  assert.ok(
    localRequestPolicy([origin])(url),
    "Scene URL must be loopback HTTP",
  );
  const report = {
    schema: 1,
    status: "failed",
    startedAt: new Date().toISOString(),
    url,
    readyGlobal,
    viewport,
    errors: [],
  };
  try {
    const runtime = await loadRuntime(runtimeRoot);
    const bundle = bundlePath
      ? JSON.parse(await readFile(bundlePath, "utf8"))
      : undefined;
    await withLocalWebGPU(
      {
        runtime,
        scratchRoot,
        viewport,
        allowedOrigins: [origin],
        onBlocked: (blocked) =>
          report.errors.push(`Blocked request: ${blocked}`),
      },
      async ({ browser, context, launch }) => {
        report.launch = verifyLaunch(
          launch,
          await actualBrowserArgv(browser, launch),
        );
        report.browserVersion = browser.version();
        await context.addInitScript(installProof);
        if (bundle)
          await context.addInitScript((value) => {
            globalThis.__APERTURE_RENDER_BUNDLE__ = value;
          }, bundle);
        const page = await context.newPage();
        page.on("pageerror", (error) => report.errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") report.errors.push(message.text());
        });
        page.on("crash", () => report.errors.push("Page crashed"));
        page.on("response", (response) => {
          if (response.status() >= 400)
            report.errors.push(`HTTP ${response.status()}: ${response.url()}`);
        });
        page.on("requestfailed", (request) =>
          report.errors.push(`Request failed: ${request.url()}`),
        );
        await page.goto(url, { waitUntil: "load", timeout });
        await page.waitForFunction(
          (key) => globalThis[key] !== undefined,
          readyGlobal,
          { timeout },
        );
        report.sceneStatus = await page.evaluate(
          (key) => globalThis[key],
          readyGlobal,
        );
        assert.ok(
          report.sceneStatus === true || report.sceneStatus?.ok === true,
          "Scene did not report successful completion",
        );
        report.proof = await page.evaluate(() =>
          globalThis.__APERTURE_WAIT_GPU__(),
        );
        verifyProof(report.proof, report.errors);
        if (screenshotPath)
          await page.screenshot({ path: screenshotPath, timeout });
        // Recheck after screenshot and completed queue, before context shutdown destroys devices.
        report.proof = await page.evaluate(() =>
          globalThis.__APERTURE_WAIT_GPU__(),
        );
        verifyProof(report.proof, report.errors);
      },
    );
    report.status = "passed";
  } catch (error) {
    report.error = error.stack ?? String(error);
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
  if (report.status !== "passed")
    throw new Error(
      `Verified rendering failed; see ${outputPath}: ${report.error}`,
    );
  return report;
}

export function parseOptions(args, env = process.env) {
  const names = {
    "--runtime": "runtimeRoot",
    "--url": "url",
    "--scratch": "scratchRoot",
    "--output": "outputPath",
    "--screenshot": "screenshotPath",
    "--ready-global": "readyGlobal",
    "--bundle": "bundlePath",
    "--timeout": "timeout",
    "--width": "width",
    "--height": "height",
  };
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = names[args[i]],
      value = args[i + 1];
    if (
      !key ||
      value === undefined ||
      value.startsWith("--") ||
      options[key] !== undefined
    ) {
      throw new Error("Unknown, missing or duplicate CLI option: " + args[i]);
    }
    options[key] = ["timeout", "width", "height"].includes(key)
      ? Number(value)
      : value;
  }
  if (options.width !== undefined || options.height !== undefined) {
    options.viewport = validateViewport({
      width: options.width ?? 800,
      height: options.height ?? 600,
    });
    delete options.width;
    delete options.height;
  }
  options.runtimeRoot ??= env.APERTURE_WEBGPU_RUNTIME;
  options.scratchRoot ??= env.APERTURE_TMP_RUN;
  return options;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const options = parseOptions(process.argv.slice(2));
    await runVerifiedScene(options);
    console.log(
      "Verified native SwiftShader WebGPU render passed: " + options.outputPath,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
