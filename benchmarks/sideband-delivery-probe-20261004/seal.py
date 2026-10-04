#!/usr/bin/env python3
"""Read-only source/evidence checks and a bounded local result inventory."""
import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
ROOT = Path('/workspace/scratch/0190a8c72f8a/aperture-tmp')
def digest(data):
    return hashlib.sha256(data).hexdigest()
def read(path):
    return json.loads(path.read_bytes())

assert os.environ['APERTURE_TMP_ROOT'] == str(ROOT)
active = os.environ['APERTURE_TMP_RUN_ID']
pins = read(HERE / 'source-pins.json')
for name, pin in pins['protectedFiles'].items():
    raw = (REPO / name).read_bytes()
    assert len(raw) == pin['bytes'] and digest(raw) == pin['sha256'], name
result = read(HERE / 'final-001.json')
assert result['status'] == 'passed' and len(result['records']) == 6
for name, pin in result['fixturePins'].items():
    raw = (HERE / name).read_bytes()
    assert len(raw) == pin['bytes'] and digest(raw) == pin['sha256'], name
records = []
excluded = ['SHA256SUMS', 'seal-001.log']
for p in sorted((HERE / 'lifecycle-audits').glob('*.jsonl')):
    events = [json.loads(line) for line in p.read_text().splitlines()]
    starts = [e for e in events if e['event'] == 'run-start']
    assert len(starts) == 1
    start = starts[0]
    if start['run'] == active:
        excluded.append(str(p.relative_to(HERE)))
        continue
    completed = [e for e in events if e['event'] == 'run-completed']
    assert len(completed) == 1
    manifest = read(ROOT / start['run'] / '.manifest.json')
    assert manifest['state'] == 'completed' and manifest['exitcode'] == completed[0]['exitcode']
    assert manifest['run_id'] == start['run']
    records.append({'audit': str(p.relative_to(HERE)), 'manifest': manifest})
assert len([r for r in records if r['manifest']['exitcode'] != 0]) == 1
out = {'status': 'verified', 'protectedFiles': len(pins['protectedFiles']), 'lifecycles': records,
       'selfReferentialExclusions': excluded, 'activeSealRun': active,
       'scope': 'No browser, engine changes, publication, cleanup deletion or private-session access'}
(HERE / 'receipts.json').write_text(json.dumps(out, indent=2) + '\n')
files = []
for p in sorted(HERE.rglob('*')):
    name = str(p.relative_to(HERE))
    if p.is_file() and name not in excluded:
        files.append(f'{digest(p.read_bytes())}  {name}\n')
(HERE / 'SHA256SUMS').write_text(''.join(files))
print(json.dumps({'status': 'verified', 'protectedFilesUnchanged': len(pins['protectedFiles']),
                  'completedLifecycles': len(records), 'expectedFailedProbeAttempt': 1,
                  'inventoriedFiles': len(files), 'excludedPendingSealFiles': excluded,
                  'manifestSha256': digest((HERE / 'SHA256SUMS').read_bytes())}))
