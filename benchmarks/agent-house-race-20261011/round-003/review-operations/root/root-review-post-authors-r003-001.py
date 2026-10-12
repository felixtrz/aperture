import datetime, fcntl, hashlib, json, os, stat
from pathlib import Path

ROOT=Path('/workspace/aperture')
C=ROOT/'.aperture-env/agent-house-race/control'
ROUND=ROOT/'benchmarks/agent-house-race-20261011/round-003'
def require(v,m):
    if not v: raise RuntimeError(m)
def raw(p, immutable=True):
    p=Path(p); s=p.lstat()
    require(p.is_absolute() and p.resolve(strict=True)==p and stat.S_ISREG(s.st_mode) and s.st_nlink==1,'Noncanonical input '+str(p))
    require(not immutable or s.st_mode&0o222==0,'Writable evidence '+str(p))
    return p.read_bytes()
def sha(b): return hashlib.sha256(b).hexdigest()
def pin(p,immutable=True):
    b=raw(p,immutable); return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
def verify(r,immutable=True):
    require(pin(r['path'],immutable)=={k:r[k] for k in ('path','bytes','sha256')},'Pin changed '+r['path'])
    return raw(r['path'],immutable)
def new(p,x):
    with p.open('xb') as f: f.write((json.dumps(x,indent=2)+'\n').encode());f.flush();os.fsync(f.fileno())
    p.chmod(0o444)

postp=C/'r003-author-audits-001/post-audit-verification-and-release.json'
post=json.loads(raw(postp)); require(sha(raw(postp))=='f8dca7a0400cbfdfed28adff1276cdadc2ced49e3783286c02636ff9a563ecdd','Postreceipt changed')
require(post['status']=='both-verified-audits-and-all-preview-lifecycles-closed','Incomplete postreceipt')
authors={}; retained=0; source_count=0
for item in post['authorAudits']:
    engine=item['engine']; a=json.loads(verify(item['audit'])); base=Path(item['audit']['path']).parent
    require(a['status']=='verified' and a['engine']==engine and all(a['verificationChecks'].values()),'Audit not verified')
    for rel,r in a['retainedFiles'].items():
        require(not Path(rel).is_absolute() and '..' not in Path(rel).parts,'Unsafe retained path')
        verify({'path':str(base/rel),**r}); retained+=1
    for r in a['sourceFiles']: verify({'path':str(base/'source'/r['path']),'bytes':r['bytes'],'sha256':r['sha256']});source_count+=1
    finish=json.loads(verify(item['finish']));require(finish['files']==a['sourceFiles'] and sha(raw(base/'public-records/finish.json'))==a['finishSha256'],'Finish source mismatch')
    require(not finish['runningProcesses'],'Author process remains')
    start=json.loads(raw(base/'public-records/start.json'))
    require(sha(raw(base/'public-records/start.json'))==a['startSha256'],'Start mismatch')
    require(sha(raw(base/'public-records/prompt.txt'))==a['promptSha256']==start['prompt']['sha256'],'Prompt mismatch')
    require(sha(raw(base/'public-records/reference.png'))==a['referenceSha256']==start['reference']['sha256'],'Reference mismatch')
    eventsraw=verify(item['eventStream']); require(sha(eventsraw)==a['eventsSha256'],'Events mismatch')
    events=[json.loads(l) for l in eventsraw.splitlines()]; previous='0'*64; mt=-1
    for i,e in enumerate(events,1):
        clean={k:v for k,v in e.items() if k!='sha256'}
        require(e['sequence']==i and e['previousSha256']==previous and sha(json.dumps(clean,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode())==e['sha256'] and e['monotonicNs']>=mt,'Event chain mismatch')
        previous=e['sha256'];mt=e['monotonicNs']
    require(len(events)==a['eventCount'] and previous==a['eventHeadSha256'] and events[0]['kind']=='author-start' and events[-1]['kind']=='author-finish','Incomplete events')
    wall=(finish['finishedMonotonicNs']-start['startedMonotonicNs'])/1e9
    require(abs(wall-a['elapsedSeconds'])<1e-8 and abs(wall-a['previewWaitSeconds']-a['activeBudgetElapsedSeconds'])<1e-8 and a['activeBudgetElapsedSeconds']<=1800,'Budget mismatch')
    for k in ('publicTranscript','agentFinal'):verify(item[k])
    authors[engine]=item['audit']
require(retained==237 and source_count==24,'Unexpected inventory counts')
def lifecycle(audit_record,manifest_record,run,code,immutable_manifest=True,immutable_audit=True):
    ev=[json.loads(l) for l in verify(audit_record,immutable_audit).splitlines()]
    starts=[e for e in ev if e['event']=='run-start']; ends=[e for e in ev if e['event']=='run-completed']
    require(len(starts)==len(ends)==1 and not any(e['event'] in ('run-error','run-completion-audit-failed') for e in ev),'Lifecycle audit incomplete')
    m=json.loads(verify(manifest_record,immutable_manifest)); s,t=starts[0],ends[0]
    require(s['run']==t['run']==m['run_id']==run and m['state']=='completed' and m['exitcode']==t['exitcode']==code and t['at_ns']>=s['at_ns'] and m['job']==s['job'],'Lifecycle identities mismatch')
for item in post['previewLifecycleClosures']:
    expected=1 if item['engine']=='aperture' and item['number']==1 else 0
    require(item['childExitCode']==expected,'Preview expected result differs')
    lifecycle(item['audit'],item['completedManifest'],item['run'],expected,False)
require(len(post['previewLifecycleClosures'])==6,'Preview count differs')
w=post['wrapper'];require(w['exitCode']==0,'Audit wrapper failed');verify(w['result']);lifecycle(w['audit'],w['completedManifest'],w['run'],0,True,False)
coord=json.loads(verify(post['coordinatorResult']));require(coord['coordinatorExitCode']==0 and coord['status']=='closed-coordinator-after-both-finishes','Coordinator unresolved')
for k in ('stdout','stderr'):verify(coord[k])
for k in ('configuration','dispatch','inputFreeze','coordinatorResult','captureSource'): verify(post['currentControlPins'][k],k not in ('configuration',))
for p in post['currentControlPins']['sources']:verify(p,False)
templatep=C/'official-trials-r003-template-001/control-plan.template.json'
require(sha(raw(templatep))=='cbe14f974de29f0621316e8c6884be8ead078f91b0d9971bc94bfff5597ffdb2','Template changed')
template=json.loads(raw(templatep)); plan=template['knownControlPlan']
for s in plan['sourcePins']: verify(s,False);verify(s['survivingFrozenCopy'])
freeze=json.loads(verify(plan['dispatchFreeze'])); frozen_count=0
for rel,r in freeze['files'].items():verify({'path':str(ROOT/rel),'bytes':r['bytes'],'sha256':r['sha256']});frozen_count+=1
require(frozen_count==78,'Freeze inventory differs')
sourcep=C/'r003-source-contract-review-001/summary.json';source=json.loads(raw(sourcep))
require(source['status']=='retained-byte-parity-verified-source-review-complete-final-runtime-and-geometry-pending','Source review unresolved')
verify(source['manualReview'])
for e in ('three','aperture'):require(source['lanes'][e+'-r003']['audit']==authors[e],'Source reviewed different author')
scratch=Path(plan['scratchRoot']);d=os.open(scratch/'.lifecycle.lock',os.O_RDONLY|os.O_NOFOLLOW)
try:
    fcntl.flock(d,fcntl.LOCK_EX|fcntl.LOCK_NB); states=[]
    for p in sorted(scratch.glob('run-*')):
        m=json.loads(raw(p/'.manifest.json',False));require(m['state'] in ('completed','retired'),'Active lifecycle '+str(p));states.append({'run':p.name,'state':m['state']})
finally:os.close(d)
free=os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize; require(free>=2*1024**3,'Insufficient disk floor')
review={'schema':'aperture.root-post-author-readiness.v1','round':'round-003','reviewedBy':'/root','status':'reviewed','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'finalAuthorAuditsReviewed':True,'noFurtherAuthorEdits':True,'previewCoordinatorExited':True,'lifecycleQuiescenceReviewed':True,'coordinatorResult':post['coordinatorResult'],'authorAudits':authors,'independentRootChecks':{'retainedFilesVerified':retained,'finalSourceFilesVerified':source_count,'eventHashChainsAndMonotonicBudgetChecked':True,'previewLifecyclesVerified':6,'auditWrapperLifecycleVerified':True,'activeControlSourcesVerified':len(plan['sourcePins']),'inputFreezeFilesVerified':frozen_count,'sharedLifecycleLockAcquiredAndReleased':True,'scratchStates':states,'availableDiskBytes':free},'auditorPostcheck':pin(postp),'preliminarySourceContractReview':pin(sourcep),'manualSourceFindings':source['manualReview'],'limitations':source['pending'],'nativeTrialsLaunched':False,'judgingOrCombinedScoringPerformed':False,'measurementWindowAuthorization':'Separate exact-plan root authorization required before execution.'}
out=C/'root-post-author-readiness-r003-001.json';new(out,review);print(json.dumps({'rootPostAuthorReadiness':pin(out),'retainedFiles':retained,'sourceFiles':source_count,'availableDiskBytes':free}))
