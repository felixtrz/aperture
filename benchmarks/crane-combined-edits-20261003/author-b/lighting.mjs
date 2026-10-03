import * as THREE from '/three.webgpu.js';
const linearColor=rgb=>new THREE.Color().setRGB(...rgb,THREE.LinearSRGBColorSpace);
export function lighting(scene) {
  // Constant procedural world radiance supplies native PBR reflection and diffuse fill.
  // No image/texture asset, lookup map, or reference screenshot is used.
  scene.environmentNode=THREE.TSL.vec3(.42*.25,.54*.25,.66*.25);
  const key=new THREE.DirectionalLight(linearColor([1,.89,.72]),2.6);
  key.name='warm-key';key.position.set(-4,7,5);key.target.position.set(0,0,0);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:24});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias=-.00015;key.shadow.normalBias=.012;key.shadow.radius=12;
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
