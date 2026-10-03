#!/usr/bin/env python3
"""Independent offline audit. Read retained inputs, Git objects and decoded PNGs.

Run only through the adopted cleanup.py lifecycle. No network, browser, engine
mutation, build, installation or native execution. Output is exclusive-create.
Pillow is an already installed image decoder, independent of the JS recorder.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
from PIL import Image, ImageChops, __version__ as pillow_version

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
BASE = REPO / 'benchmarks/crane-topology-regression-20261003'
PIN_SHA = '773c200b542afb915ae741dc6279bff9048789bc65c8d1504a4b5cafb50d2292'
FREEZE = '7c4b867ac432bfbb132c58066b809c530e785032'
ENGINE = 'd0333acdd4443ed9a4a0239d24184755b812b447'
ARCHIVE = '8a2e900edd794d0392b133c332a3f1ba161f8302'
issues, checks = [], 0
def require(ok, name):
    global checks
    checks += 1
    if not ok:
        issues.append(name)
def sha(b): return hashlib.sha256(b).hexdigest()
def load(path): return json.loads(Path(path).read_bytes())
def rel(path): return str(Path(path).relative_to(REPO))
def canon(value): return json.dumps(value, sort_keys=True, separators=(',', ':'))
def digest(value): return sha(canon(value).encode())
def byte_array(value):
    if not isinstance(value, list) or not all(type(x) is int and 0 <= x <= 255 for x in value):
        raise ValueError('Not preserved unsigned bytes')
    return bytes(value)
def git_tree(commit, prefix):
    result = subprocess.run(['git', 'ls-tree', '-r', '-z', commit, '--', prefix], cwd=REPO, capture_output=True)
    if result.returncode:
        return None
    return {item.split(b'\t', 1)[1].decode(): item.split()[2].decode()
            for item in result.stdout.split(b'\0') if item}
def git_blob(data): return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
def geometry(record, nonpipe=False):
    result = []
    for m in record['evidence']['nativeGeometry']['meshes']:
        if nonpipe and m['name'].startswith('pipe.hollow-elbow'):
            continue
        result.append({
            'name': m['name'], 'positions': m['positions'], 'indices': m['indices'],
            'worldMatrix': m['worldMatrix'], 'submeshes': m.get('submeshes'),
            'groups': m.get('groups'), 'materials': m.get('materials'), 'drawRange': m.get('drawRange'),
            'streams': [{k: s.get(k) for k in ['id', 'semantic', 'rawBytes', 'arrayStride', 'byteStride',
                         'dataType', 'arrayType', 'attributes']} for s in m['streams']],
            'cpuStreams': m.get('cpuStreams'), 'indexRaw': (m.get('indexBuffer') or {}).get('rawBytes'),
        })
    return result
def read_png(path):
    with Image.open(path) as original:
        original.load()
        require(original.format == 'PNG' and original.size == (1024, 1024), f'{rel(path)} PNG format/size')
        rgba = original.convert('RGBA')
        require(rgba.getchannel('A').getextrema() == (255, 255), f'{rel(path)} opacity')
        rgb = original.convert('RGB')
        require(any(lo != hi for lo, hi in rgb.getextrema()), f'{rel(path)} nonuniform')
        return rgb.copy(), {'path': rel(path), 'pngSha256': sha(path.read_bytes()),
                            'rgbSha256': sha(rgb.tobytes()), 'mode': original.mode,
                            'size': list(rgb.size), 'opaque': True}
def difference(a, b):
    delta = ImageChops.difference(a, b)
    r,g,b = delta.split()
    mask = ImageChops.lighter(ImageChops.lighter(r,g),b)
    hist = mask.histogram()
    return {'differentPixels': sum(hist[1:]), 'maximumChannelDifference': max(i for i, n in enumerate(hist) if n)}

def audit():
    report = {'schema': 'aperture.independent-topology-audit.v1', 'scope': 'Post-author exploratory engineering validation only',
              'sourceFreeze': FREEZE, 'nativeArchive': ARCHIVE, 'engineSourceCommit': ENGINE,
              'decoder': {'name': 'Pillow', 'version': pillow_version}, 'sessions': [], 'pixelControls': [], 'integrity': {}}
    pins_raw = (BASE/'source-pins.json').read_bytes()
    pins = json.loads(pins_raw)
    require(sha(pins_raw) == PIN_SHA, 'source-pins exact admitted hash')
    require(pins['engineSourceCommit'] == ENGINE and pins['threeRevision'] == '185dev' and pins['engineVersion'] == '0.3.0', 'versions')
    total_bytes = 0
    for name, entry in pins['files'].items():
        data = (REPO/name).read_bytes()
        require(len(data) == entry['bytes'] and sha(data) == entry['sha256'], f'pin:{name}')
        total_bytes += len(data)
    for name, target in pins['runtimeSymlinks'].items():
        require(os.readlink(REPO/name) == target, f'pin-symlink:{name}')
        require((REPO/name).resolve().is_relative_to(REPO/pins['runtimeRoot']), f'pin-symlink-root:{name}')
    manifest = load(BASE/'NATIVE_MANIFEST.json')
    names = []
    for entry in manifest['files']:
        p = REPO/entry['path']
        data = p.read_bytes()
        require(len(data) == entry['bytes'] and sha(data) == entry['sha256'], f'manifest:{entry["path"]}')
        names.append(entry['path'])
    require(len(names) == len(set(names)), 'unique manifest entries')
    report['integrity'].update(sourcePinsSha256=sha(pins_raw), sourceFiles=len(pins['files']), sourceBytes=total_bytes,
                               runtimeSymlinks=len(pins['runtimeSymlinks']), manifestFiles=len(names), manifestSha256=sha((BASE/'NATIVE_MANIFEST.json').read_bytes()))
    for label, commit, prefix in [('engine', ENGINE, 'packages'), ('fixtureFreeze', FREEZE, rel(BASE)), ('archive', ARCHIVE, rel(BASE))]:
        tree = git_tree(commit, prefix)
        if tree is None:
            report['integrity'][label] = {'commit': commit, 'localGitObjectAvailable': False}
            continue
        selected = tree
        if label == 'engine':
            proven = load(REPO/'benchmarks/worker-shadow-light-matrix-20261003/engine-provenance.json')
            selected = {v['path']: tree[v['path']] for v in proven['sourceFiles']}
        for name, blob in selected.items():
            require(git_blob((REPO/name).read_bytes()) == blob, f'{label}-git:{name}')
        report['integrity'][label] = {'commit': commit, 'localGitObjectAvailable': True, 'files': len(selected)}
    derivation = load(BASE/'derivation.json')
    predecessor_tree = git_tree(pins['predecessorEvidenceCommit'], 'benchmarks/crane-combined-edits-20261003')
    for entry in derivation['files']:
        source = (REPO/entry['source']).read_bytes()
        target = (REPO/entry['destination']).read_bytes()
        require(sha(source) == entry['sourceSha256'] and sha(target) == entry['derivedSha256'], f'derivation:{entry["destination"]}')
        if predecessor_tree is not None:
            require(git_blob(source) == predecessor_tree[entry['source']], f'predecessor:{entry["source"]}')
    report['integrity']['derivedFiles'] = len(derivation['files'])
    expected_sessions = {(e,s) for e in ['aperture','threejs'] for s in ['live','fresh-baseline','fresh-grow','fresh-shrink']}
    attempts = sorted(BASE.glob('renders/*/*/attempt-*'))
    require(len(attempts) == 8 and {(a.parent.parent.name,a.parent.name) for a in attempts} == expected_sessions, 'exact native attempt inventory')
    records, images = {}, {}
    total_native_checks = 0
    for root in attempts:
        engine, session = root.parent.parent.name, root.parent.name
        key = f'{engine}/{session}'
        require(root.name == 'attempt-001', f'{key} unique admitted attempt')
        outcome, runner, summary, inputs = [load(root/f'{name}.json') for name in ['outcome','verified-runner','recorder-summary','inputs']]
        states = pins['sessions'][session]
        require(outcome['status'] == runner['status'] == 'passed' and outcome['sourcePinsUnchanged'] and outcome['serverClosed'] and not outcome['requestErrors'] and not outcome['error'], f'{key} outcome')
        require(outcome['sourcePinsSha256'] == inputs['sourcePinsSha256'] == PIN_SHA, f'{key} execution pins')
        require(inputs['engineSourceCommit'] == ENGINE and inputs['states'] == states and inputs['budgets'] == pins['budgets'], f'{key} inputs settings')
        launch = runner['launch']; requested = launch['requested']
        require(launch['actualArgv'] == [requested['executablePath']] + requested['args'], f'{key} exact launch argv')
        required_flags = ['--headless','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--use-webgpu-adapter=swiftshader','--use-vulkan=swiftshader','--use-gl=angle','--use-angle=swiftshader','--enable-features=Vulkan','--enable-logging=stderr','--enable-unsafe-webgpu']
        require(sorted(a for a in requested['args'] if not a.startswith('--user-data-dir=')) == sorted(required_flags), f'{key} approved flags')
        require(launch['sandboxLaunchEnabled'] is True and requested['chromiumSandbox'] is True and requested['ignoreDefaultArgs'] is True, f'{key} launch sandbox')
        require(runner['browserVersion'] == '153.0.8010.0' and runner['errors'] == [], f'{key} runtime')
        proof = runner['proof']
        require(proof['native'] and proof['webglAttempts'] == 0 and not proof['errors'] and not proof['deviceLost'] and proof['canvasWebGPU'] == 1 and len(proof['devices']) == 1 and proof['adapters'][0]['architecture'] == 'swiftshader', f'{key} native runner proof')
        paths = [f'states/{s["id"]}.{ext}' for s in states for ext in ['json','png']] + ['complete.json']
        require(summary['states'] == len(states) and summary['complete'] and [r['path'] for r in summary['acknowledged']] == paths, f'{key} recorder order')
        for idx, receipt in enumerate(summary['acknowledged']):
            actual = (root/receipt['path']).read_bytes()
            require(sha(actual) == receipt['sha256'] and len(actual) == receipt['bytes'] and receipt['ok'], f'{key} receipt:{receipt["path"]}')
            disk_receipt = load(root/f'receipts/{idx:03d}.json')
            require(disk_receipt == receipt, f'{key} immutable receipt:{idx}')
        live_records, live_images, state_reports = [], [], []
        for index, state in enumerate(states):
            record = load(root/f'states/{state["id"]}.json')
            evidence = record['evidence']; receipt = record['receipt']; rev = index+1
            label = key+'/'+state['id']
            require(record['state'] == state and record['engine'] == engine and evidence['stateId'] == receipt['stateId'] == state['id'], f'{label} state')
            require(evidence['revision'] == receipt['revision'] == receipt['workerRevision'] == receipt['submittedRevision'] == rev, f'{label} revision')
            proof = record['proof']; obs = record['observations']
            require(proof['native'] and proof['webglAttempts'] == 0 and not proof['errors'] and not proof['deviceLost'] and len(proof['devices']) == 1 and proof['canvasWebGPU'] == 1, f'{label} proof')
            require(obs['workerCount'] == obs['deviceCount'] == obs['webgpuCanvasCount'] == 1 and obs['runtimeReferencesStable'] and obs['workerTerminationCalls'] == 0, f'{label} persistent references')
            require(record['capture']['gpuFenceCompleted'] and record['capture']['presentationFrames'] == 2 and record['capture']['width'] == record['capture']['height'] == 1024, f'{label} capture fence')
            native_checks = evidence['nativeChecks']['checks']
            require(evidence['nativeChecks']['ok'] and all(c['ok'] for c in native_checks) and not evidence['validationErrors'], f'{label} all recorded native checks')
            total_native_checks += len(native_checks)
            previous = live_records[-1] if live_records else None
            if previous:
                prev = previous['evidence']
                require(evidence['identity'] == prev['identity'], f'{label} stable scene/entities/handles')
                require(evidence['camera'] == prev['camera'] and evidence['appearance'] == prev['appearance'], f'{label} unchanged appearance/camera')
                require(geometry(record,True) == geometry(previous,True), f'{label} unchanged nonpipe raw geometry')
                if state.get('noop'): require(geometry(record) == geometry(previous), f'{label} no-op raw equality')
            counter = [0,0,1,1,2,3,4,5][index] if session == 'live' else 0
            meshes = evidence['nativeGeometry']['meshes']
            scope = evidence['nativeGeometry']['submittedDraws']
            require(scope['submissions'] > 0 and scope['draws'] and scope['frame'] == (receipt['nativeFrame'] if engine == 'aperture' else rev), f'{label} draw scope')
            bound = [b for d in scope['draws'] for b in d['vertices']+([d['index']] if d['index'] else [])]
            raw_bytes = 0; submitted_pipe = []
            topology = pins['topologies'][state['edit']]; c,s = topology['curveSegments'],topology['radialSegments']
            if engine == 'aperture':
                sub = evidence['nativeSubmission']; frame = receipt['nativeFrame']
                require(all(sub[f] == frame for f in ['workerSnapshotFrame','workerSnapshotFrameField','nativeReportFrame','actualRenderSnapshotFrame']), f'{label} frame correspondence')
                require(evidence['snapshotFrame'] == evidence['snapshotFrameField'] == frame and sub['nativeFrameReport']['ok'] and sub['nativeFrameReport']['frame'] == frame and sub['nativeRenderMethodCompletionObserved'], f'{label} consumed/rendered frame')
                trace = evidence['nativeCorrespondenceTrace']
                for kind in ['publication','reception']:
                    require(any(t['revision'] == rev and t['stateId'] == state['id'] and t['frame'] == t['snapshotFrame'] == frame for t in trace[kind]), f'{label} native {kind}')
                require(evidence['transport']['active'] == 'shared-array-buffer' and evidence['transport']['fallback'] is None and evidence['transport']['sharedArrayBuffer']['supported'], f'{label} SAB transport')
                require(evidence['appearance']['config']['cadence'] == 'demand', f'{label} demand-only scope')
                resources = evidence['resources']['worker']
                require(resources['meshAssetReplacements'] == resources['publishedVertexArrayReplacements'] == counter*3 and resources['publishedIndexArrayReplacements'] == resources['entityDestroyCalls'] == 0 and resources['entityCreateCalls'] == 70, f'{label} replacement counters')
                for mesh in meshes:
                    pipe = mesh['name'].startswith('pipe.hollow-elbow')
                    require(mesh['assetVersion'] == (counter+1 if pipe else 1), f'{label}/{mesh["name"]} asset version')
                    for stream in mesh['streams']:
                        raw = byte_array(stream['rawBytes']); raw_bytes += len(raw)
                        require(len(raw) == stream['byteLength'] == stream['vertexCount']*stream['arrayStride'], f'{label}/{mesh["name"]} raw length')
                        posattr = next(a for a in stream['attributes'] if a['semantic']=='POSITION')
                        decoded = [v for offset in range(posattr['offset'], len(raw), stream['arrayStride']) for v in struct.unpack_from('<fff', raw, offset)]
                        require(decoded == mesh['positions'], f'{label}/{mesh["name"]} preserved raw positions')
                        matches = [b for b in bound if b['label'] == mesh['name']+'/vertex:'+stream['id']]
                        require(bool(matches), f'{label}/{mesh["name"]} submitted buffer present')
                        for binding in matches:
                            uploads = [u for u in evidence['nativeGeometry']['gpuBuffers'] if u['name']==mesh['name'] and u.get('streamId')==stream['id'] and u['nativeDrawBufferId']==binding['id']]
                            require(len(uploads)==1, f'{label}/{mesh["name"]} exact object join')
                            if not uploads: continue
                            upload = uploads[0]
                            require(byte_array(upload['fullUploadBytes'])[:len(raw)] == raw and upload['ok'] and upload['nativeByteLength']==len(raw) and upload['writeCalls']>0, f'{label}/{mesh["name"]} exact upload raw bytes')
                    if pipe:
                        count = 12*s if mesh['name'].endswith('.rims') else 6*c*s
                        draws = [d for d in scope['draws'] if any(b['label'].startswith(mesh['name']+'/vertex:') for b in d['vertices'])]
                        require(len(mesh['positions']) == 3*count and not mesh['indices'], f'{label}/{mesh["name"]} analytic count')
                        require(all(d['method']=='draw' and d['count']==count and d['start']==0 and d['instances']==1 for d in draws), f'{label}/{mesh["name"]} active draw range')
                        require(all(b['offset']==0 and b['size']>=count*32 and b['size']<=b['allocationBytes'] for d in draws for b in d['vertices'] if b['label'].startswith(mesh['name']+'/vertex:')), f'{label}/{mesh["name"]} binding range')
                        submitted_pipe.append({'name':mesh['name'],'vertices':count,'draws':len(draws),'assetVersion':mesh['assetVersion'],'bufferIds':sorted({b['id'] for d in draws for b in d['vertices'] if b['label'].startswith(mesh['name']+'/vertex:')})})
            else:
                detail = receipt['details']; corr = detail['correspondence']
                require(corr['revision']==rev and corr['rendererFrame']==corr['afterRendererFrame']==receipt['nativeFrame'] and corr['afterRendererCall']>=corr['rendererCall'], f'{label} render completion')
                require(detail['gpuReadback']['afterCorrelatedRender'] and detail['gpuReadback']['comparedBytesExactly'] and not detail['validationErrors'], f'{label} readback completion')
                resources = evidence['resources']['nativeObjects']
                require(resources['geometryReplacements']==resources['geometryDisposeCalls']==counter and resources['attributeReplacements']==counter*3 and resources['inPlaceAttributeWrites']==resources['matrixUpdates']==0, f'{label} replacement counters')
                sources = {m['name']:m for m in evidence['sourceGeometry']['meshes']}
                inventory = evidence['resources']['inventory']
                for mesh in meshes:
                    src = sources[mesh['name']]
                    cpus = {x['semantic']:x for x in mesh['cpuStreams']}
                    raw_src = {x['semantic']:x for x in src['rawStreams']}
                    for sem, source_sem in [('position','positions'),('normal','normals'),('index','indices')]:
                        require(byte_array(cpus[sem]['rawBytes']) == byte_array(raw_src[source_sem]['rawBytes']), f'{label}/{mesh["name"]}/{sem} source CPU exact raw')
                    for stream in mesh['streams']:
                        raw = byte_array(stream['rawBytes']); raw_bytes += len(raw)
                        require(raw == byte_array(cpus[stream['semantic']]['rawBytes']), f'{label}/{mesh["name"]}/{stream["semantic"]} actual readback exact raw')
                        require(len(raw)==stream['byteLength'], f'{label}/{mesh["name"]}/{stream["semantic"]} readback length')
                        fmt = '<'+ ('I' if stream['semantic']=='index' else 'f')*(len(raw)//4)
                        expected = mesh['indices'] if stream['semantic']=='index' else mesh['positions'] if stream['semantic']=='position' else mesh['normals']
                        require(list(struct.unpack(fmt,raw))==expected, f'{label}/{mesh["name"]}/{stream["semantic"]} raw decoded values')
                    for draw in corr['drawnMeshes']:
                        if draw['name']==mesh['name']:
                            require(draw['workerRevision']==rev and draw['geometryId']==mesh['geometryId'] and draw['positionAttributeId']==mesh['attributeIds']['position'] and draw['indexAttributeId']==mesh['attributeIds']['index'], f'{label}/{mesh["name"]} native callback object identities')
                    if mesh['name'].startswith('pipe.hollow-elbow'):
                        v,i = 8*s*(c+1),12*s*(c+1)
                        require(len(mesh['positions'])==v*3 and len(mesh['indices'])==i and all(0<=n<v for n in mesh['indices']), f'{label} analytic indexed counts')
                        inv = {x['semantic']:x for x in inventory if x['mesh']==mesh['name']}
                        draws = [d for d in scope['draws'] if d['index'] and d['index']['id']==inv['index']['nativeDrawBufferId']]
                        require(bool(draws), f'{label} exact readback/submitted index object')
                        for d in draws:
                            require(d['method']=='drawIndexed' and d['instances']==1 and d['baseVertex']==0 and 0<=d['start']<d['start']+d['count']<=i and d['start']%3==d['count']%3==0, f'{label} active index range')
                            require(d['index']['format']=='uint32' and d['index']['offset']==0 and i*4<=d['index']['size']<=d['index']['allocationBytes'], f'{label} index bound range')
                            vb = [b for b in d['vertices'] if b['id']==inv['position']['nativeDrawBufferId']]
                            require(len(vb)==1 and vb[0]['offset']==0 and v*12<=vb[0]['size']<=vb[0]['allocationBytes'], f'{label} exact readback/submitted vertex object')
                        for group in mesh['groups']:
                            require(any(d['start']==group['start'] and d['count']==group['count'] for d in draws), f'{label} material group draw coverage')
                        submitted_pipe.append({'name':mesh['name'],'vertices':v,'indices':i,'draws':len(draws),'geometryId':mesh['geometryId'],'indexBufferId':inv['index']['nativeDrawBufferId'],'positionBufferId':inv['position']['nativeDrawBufferId']})
            image, image_report = read_png(root/f'states/{state["id"]}.png')
            live_images.append(image); live_records.append(record)
            state_reports.append({'state':state['id'],'edit':state['edit'],'revision':rev,'nativeFrame':receipt['nativeFrame'],
                                  'submittedScopeFrame':scope['frame'],'submissionsInScope':scope['submissions'],
                                  'drawsInScope':len(scope['draws']), 'bundleDraws':sum(bool(d.get('viaBundle')) for d in scope['draws']),
                                  'instanceCounts':sorted({d.get('instances', 0) for d in scope['draws']}),
                                  'nativeChecks':len(native_checks), 'validatedRawBytes':raw_bytes,
                                  'pipe':submitted_pipe,'nonpipeGeometrySha256':digest(geometry(record,True)), 'image':image_report})
        records[(engine,session)], images[(engine,session)] = live_records, live_images
        report['sessions'].append({'engine':engine,'session':session,'attempt':root.name,'status':outcome['status'],'states':state_reports,
                                   'browserVersion':runner['browserVersion'],'sourcePinsSha256':outcome['sourcePinsSha256'],
                                   'loadedInputCount':len(load(root/'loaded-inputs.json'))})
    require(sum(len(v) for v in records.values()) == 22, 'exact capture count')
    for engine in ['aperture','threejs']:
        for index, record in enumerate(records[(engine,'live')]):
            control = 'fresh-'+record['state']['edit']
            delta = difference(images[(engine,'live')][index], images[(engine,control)][0])
            geq = geometry(record)==geometry(records[(engine,control)][0])
            require(delta['differentPixels']==0 and geq, f'{engine}/{record["state"]["id"]} independent cold RGB/raw control')
            report['pixelControls'].append({'engine':engine,'state':record['state']['id'],'control':control,'kind':'exact-live-cold','geometryEqual':geq,**delta})
        for edit in ['grow','shrink']:
            delta = difference(images[(engine,'fresh-baseline')][0], images[(engine,'fresh-'+edit)][0])
            require(delta['differentPixels']>0, f'{engine}/{edit} visible mutation')
            report['pixelControls'].append({'engine':engine,'state':edit,'control':'fresh-baseline','kind':'visible-mutation',**delta})
        previous = REPO/'benchmarks/crane-live-edits-20261003/renders'/engine/('attempt-005' if engine=='aperture' else 'attempt-001')
        old_image, old_meta = read_png(previous/'states/s00-baseline.png')
        require(load(previous/'outcome.json')['status']=='passed', f'{engine} retained baseline outcome')
        delta = difference(images[(engine,'fresh-baseline')][0],old_image)
        require(delta['differentPixels']==0, f'{engine} retained baseline exact RGB')
        report['pixelControls'].append({'engine':engine,'state':'fresh-baseline','control':old_meta['path'],'kind':'retained-baseline',**delta})
    report['nativeChecks'] = total_native_checks
    report['lifecycle'] = []
    for path in sorted((BASE/'lifecycle-audits-native').glob('*.jsonl')):
        events = [json.loads(line) for line in path.read_text().splitlines()]
        require(events[-1]['event']=='run-completed' and events[-1]['exitcode']==0, f'lifecycle:{path.name}')
        report['lifecycle'].append({'path':rel(path),'sha256':sha(path.read_bytes()),'completion':events[-1]})
    failures=[]
    for path in sorted(BASE.glob('*.log')):
        data=path.read_text(errors='replace')
        relevant=[line[:280] for line in data.splitlines() if re.search(r'not ok|\b\w*Error(?::|\s\[)|# fail [1-9]',line)]
        if relevant: failures.append({'path':rel(path),'sha256':sha(path.read_bytes()),'messages':relevant[:12]})
    report['preservedPreparationFailures']=failures
    for expected in load(BASE/'PREPARATION_REPORT.json')['preservedFailures']:
        require(any(Path(f['path']).name==expected['file'] for f in failures), f'preserved-failure-inventory:{expected["file"]}')
    report['preparationFailureInterpretations']=load(BASE/'PREPARATION_REPORT.json')['preservedFailures']
    queue=load(REPO/'benchmarks/evidence/queues.json')
    items=queue['maintenance']+[i for vals in queue['featureQueues'].values() for i in vals]
    require(len({i['id'] for i in items})==len(items),'deduplicated queue IDs')
    report['queue']={'asOf':queue['asOf'],'ids':[i['id'] for i in items],'minor':len(queue['featureQueues']['minor']),'major':len(queue['featureQueues']['major']),'releaseAuthorized':queue['releaseAuthorized']}
    report['checks'] = checks; report['issues'] = issues; report['status'] = 'passed' if not issues else 'failed'
    return report

if __name__ == '__main__':
    output = HERE / (sys.argv[1] if len(sys.argv)>1 else 'AUDIT.json')
    if output.parent != HERE or output.exists(): raise SystemExit('Expected new basename inside audit folder')
    try:
        result=audit()
    except Exception as error:
        result={'status':'audit-tool-error','error':repr(error),'checks':checks,'issues':issues}
    with output.open('x') as file: json.dump(result,file,indent=2); file.write('\n')
    print(json.dumps({k:result.get(k) for k in ['status','checks','nativeChecks','issues','error']}))
    raise SystemExit(0 if result['status']=='passed' else 1)
