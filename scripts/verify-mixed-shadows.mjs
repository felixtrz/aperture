import { resolve, join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { runVerifiedScene } from "./verified-webgpu.mjs";
import { resolveEnginePackages } from "../packages/cli/dist/render/resolve-engine-packages.js";
import { startApertureStaticServer } from "../packages/cli/dist/render/static-server.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  engine = resolveEnginePackages();
const output = process.argv[2];
if (!output || !isAbsolute(output))
  throw Error("Provide an absolute retained output directory");
if (!process.env.APERTURE_TMP_RUN || !process.env.APERTURE_WEBGPU_RUNTIME)
  throw Error(
    "Run in the cleanup lifecycle with APERTURE_TMP_RUN and APERTURE_WEBGPU_RUNTIME",
  );
await mkdir(output, { recursive: true });
const generated = spawnSync(
  process.execPath,
  [
    join(root, "scripts/fixtures/mixed-shadows/generate.mjs"),
    join(output, "fixture-data.json"),
  ],
  { cwd: root, stdio: "inherit" },
);
if (generated.status !== 0) throw Error("Fixture generation failed");
const html = `<!doctype html><html><head><style>body{margin:0;background:#181818;color:white;font:16px sans-serif}#results{display:grid;grid-template-columns:repeat(3,400px)}.tile{position:relative}.tile canvas{width:400px;height:300px;display:block}.tile span{position:absolute;top:5px;left:5px;background:#111c;padding:4px}</style><script type="importmap">${JSON.stringify({ imports: engine.importMap })}</script><script type="module" src="/proof/browser.mjs"></script></head><body><canvas id="aperture-canvas" width="800" height="600"></canvas><div id="results"></div></body></html>`;
let server;
try {
  server = await startApertureStaticServer({
    mounts: [
      ...engine.mounts,
      { prefix: "/fixture/", dir: output },
      { prefix: "/proof/", dir: join(root, "scripts/fixtures/mixed-shadows") },
    ],
    index: html,
  });

  const report = await runVerifiedScene({
    runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
    url: server.url,
    scratchRoot: process.env.APERTURE_TMP_RUN,
    outputPath: join(output, "runtime.json"),
    screenshotPath: join(output, "comparison.png"),
    viewport: { width: 1200, height: 2400 },
    timeout: 120000,
  });
  console.log(
    JSON.stringify({
      status: report.status,
      sceneStatus: report.sceneStatus?.ok,
      differences: report.sceneStatus?.differences,
    }),
  );
} finally {
  await server?.close();
}
