import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import {
  parseOptions,
  verifyLifecycle,
  readSourceTree,
  preserveInputs,
} from "./run.mjs";
import { CONTRACT, READY_GLOBAL, SCHEMA, requireValue } from "./contract.mjs";
import { sha256, writeImmutable } from "./recorder.mjs";
import { ARTIFACT_PROTOCOL_V2 } from "./protocol-v2.mjs";
import { createIndirectArgumentTrackerV2 } from "./indirect-args-v2.mjs";
import { installNativeObserverV2 } from "./native-observer-v2.mjs";
import { rewriteRetainedSegmentsV2 } from "./upload-segments-v2.mjs";
import { RecorderV2 } from "./recorder-v2.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
export const HARNESS_V2_FILES = [
  "client-v2.mjs",
  "indirect-args-v2.mjs",
  "triangle-accounting-v2.mjs",
  "protocol-v2.mjs",
  "geometry-codec-v2.mjs",
  "geometry-data-v2.mjs",
  "geometry-capture-v2.mjs",
  "position-parity-v2.mjs",
  "geometry-evidence-v2.mjs",
  "native-observer-v2.mjs",
  "upload-segments-v2.mjs",
  "recorder-v2.mjs",
  "run-v2.mjs",
  "contract.mjs",
  "native-observer.mjs",
  "recorder.mjs",
  "run.mjs",
  "README.md",
  "GEOMETRY_V2.md",
];
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

export function injectHarnessV2(html) {
  requireValue(/<head\b[^>]*>/i.test(html), "Application needs an HTML head");
  return html.replace(
    /<head\b[^>]*>/i,
    (head) =>
      `${head}\n<script>(${installNativeObserverV2.toString()})(${rewriteRetainedSegmentsV2.toString()}, ${JSON.stringify(
        {
          argumentWitnesses:
            ARTIFACT_PROTOCOL_V2.triangleAccounting.maxWitnesses,
          bytes: ARTIFACT_PROTOCOL_V2.limits.nativeBytes,
          buffers: ARTIFACT_PROTOCOL_V2.limits.nativeBuffers,
          segments: ARTIFACT_PROTOCOL_V2.limits.nativeSegments,
          perBuffer: ARTIFACT_PROTOCOL_V2.limits.nativeSegmentsPerBuffer,
        },
      )}, ${createIndirectArgumentTrackerV2.toString()});</script>\n<script type="module" src="/__benchmark/client-v2.mjs"></script>`,
  );
}

export async function runAttemptV2(options) {
  const lifecycle = await verifyLifecycle(),
    input = await readSourceTree(options.appRoot);
  requireValue(
    !resolve(options.outputRoot).startsWith(resolve(lifecycle.root) + sep),
    "Retained output must remain outside disposable scratch",
  );
  requireValue(
    !resolve(options.outputRoot).startsWith(resolve(options.appRoot) + sep) &&
      resolve(options.outputRoot) !== resolve(options.appRoot),
    "Output must remain outside input tree",
  );
  await mkdir(dirname(options.outputRoot), { recursive: true });
  await mkdir(options.outputRoot);
  const save = (name, value) =>
    writeImmutable(
      resolve(options.outputRoot, name),
      JSON.stringify(value, null, 2) + "\n",
    );
  const harness = new Map();
  for (const name of HARNESS_V2_FILES)
    harness.set(name, await readFile(resolve(directory, name)));
  const index = Buffer.from(
    injectHarnessV2(input.get("/index.html").toString("utf8")),
  );
  const retainedInputs = await preserveInputs(
    options.outputRoot,
    input,
    harness,
    index,
  );
  retainedInputs.reconstruction =
    "Serve frozen-app, replace its index with served-index.html, and serve frozen-harness modules under /__benchmark/. HTML injects the frozen observer-v2 plus retained-segment helper before application boot.";
  await save("inputs.json", {
    schema: SCHEMA,
    startedAt: new Date().toISOString(),
    engine: options.engine,
    trial: options.trial,
    artifactProtocol: ARTIFACT_PROTOCOL_V2,
    appRoot: options.appRoot,
    lifecycle: { root: lifecycle.root, run: lifecycle.run },
    contract: CONTRACT,
    retainedInputs,
    inputs: Object.fromEntries(
      [...input].map(([path, bytes]) => [
        path,
        { bytes: bytes.length, sha256: sha256(bytes) },
      ]),
    ),
    harness: Object.fromEntries(
      [...harness].map(([path, bytes]) => [
        path,
        { bytes: bytes.length, sha256: sha256(bytes) },
      ]),
    ),
  });
  const recorder = new RecorderV2(
      options.outputRoot,
      options.engine,
      options.trial,
    ),
    loaded = new Map();
  let origin,
    pending = Promise.resolve(),
    report,
    failure;
  const server = createServer((request, response) => {
    const operation = async () => {
      try {
        requireValue(
          request.headers.host === new URL(origin).host,
          "Unexpected loopback Host",
        );
        const path = decodeURIComponent((request.url ?? "").split("?", 1)[0]);
        requireValue(
          !path.includes("\\") &&
            !path.includes("\0") &&
            !path.split("/").some((part) => part === ".." || part === "."),
          "Invalid request path",
        );
        for (const [key, value] of Object.entries({
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        }))
          response.setHeader(key, value);
        if (request.method === "POST") {
          requireValue(
            request.headers.origin === origin &&
              path.startsWith("/__benchmark/record/"),
            "Same-origin recorder required",
          );
          const receipt = await recorder.record(
            path.slice("/__benchmark/record/".length),
            request,
          );
          response.writeHead(201, { "Content-Type": "application/json" });
          response.end(JSON.stringify(receipt));
          return;
        }
        requireValue(request.method === "GET", "GET or recorder POST required");
        let bytes, type;
        if (path === "/__benchmark/config.json") {
          bytes = Buffer.from(
            JSON.stringify({
              engine: options.engine,
              trial: options.trial,
              contract: CONTRACT,
              artifactProtocol: ARTIFACT_PROTOCOL_V2,
            }),
          );
          type = "application/json";
        } else if (path.startsWith("/__benchmark/")) {
          const name = path.slice("/__benchmark/".length);
          requireValue(
            HARNESS_V2_FILES.includes(name) && name.endsWith(".mjs"),
            "Unknown harness module",
          );
          bytes = harness.get(name);
          type = "text/javascript";
        } else {
          const key = path === "/" ? "/index.html" : path;
          bytes = key === "/index.html" ? index : input.get(key);
          requireValue(bytes, "Unpinned application input");
          type = mime[extname(key)] ?? "application/octet-stream";
          loaded.set(key, { bytes: bytes.length, sha256: sha256(bytes) });
        }
        response.writeHead(200, { "Content-Type": type });
        response.end(bytes);
      } catch (error) {
        recorder.failures.push({ url: request.url, error: error.message });
        if (!response.destroyed) {
          response.writeHead(400, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: error.message }));
        }
      }
    };
    const current = pending.then(operation);
    pending = current.catch((error) => {
      recorder.failures.push({ error: error.message });
      response.destroy(error);
    });
  });
  try {
    await new Promise((accept, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", accept);
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
      timeout: ARTIFACT_PROTOCOL_V2.verifierReadinessNavigationDeadlineMs,
    });
    await recorder.verifyMeasurementFile();
  } catch (error) {
    failure = error;
  } finally {
    await new Promise((accept) => server.close(accept));
    await pending;
    await save("receipts.json", {
      schema: SCHEMA,
      artifactProtocol: ARTIFACT_PROTOCOL_V2,
      receipts: recorder.receipts,
      failures: recorder.failures,
      attemptedBytes: recorder.attemptedBytes,
      successfulNumericBytes: recorder.successfulBytes,
      loadedInputs: Object.fromEntries(loaded),
    });
    await save("outcome.json", {
      schema: SCHEMA,
      artifactProtocol: ARTIFACT_PROTOCOL_V2,
      status: failure ? "failed" : "passed",
      finishedAt: new Date().toISOString(),
      browserStatus: report?.status ?? "failed",
      error: failure?.stack ?? null,
      inputManifestSha256: sha256(
        await readFile(resolve(options.outputRoot, "inputs.json")),
      ),
      receiptManifestSha256: sha256(
        await readFile(resolve(options.outputRoot, "receipts.json")),
      ),
    });
  }
  if (failure) throw failure;
  return { report, measurement: recorder.measurement };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runAttemptV2(parseOptions(process.argv.slice(2)));
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
