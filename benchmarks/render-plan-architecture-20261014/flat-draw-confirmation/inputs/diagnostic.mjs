import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  chmod,
  writeFile,
} from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

const directory = dirname(fileURLToPath(import.meta.url));
const commonDirectory = resolve(directory, "../typed-render-plan-benchmark-001");
const repository = resolve(directory, "../../../..");
const harnessRoot = resolve(repository, "tools/agent-benchmark");
const { HARNESS_V2_FILES, injectHarnessV2 } = await import(
  pathToFileURL(resolve(harnessRoot, "run-v2.mjs"))
);
const { verifyLifecycle, readSourceTree } = await import(
  pathToFileURL(resolve(harnessRoot, "run.mjs"))
);
const { runVerifiedScene } = await import(
  pathToFileURL(resolve(repository, "scripts/verified-webgpu.mjs"))
);
const { readBoundedBody, inspectPng } = await import(
  pathToFileURL(resolve(harnessRoot, "recorder.mjs"))
);
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const save = (path, value) =>
  writeFile(
    path,
    typeof value === "string" || Buffer.isBuffer(value) ? value : json(value),
    { flag: "wx", mode: 0o600 },
  );
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
const APERTURE_KEYS = ["aperture-fixed-storage-fresnel", "aperture-flat-draw-constants"];
const KEYS = ["three-baseline", ...APERTURE_KEYS];
const SCHEMA = "aperture.typed-render-plan-diagnostic.v2";
const parse = async (path) => JSON.parse(await readFile(path, "utf8"));

async function inventory(root) {
  const files = {};
  async function visit(path) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const absolute = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        files[relative(root, absolute).split(sep).join("/")] = {
          bytes: bytes.length,
          sha256: hash(bytes),
        };
      } else
        throw new Error(
          "Frozen diagnostic input must contain regular files only",
        );
    }
  }
  await visit(root);
  return files;
}

async function seal(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) await seal(path);
    else await chmod(path, 0o444);
  }
  await chmod(root, 0o555);
}

async function verifyInventory(root, expected) {
  requireValue(
    JSON.stringify(await inventory(root)) === JSON.stringify(expected),
    `Frozen source/dependency/build inventory differs: ${root}`,
  );
}

async function verifyPreparedPair(pairRoot, engine) {
  const [canonical, provenance, workload, productionParity, buildInputs] =
    await Promise.all([
      parse(resolve(pairRoot, "canonical-manifest.json")),
      parse(resolve(pairRoot, "provenance.json")),
      readFile(resolve(pairRoot, "workload.json")),
      parse(resolve(pairRoot, "production-buffer-parity.json")),
      parse(resolve(pairRoot, engine, "build-inputs.json")),
    ]);
  requireValue(
    canonical.variant === "baseline" &&
      canonical.workloadSha256 === hash(workload) &&
      provenance.canonical.workloadSha256 === canonical.workloadSha256 &&
      productionParity.status === "passed",
    "Controlled canonical input or production geometry parity differs",
  );
  const descriptor = provenance.adapters[engine];
  requireValue(
    descriptor?.canonicalWorkloadSha256 === canonical.workloadSha256 &&
      buildInputs.engine === engine,
    "Prepared engine provenance differs",
  );
  await verifyInventory(
    resolve(pairRoot, engine, "source"),
    descriptor.sourceInventory,
  );
  await verifyInventory(resolve(pairRoot, engine, "dist"), buildInputs.build);
  for (const entry of Object.values(buildInputs.resolvedInputs)) {
    const bytes = await readFile(
      resolve(pairRoot, engine, "resolved-inputs", entry.copy),
    );
    requireValue(
      bytes.length === entry.bytes && hash(bytes) === entry.sha256,
      "Exact retained engine dependency source differs",
    );
  }
  requireValue(
    (await readFile(resolve(pairRoot, engine, "source/workload.json"))).equals(
      workload,
    ),
    "Adapter workload differs from shared canonical input",
  );
  const specification = JSON.parse(workload);
  requireValue(
    specification.settings.pixelRatio === 1 &&
      specification.settings.sampleCount === 4 &&
      specification.settings.tonemap === "aces" &&
      specification.settings.exposure === 1 &&
      specification.settings.shadow.reuse ===
        "static-light-and-casters-reuse-after-first-frame" &&
      !specification.settings.effects.ssao &&
      !specification.settings.effects.bloom,
    "Controlled rendering recipe differs",
  );
  return {
    canonical,
    source: descriptor.sourceInventory,
    productionParity,
    dependencyInputs: Object.keys(buildInputs.resolvedInputs).length,
  };
}

export async function freezePlan(declarationPath) {
  const decl=await parse(declarationPath);requireValue(decl.sourceStableAuthorized===true,"Root source-stable authorization required");
  const output=resolve(decl.outputRoot);await mkdir(output);const frozen=resolve(output,"frozen");await mkdir(frozen);
  const mode=decl.mode??"comparison",warmupFrames=decl.warmupFrames??(mode==="smoke"?1:5),measuredFrames=decl.measuredFrames??(mode==="smoke"?1:12);
  requireValue(mode==="smoke"||mode==="comparison","Explicit smoke/comparison mode required");requireValue(Number.isInteger(warmupFrames)&&warmupFrames>=1&&Number.isInteger(measuredFrames)&&measuredFrames>=1,"Positive integer sample counts required");
  const keys=Object.keys(decl.inputs);if(mode==="comparison")requireValue(JSON.stringify([...keys].sort())===JSON.stringify([...KEYS].sort()),"Three finalized Three/parent/candidate roles required");else requireValue(keys.length>=1&&keys.every(key=>KEYS.includes(key)),"Declared smoke roles required");
  const inputs={},expectedShaders={},sourceBuilds={};let canonical;
  for(const key of keys){const entry=decl.inputs[key];requireValue(isAbsolute(entry.pairRoot)&&entry.engine===(key==="three-baseline"?"three":"aperture"),"Absolute declared input root and engine required");const verified=await verifyPreparedPair(entry.pairRoot,entry.engine);if(canonical)requireValue(canonical.workloadSha256===verified.canonical.workloadSha256&&canonical.settingsSha256===verified.canonical.settingsSha256,"Canonical numeric inputs differ");else canonical=verified.canonical;const root=resolve(frozen,key);await mkdir(root);for(const name of ["workload.json","canonical-manifest.json","production-buffer-parity.json","provenance.json",entry.engine])await cp(resolve(entry.pairRoot,name),resolve(root,name),{recursive:true,force:false,errorOnExist:true});inputs[key]={engine:entry.engine,originalPairRoot:entry.pairRoot,root,appRoot:resolve(root,entry.engine,"dist"),inventory:await inventory(root),canonical:verified.canonical,dependencyInputs:verified.dependencyInputs,expectedTransport:entry.expectedTransport??null,requiresExplicitLayout:entry.requiresExplicitLayout??false};if(entry.sourceBuildPath){const raw=await readFile(entry.sourceBuildPath);sourceBuilds[key]={path:entry.sourceBuildPath,bytes:raw.length,sha256:hash(raw)};}if(entry.expectedShaderPath){const raw=await readFile(entry.expectedShaderPath),path=resolve(frozen,key+"-expected.wgsl");await save(path,raw);expectedShaders[key]={path,bytes:raw.length,sha256:hash(raw),code:raw.toString("utf8")};}else if(mode==="comparison"&&entry.engine==="aperture")requireValue(false,"Comparison requires independent finalized canonical WGSL source for every Aperture role");}
  const harness=resolve(frozen,"harness");await mkdir(harness);for(const name of HARNESS_V2_FILES)await cp(resolve(harnessRoot,name),resolve(harness,name),{force:false,errorOnExist:true});const geometry=resolve(harness,"geometry-capture-v2.mjs"),original=await readFile(geometry,"utf8");requireValue(original.includes("capturedAfterFrame: 179,"),"Held geometry metadata changed");await writeFile(geometry,original.replace("capturedAfterFrame: 179,",`capturedAfterFrame: ${warmupFrames+measuredFrames-1},`));
  await cp(resolve(commonDirectory,"client-v2.mjs"),resolve(frozen,"client.mjs"));await cp(resolve(commonDirectory,"shader-classes.mjs"),resolve(frozen,"shader-classes.mjs"));await cp(resolve(commonDirectory,"native-bindings-v2.mjs"),resolve(frozen,"native-bindings.mjs"));
  const capturePath=resolve(directory,"../../proposals/three-shader-capture-002/native-shader-activation.mjs"),captureOriginal=await readFile(capturePath,"utf8");let capture=captureOriginal.replace("id,\n              deviceId,\n              ...observed,","id,\n              nativeObjectId:globalThis.__ARCHITECTURE_BINDINGS__.identify(pipeline),\n              deviceId,\n              ...observed,");requireValue(capture!==captureOriginal,"Exact synchronous pipeline capture seam changed");await save(resolve(frozen,"native-shader-activation.mjs"),capture);const {nativeShaderActivationPrelude}=await import(pathToFileURL(resolve(frozen,"native-shader-activation.mjs")));const {architectureBindingsPrelude}=await import(pathToFileURL(resolve(frozen,"native-bindings.mjs")));const prelude=architectureBindingsPrelude({maxRecords:4096})+nativeShaderActivationPrelude({maxCodeBytes:16*1024*1024,maxTextureRecords:4096,maxViewRecords:8192,maxPassRecords:1024});await save(resolve(frozen,"activation-prelude.js"),prelude);
  const runtimeInputs={};for(const path of [...new Set(["scripts/verified-webgpu.mjs","scripts/local-webgpu.mjs","tools/agent-benchmark/run.mjs","tools/agent-benchmark/run-v2.mjs","tools/agent-benchmark/lifecycle-roots.mjs","tools/agent-benchmark/recorder.mjs","tools/recovery/runtime_pressure.py","tools/recovery/cleanup.py",...HARNESS_V2_FILES.map(name=>"tools/agent-benchmark/"+name)])]){const raw=await readFile(resolve(repository,path));runtimeInputs[path]={bytes:raw.length,sha256:hash(raw)};}
  const nativeRuntimeRoot=resolve(repository,".aperture-env/render-runtime"),nativeRuntimePackages={};for(const [name,version]of [["playwright-core","1.60.0"],["@sparticuz/chromium","153.0.0"]]){const root=resolve(nativeRuntimeRoot,"node_modules",name);requireValue((await parse(resolve(root,"package.json"))).version===version,"Approved native runtime version differs");nativeRuntimePackages[name]={root,version,inventory:await inventory(root)};}
  const views=[{id:"canonical",position:[14,9,19]},{id:"left-orbit",position:[-19,10,15]},{id:"rear-orbit",position:[14,10,-19]}].slice(0,3).map(view=>({...canonical.settings.camera,...view}));const ordinaryReferences={};for(const engine of new Set(Object.values(inputs).map(v=>v.engine))){const root=resolve(frozen,"ordinary-reference",engine);await mkdir(root,{recursive:true});ordinaryReferences[engine]={};for(const view of views){const source=resolve(decl.ordinaryReferences[engine],view.id+".png"),target=resolve(root,view.id+".png");await cp(source,target);const raw=await readFile(target);ordinaryReferences[engine][view.id]={path:target,bytes:raw.length,sha256:hash(raw),originalPath:source};}}
  requireValue(Array.isArray(decl.blocks)&&decl.blocks.length===6&&new Set(decl.blocks.map(v=>v.join("|"))).size===6&&decl.blocks.every(v=>JSON.stringify([...v].sort())===JSON.stringify([...KEYS].sort())),"Exactly all six permutations required");const orderKeys=decl.blocks.flat();const order=orderKeys.map((variant,index)=>({ordinal:index+1,block:Math.floor(index/KEYS.length)+1,variant,engine:inputs[variant].engine,attemptRoot:resolve(output,"attempts",`${String(index+1).padStart(2,"0")}-${variant}`)}));
  const plan={schema:SCHEMA,mode,preparedAt:new Date().toISOString(),outputDirectory:output,scope:mode==="smoke"?"Fresh native WGSL/layout/binding smoke; no speed inference":"Longer six-block confirmation using all Three/parent/candidate permutations; exact committed candidate; causal diagnostic, not new author round",inputs,sourceBuilds,order,warmupFrames,measuredFrames,views,viewport:{width:1024,height:768},ordinaryReferences,nativeRuntimeRoot,nativeRuntimePackages,runtimeInputs,shaderExpected:expectedShaders,sourceDeclaration:{path:declarationPath,sha256:hash(await readFile(declarationPath))},frozenHarness:{root:harness,inventory:await inventory(harness)},client:{path:resolve(frozen,"client.mjs"),sha256:hash(await readFile(resolve(frozen,"client.mjs")))},helper:{path:fileURLToPath(import.meta.url),sha256:hash(await readFile(fileURLToPath(import.meta.url)))},activation:{path:resolve(frozen,"activation-prelude.js"),sha256:hash(Buffer.from(prelude)),modulePath:resolve(frozen,"native-shader-activation.mjs"),moduleSha256:hash(await readFile(resolve(frozen,"native-shader-activation.mjs")))},bindingObserver:{path:resolve(frozen,"native-bindings.mjs"),sha256:hash(await readFile(resolve(frozen,"native-bindings.mjs")))},classification:{modulePath:resolve(frozen,"shader-classes.mjs"),moduleSha256:hash(await readFile(resolve(frozen,"shader-classes.mjs"))),canvasFormats:["bgra8unorm","rgba8unorm"]},stableFrameCriterion:{fields:["submissions","drawCalls","submittedTriangles","renderPasses","computePasses"],newPipelinesTexturesBuffers:0},timing:"Serial SwiftShader software-native elapsed submission/fence timing, not physical GPU timestamps",benefitGate:{reference:"three-baseline",minimumQueueReduction:0.10,allSixBlocks:true,noEndToEndMedianRegressionAgainst:["three-baseline","aperture-fixed-storage-fresnel"],improvementGreaterThanReferenceBlockRange:true},nativeInstrumentation:"Common passive exact shader/module/pipeline/pass/draw and native layout/bindgroup/resource-object/range identities; no descriptor/Promise/flag/feature changes"};await seal(frozen);const path=resolve(output,"plan.json");await save(path,plan);await chmod(path,0o444);return {planPath:path,planSha256:hash(await readFile(path)),attempts:order.length};
}

async function loadPlan(planPath, expectedHash) {
  requireValue(
    isAbsolute(planPath) && /^[a-f0-9]{64}$/.test(expectedHash ?? ""),
    "Absolute plan and exact SHA256 required",
  );
  const bytes = await readFile(planPath),
    plan = JSON.parse(bytes);
  requireValue(
    hash(bytes) === expectedHash && plan.schema === SCHEMA,
    "Frozen plan hash/schema differs",
  );
  requireValue(
    hash(await readFile(plan.helper.path)) === plan.helper.sha256,
    "Diagnostic helper changed after freeze",
  );
  for (const [path, expected] of Object.entries(plan.runtimeInputs)) {
    const bytes = await readFile(resolve(repository, path));
    requireValue(
      bytes.length === expected.bytes && hash(bytes) === expected.sha256,
      "Approved runtime/helper input changed after freeze",
    );
  }
  requireValue(
    hash(await readFile(plan.client.path)) === plan.client.sha256,
    "Frozen diagnostic client changed",
  );
  for(const [path,sha256] of [[plan.activation.path,plan.activation.sha256],[plan.activation.modulePath,plan.activation.moduleSha256],[plan.classification.modulePath,plan.classification.moduleSha256],[plan.sourceDeclaration.path,plan.sourceDeclaration.sha256]])requireValue(hash(await readFile(path))===sha256,"Frozen shader instrumentation/source declaration changed");
  for(const pin of Object.values(plan.shaderExpected)){const bytes=await readFile(pin.path);requireValue(bytes.length===pin.bytes&&hash(bytes)===pin.sha256,"Expected shader changed");}
  requireValue(hash(await readFile(plan.bindingObserver.path))===plan.bindingObserver.sha256,"Frozen native binding observer changed");
  for(const pin of Object.values(plan.sourceBuilds)){const bytes=await readFile(pin.path);requireValue(bytes.length===pin.bytes&&hash(bytes)===pin.sha256,"Finalized SDK source-build changed");}
  await verifyInventory(plan.frozenHarness.root, plan.frozenHarness.inventory);
  return plan;
}

async function hostSnapshot() {
  return {
    at: new Date().toISOString(),
    loadavg: await readFile("/proc/loadavg", "utf8"),
    cpu: await readFile("/proc/stat", "utf8"),
    memory: await readFile("/proc/meminfo", "utf8"),
  };
}

export async function runAttempt(planPath, expectedHash, ordinal) {
  const plan = await loadPlan(planPath, expectedHash),
    entry = plan.order.find((item) => item.ordinal === ordinal);
  requireValue(entry, "Predeclared attempt ordinal missing");
  for (const earlier of plan.order.filter((item) => item.ordinal < ordinal)) {
    const outcome = await parse(resolve(earlier.attemptRoot, "outcome.json"));
    requireValue(
      outcome.status === "passed" && outcome.nativeStatus === "passed",
      "Earlier declared attempt did not close passed; preserve failure and reconcile before changing the plan",
    );
  }
  const lifecycle = await verifyLifecycle(),
    input = plan.inputs[entry.variant];
  requireValue(
    lifecycle.runtimeRoot === plan.nativeRuntimeRoot,
    "Frozen approved browser runtime root differs",
  );
  for (const descriptor of Object.values(plan.nativeRuntimePackages))
    await verifyInventory(descriptor.root, descriptor.inventory);
  await verifyInventory(input.root, input.inventory);
  requireValue(
    !entry.attemptRoot.startsWith(lifecycle.root + sep),
    "Retained diagnostics must remain outside scratch",
  );
  await mkdir(dirname(entry.attemptRoot), { recursive: true });
  await mkdir(entry.attemptRoot);
  await save(resolve(entry.attemptRoot, "plan-receipt.json"), {
    planPath,
    planSha256: expectedHash,
    entry,
    lifecycle: { root: lifecycle.root, run: lifecycle.run },
  });
  await save(
    resolve(entry.attemptRoot, "host-before.json"),
    await hostSnapshot(),
  );
  const app = await readSourceTree(input.appRoot),
    harness = await readSourceTreeModules(plan.frozenHarness.root);
  // Use the established observer injection byte-for-byte; replace only the
  // official120-frame client entry with this predeclared diagnostic client.
  const originalIndex = app.get("/index.html").toString("utf8");
  let injected = injectHarnessV2(originalIndex).replace(
    '<script type="module" src="/__benchmark/client-v2.mjs"></script>',
    '<script type="module" src="/__diagnostic/client.mjs"></script>',
  );
  requireValue(
    !injected.includes('src="/__benchmark/client-v2.mjs"'),
    "Official client injection not replaced",
  );
  const prelude=await readFile(plan.activation.path,"utf8");requireValue(!prelude.includes("</script>"),"Activation prelude closes script");
  injected=injected.replace(/<head\b[^>]*>/i,head=>head+"\n<script>"+prelude+"</script>\n");
  await save(resolve(entry.attemptRoot, "served-index.html"), injected);
  const config = {
    schema: SCHEMA,
    ...entry,
    planSha256: expectedHash,
    warmupFrames: plan.warmupFrames,
    measuredFrames: plan.measuredFrames,
    views: plan.views,
    classification:plan.classification,
    shaderExpected:plan.shaderExpected[entry.variant]??null,
    expectedTransport:input.expectedTransport,
    requiresExplicitLayout:input.requiresExplicitLayout,
    mode:plan.mode,
  };
  const receipts = [],
    failures = [];
  let origin,
    pending = Promise.resolve(),
    measurement,
    report,
    failure,
    totalBytes = 0;
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".map": "application/json",
    ".json": "application/json",
    ".wasm": "application/wasm",
  };
  const server = createServer((request, response) => {
    const operation = async () => {
      try {
        requireValue(
          request.headers.host === new URL(origin).host,
          "Unexpected trusted loopback Host",
        );
        const path = decodeURIComponent((request.url ?? "").split("?", 1)[0]);
        requireValue(
          !path.includes("\\") &&
            !path.includes("\0") &&
            !path.split("/").some((part) => part === ".." || part === "."),
          "Invalid diagnostic path",
        );
        for (const [key, value] of Object.entries({
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        }))
          response.setHeader(key, value);
        if (request.method === "POST") {
          requireValue(
            request.headers.origin === origin &&
              path.startsWith("/__diagnostic/record/"),
            "Same-origin diagnostic recorder required",
          );
          const name = path.slice("/__diagnostic/record/".length);
          requireValue(
            /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) &&
              !receipts.some((receipt) => receipt.path === name),
            "Invalid or duplicate artifact",
          );
          const bytes = await readBoundedBody(request, 32 * 1024 * 1024);
          totalBytes += bytes.length;
          requireValue(
            totalBytes <= 128 * 1024 * 1024,
            "Diagnostic artifact budget exceeded",
          );
          const png = name.endsWith(".png");
          if (png) inspectPng(bytes, plan.viewport);
          await save(resolve(entry.attemptRoot, name), bytes);
          if (name === "measurement.json") measurement = JSON.parse(bytes);
          const receipt = {
            ok: true,
            path: name,
            bytes: bytes.length,
            sha256: hash(bytes),
          };
          receipts.push(receipt);
          response.writeHead(201, { "Content-Type": "application/json" });
          response.end(JSON.stringify(receipt));
          return;
        }
        requireValue(request.method === "GET", "GET or recorder POST required");
        let bytes, type;
        if (path === "/__diagnostic/config.json") {
          bytes = Buffer.from(json(config));
          type = "application/json";
        } else if (path === "/__diagnostic/client.mjs") {
          bytes = await readFile(plan.client.path);
          type = "text/javascript";
        } else if(path==="/__diagnostic/shader-classes.mjs"){
          bytes=await readFile(plan.classification.modulePath);type="text/javascript";
        } else if (path.startsWith("/__diagnostic/harness/")) {
          bytes = harness.get(path.slice("/__diagnostic/harness".length));
          type = "text/javascript";
        } else {
          const key = path === "/" ? "/index.html" : path;
          bytes = key === "/index.html" ? Buffer.from(injected) : app.get(key);
          type = types[extname(key)] ?? "application/octet-stream";
        }
        requireValue(bytes, "Unpinned diagnostic resource");
        response.writeHead(200, { "Content-Type": type });
        response.end(bytes);
      } catch (error) {
        failures.push({ url: request.url, error: error.message });
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(json({ error: error.message }));
      }
    };
    const current = pending.then(operation);
    pending = current.catch((error) => {
      failures.push({ error: error.message });
      response.destroy(error);
    });
  });
  try {
    await new Promise((yes, no) => {
      server.once("error", no);
      server.listen(0, "127.0.0.1", yes);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    report = await runVerifiedScene({
      runtimeRoot: lifecycle.runtimeRoot,
      scratchRoot: lifecycle.scratch,
      url: origin + "/",
      outputPath: resolve(entry.attemptRoot, "verified-runner.json"),
      screenshotPath: resolve(entry.attemptRoot, "final-page.png"),
      readyGlobal: "__GPU_SLOWNESS_STATUS__",
      viewport: plan.viewport,
      timeout: 240000,
    });
    requireValue(
      measurement?.variant === entry.variant &&
        measurement.planSha256 === expectedHash &&
        measurement.samples?.length === plan.measuredFrames &&
        measurement.warmup?.length === plan.warmupFrames &&
        measurement.views?.length === plan.views.length &&
        failures.length === 0,
      "Diagnostic numeric/image capture incomplete",
    );
    requireValue(measurement.activationWitness?.status==="passed","Actual submitted HDR/canvas native shader activation unavailable");
    const expectedDraws=entry.engine==="aperture"?12:13;
    requireValue(measurement.samples.every(sample=>sample.drawCalls===expectedDraws&&sample.renderPasses===2&&sample.submittedTriangles===25725&&sample.computePasses===0&&sample.renderPipelinesCreated===0&&sample.buffersCreated===0&&sample.texturesCreated===0),"Warmed canonical native workload changed");
    const ordinaryPixels = [];
    for (const view of plan.views) {
      const reference = plan.ordinaryReferences[entry.engine][view.id], bytes = await readFile(reference.path);
      requireValue(bytes.length === reference.bytes && hash(bytes) === reference.sha256, "Ordinary reference bytes changed");
      const comparison = comparePixels(decodePng(bytes), decodePng(await readFile(resolve(entry.attemptRoot, view.id + ".png"))));
      ordinaryPixels.push({ engine: entry.engine, view: view.id, reference, ...comparison });
    }
    await save(resolve(entry.attemptRoot, "ordinary-pixel-check.json"), { planSha256: expectedHash, variant: entry.variant, comparisons: ordinaryPixels });
    requireValue(ordinaryPixels.every((pixel) => pixel.exact), "Actual native image differs from held ordinary engine reference");
  } catch (error) {
    failure = error;
  } finally {
    await new Promise((yes) => server.close(yes));
    await pending;
    await save(resolve(entry.attemptRoot, "receipts.json"), {
      receipts,
      failures,
      totalBytes,
    });
    await save(
      resolve(entry.attemptRoot, "host-after.json"),
      await hostSnapshot(),
    );
    await save(resolve(entry.attemptRoot, "outcome.json"), {
      schema: SCHEMA,
      ...entry,
      status: failure ? "failed" : "passed",
      nativeStatus: report?.status ?? "failed",
      error: failure?.stack ?? null,
      finishedAt: new Date().toISOString(),
    });
  }
  if (failure) throw failure;
  return {
    ordinal,
    variant: entry.variant,
    status: "passed",
    attemptRoot: entry.attemptRoot,
    timings: measurement.timings,
    firstSampleCounts: measurement.samples[0],
  };
}

async function readSourceTreeModules(root) {
  const map = new Map();
  for (const entry of await readdir(root, { withFileTypes: true }))
    if (entry.isFile())
      map.set("/" + entry.name, await readFile(resolve(root, entry.name)));
  return map;
}

export function decodePng(bytes) {
  requireValue(
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "PNG signature differs",
  );
  let width,
    height,
    channels,
    offset = 8;
  const parts = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString("ascii", offset + 4, offset + 8),
      body = bytes.subarray(offset + 8, offset + 8 + length);
    requireValue(offset + length + 12 <= bytes.length, "Truncated PNG chunk");
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      requireValue(
        body[8] === 8 &&
          channels &&
          body[10] === 0 &&
          body[11] === 0 &&
          body[12] === 0,
        "Only noninterlaced8-bit RGB/RGBA PNG accepted",
      );
    }
    if (type === "IDAT") parts.push(body);
    offset += length + 12;
    if (type === "IEND") break;
  }
  const stride = width * channels,
    raw = inflateSync(Buffer.concat(parts)),
    raster = Buffer.alloc(width * height * 4),
    previous = Buffer.alloc(stride);
  requireValue(
    raw.length === (stride + 1) * height,
    "PNG inflated raster length differs",
  );
  const paeth = (a, b, c) => {
    const p = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)],
      current = Buffer.alloc(stride);
    requireValue(filter <= 4, "Unsupported PNG filter");
    for (let col = 0; col < stride; col++) {
      const a = col >= channels ? current[col - channels] : 0,
        b = previous[col],
        c = col >= channels ? previous[col - channels] : 0;
      current[col] =
        (raw[row * (stride + 1) + 1 + col] +
          (filter === 0
            ? 0
            : filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? Math.floor((a + b) / 2)
                  : paeth(a, b, c))) &
        255;
    }
    for (let col = 0; col < width; col++) {
      const target = (row * width + col) * 4;
      for (let channel = 0; channel < 3; channel++)
        raster[target + channel] = current[col * channels + channel];
      raster[target + 3] = channels === 4 ? current[col * channels + 3] : 255;
    }
    current.copy(previous);
  }
  return { width, height, raster, sha256: hash(raster) };
}

export function comparePixels(reference, candidate) {
  requireValue(
    reference.width === candidate.width &&
      reference.height === candidate.height,
    "Pixel parity dimensions differ",
  );
  let changedPixels = 0,
    changedChannels = 0,
    maxChannelDelta = 0,
    sumAbsoluteDelta = 0;
  for (let i = 0; i < reference.raster.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(reference.raster[i + c] - candidate.raster[i + c]);
      if (delta) {
        changed = true;
        changedChannels++;
      }
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      sumAbsoluteDelta += delta;
    }
    if (changed) changedPixels++;
  }
  return {
    exact: changedPixels === 0,
    referenceRasterSha256: reference.sha256,
    candidateRasterSha256: candidate.sha256,
    changedPixels,
    changedPixelFraction: changedPixels / (reference.width * reference.height),
    changedChannels,
    maxChannelDelta,
    meanAbsoluteChannelDelta: sumAbsoluteDelta / reference.raster.length,
  };
}

export async function summarizePlan(planPath, expectedHash) {
 const plan=await loadPlan(planPath,expectedHash),attempts=[];
 for(const entry of plan.order){const m=await parse(resolve(entry.attemptRoot,'measurement.json')),o=await parse(resolve(entry.attemptRoot,'outcome.json'));requireValue(o.status==='passed'&&o.nativeStatus==='passed','Any failed attempt stops inference');attempts.push({...entry,timings:m.timings,activation:m.activationWitness,steady:m.samples.every(sample=>plan.stableFrameCriterion.fields.every(field=>sample[field]===m.samples[0][field])&&sample.renderPipelinesCreated===0&&sample.buffersCreated===0&&sample.texturesCreated===0)});}
 const pixels=[],blocks=[],threes=attempts.filter(e=>e.variant==='three-baseline'),threeMedians=threes.map(e=>e.timings.queueCompletionLatencyMs.median),drift=Math.max(...threeMedians)-Math.min(...threeMedians);
 for(const block of [1,2,3,4,5,6]){
  const three=attempts.find(e=>e.block===block&&e.variant==='three-baseline'),parent=attempts.find(e=>e.block===block&&e.variant==='aperture-fixed-storage-fresnel'),candidate=attempts.find(e=>e.block===block&&e.variant==='aperture-flat-draw-constants');
  for(const view of plan.views)pixels.push({block,variant:candidate.variant,view:view.id,...comparePixels(decodePng(await readFile(resolve(parent.attemptRoot,view.id+'.png'))),decodePng(await readFile(resolve(candidate.attemptRoot,view.id+'.png'))))});
  const t=three.timings.queueCompletionLatencyMs.median,c=candidate.timings.queueCompletionLatencyMs.median,reduction=1-c/t,improvement=t-c,vsThree=candidate.timings.endToEndMs.median<=three.timings.endToEndMs.median,vsParent=candidate.timings.endToEndMs.median<=parent.timings.endToEndMs.median;
  blocks.push({block,threeQueueMedianMs:t,parentQueueMedianMs:parent.timings.queueCompletionLatencyMs.median,candidateQueueMedianMs:c,queueReductionVersusThree:reduction,queueImprovementVersusThreeMs:improvement,referenceRangeMs:drift,noEndToEndRegressionVersusThree:vsThree,noEndToEndRegressionVersusParent:vsParent,passed:reduction>=0.10&&improvement>drift&&vsThree&&vsParent});
 }
 const benefitGates=[{variant:'aperture-flat-draw-constants',reference:'three-baseline',blocks,passed:blocks.every(b=>b.passed)}];
 const result={schema:SCHEMA,mode:plan.mode,planSha256:expectedHash,summaryPath:resolve(plan.outputDirectory,'summary.json'),allNativeClosedPassed:attempts.length===18,attempts,pixels,allCandidatePixelsExact:pixels.length===18&&pixels.every(p=>p.exact),allSteady:attempts.every(a=>a.steady),benefitGates,limits:[plan.timing,'All18 fresh actual child waits and lifecycle receipts required;96 samples per run, no sample exclusions or pooled windows.','All six role permutations; all six blocks must pass the declared threshold and end-to-end guards.','Root review, not independent agent. Physical GPU performance remains unmeasured.']};await save(resolve(plan.outputDirectory,'summary.json'),result);return result;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "freeze") {
      requireValue(args.length === 1, "freeze ABS_VARIANTS_JSON");
      console.log(json(await freezePlan(args[0])));
    } else if (command === "run") {
      requireValue(args.length === 3, "run ABS_PLAN SHA256 ORDINAL");
      console.log(json(await runAttempt(args[0], args[1], Number(args[2]))));
    } else if (command === "summarize") {
      requireValue(args.length === 2, "summarize ABS_PLAN SHA256");
      const result = await summarizePlan(args[0], args[1]);
      console.log(
        json({
          summaryPath: result.summaryPath,
          allNativeClosedPassed: result.allNativeClosedPassed,
          allSteady: result.allSteady,
          allCandidatePixelsExact: result.allCandidatePixelsExact,
          benefitGates: result.benefitGates,
        }),
      );
    } else throw new Error("Commands: freeze, run, summarize");
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
