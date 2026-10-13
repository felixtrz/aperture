import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import { verifyLifecycle, readSourceTree } from "./run.mjs";
import {
  inspectPng,
  readBoundedBody,
  sha256,
  writeImmutable,
} from "./recorder.mjs";

const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};

export async function runManualControl(fixtureRoot, outputRoot) {
  requireValue(
    isAbsolute(fixtureRoot) && isAbsolute(outputRoot),
    "Fixture/evidence paths must be absolute",
  );
  const lifecycle = await verifyLifecycle();
  requireValue(
    !outputRoot.startsWith(fixtureRoot + sep) &&
      !outputRoot.startsWith(lifecycle.root + sep),
    "New native evidence must be outside frozen inputs and scratch",
  );
  const provenanceBytes = await readFile(
      resolve(fixtureRoot, "provenance.json"),
    ),
    provenance = JSON.parse(provenanceBytes),
    input = await readSourceTree(resolve(fixtureRoot, "dist"));
  requireValue(
    provenance.schema === "aperture.native-manual-browser-control.inputs.v1",
    "Unknown fixture input schema",
  );
  requireValue(
    input.size === Object.keys(provenance.build).length,
    "Frozen build inventory differs",
  );
  for (const [path, bytes] of input) {
    const expected = provenance.build[path.slice(1)];
    requireValue(
      expected?.sha256 === sha256(bytes) && expected.bytes === bytes.length,
      "Frozen build bytes differ",
    );
  }
  const observerBytes = await readFile(
    resolve(fixtureRoot, "harness/native-observer.mjs"),
  );
  requireValue(
    sha256(observerBytes) === provenance.harness["native-observer.mjs"].sha256,
    "Frozen native observer differs",
  );
  const { installNativeObserver } = await import(
    pathToFileURL(resolve(fixtureRoot, "harness/native-observer.mjs"))
  );
  const observerScript = `(${installNativeObserver.toString()})();\n`;
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  await writeImmutable(
    resolve(outputRoot, "fixture-provenance.json"),
    provenanceBytes,
  );
  const save = (name, value) =>
    writeImmutable(
      resolve(outputRoot, name),
      JSON.stringify(value, null, 2) + "\n",
    );
  const variants = [];
  for (const variant of provenance.variants) {
    const variantRoot = resolve(outputRoot, variant);
    await mkdir(variantRoot);
    const receipts = [],
      failures = [];
    let origin,
      pending = Promise.resolve(),
      validation;
    const server = createServer((request, response) => {
      const operation = async () => {
        try {
          requireValue(
            request.headers.host === new URL(origin).host,
            "Trusted loopback Host differs",
          );
          const path = decodeURIComponent((request.url ?? "").split("?", 1)[0]);
          requireValue(
            !path.includes("\\") &&
              !path.includes("\0") &&
              !path.split("/").some((part) => part === ".." || part === "."),
            "Invalid fixture path",
          );
          if (variant === "shared-array-buffer") {
            response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          }
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("X-Content-Type-Options", "nosniff");
          if (request.method === "POST") {
            requireValue(
              request.headers.origin === origin &&
                path.startsWith("/__fixture/record/"),
              "Same-origin fixture recorder required",
            );
            const name = path.slice("/__fixture/record/".length),
              png = ["baseline.png", "unchanged.png", "updated.png"].includes(
                name,
              );
            requireValue(
              (png || ["validation.json", "failure.json"].includes(name)) &&
                !receipts.some((receipt) => receipt.path === name),
              "Unexpected/duplicate fixture record",
            );
            const bytes = await readBoundedBody(request, 32 * 1024 * 1024);
            requireValue(
              request.headers["content-type"] ===
                (png ? "image/png" : "application/json"),
              "Fixture artifact content type differs",
            );
            const inspection = png
              ? inspectPng(bytes, provenance.viewport)
              : null;
            await writeImmutable(resolve(variantRoot, name), bytes);
            const receipt = {
              ok: true,
              path: name,
              bytes: bytes.length,
              sha256: sha256(bytes),
              ...(inspection ? { inspection } : {}),
            };
            if (name === "validation.json") {
              validation = JSON.parse(bytes);
              requireValue(
                validation.ok === true &&
                  validation.transport === variant &&
                  validation.frames.length === 3 &&
                  receipts.filter((entry) => entry.path.endsWith(".png"))
                    .length === 3,
                "Native control validation incomplete",
              );
            }
            receipts.push(receipt);
            response.writeHead(201, { "Content-Type": "application/json" });
            response.end(JSON.stringify(receipt));
            return;
          }
          requireValue(
            request.method === "GET",
            "Fixture requires GET or recorder POST",
          );
          let bytes, type;
          if (path === "/__fixture/observer.js") {
            bytes = Buffer.from(observerScript);
            type = "text/javascript";
          } else {
            const key = path === "/" ? "/index.html" : path;
            bytes = input.get(key);
            requireValue(bytes, "Unpinned fixture resource");
            if (key === "/index.html")
              bytes = Buffer.from(
                bytes
                  .toString()
                  .replace(
                    "<head>",
                    '<head><script src="/__fixture/observer.js"></script>',
                  ),
              );
            type =
              {
                ".html": "text/html",
                ".js": "text/javascript",
                ".map": "application/json",
                ".wasm": "application/wasm",
              }[extname(key)] ?? "application/octet-stream";
          }
          response.writeHead(200, { "Content-Type": type });
          response.end(bytes);
        } catch (error) {
          failures.push({ url: request.url, error: error.message });
          response.writeHead(400);
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
      await new Promise((yes, no) => {
        server.once("error", no);
        server.listen(0, "127.0.0.1", yes);
      });
      origin = `http://127.0.0.1:${server.address().port}`;
      report = await runVerifiedScene({
        runtimeRoot: lifecycle.runtimeRoot,
        scratchRoot: lifecycle.scratch,
        url: `${origin}/?transport=${variant}`,
        viewport: provenance.viewport,
        outputPath: resolve(variantRoot, "verified-runner.json"),
        screenshotPath: resolve(variantRoot, "final-page.png"),
        readyGlobal: "__MANUAL_CONTROL_STATUS__",
        timeout: 240_000,
      });
      requireValue(
        validation && failures.length === 0,
        "Fixture native recorder evidence incomplete",
      );
    } catch (failure) {
      error = failure;
    } finally {
      await new Promise((yes) => server.close(yes));
      await pending;
      await writeImmutable(
        resolve(variantRoot, "receipts.json"),
        JSON.stringify({ receipts, failures }, null, 2) + "\n",
      );
      await writeImmutable(
        resolve(variantRoot, "outcome.json"),
        JSON.stringify(
          {
            status: error ? "failed" : "passed",
            error: error?.stack ?? null,
            nativeStatus: report?.status ?? "failed",
          },
          null,
          2,
        ) + "\n",
      );
    }
    variants.push({ variant, status: error ? "failed" : "passed" });
    if (error) throw error;
  }
  await save("summary.json", {
    schema: "aperture.native-manual-browser-control.v1",
    status: "passed",
    lifecycleRun: lifecycle.run,
    fixtureProvenanceSha256: sha256(provenanceBytes),
    variants,
  });
  return variants;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(await runManualControl(process.argv[2], process.argv[3])),
    );
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
