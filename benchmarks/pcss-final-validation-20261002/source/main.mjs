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
struct Controls { parameters:vec4f, uv:vec4f }
@group(0) @binding(3) var<uniform> control:Controls;
fn directionalShadowStrengthValue()->f32{return 1.0;}
${copied.join('\n')}
${vertex}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
  let uv=control.uv.xy+p.x/256.0*control.uv.zw;
  let world=vec3f((uv.x*2.0-1.0)*control.parameters.w*0.5,(1.0-uv.y*2.0)*control.parameters.w*0.5,0.0);
  var visibility:f32; if(control.parameters.x==3.0){visibility=sampleDirectionalPcssBilinear(uv,control.parameters.z,vec2f(128.0));}else{visibility=sampleSpotShadowFactorWithMatrixBase(world,0u,control.parameters.y,control.parameters.z,u32(control.parameters.x));}
  return vec4f(visibility,visibility,visibility,1.0);
}`;
  const module = device.createShaderModule({code:source});
  const info = await module.getCompilationInfo();
  if (info.messages.some(m=>m.type==='error')) throw Error(JSON.stringify(info.messages.map(m=>({type:m.type,message:m.message,lineNum:m.lineNum,linePos:m.linePos}))));
  const pipeline = device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:'rgba32float'}]},primitive:{topology:'triangle-list'}});
  const cases=[{"id": "left-full", "gap": 0.8, "mode": "full", "uv": [-0.01, 0.5, 0.04, 0], "boundary": true}, {"id": "left-clear", "gap": 0.8, "mode": "clear", "uv": [-0.01, 0.5, 0.04, 0], "boundary": true}, {"id": "right-full", "gap": 0.8, "mode": "full", "uv": [0.97, 0.5, 0.04, 0], "boundary": true}, {"id": "right-clear", "gap": 0.8, "mode": "clear", "uv": [0.97, 0.5, 0.04, 0], "boundary": true}, {"id": "top-full", "gap": 0.8, "mode": "full", "uv": [0.5, -0.01, 0, 0.04], "boundary": true}, {"id": "top-clear", "gap": 0.8, "mode": "clear", "uv": [0.5, -0.01, 0, 0.04], "boundary": true}, {"id": "bottom-full", "gap": 0.8, "mode": "full", "uv": [0.5, 0.97, 0, 0.04], "boundary": true}, {"id": "bottom-clear", "gap": 0.8, "mode": "clear", "uv": [0.5, 0.97, 0, 0.04], "boundary": true}, {"id": "top-left-full", "gap": 0.8, "mode": "full", "uv": [-0.01, -0.01, 0.04, 0.04], "boundary": true}, {"id": "top-left-clear", "gap": 0.8, "mode": "clear", "uv": [-0.01, -0.01, 0.04, 0.04], "boundary": true}, {"id": "top-right-full", "gap": 0.8, "mode": "full", "uv": [0.97, -0.01, 0.04, 0.04], "boundary": true}, {"id": "top-right-clear", "gap": 0.8, "mode": "clear", "uv": [0.97, -0.01, 0.04, 0.04], "boundary": true}, {"id": "bottom-left-full", "gap": 0.8, "mode": "full", "uv": [-0.01, 0.97, 0.04, 0.04], "boundary": true}, {"id": "bottom-left-clear", "gap": 0.8, "mode": "clear", "uv": [-0.01, 0.97, 0.04, 0.04], "boundary": true}, {"id": "bottom-right-full", "gap": 0.8, "mode": "full", "uv": [0.97, 0.97, 0.04, 0.04], "boundary": true}, {"id": "bottom-right-clear", "gap": 0.8, "mode": "clear", "uv": [0.97, 0.97, 0.04, 0.04], "boundary": true}, {"id": "radius-16", "gap": 2, "mode": "edge", "uv": [0.25, 0.5, 0.5, 0], "radius": 16}, {"id": "radius-100", "gap": 2, "mode": "edge", "uv": [0.25, 0.5, 0.5, 0], "radius": 100}, {"id": "bilinear-horizontal", "gap": 0.8, "mode": "horizontal", "uv": [0.473, 0.48, 0, 0.04], "type": 3, "axis": 1}, {"id": "bilinear-vertical", "gap": 0.8, "mode": "edge", "uv": [0.48, 0.473, 0.04, 0], "type": 3, "axis": 0}];
  const profiles=[];
  for(const c of cases){
    const near=c.near??0.1,far=c.far??45,distance=c.distance??20,span=14;
    const blocker=(distance-near)/(far-near),receiver=(distance+c.gap-near)/(far-near);
    const depth=device.createTexture({size:[128,128],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    const dm=device.createShaderModule({code:`${vertex}\n@fragment fn fs(@builtin(position) p:vec4f)->@builtin(frag_depth) f32{return ${c.mode==='clear'?'1.0':c.mode==='full'?String(blocker):`select(1.0,${blocker},${c.mode==='horizontal'?'p.y':'p.x'}<64.0)`};}`});
    const dp=device.createRenderPipeline({layout:'auto',vertex:{module:dm,entryPoint:'vs'},fragment:{module:dm,entryPoint:'fs',targets:[]},depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'always'}});
    const matrix=new Float32Array([2/span,0,0,0,0,2/span,0,0,0,0,c.degenerate?0:-1/(far-near),0,0,0,receiver,1]);
    const matrices=device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(matrices,0,matrix);
    const control=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(control,0,new Float32Array([c.type??2,c.radius??6,c.type===3?receiver:0,span,...c.uv]));
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
  const assertions=[];
  for(const c of profiles){
    if(c.boundary){let maxError=0;for(let i=0;i<256;i++){const x=c.uv[0]+(i+.5)/256*c.uv[2],y=c.uv[1]+(i+.5)/256*c.uv[3];const expected=c.mode==='clear'||x<0||x>1||y<0||y>1?1:0;maxError=Math.max(maxError,Math.abs(c.values[i]-expected));}if(maxError>1e-5)throw Error(`Boundary mismatch ${c.id}: ${maxError}`);assertions.push({id:c.id,maxError,passed:true});}
    if(c.type===3){let maxError=0;for(let i=0;i<256;i++){const coord=c.uv[c.axis]+(i+.5)/256*c.uv[c.axis+2];const expected=Math.min(1,Math.max(0,(coord-.5)*128+.5));maxError=Math.max(maxError,Math.abs(c.values[i]-expected));}if(maxError>0.0001)throw Error(`Bilinear mismatch ${c.id}: ${maxError}`);assertions.push({id:c.id,maxError,passed:true});}
  }
  const cap16=profiles.find(p=>p.id==='radius-16').values,cap100=profiles.find(p=>p.id==='radius-100').values;const capError=Math.max(...cap16.map((v,i)=>Math.abs(v-cap100[i])));if(capError!==0)throw Error(`Cap inequality ${capError}`);assertions.push({id:'radius100-equals16',maxError:capError,passed:true});
  const compileReports=[];
  if(phase==='after'){
    for(const item of await (await fetch('./compile-cases.json')).json()){
      const m=device.createShaderModule({code:item.code});const result=await m.getCompilationInfo();
      const errors=result.messages.filter(m=>m.type==='error').map(m=>m.message);compileReports.push({name:item.name,errors});
      if(errors.length)throw Error(JSON.stringify(compileReports));
    }
  }
  const displayData=new Float32Array(profiles.flatMap(p=>p.values));const displayBuffer=device.createBuffer({size:displayData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(displayBuffer,0,displayData);
  const displayModule=device.createShaderModule({code:`${vertex}\n@group(0) @binding(0) var<storage,read> values:array<f32>;@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f{let row=min(u32(p.y/(800.0/20.0)),19u);let col=min(u32(p.x/800.0*256.0),255u);let v=values[row*256u+col];return vec4f(v,v,v,1);}`});
  const displayPipeline=device.createRenderPipeline({layout:'auto',vertex:{module:displayModule,entryPoint:'vs'},fragment:{module:displayModule,entryPoint:'fs',targets:[{format}]}});
  const de=device.createCommandEncoder();const rp=de.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store'}]});rp.setPipeline(displayPipeline);rp.setBindGroup(0,device.createBindGroup({layout:displayPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:displayBuffer}}]}));rp.draw(3);rp.end();device.queue.submit([de.finish()]);await device.queue.onSubmittedWorkDone();
  globalThis.__PCSS_READY__={ok:true,phase,algorithm:code.includes('DIRECTIONAL_PCSS_DISK')?'single-map-pcss':'legacy-fixed-3x3',profiles,assertions,compileReports,dimensions:{shadow:128,profile:256,view:800},synthetic:'production dispatch with exact depth-map blocker controls; depth bias zero to isolate projection invariance'};
}catch(error){globalThis.__PCSS_READY__={ok:false,error:String(error)};console.error(error);}
