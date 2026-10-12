import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

repo = Path('/workspace/aperture')
out = Path(__file__).resolve().parent
base = repo / 'benchmarks/agent-house-race-20261011/round-003/author-audits'
expected = {
    'three-r003': 'be2211129a0cc40a87dbbc7669d32ab072ec81e59a8004abee0f5596c857cd37',
    'aperture-r003': '2ae6da7601d53cc4d70c7df78808fdc2a9d22303f0cc923b4410d0a97bd579eb',
}

def pin(path):
    assert path.is_file() and not path.is_symlink(), path
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

lanes = {}
for lane, sha in expected.items():
    root = base / lane
    audit_pin = pin(root / 'audit.json')
    assert audit_pin['sha256'] == sha, audit_pin
    audit = json.loads((root / 'audit.json').read_bytes())
    assert len(audit['verificationChecks']) == 6 and all(audit['verificationChecks'].values())
    verified = []
    for name, wanted in audit['retainedFiles'].items():
        got = pin(root / name)
        assert (got['bytes'], got['sha256']) == (wanted['bytes'], wanted['sha256']), name
        verified.append(got)
    source = []
    for wanted in audit['sourceFiles']:
        got = pin(root / 'source' / wanted['path'])
        assert (got['bytes'], got['sha256']) == (wanted['bytes'], wanted['sha256']), wanted
        source.append(got)
    third = json.loads((root / 'public-records/previews/03-request.json').read_bytes())
    final_command = audit['commands'][-1]
    lanes[lane] = {
        'audit': audit_pin,
        'auditChecks': audit['verificationChecks'],
        'retainedFileCountVerified': len(verified),
        'sourceFileCountVerified': len(source),
        'sourceFiles': source,
        'retainedFiles': verified,
        'authoring': {k: audit[k] for k in ['commandCount', 'failedCommandCount', 'activeBudgetElapsedSeconds', 'elapsedSeconds', 'previewWaitSeconds', 'finishAfterBudgetExpiry', 'commandsWithSurvivingDescendants']},
        'previewStatuses': audit['previews'],
        'thirdPreviewRequestedAt': third['requestedAt'],
        'lastCommand': {k: final_command[k] for k in ['commandId', 'startedAt', 'finishedAt', 'exitCode']},
        'lastCommandAfterThirdPreview': final_command['startedAt'] > third['requestedAt'],
    }
contracts = [pin(repo / 'benchmarks/agent-house-race-20261011/round-003/setup' / name) for name in ['common-prompt.txt', 'method.json', 'sources/tools/agent-benchmark/contract.mjs']]
result = {
    'schema': 'aperture.r003-source-contract-review.v1',
    'reviewedAt': datetime.now(timezone.utc).isoformat(),
    'scope': 'Read-only retained own source/configuration and public operational transcript; manual code-presence review. No application execution, build, test, native capture, score, quality grade or author contact.',
    'status': 'retained-byte-parity-verified-source-review-complete-final-runtime-and-geometry-pending',
    'lanes': lanes,
    'contracts': contracts,
    'manualReview': pin(out / 'README.md'),
    'pending': ['Current final-build native WebGPU/worker proof and frame/viewport/camera settings', 'Complete visible mesh/instance export coverage across fixed views', 'Native upload/source positions/index/world transform parity', 'Final topology/normals/proportions facts and blind visual/geometry judgments', 'Official three serial trials per engine and performance samples'],
}
with (out / 'summary.json').open('x') as handle:
    json.dump(result, handle, indent=2)
    handle.write('\n')
print(json.dumps({'status': result['status'], 'summary': pin(out / 'summary.json'), 'verifiedRetainedFileCount': sum(v['retainedFileCountVerified'] for v in lanes.values()), 'verifiedSourceFileCount': sum(v['sourceFileCountVerified'] for v in lanes.values())}, indent=2))
