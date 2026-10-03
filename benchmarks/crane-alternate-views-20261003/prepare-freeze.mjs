import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { here, repo } from './cpu-loader.mjs';
import * as contract from './contract.mjs';
const checkpoint='097c94acba41431a27cd3030c68d3a6b58db3f4f',entries=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const entry of JSON.parse(await readFile(resolve(here,'derivation.json'))).files) {
  const original=await readFile(resolve(repo,entry.source)),derived=await readFile(resolve(repo,entry.destination));
  const committed=execFileSync('git',['show',`${checkpoint}:${entry.source}`],{cwd:repo,maxBuffer:16*1024*1024});
  if(!original.equals(committed)||hash(original)!==entry.sourceSha256||hash(derived)!==entry.derivedSha256)throw Error('Source provenance mismatch: '+entry.source);
  entries.push({...entry,bytes:original.length,checkpointBytesEqual:true});
}
await writeFile(resolve(here,'source-audit.json'),JSON.stringify({status:'passed',checkpoint,localHeadUsed:false,entries},null,2)+'\n',{flag:'wx'});
await writeFile(resolve(here,'frozen-contract.json'),JSON.stringify({schema:contract.SCHEMA,parameters:contract.PARAMETERS,views:contract.VIEWS,sessions:Object.fromEntries(contract.SESSION_IDS.map(s=>[s,contract.statesFor(s)])),budgets:contract.BUDGETS,workerSettings:contract.WORKER_SETTINGS},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'passed',checkpoint,sourceFiles:entries.length}));
