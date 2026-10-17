import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { startApertureStaticServer } from "../../../packages/cli/dist/render/static-server.js";
import { runVerifiedScene } from "../../../scripts/verified-webgpu.mjs";

const repo = path.resolve(import.meta.dirname, "../../..");
const bench = path.resolve(import.meta.dirname, "..");
const [framework, label, mode] = process.argv.slice(2);
assert(["aperture", "vgpu", "three"].includes(framework), "Unknown framework");
assert(
  /^[a-z0-9-]+$/.test(label ?? ""),
  "Use a simple lowercase capture label",
);
const author = path.join(bench, "authors", framework);
const evidence = path.join(bench, "evidence", framework);
await fs.mkdir(evidence, { recursive: true });
const output = path.join(evidence, label);
const run = async (command, args, log, env = process.env) => {
  const handle = await fs.open(log, "w");
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: repo,
        env,
        stdio: ["ignore", handle.fd, handle.fd],
      });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
  } finally {
    await handle.close();
  }
};
if (mode === "--inside") {
  assert(process.env.APERTURE_TMP_RUN, "Missing lifecycle wrapper");
  const html = await fs.readFile(path.join(author, "dist/index.html"), "utf8");
  const server = await startApertureStaticServer({
    mounts: [{ prefix: "/", dir: path.join(author, "dist") }],
    index: html,
  });
  try {
    const report = await runVerifiedScene({
      runtimeRoot: path.join(repo, ".aperture-env/render-runtime"),
      scratchRoot: process.env.APERTURE_TMP_RUN,
      url: server.url + "/",
      outputPath: path.join(output, "report.json"),
      screenshotPath: path.join(output, "render.png"),
      viewport: { width: 1200, height: 900 },
      timeout: 120000,
    });
    assert.equal(report.status, "passed", JSON.stringify(report));
  } finally {
    await server.close();
  }
  process.exit(0);
}
const attempts = path.join(evidence, "attempts.jsonl");
let previous = "";
try {
  previous = await fs.readFile(attempts, "utf8");
} catch {}
assert(
  previous.trim().split("\n").filter(Boolean).length < 6,
  "Six capture attempts exhausted",
);
await fs.mkdir(output); // Labels are immutable; never overwrite an earlier render.
const record = {
  framework,
  label,
  startedAt: new Date().toISOString(),
  status: "started",
};
await fs.appendFile(attempts, JSON.stringify(record) + "\n");
const start = performance.now();
try {
  await fs.cp(author, path.join(output, "source"), {
    recursive: true,
    filter: (p) =>
      !p.split(path.sep).some((x) => x === "dist" || x === "node_modules"),
  });
  const config = ["vite.config.mjs", "vite.config.ts", "vite.config.js"].map(
    (x) => path.join(author, x),
  );
  let found;
  for (const p of config) {
    try {
      await fs.access(p);
      found = p;
      break;
    } catch {}
  }
  assert(found, "Provide a Vite config");
  const buildStart = performance.now();
  const buildCode = await run(
    process.execPath,
    [
      path.join(repo, "node_modules/vite/bin/vite.js"),
      "build",
      author,
      "--config",
      found,
      "--outDir",
      path.join(author, "dist"),
      "--emptyOutDir",
    ],
    path.join(output, "build.log"),
  );
  record.buildMs = performance.now() - buildStart;
  assert.equal(
    buildCode,
    0,
    "Vite build failed; inspect " + path.join(output, "build.log"),
  );
  const lock = path.join(bench, "evidence", ".capture-lock");
  const queuedAt = performance.now();
  let locked = false;
  while (!locked) {
    try {
      await fs.writeFile(lock, String(process.pid), { flag: "wx" });
      locked = true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        process.kill(Number(await fs.readFile(lock, "utf8")), 0);
      } catch {
        await fs.rm(lock, { force: true });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  record.queueMs = performance.now() - queuedAt;
  try {
    const renderStart = performance.now();
    const code = await run(
      "python3",
      [
        "-B",
        "tools/recovery/runtime_pressure.py",
        "--root",
        "/workspace/shared/aperture-tmp",
        "--audit-dir",
        path.join(bench, "evidence/audits"),
        "run",
        "--job",
        `garden-${framework}-${label}`,
        "--recreation",
        `Rebuild ${framework} Chinese garden from retained source`,
        "--",
        process.execPath,
        path.join(import.meta.dirname, "capture.mjs"),
        framework,
        label,
        "--inside",
      ],
      path.join(output, "capture.log"),
      {
        ...process.env,
        APERTURE_WEBGPU_RUNTIME: path.join(
          repo,
          ".aperture-env/render-runtime",
        ),
      },
    );
    record.renderAndCleanupMs = performance.now() - renderStart;
    assert.equal(
      code,
      0,
      "Verified capture failed; inspect " + path.join(output, "capture.log"),
    );
  } finally {
    await fs.rm(lock, { force: true });
  }
  record.status = "passed";
} catch (error) {
  record.status = "failed";
  record.error = String(error);
  process.exitCode = 1;
}
record.finishedAt = new Date().toISOString();
record.elapsedMs = performance.now() - start;
await fs.writeFile(
  path.join(output, "timing.json"),
  JSON.stringify(record, null, 2) + "\n",
);
console.log(JSON.stringify(record, null, 2));
