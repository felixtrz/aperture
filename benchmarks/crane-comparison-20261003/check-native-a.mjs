import {readFile,writeFile} from 'node:fs/promises';
import {constructScene} from './author-a/v2/scene.mjs';
const checks=[];
for(let i=2;i<=11;i++){
 const attempt=`attempt-${String(i).padStart(3,'0')}`,r=JSON.parse(await readFile(new URL(`./renders/a/${attempt}/result.json`,import.meta.url))),e=r.sceneStatus.geometryEvidence;
 const expected=constructScene(r.sceneStatus.edit),byName=new Map(expected.parts.map(p=>[p.name,p]));
 if(e.nativeMeshes.length!==expected.parts.length)throw Error('Mesh count mismatch');
 for(const mesh of e.nativeMeshes){
  const p=byName.get(mesh.name),stream=mesh.streams.find(s=>s.attributes.some(a=>a.semantic==='POSITION')),attr=stream.attributes.find(a=>a.semantic==='POSITION');
  if(stream.dataType!=='Float32Array'||attr.format!=='float32x3')throw Error('Unexpected native vertex layout');
  const stride=stream.arrayStride/4,off=attr.offset/4,positions=Array.from({length:stream.vertexCount},(_,i)=>stream.data.slice(i*stride+off,i*stride+off+3)),exp=p.indices.map(j=>p.positions[j]);
  const delta=positions.length===exp.length?Math.max(...positions.map((v,j)=>Math.hypot(...v.map((x,k)=>x-exp[j][k])))):Infinity;
  checks.push({attempt,mesh:mesh.name,nativeVertices:positions.length,maxDelta:delta,passed:delta===0&&JSON.stringify(mesh.worldMatrix)===JSON.stringify(p.worldMatrix)});
 }
}
const result={checks,passed:checks.filter(c=>c.passed).length,total:checks.length,failed:checks.filter(c=>!c.passed),method:'Independent decoder compares recorded native POSITION stream triangle vertices and actual ECS matrix to frozen CPU construction for each captured edit.'};
await writeFile(new URL('./independent-native-a.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,total:result.total,failed:result.failed}));
