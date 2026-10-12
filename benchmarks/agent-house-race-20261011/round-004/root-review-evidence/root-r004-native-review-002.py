from pathlib import Path
import json, hashlib, datetime, fcntl, runpy, math, statistics

R = Path('/workspace/aperture')
C = R / '.aperture-env/agent-house-race/control'
F = R / 'benchmarks/agent-house-race-20261011/round-004'
T = Path('/workspace/scratch/0190a8c72f8a/aperture-tmp')
checks = 0

def pin(p):
    p = Path(p)
    assert p.is_file() and not p.is_symlink() and p.resolve() == p
    before = p.stat()
    assert before.st_nlink == 1
    b = p.read_bytes()
    after = p.stat()
    assert (before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) == (after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)
    return {'path': str(p), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}

def verify(p, expected):
    global checks
    value = pin(p)
    assert all(value[k] == expected[k] for k in ('bytes', 'sha256')), p
    checks += 1
    return value

def proof(p):
    assert p['native'] and p['canvasWebGPU'] > 0 and p['draws'] > 0 and p['submissions'] > 0
    assert not p['webglAttempts'] and not p['errors'] and not p['deviceLost']
    assert p['adapters'] and all(a['vendor'] == 'google' and a['architecture'] == 'swiftshader' for a in p['adapters'])

capture_path = C / 'r004-official-invocation-001/result.json'
capture = json.loads(capture_path.read_text())
assert pin(capture_path)['sha256'] == '87322f7d6406deba33d87609ae46625f59af20639ba08c7e9116e2a76256b737'
assert capture['exitCode'] == 0 and capture['childWaited'] and capture['status'] == 'completed-awaiting-independent-root-review'
for key in ('stdout', 'stderr', 'driverCompletion', 'originalSummary'):
    verify(capture[key]['path'], capture[key])
promotion = json.loads((F / 'official-driver-invocation/promotion.json').read_text())
for item in promotion['copies']:
    verify(item['original']['path'], item['original'])
    verify(item['retainedCopy']['path'], item['retainedCopy'])
    assert all(item['original'][k] == item['retainedCopy'][k] for k in ('bytes', 'sha256'))
completion = json.loads(Path(capture['driverCompletion']['path']).read_text())
assert completion['exitCode'] == 0 and completion['status'] == 'six-preselected-attempts-completed'
summary = json.loads(Path(capture['originalSummary']['path']).read_text())
assert not summary['validationErrors'] and summary['status'] == 'validated-components-pending-independent-judging'
assert summary['dispatchFreezeSha256'] == 'fa42920b5bd1e9441c13a4f91d123ac688340ea990c5b569a78254c4a8e6e050'
expected_order = [('aperture', 1), ('three', 1), ('three', 2), ('aperture', 2), ('aperture', 3), ('three', 3)]
operations = []
facts = []
image_hashes = {}
geometry_hashes = {}
for ordinal, (item, expected) in enumerate(zip(completion['trialOperations'], expected_order), 1):
    verify(item['path'], item)
    o = json.loads(Path(item['path']).read_text())
    engine, trial = expected
    assert (o['engine'], o['trial'], o['ordinal']) == (engine, trial, ordinal)
    assert o['wrapperExitCode'] == 0 and o['status'] == 'completed-attempt' and o['scenePassed']
    life = o['lifecycle']
    assert life['status'] == 'completed-after-descendants-reaped' and life['childExitCode'] == 0
    for key in ('audit', 'manifest'):
        verify(life[key]['path'], life[key])
    events = [json.loads(line) for line in Path(life['audit']['path']).read_text().splitlines()]
    assert len(events) == 2 and events[0]['event'] == 'run-start' and events[1]['event'] == 'run-completed'
    assert events[0]['run'] == events[1]['run'] == life['run'] and events[1]['exitcode'] == 0
    assert events[0]['job'] == f'official-r004-{ordinal:02d}-{engine}-trial-{trial:02d}'
    retained_manifest = Path(life['manifest']['path'])
    live_manifest = T / life['run'] / '.manifest.json'
    assert live_manifest.read_bytes() == retained_manifest.read_bytes()
    manifest = json.loads(live_manifest.read_text())
    assert manifest['state'] == 'completed' and manifest['exitcode'] == 0 and manifest['run_id'] == life['run']
    for key in ('stdout', 'stderr'):
        verify(o[key]['path'], o[key])
    for x in o['retainedAttemptRecords'].values():
        verify(x['path'], x)
    b = F / f'trials/{engine}/trial-{trial:02d}'
    inputs = json.loads((b / 'inputs.json').read_text())
    assert inputs['lifecycle'] == {'root': str(T), 'run': life['run']}
    assert inputs['engine'] == engine and inputs['trial'] == trial
    for group in ('frozen-app', 'frozen-harness'):
        for x in inputs['retainedInputs'][group].values():
            verify(b / x['path'], x)
    audit = json.loads((F / f'author-audits/{engine}-r004/audit.json').read_text())
    src = Path(audit['retainedSourceRoot'])
    for path, x in inputs['inputs'].items():
        verify(src / 'dist' / path.lstrip('/'), x)
    receipts = json.loads((b / 'receipts.json').read_text())
    assert not receipts['failures'] and all(x['ok'] for x in receipts['receipts'])
    for x in receipts['receipts']:
        verify(b / x['path'], x)
    m = json.loads((b / 'measurement.json').read_text())
    v = json.loads((b / 'verified-runner.json').read_text())
    assert v['status'] == 'passed' and not v['errors']
    proof(v['proof']); proof(m['nativeProof'])
    assert len(m['warmup']) == 60 and len(m['samples']) == 120 and len(m['views']) == 3
    assert [x['frame'] for x in m['warmup']] == list(range(60))
    assert [x['frame'] for x in m['samples']] == list(range(60, 180))
    for sample in m['warmup'] + m['samples'] + [x['frame'] for x in m['views']]:
        assert sample['drawCalls'] > 0 and sample['submissions'] > 0 and sample['submittedTriangles'] > 0
        assert all(not sample[k] for k in ('unknownDirectTriangleDrawCalls', 'unknownIndirectDrawCalls', 'unknownTopologyDrawCalls', 'unknownCommandBuffers', 'unretainedKnownIndirectDrawCalls'))
        assert sample['submittedTriangleAccounting']['proofStatus'] == 'complete'
        for key in ('cpuSubmissionMs', 'applicationPromiseMs', 'queueCompletionLatencyMs', 'endToEndMs'):
            assert math.isfinite(sample[key]) and sample[key] >= 0
        assert math.isclose(sample['cpuSubmissionMs'] + sample['queueCompletionLatencyMs'], sample['endToEndMs'], abs_tol=1e-6)
    tr = summary['engines'][engine]['trials'][trial - 1]
    assert tr['status'] == 'validated'
    for key in ('cpuSubmissionMs', 'applicationPromiseMs', 'queueCompletionLatencyMs', 'endToEndMs'):
        ordered = sorted(x[key] for x in m['samples'])
        stats = {'count': len(ordered), 'min': ordered[0], 'median': ordered[math.ceil(.5 * len(ordered))-1], 'p95': ordered[math.ceil(.95 * len(ordered))-1], 'max': ordered[-1], 'mean': sum(ordered)/len(ordered)}
        assert all(math.isclose(value, tr['timing'][key][name], abs_tol=1e-6) for name, value in stats.items())
    assert all(not x[k] for x in m['samples'] for k in ('buffersCreated', 'buffersDestroyed', 'texturesCreated', 'texturesDestroyed', 'renderPipelinesCreated'))
    g = json.loads((b / 'geometry-manifest-v2.json').read_text())
    assert g['capturedAfterFrame'] == 179 and g['capturedAtNativeSubmission'] == m['observationsAfterMeasured']['submissions']
    assert g['summary'] == m['geometry']
    assert g['summary']['meshEntries'] == g['summary']['exactNativePositionStreamMatches']
    assert g['summary']['missingNormalMeshEntries'] == 0
    assert not g['nativeCapture']['skippedWrites'] and not g['nativeCapture']['skippedBytes'] and not g['nativeCapture']['incompleteBufferIds'] and not g['nativeCapture']['omittedBufferRecords']
    geometry_hashes.setdefault(engine, []).append(g['semanticGeometrySha256'])
    for number, view in enumerate(m['views'], 180):
        assert view['frame']['frame'] == number
        proof(view['proof'])
        s = view['screenshot']; verify(b / s['path'], s)
        assert s['ok'] and s['inspection']['blankCheck'] == 'passed' and (s['inspection']['width'], s['inspection']['height']) == (1024, 768)
        image_hashes.setdefault(engine + '/' + view['camera']['id'], []).append(s['sha256'])
    if engine == 'aperture':
        workers = m['workerEligibility']
        assert workers['required'] and workers['workersAfter']
        assert all(w['started'] and w['connected'] and not w['terminated'] and not w['errors'] and w['snapshotPayloadObserved'] and w['lastSnapshotFrame'] == 179 for w in workers['workersAfter'])
    facts.append({'engine': engine, 'trial': trial, 'timing': tr['timing'], 'nativeCounts': {k: tr['nativeCounts'][k] for k in ('submissions', 'drawCalls', 'submittedTriangles', 'renderPasses')}, 'geometry': g['summary'], 'semanticGeometrySha256': g['semanticGeometrySha256'], 'allSixtyWarmupAnd120MeasuredAndThreeViewFramesChecked': True, 'steadyResourcesCreatedOrDestroyed': 0, 'nativeUploadBytes': g['nativeBytes']})
    operations.append({'operation': item, 'engine': engine, 'trial': trial, 'lifecycle': life})
assert all(len(set(x)) == 1 for x in geometry_hashes.values())
gate = runpy.run_path(str(R / '.aperture-env/agent-house-race/validation/batch-003/repository-gate-002/gate.py'))
source_manifest = C.parent / 'validation/batch-003/repository-gate-002/source-manifest-after.json'
built_manifest = C.parent / 'validation/batch-003/repository-gate-002/built-engine-manifest-after.json'
for kind, path in [('source', source_manifest), ('built', built_manifest)]:
    assert gate['manifest'](kind)['files'] == json.loads(path.read_text())['files']
with (T / '.lifecycle.lock').open('rb') as stream:
    fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
    assert all(json.loads((p / '.manifest.json').read_text())['state'] in ('completed', 'retired') for p in T.glob('run-*'))
    fcntl.flock(stream, fcntl.LOCK_UN)
value = {'schema': 'aperture.root-native-round-review.v1', 'round': 'round-004', 'reviewedBy': '/root', 'reviewedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'), 'status': 'six-successful-native-attempts-independently-reviewed', 'captureResult': pin(capture_path), 'originalSummary': capture['originalSummary'], 'allSixDescendantsReapedAndCurrentManifestsMatchedRetainedCopies': True, 'sharedLifecycleLockAcquiredAndReleased': True, 'activeScratchRuns': [], 'allHashesVerified': checks, 'engineSourceAndBuiltInventoriesUnchangedIncludingAdditionsAndDeletions': True, 'trialOperations': operations, 'facts': facts, 'imageHashesAcrossTrials': image_hashes, 'semanticGeometryHashesAcrossTrials': geometry_hashes, 'combinedScoreEligible': False, 'reason': 'Predeclared harness disk failure prevented Aperture preview 3 while Three.js received three successful previews; all final runs remain diagnostic.', 'limits': 'Hash and full-frame review does not prove indices, normals or world transforms alone. Independent full numeric geometry reconstruction and semantic source/pixel reviews are separately required.'}
p = C / 'root-r004-native-review-002.json'
with p.open('x') as stream:
    json.dump(value, stream, indent=2); stream.write('\n')
p.chmod(0o444)
print(json.dumps(pin(p)))
