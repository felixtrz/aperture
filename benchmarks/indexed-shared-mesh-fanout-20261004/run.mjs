/** Native entry point, never invoked by CPU preparation. Separate admission required. */
import { createServer } from "node:http";
import { readFile, realpath, mkdir, readlink } from "node:fs/promises";
import { resolve, dirname, relative, sep, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  resolveWorkerModulePath,
  rewriteWorkerModuleImports,
} from "../../scripts/serve-examples.mjs";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import {
  statesFor,
  SESSION_IDS,
  SCHEMA,
  ENGINE_SOURCE,
  ENGINE_VERSION,
  BUDGETS,
  READY_GLOBAL,
  LIMITS,
} from "./contract.mjs";
import { requireValue } from "./harness/checks.mjs";
import {
  createRecorder,
  writeImmutable,
  sha256,
  readBoundedBody,
} from "./harness/recorder.mjs";
const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../..");
const within = (root, path) => path === root || path.startsWith(root + sep);
export function selection(engine, session, attempt) {
  requireValue(
    engine === "aperture" &&
      SESSION_IDS.includes(session) &&
      attempt === "attempt-001",
    "Expected aperture, admitted session, immutable attempt-NNN",
  );
  return statesFor(session);
}
export function sessionContract(source, session) {
  requireValue(SESSION_IDS.includes(session), "Unknown session");
  const seam = 'export const SESSION_ID = "live";';
  requireValue(
    source.split(seam).length === 2,
    "Session contract seam changed",
  );
  return source.replace(
    seam,
    `export const SESSION_ID = ${JSON.stringify(session)};`,
  );
}
export function resolveModule(pathname) {
  requireValue(
    typeof pathname === "string" &&
      !pathname.includes("\\") &&
      !pathname.includes("\0") &&
      !pathname.split("/").some((part) => part === ".." || part === "."),
    "Forbidden static path",
  );
  if (pathname.startsWith("/worker-modules/"))
    return resolveWorkerModulePath(pathname, repo);
  if (["/three.core.js", "/three.webgpu.js"].includes(pathname))
    return resolve(repo, "shadow-lab/src/compare", pathname.slice(1));
  if (
    [
      "/contract.mjs",
      "/semantics.mjs",
      "/topology.mjs",
      "/native-observer.mjs",
      "/indirect-evidence.mjs",
      "/shader-contract.mjs",
      "/fanout-checks.mjs",
    ].includes(pathname) ||
    ["/author-a/", "/author-b/", "/harness/"].some((prefix) =>
      pathname.startsWith(prefix),
    )
  ) {
    const target = resolve(directory, pathname.slice(1));
    requireValue(
      within(directory, target) &&
        [".mjs", ".js", ".html"].includes(extname(target)),
      "Forbidden fixture path",
    );
    return target;
  }
  return null;
}
export async function checkPins() {
  const raw = await readFile(resolve(directory, "source-pins.json"));
  const pins = JSON.parse(raw);
  requireValue(
    pins.schema === SCHEMA + ".inputs" &&
      pins.status === "frozen-reviewed" &&
      pins.engineSourceCommit === ENGINE_SOURCE &&
      pins.engineVersion === ENGINE_VERSION,
    "Wrong source/dependency provenance",
  );
  for (const [name, expected] of Object.entries(pins.runtimeSymlinks ?? {}))
    requireValue(
      (await readlink(resolve(repo, name))) === expected,
      "Frozen runtime link differs: " + name,
    );
  for (const [name, expected] of Object.entries(pins.files)) {
    const path = resolve(repo, name);
    requireValue(within(repo, path), "Pin escapes repository");
    const bytes = await readFile(path);
    requireValue(
      bytes.length === expected.bytes && sha256(bytes) === expected.sha256,
      `Frozen input differs: ${name}`,
    );
  }
  return { pins, sha256: sha256(raw) };
}
export async function readServedModule(pathname, session, pins) {
  const target = resolveModule(pathname);
  requireValue(target, "Unknown module route");
  const actual = await realpath(target),
    name = relative(repo, actual),
    pin = pins.files[name];
  requireValue(pin, "Unpinned served module: " + name);
  const raw = await readFile(actual);
  requireValue(
    raw.length === pin.bytes && sha256(raw) === pin.sha256,
    "Served input changed: " + name,
  );
  let body = raw;
  if (pathname === "/harness/contract.mjs")
    body = Buffer.from(sessionContract(raw.toString("utf8"), session));
  else if (
    pathname.startsWith("/worker-modules/") &&
    [".js", ".mjs"].includes(extname(actual))
  )
    body = Buffer.from(rewriteWorkerModuleImports(raw.toString("utf8")));
  return {
    name,
    body,
    inputSha256: pin.sha256,
    servedSha256: sha256(body),
    bytes: body.length,
    transformation:
      pathname === "/harness/contract.mjs"
        ? "one pinned session literal"
        : pathname.startsWith("/worker-modules/")
          ? "canonical import rewrites"
          : "none",
  };
}
export async function runAttempt(engine, session, attempt) {
  const states = selection(engine, session, attempt),
    freeze = await checkPins();
  const root = process.env.APERTURE_TMP_ROOT,
    run = process.env.APERTURE_TMP_RUN_ID,
    scratch = process.env.APERTURE_TMP_RUN,
    fd = process.env.APERTURE_TMP_LOCK_FD;
  requireValue(
    root === "/workspace/scratch/0190a8c72f8a/aperture-tmp" &&
      /^run-[a-f0-9]{32}$/.test(run ?? "") &&
      /^\d+$/.test(fd ?? "") &&
      process.env.APERTURE_WEBGPU_RUNTIME?.startsWith("/"),
    "Adopted runtime_pressure lifecycle required",
  );
  requireValue(
    (await realpath(`/proc/self/fd/${fd}`)) ===
      resolve(root, ".lifecycle.lock") &&
      (await realpath(scratch)) === resolve(root, run),
    "Inherited lifecycle root/lock mismatch",
  );
  const lifecycle = JSON.parse(
    await readFile(resolve(scratch, ".manifest.json"), "utf8"),
  );
  requireValue(
    lifecycle.schema === "aperture.disposable-run.v2" &&
      lifecycle.run_id === run &&
      lifecycle.state === "active",
    "Active lifecycle required",
  );
  requireValue(
    (await realpath(process.env.APERTURE_WEBGPU_RUNTIME)) ===
      resolve(repo, freeze.pins.runtimeRoot),
    "Runtime root differs from exact frozen installed dependency bytes",
  );
  const parent = resolve(directory, "renders", engine, session),
    output = resolve(parent, attempt);
  await mkdir(parent, { recursive: true });
  await mkdir(output); // Never overwrite a failed attempt.
  const save = (name, value) =>
    writeImmutable(
      resolve(output, name),
      JSON.stringify(value, null, 2) + "\n",
    );
  const recorder = await createRecorder(output, { engine, states }),
    loaded = new Map(),
    requestErrors = [];
  let origin, report, failure;
  const server = createServer(async (request, response) => {
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
      pathname = decodeURIComponent((request.url ?? "").split("?", 1)[0]);
      requireValue(
        !pathname.includes("\\") &&
          !pathname.includes("\0") &&
          !pathname.split("/").some((part) => part === ".." || part === "."),
        "Forbidden path",
      );
      if (request.method === "POST") {
        requireValue(
          request.headers.origin === origin && pathname.startsWith("/record/"),
          "Only same-origin artifact POST",
        );
        const name = pathname.slice(8),
          bytes = await readBoundedBody(
            request,
            name.endsWith(".png") ? LIMITS.pngBytes : LIMITS.jsonBytes,
          );
        const receipt = await recorder.record(
          name,
          bytes,
          String(request.headers["content-type"] ?? ""),
        );
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end(JSON.stringify(receipt));
        return;
      }
      requireValue(
        ["GET", "HEAD"].includes(request.method),
        "Unsupported method",
      );
      if (pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      const module = await readServedModule(pathname, session, freeze.pins);
      const prior = loaded.get(pathname);
      requireValue(
        !prior || prior.servedSha256 === module.servedSha256,
        "Served bytes changed",
      );
      loaded.set(pathname, { ...module, body: undefined });
      response.writeHead(200, {
        "Content-Type": pathname.endsWith(".html")
          ? "text/html; charset=utf-8"
          : "text/javascript; charset=utf-8",
        "Content-Length": module.body.length,
      });
      response.end(request.method === "HEAD" ? undefined : module.body);
    } catch (error) {
      requestErrors.push({
        pathname,
        method: request.method,
        message: error.message,
      });
      if (error.partialBody)
        await recorder
          .preserveRejection(pathname, error.partialBody, error)
          .catch(() => {});
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: error.message }));
      }
    }
  });
  await save("inputs.json", {
    schema: SCHEMA,
    engine,
    session,
    attempt,
    sourcePinsSha256: freeze.sha256,
    engineSourceCommit: ENGINE_SOURCE,
    states,
    budgets: BUDGETS,
    scope: "new indexed shared-mesh exploratory regression; no score",
    sessionContract: sessionContract(
      await readFile(resolve(directory, "harness/contract.mjs"), "utf8"),
      session,
    ),
  });
  try {
    await new Promise((accept, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", accept);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    report = await runVerifiedScene({
      runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
      scratchRoot: scratch,
      url: `${origin}/${engine === "aperture" ? "author-a" : "author-b"}/index.html`,
      outputPath: resolve(output, "verified-runner.json"),
      screenshotPath: resolve(output, "final-page.png"),
      readyGlobal: READY_GLOBAL,
      viewport: { width: 1024, height: 1024 },
      timeout:
        session === "live" ? BUDGETS.liveTimeoutMs : BUDGETS.freshTimeoutMs,
    });
    requireValue(
      report.status === "passed" &&
        recorder.summary().complete &&
        recorder.summary().states === states.length &&
        recorder.summary().acknowledged.length === states.length * 2 + 1,
      "Incomplete native artifacts",
    );
    requireValue(
      requestErrors.length === 0,
      "Independent recorder/HTTP errors",
    );
  } catch (error) {
    failure = error;
    await save("runner-failure.json", {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise((done) => server.close(done));
    await recorder.flush();
    let sourcePinsUnchanged = false;
    try {
      const after = await checkPins();
      requireValue(after.sha256 === freeze.sha256, "Frozen manifest changed");
      sourcePinsUnchanged = true;
    } catch (error) {
      failure ??= error;
    }
    await save("recorder-summary.json", recorder.summary());
    await save("loaded-inputs.json", Object.fromEntries(loaded));
    await save("outcome.json", {
      schema: SCHEMA,
      status: failure ? "failed" : "passed",
      engine,
      session,
      attempt,
      states: recorder.summary().states,
      sourcePinsSha256: freeze.sha256,
      sourcePinsUnchanged,
      serverClosed: !server.listening,
      error: failure?.message ?? null,
      requestErrors,
      nativeStatus: report?.status ?? null,
    });
  }
  if (failure) throw failure;
  return {
    status: "passed",
    engine,
    session,
    attempt,
    states: states.length,
    output,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [engine, session, attempt, ...extra] = process.argv.slice(2);
  requireValue(extra.length === 0, "Unexpected arguments");
  console.log(JSON.stringify(await runAttempt(engine, session, attempt)));
}
