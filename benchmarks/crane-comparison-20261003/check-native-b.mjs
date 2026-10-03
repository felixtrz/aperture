import {readFile,writeFile} from 'node:fs/promises';
import {buildScene} from './author-b/v2/scene-data.mjs';
const checks=[];
for(let i=2;i<=11;i++){
 const attempt=`attempt-${String(i).padStart(3,'0')}`,r=JSON.parse(await readFile(new URL(`./renders/b/${attempt}/result.json`,import.meta.url))),e=r.sceneStatus.nativeGeometry;
 const expected=buildScene(e.edit),byName=new Map(expected.meshes.map(p=>[p.name,p]));
 if(e.meshes.length!==expected.meshes.length)throw Error('Mesh count mismatch');
 for(const mesh of e.meshes){
  const p=byName.get(mesh.name),delta=mesh.positions.length===p.positions.length?Math.max(...mesh.positions.map((x,j)=>Math.abs(x-p.positions[j]))):Infinity;
  const indices=JSON.stringify(mesh.indices)===JSON.stringify(Array.from(p.indices)),normals=JSON.stringify(mesh.normals)===JSON.stringify(Array.from(p.normals)),matrix=JSON.stringify(mesh.matrix)===JSON.stringify(p.matrix);
  checks.push({attempt,mesh:mesh.name,nativeVertices:mesh.positions.length/3,maxDelta:delta,indices,normals,matrix,passed:delta===0&&indices&&normals&&matrix});
 }
}
const result={checks,passed:checks.filter(c=>c.passed).length,total:checks.length,failed:checks.filter(c=>!c.passed),method:'Independent comparison of recorded native BufferGeometry positions, indices, normals and matrixWorld against frozen CPU construction for every capture.'};
await writeFile(new URL('./independent-native-b.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,total:result.total,failed:result.failed}));
