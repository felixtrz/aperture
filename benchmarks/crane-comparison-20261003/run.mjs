import { createServer } from 'node:http';
import { readFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExamplesRequestHandler } from '../../scripts/serve-examples.mjs';
import { runVerifiedScene } from '../../scripts/verified-webgpu.mjs';
const base = dirname(fileURLToPath(import.meta.url)), repo = resolve(base, '../..');
const [engine, attempt, view = 'front-quarter', edit = 'baseline', version = 'v1'] = process.argv.slice(2);
if (!['a', 'b'].includes(engine) || !/^attempt-\d{3}$/.test(attempt) || !/^v\d+$/.test(version)) throw Error('Invalid immutable attempt');
if (!['front-quarter', 'rear-quarter', 'high-oblique'].includes(view) || !['baseline', 'shoulder', 'elbow', 'hoist', 'arch', 'pipe', 'tier', 'assembly'].includes(edit)) throw Error('Invalid scene selection');
const source = resolve(base, `author-${engine}`, version), out = resolve(base, 'renders', engine, attempt);
await mkdir(out, { recursive: false });
async function pins() {
  const files = (await readdir(source, { withFileTypes: true })).filter(x => x.isFile()).map(x => x.name).sort();
  const data = {};
  for (const file of files) data[file] = createHash('sha256').update(await readFile(resolve(source, file))).digest('hex');
  return data;
}
const before = await pins();
await writeFile(resolve(out, 'source-pins.json'), JSON.stringify({ engine, attempt, view, edit, version, sha256: before }, null, 2));
const fallback = createExamplesRequestHandler(repo);
const server = createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (['/packages/', '/node_modules/', '/worker-modules/'].some(p => pathname.startsWith(p))) return fallback(req, res);
  let target;
  if (['three.webgpu.js', 'three.core.js'].includes(basename(pathname))) target = resolve(repo, 'shadow-lab/src/compare', basename(pathname));
  else {
    const match = pathname.match(/^\/scene\/([a-zA-Z0-9._-]+)$/);
    if (!match || match[1].includes('..')) { res.writeHead(404); res.end('Not found'); return; }
    target = resolve(source, match[1]);
  }
  try {
    const bytes = await readFile(target);
    res.setHeader('Content-Type', target.endsWith('.html') ? 'text/html' : target.endsWith('.json') ? 'application/json' : 'text/javascript');
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Missing immutable source'); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
try {
  const report = await runVerifiedScene({ runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME, scratchRoot: process.env.APERTURE_TMP_RUN, url: `http://127.0.0.1:${server.address().port}/scene/index.html?view=${view}&edit=${edit}`, outputPath: resolve(out, 'result.json'), screenshotPath: resolve(out, 'render.png'), readyGlobal: '__CRANE_READY__', viewport: { width: 1024, height: 1024 }, timeout: 240000 });
  console.log(JSON.stringify({ status: report.status, proof: report.proof, scene: report.sceneStatus }));
} finally {
  server.closeAllConnections(); await new Promise(ok => server.close(ok));
  const after = await pins(), unchanged = JSON.stringify(before) === JSON.stringify(after);
  await writeFile(resolve(out, 'source-verification.json'), JSON.stringify({ unchanged, after }, null, 2));
  if (!unchanged) throw Error('Author source changed during capture; evidence invalid');
}
