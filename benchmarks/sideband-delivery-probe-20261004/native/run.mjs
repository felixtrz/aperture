/** Native execution only. Never imported with a launch side effect; separate fresh permit required. */
import assert from "node:assert/strict";
import { readFile, realpath, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { runVerifiedScene } from "../../../scripts/verified-webgpu.mjs";
import {
  writeImmutable,
  readBoundedBody,
  inspectCanvasPng,
} from "../../indexed-shared-mesh-fanout-20261004/harness/recorder.mjs";
import { verifyNativeProof } from "../../indexed-shared-mesh-fanout-20261004/harness/base-checks.mjs";
import { here, repo, checkPins, sha256 } from "./inputs.mjs";
import { readServedModule } from "./routes.mjs";
import { validateState } from "./checks.mjs";
import { validateNativePermit } from "./permit.mjs";
import { SCHEMA, READY, SIZE, statesFor } from "./contract.mjs";
export async function runSession(session, attempt) {
  const states = statesFor(session);
  assert.match(attempt, /^attempt-\d{3}$/);
  const freeze = await checkPins();
  const parentArgv = (
    await readFile(`/proc/${process.ppid}/cmdline`, "utf8")
  ).split("\0");
  assert(
    parentArgv.some((arg) =>
      /(?:^|\/)tools\/recovery\/runtime_pressure\.py$/.test(arg),
    ),
    "Invoke directly under the adopted runtime_pressure.py wrapper",
  );
  const begin = JSON.parse(
    await readFile(process.env.APERTURE_SIDEBAND_BEGIN, "utf8"),
  );
  const spec = JSON.parse(
    await readFile(process.env.APERTURE_SIDEBAND_SPEC, "utf8"),
  );
  validateNativePermit(begin, spec, {
    session,
    attempt,
    pinsSha256: freeze.sha256,
    boot: (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim(),
  });
  const root = "/workspace/scratch/0190a8c72f8a/aperture-tmp",
    run = process.env.APERTURE_TMP_RUN_ID,
    scratch = process.env.APERTURE_TMP_RUN;
  assert.equal(process.env.APERTURE_TMP_ROOT, root);
  assert.match(run ?? "", /^run-[a-f0-9]{32}$/);
  assert.equal(await realpath(scratch), resolve(root, run));
  assert.equal(
    await realpath(`/proc/self/fd/${process.env.APERTURE_TMP_LOCK_FD}`),
    resolve(root, ".lifecycle.lock"),
  );
  const lifecycle = JSON.parse(
    await readFile(resolve(scratch, ".manifest.json"), "utf8"),
  );
  assert.equal(lifecycle.state, "active");
  assert.equal(lifecycle.run_id, run);
  assert.equal(
    await realpath(process.env.APERTURE_WEBGPU_RUNTIME),
    resolve(repo, freeze.pins.runtimeRoot),
  );
  const parent = resolve(here, "renders", session),
    output = resolve(parent, attempt);
  await mkdir(parent, { recursive: true });
  await mkdir(output);
  const save = (name, value) =>
    writeImmutable(
      resolve(output, name),
      JSON.stringify(value, null, 2) + "\n",
    );
  const loaded = new Map(),
    records = new Map(),
    received = new Map(),
    requestErrors = [];
  const names = states.flatMap(({ id }) => [id + ".json", id + ".png"]);
  let origin,
    report,
    failure,
    complete = false;
  const server = createServer(async (request, response) => {
    for (const [key, value] of Object.entries({
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    }))
      response.setHeader(key, value);
    let pathname, body;
    try {
      assert.equal(request.headers.host, new URL(origin).host);
      pathname = decodeURIComponent((request.url ?? "").split("?", 1)[0]);
      assert(
        !pathname.includes("\\") &&
          !pathname.includes("\0") &&
          !pathname.split("/").some((part) => part === "." || part === ".."),
      );
      if (request.method === "POST") {
        assert.equal(request.headers.origin, origin);
        assert(pathname.startsWith("/record/"));
        const name = pathname.slice(8);
        assert(
          names.includes(name) ||
            ["complete.json", "failure.json"].includes(name),
        );
        assert(!received.has(name));
        body = await readBoundedBody(
          request,
          name.endsWith(".png") ? 8 * 1024 * 1024 : 16 * 1024 * 1024,
        );
        if (name.endsWith(".png")) {
          assert(received.has(name.replace(/\.png$/, ".json")));
          inspectCanvasPng(body);
        } else {
          const value = JSON.parse(body);
          if (name === "complete.json") {
            assert(names.every((item) => received.has(item)));
            assert.equal(value.schema, SCHEMA);
            assert.equal(value.session, session);
            assert.deepEqual(value.states, states);
            assert.equal(value.snapshotNotifications, 1);
            assert.deepEqual(
              value.rendered,
              states.map(({ frame, mirrorVersion }) => ({
                frame,
                mirrorVersion,
              })),
            );
            assert.deepEqual(value.artifacts, [...received.values()]);
            verifyNativeProof(value.proof);
            complete = true;
          } else if (name !== "failure.json") {
            validateState(value, session, name.slice(0, -5));
            records.set(name, value);
          }
        }
        await writeImmutable(resolve(output, name), body);
        const receipt = { name, bytes: body.length, sha256: sha256(body) };
        received.set(name, receipt);
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end(JSON.stringify(receipt));
        return;
      }
      assert(["GET", "HEAD"].includes(request.method));
      if (pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      const actual = pathname === "/" ? "/index.html" : pathname;
      const module = await readServedModule(actual, session, freeze.pins);
      const prior = loaded.get(actual);
      assert(!prior || prior.servedSha256 === module.servedSha256);
      loaded.set(actual, { ...module, body: undefined });
      response.writeHead(200, {
        "Content-Type": actual.endsWith(".html")
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
      if (body || error.partialBody)
        await writeImmutable(
          resolve(output, "rejected-" + randomUUID() + ".bin"),
          body ?? error.partialBody,
        ).catch(() => {});
      if (!response.headersSent && !response.destroyed) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: error.message }));
      }
    }
  });
  await save("inputs.json", {
    schema: SCHEMA,
    session,
    attempt,
    run,
    states,
    sourcePinsSha256: freeze.sha256,
    begin,
    spec,
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
      url: origin + "/index.html",
      outputPath: resolve(output, "verified-runner.json"),
      screenshotPath: resolve(output, "final-page.png"),
      readyGlobal: READY,
      viewport: { width: SIZE, height: SIZE },
      timeout: 180000,
    });
    assert.equal(report.status, "passed");
    assert(complete);
    assert.equal(records.size, states.length);
    assert.equal(requestErrors.length, 0);
    assert(!received.has("failure.json"));
  } catch (error) {
    failure = error;
    await save("runner-failure.json", {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise((done) => server.close(done));
    let pinsUnchanged = false;
    try {
      assert.equal((await checkPins()).sha256, freeze.sha256);
      pinsUnchanged = true;
    } catch (error) {
      failure ??= error;
    }
    await save("loaded-inputs.json", Object.fromEntries(loaded));
    await save("outcome.json", {
      schema: SCHEMA,
      session,
      attempt,
      status: failure ? "failed" : "passed",
      sourcePinsSha256: freeze.sha256,
      sourcePinsUnchanged: pinsUnchanged,
      serverClosed: !server.listening,
      states: records.size,
      received: [...received.values()],
      requestErrors,
      nativeStatus: report?.status ?? null,
      error: failure?.message ?? null,
    });
  }
  if (failure) throw failure;
  return { status: "passed", session, attempt, output };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [session, attempt, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  console.log(JSON.stringify(await runSession(session, attempt)));
}
