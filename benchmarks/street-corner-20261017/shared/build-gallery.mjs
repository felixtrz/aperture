import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const read=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const results=await read('evidence/summary.json');
const assessment=await read('judging/assessment.json');
const out=path.join(root,'gallery');
await fs.mkdir(path.join(out,'images'),{recursive:true});
await fs.mkdir(path.join(out,'evidence'),{recursive:true});
await fs.mkdir(path.join(out,'source'),{recursive:true});
await fs.mkdir(path.join(out,'judging'),{recursive:true});
const copy=async (from,to)=>fs.copyFile(path.join(root,from),path.join(out,to));
await copy('reference/street.png','images/reference.png');
for(const file of ['REPORT.md','PROTOCOL.md','FOLLOW_UP_PLAN.md']) await copy(file,file);
for(const file of ['summary.json','run.json','source-integrity.json','reproducibility.json'])await copy(`evidence/${file}`,`evidence/${file}`);
for(const file of ['assessment.json','fidelity.json','art-direction.json','effort-review.json'])await copy(`judging/${file}`,`judging/${file}`);
const names={aperture:'Aperture',vgpu:'vGPU',three:'Three.js'};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const duration=ms=>{const s=Math.round(ms/1000);return `${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`;};
const first={},final={};
for(const r of results){
  first[r.framework]=`images/${r.framework}-first.png`;final[r.framework]=`images/${r.framework}-final.png`;
  await copy(`evidence/${r.framework}/${r.firstCapture}/render.png`,first[r.framework]);
  await copy(`evidence/${r.framework}/${r.finalCapture}/render.png`,final[r.framework]);
  await copy(`evidence/${r.framework}/${r.finalCapture}/report.json`,`evidence/${r.framework}-gpu-proof.json`);
  await copy(`authors/${r.framework}/README.md`,`source/${r.framework}-README.md`);
  await copy(`authors/${r.framework}/journal.md`,`source/${r.framework}-journal.md`);
  await copy(`authors/${r.framework}/result.json`,`source/${r.framework}-result.json`);
  const snapshot=path.join(root,`evidence/${r.framework}/${r.finalCapture}/source`);
  execFileSync('tar',['--exclude=.aperture','--exclude=dist','--exclude=node_modules','-czf',path.join(out,`source/${r.framework}.tar.gz`),'-C',snapshot,'.']);
}
const cards=results.map(r=>{const score=assessment.candidates[r.framework];return `<article><header><h2>${names[r.framework]}</h2><strong>${score.mean.toFixed(2)}<small> / 10</small></strong></header><a class="image-link" href="${final[r.framework]}"><img src="${final[r.framework]}" alt="${names[r.framework]} street-corner reconstruction" data-framework="${r.framework}" width="1200" height="900"></a><dl><div><dt>First verified image</dt><dd>${duration(r.firstVerifiedMs)}</dd></div><div><dt>Author finished</dt><dd>${duration(r.elapsedMs)}</dd></div><div><dt>Capture queue</dt><dd>${(r.queueMs/1000).toFixed(1)} s</dd></div><div><dt>Attempts / failures</dt><dd>${r.captureAttempts} / ${r.failedCaptureAttempts}</dd></div></dl><p class="links"><a href="source/${r.framework}.tar.gz">Source archive</a> · <a href="source/${r.framework}-journal.md">Author journal</a> · <a href="evidence/${r.framework}-gpu-proof.json">Render proof</a></p></article>`}).join('');
const rows=results.map(r=>{const s=assessment.candidates[r.framework];return `<tr><th>${names[r.framework]}</th>${['composition','landmarks','lowPolyStyle','lightingMaterials','finish'].map(k=>`<td>${s.dimensions[k].toFixed(2)}</td>`).join('')}<td><strong>${s.mean.toFixed(2)}</strong></td><td>${s.judges.map(v=>v.toFixed(2)).join(' / ')}</td></tr>`}).join('');
const phases=results.map(r=>`<tr><th>${names[r.framework]}</th><td>${duration(r.firstCaptureRequestedMs)}</td><td>${(r.buildMs/1000).toFixed(1)} s</td><td>${(r.renderAndCleanupMs/1000).toFixed(1)} s</td><td>${(r.queueMs/1000).toFixed(1)} s</td></tr>`).join('');
for(const r of results){
 for(const c of r.captures){
  const dir=`evidence/${r.framework}/${c.label}`;
  await fs.mkdir(path.join(out,dir),{recursive:true});
  for(const file of ['report.json','timing.json'])await copy(`${dir}/${file}`,`${dir}/${file}`);
 }
}
await fs.mkdir(path.join(out,'evidence/dawn-verification'),{recursive:true});
for(const file of ['summary.json','render.json'])await copy(`evidence/dawn-verification/${file}`,`evidence/dawn-verification/${file}`);
await copy('evidence/dawn-verification/render.png','images/aperture-dawn.png');
let report=await fs.readFile(path.join(out,'REPORT.md'),'utf8');
report=report.replaceAll('reference/street.png','images/reference.png');
for(const r of results){
 report=report.replaceAll(`evidence/${r.framework}/${r.finalCapture}/render.png`,final[r.framework]).replaceAll(`evidence/${r.framework}/${r.firstCapture}/render.png`,first[r.framework]);
 for(const file of ['README.md','journal.md','result.json'])report=report.replaceAll(`authors/${r.framework}/${file}`,`source/${r.framework}-${file}`);
}
await fs.writeFile(path.join(out,'REPORT.md'),report);
const takeaway=await read('gallery-takeaway.json');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Street corner · agent authoring comparison</title><style>
*{box-sizing:border-box}body{margin:0;color:#25352f;background:#f5f2e9;font:16px/1.55 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:34px 28px 56px}nav{display:flex;gap:10px;flex-wrap:wrap;font-size:14px;margin-bottom:28px}nav a{padding:7px 14px;border:1px solid #c9d0c6;border-radius:24px;text-decoration:none}nav a[aria-current]{background:#2c4d3e;color:white}h1{font-size:clamp(32px,4vw,54px);line-height:1.12;letter-spacing:-.04em;margin:6px 0 18px}h2{font-size:22px;margin:0 0 12px}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#59705f}p{max-width:88ch}a{color:#345f46}.intro{color:#536458}.reference{max-width:820px;margin:28px auto}.reference img{display:block;width:100%;height:auto;border-radius:12px}.reference figcaption{text-align:center;color:#667568;font-size:14px;padding:10px}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:24px 0 16px}.toolbar p{font-weight:600;margin:0 auto 0 0}button{font:inherit;border:1px solid #94a694;background:transparent;padding:8px 16px;border-radius:24px;color:#2c4d3e;cursor:pointer}button.active{background:#2c4d3e;border-color:#2c4d3e;color:white}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{background:#fffdf7;border:1px solid #d5ddcf;border-radius:12px;overflow:hidden}article header{display:flex;align-items:center;justify-content:space-between;padding:17px 18px}article header h2{margin:0}article header strong{font-size:20px;white-space:nowrap}small{font-size:12px;font-weight:400;color:#687566}article img{width:100%;height:auto;aspect-ratio:4/3;object-fit:contain;display:block;background:#eee9de}dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0;padding:15px 18px}dt{font-size:12px;color:#667365}dd{font-size:21px;font-variant-numeric:tabular-nums;margin:0}.links{font-size:13px;padding:0 18px 6px}.note{font-size:14px;color:#657264}section{margin:34px 0}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;background:#fffdf7}th,td{padding:12px;text-align:left;border-bottom:1px solid #d5ddcf;font-size:14px;font-variant-numeric:tabular-nums}td{white-space:nowrap}.findings{padding:22px 26px;border-left:4px solid #648669;background:#e9eee2;border-radius:0 10px 10px 0}.findings p{margin:6px 0 12px}footer{border-top:1px solid #d5ddcf;padding-top:20px;font-size:14px}dialog{border:0;border-radius:12px;padding:16px;background:#fffdf7;width:min(96vw,1500px);max-height:96vh}dialog::backdrop{background:#17281edf}dialog img{max-width:100%;height:auto;display:block}dialog form{text-align:right;margin-bottom:12px}@media(max-width:960px){.grid{grid-template-columns:1fr}article{max-width:800px;margin:auto;width:100%}main{padding:24px 16px}th,td{padding:9px}}
</style></head><body><main><nav aria-label="Benchmark scenes"><a href="../">Chinese garden</a><a href="./" aria-current="page">Street corner</a></nav><div class="eyebrow">Agent authoring benchmark · 17 October 2026</div><h1>A small corner of the city.</h1><p class="intro">One shared reference. Three independent authors using Aperture, vGPU and Three.js. The same 25-minute limit, six-capture allowance, image size and software WebGPU capture environment. Two blind visual judges and a separate effort review.</p><figure class="reference"><a class="image-link" href="images/reference.png"><img src="images/reference.png" width="1448" height="1086" alt="Shared low-poly reference: a cream cafe, green bookshop, two cars and a street corner"></a><figcaption>Shared reference · two shops, two cars, and a few street furnishings. Tiny interior details were secondary to composition and major forms.</figcaption></figure><div class="toolbar"><p>Compare reconstructions</p><button data-view="first" aria-pressed="false">First verified images</button><button class="active" data-view="final" aria-pressed="true">Final images</button></div><div class="grid">${cards}</div><p class="note">Scores always refer to final images. Click an image to enlarge or open its original PNG. A verified first capture can still contain visual mistakes. Author time includes capture and queue time; actual tokens and dollar costs are unavailable.</p><section class="findings"><h2>${escape(takeaway.heading)}</h2>${takeaway.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<a href="REPORT.md">Full findings and limitations</a> · <a href="FOLLOW_UP_PLAN.md">Aperture follow-up plan</a></section><section><h2>Independent blind visual assessment</h2><p class="note">Subjective 0–10 scores averaged across two model judges. Weights: composition 25%, landmarks 25%, low-poly style 15%, lighting/materials 20%, finish 15%. Appeal was ranked separately; code quality was not judged.</p><div class="table"><table><thead><tr><th>Framework</th><th>Composition</th><th>Landmarks</th><th>Low-poly</th><th>Light/material</th><th>Finish</th><th>Weighted mean</th><th>Judge totals</th></tr></thead><tbody>${rows}</tbody></table></div></section><p class="note">Verification: all three final images reproduced pixel-for-pixel. The frozen Aperture scene also matched through Node + Dawn; <a href="evidence/dawn-verification/summary.json">see the separate compatibility check</a>.</p><section><h2>Where elapsed time went</h2><div class="table"><table><thead><tr><th>Framework</th><th>First capture requested</th><th>Builds · cumulative</th><th>Capture lifecycle · cumulative</th><th>Queue · cumulative</th></tr></thead><tbody>${phases}</tbody></table></div><p class="note">Capture lifecycle includes launch, readiness, rendering, screenshot and cleanup; it is not GPU frame time. Queue-subtracted elapsed is not measured active work. Common setup and judging are excluded. Each author made different modeling and effect choices.</p></section><footer><p><a href="PROTOCOL.md">Frozen protocol</a> · <a href="evidence/summary.json">Timing evidence</a> · <a href="judging/assessment.json">Judge scores</a> · <a href="judging/effort-review.json">Effort review</a> · <a href="evidence/reproducibility.json">Reproduction checks</a></p><p>One author per framework and one scene; this is not a general ranking or a controlled before/after test against the garden. Aperture uses the current AO and explicit-frame capture fixes. All captures use verified browser WebGPU backed by SwiftShader. Blind judges are independent contexts of the same model family.</p></footer></main><dialog id="viewer" aria-label="Enlarged scene"><form method="dialog"><button>Close</button></form><img alt=""></dialog><script type="application/json" id="image-paths">${JSON.stringify({first,final})}</script><script>
const paths=JSON.parse(document.getElementById('image-paths').textContent);
const images=[...document.querySelectorAll('img[data-framework]')];
document.querySelectorAll('button[data-view]').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('button[data-view]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
 images.forEach(img=>{img.src=paths[button.dataset.view][img.dataset.framework];img.parentElement.href=img.src;});
});
const viewer=document.getElementById('viewer'),enlarged=viewer.querySelector('img');
document.querySelectorAll('.image-link').forEach(link=>link.onclick=event=>{if(typeof viewer.showModal!=='function')return;event.preventDefault();const img=link.querySelector('img');enlarged.src=img.src;enlarged.alt=img.alt;viewer.showModal();});
viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
</script></body></html>`;
assert(!html.includes('data:image/'),'Keep images as ordinary external PNG assets');
await fs.writeFile(path.join(out,'index.html'),html);
console.log(out);
