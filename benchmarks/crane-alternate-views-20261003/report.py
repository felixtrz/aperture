#!/usr/bin/env python3
"""Retain final evidence summary; never manufacture native outcomes."""
from pathlib import Path
import json,hashlib,os
HERE=Path(__file__).resolve().parent
REPO=HERE.parent.parent
hash=lambda b:hashlib.sha256(b).hexdigest()
log=(HERE/'frozen-validation.log').read_text()
summary=json.loads(next(line.split('CPU_VIEW_SUMMARY ',1)[1] for line in log.splitlines() if 'CPU_VIEW_SUMMARY ' in line))
assert len(summary['states'])==8 and 'ℹ pass 12' in log and 'ℹ fail 0' in log
pins=json.loads((HERE/'source-pins.json').read_text())
preflight=json.loads((HERE/'preflight-frozen.json').read_text())
audits=[]
for path in sorted((HERE/'lifecycle-audits').glob('*.jsonl')):
    events=[json.loads(line) for line in path.read_text().splitlines()]
    start=next(e for e in events if e['event']=='run-start')
    completed=next((e for e in events if e['event']=='run-completed'),None)
    if not completed:
        assert start['run']==os.environ['APERTURE_TMP_RUN_ID'],'Other owned lifecycle still active'
    audits.append({'path':str(path.relative_to(REPO)),'run':start['run'],'job':start['job'],'completed':bool(completed),'exitcode':completed['exitcode'] if completed else None})
value={
 'status':'cpu-validated-frozen-native-pending',
 'scope':'Existing-catalog camera-only post-author paired regression; no score, ranking or performance claim.',
 'sourcePinsSha256':hash((HERE/'source-pins.json').read_bytes()),
 'pinnedInputs':len(pins['files']),
 'engineSourceCommit':pins['engineSourceCommit'],'engineVersion':pins['engineVersion'],'threeRevision':pins['threeRevision'],
 'preparationCheckpoint':pins['preparationCheckpoint'],'preparationTree':pins['preparationTree'],
 'durablePredecessor':pins['predecessorEvidenceCommit'],
 'sourceFilesVerifiedAgainstCheckpoint':26,'mechanicallyDerivedFiles':26,'byteUnchangedCopies':17,
 'cpuTests':{'passed':12,'failed':0,'log':'frozen-validation.log','actualNativeWebGpuRuns':0},
 'cpuStateCount':8,'cpuGeometryChecks':summary['geometryChecks'],'cpuIndependentSemanticChecks':summary['semanticChecks'],
 'cpuStates':summary['states'],
 'servedModulePreflight':{'passed':preflight['status']=='passed','modules':preflight['moduleCount'],'report':'preflight-frozen.json','disabledOptionalImports':len(preflight['excludedOptionalImports']),'nonliteralDynamicImports':len(preflight['nonliteralDynamicImports']),'browsersLaunched':0,'serversStarted':0},
 'retainedNativeControls':{'engineCount':2,'poses':['baseline','all'],'sessions':4,'allAcknowledgedJsonAndPngBytesVerified':True,'imagesUnchanged':True},
 'nativeAdmissionPlan':{'sessions':8,'states':8,'attemptsPerSession':1,'nativeRunsSoFar':0,'samePoseGeometryRawAppearanceExactMatches':8,'visibleCameraChangesAgainstFront':8,'visiblePoseChanges':4,'visibleAlternateCameraChanges':4,'crossEnginePixelEquality':False,'differentViewPixelEquality':False},
 'remainingGates':['Parent review/publication and separate native admission of this immutable source freeze.','Eight genuine native SwiftShader WebGPU sessions through approved runVerifiedScene and lifecycle; stop on first real mismatch.','Offline native comparison over genuine immutable captures.','Separate independent qualitative inspection of all eight real native images.'],
 'retainedPreparationFailures':[{'log':'derive-001.log','cause':'CPU loader exact path seam count expected five, actual four; corrected derivation count before freeze.'},{'log':'cpu-001.log','cause':'Test-only JSON conversion treated typed arrays as objects; corrected CPU serialization to match native jsonValue behavior before freeze.'}],
 'limitations':['No native alternate-view or visual-quality result inferred from CPU/synthetic fixtures.','Aperture upload observation is not GPU readback; Three.js retains native GPU readback.','Float32 camera matrices use 2e-5 absolute geometric tolerance; raw bytes/control images use exact equality.','Original author transcripts and equal model/settings provenance remain unavailable; no author scores.','No engine edits, installs, builds, browser/server/native runs, descendants or publication by this worker.','Full repository validation is outside this bounded fixture preparation.'],
 'lifecycleRuns':audits,
 'quiescence':{'browserStarts':0,'serverStarts':0,'descendantAgentsSpawned':0,'allPriorOwnedValidationLifecyclesCompleted':all(a['completed'] for a in audits if a['run']!=os.environ['APERTURE_TMP_RUN_ID']),'finalizationRun':os.environ['APERTURE_TMP_RUN_ID'],'handoffRequires':'This final report/inventory lifecycle must return with exitcode 0 and a run-completed receipt before parent handoff; read QUIESCENCE.json for the subsequently confirmed result.','scope':'This worker only; no claim about unrelated shared-repository work.'},
 'keyHashes':{name:hash((HERE/name).read_bytes()) for name in ['contract.mjs','camera-proof.mjs','derivation.json','derivation.diff','source-audit.json','camera-gate-audit.json','run.mjs','compare.mjs','source-pins.json','frozen-validation.log']}
}
with (HERE/'PREPARATION_REPORT.json').open('x') as f:json.dump(value,f,indent=2);f.write('\n')
print(json.dumps({'status':value['status'],'sourcePinsSha256':value['sourcePinsSha256'],'pinnedInputs':value['pinnedInputs'],'testsPassed':12,'nativeRuns':0,'finalizationRun':os.environ['APERTURE_TMP_RUN_ID']}))
