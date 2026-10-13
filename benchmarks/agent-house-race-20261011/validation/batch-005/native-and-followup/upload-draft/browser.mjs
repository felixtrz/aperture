/** Actual native API workload. No engine, benchmark adapter or timing score. */
export async function executeUploadScopeSmoke() {
  const observations = [], samples = [], sources = [], owned = [];
  let sealedBuffers = null;
  const observer = globalThis.__AGENT_NATIVE_OBSERVER__;
  const ready = "__NATIVE_UPLOAD_SCOPE_SMOKE__";
  const counters = ["submissions", "drawCalls", "submittedTriangles", "indirectDrawCalls", "knownIndirectDrawCalls", "unknownIndirectDrawCalls", "knownIndirectTriangles", "unknownDirectTriangleDrawCalls", "unknownTopologyDrawCalls", "unknownCommandBuffers"];
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("Native adapter missing");
    const device = await adapter.requestDevice();
    const context = document.getElementById("proof").getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({device, format, alphaMode:"opaque"});
    const uniforms = [];
    for (let number = 0; number < 12; number++) {
      const buffer = device.createBuffer({label:`uniform-${number}`, size:32000, usage:GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
      owned.push(buffer); uniforms.push(buffer);
      const color = new Float32Array([.12 + number * .015, .45, .9, 1]);
      // 1000 disjoint spans per buffer, each separated by 16 untouched bytes:
      // 12000 old-scope segments exceeds the unchanged global limit of 10000.
      for (let segment = 0; segment < 1000; segment++) device.queue.writeBuffer(buffer, segment * 32, color);
    }
    const vertexBuffers = [];
    for (const [label, shift, usage] of [["plain-position", -.3, GPUBufferUsage.VERTEX], ["mixed-position", .3, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE]]) {
      const owner = new Float32Array(11);
      const positions = owner.subarray(1, 10); // Own nonzero source-view offset.
      positions.set([-.17, -.17 + shift, 0, .17, -.17 + shift, 0, 0, .17 + shift, 0]);
      const buffer = device.createBuffer({label, size:positions.byteLength, usage:usage | GPUBufferUsage.COPY_DST});
      owned.push(buffer); vertexBuffers.push(buffer);
      device.queue.writeBuffer(buffer, 0, positions);
      sources.push({label, usage:usage | GPUBufferUsage.COPY_DST, sourceByteOffset:positions.byteOffset, bytes:[...new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength)]});
    }
    const indices = device.createBuffer({label:"real-index-buffer", size:8, usage:GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST});
    owned.push(indices);
    device.queue.writeBuffer(indices, 0, new Uint16Array([0,1,2,0]));
    const argumentsBuffer = device.createBuffer({label:"cpu-only-indirect", size:20, usage:GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST});
    owned.push(argumentsBuffer);
    const argumentOwner = new Uint32Array(7), argumentsView = argumentOwner.subarray(1,6);
    argumentsView.set([3,2,0,0,0]);
    device.queue.writeBuffer(argumentsBuffer,0,argumentsView);
    const bindings = uniforms.map((_,i)=>`@group(0) @binding(${i}) var<uniform> color${i}: vec4f;`).join("\n");
    const colorSum = uniforms.map((_,i)=>`color${i}`).join(" + ");
    const shader = device.createShaderModule({code:`${bindings}
@vertex fn vertex(@location(0) p:vec3f,@builtin(instance_index) instance:u32)->@builtin(position) vec4f {
 return vec4f(p.xy + vec2f(f32(instance)*.4-.4,0),p.z,1);
}
@fragment fn fragment()->@location(0) vec4f {return (${colorSum})/12.;}`});
    const compilation = await shader.getCompilationInfo();
    if (compilation.messages.some(message=>message.type==="error")) throw new Error(JSON.stringify(compilation.messages));
    const pipeline = device.createRenderPipeline({layout:"auto", vertex:{module:shader,entryPoint:"vertex",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:shader,entryPoint:"fragment",targets:[{format}]},primitive:{topology:"triangle-list"}});
    const group = device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:uniforms.map((buffer,binding)=>({binding,resource:{buffer,offset:0,size:16}}))});
    observations.push({phase:"before-controlled-draws",native:observer.snapshot()});
    for (let frame = 0; frame < 3; frame++) {
      if (frame === 2) device.queue.writeBuffer(argumentsBuffer,4,new Uint32Array([3]));
      observer.beginIndirectArgumentSample();
      const before = observer.snapshot();
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),clearValue:{r:.03,g:.04,b:.05,a:1},loadOp:"clear",storeOp:"store"}]});
      pass.setPipeline(pipeline); pass.setBindGroup(0,group); pass.setIndexBuffer(indices,"uint16");
      for (const vertex of vertexBuffers) {pass.setVertexBuffer(0,vertex);pass.drawIndexedIndirect(argumentsBuffer,0);}
      pass.end(); device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const after = observer.snapshot(), references = observer.sampleIndirectArgumentReferences();
      const sample = Object.fromEntries(counters.map(key=>[key,after[key]-before[key]]));
      Object.assign(sample,{frame,nativeBefore:before,nativeAfter:after,unknownIndirectReasons:{},nativeIndirectArgumentReferences:references.references,unretainedKnownIndirectDrawCalls:references.unretainedKnownDrawCalls,submittedTriangleAccounting:{schema:"aperture.native-triangle-accounting.v2.1",confidence:"exact-supported-command-arguments",proofStatus:"complete"}});
      samples.push(sample);
      if (frame === 1) {
        observations.push({phase:"before-geometry-seal",native:after});
        sealedBuffers = observer.sealGeometryCapture().map(record=>({...record,segments:record.segments.map(segment=>({offset:segment.offset,bytes:[...segment.bytes]}))}));
      }
    }
    const proof = observer.exportIndirectArgumentProof();
    observations.push({phase:"after-final-draw",native:observer.snapshot()});
    for (const buffer of owned) buffer.destroy();
    observations.push({phase:"after-owned-buffer-disposal",native:observer.snapshot()});
    globalThis[ready] = {ok:true,schema:"aperture.native-upload-scope-smoke.v1",scope:"unscored-observer-vertex-and-cpu-indirect-upload-validation",workload:{uniformBuffers:12,disjointWritesPerBuffer:1000,uniformWriteBytes:16,gapBytes:16,controlledFrames:3,indexedDrawsPerFrame:2,instances:[2,2,3]},sources,sealedBuffers,observations,warmup:[],samples,nativeIndirectArgumentProof:proof};
  } catch (error) {
    for (const buffer of owned) {try {buffer.destroy();} catch {}}
    globalThis[ready] = {ok:false,schema:"aperture.native-upload-scope-smoke.v1",error:{name:error.name,message:error.message,stack:error.stack},sources,sealedBuffers,observations,samples};
  }
}
