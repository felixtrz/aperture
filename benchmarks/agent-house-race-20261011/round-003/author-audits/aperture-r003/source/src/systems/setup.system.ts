import { createSystem, mesh, material } from '@aperture-engine/app/systems';
import { makeScene } from '../scene.js';
import {surfaceMaterials} from '../surface.js';
export default class Setup extends createSystem({priority:0}){
 init(){
  this.spawn.camera({key:'camera.main',transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:0.1,far:200,aspect:4/3}});
  this.spawn.light({key:'light.sun',kind:'directional',color:[1,.91,.78,1],intensity:3.2,transform:{rotationEulerDegrees:[-48,-40,0]},shadow:{mapSize:2048,cascadeCount:1,shadowType:1,strength:.85,filterRadius:2,normalBias:.035}});
  this.spawn.light({key:'light.fill',kind:'ambient',color:[.72,.81,1,1],intensity:.22});
  const surfaces=surfaceMaterials(this.assetsRegistry);
  for(const [key,b] of makeScene()){
   this.spawn.mesh({key:'scene.'+key,mesh:mesh.triangleList({label:key,positions:b.p,normals:b.n,uvs:b.uv}),material:surfaces(key,b),castShadow:b.cast!==false,receiveShadow:true});
  }
 }
}
