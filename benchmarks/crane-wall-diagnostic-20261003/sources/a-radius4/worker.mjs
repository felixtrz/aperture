import { startGeneratedSimulationWorker } from '/worker-modules/packages/app/dist/worker.js';
import { createSystem, mesh, material, WorldTransform } from '/worker-modules/packages/app/dist/systems.js';
import { createMeshHandle } from '/worker-modules/packages/simulation/dist/index.js';
import { CONFIG, CAMERAS, PALETTE, constructScene, linearColor } from './scene.mjs';

class CraneCourtyard extends createSystem({priority:0}) {
 init(){
  const edit=this.startOptions.string('craneEdit')??'baseline';
  const view=this.startOptions.string('craneView')??'front-quarter';
  if(!Object.hasOwn(CAMERAS,view))throw Error(`Unknown view ${view}`);
  const scene=constructScene(edit), nativeMeshes=[];
  for(const part of scene.parts){
   const [hex,roughness,metallic]=PALETTE[part.material];
   const entity=this.spawn.mesh({key:part.name,name:part.name,tags:[part.group],mesh:mesh.triangleList({label:part.name,positions:part.positions,indices:part.indices}),material:material.standard({baseColor:[...linearColor(hex),1],roughness,metallic,...(part.material==='lamp'?{emissiveFactor:[2.6,1.8,.75]}:{})}),castShadow:true,receiveShadow:true});
   const native=this.meshes.get(createMeshHandle(`${part.name}.mesh`));
   if(!native)throw Error(`Native mesh missing: ${part.name}`);
   const streams=native.vertexStreams.map(stream=>({id:stream.id,arrayStride:stream.arrayStride,vertexCount:stream.vertexCount,attributes:stream.attributes,dataType:stream.data.constructor.name,data:Array.from(stream.data)}));
   const worldMatrix=['col0','col1','col2','col3'].flatMap(key=>Array.from(entity.getVectorView(WorldTransform,key)));
   nativeMeshes.push({name:part.name,streams,indices:native.indexBuffer?Array.from(native.indexBuffer.data):null,submeshes:native.submeshes,worldMatrix});
  }
  this.spawn.camera({key:'camera.main',transform:{translation:CAMERAS[view],lookAt:[0,1.4,0]},camera:{projection:'orthographic',orthographicHeight:10.5,aspect:1,autoAspect:false,near:.1,far:80,clearColor:[.115,.17,.209,1],frustumCulling:true}});
  // Explicit PCSS (type 2): native 32-tap contact-hardening disk. Type 1
  // is fixed PCFSoft and ignores authored radius, so retain PCSS with a
  // wider 16-texel maximum on a 1024 map rather than mislabeling it PCF.
  this.spawn.light({key:'light.key',kind:'directional',color:[1,.89,.72,1],intensity:2.65,transform:{translation:[-4,7,5],lookAt:[0,0,0]},shadow:{mapSize:1024,cascadeCount:1,shadowType:2,strength:.82,filterRadius:4,normalBias:.02,bias:.0006,slopeBias:1,center:[0,1.4,0],orthographicSize:12,near:.1,far:35,lightDistance:15}});
  this.spawn.light({key:'light.cool-fill',kind:'rect-area',color:[.67,.8,1,1],intensity:.85,transform:{translation:[3,6,-4],lookAt:[0,1,0]},light:{width:7,height:7,range:30}});
  this.spawn.light({key:'light.world-fill',kind:'ambient',color:[.42,.54,.66,1],intensity:.65});
  this.spawn.light({key:'light.wall-lamp',kind:'point',color:[1,.55,.22,1],intensity:1.15,transform:{translation:[2.61,1.76,-1.69]},light:{range:1.9}});
  globalThis.postMessage({type:'crane-geometry',scene,nativeMeshes,view,backend:'Aperture app worker → ECS extraction → native WebGPU'});
 }
}
startGeneratedSimulationWorker({config:CONFIG,systems:[{default:CraneCourtyard}]});
