import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { startApertureStaticServer } from "../../../packages/cli/dist/render/static-server.js";
import { runVerifiedScene } from "../../../scripts/verified-webgpu.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  repo = path.resolve(root, "../..");
const [framework, mode, retained] = process.argv.slice(2);
assert(
  ["aperture", "vgpu", "three"].includes(framework),
  "Expected aperture, vgpu or three",
);
const author = path.join(root, "authors", framework);
const result = JSON.parse(
  await fs.readFile(path.join(author, "result.json"), "utf8"),
);
assert(result.finishedAt, "Author trial must be frozen before reproduction");
const run = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const p = spawn(command, args, { cwd: repo, env, stdio: "inherit" });
    p.once("error", reject);
    p.once("close", (c) =>
      c === 0 ? resolve() : reject(new Error(`${command} exited ${c}`)),
    );
  });
if (mode !== "--inside") {
  const out = path.join(
    root,
    "evidence/reproductions",
    framework,
    new Date().toISOString().replaceAll(":", "-"),
  );
  await fs.mkdir(out, { recursive: true });
  // The trial's retained source is rebuilt; immutable trial captures are untouched.
  let configPath;
  for (const c of ["vite.config.mjs", "vite.config.ts", "vite.config.js"]) {
    try {
      await fs.access(path.join(author, c));
      configPath = path.join(author, c);
      break;
    } catch {}
  }
  assert(configPath, "Missing Vite config");
  await run(process.execPath, [
    path.join(repo, "node_modules/vite/bin/vite.js"),
    "build",
    author,
    "--config",
    configPath,
    "--outDir",
    path.join(author, "dist"),
    "--emptyOutDir",
  ]);
  await run(
    "python3",
    [
      "-B",
      "tools/recovery/runtime_pressure.py",
      "--root",
      "/workspace/shared/aperture-tmp",
      "--audit-dir",
      path.join(root, "evidence/audits"),
      "run",
      "--job",
      `garden-reproduce-${framework}`,
      "--recreation",
      `Rebuild frozen ${framework} garden`,
      "--",
      process.execPath,
      path.join(import.meta.dirname, "reproduce.mjs"),
      framework,
      "--inside",
      out,
    ],
    {
      ...process.env,
      APERTURE_WEBGPU_RUNTIME: path.join(repo, ".aperture-env/render-runtime"),
    },
  );
  console.log("Verified reproduction: " + out);
} else {
  assert(process.env.APERTURE_TMP_RUN, "Missing cleanup wrapper");
  assert(
    path.isAbsolute(retained) &&
      retained.startsWith(path.join(root, "evidence/reproductions") + path.sep),
    "Invalid retained path",
  );
  const server = await startApertureStaticServer({
    mounts: [{ prefix: "/", dir: path.join(author, "dist") }],
    index: await fs.readFile(path.join(author, "dist/index.html"), "utf8"),
  });
  try {
    const report = await runVerifiedScene({
      runtimeRoot: path.join(repo, ".aperture-env/render-runtime"),
      scratchRoot: process.env.APERTURE_TMP_RUN,
      url: server.url + "/",
      outputPath: path.join(retained, "report.json"),
      screenshotPath: path.join(retained, "render.png"),
      viewport: { width: 1200, height: 900 },
      timeout: 120000,
    });
    assert.equal(report.status, "passed", JSON.stringify(report));
  } finally {
    await server.close();
  }
}
