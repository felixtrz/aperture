#!/usr/bin/env python3
"""Capture separately root-authorized R004 audit, official or seal phases.

Fixed commands only. Authors are spawned by root tools, never by this program.
An unapproved template cannot run. No retry, source repair or registry mutation.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import time

ROOT = Path('/workspace/aperture')
CONTROL = ROOT / '.aperture-env/agent-house-race/control'
HERE = Path(__file__).resolve().parent
ROUND = ROOT / 'benchmarks/agent-house-race-20261011/round-004'
SCRATCH = Path('/workspace/scratch/0190a8c72f8a/aperture-tmp')
ORDER = [('aperture', 1), ('three', 1), ('three', 2), ('aperture', 2), ('aperture', 3), ('three', 3)]


def require(value, message):
    if not value:
        raise RuntimeError(message)


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def pin(path, immutable=False):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and not path.is_symlink(), 'Canonical file required')
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= 128 * 1024**2, 'Bounded singly-linked regular file required')
        require(not immutable or before.st_mode & 0o222 == 0, 'Readonly evidence required')
        digest = hashlib.sha256()
        count = 0
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            count += len(block)
            digest.update(block)
        after = os.fstat(stream.fileno())
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns) and count == before.st_size,
            'Artifact changed during verification')
    return {'path': str(path), 'bytes': count, 'sha256': digest.hexdigest()}


def verified(record, immutable=False):
    actual = pin(record['path'], immutable)
    require(actual == {key: record[key] for key in ('path', 'bytes', 'sha256')}, 'Exact input pin differs: ' + record['path'])
    return actual


def document(record):
    verified(record)
    require(record['bytes'] <= 16 * 1024**2, 'Metadata bound exceeded')
    return json.loads(Path(record['path']).read_bytes())


def new(path, value):
    raw = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    with Path(path).open('xb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
        os.fchmod(stream.fileno(), 0o444)


def quiescence():
    descriptor = os.open(SCRATCH / '.lifecycle.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        states = {}
        for directory in sorted(SCRATCH.glob('run-*')):
            require(directory.resolve(strict=True) == directory and not directory.is_symlink(), 'Redirected lifecycle directory')
            manifest = json.loads((directory / '.manifest.json').read_bytes())
            require(manifest['schema'] == 'aperture.disposable-run.v2' and manifest['run_id'] == directory.name and
                    manifest['state'] in ('completed', 'retired'), 'Active or unresolved lifecycle; preserve and reconcile')
            states[manifest['state']] = states.get(manifest['state'], 0) + 1
        return {'exclusiveLockAcquiredAndReleased': True, 'manifestStates': states}
    finally:
        fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def current_inputs(pins, baseline):
    for item in baseline['currentControlSourcePins']:
        verified(item)
    for name, schema in (('gateSourceManifest', 'aperture.validation-source-manifest.v1'),
                         ('gateBuiltManifest', 'aperture.validation-built-engine-manifest.v1')):
        manifest = document(pins[name])
        require(manifest['schema'] == schema and '/validation/batch-003/' in pins[name]['path'], 'Actual batch003 inventory required')
        for relative, expected in manifest['files'].items():
            require(not Path(relative).is_absolute() and '..' not in Path(relative).parts and '\\' not in relative, 'Unsafe inventory relative path')
            actual = pin(ROOT / relative)
            require(all(actual[key] == expected[key] for key in ('bytes', 'sha256')), 'Current source/build changed: ' + relative)


def authored_inputs(pins):
    dispatch = document(pins['dispatch'])
    require(dispatch['schema'] == 'aperture.house-race-author-dispatch.v2' and dispatch['round'] == 'round-004' and
            dispatch['forkTurns'] == 'none' and dispatch['suppliedHistory'] == 'none' and dispatch['freshIndependentAuthors'] and
            dispatch['peerContactProhibited'] and dispatch['authorBudgetSeconds'] == 1800 and dispatch['previewAllowance'] == 3 and
            dispatch['officialTrialOrder'] == [engine for engine, _ in ORDER] and dispatch['fixedBlindCaptureTrial'] == 1 and
            dispatch['previewProtocol'] == 'frozen-build-v2' and dispatch['previewDiagnosticSchema'] == 'aperture.agent-house-diagnostic-preview.v3',
            'Frozen equal author contract differs')
    require(dispatch['authenticSpawnInvocations'] == pins['spawnInvocations'], 'Dispatch/spawn-record join differs')
    calls = document(pins['spawnInvocations'])
    require(calls['schema'] == 'aperture.public-author-spawn-invocations.v1' and len(calls['calls']) == 2 and
            calls['modelOverridesSupplied'] is False and calls['reasoningOverridesSupplied'] is False and
            {item['task_name'] for item in calls['calls']} == {'house_aperture_r004', 'house_three_r004'} and
            all(item['fork_turns'] == 'none' and 'model' not in item and 'reasoning_effort' not in item for item in calls['calls']),
            'Actual fresh same-default author invocations required')
    require(set(calls['returnedTaskNames']) == {'/root/house_aperture_r004', '/root/house_three_r004'}, 'Actual returned author identities differ')
    coordinator = document(pins['coordinatorResult'])
    require(coordinator['schema'] == 'aperture.preview-coordinator-result.v1' and coordinator['coordinatorExitCode'] == 0 and
            coordinator['status'] == 'closed-coordinator-after-both-finishes' and coordinator['configurationBytesUnchanged'] and
            coordinator['sourcePinsUnchanged'], 'Preview coordinator did not close correctly')


def adopted_closure(audits, job, code, output):
    records = sorted(audits.glob('*.jsonl'))
    require(len(records) == 1, 'Exactly one adopted audit required')
    events = [json.loads(line) for line in records[0].read_bytes().splitlines()]
    starts = [item for item in events if item['event'] == 'run-start']
    ends = [item for item in events if item['event'] == 'run-completed']
    require(len(starts) == len(ends) == 1 and not any(item['event'] in ('run-error', 'run-completion-audit-failed') for item in events), 'Adopted closure missing')
    start, end = starts[0], ends[0]
    require(start['run'] == end['run'] and start['job'] == job and start['root'] == end['root'] == str(SCRATCH), 'Adopted audit identity differs')
    require(end['at_ns'] >= start['at_ns'], 'Adopted lifecycle timestamp order differs')
    manifest_path = SCRATCH / start['run'] / '.manifest.json'
    manifest = json.loads(manifest_path.read_bytes())
    require(manifest['schema'] == 'aperture.disposable-run.v2' and manifest['state'] == 'completed' and manifest['run_id'] == start['run'] and
            manifest['job'] == job and manifest['exitcode'] == end['exitcode'] and
            (end['exitcode'] if end['exitcode'] >= 0 else 128 - end['exitcode']) == code, 'Actual adopted manifest/exit differs')
    new(output / 'lifecycle-audit.jsonl', records[0].read_bytes())
    new(output / 'completed-lifecycle-manifest.json', manifest_path.read_bytes())
    return {'completedAfterDescendantReaping': True, 'audit': pin(output / 'lifecycle-audit.jsonl'), 'manifest': pin(output / 'completed-lifecycle-manifest.json')}


def command_for(phase, pins, activation, baseline):
    if phase == 'audits':
        authored_inputs(pins)
        require(pins['worker']['path'] == str(HERE / 'audit-worker.py'), 'Different audit worker')
        require(not (CONTROL / 'r004-author-audits-001').exists() and
                all(not (ROUND / 'author-audits' / (engine + '-r004')).exists() for engine in ('aperture', 'three')), 'Audits already have evidence; no retry')
        return ['python3', '-B', pins['worker']['path'], '--authorization', activation['authorizationPath'], '--authorization-sha256', activation['authorizationSha256']]
    if phase == 'official':
        authored_inputs(pins)
        plan = document(pins['plan'])
        require(plan['schema'] == 'aperture.official-trial-plan.v1' and plan['round'] == 'round-004' and
                plan['roundRoot'] == str(ROUND) and plan['cwd'] == str(ROOT) and plan['scratchRoot'] == str(SCRATCH) and
                [(item['engine'], item['trial']) for item in plan['steps']] == ORDER and plan['artifactProtocol'] == baseline['artifactProtocol'], 'Exact six-attempt even-round plan differs')
        require(plan['driver'] == pins['driver'] and plan['driver']['path'] == str(ROUND / 'setup/sources/tools/agent-benchmark/official-trials-v2.py'), 'Different frozen official driver')
        require(plan['dispatchFreeze'] == pins['inputFreeze'] and plan['authorDispatch'] == pins['dispatch'], 'Official plan uses other frozen authors')
        require(plan['operationsRoot'] == str(ROUND / 'official-trial-operations') and plan['summaryOutput'] == str(ROUND / 'official-summary.json') and
                not Path(plan['operationsRoot']).exists() and not Path(plan['summaryOutput']).exists(), 'Official evidence already exists; no retry')
        for step in plan['steps']:
            require(not Path(step['outputRoot']).exists(), 'One of the six preselected attempts already exists')
        authorization = document(pins['officialAuthorization'])
        require(authorization['schema'] == 'aperture.official-trial-authorization.v1' and authorization['status'] == 'authorized' and
                authorization['round'] == 'round-004' and authorization['authorizedBy'] == '/root' and authorization['planSha256'] == pins['plan']['sha256'], 'Separate actual official authorization missing')
        return ['python3', '-B', pins['driver']['path'], '--plan', pins['plan']['path'], '--plan-sha256', pins['plan']['sha256'],
                '--authorization', pins['officialAuthorization']['path'], '--authorization-sha256', pins['officialAuthorization']['sha256']]
    require(phase in ('seal-inputs', 'seal-completed'), 'Unknown capture phase')
    specification = document(pins['sealSpec'])
    require(specification['schema'] == 'aperture.experiment-freeze-request.v1' and specification['review']['reviewedBy'] == '/root' and
            re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', specification['review']['reviewedAt']), 'Actual millisecond root seal review required')
    inventory = document(pins['exactInventory'])['files']
    require(set(specification['files']) == set(inventory), 'Reviewed exact inventory and seal spec differ')
    own_input = ROOT / 'benchmarks/agent-house-race-20261011/freezes/round-004-inputs.json'
    for relative, expected in inventory.items():
        path = ROOT / relative
        require(path.is_relative_to(ROUND) or (phase == 'seal-completed' and path == own_input), 'Seal artifact leaves the selected round')
        actual = pin(path, True)
        require(all(actual[key] == expected[key] for key in ('bytes', 'sha256')), 'Reviewed seal artifact changed')
    if phase == 'seal-completed':
        review = document(pins['completionReview'])
        require(review['schema'] == 'aperture.root-completed-benchmark-review.v1' and review['round'] == 'round-004' and review['reviewedBy'] == '/root' and
                len(review['trialOperations']) == 6 and review['allSixDescendantsReapedAndCurrentManifestsMatchedRetainedCopies'] and
                review['sharedLifecycleLockAcquiredAndReleased'] and review['activeScratchRuns'] == [], 'Actual six-attempt root closure review missing')
    target = ROOT / ('benchmarks/agent-house-race-20261011/freezes/round-004-' + ('inputs' if phase == 'seal-inputs' else 'completed') + '.json')
    require(not target.exists() and pins['sealer']['path'] == str(ROOT / 'scripts/seal-experiment-evidence.mjs'), 'Sealer/output is not the reviewed create-only route')
    return ['node', pins['sealer']['path'], '--spec', pins['sealSpec']['path'], '--output', target.relative_to(ROOT).as_posix()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=('audits', 'official', 'seal-inputs', 'seal-completed'), required=True)
    parser.add_argument('--authorization', type=Path, required=True)
    parser.add_argument('--authorization-sha256', required=True)
    args = parser.parse_args()
    authorization_pin = pin(args.authorization, True)
    require(authorization_pin['sha256'] == args.authorization_sha256, 'Outer root activation hash differs')
    activation = document(authorization_pin)
    require(activation['schema'] == 'aperture.round004-coordinator-phase-activation.v1' and activation['round'] == 'round-004' and
            activation['phase'] == args.phase and activation['status'] == 'authorized' and activation['authorizedBy'] == '/root', 'Separate phase root authorization required')
    for key in ('exclusivePhaseWindow', 'noOtherCpuNativeModelJobs', 'sourceFreezePreserved', 'priorStageReviewedAndClosed', 'registryRegistrationDeferred'):
        require(activation.get(key) is True, 'Unresolved root phase prerequisite: ' + key)
    pins = activation['pins']
    require(pins['runner'] == pin(Path(__file__).resolve(), True) and pins['sourceTemplatePins']['path'] == str(HERE / 'source-template-pins.json'), 'Different private phase runner/baseline')
    for item in pins.values():
        verified(item)
    baseline = document(pins['sourceTemplatePins'])
    current_inputs(pins, baseline)
    output = CONTROL / ('r004-' + args.phase + '-invocation-001')
    require(not output.exists(), 'Phase already has evidence; preserve without retry')
    activation['authorizationPath'] = str(args.authorization)
    activation['authorizationSha256'] = args.authorization_sha256
    inner = command_for(args.phase, pins, activation, baseline)
    before = quiescence()
    job = 'house-r004-' + args.phase + '-001'
    audits = CONTROL / ('r004-' + args.phase + '-lifecycle-audits-001')
    adopted = args.phase != 'official'
    require(not adopted or not audits.exists(), 'Adopted phase already has audit evidence')
    argv = (['python3', '-B', str(ROOT / 'tools/recovery/runtime_pressure.py'), '--root', str(SCRATCH), '--audit-dir', str(audits),
             'run', '--job', job, '--recreation', 'Root-reviewed create-only R004 ' + args.phase + '; preserve all failures without retry', '--', *inner] if adopted else inner)
    output.mkdir()
    new(output / 'root-authorization.json', args.authorization.read_bytes())
    new(output / 'quiescence-before.json', before)
    command = {'schema': 'aperture.round004-coordinator-command.v1', 'phase': args.phase, 'argv': argv, 'innerArgv': inner, 'cwd': str(ROOT),
               'startedAt': now(), 'authorization': authorization_pin, 'adoptedSingleCpuJob': adopted,
               'timeoutPolicy': 'Await actual exit and descendants; native operations retain their pinned finite deadlines, no outer kill or forced completion.'}
    new(output / 'command.json', command)
    started = time.monotonic()
    environment = os.environ.copy()
    environment['APERTURE_WEBGPU_RUNTIME'] = str(ROOT / '.aperture-env/render-runtime')
    with (output / 'stdout.bin').open('xb') as stdout, (output / 'stderr.bin').open('xb') as stderr:
        child = subprocess.Popen(argv, cwd=ROOT, env=environment, stdout=stdout, stderr=stderr)
        new(output / 'start.json', {'pid': child.pid, 'startedAt': now()})
        code = child.wait()
    result = {'schema': 'aperture.round004-coordinator-result.v1', 'phase': args.phase, 'exitCode': code, 'finishedAt': now(),
              'elapsedSeconds': time.monotonic() - started, 'childWaited': True, 'stdout': pin(output / 'stdout.bin'), 'stderr': pin(output / 'stderr.bin'),
              'registryModified': False, 'retryPermitted': False, 'publicPromotionPerformed': False}
    try:
        if adopted:
            result['lifecycle'] = adopted_closure(audits, job, code, output)
            require(code == 0, 'CPU phase failed; preserve partial evidence without retry')
        else:
            completed = document(pin(ROUND / 'official-trial-operations/execution-completed.json', True))
            require(completed['status'] in ('six-preselected-attempts-completed', 'six-preselected-attempts-completed-ineligible') and
                    completed['exitCode'] == code and len(completed['trialOperations']) == 6, 'Driver did not account for six closed attempts')
            for item in completed['trialOperations']:
                operation = document(item)
                require(operation['status'] == 'completed-attempt' and operation['lifecycle']['status'] == 'completed-after-descendants-reaped', 'Official lifecycle unresolved')
                verified(operation['lifecycle']['audit'])
                verified(operation['lifecycle']['manifest'], True)
            verified(completed['summary']['output'], True)
            result['driverCompletion'] = pin(ROUND / 'official-trial-operations/execution-completed.json', True)
            result['originalSummary'] = completed['summary']['output']
        current_inputs(pins, baseline)
        result['quiescenceAfter'] = quiescence()
        result['status'] = 'completed-awaiting-independent-root-review'
    except Exception as error:
        result['status'] = 'halted-preserve-and-reconcile'
        result['error'] = {'name': type(error).__name__, 'message': str(error)}
    new(output / 'result.json', result)
    for name in ('stdout.bin', 'stderr.bin'):
        (output / name).chmod(0o444)
    if result['status'] == 'completed-awaiting-independent-root-review' and args.phase in ('audits', 'official'):
        public = ROUND / ('author-audit-invocation' if args.phase == 'audits' else 'official-driver-invocation')
        try:
            require(not public.exists(), 'Public phase promotion already exists; preserve without overwrite')
            public.mkdir()
            copies = []
            for path in sorted(output.iterdir()):
                require(path.is_file() and not path.is_symlink(), 'Unexpected invocation artifact')
                new(public / path.name, path.read_bytes())
                copies.append({'original': pin(path), 'retainedCopy': pin(public / path.name)})
            new(public / 'capture-runner.py', Path(__file__).read_bytes())
            copies.append({'original': pin(Path(__file__).resolve()), 'retainedCopy': pin(public / 'capture-runner.py')})
            promotion = {'schema': 'aperture.round004-public-operation-promotion.v1', 'status': 'exact-public-copies-retained', 'copies': copies,
                         'separateFromOriginalResult': True, 'historicalBytesModified': False}
            new(output / 'promotion.json', promotion)
            new(public / 'promotion.json', (output / 'promotion.json').read_bytes())
        except Exception as error:
            new(output / 'promotion-failure.json', {'status': 'halted-preserve-and-reconcile', 'error': str(error), 'partialPublicOutput': str(public), 'retryPermitted': False})
            return 1
    print(json.dumps({'status': result['status'], 'phase': args.phase, 'actualExitCode': code, 'result': pin(output / 'result.json')}, indent=2))
    return code if result['status'] == 'completed-awaiting-independent-root-review' and code >= 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
