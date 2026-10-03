"""Read retained data only; never execute repository tests, servers or browsers.

Outputs this audit's JSON beside this script. Git calls are read-only. This is
an evidence integrity/content audit, not a new native runtime validation.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
MATRIX = Path('benchmarks/native-shadow-light-matrix-v2-20261003')
ARCHIVE = '740e74bc26694104cac3a1dbddad0bbf0e6b37b6'
PREPARED = '7f1f05c5a5ce5593fdcd885fffc4f889f70ac04b'
inputs = {}

def read(path):
    path = Path(path)
    data = (ROOT / path).read_bytes()
    inputs[str(path)] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    return data

def obj(path):
    return json.loads(read(path))

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def inventory(path):
    path = Path(path)
    d = obj(path)
    files = d['files']
    entries = list(files.items()) if isinstance(files, dict) else [(x['path'], x) for x in files]
    errors, size = [], 0
    for key, expected in entries:
        target = Path(key) if key.startswith(('benchmarks/', 'packages/', 'scripts/', 'tools/', 'test/', 'docs/')) or path.name == 'source-pins.json' else path.parent/key
        try:
            data = read(target)
            size += len(data)
            if inputs[str(target)] != {'bytes': expected['bytes'], 'sha256': expected['sha256']}:
                errors.append({'path': str(target), 'expected': expected, 'actual': inputs[str(target)]})
        except FileNotFoundError:
            errors.append({'path': str(target), 'missing': True})
    return {'path': str(path), 'files': len(entries), 'bytesRead': size, 'mismatches': errors}

manifests = [
    MATRIX/'native-manifest.json', MATRIX/'source-pins.json',
    Path('benchmarks/crane-comparison-20261003/MANIFEST.json'),
    Path('benchmarks/crane-live-edits-20261003/MANIFEST.json'),
    Path('benchmarks/crane-live-edits-20261003/author-a/v1/initial-submission.json'),
    Path('benchmarks/crane-live-edits-20261003/author-a/v2/revision-submission.json'),
    Path('benchmarks/live-asset-native-validation-20261003/manifest.json'),
    Path('benchmarks/live-shadow-native-validation-20261003/manifest.json'),
    Path('benchmarks/test-discovery-integration-20261003/manifest.json'),
    Path('benchmarks/pcss-final-validation-20261002/manifest.json'),
    Path('benchmarks/crane-wall-continuity-20261003/MANIFEST.json'),
]
results = [inventory(p) for p in manifests]

# Anchor native matrix bytes to the named local archive commit, not just a
# self-contained manifest. This deliberately makes no remote publication claim.
entries = {}
for entry in git('ls-tree', '-rz', ARCHIVE, '--', str(MATRIX)).split(b'\0'):
    if not entry:
        continue
    fields, name = entry.split(b'\t', 1)
    entries[name.decode()] = fields.decode().split()[2]
archive_mismatches = []
for name, expected in entries.items():
    data = read(name)
    actual = hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    if actual != expected:
        archive_mismatches.append({'path': name, 'expectedBlob': expected, 'actualBlob': actual})

modes = ['directional', 'cascaded', 'spot', 'point']
pipeline = dict(zip(modes, ['directional','directional-cascaded','spot','point-array']))
live_ids = ['baseline','noop','vertices','vertices-noop','vertex-reset','indices','indices-noop','index-reset','reset-noop']
versions = [1,1,2,2,3,4,4,5,5]
shapes = ['baseline','baseline','vertices','vertices','baseline','indices','indices','baseline','baseline']
reuse = [False,True,False,True,False,False,True,False,True]
sessions, states, issues, pixels = [], [], [], []
for mode in modes:
    for variant in ['live','fresh-baseline','fresh-vertices','fresh-indices']:
        base = MATRIX/'renders'/mode/variant/'attempt-001'
        outcome, complete, runner = [obj(base/f) for f in ['outcome.json','complete.json','verified-runner.json']]
        sessions.append({'path': str(base), 'status': outcome['status'], 'states': complete['states'], 'serverClosed': outcome['serverClosed'], 'sourcePinsUnchanged': outcome['sourcePinsUnchanged'], 'runnerPassed': runner['status']=='passed', 'browserVersion': runner['browserVersion'], 'actualArgvMatchesRequested': runner['launch']['actualArgv']==[runner['launch']['requested']['executablePath'],*runner['launch']['requested']['args']]})
        previous = None
        for i, state in enumerate(live_ids if variant=='live' else [variant[6:]]):
            d = obj(base/(state+'.json'))
            report, proof, mesh = d['report'], d['proof'], d['sourceMesh']
            r = report['resourceReuse']; shadow = report['shadow']; reuse_expected = reuse[i] if variant=='live' else False
            byte_matches = []
            for buffer in d['gpu']['buffers']:
                source = next((x for x in mesh['streams'] if x['id']==buffer.get('streamId')), mesh['indexBuffer'])
                byte_matches.append(source['rawBytes']==buffer['fullUploadBytes'][:source['byteLength']])
            conditions = {
                'frameCorrespondence': report['ok'] and report['frame']==d['frame']==d['snapshot']['frame'],
                'versionMatches': d['assetVersion']==(versions[i] if variant=='live' else 1),
                'nativeProof': proof['native'] and proof['webglAttempts']==0 and proof['errors']==[] and proof['deviceLost']==[] and len(proof['devices'])==1 and proof['canvasWebGPU']==1 and all(a['architecture']=='swiftshader' for a in proof['adapters']),
                'rawUploadBytesMatch': len(byte_matches)==2 and all(byte_matches),
                'allReportedUploadChecksPass': all(c['ok'] for c in d['gpu']['checks']),
                'coverage': shadow['requestCoverage']['requestedCount']==shadow['requestCoverage']['servedCount']==1 and shadow['requestCoverage']['omittedCount']==0,
                'pipeline': r['autoShadowFrameCache']['pipelineKind']==pipeline[mode],
                'cacheDecision': r['autoShadowFramesReused']==int(reuse_expected) and r['autoShadowFramesCreated']==int(not reuse_expected),
                'shadowSubmission': shadow['casterCounts']['submittedDrawCalls']==0 if reuse_expected else shadow['casterCounts']['submittedDrawCalls']>0,
                'gpuFence': d['capture']['gpuFenceCompleted'],
                'identity': d['identity']['entityActive'] and d['identity']['entityCount']==5,
            }
            if previous:
                conditions['stableIdentity'] = d['identity']==previous['identity']
                conditions['newNativeSubmission'] = proof['submissions']>previous['proof']['submissions']
                conditions['frozenSnapshotInputs'] = all(d['snapshot'][k]==previous['snapshot'][k] for k in ['meshDraws','shadowCasterDraws','lights','shadowRequests','bounds','transforms','views','viewMatrices'])
                if not reuse_expected:
                    conditions['assetOnlyInvalidation'] = r['autoShadowFrameCache'].get('firstChangedInputSection')=='caster-mesh-assets'
            failed = [key for key,value in conditions.items() if not value]
            if failed:
                issues.append({'path': str(base/(state+'.json')), 'failed': failed})
            with Image.open(ROOT/base/(state+'.png')) as im:
                blank_or_size = im.size!=(512,512) or all(lo==hi for lo,hi in im.convert('RGB').getextrema()) or ('A' in im.getbands() and im.getchannel('A').getextrema()!=(255,255))
            if blank_or_size:
                issues.append({'path':str(base/(state+'.png')), 'failed':['image dimensions/nonblank/opaque']})
            states.append({'path':str(base/(state+'.json')), 'frame':d['frame'], 'assetVersion':d['assetVersion'], 'shadowSubmittedDrawCalls':shadow['casterCounts']['submittedDrawCalls'], 'shadowPassCount':shadow['passCount'], 'checks':conditions})
            previous = d
    for state, shape in zip(live_ids, shapes):
        with Image.open(ROOT/MATRIX/'renders'/mode/'live'/'attempt-001'/(state+'.png')) as a, Image.open(ROOT/MATRIX/'renders'/mode/('fresh-'+shape)/'attempt-001'/(shape+'.png')) as b:
            diff = ImageChops.difference(a.convert('RGB'),b.convert('RGB'))
            pixels.append({'mode':mode,'state':state,'control':'fresh-'+shape,'exactRgbEquality':diff.getbbox() is None})
    for shape in ['vertices','indices']:
        with Image.open(ROOT/MATRIX/'renders'/mode/'live'/'attempt-001'/'baseline.png') as a, Image.open(ROOT/MATRIX/'renders'/mode/'live'/'attempt-001'/(shape+'.png')) as b:
            diff = ImageChops.difference(a.convert('RGB'),b.convert('RGB'))
            pixels.append({'mode':mode,'state':shape,'control':'baseline','visibleDifference':diff.getbbox() is not None})

# Author attempts and post-author runs remain explicitly separate.
crane = Path('benchmarks/crane-live-edits-20261003')
author_attempts = []
for engine, attempt in [('aperture',n) for n in ['attempt-001','attempt-002','attempt-003','attempt-004','attempt-005']]+[('threejs','attempt-001')]:
    base = crane/'renders'/engine/attempt
    outcome = obj(base/'outcome.json')
    item = {'engine':engine,'attempt':attempt,'outcome':outcome}
    if (ROOT/base/'failure.json').exists():
        failure=obj(base/'failure.json');item.update({'state':failure['state'],'error':failure['error']['message'],'recordedArtifacts':len(failure['artifacts']),'proof':failure['proof']})
    else:
        complete=obj(base/'complete.json'); total_checks=0;failed_checks=0;frames=[];artifact_errors=[]
        for artifact in complete['artifacts']:
            target=base/artifact['path'];data=read(target)
            if len(data)!=artifact['bytes'] or hashlib.sha256(data).hexdigest()!=artifact['sha256']:
                artifact_errors.append(str(target))
            if target.suffix=='.json':
                state=json.loads(data);checks=state['evidence']['nativeChecks']['checks'];total_checks+=len(checks);failed_checks+=sum(not c['ok'] for c in checks)
                frames.append({'state':state['state']['id'],'revision':state['receipt']['revision'],'nativeFrame':state['receipt']['nativeFrame'],'workerCount':state['observations']['workerCount']})
        item.update({'states':complete['states'],'artifactCount':len(complete['artifacts']),'artifactHashMismatches':artifact_errors,'recordedNativeChecks':total_checks,'failedRecordedNativeChecks':failed_checks,'stateFrames':frames,'proof':complete['proof']})
    author_attempts.append(item)

queue=obj('benchmarks/evidence/queues.json')
queue_items=queue['featureQueues']['patch']+queue['maintenance']
references=[]
for item in queue_items:
    for e in item['evidence']:
        is_commit=len(e)==40 and all(c in '0123456789abcdef' for c in e)
        if is_commit:
            result=subprocess.run(['git','cat-file','-t',e],cwd=ROOT,capture_output=True,text=True)
            references.append({'id':item['id'],'reference':e,'type':'local-git-object','exists':result.returncode==0 and result.stdout.strip()=='commit'})
        else:
            p=Path('benchmarks')/e
            references.append({'id':item['id'],'reference':e,'resolvedPath':str(p),'type':'local-file','exists':(ROOT/p).is_file()})
            if (ROOT/p).is_file():read(p)

summary={
 'schema':'aperture.next-benchmark-evidence-audit.v1',
 'generatedAt':datetime.now(timezone.utc).isoformat(),
 'scope':'Read-only retained evidence audit. No repository tests or runtime validation executed.',
 'preparedCheckpoint':git('show','-s','--format=%H %T',PREPARED).decode().strip(),
 'observedWorktreeHead':git('rev-parse','HEAD').decode().strip(),
 'manifestAudits':results,
 'matrixArchiveAnchor':{'commit':ARCHIVE,'localTreeFiles':len(entries),'byteMismatches':archive_mismatches,'remoteQueried':False},
 'matrix':{'sessions':sessions,'states':states,'recordIssues':issues,'pixelComparisons':pixels,'retainedComparison':obj(MATRIX/'comparison-001.json')},
 'liveAttemptAudit':author_attempts,
 'queueAudit':{'asOf':queue['asOf'],'ids':[x['id'] for x in queue_items],'duplicateIds':len(queue_items)-len(set(x['id'] for x in queue_items)),'patchCount':len(queue['featureQueues']['patch']),'minorCount':len(queue['featureQueues']['minor']),'majorCount':len(queue['featureQueues']['major']),'maintenanceCount':len(queue['maintenance']),'references':references,'queueUnchangedSha256':inputs['benchmarks/evidence/queues.json']['sha256']},
 'inputHashes':inputs,
 'limitations':['No formal author score; exact model/settings and complete authentic transcripts remain unavailable.','Local Git anchor checks do not independently establish remote publication.','No browser/server/test/install/descendant/publication performed by this audit.','Upload observations are not GPU readback, performance or GPU-memory measurements.']
}
(OUT/'AUDIT.json').write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n')
print(json.dumps({'manifestAudits':[{'path':x['path'],'files':x['files'],'mismatches':x['mismatches']} for x in results], 'matrixArchiveFiles':len(entries),'matrixArchiveMismatches':archive_mismatches,'matrixSessions':len(sessions),'matrixStates':len(states),'matrixRecordIssues':issues,'matrixExactEqualities':sum(x.get('exactRgbEquality',False) for x in pixels),'matrixVisibleEdits':sum(x.get('visibleDifference',False) for x in pixels),'queueDuplicateIds':summary['queueAudit']['duplicateIds'],'unresolvedQueueReferences':[x for x in references if not x['exists']],'inputFilesHashed':len(inputs)},indent=2))
