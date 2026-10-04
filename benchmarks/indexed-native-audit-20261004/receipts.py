#!/usr/bin/env python3
"""Read-only lifecycle and bounded publication-content review. No cleanup deletion."""
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FIXTURE = REPO / 'benchmarks/indexed-shared-mesh-fanout-20261004'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read(path):
    return json.loads(path.read_bytes())

native = []
for path in sorted((FIXTURE / 'renders/aperture').glob('*/attempt-001/verified-runner.json')):
    runner = read(path)
    run = Path(runner['launch']['requested']['executablePath']).parent.name
    matches = []
    for log in (FIXTURE / 'lifecycle-audits-native').glob('*.jsonl'):
        events = [json.loads(line) for line in log.read_text().splitlines()]
        if any(e.get('run') == run for e in events):
            matches.append((log, events))
    assert len(matches) == 1
    log, events = matches[0]
    assert events[0]['event'] == 'run-start' and events[-1]['event'] == 'run-completed' and events[-1]['exitcode'] == 0
    assert all(e.get('run') == run for e in events)
    native.append({'session': path.parent.parent.name, 'run': run, 'exitcode': 0,
                   'lifecycle': str(log.relative_to(REPO)), 'sha256': sha(log.read_bytes())})
assert len(native) == 7

ours = []
for path in sorted((HERE / 'lifecycle-audits').glob('*.jsonl')):
    events = [json.loads(line) for line in path.read_text().splitlines()]
    if events[0]['job'] == 'indexed-native-audit-receipts':
        continue  # The invoking wrapper settles after this script exits.
    assert events[0]['event'] == 'run-start' and events[-1]['event'] == 'run-completed'
    ours.append({'job': events[0]['job'], 'run': events[0]['run'], 'exitcode': events[-1]['exitcode'],
                 'path': str(path.relative_to(REPO)), 'sha256': sha(path.read_bytes())})

# Only bounded public-candidate directories, never private authority or sessions.
# Flag recognizable credential values; words like "token" in documentation are not credentials.
patterns = {
    'private-key-header': re.compile(rb'-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----'),
    'github-credential': re.compile(rb'\bgh[pousr]_[A-Za-z0-9]{30,}\b'),
    'github-fine-grained-credential': re.compile(rb'\bgithub_pat_[A-Za-z0-9_]{40,}\b'),
    'aws-access-key': re.compile(rb'\bAKIA[0-9A-Z]{16}\b'),
    'openai-credential': re.compile(rb'\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b'),
    'bearer-value': re.compile(rb'\bBearer [A-Za-z0-9._-]{32,}\b'),
    'url-embedded-credentials': re.compile(rb'https?://[^\s/:]+:[^\s/@]+@'),
}
inventory = []
findings = []
for directory in (FIXTURE, HERE):
    for path in sorted(directory.rglob('*')):
        if not path.is_file():
            continue
        assert not path.is_symlink()
        relative = str(path.relative_to(REPO))
        assert not any(part in {'.git', '.env', 'node_modules', 'authority', 'sessions'} for part in path.relative_to(directory).parts)
        data = path.read_bytes()
        if path.suffix != '.png':
            for name, pattern in patterns.items():
                if pattern.search(data):
                    findings.append({'path': relative, 'pattern': name})
        inventory.append({'path': relative, 'bytes': len(data), 'sha256': sha(data)})
assert not findings, json.dumps(findings)
output = HERE / sys.argv[1]
assert output.parent == HERE and not output.exists()
report = {'status': 'passed', 'nativeLifecycles': native, 'settledAuditLifecycles': ours,
          'preservedAuditFailures': [x for x in ours if x['exitcode'] != 0],
          'confidentiality': {'status': 'passed-pattern-screen-and-content-review', 'patterns': list(patterns),
                            'findings': findings, 'filesScreened': len(inventory),
                            'allowedContent': 'Public source, geometry, synthetic and native test evidence, local paths, task/status and nonsecret recovery metadata.',
                            'excludedContent': 'No private sessions, private reasoning, credentials, live authority or tokens copied/read.'},
          'inventory': inventory, 'nativeBrowsersStartedByAuditor': 0, 'agentDescendants': 0,
          'scope': 'No external publication verification. Parent owns Git publication and remote verification. This invoking lifecycle and later report/hash writes are covered by the final quiescence check.'}
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': 'passed', 'nativeLifecycles': len(native), 'settledAuditLifecycles': len(ours),
                  'preservedAuditFailures': len(report['preservedAuditFailures']), 'filesScreened': len(inventory), 'output': output.name}))
