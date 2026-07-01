#!/usr/bin/env node
// Side-by-side proof for F15 (skinned-animation freeze). Left: unpatched engine
// (EPSILON=1e-6) — skin palette collapses to identity, model frozen in bind
// (T-)pose, every frame byte-identical. Right: EPSILON lowered to 1e-12 — the
// same headless bundle at the same frame now shows the live animated pose.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/home/user/aperture/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const art = path.join(here, "artifacts");
const uri = (f) => `data:image/png;base64,${readFileSync(path.join(art, f)).toString("base64")}`;

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;background:#0d1117;font-family:system-ui,sans-serif;color:#c9d1d9}
  h1{padding:20px 24px 2px;font-size:21px;margin:0}
  p.sub{padding:0 24px 12px;margin:0;color:#8b949e;font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px 24px 24px}
  figure{margin:0;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}
  img{width:100%;display:block;background:#000}
  figcaption{padding:9px 11px;font-size:12px;color:#adbac7;line-height:1.4}
  .bad{color:#f85149;font-weight:600}
  .good{color:#3fb950;font-weight:600}
</style></head><body>
  <h1>F15 — Skinned GLB animation frozen at bind pose (Soldier.glb, uniform scale 0.01)</h1>
  <p class="sub">Same headless bundle, same frame 45, same <code>aperture render</code>. The only change is the mat4 singularity epsilon used by the skinning-palette compute.</p>
  <div class="grid">
    <figure><img src="${uri("anim_frozen_bindpose.png")}"><figcaption><span class="bad">BEFORE (EPSILON=1e-6, shipped)</span> — det(worldMatrix)=0.01³=1e-6 ≤ EPSILON ⇒ invertMat4 returns null ⇒ every joint palette written as identity ⇒ frozen bind (T-)pose. frame10 == frame45 byte-identical. Note the model is also mis-scaled/placed.</figcaption></figure>
    <figure><img src="${uri("anim_animated_fixed.png")}"><figcaption><span class="good">AFTER (EPSILON=1e-12)</span> — 1e-6 determinant now accepted ⇒ palette = inverse(meshWorld)·jointWorld·inverseBind updates every step ⇒ live "Idle" pose, arms down, weight shifted. frame10 ≠ frame45.</figcaption></figure>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 560 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(art, "anim_compare.png"), fullPage: true });
await browser.close();
console.log("wrote artifacts/anim_compare.png");
