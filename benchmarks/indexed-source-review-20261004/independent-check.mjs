/** Independent read-only source review. GPU resource objects below are CPU simulations. */
import assert from 'node:assert/strict';
import { readFile, readdir, realpath, writeFile, readlink } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { collectPins } from '../indexed-shared-mesh-fanout-20261004/inputs.mjs';
import { readServedModule } from '../indexed-shared-mesh-fanout-20261004/run.mjs';
import { apertureSystem, sceneModule } from '../indexed-shared-mesh-fanout-20261004/cpu-loader.mjs';
import { proveDisabledAudioImport } from '../worker-shadow-light-matrix-20261003/import-proof.mjs';
import { SESSION_IDS, statesFor } from '../indexed-shared-mesh-fanout-20261004/contract.mjs';
import { createApertureApp, disposeApertureApp } from '../../packages/app/dist/advanced.js';
import { createPreparedMeshGpuResourceCache, prepareMeshGpuResource } from '../../packages/webgpu/dist/resources/meshes/prepared-mesh-cache.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const fixture = resolve(here, '../indexed-shared-mesh-fanout-20261004');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pins = JSON.parse(await readFile(resolve(fixture, 'prepared-001-inputs.json')));
assert.deepEqual(await collectPins(), pins, 'Fresh input discovery differs from prepared inventory');
const originalPins = JSON.parse(await readFile(resolve(repo, 'benchmarks/shared-mesh-fanout-v2-20261003/source-pins.json')));
const engineFiles = Object.keys(pins.files).filter((name) => /^packages\/[^/]+\/src\//.test(name)).sort();
assert.deepEqual([...pins.engineSourceVerified].sort(), engineFiles);
for (const name of engineFiles) assert.deepEqual(pins.files[name], originalPins.files[name], name);
assert.equal(engineFiles.length, 1159);

const preflight = JSON.parse(await readFile(resolve(fixture, 'preflight-003.json')));
const allModuleNames = new Set(Object.keys(preflight.modules));
const replay = [];
const mainSource = await readFile(resolve(fixture, 'author-a/main.mjs'), 'utf8');
const {CONFIG} = (await sceneModule()).module;
const disabledImports = [];
for (const [route, prior] of Object.entries(preflight.modules)) {
  const actual = await readServedModule(route, 'live', pins);
  assert.equal(actual.inputSha256, prior.inputSha256, route);
  assert.equal(actual.servedSha256, prior.servedSha256, route);
  assert.equal(actual.bytes, prior.bytes, route);
  const parsed = ts.createSourceFile(actual.name, actual.body.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(parsed.parseDiagnostics.length, 0, route);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert(node.arguments[0] && ts.isStringLiteral(node.arguments[0]), 'Unproven dynamic import: ' + route);
      const specifier = node.arguments[0].text;
      if (actual.name === 'packages/app/dist/browser/app.js' && specifier === './audio.js') disabledImports.push(proveDisabledAudioImport(actual.body.toString('utf8'), mainSource, CONFIG));
      else imports.push(specifier);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.deepEqual(imports, prior.imports, 'Reported import graph mismatch: ' + route);
  for (const specifier of imports) {
    assert(specifier.startsWith('/') || specifier.startsWith('.'), 'Bare or external import: ' + route);
    const target = new URL(specifier, 'http://fixture.invalid' + route);
    assert.equal(target.origin, 'http://fixture.invalid');
    assert(allModuleNames.has(target.pathname), 'Missing traversed import: ' + target.pathname);
  }
  replay.push({route, file: actual.name, inputSha256: actual.inputSha256, servedSha256: actual.servedSha256});
}
assert.equal(replay.length, 950);
assert.deepEqual(disabledImports, preflight.excludedOptionalImports);
const sessionContracts = [];
for (const session of SESSION_IDS) {
  const module = await readServedModule('/harness/contract.mjs', session, pins);
  assert(module.body.toString('utf8').includes('export const SESSION_ID = ' + JSON.stringify(session) + ';'));
  sessionContracts.push({session, states: statesFor(session).length, servedSha256: module.servedSha256});
}

// This independently exercises actual prepared GPU-cache code, instead of only
// assigning expected cache counts to synthetic validation records.
const cacheRows = [];
for (const session of SESSION_IDS) {
  const {system, scene} = await apertureSystem(session);
  let creates = 0, writes = 0;
  const device = {
    createBuffer(descriptor) {
      creates++;
      return {...descriptor, data: new Uint8Array(descriptor.size), destroy() {}};
    },
    queue: {writeBuffer(buffer, offset, data, start = 0, size) {
      writes++;
      const unit = ArrayBuffer.isView(data) ? (data.BYTES_PER_ELEMENT ?? 1) : 1;
      const backing = ArrayBuffer.isView(data) ? data.buffer : data;
      const base = ArrayBuffer.isView(data) ? data.byteOffset : 0;
      buffer.data.set(new Uint8Array(backing, base + start * unit, size === undefined ? data.byteLength - start * unit : size * unit), offset);
    }},
  };
  const cache = createPreparedMeshGpuResourceCache();
  const byTopology = new Map();
  const app = await createApertureApp({config: scene.CONFIG, systems: [{default: system.CraneCourtyard}]});
  try {
    for (const state of statesFor(session)) {
      app.context.commands.queue(system.LIVE_CHANNEL, {id: state.id, index: state.index, revision: state.index + 1});
      app.step(1/60, (state.index + 1)/60);
      app.extract(state.index + 1);
      const createdBefore = creates, writesBefore = writes;
      const outputs = [];
      for (const entry of system.sceneOwner.fixtureAssets.values()) {
        const registry = system.sceneOwner.assetsRegistry.get(entry.handle);
        const result = prepareMeshGpuResource({device, cache, handle: entry.handle, mesh: entry.asset, sourceVersion: registry.version, frame: state.index + 1});
        assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
        assert.equal(result.resource.sourceVersion, registry.version);
        const mesh = result.resource.mesh;
        for (const [i, vertex] of mesh.vertexBuffers.entries()) {
          const stream = entry.asset.vertexStreams[i];
          assert.equal(vertex.buffer.label, entry.asset.label + '/vertex:' + stream.id);
          assert.equal(vertex.buffer.usage, 40);
          assert.deepEqual(vertex.buffer.data, new Uint8Array(stream.data.buffer, stream.data.byteOffset, stream.data.byteLength));
        }
        if (entry.asset.indexBuffer) {
          const actual = mesh.indexBuffer, expected = entry.asset.indexBuffer;
          assert.equal(actual.format, 'uint16');
          assert.equal(actual.indexCount, expected.indexCount);
          assert.equal(actual.buffer.label, entry.asset.label + '/index');
          assert.equal(actual.buffer.usage, 24);
          assert.deepEqual(actual.buffer.data, new Uint8Array(expected.data.buffer, expected.data.byteOffset, expected.data.byteLength));
          const key = entry.handle.id + ':' + state.edit;
          const old = byTopology.get(key);
          if (old) {
            assert.equal(actual.buffer, old.indexBuffer.buffer, 'Reset/regrow index object changed');
            mesh.vertexBuffers.forEach((v, i) => assert.equal(v.buffer, old.vertexBuffers[i].buffer));
          } else byTopology.set(key, mesh);
        }
        outputs.push({handle: entry.handle.id, sourceVersion: registry.version, status: result.status, indexed: !!mesh.indexBuffer});
      }
      const shared = !session.startsWith('unshared-');
      const expectedCount = shared ? [5,5,8,8,11,11,11,11][state.index] : 11;
      assert.equal(cache.resources.size, expectedCount);
      if (state.noop || (shared && state.index >= 5)) assert.equal(creates, createdBefore);
      if (state.noop) assert.equal(writes, writesBefore);
      cacheRows.push({session, state: state.id, entries: cache.resources.size, buffersCreated: creates - createdBefore, writes: writes - writesBefore, outputs});
    }
  } finally { await disposeApertureApp(app); }
}

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = resolve(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Unexpected source fixture symlink');
    if (entry.isDirectory()) await walk(path);
    else {
      const bytes = await readFile(path), text = bytes.toString('utf8');
      assert(Buffer.from(text, 'utf8').equals(bytes), 'Unexpected non-UTF8 artifact');
      files.push({path: relative(fixture,path), bytes: bytes.length, sha256: sha(bytes)});
    }
  }
}
await walk(fixture);
files.sort((a,b) => a.path.localeCompare(b.path));
assert.equal(files.length, 97);
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{30,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /["']?(?:access_token|refresh_token|password|client_secret)["']?\s*[:=]\s*["'][^"']{8,}["']/i,
  /Authorization\s*:\s*["']?Bearer\s+[A-Za-z0-9._-]{12,}/i,
  /<transcript_evidence>|mcp__codex_apps__|ALL_TOOLS|dispatch_authorized|chain.of.thought|system prompt/i,
];
const scanHits = [];
for (const file of files) {
  const text = await readFile(resolve(fixture,file.path),'utf8');
  secretPatterns.forEach((pattern, index) => {if(pattern.test(text)) scanHits.push({path:file.path,pattern:index});});
}
assert.deepEqual(scanHits, []);
const report = {
  status: 'passed',
  scope: 'Independent read-only source/pin/module review and simulated-GPU prepared-cache probe; not native evidence',
  inputsSha256: sha(await readFile(resolve(fixture,'prepared-001-inputs.json'))),
  preparedReportSha256: sha(await readFile(resolve(fixture,'prepared-001-report.json'))),
  freshInputPins: Object.keys(pins.files).length,
  allEngineSourcePinsCovered: engineFiles.length,
  moduleRoutesReplayed: replay.length,
  independentlyExtractedImportEdges: true,
  disabledImports,
  sessionContracts,
  preparedCacheProbe: {states:cacheRows.length, allAssertionsPassed:true, actualInstalledCacheAlgorithm:true, simulatedGpuObjects:true, rows:cacheRows},
  publicationScan: {files: files.length, bytes: files.reduce((sum,f)=>sum+f.bytes,0), matches:scanHits, limitation:'Targeted credential/internal-content pattern scan plus source/log review; not a mathematical secrecy guarantee'},
  artifactInventory:files,
  modules:replay,
  browsersLaunched:0, serversStarted:0, nativeSessions:0,
};
const output = process.argv[2] ?? 'independent-002.json';
assert(/^independent-\d{3}\.json$/.test(output));
await writeFile(resolve(here,output), JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status, freshInputPins:report.freshInputPins, allEngineSourcePinsCovered:report.allEngineSourcePinsCovered, moduleRoutesReplayed:report.moduleRoutesReplayed, cacheStates:cacheRows.length, publicationScan:report.publicationScan, browsersLaunched:0}));
