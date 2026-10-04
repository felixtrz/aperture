#!/usr/bin/env python3
"""Verify earlier lifecycle completions; the current wrapper settles after exit."""
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path('/workspace/scratch/0190a8c72f8a/aperture-tmp')
REPO = HERE.parent.parent
EXPECTED = '1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d'
assert hashlib.sha256((REPO / 'tools/recovery/cleanup.py').read_bytes()).hexdigest() == EXPECTED
current = os.environ['APERTURE_TMP_RUN_ID']
assert os.environ['APERTURE_TMP_ROOT'] == str(ROOT)
rows = []
for path in sorted((HERE / 'lifecycle-audits').glob('*.jsonl')):
    events = [json.loads(line) for line in path.read_text().splitlines()]
    starts = [event for event in events if event.get('event') == 'run-start']
    assert len(starts) == 1, path.name
    run = starts[0]['run']
    manifest = json.loads((ROOT / run / '.manifest.json').read_text())
    if run == current:
        assert manifest['state'] == 'active'
        continue
    completed = [event for event in events if event.get('event') == 'run-completed']
    assert len(completed) == 1 and completed[0]['run'] == run, path.name
    assert manifest['state'] == 'completed' and manifest['exitcode'] == completed[0]['exitcode'], path.name
    rows.append({'audit': path.name, 'run': run, 'exitcode': manifest['exitcode'],
                 'auditSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                 'manifestSha256': hashlib.sha256((ROOT / run / '.manifest.json').read_bytes()).hexdigest(),
                 'descendantBoundary': 'cleanup.py subreaper waits for all descendants before completed'})
output = HERE / sys.argv[1]
assert output.parent == HERE and output.suffix == '.json' and not output.exists()
report = {'status': 'prior-runs-terminal', 'priorRuns': rows,
          'currentRun': current, 'currentCompletion': 'pending wrapper exit; verify its run-completed receipt after this command returns',
          'cleanupHelperSha256': EXPECTED, 'deletionPerformed': False,
          'browserLaunches': 0, 'agentDescendants': 0}
with output.open('x') as file:
    json.dump(report, file, indent=2)
    file.write('\n')
print(json.dumps({'status': report['status'], 'runs': len(rows), 'currentRun': current,
                  'nonzeroPriorRuns': [row['run'] for row in rows if row['exitcode'] != 0]}))
