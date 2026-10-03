import { buildScene } from './scene-data.mjs';
import { inspectScene } from './checks.mjs';
self.onmessage = ({ data: request }) => {
  try {
    const scene=buildScene(request.edit ?? 'baseline');
    const checks=inspectScene(scene);
    const transfers=scene.meshes.flatMap(m=>[m.positions.buffer,m.normals.buffer,m.indices.buffer]);
    self.postMessage({type:'scene',scene,checks},transfers);
  } catch(error) {
    self.postMessage({type:'error',error:{name:error.name,message:error.message,stack:error.stack}});
  }
};
