import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(
  await fs.readFile(path.join(root, "evidence/summary.json"), "utf8"),
);
const assessment = JSON.parse(
  await fs.readFile(path.join(root, "judging/assessment.json"), "utf8"),
);
// Preserve the original PNG bytes and make image display independent of a server.
const pngDataUrl = async (relativePath) =>
  `data:image/png;base64,${(await fs.readFile(path.join(root, relativePath))).toString("base64")}`;
const referenceImage = await pngDataUrl("reference/garden.png");
const firstImages = Object.fromEntries(
  await Promise.all(
    data.map(async (r) => [
      r.framework,
      await pngDataUrl(`evidence/${r.framework}/${r.firstCapture}/render.png`),
    ]),
  ),
);
const names = { aperture: "Aperture", vgpu: "vGPU", three: "Three.js" };
const minutes = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const cards = (
  await Promise.all(
    data.map(async (r) => {
      const score = assessment.candidates[r.framework];
      const final = await pngDataUrl(
        `evidence/${r.framework}/${r.finalCapture}/render.png`,
      );
      return `<article><header><h2>${names[r.framework]}</h2><span>${score.mean.toFixed(2)} / 10</span></header><a class="image-link" href="#image-viewer"><img alt="${names[r.framework]} garden reconstruction" src="${final}" data-framework="${r.framework}" /></a><dl><div><dt>First verified</dt><dd>${minutes(r.firstVerifiedMs)}</dd></div><div><dt>Author elapsed</dt><dd>${minutes(r.elapsedMs)}</dd></div><div><dt>Capture queue</dt><dd>${(r.queueMs / 1000).toFixed(1)} s</dd></div><div><dt>Attempts / failures</dt><dd>${r.captureAttempts} / ${r.failedCaptureAttempts}</dd></div></dl><p class="links"><a href="authors/${r.framework}/README.md">Source / reproduce</a> · <a href="evidence/${r.framework}/${r.finalCapture}/report.json">GPU proof</a></p></article>`;
    }),
  )
).join("\n");
const rows = data
  .map((r) => {
    const x = assessment.candidates[r.framework];
    return `<tr><th>${names[r.framework]}</th>${["composition", "landmarks", "lowPolyStyle", "lightingMaterials", "finish"].map((k) => `<td>${x.dimensions[k].toFixed(2)}</td>`).join("")}<td><strong>${x.mean.toFixed(2)}</strong></td><td>${x.judges.map((n) => n.toFixed(2)).join(" / ")}</td></tr>`;
  })
  .join("");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chinese garden · agent authoring comparison</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ec;color:#24332c;font:16px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:40px 28px}h1{font-size:clamp(30px,4vw,52px);letter-spacing:-.04em;margin:8px 0 16px}h2{font-size:22px;margin:0}p{max-width:85ch}.eyebrow{text-transform:uppercase;letter-spacing:.14em;color:#5b715e;font-size:12px}.intro{color:#536157}.reference{max-width:850px;margin:30px auto}.reference img{width:100%;display:block;border-radius:10px}.reference figcaption{text-align:center;color:#627366;padding:8px}.toolbar{display:flex;gap:10px;align-items:center;margin:30px 0 16px;flex-wrap:wrap}.toolbar p{margin:0 auto 0 0;font-weight:600}button{border:1px solid #9aa99b;border-radius:30px;padding:9px 19px;background:transparent;color:#284333;cursor:pointer}button.active{background:#284b39;color:white;border-color:#284b39}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{border:1px solid #d6ddd3;border-radius:12px;overflow:hidden;background:#fffefa}article header{display:flex;justify-content:space-between;align-items:center;padding:18px}article header span{font-variant-numeric:tabular-nums;font-weight:650;background:#edf1e8;padding:4px 10px;border-radius:20px}article img{width:100%;aspect-ratio:4/3;object-fit:contain;display:block;background:#eae7dc}dl{padding:12px 18px;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}dt{color:#68756b;font-size:12px}dd{margin:0;font-size:20px;font-variant-numeric:tabular-nums}.links{padding:0 18px;font-size:13px}a{color:#376748}section{margin:34px 0}.table{overflow:auto}table{width:100%;border-collapse:collapse;background:#fffefa}th,td{text-align:left;padding:13px;border-bottom:1px solid #d6ddd3;font-variant-numeric:tabular-nums;font-size:14px}td{white-space:nowrap}.note{font-size:14px;color:#627165}dialog{width:min(96vw,1500px);max-height:96vh;border:0;border-radius:12px;padding:16px;background:#fffefa}dialog::backdrop{background:#18251fd9}dialog img{display:block;max-width:100%;height:auto;margin:auto}dialog form{text-align:right;margin-bottom:12px}footer{border-top:1px solid #d6ddd3;padding-top:24px;font-size:14px}@media(max-width:950px){.grid{grid-template-columns:1fr}main{padding:24px 16px}.reference{margin:20px 0}}
</style><main><div class="eyebrow">Exploratory authoring trial · 16 October 2026 (Pacific)</div><h1>One garden. Three frameworks.</h1><p class="intro">Three independent agents recreated the same low-poly reference using Aperture, vGPU and Three.js. Same inherited model, 25-minute ceiling, six capture attempts, 1200 × 900, verified WebGPU on SwiftShader. Two blind visual judges scored the final images; a third reviewed authoring effort. Code quality was not graded.</p><p><strong>Aperture matched the reference best. Three.js led appeal and completion time. vGPU delivered the earliest useful preview.</strong> The main Aperture opportunities are faster static-scene feedback and more convincing water, lighting and material treatment.</p><figure class="reference"><a class="image-link" href="#image-viewer"><img src="${referenceImage}" alt="Shared generated low-poly Chinese garden reference"></a><figcaption>The shared reference. Reconstructed from procedural 3D geometry, without using this image as a texture.</figcaption></figure><div class="toolbar"><p>Reconstruction gallery</p><button data-view="first" aria-pressed="false">First verified renders</button><button class="active" data-view="final" aria-pressed="true">Final renders</button></div><div class="grid">${cards}</div><p class="note">Scores always refer to the final image. Click any image to enlarge it. All images are embedded at their original resolution; no separate image files need to load. Author elapsed includes capture and queue time; queue waits are shown separately. First verified means a successful technical capture, not an independent judgment of visual acceptability.</p><section><h2>Blind visual assessment</h2><p class="note">Scores are subjective 0–10 ratings, averaged across two independent judges. Weights: composition 25%, landmarks 25%, low-poly coherence 15%, lighting/materials 20%, finish 15%.</p><div class="table"><table><thead><tr><th>Framework</th><th>Composition</th><th>Landmarks</th><th>Low-poly</th><th>Light/material</th><th>Finish</th><th>Weighted mean</th><th>Individual totals</th></tr></thead><tbody>${rows}</tbody></table></div></section><footer><p><a href="REPORT.md">Findings and Aperture priorities</a> · <a href="PROTOCOL.md">Protocol</a> · <a href="evidence/summary.json">Timing evidence</a> · <a href="judging/assessment.json">Judge scores</a></p><p>One trial per framework, not a general ranking. All authors and judges used the same model family, and model familiarity may differ. The common browser route isolates authoring; native Node tooling advantages were not tested. Elapsed time and attempts are effort proxies. Exact token usage, billing and dollar cost are unavailable.</p></footer></main><dialog id="image-viewer" aria-label="Enlarged garden image"><form method="dialog"><button>Close</button></form><img alt=""></dialog><script type="application/json" id="first-images">${JSON.stringify(firstImages)}</script><script>
const firstImages=JSON.parse(document.getElementById('first-images').textContent);
const gardenImages=[...document.querySelectorAll('img[data-framework]')];
const finalImages=new Map(gardenImages.map(img=>[img.dataset.framework,img.src]));
document.querySelectorAll('button[data-view]').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('button[data-view]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
 gardenImages.forEach(img=>{img.src=b.dataset.view==='first'?firstImages[img.dataset.framework]:finalImages.get(img.dataset.framework);});
});
const viewer=document.getElementById('image-viewer');
const enlarged=viewer.querySelector('img');
document.querySelectorAll('.image-link').forEach(link=>link.onclick=event=>{
 event.preventDefault();const img=link.querySelector('img');enlarged.src=img.src;enlarged.alt=img.alt;viewer.showModal();
});
viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
</script></html>`;
await fs.writeFile(path.join(root, "gallery.html"), html);
console.log("Wrote gallery.html");
