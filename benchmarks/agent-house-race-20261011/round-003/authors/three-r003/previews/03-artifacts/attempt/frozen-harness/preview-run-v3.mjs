import { PREVIEW_GEOMETRY_V3 } from "./preview-geometry-v3.mjs";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import { CONTRACT, READY_GLOBAL, requireValue } from "./contract.mjs";
import { PREVIEW_SCHEMA, PREVIEW_LIMITS } from "./preview-client-v3.mjs";
import {
  injectHarness,
  parseOptions,
  preserveInputs,
  readSourceTree,
  verifyLifecycle,
} from "./run.mjs";
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
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

export async function runPreview(options) {
  const lifecycle = await verifyLifecycle(),
    input = await readSourceTree(options.appRoot);
  requireValue(
    !resolve(options.outputRoot).startsWith(resolve(lifecycle.root) + sep) &&
      !resolve(options.outputRoot).startsWith(resolve(options.appRoot) + sep) &&
      resolve(options.outputRoot) !== resolve(options.appRoot),
    "Preview evidence must be retained outside scratch and app inputs",
  );
  await mkdir(dirname(options.outputRoot), { recursive: true });
  await mkdir(options.outputRoot);
  const save = (name, value) =>
    writeImmutable(
      resolve(options.outputRoot, name),
      JSON.stringify(value, null, 2) + "\n",
    );
  const harness = new Map();
  for (const name of [
    "preview-client-v3.mjs",
    "preview-run-v3.mjs",
    "preview-geometry-v3.mjs",
    "geometry-codec-v2.mjs",
    "contract.mjs",
    "native-observer.mjs",
    "recorder.mjs",
    "run.mjs",
  ])
    harness.set(name, await readFile(resolve(directory, name)));
  const index = Buffer.from(
    injectHarness(input.get("/index.html").toString("utf8")).replace(
      'src="/__benchmark/client.mjs"',
      'src="/__benchmark/preview-client-v3.mjs"',
    ),
  );
  const retainedInputs = await preserveInputs(
    options.outputRoot,
    input,
    harness,
    index,
  );
  await save("inputs.json", {
    schema: PREVIEW_SCHEMA,
    scope: "diagnostic-only-no-score",
    engine: options.engine,
    preview: options.trial,
    contract: CONTRACT,
    limits: PREVIEW_LIMITS,
    geometryPreflight: PREVIEW_GEOMETRY_V3,
    retainedInputs,
    lifecycle: { root: lifecycle.root, run: lifecycle.run },
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
  const receipts = [],
    failures = [];
  let origin,
    pending = Promise.resolve(),
    preview;
  const server = createServer((request, response) => {
    const operation = async () => {
      try {
        requireValue(
          request.headers.host === new URL(origin).host,
          "Preview loopback Host differs",
        );
        const pathname = decodeURIComponent(
          (request.url ?? "").split("?", 1)[0],
        );
        requireValue(
          !pathname.includes("\\") &&
            !pathname.includes("\0") &&
            !pathname.split("/").some((part) => part === ".." || part === "."),
          "Invalid preview request path",
        );
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (request.method === "POST") {
          requireValue(
            request.headers.origin === origin &&
              pathname.startsWith("/__benchmark/record/"),
            "Same-origin preview recorder required",
          );
          const name = pathname.slice("/__benchmark/record/".length),
            png = CONTRACT.views.some((view) => name === `${view.id}.png`);
          requireValue(
            (png ||
              [
                "preview.json",
                "failure.json",
                "geometry-preflight.json",
                "geometry-preflight-error.json",
              ].includes(name)) &&
              !receipts.some((receipt) => receipt.path === name),
            "Unknown/duplicate preview artifact",
          );
          const bytes = await readBoundedBody(
            request,
            name === "geometry-preflight.json"
              ? PREVIEW_GEOMETRY_V3.resultBytes
              : name === "geometry-preflight-error.json"
                ? PREVIEW_GEOMETRY_V3.errorBytes
                : 32 * 1024 * 1024,
          );
          requireValue(
            request.headers["content-type"] ===
              (png ? "image/png" : "application/json"),
            "Preview artifact content type differs",
          );
          await writeImmutable(resolve(options.outputRoot, name), bytes);
          let inspection;
          if (png) inspection = inspectPng(bytes, CONTRACT.viewport);
          if (name === "preview.json") {
            preview = JSON.parse(bytes.toString("utf8"));
            requireValue(
              preview.schema === PREVIEW_SCHEMA &&
                preview.engine === options.engine &&
                CONTRACT.views.every((view) =>
                  receipts.some((receipt) => receipt.path === `${view.id}.png`),
                ) &&
                preview.views.length === 3 &&
                preview.frames.length === 9 &&
                preview.geometryPreflight?.schema ===
                  PREVIEW_GEOMETRY_V3.schema &&
                preview.geometryPreflight.status === "passed" &&
                receipts.some(
                  (receipt) => receipt.path === "geometry-preflight.json",
                ) &&
                JSON.stringify(preview.contract) === JSON.stringify(CONTRACT),
              "Diagnostic preview camera/frame artifacts incomplete",
            );
          }
          const receipt = {
            ok: true,
            path: name,
            bytes: bytes.length,
            sha256: sha256(bytes),
            ...(inspection ? { inspection } : {}),
          };
          receipts.push(receipt);
          response.writeHead(201, { "Content-Type": "application/json" });
          response.end(JSON.stringify(receipt));
          return;
        }
        requireValue(
          request.method === "GET",
          "Preview requires GET or recorder POST",
        );
        let bytes, type;
        if (pathname === "/__benchmark/config.json") {
          bytes = Buffer.from(
            JSON.stringify({
              schema: PREVIEW_SCHEMA,
              engine: options.engine,
              preview: options.trial,
              contract: CONTRACT,
              limits: PREVIEW_LIMITS,
              geometryPreflight: PREVIEW_GEOMETRY_V3,
            }),
          );
          type = "application/json";
        } else if (pathname.startsWith("/__benchmark/")) {
          const name = pathname.slice("/__benchmark/".length);
          requireValue(
            [
              "preview-client-v3.mjs",
              "preview-geometry-v3.mjs",
              "geometry-codec-v2.mjs",
              "contract.mjs",
            ].includes(name),
            "Unpinned diagnostic harness module",
          );
          bytes = harness.get(name);
          type = "text/javascript";
        } else {
          const path = pathname === "/" ? "/index.html" : pathname;
          bytes = path === "/index.html" ? index : input.get(path);
          requireValue(bytes, `Unpinned preview input: ${path}`);
          type = mime[extname(path)] ?? "application/octet-stream";
        }
        response.writeHead(200, { "Content-Type": type });
        response.end(bytes);
      } catch (error) {
        failures.push({ url: request.url, error: error.message });
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: error.message }));
      }
    };
    pending = pending.then(operation).catch((error) => {
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
      timeout: 270000,
    });
    requireValue(
      preview && failures.length === 0,
      "Diagnostic preview has incomplete recorder evidence",
    );
  } catch (failure) {
    error = failure;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pending;
    await save("receipts.json", { schema: PREVIEW_SCHEMA, receipts, failures });
    await save("outcome.json", {
      schema: PREVIEW_SCHEMA,
      scope: "diagnostic-only-no-score",
      status: error ? "failed" : "passed",
      browserStatus: report?.status ?? "failed",
      error: error?.stack ?? null,
      finishedAt: new Date().toISOString(),
    });
  }
  if (error) throw error;
  return { report, preview };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runPreview(parseOptions(process.argv.slice(2)));
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
