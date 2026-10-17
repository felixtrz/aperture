import OriginalScene from './original.ts';
import {material,mesh} from '@aperture-engine/app/systems';
import {spawnFittedCar,linearColor} from "../../../../../../examples/procedural-car/src/car.ts";
export default class Closeup extends OriginalScene {
 override init(){
  this.spawn.camera({key:'camera',transform:{translation:[-4.5,2.5,-5.7],lookAt:[0,.68,0]},camera:{projection:'orthographic',orthographicHeight:3.5,near:.1,far:80,clearColor:[.86,.83,.76,1]}});
  this.spawn.light({key:'sun',kind:'directional',intensity:3.1,color:[1,.91,.78,1],transform:{rotationEulerDegrees:[-48,-35,0]},shadow:{mapSize:2048,cascadeCount:1,shadowType:1,filterRadius:3,normalBias:.015,orthographicSize:10,center:[0,.7,0],lightDistance:15,near:.1,far:35}});
  this.spawn.mesh({key:'ground',mesh:mesh.box({size:[200,.08,200]}),material:material.standard({baseColor:linearColor(0xe7ddc7),roughness:1}),transform:{translation:[0,.05,0]},receiveShadow:true});
  spawnFittedCar(this.spawn,{key:'car',color:0x5c8ca7,transform:{translation:[0,.09,0]}});
 }
}
