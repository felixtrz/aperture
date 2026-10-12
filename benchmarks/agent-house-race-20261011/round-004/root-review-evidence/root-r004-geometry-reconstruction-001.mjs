import assert from 'node:assert/strict';
import { readFile, lstat, realpath, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkGeometryEvidenceV2 } from '/workspace/aperture/benchmarks/agent-house-race-20261011/round-004/setup/sources/tools/agent-benchmark/geometry-evidence-v2.mjs';

const round = '/workspace/aperture/benchmarks/agent-house-race-20261011/round-004';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let binaryReceiptsVerified = 0;
async function verify(root, receipt) {
  assert.equal(receipt.ok, true);
  assert.equal(typeof receipt.path, 'string');
  assert(!path.isAbsolute(receipt.path) && !receipt.path.split('/').some(p => !p || p === '..' || p === '.'));
  const filename = path.join(root, receipt.path);
  assert.equal(await realpath(filename), filename);
  const before = await lstat(filename, {bigint: true});
  assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1n && before.size <= 4194304n);
  const raw = await readFile(filename);
  const after = await lstat(filename, {bigint: true});
  for (const k of ['ino', 'dev', 'size', 'mtimeNs', 'ctimeNs']) assert.equal(before[k], after[k]);
  assert.equal(raw.length, receipt.bytes);
  assert.equal(sha(raw), receipt.sha256);
  binaryReceiptsVerified++;
  return raw;
}
const facts = [];
for (const engine of ['aperture', 'three']) {
  for (const trial of [1, 2, 3]) {
    const root = `${round}/trials/${engine}/trial-${String(trial).padStart(2, '0')}`;
    const record = JSON.parse(await readFile(`${root}/geometry-manifest-v2.json`, 'utf8'));
    const measurement = JSON.parse(await readFile(`${root}/measurement.json`, 'utf8'));
    const result = await checkGeometryEvidenceV2(root, record, measurement, verify);
    assert.equal(result.independentlyRecomputed, true);
    assert.equal(result.exactNativePositionStreamMatches, result.meshEntries);
    assert.equal(result.missingNormalMeshEntries, 0);
    facts.push({engine, trial, ...result});
  }
}
const value = {schema: 'aperture.root-numeric-geometry-review.v1', round: 'round-004', reviewedBy: '/root', reviewedAt: new Date().toISOString(), status: 'six-full-lossless-reconstructions-passed', binaryReceiptsVerified, facts, limits: 'Full owned source numeric streams, indices, normals, transforms, multiplicity, canonical hashes and exact submitted-position witnesses were recomputed. Native position matching alone cannot prove shader/index/world-transform parity; semantic source and camera review remain separate.'};
const output = '/workspace/aperture/.aperture-env/agent-house-race/control/root-r004-geometry-reconstruction-001.json';
const raw = Buffer.from(JSON.stringify(value, null, 2) + '\n');
await writeFile(output, raw, {flag: 'wx'});
await chmod(output, 0o444);
console.log(JSON.stringify({path: output, bytes: raw.length, sha256: sha(raw)}));
