#!/usr/bin/env python3
"""Read-only archive and lifecycle joins. Never scans for deletion or applies cleanup."""
import hashlib,json,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent; REPO=HERE.parent.parent
SOURCE=REPO/'benchmarks/shared-mesh-fanout-v2-20261003'
COMMIT='f3cd9ea2ac7be3b178b024267484fc05929b1c02'
def sha(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def read(p):return json.loads(p.read_text())
def git(*a):return subprocess.check_output(['git',*a],cwd=REPO)
files=[]
for row in filter(None,git('ls-tree','-r','-z',COMMIT,'--',str(SOURCE.relative_to(REPO))).split(b'\0')):
    meta,name=row.split(b'\t');p=REPO/name.decode();data=p.read_bytes();oid=meta.split()[2].decode()
    assert blob(data)==oid
    files.append({'path':str(p.relative_to(REPO)),'bytes':len(data),'sha256':sha(data),'gitBlob':oid})
assert len(files)==213
native=[]
for runnerpath in sorted((SOURCE/'renders/aperture').glob('*/attempt-001/verified-runner.json')):
    runner=read(runnerpath);run=Path(runner['launch']['requested']['executablePath']).parent.name
    matches=[]
    for log in (SOURCE/'lifecycle-audits-native').glob('*.jsonl'):
        events=[json.loads(line) for line in log.read_text().splitlines()]
        if any(e.get('run')==run for e in events):matches.append((log,events))
    assert len(matches)==1
    log,events=matches[0]
    assert events[0]['event']=='run-start' and events[-1]['event']=='run-completed' and events[-1]['exitcode']==0
    assert all(e.get('run')==run for e in events)
    native.append({'session':runnerpath.parent.parent.name,'run':run,'lifecycle':str(log.relative_to(REPO)),'sha256':sha(log.read_bytes()),'completed':True,'exitcode':0})
ours=[]
for log in sorted((HERE/'lifecycle-audits').glob('*.jsonl')):
    events=[json.loads(line) for line in log.read_text().splitlines()]
    # This receipt-producing command is itself active until its outer lifecycle exits.
    if events[0]['job']=='shared-mesh-audit-receipts':continue
    assert events[0]['event']=='run-start' and events[-1]['event']=='run-completed'
    ours.append({'run':events[0]['run'],'job':events[0]['job'],'log':str(log.relative_to(HERE)),'exitcode':events[-1]['exitcode'],'sha256':sha(log.read_bytes())})
report={'status':'passed','localArchivedCommit':COMMIT,'tree':git('rev-parse',COMMIT+'^{tree}').decode().strip(),'remoteRefObservation':'Parent separately reported remote-ref verification and successful CI; this worker verifies locally available immutable Git objects only.','archivedFixtureFiles':files,'totalBytes':sum(f['bytes'] for f in files),'nativeSessions':native,'auditLifecycleRunsCompletedBeforeThisCommand':ours,'failedAuditRunsPreserved':[r for r in ours if r['exitcode']!=0],'currentReceiptLifecycle':'Outer run must complete and is covered by the final worker quiescence statement.','nativeBrowsersStartedByAuditor':0,'agentDescendants':0,'cleanupDeletion':False}
with (HERE/sys.argv[1]).open('x') as f:json.dump(report,f,indent=2);f.write('\n')
audit=read(HERE/'independent-002.json')
print(json.dumps({'status':'passed','archivedFiles':len(files),'archiveBytes':report['totalBytes'],'nativeCompleted':len(native),'auditCompleted':len(ours),'preservedFailedAudits':len(report['failedAuditRunsPreserved'])}))
for row in audit['states']:
    if row['session']=='live':print(json.dumps({'state':row['state'],'version':row['assetVersion'],'cacheEntries':row['preparedCacheEntries'],'created':row['preparedBuffersCreated'],'pipeDraws':[{k:d[k] for k in ['meshId','method','viaBundle','count','instances','firstInstance','argumentBufferId','argumentOffset','argumentContentVersion']} for d in row['main'] if d['method']=='drawIndirect']}))
