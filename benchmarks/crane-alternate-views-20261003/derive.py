#!/usr/bin/env python3
"""Exact-once adapter-only derivation from immutable combined regression."""
from pathlib import Path
import argparse, hashlib, json, difflib
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
OLD=REPO/'benchmarks/crane-combined-edits-20261003'
SPECS=[]
def add(name, replacements=(), dest=None): SPECS.append((name,dest or name,list(replacements)))
for name in ['author-a/scene.mjs','author-a/worker.mjs','author-a/gpu-observer.mjs','author-a/native-evidence.mjs','author-a/frame-proof.mjs','author-a/index.html','author-b/scene-data.mjs','author-b/worker.mjs','author-b/checks.mjs','author-b/native-meshes.mjs','author-b/gpu-evidence.mjs','author-b/lighting.mjs','author-b/index.html','harness/client.mjs','harness/recorder.mjs','semantics.mjs']:
    add(name)
add('contract.mjs',dest='pose-contract.mjs')
add('author-a/scene-system.mjs',[("STATES, parametersFor, INITIAL_EDIT", "STATES, parametersFor, INITIAL_EDIT, VIEW_NAME"),("const view = 'front-quarter';", "const view = VIEW_NAME;")])
add('author-a/main.mjs',[("import { STATES }", "import { apertureCamera } from '../camera-proof.mjs';\nimport { STATES, VIEW_NAME }"),("camera: { position: CAMERAS['front-quarter'],", "camera: { name: VIEW_NAME, native: apertureCamera(observed.submittedSnapshot), position: CAMERAS[VIEW_NAME],")])
add('author-b/scene.mjs',[("import { parametersFor, STATES }", "import { threeCamera } from '../camera-proof.mjs';\nimport { parametersFor, STATES, VIEW_NAME }"),("currentData.cameras['front-quarter']", "currentData.cameras[VIEW_NAME]"),("camera.name = 'front-quarter'", "camera.name = VIEW_NAME"),("cameraId: camera.id, rendererFrame", "cameraId: camera.id, cameraBefore: threeCamera(actualCamera), rendererFrame"),("completedSubmission = { ...activeSubmission.before,", "completedSubmission = { ...activeSubmission.before, cameraAfter: threeCamera(actualCamera),"),("camera: { position: camera.position.toArray(),", "camera: { name: VIEW_NAME, native: threeCamera(camera), position: camera.position.toArray(),")])
add('harness/contract.mjs',[("export const SESSION_ID = 'live';", "export const SESSION_ID = 'rear-quarter-baseline';"),("export const INITIAL_EDIT = STATES[0].edit;", "export const INITIAL_EDIT = STATES[0].edit;\nexport const VIEW_NAME = STATES[0].view;")])
add('harness/base-checks.mjs',[("import { SCHEMA, STATES, parametersFor }", "import { viewFor } from '../contract.mjs';\nimport { SCHEMA, STATES, parametersFor }"),("canonical(evidence.camera?.position) === canonical([8, 6.5, 10])", "canonical(evidence.camera?.position) === canonical(viewFor(state).position)"),("'Fixed front-quarter camera mismatch'", "'Selected catalog camera mismatch'")])
add('harness/checks.mjs',[("export * from", "import { validateCameraEvidence } from '../camera-proof.mjs';\nexport * from"),("  validateRawEvidence(evidence, engine);", "  validateCameraEvidence(evidence, state, receipt, engine);\n  validateRawEvidence(evidence, engine);")])
add('run.mjs',[("export const SESSION_ID = 'live';", "export const SESSION_ID = 'rear-quarter-baseline';"),("[\"/contract.mjs\", \"/semantics.mjs\"]", "[\"/contract.mjs\", \"/pose-contract.mjs\", \"/camera-proof.mjs\", \"/semantics.mjs\"]"),("post-author combined regression; no score", "post-author alternate-camera regression; no score")])
add('cpu-loader.mjs',[("benchmarks/crane-combined-edits-20261003", "benchmarks/crane-alternate-views-20261003")])
# cpu-loader contains several identical path strings: enumerate these as a separate exact-count mechanical rule below.
SPECS[-1]=(SPECS[-1][0],SPECS[-1][1],[("__OWN_PATHS__", "__OWN_PATHS__")])
add('preflight.mjs',[("readServedModule(pathname, \"live\", pins)", "readServedModule(pathname, \"rear-quarter-baseline\", pins)")])
def derive(name,replacements):
    original=(OLD/name).read_text(); result=original
    if name=='cpu-loader.mjs':
        old='benchmarks/crane-combined-edits-20261003'; new='benchmarks/crane-alternate-views-20261003'
        if result.count(old)!=4: raise RuntimeError('CPU import path seam count changed')
        result=result.replace(old,new).replace('session = "live"','session = "rear-quarter-baseline"').replace("export const SESSION_ID = 'live';", "export const SESSION_ID = 'rear-quarter-baseline';")
    else:
        for old,new in replacements:
            if result.count(old)!=1: raise RuntimeError(f'Expected exactly one seam {name}: {old!r}, actual {result.count(old)}')
            result=result.replace(old,new)
    return original,result
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--refresh',action='store_true');args=parser.parse_args()
    if args.refresh and (ROOT/'source-pins.json').exists():raise RuntimeError('Frozen fixture cannot change')
    entries=[];patch=[]
    for name,dest,replacements in SPECS:
        original,result=derive(name,replacements);target=ROOT/dest
        if args.check:
            if target.read_text()!=result:raise RuntimeError(f'Derived bytes differ: {dest}')
        else:
            target.parent.mkdir(exist_ok=True)
            with target.open('w' if args.refresh else 'x') as f:f.write(result)
        entries.append({'source':str((OLD/name).relative_to(REPO)),'destination':str(target.relative_to(REPO)),'sourceSha256':hashlib.sha256(original.encode()).hexdigest(),'derivedSha256':hashlib.sha256(result.encode()).hexdigest(),'unchanged':original==result})
        patch.extend(difflib.unified_diff(original.splitlines(True),result.splitlines(True),fromfile=str((OLD/name).relative_to(REPO)),tofile=str(target.relative_to(REPO))))
    manifest=json.dumps({'scope':'camera-selector and actual native-camera evidence adapters only; geometry/material/light/pose expressions untouched','files':entries},indent=2)+'\n'
    if args.check:
        if (ROOT/'derivation.json').read_text()!=manifest or (ROOT/'derivation.diff').read_text()!=''.join(patch):raise RuntimeError('Derivation receipts changed')
    else:
        (ROOT/'derivation.json').write_text(manifest);(ROOT/'derivation.diff').write_text(''.join(patch))
    print(json.dumps({'ok':True,'files':len(entries),'unchanged':sum(x['unchanged'] for x in entries),'mode':'check' if args.check else 'derive'}))
