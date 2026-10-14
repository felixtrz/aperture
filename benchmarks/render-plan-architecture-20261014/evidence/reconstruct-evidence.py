"""Verify a reviewed materialized batch or restore it into a fresh chosen root.

Never extracts tar paths, writes original absolute paths, installs dependencies,
creates historical symlinks, or launches a renderer.
"""
import argparse, gzip, hashlib, json, os, stat, tarfile
from pathlib import Path

def sha(raw): return hashlib.sha256(raw).hexdigest()
def relative(value):
    path=Path(value)
    assert not path.is_absolute() and path.parts and all(p not in ('','.','..')for p in path.parts),value
    return path
def pinned(root,entry):
    path=root/relative(entry['path']);assert stat.S_ISREG(path.lstat().st_mode),str(path)
    raw=path.read_bytes();assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256'],str(path)
    return raw
def inventory(root,entry):
    raw=gzip.decompress(pinned(root,entry));assert len(raw)==entry['uncompressedBytes'] and sha(raw)==entry['uncompressedSha256']
    return [json.loads(line)for line in raw.splitlines()if line]

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('operation',choices=['verify','restore'])
parser.add_argument('evidence_root',type=Path)
parser.add_argument('fresh_destination',type=Path,nargs='?')
args=parser.parse_args();root=args.evidence_root.resolve()
manifest=json.loads((root/'manifest.json').read_text())
assert manifest['schema']=='aperture.render-plan-architecture-retention.v1'
origins=inventory(root,manifest['inventories']['origins']);members=inventory(root,manifest['inventories']['members']);links=inventory(root,manifest['inventories']['symlinks'])
root_ids={r['id']for r in manifest['sourceRoots']}
by_sha={row['sha256']:row for row in members};assert len(by_sha)==len(members)
aliases={}
for origin in origins:
    assert origin['root']in root_ids;relative(origin['root']);relative(origin['path'])
    assert origin['sha256']in by_sha and origin['bytes']==by_sha[origin['sha256']]['bytes']
    aliases.setdefault(origin['sha256'],[]).append(origin)
destination=None
if args.operation=='restore':
    assert args.fresh_destination is not None,'Choose a new restoration destination.'
    destination=args.fresh_destination.resolve();assert not destination.exists(),'Restoration requires a fresh destination.'
    assert destination!=root and not destination.is_relative_to(root),'Restoration cannot modify the evidence tree.'
    destination.mkdir(parents=True)
else:assert args.fresh_destination is None,'Verify performs no restoration.'
verified=set();restored=0
for archive in manifest['archives']:
    assert archive['bytes']<90_000_000,'Archive exceeds the declared bound.'
    path=root/relative(archive['path']);assert stat.S_ISREG(path.lstat().st_mode)
    raw=pinned(root,archive)
    # The archive hash is checked before its members are read. No extractall.
    import io
    expected={row['member']:row for row in members if row['archive']==archive['path']};seen=set()
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz')as tar:
        for item in tar:
            assert item.isfile()and not item.issym()and not item.islnk(),item.name
            assert item.name in expected and item.name not in seen,item.name
            row=expected[item.name];assert item.size==row['bytes']
            file=tar.extractfile(item);assert file is not None;body=file.read()
            assert len(body)==row['bytes'] and sha(body)==row['sha256']
            seen.add(item.name);verified.add(row['sha256'])
            if destination is not None:
                for origin in aliases[row['sha256']]:
                    target=destination/relative(origin['root'])/relative(origin['path'])
                    assert target.is_relative_to(destination);target.parent.mkdir(parents=True,exist_ok=True)
                    with target.open('xb')as stream:stream.write(body)
                    target.chmod(origin['mode']);restored+=1
    assert seen==set(expected),'Missing retained archive members.'
assert verified==set(by_sha),'Missing archive payloads.'
for copy in manifest.get('visibleCopies',[]):pinned(root,copy)
if destination is not None:
    with (destination/'recorded-symlinks.json').open('x')as stream:json.dump(links,stream,indent=2);stream.write('\n')
    assert restored==len(origins)
print(json.dumps({'status':'verified','uniqueRawPayloads':len(verified),'originalRegularFiles':len(origins),'restoredRegularFiles':restored,'recordedSymlinks':len(links),'symlinksCreated':0,'nativeLaunches':0}))
