import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const mapping=await read('judging/coordinator-mapping.json'),summary=await read('evidence/summary.json');
const out='/workspace/street-corner-blind-review-20261017';
await fs.mkdir(out); // Do not revise evidence after review begins.
for(const folder of ['visual','effort','reviews'])await fs.mkdir(path.join(out,folder));
await fs.copyFile(path.join(root,'judging/JUDGE_BRIEF.md'),path.join(out,'visual/BRIEF.md'));
for(const folder of ['visual','effort'])await fs.copyFile(path.join(root,'judging/blind/reference.png'),path.join(out,folder,'reference.png'));
const notes={
 aperture:[
  'Recorded failure: a custom foliage mesh contained degenerate polar triangles. Validation provided a concrete diagnostic, but the failed capture lifecycle lasted about 122 seconds. The author removed those faces.',
  'Author-reported revisions: converted display-space hex colors to linear material colors after a washed first image; corrected sign direction and local car rotations; adjusted framing, window details, lighting and tree topology.',
  'Author-reported setup detour: corrected an unsupported standalone build command flag. Successful capture-managed builds did not fail.'
 ],
 vgpu:[
  'Recorded first failure: raw shader text was passed where a prepared shader artifact was required. The author added the documented shader preparation plugin.',
  'Recorded second failure: the shadow vertex entry did not declare all attributes in the geometry layout. The author matched the shader inputs to the geometry.',
  'Author-reported revisions: camera, foliage normals, car wheels and taper, lighting and shadow sampling, placement and procedural shop lettering.',
  'Author-reported setup detour: corrected an unsupported standalone build command flag. Successful capture-managed builds did not fail.'
 ],
 three:[
  'Recorded second-attempt failure: ambient occlusion generated an invalid gather operation on multisampled depth. The author introduced a separate single-sample depth/normal pass.',
  'Recorded fourth-attempt failure: applying denoised occlusion directly in materials caused a depth texture read/write conflict. The author materialized that result into a separate texture pass.',
  'Author-reported revisions: signs, faceted trees, cars, camera, lighting, contact shading and its denoising. Two standalone builds were reported.'
 ]
};
const candidates={};
for(const [id,name] of Object.entries(mapping)){
 const r=summary.find(x=>x.framework===name);
 await fs.copyFile(path.join(root,`judging/blind/image-${id}.png`),path.join(out,`visual/image-${id}.png`));
 for(const phase of ['image','first'])await fs.copyFile(path.join(root,`judging/blind/${phase}-${id}.png`),path.join(out,`effort/${phase}-${id}.png`));
 candidates[id]={
  firstCaptureRequestedMs:r.firstCaptureRequestedMs,firstVerifiedMs:r.firstVerifiedMs,queueThroughFirstVerifiedMs:r.queueThroughFirstVerifiedMs,
  finishedMs:r.elapsedMs,finalImageMs:r.finalCaptureMs,queueMs:r.queueMs,elapsedExcludingQueueMs:r.elapsedExcludingCaptureQueueMs,
  attempts:r.captureAttempts,failures:r.failedCaptureAttempts,buildMs:r.buildMs,captureLifecycleMs:r.renderAndCleanupMs,
  captures:r.captures.map((c,i)=>({attempt:i+1,status:c.status,buildMs:c.buildMs,queueMs:c.queueMs,captureLifecycleMs:c.renderAndCleanupMs,elapsedMs:c.elapsedMs,requestedAfterStartMs:Date.parse(c.startedAt)-Date.parse(r.startAt),returnedAfterStartMs:Date.parse(c.finishedAt)-Date.parse(r.startAt)})),
  frictionEvidence:notes[name]
 };
}
const evidence={method:'One fresh author per candidate, identical 25-minute / six-capture ceiling and 1200x900 verified WebGPU environment. First images mean first successful capture, which may have visual flaws. Capture lifecycle includes launch, readiness, render, screenshot, cleanup. All clocks include capture waits. Subtracting queue is descriptive, not actual active work: authors could read/plan while waiting. Exact tokens/billing unavailable. Author-reported notes are labeled; coordinator summaries omit identities and API names. No code-quality grading.',candidates};
await fs.writeFile(path.join(out,'effort/evidence.json'),JSON.stringify(evidence,null,2));
await fs.writeFile(path.join(root,'judging/effort-input.json'),JSON.stringify(evidence,null,2));
console.log(out);
