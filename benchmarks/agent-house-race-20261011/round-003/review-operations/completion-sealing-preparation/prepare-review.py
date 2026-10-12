#!/usr/bin/env python3
"""Prepare one private finalized-evidence review; never seal or register it.

Run only after root supplies its actual immutable closure review and final
public source-promotion receipt. This
template has not inspected or hashed any live round003 trial file.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat

ROOT = Path('/workspace/aperture')
ROUND = ROOT / 'benchmarks/agent-house-race-20261011/round-003'
INPUT_FREEZE = ROOT / 'benchmarks/agent-house-race-20261011/freezes/round-003-inputs.json'
INPUT_SHA256 = '33f04897b3d61efab3833c1a564757cd98073c6d8b0eb1c28bfaf7d72ce84b55'
PRIVATE = ROOT / '.aperture-env/agent-house-race/control/r003-completion-sealing-proposal-001'
ROOT_REVIEW = ROUND / 'root-completion-review.json'
ROOT_REVIEW_SHA256 = '6fe7fbe1a98721f9408b86b8f6ed76531a796ab9242f9c823b6eaa93a3c94463'


def require(value, message):
    if not value:
        raise ValueError(message)


def pin(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file() and not path.is_symlink(), 'Canonical regular artifact required')
    digest = hashlib.sha256()
    count = 0
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_size <= 128 * 1024 * 1024, 'Per-file review bound exceeded')
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            count += len(block)
            digest.update(block)
        after = os.fstat(stream.fileno())
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns) and count == before.st_size,
            'Artifact changed during finalized review')
    return {'path': str(path), 'bytes': count, 'sha256': digest.hexdigest()}


def create(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    path.chmod(0o444)


def origin(relative):
    local = relative.removeprefix(ROUND.relative_to(ROOT).as_posix() + '/')
    if local.startswith('authors/'):
        return 'Authentic public author operational record, visible response or own diagnostic preview'
    if local.startswith('author-audits/'):
        return 'Retained verified author source/build or exact public author-record copy'
    if local.startswith('trials/'):
        return 'Original official native attempt; retained frozen inputs, receipts, geometry, captures and failures'
    if local.startswith('official-trial-operations/'):
        return 'Original official driver/lifecycle operation or actual completed-window release receipt'
    if local.startswith('setup/'):
        return 'Original frozen preparation/SDK/public source snapshot bytes; existing provenance labels retained'
    if local.startswith('preparation-operations/'):
        return 'Original public preparation invocation and reaped lifecycle receipts'
    if relative == INPUT_FREEZE.relative_to(ROOT).as_posix():
        return 'Unchanged original round003 input freeze; separately registered only after completed sealing'
    return 'Finalized public round003 dispatch, authorization, summary, root review or source diagnosis evidence'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root-review', type=Path, required=True)
    parser.add_argument('--root-review-sha256', required=True)
    parser.add_argument('--source-promotion-receipt', type=Path, required=True)
    parser.add_argument('--source-promotion-receipt-sha256', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    review_pin = pin(args.root_review)
    require(args.root_review == ROOT_REVIEW and review_pin['sha256'] == args.root_review_sha256 == ROOT_REVIEW_SHA256,
            'Actual root review outer pin differs')
    review = json.loads(args.root_review.read_bytes())
    require(review['schema'] == 'aperture.root-completed-benchmark-review.v1' and review['round'] == 'round-003' and
            review['reviewedBy'] == '/root' and review['status'] == 'six-attempts-reviewed-closed-ineligible', 'Actual root completion review required')
    for name in ('allSixDescendantsReapedAndCurrentManifestsMatchedRetainedCopies', 'sharedLifecycleLockAcquiredAndReleased'):
        require(review.get(name) is True, 'Unresolved root prerequisite: ' + name)
    require(review['activeScratchRuns'] == [] and len(review['trialOperations']) == 6 and
            all(item['lifecycle']['status'] == 'completed-after-descendants-reaped' for item in review['trialOperations']),
            'Actual root review does not close all six attempts')
    require(review['scoresWithheld'] is True and review['failedAttemptsReplacedOrRetried'] is False and
            review['engineSourcesChangedDuringTrials'] is False, 'Actual root evidence preservation contract differs')
    promotion_pin = pin(args.source_promotion_receipt)
    require(promotion_pin['sha256'] == args.source_promotion_receipt_sha256 and
            args.source_promotion_receipt.is_relative_to(ROUND), 'Actual public source-promotion receipt pin differs')
    require(not args.output.exists() and args.output.is_absolute() and args.output.resolve() == args.output and
            args.output.parent == PRIVATE, 'Private review output must be a new direct child of this proposal directory')
    artifacts = {}
    exclusions = []
    for parent, directories, names in os.walk(ROUND, followlinks=False):
        for name in directories:
            require(not (Path(parent) / name).is_symlink(), 'Linked directory in public evidence')
            require(name not in ('node_modules', '.pnpm-store', '.git', '.aperture-env'), 'Unexpected cache/private tree requires explicit root reconciliation')
        for name in names:
            path = Path(parent) / name
            relative = path.relative_to(ROOT).as_posix()
            if name == '.lane.lock':
                require(path.parent in (ROUND / 'authors/three-r003', ROUND / 'authors/aperture-r003'), 'Unexpected lock path')
                exclusions.append(relative)
                continue
            artifacts[relative] = pin(path)
    require(len(artifacts) <= 40000 and sum(item['bytes'] for item in artifacts.values()) <= 3 * 1024**3, 'Finalized inventory bound exceeded')
    input_pin = pin(INPUT_FREEZE)
    require(input_pin['sha256'] == INPUT_SHA256, 'Existing round003 input freeze changed')
    input_freeze = json.loads(INPUT_FREEZE.read_bytes())
    for relative, expected in input_freeze['files'].items():
        actual = artifacts.get(relative)
        require(actual and all(actual[key] == expected[key] for key in ('bytes', 'sha256')), 'Historical frozen input changed or disappeared: ' + relative)
    artifacts[INPUT_FREEZE.relative_to(ROOT).as_posix()] = input_pin
    # Verify every retained public pin in the actual root review without
    # following its truthfully labeled private original paths. The separate
    # promotion receipt remains opaque original evidence, never a fabricated
    # approval contract; root reviews its real contents before authorizing us.
    public_joins = []
    def verify_public_pins(value):
        if isinstance(value, dict):
            if all(key in value for key in ('path', 'bytes', 'sha256')):
                path = Path(value['path'])
                if path.is_absolute() and path.is_relative_to(ROUND):
                    relative = path.relative_to(ROOT).as_posix()
                    actual = artifacts.get(relative)
                    require(actual and all(actual[key] == value[key] for key in ('bytes', 'sha256')), 'Root public pin differs: ' + relative)
                    public_joins.append(actual)
            for child in value.values():
                verify_public_pins(child)
        elif isinstance(value, list):
            for child in value:
                verify_public_pins(child)
    verify_public_pins(review)
    for expected in (review_pin, promotion_pin):
        require(artifacts.get(Path(expected['path']).relative_to(ROOT).as_posix()) == expected, 'Root review/promotion inventory join differs')
    summary = json.loads(Path(review['summary']['path']).read_bytes())
    require(summary['roundRoot'] == str(ROUND) and set(summary['engines']) == {'three', 'aperture'} and
            all(len(summary['engines'][engine]['trials']) == 3 for engine in ('three', 'aperture')), 'Original summary does not account for six attempts')
    for engine in ('three', 'aperture'):
        for number in (1, 2, 3):
            require((ROUND / f'trials/{engine}/trial-{number:02d}/outcome.json').is_file(), 'Final official attempt is missing')
    provenance = {label: data['snapshotPath'] for label, data in input_freeze['provenance']['inputs'].items()}
    joins = []
    for label, data in input_freeze['provenance']['inputs'].items():
        actual = artifacts.get(data['snapshotPath'])
        require(actual and all(actual[key] == data[key] for key in ('bytes', 'sha256')), 'Frozen source-copy provenance changed: ' + label)
        joins.append({'sourceLabel': label, 'snapshotPath': data['snapshotPath'], 'bytes': actual['bytes'], 'sha256': actual['sha256']})
    for engine in ('three', 'aperture'):
        lane = engine + '-r003'
        audit_root = ROUND / 'author-audits' / lane
        audit = json.loads((audit_root / 'audit.json').read_bytes())
        require(audit['status'] == 'verified', 'Final author audit is not verified: ' + lane)
        for data in audit['sourceFiles']:
            relative = (audit_root / 'source' / data['path']).relative_to(ROOT).as_posix()
            actual = artifacts.get(relative)
            require(actual and all(actual[key] == data[key] for key in ('bytes', 'sha256')), 'Final source-copy audit join differs: ' + relative)
            label = 'author-source/' + lane + '/' + data['path']
            provenance[label] = relative
            joins.append({'sourceLabel': label, 'snapshotPath': relative, 'bytes': actual['bytes'], 'sha256': actual['sha256']})
    spec = {'schema': 'aperture.experiment-freeze-request.v1',
            'purpose': 'Preserve all finalized round003 public inputs/authors/audits/previews/official attempts/operations/original summary/root release/source diagnosis, including actual failures, without replacing historical evidence.',
            'review': {'reviewedBy': 'FINAL_ROOT_SEAL_REVIEW_PENDING', 'reviewedAt': None},
            'provenance': {'kind': 'working-tree-snapshot',
                           'note': 'Existing input freeze and every source-copy hash remain unchanged; complete finalized public round is enumerated as exact files. Runtime failures stay failures, diagnostic previews do not replace official views, and no private provider/cache/control tree is scanned. Actual root closure/source review authorizes inventory only; final root sealing review remains separate.',
                           'inputs': provenance},
            'files': {path: origin(path) for path in sorted(artifacts)}}
    args.output.mkdir()
    create(args.output / 'request.draft.json', spec)
    create(args.output / 'exact-inventory.json', {'schema': 'aperture.round003-finalized-inventory.v1', 'files': artifacts, 'exactExclusions': exclusions})
    create(args.output / 'source-copy-joins.json', joins)
    create(args.output / 'root-public-pin-joins.json', public_joins)
    create(args.output / 'review.json', {'schema': 'aperture.round003-completion-seal-preparation.v1', 'status': 'awaiting-final-root-seal-review',
            'rootClosureReview': review_pin, 'publicSourcePromotionReceipt': promotion_pin, 'verifiedRootPublicPinJoins': len(public_joins),
            'files': len(artifacts), 'bytes': sum(item['bytes'] for item in artifacts.values()),
            'originalInputFreeze': input_pin, 'sourceCopyProvenanceInputs': len(provenance), 'verifiedSourceCopyJoins': len(joins), 'danglingSourceCopyJoins': [], 'exactExclusions': exclusions,
            'actualSummaryStatus': summary['status'], 'sealingPerformed': False, 'registrationPerformed': False})
    print(json.dumps({'status': 'awaiting-final-root-seal-review', 'output': str(args.output), 'files': len(artifacts)}))


if __name__ == '__main__':
    main()
