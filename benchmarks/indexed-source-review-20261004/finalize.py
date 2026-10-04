#!/usr/bin/env python3
"""Verify immutable inputs, completed prior lifecycles and final review artifacts."""
import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FIXTURE = REPO / 'benchmarks/indexed-shared-mesh-fanout-20261004'
ROOT = Path('/workspace/scratch/0190a8c72f8a/aperture-tmp')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def pin(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': sha(data)}

independent = json.loads((HERE / 'independent-002.json').read_text())
assert independent['status'] == 'passed'
assert independent['independentlyExtractedImportEdges'] is True
assert independent['preparedCacheProbe']['states'] == 14
assert independent['publicationScan']['matches'] == []
for item in independent['artifactInventory']:
    assert pin(FIXTURE / item['path']) == {k: item[k] for k in ('bytes', 'sha256')}
assert len(list(p for p in FIXTURE.rglob('*') if p.is_file())) == 97
assert pin(FIXTURE / 'prepared-001-report.json')['sha256'] == '834eec6264957cdd7335a5cbb6c80a5890658e4ddce310acc6bddebeff6e195c'
assert pin(FIXTURE / 'prepared-001-inputs.json')['sha256'] == 'fef6b28b570cb35ac93c154b8c652d61a6e7090458207c656fe992d38d800099'

prior_runs = []
current_run = os.environ['APERTURE_TMP_RUN_ID']
current_audit = None
for path in sorted((HERE / 'lifecycle-audits').glob('*.jsonl')):
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    start = next(row for row in rows if row['event'] == 'run-start')
    if start['run'] == current_run:
        current_audit = path.relative_to(HERE).as_posix()
        continue
    completed = [row for row in rows if row['event'] == 'run-completed']
    assert len(completed) == 1 and completed[0]['exitcode'] == 0
    manifest = ROOT / start['run'] / '.manifest.json'
    record = json.loads(manifest.read_text())
    assert record['state'] == 'completed'
    prior_runs.append({'run': start['run'], 'job': start['job'], 'audit': path.relative_to(HERE).as_posix(), 'auditPin': pin(path), 'manifestPin': pin(manifest), 'state': record['state'], 'exitcode': completed[0]['exitcode']})
assert len(prior_runs) == 3
assert current_audit is not None
artifact_names = ['REPORT.md', 'independent-check.mjs', 'finalize.py', 'cpu-001.log', 'independent-001.json', 'independent-001.log', 'independent-002.json', 'independent-002.log']
report = {
    'status': 'source-review-passed',
    'admissionRecommendation': 'Ready for immutable freeze and separate bounded native admission; not native execution authorization or native success',
    'blockingFindings': [],
    'sourceDirectory': FIXTURE.relative_to(REPO).as_posix(),
    'preparedReport': pin(FIXTURE / 'prepared-001-report.json'),
    'preparedInputs': pin(FIXTURE / 'prepared-001-inputs.json'),
    'sourceFixtureUnchanged': True,
    'fixtureFiles': 97,
    'fixtureBytes': sum(row['bytes'] for row in independent['artifactInventory']),
    'fixtureInventoryCanonicalSha256': sha((json.dumps(independent['artifactInventory'], sort_keys=True, separators=(',', ':')) + '\n').encode()),
    'inputPins': 6448,
    'engineSourcePins': 1159,
    'servedModuleRoutes': 950,
    'focusTests': {'tests': 80, 'passed': 80, 'failed': 0, 'log': 'cpu-001.log'},
    'independentPreparedCacheStates': 14,
    'publicationExclusions': [],
    'artifacts': {name: pin(HERE / name) for name in artifact_names},
    'completedPriorRuns': prior_runs,
    'finalization': {'run': current_run, 'audit': current_audit, 'terminalReceipt': 'The cleanup wrapper appends run-completed after this report writer and all descendants exit. Require that terminal receipt alongside this report.'},
    'limits': ['CPU simulated GPU objects only', 'No source-to-dist independent rebuild', 'No native sessions/captures/RGB comparisons', 'No full repository validation', 'No GPU readback/performance/memory/hardware-portability claims', 'No formal author/model/transcript/scoring/cross-engine claims', 'No remote Git verification by this reviewer'],
    'nativeSessions': 0, 'nativeCaptures': 0, 'browsersLaunched': 0, 'serversStarted': 0,
    'scope': 'Only the separate source-review directory and managed lifecycle metadata were written. No fixture/engine/dependency edits, installs, native execution, descendants, deletion or Git publication.'
}
with (HERE / 'review-001.json').open('x') as file:
    json.dump(report, file, indent=2)
    file.write('\n')
print(json.dumps({'status': report['status'], 'blockingFindings': [], 'priorTerminalRuns': len(prior_runs), 'currentRun': current_run, 'review': 'review-001.json', 'reviewSha256': pin(HERE / 'review-001.json')['sha256']}))
