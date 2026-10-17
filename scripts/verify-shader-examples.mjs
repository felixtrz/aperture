#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { readFile, mkdir } from "node:fs/promises";
import { startApertureStaticServer } from "../packages/cli/dist/render/static-server.js";
import { runVerifiedScene } from "./verified-webgpu.mjs";
const root = path.resolve(import.meta.dirname, "..");
const output = process.env.APERTURE_GPU_EVIDENCE;
assert.ok(
  output && process.env.APERTURE_TMP_RUN,
  "Use the cleanup wrapper and set APERTURE_GPU_EVIDENCE.",
);
await mkdir(output, { recursive: true });
const probe = `<script type="module">
const wait=async(predicate)=>{const deadline=performance.now()+90000;while(!predicate()){if(performance.now()>deadline)throw new Error('Example readiness deadline exceeded');await new Promise(requestAnimationFrame);}};
try {
 await wait(()=>globalThis.__APERTURE_GENERATED_APP__?.snapshots>=5);
 const status=globalThis.__APERTURE_GENERATED_APP__,before=status.snapshots;
 for(const [id,value] of [['amplitude','0.35'],['cutout','0.2']]) {const input=document.querySelector('#'+id);input.value=value;input.dispatchEvent(new Event('input'));}
 document.querySelector('#pause').click();
 await wait(()=>status.forwardedCommandEvents>=3 && status.snapshots>=before+5 && status.diagnostics?.lastFrame?.ok===true);
 if(!status.webgpuOk || status.lastFailure || status.lastError) throw new Error(JSON.stringify(status));
 globalThis.__APERTURE_RENDER_STATUS__={ok:true,status:status.status,snapshots:status.snapshots,forwardedCommandEvents:status.forwardedCommandEvents,diagnostics:status.diagnostics};
} catch(error) {globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(error)};}
</script>`;
for (const example of ["shader-workbench", "material-shaders"]) {
  const dir = path.join(root, ".aperture-env", example);
  let html = await readFile(path.join(dir, "index.html"), "utf8");
  if (example === "material-shaders")
    html = html.replace("</body>", probe + "</body>");
  const server = await startApertureStaticServer({
    mounts: [{ prefix: "/", dir }],
    index: html,
  });
  try {
    const report = await runVerifiedScene({
      runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
      scratchRoot: process.env.APERTURE_TMP_RUN,
      url: server.url + "/?verify",
      outputPath: path.join(output, example + ".json"),
      screenshotPath: path.join(output, example + ".png"),
      viewport: { width: 1000, height: 700 },
    });
    assert.equal(report.status, "passed", JSON.stringify(report));
    console.log(
      JSON.stringify({
        example,
        status: report.status,
        scene: {
          ok: report.sceneStatus?.ok,
          modes: report.sceneStatus?.modes,
          snapshots: report.sceneStatus?.snapshots,
          forwardedCommandEvents: report.sceneStatus?.forwardedCommandEvents,
        },
      }),
    );
  } finally {
    await server.close();
  }
}
