#!/usr/bin/env node
// Composites the key proof frames into a single montage via Playwright/Chromium
// (the same browser stack aperture render uses). Frames are embedded as data
// URIs so no static server is needed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/home/user/aperture/headless-battletest/app/node_modules/playwright/index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const art = path.join(here, "artifacts");
const uri = (f) => `data:image/png;base64,${readFileSync(path.join(art, f)).toString("base64")}`;

const tiles = [
  ["starfall_f150.png", "Starfall (developed headless): falling stars, basket, per-camera clearColor"],
  ["shadow.png", "Shadow mapping: cast shadow + PBR shading"],
  ["sky.png", "Procedural sky + linear fog (distance fade)"],
  ["physics.png", "Rapier physics: 3 dynamic cubes stacked"],
  ["scale.png", "Scale: 600 entities extracted + rendered"],
  ["compare_headed.png", "Headed live browser (parity with headless render)"],
];

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  body{margin:0;background:#0d1117;font-family:system-ui,sans-serif;color:#c9d1d9}
  h1{padding:20px 24px 4px;font-size:22px;margin:0}
  p.sub{padding:0 24px 12px;margin:0;color:#8b949e;font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:12px 24px 24px}
  figure{margin:0;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}
  img{width:100%;display:block;background:#000}
  figcaption{padding:8px 10px;font-size:12px;color:#adbac7;line-height:1.35}
</style></head><body>
  <h1>Aperture headless → WebGPU render pipeline</h1>
  <p class="sub">Every frame produced in pure Node (aperture headless) then rendered on demand (aperture render, SwiftShader WebGPU under Xvfb).</p>
  <div class="grid">
  ${tiles.map(([f, c]) => `<figure><img src="${uri(f)}"><figcaption>${c}</figcaption></figure>`).join("")}
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(art, "montage.png"), fullPage: true });
await browser.close();
console.log("wrote artifacts/montage.png");
