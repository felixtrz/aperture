import * as THREE from '/three.webgpu.js';
import { inspectScene } from './checks.mjs';

const params=new URLSearchParams(location.search);
const view=params.get('view')??'front-quarter',edit=params.get('edit')??'baseline';
const progress=stage=>{globalThis.__CRANE_PROGRESS__={stage,view,edit,time:performance.now()};};
progress('initializing');
function buildInWorker() {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      worker.terminate();
      if(data.type==='error')reject(Object.assign(new Error(data.error.message),data.error));
      else resolve(data);
    };
    worker.onerror=event=>{worker.terminate();reject(new Error(event.message));};
    worker.postMessage({edit});
  });
}
const linearColor=rgb=>new THREE.Color().setRGB(...rgb,THREE.LinearSRGBColorSpace);
function lighting(scene) {
  // Constant procedural world radiance supplies native PBR reflection and diffuse fill.
  // No image/texture asset, lookup map, or reference screenshot is used.
  scene.environmentNode=THREE.TSL.vec3(.42*.35,.54*.35,.66*.35);
  const key=new THREE.DirectionalLight(linearColor([1,.89,.72]),2.2);
  key.name='warm-key';key.position.set(-4,7,5);key.target.position.set(0,0,0);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:24});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias=-.00015;key.shadow.normalBias=.012;key.shadow.radius=3;
  scene.add(key,key.target);
  // Nine native point samples approximate the broad 7 m cool fill emitter.
  // This is an explicit lighting approximation, not a claimed exact area-light port.
  const origin=new THREE.Vector3(3,6,-4),target=new THREE.Vector3(0,1,0);
  const normal=target.clone().sub(origin).normalize();
  const u=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(0,1,0)).normalize();
  const v=new THREE.Vector3().crossVectors(normal,u).normalize();
  let sample=0;
  for(const x of [-7/3,0,7/3])for(const y of [-7/3,0,7/3]) {
    const fill=new THREE.PointLight(linearColor([.67,.8,1]),3,0,2);
    fill.name=`cool-fill-${sample++}`;fill.position.copy(origin).addScaledVector(u,x).addScaledVector(v,y);
    scene.add(fill);
  }
  const lamp=new THREE.PointLight(linearColor([1,.55,.22]),.8,2,2);
  lamp.name='wall-lamp';lamp.position.set(2.61,1.76,-1.69);scene.add(lamp);
}
async function main() {
  if(!navigator.gpu)throw new Error('Native WebGPU is unavailable; WebGL fallback is prohibited.');
  const {scene:data,checks:workerChecks}=await buildInWorker();
  if(!Object.hasOwn(data.cameras,view))throw new Error(`Unknown view: ${view}`);
  progress('constructing-native-scene');
  const renderer=new THREE.WebGPURenderer({canvas:document.querySelector('#scene'),antialias:true,samples:4,alpha:false,forceWebGL:false});
  // The pinned constructor installs a fallback even when forceWebGL is false.
  // Null the actual Renderer fallback hook before init, then verify the backend.
  renderer._getFallback=null;
  renderer.setPixelRatio(1);renderer.setSize(1024,1024,false);
  renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  await renderer.init();
  if(renderer.backend.isWebGPUBackend!==true)throw new Error('Unexpected backend; native WebGPU is required.');
  const device=renderer.backend.device;
  if(!device?.queue?.onSubmittedWorkDone)throw new Error('Native WebGPU submission fence unavailable.');
  const uncaptured=[];
  device.addEventListener('uncapturederror',event=>uncaptured.push(event.error.message));
  const scene=new THREE.Scene();scene.name='procedural-crane-courtyard';scene.background=new THREE.Color('#6c7e89');
  const materials=new Map(Object.entries(data.palette).map(([name,p])=>{
    const material=new THREE.MeshStandardMaterial({color:p.srgb,roughness:p.roughness,metalness:p.metallic,flatShading:true});
    material.name=name;
    if(name==='lamp') { material.emissive.set('#FFE1A3');material.emissiveIntensity=2.5; }
    return [name,material];
  }));
  const nativeMeshes=[];
  for(const source of data.meshes) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(source.positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(source.normals,3));
    geometry.setIndex(new THREE.BufferAttribute(source.indices,1));
    for(const group of source.groups) geometry.addGroup(group.start,group.count,group.materialIndex);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,source.materials.map(name=>materials.get(name)));
    mesh.name=source.name;mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(source.matrix);
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={group:source.group,markers:source.markers};
    scene.add(mesh);nativeMeshes.push(mesh);
  }
  lighting(scene);
  const settings=data.cameras[view],s=settings.vertical_span/2;
  const camera=new THREE.OrthographicCamera(-s,s,s,-s,.1,100);
  camera.name=view;camera.position.fromArray(settings.position);camera.up.set(0,1,0);camera.lookAt(...settings.target);camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  function exportNativeGeometry() {
    scene.updateMatrixWorld(true);
    return {
      schema:data.schema,edit,parameters:{...data.parameters},cameras:data.cameras,palette:data.palette,
      meshes:nativeMeshes.map(mesh=>({
        name:mesh.name,group:mesh.userData.group,
        positions:Array.from(mesh.geometry.getAttribute('position').array),
        normals:Array.from(mesh.geometry.getAttribute('normal').array),indices:Array.from(mesh.geometry.index.array),
        materials:mesh.material.map(m=>m.name),groups:mesh.geometry.groups.map(g=>({...g})),
        matrix:Array.from(mesh.matrixWorld.elements),markers:mesh.userData.markers,
      })),
    };
  }
  globalThis.__CRANE_EXPORT_GEOMETRY__=exportNativeGeometry;
  globalThis.__CRANE_NATIVE__={renderer,scene,camera,meshes:nativeMeshes};
  const nativeChecks=inspectScene(exportNativeGeometry());
  globalThis.__CRANE_CHECKS__={worker:workerChecks,native:nativeChecks};
  globalThis.__CRANE_STATE__={edit,view,parameters:{...data.parameters},counts:nativeChecks.counts};
  if(!nativeChecks.ok)throw new Error(`Native geometry checks failed: ${nativeChecks.checks.filter(c=>!c.ok).map(c=>c.name).join('; ')}`);
  progress('compiling-native-webgpu');
  device.pushErrorScope('validation');
  await renderer.compileAsync(scene,camera);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  progress('submitting-native-frame');
  renderer.render(scene,camera);
  await device.queue.onSubmittedWorkDone();
  const validation=await device.popErrorScope();
  if(validation)throw new Error(`WebGPU validation error: ${validation.message}`);
  if(uncaptured.length)throw new Error(`WebGPU uncaptured errors: ${uncaptured.join('; ')}`);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  progress('native-frame-complete');
  globalThis.__CRANE_READY__={
    ok:true,width:size.x,height:size.y,dimensions:[size.x,size.y],view,edit,
    renderer:'THREE.WebGPURenderer',revision:THREE.REVISION,backend:'WebGPUBackend',
    webglFallbackDisabled:renderer._getFallback===null,nativeSubmittedFrames:1,gpuQueueCompleted:true,
    sceneState:globalThis.__CRANE_STATE__,geometryChecks:{ok:nativeChecks.ok,tolerance:nativeChecks.tolerance,count:nativeChecks.checks.length},
    camera:{position:camera.position.toArray(),target:[...settings.target],verticalSpan:settings.vertical_span},
    limitations:['Point-sampled broad cool fill; PCF key softness approximates the reference angular sun.','AgX uses the native three.js implementation without Blender contrast-look emulation.','Kinematic geometry only; no structural, lifting-safety, collision or physical-simulation claim.'],
  };
}
main().catch(error=>{
  globalThis.__CRANE_ERROR__={ok:false,view,edit,name:error.name,message:error.message,stack:error.stack};
  progress('error');
  const node=document.querySelector('#error');node.style.display='block';node.textContent=`Native scene failed\n${error.stack??error.message}`;
  console.error(error);
});
