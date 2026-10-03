// Executes the production-generated dispatch and sampling functions verbatim.
// Synthetic depth maps isolate blocker distance from lighting/material changes.
const shaderFunction = (code, name) => {
  const start = code.indexOf(`fn ${name}(`);
  if (start < 0) throw new Error(`Missing production function ${name}`);
  return code.slice(start, code.indexOf('\n}', start) + 2);
};
try {
  const phase = new URLSearchParams(location.search).get('phase');
  if (!['before','after'].includes(phase)) throw Error('Unknown phase');
  const code = await (await fetch(`./${phase}.wgsl`)).text();
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({device,format,alphaMode:'opaque'});
  const vertex = `@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);}`;
  const copied = ['shadowDepthFromClip','sampleDirectionalShadowPcf3x3','sampleDirectionalShadowPcfSoft','sampleSpotShadowFactorWithMatrixBase'].map(n=>shaderFunction(code,n));
  if (code.includes('const DIRECTIONAL_PCSS_DISK')) {
    copied.push(code.match(/const DIRECTIONAL_PCSS_DISK:[\s\S]*?\n\);/)[0]);
    copied.push(shaderFunction(code,'sampleDirectionalPcssBilinear'),shaderFunction(code,'sampleDirectionalShadowPcss'));
  }
  const source = `@group(0) @binding(0) var<storage,read> directionalShadowMatrices:array<mat4x4f>;
@group(0) @binding(1) var directionalShadowMap:texture_depth_2d;
@group(0) @binding(2) var directionalShadowSampler:sampler_comparison;
@group(0) @binding(3) var<uniform> control:vec4f;
fn directionalShadowStrengthValue()->f32{return 1.0;}
${copied.join('\n')}
${vertex}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
  let uv=vec2f(0.25+p.x/512.0,0.5);
  let world=vec3f((uv.x*2.0-1.0)*control.w*0.5,0.0,0.0);
  let visibility=sampleSpotShadowFactorWithMatrixBase(world,0u,control.y,control.z,u32(control.x));
  return vec4f(visibility,visibility,visibility,1.0);
}`;
  const module = device.createShaderModule({code:source});
  const info = await module.getCompilationInfo();
  if (info.messages.some(m=>m.type==='error')) throw Error(JSON.stringify(info.messages));
  const pipeline = device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:'rgba32float'}]},primitive:{topology:'triangle-list'}});
  const cases=[
    {id:'contact',gap:0.02},{id:'middle',gap:0.2},{id:'far',gap:0.8},{id:'maximum',gap:2},
    {id:'far-shifted-clip',gap:0.8,near:5,far:100,distance:30},
    {id:'far-wide-clip',gap:0.8,near:0.01,far:1000,distance:100},
    {id:'no-blocker',gap:0.8,mode:'clear'}, {id:'fully-shadowed',gap:0.8,mode:'full'},
    {id:'hard-contact',gap:0.02,type:0,radius:0},{id:'hard-far',gap:0.8,type:0,radius:0},
    {id:'pcf-contact',gap:0.02,type:1},{id:'pcf-far',gap:0.8,type:1},
    {id:'zero-radius',gap:0.8,radius:0},{id:'radius-one',gap:0.8,radius:1},
    {id:'capped-radius',gap:2,radius:100},{id:'degenerate-projection',gap:0.8,degenerate:true},
  ];
  const profiles=[];
  for(const c of cases){
    const near=c.near??0.1,far=c.far??45,distance=c.distance??20,span=14;
    const blocker=(distance-near)/(far-near),receiver=(distance+c.gap-near)/(far-near);
    const depth=device.createTexture({size:[128,128],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    const dm=device.createShaderModule({code:`${vertex}\n@fragment fn fs(@builtin(position) p:vec4f)->@builtin(frag_depth) f32{return ${c.mode==='clear'?'1.0':c.mode==='full'?String(blocker):`select(1.0,${blocker},p.x<64.0)`};}`});
    const dp=device.createRenderPipeline({layout:'auto',vertex:{module:dm,entryPoint:'vs'},fragment:{module:dm,entryPoint:'fs',targets:[]},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'always'}});
    const matrix=new Float32Array([2/span,0,0,0,0,2/span,0,0,0,0,c.degenerate?0:-1/(far-near),0,0,0,receiver,1]);
    const matrices=device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(matrices,0,matrix);
    const control=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(control,0,new Float32Array([c.type??2,c.radius??6,0,span]));
    const target=device.createTexture({size:[256,1],format:'rgba32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
    const buffer=device.createBuffer({size:4096,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:matrices}},{binding:1,resource:depth.createView()},{binding:2,resource:device.createSampler({compare:'less-equal',minFilter:'nearest',magFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'})},{binding:3,resource:{buffer:control}}]});
    const enc=device.createCommandEncoder();
    const dr=enc.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:depth.createView(),depthLoadOp:'clear',depthClearValue:1,depthStoreOp:'store'}});dr.setPipeline(dp);dr.draw(3);dr.end();
    const pass=enc.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:'clear',clearValue:[1,0,1,1],storeOp:'store'}]});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();
    enc.copyTextureToBuffer({texture:target},{buffer,bytesPerRow:4096},[256,1]);device.queue.submit([enc.finish()]);await buffer.mapAsync(GPUMapMode.READ);
    const rgba=Array.from(new Float32Array(buffer.getMappedRange()));const values=rgba.filter((_,i)=>i%4===0);buffer.unmap();
    if(values.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error(`Invalid visibility ${c.id}`);
    const transition=values.filter(v=>v>0.05&&v<0.95).length/4;
    profiles.push({...c,near,far,distance,span,blocker,receiver,values,transitionWidthTexels:transition});
    buffer.destroy();target.destroy();control.destroy();matrices.destroy();depth.destroy();
  }
  const compileReports=[];
  if(phase==='after'){
    for(const item of await (await fetch('./compile-cases.json')).json()){
      const m=device.createShaderModule({code:item.code});const result=await m.getCompilationInfo();
      const errors=result.messages.filter(m=>m.type==='error').map(m=>m.message);compileReports.push({name:item.name,errors});
      if(errors.length)throw Error(JSON.stringify(compileReports));
    }
  }
  const displayData=new Float32Array(profiles.flatMap(p=>p.values));const displayBuffer=device.createBuffer({size:displayData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(displayBuffer,0,displayData);
  const displayModule=device.createShaderModule({code:`${vertex}\n@group(0) @binding(0) var<storage,read> values:array<f32>;@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f{let row=min(u32(p.y/50.0),15u);let col=min(u32(p.x/800.0*256.0),255u);let v=values[row*256u+col];return vec4f(v,v,v,1);}`});
  const displayPipeline=device.createRenderPipeline({layout:'auto',vertex:{module:displayModule,entryPoint:'vs'},fragment:{module:displayModule,entryPoint:'fs',targets:[{format}]}});
  const de=device.createCommandEncoder();const rp=de.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store'}]});rp.setPipeline(displayPipeline);rp.setBindGroup(0,device.createBindGroup({layout:displayPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:displayBuffer}}]}));rp.draw(3);rp.end();device.queue.submit([de.finish()]);await device.queue.onSubmittedWorkDone();
  globalThis.__PCSS_READY__={ok:true,phase,algorithm:code.includes('DIRECTIONAL_PCSS_DISK')?'single-map-pcss':'legacy-fixed-3x3',profiles,compileReports,dimensions:{shadow:128,profile:256,view:800},synthetic:'production dispatch with exact depth-map blocker controls; depth bias zero to isolate projection invariance'};
}catch(error){globalThis.__PCSS_READY__={ok:false,error:String(error)};console.error(error);}
