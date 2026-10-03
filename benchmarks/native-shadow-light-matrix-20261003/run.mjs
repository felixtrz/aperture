import { createServer } from "node:http";
import { readFile, mkdir, realpath, writeFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import {
  createExamplesRequestHandler,
  resolveWorkerModulePath,
  rewriteWorkerModuleImports,
} from "../../scripts/serve-examples.mjs";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import { STATES, MODES, SIZE } from "./fixture.mjs";
import { VARIANTS, requireValue, validateRecord } from "./checks.mjs";

const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function resolveFixtureModulePath(pathname) {
  // The canonical examples server intentionally excludes benchmark roots.
  // Only this frozen local fixture adds them; every resolved file must be pinned.
  return (
    resolveWorkerModulePath(pathname, repo) ??
    (pathname.startsWith("/worker-modules/benchmarks/")
      ? resolve(repo, pathname.slice("/worker-modules/".length))
      : null)
  );
}
export async function checkPins() {
  const pins = JSON.parse(
    await readFile(resolve(directory, "source-pins.json"), "utf8"),
  );
  for (const [path, expected] of Object.entries(pins.files))
    requireValue(
      hash(await readFile(resolve(repo, path))) === expected.sha256,
      `Frozen input differs: ${path}`,
    );
  return pins;
}
export function selection(mode, variant, attempt) {
  requireValue(
    MODES.includes(mode) &&
      VARIANTS.includes(variant) &&
      /^attempt-[0-9]{3}$/.test(attempt),
    "Usage: node run.mjs <directional|cascaded|spot|point> <live|fresh-baseline|fresh-vertices|fresh-indices> <attempt-NNN>",
  );
  return variant === "live"
    ? STATES
    : [
        {
          id: variant.slice(6),
          shape: variant.slice(6),
          version: 1,
          reuse: false,
        },
      ];
}
export async function runAttempt(mode, variant, attempt) {
  const states = selection(mode, variant, attempt),
    pins = await checkPins();
  const sourcePinsSha256 = hash(
    await readFile(resolve(directory, "source-pins.json")),
  );
  let sourcePinsUnchanged = false;
  const root = process.env.APERTURE_TMP_ROOT,
    run = process.env.APERTURE_TMP_RUN_ID,
    scratch = process.env.APERTURE_TMP_RUN,
    fd = process.env.APERTURE_TMP_LOCK_FD;
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
    "Wrong lifecycle lock or scratch",
  );
  const lifecycle = JSON.parse(
    await readFile(resolve(scratch, ".manifest.json"), "utf8"),
  );
  requireValue(
    lifecycle.schema === "aperture.disposable-run.v2" &&
      lifecycle.state === "active" &&
      lifecycle.run_id === run,
    "Active lifecycle manifest required",
  );
  requireValue(
    process.env.APERTURE_WEBGPU_RUNTIME?.startsWith("/"),
    "Pinned native runtime is required",
  );
  const parent = resolve(directory, "renders", mode, variant),
    output = resolve(parent, attempt);
  await mkdir(parent, { recursive: true });
  await mkdir(output); // Existing attempts are immutable, including failures.
  const save = (name, value) =>
    writeFile(resolve(output, name), JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
    });
  const receipts = [],
    loaded = new Map(),
    requestErrors = [];
  const expected = states
    .flatMap((state) => [`${state.id}.json`, `${state.id}.png`])
    .concat("complete.json");
  const fallback = createExamplesRequestHandler(repo);
  let origin,
    report,
    failure,
    previous = null,
    pending = Promise.resolve();
  const server = createServer((request, response) => {
    const operation = async () => {
      response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      let pathname;
      try {
        requireValue(
          request.headers.host === new URL(origin).host,
          "Wrong loopback Host",
        );
        pathname = decodeURIComponent((request.url ?? "").split("?")[0]);
        requireValue(
          !pathname.includes("\\") &&
            !pathname.includes("\0") &&
            !pathname.split("/").some((part) => part === ".." || part === "."),
          "Invalid path",
        );
        if (request.method === "POST") {
          requireValue(
            request.headers.origin === origin &&
              pathname.startsWith("/record/"),
            "Same-origin recorder only",
          );
          const name = pathname.slice(8);
          requireValue(
            name === "failure.json" || name === expected[receipts.length],
            "Unexpected/duplicate/out-of-order artifact",
          );
          const chunks = [];
          let length = 0;
          for await (const chunk of request) {
            length += chunk.length;
            requireValue(length <= 16 * 1024 * 1024, "Artifact too large");
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks);
          await writeFile(resolve(output, name), body, { flag: "wx" });
          const png = name.endsWith(".png");
          requireValue(
            request.headers["content-type"] ===
              (png ? "image/png" : "application/json"),
            "Wrong content type",
          );
          if (png)
            requireValue(
              body
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
                body.readUInt32BE(16) === SIZE &&
                body.readUInt32BE(20) === SIZE,
              "Expected native 512-square PNG",
            );
          else if (!["failure.json", "complete.json"].includes(name)) {
            const record = JSON.parse(body),
              state = states[receipts.length / 2];
            requireValue(
              record.mode === mode && record.variant === variant,
              "Recorder selection mismatch",
            );
            // Preserve first; browser also captures the failing state before asserting.
            // Independently enforce after its PNG arrives, retaining both artifacts.
            previous = { record, state, prior: previous?.record ?? null };
          } else if (name === "complete.json")
            requireValue(
              JSON.parse(body).states === states.length,
              "Incomplete state count",
            );
          const receipt = {
            path: name,
            bytes: body.length,
            sha256: hash(body),
          };
          receipts.push(receipt);
          response.writeHead(201, { "Content-Type": "application/json" });
          response.end(JSON.stringify(receipt));
          if (png) {
            try {
              validateRecord(previous.record, previous.state, previous.prior);
            } catch (error) {
              requestErrors.push({
                pathname,
                message: error.message,
                phase: "independent-native-record-validation",
              });
            }
          }
          return;
        }
        requireValue(
          request.method === "GET" || request.method === "HEAD",
          "Unsupported method",
        );
        if (pathname === "/favicon.ico") {
          response.writeHead(204);
          response.end();
          return;
        }
        const target = resolveFixtureModulePath(pathname);
        requireValue(target, "Only rewritten local modules are served");
        const actual = await realpath(target),
          path = relative(repo, actual);
        // node_modules symlinks resolve within the checkout; pin actual targets.
        requireValue(pins.files[path], `Unpinned served module: ${path}`);
        const bytes = await readFile(actual);
        requireValue(
          hash(bytes) === pins.files[path].sha256,
          `Served input changed: ${path}`,
        );
        loaded.set(path, { sha256: hash(bytes), bytes: bytes.length });
        if (pathname.startsWith("/worker-modules/benchmarks/")) {
          const body =
            actual.endsWith(".mjs") || actual.endsWith(".js")
              ? rewriteWorkerModuleImports(bytes.toString("utf8"))
              : bytes;
          response.writeHead(200, {
            "Content-Type": actual.endsWith(".html")
              ? "text/html; charset=utf-8"
              : "text/javascript; charset=utf-8",
          });
          response.end(request.method === "HEAD" ? undefined : body);
        } else await fallback(request, response);
      } catch (error) {
        requestErrors.push({ pathname, message: error.message });
        if (!response.headersSent) {
          response.writeHead(400, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: error.message }));
        }
      }
    };
    // Serialize record writes while permitting module fetches independently.
    if (request.method === "POST") pending = pending.then(operation);
    else void operation();
  });
  await save("inputs.json", {
    mode,
    variant,
    attempt,
    sourcePinsSha256,
    engineSourceCommit: pins.engineSourceCommit,
    scope: pins.scope,
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    const url = `${origin}/worker-modules/${relative(repo, directory)}/index.html?mode=${mode}&variant=${variant}`;
    report = await runVerifiedScene({
      runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
      scratchRoot: scratch,
      url,
      outputPath: resolve(output, "verified-runner.json"),
      screenshotPath: resolve(output, "final-page.png"),
      viewport: { width: SIZE, height: SIZE },
      timeout: 180000,
    });
    await pending;
    requireValue(
      report.status === "passed" &&
        receipts.length === expected.length &&
        receipts.every((receipt, index) => receipt.path === expected[index]),
      "Incomplete native recording",
    );
    requireValue(
      requestErrors.length === 0,
      "Independent recorder/HTTP validation failed",
    );
  } catch (error) {
    failure = error;
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await pending;
    try {
      requireValue(
        hash(await readFile(resolve(directory, "source-pins.json"))) ===
          sourcePinsSha256,
        "Source pin manifest changed during attempt",
      );
      await checkPins();
      sourcePinsUnchanged = true;
    } catch (error) {
      failure ??= error;
    }
    await save("receipts.json", receipts);
    await save("loaded-inputs.json", Object.fromEntries(loaded));
    await save("outcome.json", {
      status: failure ? "failed" : "passed",
      mode,
      variant,
      attempt,
      error: failure?.message ?? null,
      requestErrors,
      nativeStatus: report?.status ?? null,
      sourcePinsUnchanged,
      serverClosed: !server.listening,
    });
  }
  if (failure) throw failure;
  return { status: "passed", mode, variant, attempt, output };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length === 3 && process.argv[2] === "--check-inputs")
    console.log(
      JSON.stringify({
        status: "passed",
        pinnedFiles: Object.keys((await checkPins()).files).length,
        browserLaunched: false,
      }),
    );
  else {
    try {
      console.log(JSON.stringify(await runAttempt(...process.argv.slice(2))));
    } catch (error) {
      console.error(error.stack);
      process.exitCode = 1;
    }
  }
}
