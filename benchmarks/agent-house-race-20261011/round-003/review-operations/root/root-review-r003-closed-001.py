import collections, datetime, fcntl, hashlib, json, os, stat
from pathlib import Path
ROOT=Path('/workspace/aperture');C=ROOT/'.aperture-env/agent-house-race/control';R=ROOT/'benchmarks/agent-house-race-20261011/round-003'
def require(v,m):
 if not v:raise RuntimeError(m)
def raw(p,readonly=True):
 p=Path(p);s=p.lstat();require(p.is_absolute() and p.resolve(strict=True)==p and stat.S_ISREG(s.st_mode) and s.st_nlink==1,'Noncanonical input '+str(p));require(not readonly or s.st_mode&0o222==0,'Writable finalized evidence '+str(p));return p.read_bytes()
def sha(b):return hashlib.sha256(b).hexdigest()
def pin(p,readonly=True):
 b=raw(p,readonly);return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
def verify(p,readonly=True):
 b=raw(p['path'],readonly);require(len(b)==p['bytes'] and sha(b)==p['sha256'],'Pin mismatch '+p['path']);return b
def new(p,x):
 with p.open('xb') as f:f.write((json.dumps(x,indent=2)+'\n').encode());f.flush();os.fsync(f.fileno())
 p.chmod(0o444)
summary_path=R/'official-summary.json';sb=raw(summary_path);require(sha(sb)=='8c9ce35e2ac2127b4a308e4d7860fa26c92a9671e237148ad234b98237442fba','Summary changed');s=json.loads(sb)
require(s['status']=='incomplete-or-invalid-evidence' and s['scores'] is None,'Ineligible summary status/scores differ')
require([(x['engine'],x['trial']) for x in s['validationErrors']]==[('aperture',1),('aperture',2),('aperture',3)],'Unexpected validation errors')
completion_path=R/'official-trial-operations/execution-completed.json';complete=json.loads(raw(completion_path));require(complete['status']=='six-preselected-attempts-completed-ineligible' and complete['exitCode']==1 and complete['sceneFailuresRetained']==[2,3,6],'Completion differs')
verify(complete['summary']['output']);verify(complete['summary']['stdout']);verify(complete['summary']['stderr'])
require(not (R/'official-trial-operations/execution-halted.json').exists(),'Halted evidence needs reconciliation')
invocation=C/'root-official-trials-r003-invocation-001/result.json';iv=json.loads(raw(invocation));require(iv['driverExitCode']==1 and iv['childWaited'] is True,'Root driver not awaited');verify(iv['stdout']);verify(iv['stderr'])
plan_path=C/'official-trials-r003-control-plan-001.json';plan=json.loads(raw(plan_path));require(sha(raw(plan_path))=='98d3bc13325f70f28d120c49a448492e2f2b9d9d9289ddd1d92f2eae1b4f83ca','Actual plan changed')
operations=[];receipts_verified=0;joined=0
for step,op_pin in zip(plan['steps'],complete['trialOperations'],strict=True):
 op=json.loads(verify(op_pin));require(op['engine']==step['engine'] and op['trial']==step['trial'] and op['ordinal']==step['ordinal'] and op['status']=='completed-attempt','Wrong preselected operation')
 expected=0 if step['engine']=='three' else 1;require(op['wrapperExitCode']==expected and op['scenePassed']==(expected==0),'Unexpected operation outcome')
 for k in ('stdout','stderr'):verify(op[k]);joined+=1
 le=op['lifecycle'];require(le['status']=='completed-after-descendants-reaped' and le['childExitCode']==expected,'Lifecycle closure missing')
 ev=[json.loads(l) for l in verify(le['audit']).splitlines()];start=[x for x in ev if x['event']=='run-start'];end=[x for x in ev if x['event']=='run-completed']
 require(len(start)==len(end)==1 and not any(x['event'] in ('run-error','run-completion-audit-failed') for x in ev),'Lifecycle audit error')
 mf=verify(le['manifest']);m=json.loads(mf)
 require(m['state']=='completed' and m['run_id']==le['run']==start[0]['run']==end[0]['run'] and m['job']==step['job']==start[0]['job'] and m['exitcode']==expected==end[0]['exitcode'] and m['completed_ns']>=m['created_ns'],'Lifecycle identity differs')
 require(raw(Path(plan['scratchRoot'])/le['run']/'.manifest.json',False)==mf,'Current scratch manifest differs from completed retained copy')
 p=Path(step['outputRoot']);inp=json.loads(raw(p/'inputs.json'));require(inp['engine']==step['engine'] and inp['trial']==step['trial'] and inp['lifecycle']['run']==le['run'],'Trial identity differs')
 outcome=json.loads(raw(p/'outcome.json'));require(outcome['status']==('passed' if expected==0 else 'failed'),'Outcome status differs')
 for file,record in op['retainedAttemptRecords'].items():verify(record);joined+=1
 receipts=json.loads(raw(p/'receipts.json'))
 for rec in receipts['receipts']:
  require(rec['ok'] is True and not Path(rec['path']).is_absolute() and '..' not in Path(rec['path']).parts,'Invalid successful receipt')
  verify({'path':str(p/rec['path']),'bytes':rec['bytes'],'sha256':rec['sha256']});receipts_verified+=1
 for route,rec in inp['inputs'].items():
  require(route.startswith('/') and '..' not in Path(route).parts,'Unsafe app input')
  verify({'path':str(p/'frozen-app'/route.lstrip('/')),'bytes':rec['bytes'],'sha256':rec['sha256']});joined+=1
 if expected:
  failure=json.loads(raw(p/'failure.json'));require(len(failure['warmup'])==60 and len(failure['samples'])==120 and not failure['views'],'Failed samples/view inventory differs')
  prefix='Geometry inspection incomplete: ';err=failure['error']['message'];require(err.startswith(prefix),'Unexpected failed scene error');om=json.loads(err[len(prefix):]);require(len(om)==len({x['renderId'] for x in om})==59 and {x['reason'] for x in om}=={'missing-upload-receipt'},'Inspection omission differs')
  require(all(x['drawCalls']==61 and x['submittedTriangles']==149450 for x in failure['samples']),'Failed native frame counts differ')
  capture=failure['observationsAfterMeasured']['geometryCapture'];require(capture['skippedWrites']==0 and capture['incompleteBufferIds']==[] and capture['retainedBytes']<=capture['limitBytes'],'Native capture incomplete')
  proof=failure['nativeProof'];require(proof['native'] and proof['webglAttempts']==0 and proof['errors']==[] and proof['deviceLost']==[],'Native failure evidence invalid')
  detail={'measuredFrames':120,'warmupFrames':60,'capturedViews':0,'inspectionOmissions':59,'failure':pin(p/'failure.json'),'nativeCaptureCapacityComplete':True,'runtimeMeaning':'Retained diagnostic samples only; ineligible for formal pair scoring.'}
 else:
  t=s['engines']['three']['trials'][step['trial']-1];require(t['status']=='validated','Three offline validation missing');m=json.loads(raw(p/'measurement.json'));require(len(m['warmup'])==60 and len(m['samples'])==120 and len(m['views'])==3,'Passing sample inventory differs')
  detail={'measuredFrames':120,'warmupFrames':60,'capturedViews':3,'endToEndMs':m['timings']['endToEndMs'],'geometrySemanticHash':t['geometry']['semanticGeometrySha256']}
 operations.append({'ordinal':step['ordinal'],'engine':step['engine'],'trial':step['trial'],'operation':op_pin,'lifecycle':le,'scenePassed':op['scenePassed'],'processWallSeconds':op['processWallSeconds'],'details':detail})
require(len(operations)==6 and len({x['details']['geometrySemanticHash'] for x in operations if x['engine']=='three'})==1,'Six operations/same Three geometry required')
for key in ('driver','dispatchFreeze','method','preparation','authorDispatch'):verify(plan[key]);joined+=1
for sp in plan['sourcePins']:verify(sp,False);verify(sp['survivingFrozenCopy']);joined+=2
freeze=json.loads(verify(plan['dispatchFreeze']))
for rel,rec in freeze['files'].items():verify({'path':str(ROOT/rel),'bytes':rec['bytes'],'sha256':rec['sha256']});joined+=1
for engine,audit_pin in plan['postAuthorReadiness']['authorAudits'].items():
 a=json.loads(verify(audit_pin));base=Path(audit_pin['path']).parent
 for rel,rec in a['retainedFiles'].items():verify({'path':str(base/rel),**rec});joined+=1
 require(a['status']=='verified' and a['activeBudgetElapsedSeconds']<=1800,'Final author audit differs')
gate=ROOT/'.aperture-env/agent-house-race/validation/batch-002/repository-gate-002'
inventories=[]
for name in ('source-manifest-after.json','built-engine-manifest-after.json'):
 path=gate/name;d=json.loads(raw(path,False));files=d.get('files',d)
 require(isinstance(files,dict),'Unexpected gate manifest shape')
 for rel,rec in files.items():
  require(isinstance(rec,dict) and {'bytes','sha256'}<=set(rec),'Invalid gate file pin')
  verify({'path':str(ROOT/rel),'bytes':rec['bytes'],'sha256':rec['sha256']},False);joined+=1
 inventories.append({'manifest':pin(path,False),'count':len(files)})
scratch=Path(plan['scratchRoot']);fd=os.open(scratch/'.lifecycle.lock',os.O_RDONLY|os.O_NOFOLLOW)
try:
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);active=[];closed=0
 for p in scratch.glob('run-*'):
  state=json.loads(raw(p/'.manifest.json',False))['state']
  if state not in ('completed','retired'):active.append(p.name)
  else:closed+=1
 require(not active,'Active or unresolved scratch jobs remain')
finally:os.close(fd)
release={'schema':'aperture.root-completed-benchmark-review.v1','round':'round-003','status':'six-attempts-reviewed-closed-ineligible','reviewedBy':'/root','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'summary':pin(summary_path),'driverCompletion':pin(completion_path),'rootDriverInvocationResult':pin(invocation),'actualControlPlan':pin(plan_path),'trialOperations':operations,'successfulArtifactReceiptHashJoinsVerified':receipts_verified,'additionalHashJoinsVerified':joined,'gateSourceAndBuiltInventoriesMatched':inventories,'inputFreezeFileCount':len(freeze['files']),'authorAuditsReviewed':plan['postAuthorReadiness']['authorAudits'],'sharedLifecycleLockAcquiredAndReleased':True,'activeScratchRuns':active,'closedScratchRunCount':closed,'allSixDescendantsReapedAndCurrentManifestsMatchedRetainedCopies':True,'scoresWithheld':True,'judgeDispatchPerformed':False,'failedAttemptsReplacedOrRetried':False,'engineSourcesChangedDuringTrials':False,'geometryCauseStatus':'Code-backed120-frame live cached dependency eviction candidate, not yet reproduced at the exact transition.','nativePerformanceCauseStatus':'Unprofiled shader candidates only; no causal or savings claim.','nextStage':'Seal exact completed evidence, then separately reproduce and repair general cache lifecycle; do not modify retained authored scenes.'}
out=R/'root-completion-review.json';new(out,release);print(json.dumps({'rootCompletionReview':pin(out),'successfulArtifactReceiptJoins':receipts_verified,'otherHashJoins':joined,'closedRuns':closed,'availableDiskBytes':os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize}))
