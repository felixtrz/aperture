#!/usr/bin/env python3
"""Root-authorized, create-only capture of one adopted CPU preparation lifecycle.

This file is a private template until root pins its bytes and supplies a separate
passed producer review/activation. It never activates lanes or starts authors.
"""
from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import time

ROOT = Path('/workspace/aperture')
SCRATCH = Path('/workspace/scratch/0190a8c72f8a/aperture-tmp')
PRIVATE = ROOT / '.aperture-env/agent-house-race'
PUBLIC = ROOT / 'benchmarks/agent-house-race-20261011/round-003'
OUTPUT = PRIVATE / 'control/preparation-r003-command'
AUDITS = PRIVATE / 'control/preparation-r003-lifecycle-audits'
JOB = 'house-r003-setup-001'
READINESS = PRIVATE / 'validation/batch-002/root-reviewed-readiness.json'
PRODUCER = PRIVATE / 'producer/batch-002/latest-producer-summary.json'
PRODUCER_REVIEW = PRIVATE / 'producer/root-reviewed-batch002-producer.json'
SOURCE = PRIVATE / 'validation/batch-002/repository-gate-002/source-manifest-after.json'
BUILT = PRIVATE / 'validation/batch-002/repository-gate-002/built-engine-manifest-after.json'
PREPARE = ['python3', '-B', str(ROOT / 'tools/agent-benchmark/prepare-round.py'), '--round', '3', '--prepare',
           '--validation-evidence', str(READINESS), '--reference-evidence', str(PRODUCER)]


def require(value, message):
    if not value:
        raise RuntimeError(message)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def canonical(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and not path.is_symlink(), 'Canonical unlinked absolute path required')
    return path


def pin(path):
    path = canonical(path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1, 'Regular singly-linked file required')
        sha = hashlib.sha256()
        size = 0
        while block := stream.read(1024 * 1024):
            sha.update(block)
            size += len(block)
        after = os.fstat(stream.fileno())
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns) and size == before.st_size,
            'File changed during capture verification')
    return {'path': str(path), 'bytes': size, 'sha256': sha.hexdigest()}


def verified(record, immutable=False):
    actual = pin(record['path'])
    require(actual == record, 'Exact pin differs: ' + record['path'])
    require(not immutable or canonical(record['path']).stat().st_mode & 0o222 == 0, 'Expected immutable input')
    return actual


def read_json(record):
    verified(record)
    require(record['bytes'] <= 16 * 1024 * 1024, 'Metadata JSON bound exceeded')
    return json.loads(Path(record['path']).read_bytes())


def create(path, value):
    path = Path(path)
    raw = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    with path.open('xb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
        os.fchmod(stream.fileno(), 0o444)


def check_inventories(source, built):
    require(source['schema'] == 'aperture.validation-source-manifest.v1' and
            built['schema'] == 'aperture.validation-built-engine-manifest.v1', 'Expected actual gate002 inventories')
    for manifest in (source, built):
        for relative, expected in manifest['files'].items():
            path = ROOT / relative
            require(path.resolve() == path and path.is_relative_to(ROOT), 'Manifest path leaves canonical repository')
            actual = pin(path)
            require(all(actual[key] == expected[key] for key in ('bytes', 'sha256')), 'Gate source/dist file differs: ' + relative)
    return {'sourceFiles': len(source['files']), 'builtEngineFiles': len(built['files']), 'allListedGateBytesExact': True}


def probe_quiescence():
    canonical(SCRATCH)
    fd = os.open(SCRATCH / '.lifecycle.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        states = {}
        for directory in sorted(SCRATCH.glob('run-*')):
            canonical(directory)
            manifest = json.loads((directory / '.manifest.json').read_bytes())
            require(manifest['schema'] == 'aperture.disposable-run.v2' and manifest['run_id'] == directory.name and
                    manifest['state'] in ('completed', 'retired'), 'Unresolved lifecycle; root reconciliation required')
            states[manifest['state']] = states.get(manifest['state'], 0) + 1
        return {'exclusiveNonblockingLockProbeSucceeded': True, 'manifestStateCounts': states,
                'lockReleasedBeforeWrapper': True,
                'scope': 'Cooperative prelaunch quiescence probe; root attests exclusive scheduling. The wrapper holds its normal shared lifecycle lock.'}
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def execute(authorization_path, authorization_sha):
    authorization_pin = pin(authorization_path)
    require(authorization_pin['sha256'] == authorization_sha, 'Root activation outer hash differs')
    activation = read_json(authorization_pin)
    require(activation['schema'] == 'aperture.round003-preparation-activation.v1' and activation['status'] == 'authorized' and
            activation['authorizedBy'] == '/root' and activation['round'] == 'round-003' and activation['job'] == JOB,
            'Separate actual root preparation authorization required')
    require(activation['preparerArgv'] == PREPARE and activation['cwd'] == str(ROOT), 'Exact preparer argv/cwd differs')
    for key in ('currentGate002Reviewed', 'currentProducerAndFreshnessReviewed', 'producerLifecyclesClosed',
                'exclusiveCpuWindow', 'noActiveCpuNativeOrModelJobs', 'priorAuthorsAndPreviewsClosed', 'registryRegistrationDeferred'):
        require(activation.get(key) is True, 'Root activation attestation missing: ' + key)
    pins = activation['pins']
    required = {'runner': str(Path(__file__).resolve()), 'readiness': str(READINESS), 'producerSummary': str(PRODUCER),
                'rootProducerReview': str(PRODUCER_REVIEW), 'prepareScript': str(ROOT / 'tools/agent-benchmark/prepare-round.py'),
                'method': str(ROOT / 'benchmarks/agent-house-race-20261011/method.json'),
                'reference': str(ROOT / 'benchmarks/agent-house-race-20261011/reference.png'),
                'gateSourceManifest': str(SOURCE), 'gateBuiltManifest': str(BUILT),
                'runtimeWrapper': str(ROOT / 'tools/recovery/runtime_pressure.py'), 'cleanupCore': str(ROOT / 'tools/recovery/cleanup.py')}
    require(set(pins) == set(required), 'Exact activation pin set required')
    for key, path in required.items():
        require(pins[key]['path'] == path, 'Activation path differs: ' + key)
        verified(pins[key])
    readiness, producer, review = (read_json(pins[key]) for key in ('readiness', 'producerSummary', 'rootProducerReview'))
    require(readiness['status'] == 'passed' and readiness['reviewedBy'] == '/root' and readiness['batch'] == 'batch-002' and
            readiness['canonicalGateReviewed'] and readiness['completeCoverageReviewed'] and readiness['nativeGeometryV2Reviewed'], 'Passed canonical readiness is missing')
    require(readiness['gateSourceManifest'] == pins['gateSourceManifest'] and readiness['gateBuiltManifest'] == pins['gateBuiltManifest'], 'Readiness inventory joins differ')
    require(producer['schema'] == 'aperture.latest-reference-producer-summary.v1' and producer['batch'] == 'batch-002' and
            producer['status'] == 'passed' and producer['freshness']['exitCode'] == 0 and
            producer['rootReviewedReadiness'] == pins['readiness'] and not producer['source']['capturedSourceChanges'] and
            not producer['source']['builtEngineChanges'], 'Passed current real producer/freshness joins differ')
    require(review['status'] == 'passed' and review['reviewedBy'] == '/root' and review['batch'] == 'batch-002' and
            review['summary'] == pins['producerSummary'] and review['readyForSdkPreparation'] and
            review['producerAndFreshnessClosedAndReaped'] and review['sharedLifecycleLockReleased'] and
            review['sourceAndBuiltInventoryMatchedCurrentBytes'], 'Separate actual root producer review missing')
    source, built = read_json(pins['gateSourceManifest']), read_json(pins['gateBuiltManifest'])
    method = read_json(pins['method'])
    require(method['weights'] == {'visual': .4, 'geometry': .2, 'runtime': .25, 'authoringTime': .15} and
            method['authorBudgetSeconds'] == 1800 and method['previewAllowance'] == 3 and method['trialsPerEngine'] == 3 and
            method['engines']['three'] == '0.186.1' and method['referenceSha256'] == pins['reference']['sha256'] ==
            '0f28db644bd9bb627495272fd4102b45c5e2f3ffecf8a71ef169daf8096999fa', 'Frozen shared method/reference differs')
    before = check_inventories(source, built)
    require(not OUTPUT.exists() and not AUDITS.exists() and not PUBLIC.exists(), 'Create-only preparation already has output; preserve without retry')
    for path in (PRIVATE / 'sdk/round-003', PRIVATE / 'lanes/round-003', PRIVATE / 'control/lanes-r003.pending.json', PRIVATE / 'control/setup-r003-logs'):
        require(not path.exists(), 'Create-only preparer destination already exists')
    quiescence = probe_quiescence()
    OUTPUT.mkdir()
    create(OUTPUT / 'activation-authorization.json', Path(authorization_path).read_bytes())
    create(OUTPUT / 'source-and-dist-before.json', before)
    create(OUTPUT / 'prelaunch-quiescence.json', quiescence)
    wrapped = ['python3', '-B', str(ROOT / 'tools/recovery/runtime_pressure.py'), '--root', str(SCRATCH),
               '--audit-dir', str(AUDITS), 'run', '--job', JOB, '--recreation',
               'Reproduce current built round003 SDK and two isolated blank author lanes from exact root-reviewed gate002 and real producer pins; no browser or author dispatch', '--', *PREPARE]
    command = {'schema': 'aperture.round-preparation-command.v2', 'cwd': str(ROOT), 'argv': wrapped, 'preparerArgv': PREPARE,
               'startedAt': now(), 'environmentOverlay': {'APERTURE_WEBGPU_RUNTIME': str(ROOT / '.aperture-env/render-runtime')},
               'rootAuthorization': authorization_pin, 'timeoutPolicy': 'Await adopted wrapper and all descendants; no external timer, kill or forced completion'}
    create(OUTPUT / 'command.json', command)
    started = time.monotonic()
    environment = os.environ.copy()
    environment['APERTURE_WEBGPU_RUNTIME'] = str(ROOT / '.aperture-env/render-runtime')
    with (OUTPUT / 'stdout.bin').open('xb') as stdout, (OUTPUT / 'stderr.bin').open('xb') as stderr:
        completed = subprocess.run(wrapped, cwd=ROOT, env=environment, stdout=stdout, stderr=stderr, check=False)
    result = {'schema': 'aperture.round-preparation-command-result.v2', 'startedAt': command['startedAt'], 'completedAt': now(),
              'exitCode': completed.returncode, 'elapsedSeconds': time.monotonic() - started,
              'stdout': pin(OUTPUT / 'stdout.bin'), 'stderr': pin(OUTPUT / 'stderr.bin'), 'publicReceiptsCopied': False}
    try:
        audit_files = sorted(AUDITS.glob('*.jsonl'))
        require(len(audit_files) == 1, 'Exactly one adopted lifecycle audit required')
        events = [json.loads(line) for line in audit_files[0].read_text().splitlines()]
        starts = [event for event in events if event.get('event') == 'run-start']
        ends = [event for event in events if event.get('event') == 'run-completed']
        require(len(starts) == len(ends) == 1 and starts[0]['job'] == JOB and starts[0]['run'] == ends[0]['run'], 'Adopted lifecycle audit join differs')
        manifest = SCRATCH / starts[0]['run'] / '.manifest.json'
        manifest_value = json.loads(manifest.read_bytes())
        require(manifest_value['state'] == 'completed' and manifest_value['exitcode'] == ends[0]['exitcode'] and
                (ends[0]['exitcode'] if ends[0]['exitcode'] >= 0 else 128 - ends[0]['exitcode']) == completed.returncode,
                'Wrapper/preparer lifecycle completion differs')
        create(OUTPUT / 'completed-lifecycle-manifest.json', manifest.read_bytes())
        create(OUTPUT / 'lifecycle-audit.jsonl', audit_files[0].read_bytes())
        result['lifecycle'] = {'run': starts[0]['run'], 'completedAfterDescendantReaping': True,
                               'audit': pin(OUTPUT / 'lifecycle-audit.jsonl'), 'manifest': pin(OUTPUT / 'completed-lifecycle-manifest.json')}
        require(completed.returncode == 0, 'Preparation failed; partial output and containers preserved without retry or public success copies')
        after = check_inventories(source, built)
        create(OUTPUT / 'source-and-dist-after.json', after)
        create(OUTPUT / 'post-preparation-quiescence.json', probe_quiescence())
        for record in pins.values():
            verified(record)
        prepared_path = PUBLIC / 'setup/preparation.json'
        prepared = json.loads(prepared_path.read_bytes())
        require(prepared['status'] == 'prepared-not-activated' and prepared['round'] == 'round-003' and
                prepared['previewDiagnosticSchema'] == 'aperture.agent-house-diagnostic-preview.v3' and
                prepared['previewCoordinator'] == 'tools/agent-benchmark/preview-service-v3.py' and
                prepared['officialTrialRunner'] == 'tools/agent-benchmark/run-v2.mjs', 'Successful preparer protocol/status differs')
        require(prepared['validationEvidence']['sha256'] == pins['readiness']['sha256'] and
                prepared['referenceEvidence']['sha256'] == pins['producerSummary']['sha256'], 'Prepared readiness/producer copies differ')
        public_operations = PUBLIC / 'preparation-operations'
        require(not public_operations.exists(), 'Public invocation output must be new')
        public_operations.mkdir()
        result['status'] = 'prepared-awaiting-root-input-review-no-activation'
        result['prepared'] = pin(prepared_path)
        result['publicReceiptsCopied'] = True
        create(OUTPUT / 'result.json', result)
        # These exact verified receipts expose no process environment or raw
        # dependency/Docker logs. The immutable setup tree is never modified.
        names = ('activation-authorization.json', 'command.json', 'stdout.bin', 'stderr.bin', 'result.json',
                 'source-and-dist-before.json', 'source-and-dist-after.json', 'prelaunch-quiescence.json',
                 'post-preparation-quiescence.json', 'completed-lifecycle-manifest.json', 'lifecycle-audit.jsonl')
        for name in names:
            create(public_operations / name, (OUTPUT / name).read_bytes())
        create(public_operations / 'capture-runner.py', Path(__file__).read_bytes())
        print(json.dumps({'status': result['status'], 'publicOperations': str(public_operations), 'result': pin(OUTPUT / 'result.json')}))
        return 0
    except Exception as error:
        result['status'] = 'failed-preserved-awaiting-root-reconciliation'
        result['error'] = {'name': type(error).__name__, 'message': str(error)}
        if not (OUTPUT / 'result.json').exists():
            create(OUTPUT / 'result.json', result)
        else:
            create(OUTPUT / 'public-copy-failure.json', result)
        print(json.dumps({'status': result['status'], 'evidence': str(OUTPUT), 'error': result['error']}))
        return 1
    finally:
        for path in OUTPUT.iterdir():
            if path.is_file():
                path.chmod(0o444)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--authorization', type=Path, required=True)
    parser.add_argument('--authorization-sha256', required=True)
    args = parser.parse_args()
    return execute(args.authorization, args.authorization_sha256)


if __name__ == '__main__':
    raise SystemExit(main())
