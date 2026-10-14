"""Verify retained blobs; optionally restore regular files to a fresh directory."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def relative(value):
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(p in ('.', '..') for p in path.parts):
        raise ValueError(f'Unsafe relative path: {value}')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', type=Path, help='New destination; must not exist')
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    manifest = json.loads((base / 'manifest.json').read_text())
    expected = {}
    for item in manifest['uniquePayloads']:
        key = (item['archive'], item['member'])
        assert key not in expected
        assert item['member'] == 'blobs/' + item['sha256']
        expected[key] = item
    aliases = {}
    outputs = set()
    for item in manifest['files']:
        key = (item['archive'], item['member'])
        assert key in expected
        assert (item['bytes'], item['sha256']) == (expected[key]['bytes'], expected[key]['sha256'])
        out = relative(item['root']) / relative(item['relativePath'])
        assert out not in outputs
        outputs.add(out)
        aliases.setdefault(key, []).append(out)
    if args.restore:
        args.restore.mkdir(parents=False, exist_ok=False)
    seen = set()
    for record in manifest['archives']:
        path = base / relative(record['path'])
        raw = path.read_bytes()
        assert len(raw) == record['bytes'] and digest(raw) == record['sha256']
        count = 0
        with tarfile.open(path, 'r:gz') as archive:
            for member in archive:
                key = (record['path'], member.name)
                assert member.isfile() and key in expected and key not in seen
                raw = archive.extractfile(member).read()
                item = expected[key]
                assert len(raw) == item['bytes'] and digest(raw) == item['sha256']
                seen.add(key)
                count += 1
                if args.restore:
                    for alias in aliases[key]:
                        target = args.restore / alias
                        target.parent.mkdir(parents=True, exist_ok=True)
                        with target.open('xb') as stream:
                            stream.write(raw)
        assert count == record['members']
    assert seen == set(expected)
    print(json.dumps({'verifiedPayloads': len(seen), 'verifiedAliases': len(outputs),
                      'restored': str(args.restore) if args.restore else None,
                      'symlinksCreated': 0}))


if __name__ == '__main__':
    main()
