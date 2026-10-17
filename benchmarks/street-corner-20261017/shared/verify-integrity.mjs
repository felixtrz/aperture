import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),repo=path.resolve(root,'../..');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const hash=async file=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const engine=await read(path.join(root,'evidence/framework-snapshot.json'));
const deps=await read(path.join(root,'evidence/dependency-snapshot.json'));
const report={checkedAt:new Date().toISOString(),engine:{files:0,changed:[]},dependencies:{files:0,changed:[]},authors:{}};
for(const [group,manifest,base] of [['engine',engine,repo],['dependencies',deps,path.join(root,'node_modules')]]){
 for(const [file,expected] of Object.entries(manifest.sha256)){
  report[group].files++;
  try{if(await hash(path.join(base,file))!==expected)report[group].changed.push(file);}catch{report[group].changed.push(file);}
 }
}
async function files(dir,prefix=''){
 const out=[];
 for(const item of await fs.readdir(path.join(dir,prefix),{withFileTypes:true})){
  if(['node_modules','dist','.aperture'].includes(item.name))continue;
  const rel=path.join(prefix,item.name);
  if(item.isDirectory())out.push(...await files(dir,rel));else if(item.isFile())out.push(rel);
 }
 return out;
}
for(const name of ['aperture','vgpu','three']){
 const author=path.join(root,'authors',name);const result=await read(path.join(author,'result.json'));
 const captured=path.join(root,'evidence',name,result.finalCaptureLabel,'source');
 const sourceFiles=[...new Set([...(await files(author)),...(await files(captured))])].filter(file=>!['README.md','journal.md','result.json','startAt.txt'].includes(file)&&!file.endsWith('.log'));
 const changed=[];
 for(const file of sourceFiles){try{if(await hash(path.join(author,file))!==await hash(path.join(captured,file)))changed.push(file);}catch{changed.push(file);}}
 report.authors[name]={comparedSourceFiles:sourceFiles.length,changed,finalCaptureLabel:result.finalCaptureLabel};
}
report.passed=report.engine.changed.length===0&&report.dependencies.changed.length===0&&Object.values(report.authors).every(x=>x.changed.length===0);
await fs.writeFile(path.join(root,'evidence/source-integrity.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));assert(report.passed,'Frozen sources changed; investigate before judging');
