import gzip, hashlib, json, os, stat, tarfile, io, sys
from pathlib import Path

ROOT = Path('/workspace/aperture')
DEST = ROOT / 'benchmarks/render-plan-architecture-20261014/validation'
BASE = ROOT / '.aperture-env/agent-house-race-v2'

def sha(raw): return hashlib.sha256(raw).hexdigest()
def save(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
def main():
    roots = {
        'safety007-prepared-only': BASE/'diagnostics/known-light-layout-safety-007',
        'safety008-failed': BASE/'diagnostics/known-light-layout-safety-008',
        'safety008-review': BASE/'diagnostics/known-light-layout-safety-008-review-001',
        'safety009': BASE/'diagnostics/known-light-layout-safety-009',
        'safety009-review': BASE/'diagnostics/known-light-layout-safety-009-review-001',
    }
    for label, path in json.loads(Path(sys.argv[1]).read_text()).items():
        assert label not in roots and '/' not in label and label not in ['.','..']
        roots[label] = Path(path)
    closed = json.loads((roots['safety009']/'root-operations/completed.json').read_text())
    assert closed['allDeclaredClosedPassed'] and not closed['unattemptedOrdinals']
    assert json.loads((roots['safety008-failed']/'root-operations/completed.json').read_text())['allDeclaredClosedPassed'] is False
    entries, symlinks = [], []
    for label, source in roots.items():
        assert source.exists()
        paths = [source] if source.is_file() else sorted(source.rglob('*'))
        for path in paths:
            rel = path.name if source.is_file() else path.relative_to(source).as_posix()
            if 'node_modules' in Path(rel).parts: continue
            mode = path.lstat().st_mode
            if stat.S_ISLNK(mode):
                symlinks.append({'root':label,'relativePath':rel,'target':os.readlink(path)})
            elif stat.S_ISREG(mode):
                raw = path.read_bytes()
                entries.append({'root':label,'relativePath':rel,'source':str(path),'member':label+'/'+rel,'bytes':len(raw),'sha256':sha(raw),'mode':stat.S_IMODE(mode)})
    unique = {}
    for entry in entries:
        entry["member"] = "blobs/" + entry["sha256"]
        unique.setdefault(entry["sha256"], dict(entry))
    groups, group, padded = [], [], 10240
    for entry in unique.values():
        need = 1536 + ((entry['bytes'] + 511)//512)*512
        assert need < 75000000
        if group and padded+need > 75000000:
            groups.append(group);group=[];padded=10240
        group.append(entry);padded+=need
    if group: groups.append(group)
    DEST.mkdir()
    archives = []
    for number, group in enumerate(groups, 1):
        name = f'validation-{number:03d}.tar.gz'
        target = DEST/name
        with target.open('xb') as output, gzip.GzipFile(filename='',mode='wb',fileobj=output,mtime=0,compresslevel=6) as zipped, tarfile.open(fileobj=zipped, mode='w|',format=tarfile.PAX_FORMAT) as archive:
            for entry in group:
                raw=Path(entry['source']).read_bytes()
                assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256']
                info=tarfile.TarInfo(entry['member']);info.size=len(raw);info.mode=0o444;info.mtime=0
                archive.addfile(info,io.BytesIO(raw));entry['archive']=name
        raw=target.read_bytes();assert len(raw)<90000000
        expected={entry['member']:entry for entry in group}
        with tarfile.open(target,mode='r:gz') as archive:
            for member in archive:
                assert member.isfile() and member.name in expected
                entry=expected.pop(member.name);payload=archive.extractfile(member).read()
                assert len(payload)==entry['bytes'] and sha(payload)==entry['sha256']
        assert not expected
        archives.append({'path':name,'bytes':len(raw),'sha256':sha(raw),'members':len(group)})
    for entry in entries: entry['archive'] = unique[entry['sha256']]['archive']
    manifest={'schema':'aperture.renderer-validation-retention.v2','scope':'Closed final correctness and repository validation; safety007 unattempted, safety008 failed, safety009 observed outcomes. No performance inference.','roots':{k:str(v) for k,v in roots.items()},'archives':archives,'files':entries,'uniquePayloads':list(unique.values()),'symlinks':symlinks,'symlinksDereferenced':False,'verification':{'allArchiveMembersReadBackAndHashVerified':True,'regularFiles':len(entries),'uniquePayloads':len(unique),'bytes':sum(e['bytes'] for e in entries)},'restoration':'Archives contain only content-addressed regular blobs. The files list maps each blob to all original root-id/relativePath aliases. Verify archive and member SHA/size before reconstructing aliases in a fresh chosen destination. Do not write original absolute paths or create recorded symlinks.'}
    save(DEST/'manifest.json',manifest)
    with (DEST/'retain-final-validation.py').open('xb') as stream:stream.write(Path(__file__).read_bytes())
    print(json.dumps({'destination':str(DEST),'files':len(entries),'archives':archives}))
if __name__=='__main__':main()
