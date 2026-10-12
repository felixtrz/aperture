#!/usr/bin/env python3
"""Private, root-authorized six-attempt driver. Never retries or repairs evidence."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import stat
import subprocess
import time

ROOT = Path('/workspace/aperture')
ORDER = [('aperture', 1), ('three', 1), ('three', 2), ('aperture', 2), ('aperture', 3), ('three', 3)]
CHECKS = ('publicEventHashChain', 'commandRecordAndOutputParity', 'publicPromptAndReferencePins', 'monotonicBudgetWaitAccounting', 'finishedWorkspaceSourceHashes', 'retainedCopiesReadBack')


def require(value, message):
    if not value:
        raise RuntimeError(message)


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_file(path, immutable=False):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path, 'Noncanonical or linked input: ' + str(path))
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'Input must be a regular unlinked file: ' + str(path))
    require(not immutable or info.st_mode & 0o222 == 0, 'Expected immutable input: ' + str(path))
    raw = path.read_bytes()
    require(info.st_size == len(raw), 'Input size changed: ' + str(path))
    return raw


def pin(path):
    raw = read_file(path)
    return {'path': str(path), 'bytes': len(raw), 'sha256': digest(raw)}


def verify_pin(record, immutable=False):
    raw = read_file(record['path'], immutable)
    require(len(raw) == record['bytes'] and digest(raw) == record['sha256'], 'Pinned input differs: ' + record['path'])
    return raw


def write_new(path, raw):
    with Path(path).open('xb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    Path(path).chmod(0o444)


def write_json(path, value):
    write_new(path, (json.dumps(value, indent=2) + '\n').encode())


def safe_relative(value):
    path = Path(value)
    require(isinstance(value, str) and value and not path.is_absolute() and '\\' not in value and '\x00' not in value and all(part not in ('', '.', '..') for part in value.split('/')), 'Invalid retained relative path')
    return path


def validate_author(engine, record, plan):
    expected = Path(plan['roundRoot']) / 'author-audits' / (engine + '-r002')
    require(record['path'] == str(expected / 'audit.json'), 'Author audit belongs outside the selected lane')
    audit = json.loads(verify_pin(record, True))
    require(audit['schema'] == 'aperture.author-audit.v1' and audit['status'] == 'verified' and audit['engine'] == engine and audit['lane'] == engine + '-r002', 'Author audit is not verified for this engine')
    require(all(audit.get('verificationChecks', {}).get(key) is True for key in CHECKS), 'Author audit verification is incomplete')
    require(audit['retainedSourceRoot'] == str(expected / 'source') and audit['retainedBuiltAppRoot'] == str(expected / 'source/dist'), 'Retained author paths differ')
    finish_raw = read_file(expected / 'public-records/finish.json', True)
    require(digest(finish_raw) == audit['finishSha256'], 'Retained author finish pin differs')
    finish = json.loads(finish_raw)
    require(finish['files'] == audit['sourceFiles'], 'Finish/source audit inventory differs')
    inventory = {}
    for item in audit['sourceFiles']:
        relative = safe_relative(item['path'])
        require(item['path'] not in inventory, 'Duplicate source inventory')
        raw = read_file(expected / 'source' / relative, True)
        require(len(raw) == item['bytes'] and digest(raw) == item['sha256'], 'Retained source changed after author audit')
        inventory[item['path']] = {'bytes': len(raw), 'sha256': digest(raw)}
    built = {}
    app = expected / 'source/dist'
    require(app.resolve(strict=True) == app, 'Retained built app is noncanonical')
    for current, directories, files in os.walk(app, followlinks=False):
        for name in directories:
            require(not (Path(current) / name).is_symlink(), 'Built app contains a linked directory')
        for name in files:
            path = Path(current) / name
            relative = path.relative_to(app).as_posix()
            raw = read_file(path, True)
            expected_pin = inventory.get('dist/' + relative)
            actual = {'bytes': len(raw), 'sha256': digest(raw)}
            require(actual == expected_pin, 'Built app differs from exact finished source inventory')
            built['/' + relative] = actual
    require('/index.html' in built and len(built) == sum(key.startswith('dist/') for key in inventory), 'Built app inventory missing or extra files')
    return {'auditPin': record, 'finishSha256': audit['finishSha256'], 'appRoot': str(app), 'appInputs': built, 'sourceFileCount': len(inventory)}


def verify_control(plan):
    freeze = json.loads(verify_pin(plan['dispatchFreeze'], True))
    frozen = freeze['provenance']['inputs']
    for item in plan['sourcePins']:
        verify_pin(item)
        if item['repositoryPath'] in frozen:
            entry = frozen[item['repositoryPath']]
            require(entry['sha256'] == item['sha256'] and entry['bytes'] == item['bytes'], 'Control no longer matches dispatch freeze')
            snapshot = {'path': str(ROOT / entry['snapshotPath']), 'bytes': entry['bytes'], 'sha256': entry['sha256']}
            verify_pin(snapshot, True)
    verify_pin(plan['method'], True)
    verify_pin(plan['preparation'], True)
    verify_pin(plan['authorDispatch'], True)
    dispatch = json.loads(read_file(plan['authorDispatch']['path'], True))
    preparation = json.loads(read_file(plan['preparation']['path'], True))
    require(dispatch['officialTrialOrder'] == [engine for engine, _ in ORDER] and preparation['trialOrder'] == [engine for engine, _ in ORDER], 'Preselected order differs from frozen round dispatch/preparation')
    require(dispatch['dispatchFreeze']['sha256'] == plan['dispatchFreeze']['sha256'], 'Author dispatch joins a different freeze')


def require_quiescent(plan):
    """Cooperative scheduling check; root separately attests an exclusive window."""
    scratch = Path(plan['scratchRoot'])
    require(scratch.resolve(strict=True) == scratch, 'Scratch root is noncanonical')
    descriptor = os.open(scratch / '.lifecycle.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for candidate in scratch.glob('run-*'):
            require(candidate.is_dir() and not candidate.is_symlink(), 'Unknown lifecycle entry; root reconciliation required')
            manifest = json.loads(read_file(candidate / '.manifest.json'))
            require(manifest['schema'] == 'aperture.disposable-run.v2' and manifest['run_id'] == candidate.name and manifest['state'] in ('completed', 'retired'), 'Active or unresolved lifecycle; root reconciliation required')
    finally:
        os.close(descriptor)


def lifecycle_evidence(operation, step, returncode, plan):
    audits = sorted((operation / 'lifecycle-audits').glob('*.jsonl'))
    require(len(audits) == 1, 'Missing or ambiguous lifecycle audit')
    raw = read_file(audits[0])
    events = [json.loads(line) for line in raw.splitlines() if line]
    starts = [event for event in events if event['event'] == 'run-start']
    completed = [event for event in events if event['event'] == 'run-completed']
    require(len(starts) == len(completed) == 1, 'Lifecycle did not finish with a unique run-completed event')
    require(not any(event['event'] in ('run-error', 'run-completion-audit-failed') for event in events), 'Lifecycle error requires reconciliation')
    start, finish = starts[0], completed[0]
    require(start['root'] == finish['root'] == plan['scratchRoot'] and start['job'] == step['job'] and start['run'] == finish['run'] and finish['at_ns'] >= start['at_ns'], 'Lifecycle audit identity/order differs')
    require(start['run'].startswith('run-') and len(start['run']) == 36 and all(c in '0123456789abcdef' for c in start['run'][4:]), 'Invalid lifecycle run ID')
    manifest_path = Path(plan['scratchRoot']) / start['run'] / '.manifest.json'
    manifest_raw = read_file(manifest_path)
    manifest = json.loads(manifest_raw)
    require(manifest['schema'] == 'aperture.disposable-run.v2' and manifest['state'] == 'completed' and manifest['run_id'] == start['run'] and manifest['job'] == step['job'], 'Lifecycle completion manifest differs')
    require(manifest['exitcode'] == finish['exitcode'] and (finish['exitcode'] if finish['exitcode'] >= 0 else 128 - finish['exitcode']) == returncode, 'Wrapper/child lifecycle exit codes differ')
    require(manifest['completed_ns'] >= manifest['created_ns'], 'Invalid lifecycle completion timing')
    write_new(operation / 'completed-lifecycle-manifest.json', manifest_raw)
    return {'status': 'completed-after-descendants-reaped', 'run': start['run'], 'childExitCode': finish['exitcode'], 'audit': pin(audits[0]), 'manifest': pin(operation / 'completed-lifecycle-manifest.json'), 'completionBasis': 'Pinned wrapper persists completion only after child wait, descendant reaping and runtime registration; no external timeout substitutes for completion.'}


def run_step(step, plan, author, operation):
    require_quiescent(plan)
    verify_control(plan)
    refreshed = validate_author(step['engine'], author['auditPin'], plan)
    require(refreshed == author, 'Audited final inputs changed between trials')
    require(not os.path.lexists(step['outputRoot']) and not os.path.lexists(operation), 'Preselected attempt or operation already exists; no retry is allowed')
    operation.mkdir(mode=0o700)
    command = {'schema': 'aperture.official-trial-command.v1', 'recordedAt': now(), 'ordinal': step['ordinal'], 'engine': step['engine'], 'trial': step['trial'], 'argv': step['argv'], 'shellDisplay': shlex.join(step['argv']), 'cwd': str(ROOT), 'environmentOverlay': {'APERTURE_WEBGPU_RUNTIME': plan['runtimeRoot']}, 'appInputs': author, 'outputDirectoryPrecreated': False, 'timeoutPolicy': 'Await wrapper to completion; no driver timer, retry or forced lifecycle completion.'}
    write_json(operation / 'command.json', command)
    environment = os.environ.copy()
    environment['APERTURE_WEBGPU_RUNTIME'] = plan['runtimeRoot']
    started_at = now()
    start = time.monotonic_ns()
    with (operation / 'stdout.bin').open('xb') as stdout, (operation / 'stderr.bin').open('xb') as stderr:
        result = subprocess.run(step['argv'], cwd=ROOT, env=environment, stdout=stdout, stderr=stderr, check=False)
    elapsed = (time.monotonic_ns() - start) / 1e9
    record = {'schema': 'aperture.official-trial-operation.v1', 'startedAt': started_at, 'finishedAt': now(), 'ordinal': step['ordinal'], 'engine': step['engine'], 'trial': step['trial'], 'wrapperExitCode': result.returncode, 'processWallSeconds': elapsed, 'processWallMeaning': 'Full wrapper process from spawn through awaited exit, including browser startup, all warmup/measurement/captures, teardown and descendant reaping; separate from measured frame timing.', 'stdout': pin(operation / 'stdout.bin'), 'stderr': pin(operation / 'stderr.bin'), 'outcome': None, 'lifecycle': None}
    try:
        record['lifecycle'] = lifecycle_evidence(operation, step, result.returncode, plan)
        output = Path(step['outputRoot'])
        for name in ('outcome.json', 'inputs.json', 'receipts.json', 'verified-runner.json', 'failure.json', 'measurement.json'):
            if (output / name).is_file():
                record.setdefault('retainedAttemptRecords', {})[name] = pin(output / name)
        if (output / 'outcome.json').is_file():
            record['outcome'] = json.loads(read_file(output / 'outcome.json'))
        if (output / 'inputs.json').is_file():
            inputs = json.loads(read_file(output / 'inputs.json'))
            require(inputs['engine'] == step['engine'] and inputs['trial'] == step['trial'] and inputs['lifecycle']['run'] == record['lifecycle']['run'] and inputs['inputs'] == author['appInputs'], 'Actual attempt input/lifecycle identity differs')
        require_quiescent(plan)
        record['status'] = 'completed-attempt'
        record['scenePassed'] = result.returncode == 0 and record['outcome'] is not None and record['outcome'].get('status') == 'passed'
    except Exception as error:
        record['status'] = 'halted-unresolved-or-invalid-control'
        record['error'] = str(error)
        write_json(operation / 'operation.json', record)
        raise
    finally:
        for path in operation.rglob('*'):
            if path.is_file() and not path.is_symlink():
                path.chmod(0o444)
    write_json(operation / 'operation.json', record)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True, type=Path)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--authorization', required=True, type=Path)
    parser.add_argument('--authorization-sha256', required=True)
    args = parser.parse_args()
    raw = read_file(args.plan, True)
    require(digest(raw) == args.plan_sha256, 'Plan pin differs')
    plan = json.loads(raw)
    require(plan['schema'] == 'aperture.official-trial-plan.v1' and plan['round'] == 'round-002', 'Wrong official trial plan')
    require([(step['engine'], step['trial']) for step in plan['steps']] == ORDER, 'Preselected six-attempt order differs')
    verify_pin(plan['driver'], True)
    require(Path(plan['driver']['path']) == Path(__file__).resolve(), 'Different driver invoked')
    authorization_raw = read_file(args.authorization, True)
    require(digest(authorization_raw) == args.authorization_sha256, 'Root authorization pin differs')
    authorization = json.loads(authorization_raw)
    require(authorization['schema'] == 'aperture.official-trial-authorization.v1' and authorization['round'] == plan['round'] and authorization['planSha256'] == args.plan_sha256 and authorization['authorizedBy'] == '/root' and authorization['status'] == 'authorized', 'Explicit root authorization missing')
    for key in ('finalAuthorAuditsReviewed', 'noFurtherAuthorEdits', 'previewCoordinatorExited', 'measurementWindowExclusive', 'lifecycleQuiescenceReviewed'):
        require(authorization.get(key) is True, 'Required root readiness attestation missing: ' + key)
    verify_control(plan)
    require_quiescent(plan)
    authors = {engine: validate_author(engine, authorization['authorAudits'][engine], plan) for engine in ('aperture', 'three')}
    operations = Path(plan['operationsRoot'])
    require(not os.path.lexists(operations) and not os.path.lexists(plan['summaryOutput']), 'Official execution already has evidence; preserve it without retry')
    for step in plan['steps']:
        require(not os.path.lexists(step['outputRoot']), 'A preselected attempt already exists')
    operations.mkdir(mode=0o700)
    write_new(operations / 'launch-plan.json', raw)
    write_new(operations / 'root-authorization.json', authorization_raw)
    write_new(operations / 'driver.py', read_file(plan['driver']['path'], True))
    write_json(operations / 'execution-start.json', {'schema': 'aperture.official-trial-execution.v1', 'startedAt': now(), 'planSha256': digest(raw), 'authorizationSha256': digest(authorization_raw), 'authors': authors, 'measurementSchedulerScope': 'Sequential driver plus root-attested exclusive CPU/render window; cooperative coordination, not provider fencing.'})
    results = []
    try:
        for step in plan['steps']:
            operation = operations / step['operationName']
            print('Starting official attempt ' + step['operationName'], flush=True)
            record = run_step(step, plan, authors[step['engine']], operation)
            results.append(record)
            print('Completed official attempt ' + step['operationName'] + ': scenePassed=' + str(record['scenePassed']), flush=True)
        verify_control(plan)
        summary_command = plan['summaryArgv']
        write_json(operations / 'summary-command.json', {'argv': summary_command, 'shellDisplay': shlex.join(summary_command), 'cwd': str(ROOT), 'recordedAt': now(), 'scope': 'Offline immutable validation; visual/geometry/combined judgment remains pending independent reviews.'})
        started_at = now()
        start = time.monotonic_ns()
        with (operations / 'summary-stdout.bin').open('xb') as stdout, (operations / 'summary-stderr.bin').open('xb') as stderr:
            summary = subprocess.run(summary_command, cwd=ROOT, stdout=stdout, stderr=stderr, check=False)
        summary_record = {'exitCode': summary.returncode, 'startedAt': started_at, 'finishedAt': now(), 'processWallSeconds': (time.monotonic_ns() - start) / 1e9, 'stdout': pin(operations / 'summary-stdout.bin'), 'stderr': pin(operations / 'summary-stderr.bin'), 'output': pin(Path(plan['summaryOutput'])) if Path(plan['summaryOutput']).is_file() else None}
        write_json(operations / 'summary-operation.json', summary_record)
        require(summary.returncode == 0 and summary_record['output'] is not None, 'Offline summary failed; preserve all six attempts without rerun')
        Path(plan['summaryOutput']).chmod(0o444)
        write_json(operations / 'execution-completed.json', {'schema': 'aperture.official-trial-execution.v1', 'finishedAt': now(), 'status': 'six-preselected-attempts-completed', 'trialOperations': [pin(operations / step['operationName'] / 'operation.json') for step in plan['steps']], 'summary': summary_record, 'sceneFailuresRetained': [record['ordinal'] for record in results if not record['scenePassed']], 'qualityScoring': 'pending-independent-source-and-blinded-judge-reviews'})
    except Exception as error:
        write_json(operations / 'execution-halted.json', {'schema': 'aperture.official-trial-execution.v1', 'finishedAt': now(), 'status': 'halted-preserve-and-reconcile', 'completedAttemptOrdinals': [record['ordinal'] for record in results], 'error': str(error), 'retryPermitted': False})
        raise
    finally:
        for path in operations.rglob('*'):
            if path.is_file() and not path.is_symlink():
                path.chmod(0o444)


if __name__ == '__main__':
    main()
