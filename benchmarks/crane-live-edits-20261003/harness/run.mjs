import { createServer } from 'node:http';
import { readFile, readdir, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, relative, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExamplesRequestHandler, resolveWorkerModulePath, resolveStaticPath } from '../../../scripts/serve-examples.mjs';
import { runVerifiedScene } from '../../../scripts/verified-webgpu.mjs';
import { READY_GLOBAL, SCHEMA, LIMITS } from './contract.mjs';
import { requireValue } from './checks.mjs';
import { createRecorder, readBoundedBody, writeImmutable, sha256 } from './recorder.mjs';

const harness = dirname(fileURLToPath(import.meta.url)), base = resolve(harness, '..'), repo = resolve(base, '../..');
const within = (root, path) => path === root || path.startsWith(root + sep);
const baselineRoots = ['a-continuous-front-quarter', 'b-continuous-front-quarter'].map(name => resolve(repo, 'benchmarks/crane-wall-continuity-20261003/sources', name));
export function authorRootFor(engine) {
  requireValue(['aperture', 'threejs'].includes(engine), 'Unknown author engine');
  return resolve(base, engine === 'aperture' ? 'author-a' : 'author-b');
}
export function verifyAuthorSourcePath(engine, sourcePath) {
  const target = resolve(sourcePath), allowed = authorRootFor(engine);
  requireValue(within(allowed, target), `Author source must be inside the admitted ${engine} author subtree`);
  return target;
}
export function verifyLifecycleRoot(root) {
  requireValue(root === '/workspace/scratch/0190a8c72f8a/aperture-tmp', 'Only the adopted scratch lifecycle root is authorized');
  return root;
}
async function pins(roots) {
  const found = {};
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      requireValue(!entry.isSymbolicLink(), 'Source symlink forbidden: ' + path);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && /\.(mjs|js|json|html|css|md)$/.test(entry.name)) found[relative(repo, path)] = sha256(await readFile(path));
    }
  }
  for (const root of roots) await visit(root);
  for (const file of ['scripts/verified-webgpu.mjs', 'scripts/local-webgpu.mjs', 'scripts/serve-examples.mjs', 'tools/recovery/runtime_pressure.py', 'tools/recovery/cleanup.py', 'shadow-lab/src/compare/three.webgpu.js', 'shadow-lab/src/compare/three.core.js']) found[file] = sha256(await readFile(resolve(repo, file)));
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
}

export async function runAttempt({ engine, attempt, sourceDirectory }) {
  requireValue(['aperture', 'threejs'].includes(engine) && /^attempt-[0-9]{3}$/.test(attempt), 'Expected engine and new immutable attempt-NNN');
  requireValue(process.env.APERTURE_WEBGPU_RUNTIME?.startsWith('/') && process.env.APERTURE_TMP_RUN?.startsWith('/'), 'Existing adopted runtime_pressure lifecycle environment required');
  const lifecycleRoot = process.env.APERTURE_TMP_ROOT, lifecycleRun = process.env.APERTURE_TMP_RUN_ID, lockFd = process.env.APERTURE_TMP_LOCK_FD;
  verifyLifecycleRoot(lifecycleRoot);
  requireValue(/^run-[a-f0-9]{32}$/.test(lifecycleRun ?? '') && /^\d+$/.test(lockFd ?? ''), 'Adopted lifecycle identity missing');
  requireValue(await realpath(`/proc/self/fd/${lockFd}`) === resolve(lifecycleRoot, '.lifecycle.lock') && await realpath(process.env.APERTURE_TMP_RUN) === resolve(lifecycleRoot, lifecycleRun), 'Inherited lifecycle lock/root mismatch');
  const lifecycle = JSON.parse(await readFile(resolve(process.env.APERTURE_TMP_RUN, '.manifest.json'), 'utf8'));
  requireValue(lifecycle.schema === 'aperture.disposable-run.v2' && lifecycle.run_id === lifecycleRun && lifecycle.state === 'active', 'Active lifecycle manifest required');
  const requestedSource = verifyAuthorSourcePath(engine, resolve(repo, sourceDirectory));
  const source = verifyAuthorSourcePath(engine, await realpath(requestedSource));
  requireValue((await stat(resolve(source, 'index.html'))).isFile(), 'Author index.html missing');
  const outputParent = resolve(base, 'renders', engine);
  await mkdir(outputParent, { recursive: true });
  const output = resolve(outputParent, attempt);
  await mkdir(output, { recursive: false });
  const json = (path, value) => writeImmutable(resolve(output, path), JSON.stringify(value, null, 2) + '\n');
  const roots = [source, harness, ...baselineRoots], before = await pins(roots);
  await json('input-pins.before.json', { schema: SCHEMA, engine, attempt, source: relative(repo, source), sha256: before });
  const recorder = await createRecorder(output, { engine });
  const fallback = createExamplesRequestHandler(repo), served = [], requestErrors = [];
  const loadedInputs = new Map();
  async function noteInput(path) {
    const actual = await realpath(path), bytes = await readFile(actual), hash = sha256(bytes);
    const previous = loadedInputs.get(actual);
    requireValue(!previous || previous.sha256 === hash, 'Served input changed during attempt: ' + actual);
    loadedInputs.set(actual, { path: relative(repo, actual), sha256: hash, bytes: bytes.length });
  }
  let origin;
  const server = createServer(async (request, response) => {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    let pathname = '', body;
    try {
      requireValue(request.headers.host === new URL(origin).host, 'Unrecognized loopback Host');
      const rawPath = (request.url ?? '').split('?', 1)[0];
      pathname = decodeURIComponent(rawPath);
      requireValue(!pathname.split('/').some(part => part === '..' || part === '.') && !pathname.includes('\\') && !pathname.includes('\0'), 'Forbidden request path');
      if (request.method === 'POST') {
        requireValue(request.headers.origin === origin, 'Recorder requires exact same-origin POST');
        requireValue(pathname.startsWith('/record/'), 'Unknown POST route');
        const artifact = pathname.slice('/record/'.length), contentType = String(request.headers['content-type'] ?? '');
        body = await readBoundedBody(request, artifact.endsWith('.png') ? LIMITS.pngBytes : LIMITS.jsonBytes);
        const receipt = await recorder.record(artifact, body, contentType);
        response.writeHead(201, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(receipt)); return;
      }
      requireValue(request.method === 'GET' || request.method === 'HEAD', 'Only GET/HEAD/POST are supported');
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      if (['/packages/', '/node_modules/', '/worker-modules/'].some(prefix => pathname.startsWith(prefix))) {
        const target = pathname.startsWith('/worker-modules/') ? resolveWorkerModulePath(pathname, repo) : resolveStaticPath(pathname, repo);
        requireValue(typeof target === 'string', 'Forbidden runtime module path');
        await noteInput(target);
        served.push({ pathname, source: relative(repo, target), runtimeModule: true });
        return await fallback(request, response);
      }
      let target;
      if (pathname === '/three.webgpu.js' || pathname === '/three.core.js') target = resolve(repo, 'shadow-lab/src/compare', pathname.slice(1));
      else if (pathname.startsWith('/harness/')) target = resolve(harness, pathname.slice('/harness/'.length));
      else if (pathname.startsWith('/scene/')) target = resolve(source, pathname.slice('/scene/'.length));
      else if (pathname.startsWith('/benchmarks/')) target = resolve(repo, pathname.slice(1));
      requireValue(target && [...roots, resolve(repo, 'shadow-lab/src/compare')].some(root => within(root, target)), 'Unknown static route');
      const actual = await realpath(target);
      requireValue([...roots, resolve(repo, 'shadow-lab/src/compare')].some(root => within(root, actual)), 'Static symlink escaped allowlist');
      requireValue(['.mjs', '.js', '.html', '.css', '.json'].includes(extname(actual)), 'Static file type not permitted');
      await noteInput(actual);
      const bytes = await readFile(actual);
      served.push({ pathname, source: relative(repo, actual), sha256: sha256(bytes), bytes: bytes.length });
      response.writeHead(200, { 'Content-Type': extname(actual) === '.html' ? 'text/html; charset=utf-8' : extname(actual) === '.json' ? 'application/json' : extname(actual) === '.css' ? 'text/css' : 'text/javascript', 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      requestErrors.push({ pathname, method: request.method, message: error.message });
      if (error.partialBody) await recorder.preserveRejection(pathname, error.partialBody, error).catch(() => {});
      if (!response.headersSent && !response.destroyed) { response.writeHead(400, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ ok: false, error: error.message })); }
    }
  });
  let report, failure;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
    await json('attempt.json', { schema: SCHEMA, engine, attempt, source: relative(repo, source), startedAt: new Date().toISOString(), url: `${origin}/${relative(repo, source).split(sep).join('/')}/index.html`, viewport: { width: 1024, height: 1024 }, exploratory: true });
    report = await runVerifiedScene({ runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME, scratchRoot: process.env.APERTURE_TMP_RUN, url: `${origin}/${relative(repo, source).split(sep).join('/')}/index.html`, outputPath: resolve(output, 'verified-runner.json'), screenshotPath: resolve(output, 'final-page.png'), readyGlobal: READY_GLOBAL, viewport: { width: 1024, height: 1024 }, timeout: 900000 });
    requireValue(recorder.summary().complete && recorder.summary().acknowledged.length === 59, 'Runner ready without all acknowledged immutable state artifacts');
    requireValue(requestErrors.length === 0, 'Loopback request errors occurred');
  } catch (error) {
    failure = error;
    await json('runner-failure.json', { schema: SCHEMA, error: { name: error.name, message: error.message, stack: error.stack }, recordedAt: new Date().toISOString() });
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await recorder.flush();
    await json('recorder-summary.json', recorder.summary());
    await json('requests.json', { served, errors: requestErrors });
    const after = await pins(roots), changed = [];
    for (const [path, value] of Object.entries(before)) if (after[path] !== value) changed.push(path);
    for (const path of Object.keys(after)) if (!(path in before)) changed.push(path);
    const loaded = [];
    for (const [path, value] of loadedInputs) {
      const current = await readFile(path).catch(() => null), unchanged = current !== null && sha256(current) === value.sha256;
      loaded.push({ ...value, unchanged });
      if (!unchanged) changed.push(value.path);
    }
    await json('input-pins.after.json', { unchanged: changed.length === 0, changed, sha256: after, loadedInputs: loaded });
    if (changed.length > 0) failure ??= Error('Input sources changed during the attempt');
    await json('outcome.json', { schema: SCHEMA, status: !failure && report?.status === 'passed' ? 'passed' : 'failed', engine, attempt, states: recorder.summary().states, complete: recorder.summary().complete, sourceUnchanged: changed.length === 0, finishedAt: new Date().toISOString(), error: failure?.message ?? null });
  }
  if (failure) throw failure;
  return { status: 'passed', engine, attempt, output, states: 29, artifacts: 58 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [engine, attempt, sourceDirectory, ...extra] = process.argv.slice(2);
  if (!sourceDirectory || extra.length) throw Error('Usage: node harness/run.mjs <aperture|threejs> <attempt-NNN> <repo-relative-author-source-directory>');
  try { console.log(JSON.stringify(await runAttempt({ engine, attempt, sourceDirectory }))); }
  catch (error) { console.error(error.stack ?? String(error)); process.exitCode = 1; }
}
