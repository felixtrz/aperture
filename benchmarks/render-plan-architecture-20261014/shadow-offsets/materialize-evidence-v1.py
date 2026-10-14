"""Create-only writer for the exact root-reviewed architecture retention proposal."""
import datetime, gzip, hashlib, json, math, os, stat, subprocess, sys, tarfile, time, traceback, zlib
from pathlib import Path

def digest(raw):return hashlib.sha256(raw).hexdigest()
def receipt(path):
    path=Path(path);raw=path.read_bytes()
    return {'path':str(path),'bytes':len(raw),'sha256':digest(raw)}
def pinned(entry):
    path=Path(entry['path']);assert stat.S_ISREG(path.lstat().st_mode),str(path)
    raw=path.read_bytes();assert len(raw)==entry['bytes']and digest(raw)==entry['sha256'],str(path)
    return raw
def relative(value):
    path=Path(value);assert not path.is_absolute()and path.parts and all(p not in ('','.','..')for p in path.parts),value
    return path
def create(path,raw):
    with path.open('xb')as f:f.write(raw);f.flush();os.fsync(f.fileno())
def create_json(path,value):create(path,(json.dumps(value,indent=2)+'\n').encode())
def public_pin(path,root):
    pin=receipt(path);pin['path']=str(path.relative_to(root));return pin
class TarCounter:
    def __init__(self,stream):self.stream=stream;self.bytes=0
    def write(self,raw):self.bytes+=len(raw);return self.stream.write(raw)
class SourceDigest:
    def __init__(self,stream):self.stream=stream;self.hash=hashlib.sha256();self.bytes=0
    def read(self,count=-1):
        raw=self.stream.read(count);self.hash.update(raw);self.bytes+=len(raw);return raw

assert len(sys.argv)==3,'Usage: python materialize-evidence-v1.py <approved-proposal.json> <approved-sha256>'
proposal_path=Path(sys.argv[1]).resolve();proposal_raw=proposal_path.read_bytes();expected=sys.argv[2]
assert digest(proposal_raw)==expected,'Reviewed proposal hash differs.'
proposal=json.loads(proposal_raw)
assert proposal['schema']=='aperture.render-plan-architecture-retention-proposal.v1'
assert proposal['status']=='private-create-only-proposal-not-materialized-not-registered-not-sealed'
destination=Path(proposal['proposedPublicEvidenceRoot'])
assert destination.is_absolute()and not destination.exists(),'Public evidence destination must be new.'
metadata={name:pinned(entry)for name,entry in proposal['privateInventories'].items()}
origins=[json.loads(line)for line in metadata['origins.jsonl'].splitlines()if line]
members=[json.loads(line)for line in metadata['archive-members.jsonl'].splitlines()if line]
symlinks=[json.loads(line)for line in metadata['symlinks.jsonl'].splitlines()if line]
joins=[json.loads(line)for line in metadata['actual-runtime-pin-joins.jsonl'].splitlines()if line]
assert len(origins)==proposal['totalOriginalRegularFiles']and len(members)==proposal['uniqueRawPayloadFiles']
assert len(symlinks)==proposal['recordedSymlinks']and proposal['symlinksDereferenced']==0
roots={r['id']:Path(r['path'])for r in proposal['sourceRoots']};seen=set()
started=time.monotonic();verified_bytes=0
for origin in origins:
    path=roots[origin['root']]/relative(origin['path']);assert str(path)==origin['source']
    assert (origin['root'],origin['path'])not in seen;seen.add((origin['root'],origin['path']))
    actual=path.lstat();assert stat.S_ISREG(actual.st_mode)and stat.S_IMODE(actual.st_mode)==origin['mode']
    raw=path.read_bytes();assert len(raw)==origin['bytes']and digest(raw)==origin['sha256'],str(path)
    verified_bytes+=len(raw)
assert verified_bytes==proposal['totalOriginalRawBytes']
for link in symlinks:
    path=roots[link['root']]/relative(link['path']);assert path.is_symlink()
    target=os.readlink(path);assert target==link['target']and digest(os.fsencode(target))==link['targetSha256']
by_sha={m['sha256']:m for m in members};assert len(by_sha)==len(members)
for join in joins:assert join['sha256']in by_sha and join['bytes']==by_sha[join['sha256']]['bytes']
for copy in proposal['visibleCopies']:pinned({'path':copy['source'],'bytes':copy['bytes'],'sha256':copy['sha256']})
for key in ['reconstructionScript','instructions']:pinned(proposal[key])
print(json.dumps({'state':'all-originals-and-runtime-helper-joins-verified','files':len(origins),'bytes':verified_bytes}),flush=True)

created=False;archives=[];visible=[];inventory_pins={}
try:
    destination.mkdir();created=True
    for group in proposal['archiveGroups']:
        path=destination/relative(group['archive']);rows=[r for r in members if r['archive']==group['archive']]
        assert len(rows)==group['memberCount']
        with path.open('xb')as file:
            with gzip.GzipFile(filename='',mode='wb',fileobj=file,mtime=0,compresslevel=6)as compressed:
                counter=TarCounter(compressed)
                with tarfile.open(fileobj=counter,mode='w|',format=tarfile.USTAR_FORMAT)as tar:
                    for row in rows:
                        assert row['member']=='blobs/'+row['sha256']and len(row['sha256'])==64
                        source=Path(row['source']);assert stat.S_ISREG(source.lstat().st_mode)
                        info=tarfile.TarInfo(row['member']);info.size=row['bytes'];info.mode=0o444;info.mtime=0;info.uid=info.gid=0;info.uname=info.gname=''
                        with source.open('rb')as raw:
                            copied=SourceDigest(raw);tar.addfile(info,copied)
                        assert copied.bytes==row['bytes']and copied.hash.hexdigest()==row['sha256'],str(source)
                assert counter.bytes==group['ustarStreamBytes']and counter.bytes<=proposal['archiveFormat']['maximumTarStreamBytes']
            file.flush();os.fsync(file.fileno())
        record=public_pin(path,destination);assert record['bytes']<proposal['archiveFormat']['maximumArchiveBytes']
        archives.append({**record,'members':len(rows),'payloadBytes':group['payloadBytes'],'ustarStreamBytes':counter.bytes})
        print(json.dumps({'state':'archive-created','archive':record}),flush=True)
    inventory_keys={'origins.jsonl':'origins','archive-members.jsonl':'members','symlinks.jsonl':'symlinks','actual-runtime-pin-joins.jsonl':'runtimePinJoins'}
    for name,raw in metadata.items():
        target=destination/(name+'.gz')
        with target.open('xb')as file:
            with gzip.GzipFile(filename='',mode='wb',fileobj=file,mtime=0,compresslevel=6)as compressed:compressed.write(raw)
            file.flush();os.fsync(file.fileno())
        pin=public_pin(target,destination);assert pin['bytes']<90_000_000
        assert gzip.decompress(target.read_bytes())==raw
        inventory_pins[inventory_keys[name]]={**pin,'uncompressedBytes':len(raw),'uncompressedSha256':digest(raw)}
    for copy in proposal['visibleCopies']:
        raw=pinned({'path':copy['source'],'bytes':copy['bytes'],'sha256':copy['sha256']});target=destination/relative(copy['target']);target.parent.mkdir(parents=True,exist_ok=True);create(target,raw);visible.append(public_pin(target,destination))
    for name,key in [('reconstruct-evidence.py','reconstructionScript'),('RECONSTRUCTION.md','instructions')]:
        target=destination/name;create(target,pinned(proposal[key]));visible.append(public_pin(target,destination))
    create(destination/'reviewed-proposal.json',proposal_raw);visible.append(public_pin(destination/'reviewed-proposal.json',destination))
    self_path=Path(__file__).resolve();create(destination/'materialize-evidence-v1.py',self_path.read_bytes());visible.append(public_pin(destination/'materialize-evidence-v1.py',destination))
    manifest={'schema':'aperture.render-plan-architecture-retention.v1','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewedProposal':{'originalPath':str(proposal_path),'bytes':len(proposal_raw),'sha256':expected},'sourceRoots':proposal['sourceRoots'],'originalRegularFiles':len(origins),'originalRawBytes':verified_bytes,'uniquePayloads':len(members),'uniquePayloadBytes':proposal['uniqueRawPayloadBytes'],'archives':archives,'inventories':inventory_pins,'visibleCopies':visible,'symlinks':{'recorded':len(symlinks),'dereferenced':0,'created':0},'actualRuntimePinJoins':len(joins),'negativeDispositions':proposal['negativeDispositions'],'pendingAddenda':proposal['laterAddenda'],'rawSourceBytesRewritten':False,'publicParentReadmeChanged':False,'earlierArchivesChanged':False,'registered':False,'sealed':False,'executedMaterializer':receipt(self_path),'python':sys.version,'zlib':zlib.ZLIB_VERSION}
    create_json(destination/'manifest.json',manifest)
    # Actual member verification, reconstruction path checks and direct visible
    # raw-file pins run in a separate CPU child; this never launches a browser.
    argv=[sys.executable,'-B',str(destination/'reconstruct-evidence.py'),'verify',str(destination)]
    result=subprocess.run(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)
    create(destination/'verification-stdout.txt',result.stdout);create(destination/'verification-stderr.txt',result.stderr)
    verification=json.loads(result.stdout)if result.returncode==0 else None
    assert result.returncode==0,result.stderr.decode(errors='replace')
    assert verification['uniqueRawPayloads']==len(members)and verification['originalRegularFiles']==len(origins)
    outcome={'schema':'aperture.architecture-retention-materialization-outcome.v1','status':'materialized-all-originals-and-archive-members-verified-unregistered-unsealed','reviewedProposalSha256':expected,'verifiedOriginalFiles':len(origins),'verifiedOriginalBytes':verified_bytes,'verifiedUniqueArchiveMembers':len(members),'archiveBytes':sum(r['bytes']for r in archives),'archives':archives,'manifest':public_pin(destination/'manifest.json',destination),'verificationCommand':argv,'actualVerificationChildWaitReturned':True,'verificationChildExitCode':result.returncode,'verification':verification,'verificationStdout':public_pin(destination/'verification-stdout.txt',destination),'verificationStderr':public_pin(destination/'verification-stderr.txt',destination),'durationSeconds':time.monotonic()-started,'sourceAndParentBytesChanged':False,'registrationInvoked':False,'sealerInvoked':False,'nativeLaunches':0}
    create_json(destination/'materialization-outcome.json',outcome)
    print(json.dumps({'status':outcome['status'],'manifest':receipt(destination/'manifest.json'),'outcome':receipt(destination/'materialization-outcome.json'),'archiveBytes':outcome['archiveBytes']}),flush=True)
except BaseException as error:
    if created:
        failure={'status':'failed-create-only-materialization-preserved','reviewedProposalSha256':expected,'error':repr(error),'traceback':traceback.format_exc(),'publicDirectory':str(destination),'partialFilesPreserved':True,'registrationInvoked':False,'sealerInvoked':False,'nativeLaunches':0}
        create_json(destination/'materialization-failed.json',failure)
    raise
