import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import { verifyLifecycle } from "./run.mjs";
import { sha256, writeImmutable } from "./recorder.mjs";
import {
  WORLD_NORMAL_CASES,
  validateNormalReadback,
} from "./world-normal-cases.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function normalProbeHtml(helper) {
  const inputs = WORLD_NORMAL_CASES.flatMap((entry) => [
    ...entry.world,
    ...entry.normal,
    0,
    ...entry.tangent,
    1,
  ]);
  const computeSource = `
struct Case { world: mat4x4f, normal: vec4f, tangent: vec4f, };
struct Result { normal: vec4f, tangent: vec4f, };
@group(0) @binding(0) var<storage,read> cases: array<Case>;
@group(0) @binding(1) var<storage,read_write> results: array<Result>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3u) {
  if(id.x >= arrayLength(&cases)) { return; }
  let item=cases[id.x];
  let normal=apertureTransformWorldNormal(item.world,item.normal.xyz);
  let tangent=apertureOrthogonalTangent(normal,apertureTransformWorldTangent(item.world,item.tangent.xyz));
  results[id.x].normal=vec4f(normal,apertureWorldOrientation(item.world));
  results[id.x].tangent=vec4f(tangent,0.0);
}`;
  const displaySource = `
struct Result { normal: vec4f, tangent: vec4f, };
@group(0) @binding(0) var<storage,read> results:array<Result>;
@vertex fn vs(@builtin(vertex_index) id:u32)->@builtin(position) vec4f {
  let p=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));
  return vec4f(p[id],0.0,1.0);
}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
  let i=min(u32(p.x/1024.0*f32(arrayLength(&results))),arrayLength(&results)-1u);
  return vec4f(results[i].normal.xyz*0.5+vec3f(0.5),1.0);
}`;
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Native normal transform numeric regression</title></head><body style="margin:0"><canvas id="probe" width="1024" height="768"></canvas><script type="module">
const helper = ${JSON.stringify(helper)};
const values = new Float32Array(${JSON.stringify(inputs)});
try {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvas = document.getElementById('probe'), context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({device, format, alphaMode:'opaque'});
  const input = device.createBuffer({label:'normal-case-input',size:values.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(input,0,values);
  const size = ${WORLD_NORMAL_CASES.length}*32;
  const output = device.createBuffer({label:'normal-case-output',size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const readback = device.createBuffer({label:'normal-case-readback',size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const compute = device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code:helper+${JSON.stringify(computeSource)}})}});
  const computeGroup=device.createBindGroup({layout:compute.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}}]});
  const display=device.createShaderModule({code:${JSON.stringify(displaySource)}});
  const pipeline=device.createRenderPipeline({layout:'auto',vertex:{module:display,entryPoint:'vs'},fragment:{module:display,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
  const displayGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:output}}]});
  const encoder=device.createCommandEncoder();
  const computePass=encoder.beginComputePass();computePass.setPipeline(compute);computePass.setBindGroup(0,computeGroup);computePass.dispatchWorkgroups(${WORLD_NORMAL_CASES.length});computePass.end();
  const renderPass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0.1,g:0.2,b:0.3,a:1}}]});
  renderPass.setPipeline(pipeline);renderPass.setBindGroup(0,displayGroup);renderPass.draw(3);renderPass.end();
  encoder.copyBufferToBuffer(output,0,readback,0,size);device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();await readback.mapAsync(GPUMapMode.READ);
  const nativeReadback=Array.from(new Float32Array(readback.getMappedRange()).slice());readback.unmap();
  globalThis.__NORMAL_PROBE_STATUS__={ok:true,kind:'native-WGSL-compute-readback',nativeReadback};
} catch(error) { globalThis.__NORMAL_PROBE_STATUS__={ok:false,error:String(error)}; }
</script></body></html>`;
}

export async function runNormalProbe(outputRoot) {
  if (!isAbsolute(outputRoot))
    throw new Error("Normal probe output must be absolute");
  const lifecycle = await verifyLifecycle();
  const helperFile = resolve(
    repo,
    "packages/webgpu/dist/materials/world-normal-transform.js",
  );
  const helperBytes = await readFile(helperFile);
  const { WORLD_NORMAL_TRANSFORM_WGSL } = await import(helperFile);
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  const html = normalProbeHtml(WORLD_NORMAL_TRANSFORM_WGSL);
  await writeImmutable(resolve(outputRoot, "scene.html"), html);
  await writeImmutable(
    resolve(outputRoot, "world-normal-transform.js"),
    helperBytes,
  );
  await writeImmutable(
    resolve(outputRoot, "cases.json"),
    JSON.stringify(WORLD_NORMAL_CASES, null, 2) + "\n",
  );
  await writeImmutable(
    resolve(outputRoot, "inputs.json"),
    JSON.stringify(
      {
        schema: "aperture.native-normal-probe.v1",
        helperSha256: sha256(helperBytes),
        sceneSha256: sha256(Buffer.from(html)),
        lifecycleRun: lifecycle.run,
      },
      null,
      2,
    ) + "\n",
  );
  const server = createServer((request, response) => {
    if (request.url !== "/") {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    });
    response.end(html);
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const report = await runVerifiedScene({
      runtimeRoot: lifecycle.runtimeRoot,
      scratchRoot: lifecycle.scratch,
      url: `http://127.0.0.1:${server.address().port}/`,
      outputPath: resolve(outputRoot, "verified-runner.json"),
      screenshotPath: resolve(outputRoot, "normal-cases.png"),
      readyGlobal: "__NORMAL_PROBE_STATUS__",
      viewport: { width: 1024, height: 768 },
    });
    const cases = validateNormalReadback(report.sceneStatus.nativeReadback);
    await writeImmutable(
      resolve(outputRoot, "numeric-validation.json"),
      JSON.stringify(
        { schema: "aperture.native-normal-probe.v1", status: "passed", cases },
        null,
        2,
      ) + "\n",
    );
    return cases;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runNormalProbe(process.argv[2]);
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
