import { createServer } from "node:http";
import { mkdir, readFile, readdir, realpath } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import {
  CONTRACT,
  READY_GLOBAL,
  SCHEMA,
  requireValue,
  validateSample,
  validateWorkerEligibility,
} from "./contract.mjs";
import { installNativeObserver } from "./native-observer.mjs";
import {
  inspectPng,
  readBoundedBody,
  sha256,
  writeImmutable,
} from "./recorder.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
};

export function parseOptions(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = {
        "--app": "appRoot",
        "--engine": "engine",
        "--output": "outputRoot",
        "--trial": "trial",
      }[args[i]],
      value = args[i + 1];
    requireValue(
      key && value && !value.startsWith("--") && result[key] === undefined,
      "Unknown, missing or duplicate benchmark option",
    );
    result[key] = key === "trial" ? Number(value) : value;
  }
  requireValue(
    ["three", "aperture"].includes(result.engine),
    "Engine must be three or aperture",
  );
  requireValue(
    Number.isInteger(result.trial) && result.trial >= 1,
    "Trial must be a positive integer",
  );
  for (const key of ["appRoot", "outputRoot"])
    requireValue(
      typeof result[key] === "string" && isAbsolute(result[key]),
      `${key} must be absolute`,
    );
  return result;
}

export async function verifyLifecycle(env = process.env) {
  const root = env.APERTURE_TMP_ROOT,
    run = env.APERTURE_TMP_RUN_ID,
    fd = env.APERTURE_TMP_LOCK_FD,
    scratch = env.APERTURE_TMP_RUN;
  requireValue(
    root === "/workspace/scratch/0190a8c72f8a/aperture-tmp" &&
      /^run-[a-f0-9]{32}$/.test(run ?? "") &&
      /^\d+$/.test(fd ?? ""),
    "Adopted runtime_pressure lifecycle required",
  );
  requireValue(
    (await realpath(`/proc/self/fd/${fd}`)) ===
      resolve(root, ".lifecycle.lock") &&
      (await realpath(scratch)) === resolve(root, run),
    "Lifecycle lock/scratch differs",
  );
  const manifest = JSON.parse(
    await readFile(resolve(scratch, ".manifest.json"), "utf8"),
  );
  requireValue(
    manifest.schema === "aperture.disposable-run.v2" &&
      manifest.state === "active" &&
      manifest.run_id === run,
    "Active lifecycle manifest required",
  );
  requireValue(
    isAbsolute(env.APERTURE_WEBGPU_RUNTIME ?? ""),
    "Exact provisioned runtime required",
  );
  return { root, run, scratch, runtimeRoot: env.APERTURE_WEBGPU_RUNTIME };
}

export async function readSourceTree(root) {
  const files = new Map();
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      requireValue(
        !entry.isSymbolicLink(),
        "Built benchmark inputs must not contain symlinks",
      );
      const absolute = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const key = "/" + relative(root, absolute).split(sep).join("/");
        const bytes = await readFile(absolute);
        requireValue(
          bytes.length <= 64 * 1024 * 1024,
          "Individual built input exceeds size limit",
        );
        files.set(key, bytes);
      }
    }
  }
  await visit(root);
  requireValue(
    files.has("/index.html"),
    "Built application index.html missing",
  );
  return files;
}

export function injectHarness(html) {
  requireValue(
    /<head\b[^>]*>/i.test(html),
    "Application needs an HTML head for pre-boot observer",
  );
  return html.replace(
    /<head\b[^>]*>/i,
    (head) =>
      `${head}\n<script>(${installNativeObserver.toString()})();</script>\n<script type="module" src="/__benchmark/client.mjs"></script>`,
  );
}

/** Preserve all bytes used by this attempt before any browser work begins. */
export async function preserveInputs(outputRoot, app, harness, servedIndex) {
  const inventories = {};
  for (const [name, files] of [
    ["frozen-app", app],
    ["frozen-harness", harness],
  ]) {
    const root = resolve(outputRoot, name);
    await mkdir(root);
    const inventory = {};
    for (const [key, bytes] of files) {
      const path = key.replace(/^\//, "");
      requireValue(
        path &&
          !path.includes("\\") &&
          !path.includes("\0") &&
          !path.split("/").some((part) => part === ".." || part === "."),
        "Invalid frozen input path",
      );
      const target = resolve(root, path);
      requireValue(
        target.startsWith(root + sep),
        "Frozen input escapes attempt",
      );
      await mkdir(dirname(target), { recursive: true });
      await writeImmutable(target, bytes);
      inventory[key] = {
        path: relative(outputRoot, target).split(sep).join("/"),
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    }
    inventories[name] = inventory;
  }
  await writeImmutable(resolve(outputRoot, "served-index.html"), servedIndex);
  return {
    ...inventories,
    servedIndex: {
      path: "served-index.html",
      bytes: servedIndex.length,
      sha256: sha256(servedIndex),
    },
    reconstruction:
      "Serve frozen-app files, substitute served-index.html for /index.html, and serve frozen-harness/client.mjs and contract.mjs under /__benchmark/.",
  };
}

function validateMeasurement(record, engine, trial) {
  requireValue(
    record.schema === SCHEMA &&
      record.engine === engine &&
      record.trial === trial &&
      JSON.stringify(record.contract) === JSON.stringify(CONTRACT),
    "Measurement provenance differs",
  );
  requireValue(
    record.warmup.length === CONTRACT.warmupFrames &&
      record.samples.length === CONTRACT.measuredFrames,
    "Measurement frame count differs",
  );
  for (const sample of [...record.warmup, ...record.samples])
    validateSample(sample);
  const workerEligibility = validateWorkerEligibility(
    engine,
    record.observationsBeforeMeasured,
    record.observationsAfterMeasured,
  );
  requireValue(
    JSON.stringify(record.workerEligibility) ===
      JSON.stringify(workerEligibility),
    "Worker eligibility evidence differs",
  );
  requireValue(
    record.views.length === CONTRACT.views.length &&
      record.views.every(
        (view, index) =>
          JSON.stringify(view.camera) === JSON.stringify(CONTRACT.views[index]),
      ),
    "Fixed camera views differ",
  );
}

export async function runAttempt(options) {
  const lifecycle = await verifyLifecycle(),
    input = await readSourceTree(options.appRoot);
  requireValue(
    !resolve(options.outputRoot).startsWith(resolve(lifecycle.root) + sep),
    "Retained output must be outside disposable scratch",
  );
  requireValue(
    !resolve(options.outputRoot).startsWith(resolve(options.appRoot) + sep) &&
      resolve(options.outputRoot) !== resolve(options.appRoot),
    "Output must be outside input tree",
  );
  await mkdir(dirname(options.outputRoot), { recursive: true });
  await mkdir(options.outputRoot); // Every failed or successful attempt is immutable.
  const save = (name, value) =>
    writeImmutable(
      resolve(options.outputRoot, name),
      JSON.stringify(value, null, 2) + "\n",
    );
  const pins = {};
  for (const [path, bytes] of input)
    pins[path] = { bytes: bytes.length, sha256: sha256(bytes) };
  const harness = new Map();
  for (const name of [
    "client.mjs",
    "contract.mjs",
    "native-observer.mjs",
    "recorder.mjs",
    "run.mjs",
    "README.md",
  ])
    harness.set(name, await readFile(resolve(directory, name)));
  const index = Buffer.from(
    injectHarness(input.get("/index.html").toString("utf8")),
  );
  const retainedInputs = await preserveInputs(
    options.outputRoot,
    input,
    harness,
    index,
  );
  const provenance = {
    schema: SCHEMA,
    startedAt: new Date().toISOString(),
    engine: options.engine,
    trial: options.trial,
    appRoot: options.appRoot,
    lifecycle: { root: lifecycle.root, run: lifecycle.run },
    contract: CONTRACT,
    retainedInputs,
    inputs: pins,
    harness: Object.fromEntries(
      [...harness].map(([path, bytes]) => [
        path,
        { bytes: bytes.length, sha256: sha256(bytes) },
      ]),
    ),
  };
  await save("inputs.json", provenance);
  const receipts = [],
    loaded = new Map(),
    failures = [];
  let origin,
    pending = Promise.resolve(),
    terminal = false,
    measurement;
  const server = createServer((request, response) => {
    const operation = async () => {
      try {
        requireValue(
          request.headers.host === new URL(origin).host,
          "Unexpected loopback Host",
        );
        const raw = (request.url ?? "").split("?", 1)[0],
          pathname = decodeURIComponent(raw);
        requireValue(
          !pathname.includes("\\") &&
            !pathname.includes("\0") &&
            !pathname.split("/").some((part) => part === ".." || part === "."),
          "Invalid request path",
        );
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (request.method === "POST") {
          requireValue(
            request.headers.origin === origin &&
              pathname.startsWith("/__benchmark/record/"),
            "Same-origin benchmark recorder required",
          );
          const name = pathname.slice("/__benchmark/record/".length);
          const png = CONTRACT.views.some((view) => name === `${view.id}.png`),
            binary = /^native-buffer-[0-9]{5}-[0-9]{3}\.bin$/.test(name);
          requireValue(
            png ||
              binary ||
              ["geometry.json", "measurement.json", "failure.json"].includes(
                name,
              ),
            "Unknown artifact name",
          );
          requireValue(
            !terminal && !receipts.some((receipt) => receipt.path === name),
            "Duplicate artifact or terminal attempt",
          );
          const body = await readBoundedBody(request, 64 * 1024 * 1024);
          const type = png
            ? "image/png"
            : binary
              ? "application/octet-stream"
              : "application/json";
          requireValue(
            request.headers["content-type"] === type && body.length > 0,
            "Artifact content type/size differs",
          );
          // Preserve the original before validation, including invalid attempt evidence.
          await writeImmutable(resolve(options.outputRoot, name), body);
          let inspection;
          if (png) inspection = inspectPng(body, CONTRACT.viewport);
          if (name === "measurement.json") {
            measurement = JSON.parse(body.toString("utf8"));
            validateMeasurement(measurement, options.engine, options.trial);
            requireValue(
              receipts.some((receipt) => receipt.path === "geometry.json") &&
                CONTRACT.views.every((view) =>
                  receipts.some((receipt) => receipt.path === `${view.id}.png`),
                ),
              "Incomplete geometry/view artifacts",
            );
            for (const supplied of measurement.artifacts) {
              const retained = receipts.find(
                (receipt) => receipt.path === supplied.path,
              );
              requireValue(
                retained &&
                  retained.sha256 === supplied.sha256 &&
                  retained.bytes === supplied.bytes,
                "Measurement artifact receipt differs",
              );
            }
            terminal = true;
          }
          if (name === "failure.json") terminal = true;
          const receipt = {
            ok: true,
            path: name,
            bytes: body.length,
            sha256: sha256(body),
            ...(inspection ? { inspection } : {}),
          };
          receipts.push(receipt);
          response.writeHead(201, { "Content-Type": "application/json" });
          response.end(JSON.stringify(receipt));
          return;
        }
        requireValue(request.method === "GET", "GET or recorder POST required");
        let bytes, type;
        if (pathname === "/__benchmark/config.json") {
          bytes = Buffer.from(
            JSON.stringify({
              engine: options.engine,
              trial: options.trial,
              contract: CONTRACT,
            }),
          );
          type = "application/json";
        } else if (pathname.startsWith("/__benchmark/")) {
          const name = pathname.slice("/__benchmark/".length);
          requireValue(
            ["client.mjs", "contract.mjs"].includes(name),
            "Unknown harness module",
          );
          bytes = harness.get(name);
          type = "text/javascript";
        } else {
          const key = pathname === "/" ? "/index.html" : pathname;
          bytes = key === "/index.html" ? index : input.get(key);
          requireValue(bytes, `Unpinned application input: ${key}`);
          type = mime[extname(key)] ?? "application/octet-stream";
          loaded.set(key, { bytes: bytes.length, sha256: sha256(bytes) });
        }
        response.writeHead(200, { "Content-Type": type });
        response.end(bytes);
      } catch (error) {
        failures.push({ url: request.url, error: error.message });
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: error.message }));
      }
    };
    const current = pending.then(operation);
    pending = current.catch((error) => {
      failures.push({ error: error.message });
      response.destroy(error);
    });
  });
  let report, error;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    report = await runVerifiedScene({
      runtimeRoot: lifecycle.runtimeRoot,
      scratchRoot: lifecycle.scratch,
      url: origin + "/",
      outputPath: resolve(options.outputRoot, "verified-runner.json"),
      screenshotPath: resolve(options.outputRoot, "final-page.png"),
      readyGlobal: READY_GLOBAL,
      viewport: CONTRACT.viewport,
      timeout: 900000,
    });
    requireValue(
      measurement && terminal && failures.length === 0,
      "Attempt lacks complete independent recorder evidence",
    );
  } catch (failure) {
    error = failure;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pending;
    await save("receipts.json", {
      schema: SCHEMA,
      receipts,
      failures,
      loadedInputs: Object.fromEntries(loaded),
    });
    await save("outcome.json", {
      schema: SCHEMA,
      status: error ? "failed" : "passed",
      finishedAt: new Date().toISOString(),
      browserStatus: report?.status ?? "failed",
      error: error?.stack ?? null,
      inputManifestSha256: sha256(
        await readFile(resolve(options.outputRoot, "inputs.json")),
      ),
      receiptManifestSha256: sha256(
        await readFile(resolve(options.outputRoot, "receipts.json")),
      ),
    });
  }
  if (error) throw error;
  return { report, measurement };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runAttempt(parseOptions(process.argv.slice(2)));
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
