import datetime
import hashlib
import json
import math
import sys
import pathlib
from PIL import Image, __version__ as pillow_version

BASE = pathlib.Path(__file__).parent
ROOT = pathlib.Path('/workspace/aperture')
files_verified = 0
bytes_verified = 0
rasters = {}


def load(path):
    return json.loads(pathlib.Path(path).read_text())


def pin(path):
    path = pathlib.Path(path)
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def verify(expected, path=None):
    global files_verified, bytes_verified
    actual = pin(path or expected['path'])
    assert actual['sha256'] == expected['sha256'], actual['path']
    if 'bytes' in expected:
        assert actual['bytes'] == expected['bytes'], actual['path']
    files_verified += 1
    bytes_verified += actual['bytes']
    return actual


def inventory(root, expected):
    root = pathlib.Path(root)
    paths = []
    for path in root.rglob('*'):
        assert not path.is_symlink(), path
        if path.is_file():
            paths.append(str(path.relative_to(root)))
    assert set(paths) == set(expected), str(root)
    for path, descriptor in expected.items():
        verify(descriptor, root / path)


def raster(path):
    path = pathlib.Path(path)
    if path not in rasters:
        with Image.open(path) as image:
            assert image.format == 'PNG' and image.size == (1024, 768)
            rasters[path] = image.convert('RGBA').tobytes()
    return rasters[path]


def summarize(values):
    assert values and all(math.isfinite(value) and value >= 0 for value in values)
    ordered = sorted(values)
    return {'count': len(values), 'min': ordered[0], 'median': ordered[math.ceil(len(values) * .5) - 1], 'p95': ordered[math.ceil(len(values) * .95) - 1], 'max': ordered[-1], 'mean': sum(values) / len(values)}


plan_path = BASE / 'comparison-001/plan.json'
plan_pin = pin(plan_path)
assert len(sys.argv)==2 and plan_pin['sha256'] == sys.argv[1]
plan = load(plan_path)
assert plan['mode'] == 'comparison' and len(plan['order']) == 18
assert [entry['variant'] for entry in plan['order']] == ['three-baseline', 'aperture-fixed-storage-fresnel', 'aperture-flat-draw-constants', 'aperture-fixed-storage-fresnel', 'aperture-flat-draw-constants', 'three-baseline', 'aperture-flat-draw-constants', 'three-baseline', 'aperture-fixed-storage-fresnel', 'three-baseline', 'aperture-flat-draw-constants', 'aperture-fixed-storage-fresnel', 'aperture-flat-draw-constants', 'aperture-fixed-storage-fresnel', 'three-baseline', 'aperture-fixed-storage-fresnel', 'three-baseline', 'aperture-flat-draw-constants']
assert plan['measuredFrames'] == 96 and plan['warmupFrames'] == 20
for entry in plan['inputs'].values():
    inventory(entry['root'], entry['inventory'])
for entry in plan['nativeRuntimePackages'].values():
    inventory(entry['root'], entry['inventory'])
inventory(plan['frozenHarness']['root'], plan['frozenHarness']['inventory'])
for key in ['helper', 'client', 'bindingObserver']:
    verify(plan[key])
for entry in plan['sourceBuilds'].values():
    verify(entry)
for entry in plan['shaderExpected'].values():
    verify(entry)
for path, expected in plan['runtimeInputs'].items():
    verify(expected, ROOT / path)
verify({'path': plan['sourceDeclaration']['path'], 'sha256': plan['sourceDeclaration']['sha256']})
for path, expected in [(plan['activation']['path'], plan['activation']['sha256']), (plan['activation']['modulePath'], plan['activation']['moduleSha256']), (plan['classification']['modulePath'], plan['classification']['moduleSha256'])]:
    verify({'path': path, 'sha256': expected})
summary_path = BASE / 'comparison-001/summary.json'
summary = load(summary_path)
assert summary['planSha256'] == plan_pin['sha256']
completed = load(BASE / 'comparison-001/operations/completed.json')
assert completed['planSha256'] == plan_pin['sha256'] and completed['allDeclaredClosedPassed'] and completed['unattemptedOrdinals'] == []
attempts = []
ordinary_pixels = []
for entry in plan['order']:
    attempt = pathlib.Path(entry['attemptRoot'])
    outcome = load(attempt / 'outcome.json')
    assert outcome['status'] == outcome['nativeStatus'] == 'passed' and outcome['error'] is None
    receipts = load(attempt / 'receipts.json')
    assert receipts['failures'] == []
    for receipt in receipts['receipts']:
        verify(receipt, attempt / receipt['path'])
    measurement = load(attempt / 'measurement.json')
    assert measurement['planSha256'] == plan_pin['sha256'] and measurement['variant'] == entry['variant']
    assert len(measurement['samples']) == 96 and len(measurement['warmup']) == 20
    for index, sample in enumerate(measurement['samples']):
        assert load(attempt / f'sample-{index:05d}.json') == sample
        assert sample['drawCalls'] == (12 if entry['engine'] == 'aperture' else 13)
        assert sample['submittedTriangles'] == 25725 and sample['renderPasses'] == 2 and sample['computePasses'] == 0
        assert sample['renderPipelinesCreated'] == sample['texturesCreated'] == sample['buffersCreated'] == 0
        assert all(sample[field] == measurement['samples'][0][field] for field in plan['stableFrameCriterion']['fields'])
        assert sample['submittedTriangleAccounting']['proofStatus'] == 'complete'
        assert math.isclose(sample['endToEndMs'], sample['cpuSubmissionMs'] + sample['queueCompletionLatencyMs'], rel_tol=0, abs_tol=1e-9)
    timings = {}
    for field in ['cpuSubmissionMs', 'applicationPromiseMs', 'queueCompletionLatencyMs', 'endToEndMs']:
        calculated = summarize([sample[field] for sample in measurement['samples']])
        assert calculated == measurement['timings'][field], (entry['ordinal'], field)
        timings[field] = calculated
    verified_runner = load(attempt / 'verified-runner.json')
    native = verified_runner['proof']
    assert verified_runner['status'] == 'passed' and verified_runner['errors'] == []
    assert native['native'] and native['errors'] == native['deviceLost'] == [] and native['webglAttempts'] == 0
    assert native['adapters'] and all(adapter['architecture'] == 'swiftshader' for adapter in native['adapters'])
    activation = load(attempt / 'native-shader-activation.json')
    binding_record = load(attempt / 'native-architecture-bindings.json')
    assert activation['failures'] == binding_record['failures'] == []
    assert measurement['activationWitness']['status'] == 'passed'
    actual_shaders = {shader['id']: shader for shader in activation['shaders']}
    hdr = [pipeline for pipeline in activation['pipelines'] if pipeline['everSubmitted'] and pipeline['colorFormats'] == ['rgba16float']]
    assert hdr and all(pipeline['sampleCount'] == 4 for pipeline in hdr)
    lighting_uses = 0
    if entry['engine'] == 'aperture':
        assert len(hdr) == 1
        shader = actual_shaders[hdr[0]['fragmentShaderId']]
        assert shader['code'].encode() == pathlib.Path(plan['shaderExpected'][entry['variant']]['path']).read_bytes()
        assert measurement['activationWitness']['architectureBindings']['expectedTransport'] == 'known-storage'
        groups = {group['id']: group for group in binding_record['bindGroups']}
        layouts = {layout['id']: layout for layout in binding_record['layouts']}
        pipelines = {pipeline['id']: pipeline for pipeline in binding_record['pipelines']}
        for submission in binding_record['submissions']:
            for use in submission['uses']:
                if use['pipelineId'] != hdr[0]['nativeObjectId']:
                    continue
                explicit = plan['inputs'][entry['variant']]['requiresExplicitLayout']
                assert pipelines[use['pipelineId']]['layout'] == ('explicit' if explicit else 'auto')
                bound = [group for group in use['bindGroups'] if group['group'] == 3]
                assert len(bound) == 1 and bound[0]['dynamicOffsets'] == []
                group = groups[bound[0]['bindGroupId']]
                layout = layouts[group['layoutId']]
                if explicit:
                    native_layout = next(item for item in binding_record['pipelineLayouts'] if item['id'] == pipelines[use['pipelineId']]['pipelineLayoutId'])
                    assert layout['kind'] == 'pipeline-derived' and layout['pipelineId'] == use['pipelineId'] and layout['group'] == 3
                    assert native_layout['bindGroupLayoutIds'][3] == layout['sourceExplicitLayoutId']
                    explicit_layout = layouts[layout['sourceExplicitLayoutId']]
                    assert [item['binding'] for item in explicit_layout['entries']] == [0, 1, 2, 3, 4]
                else:
                    assert layout['kind'] == 'pipeline-derived' and layout['pipelineId'] == use['pipelineId'] and layout['group'] == 3
                group_entries = {resource['binding']: resource for resource in group['entries']}
                for binding, size in [(0, 232), (1, 48), (2, 64)]:
                    resource = group_entries[binding]
                    assert resource['kind'] == 'buffer' and resource['offset'] == 0 and resource['effectiveSize'] == resource['bufferSize'] == size
                    assert resource['usage'] & 128 and not resource['usage'] & 64
                lighting_uses += 1
        assert lighting_uses > 0 and lighting_uses == measurement['activationWitness']['architectureBindings']['actualLightingBindingUses']
    pixels = load(attempt / 'ordinary-pixel-check.json')
    assert len(pixels['comparisons']) == 3
    for pixel in pixels['comparisons']:
        verify(pixel['reference'])
        candidate_raster = raster(attempt / (pixel['view'] + '.png'))
        assert candidate_raster == raster(pixel['reference']['path'])
        raster_sha = hashlib.sha256(candidate_raster).hexdigest()
        assert raster_sha == pixel['candidateRasterSha256'] == pixel['referenceRasterSha256']
        assert pixel['exact'] and pixel['changedPixels'] == 0
        ordinary_pixels.append({'ordinal': entry['ordinal'], 'view': pixel['view'], 'rasterSha256': raster_sha, 'exact': True})
    operation = BASE / 'comparison-001/operations' / f"{entry['ordinal']:02d}-{entry['variant']}"
    child = load(operation / 'result.json')
    lifecycle = load(operation / 'completed-lifecycle-manifest.json')
    assert child['actualChildWaitReturned'] and child['exitCode'] == 0
    assert lifecycle['state'] == 'completed' and lifecycle['exitcode'] == 0 and lifecycle['run_id'] == child['lifecycle']
    assert completed['results'][entry['ordinal'] - 1] == child
    attempts.append({**entry, 'timings': timings, 'actualLightingUses': lighting_uses, 'child': pin(operation / 'result.json'), 'lifecycle': pin(operation / 'completed-lifecycle-manifest.json')})
paired=[]
for block in range(1,7):
 parent=next(a for a in attempts if a['block']==block and a['variant']=='aperture-fixed-storage-fresnel');candidate=next(a for a in attempts if a['block']==block and a['variant']=='aperture-flat-draw-constants')
 for view in plan['views']:
  left=raster(pathlib.Path(parent['attemptRoot'])/(view['id']+'.png'));right=raster(pathlib.Path(candidate['attemptRoot'])/(view['id']+'.png'));assert left==right;paired.append({'block':block,'view':view['id'],'exact':True})
threes=[a['timings']['queueCompletionLatencyMs']['median']for a in attempts if a['variant']=='three-baseline'];drift=max(threes)-min(threes);blocks=[]
for block in range(1,7):
 three=next(a for a in attempts if a['block']==block and a['variant']=='three-baseline');parent=next(a for a in attempts if a['block']==block and a['variant']=='aperture-fixed-storage-fresnel');candidate=next(a for a in attempts if a['block']==block and a['variant']=='aperture-flat-draw-constants');t=three['timings']['queueCompletionLatencyMs']['median'];c=candidate['timings']['queueCompletionLatencyMs']['median'];reduction=1-c/t;improvement=t-c;vs_three=candidate['timings']['endToEndMs']['median']<=three['timings']['endToEndMs']['median'];vs_parent=candidate['timings']['endToEndMs']['median']<=parent['timings']['endToEndMs']['median']
 result={'block':block,'threeQueueMedianMs':t,'parentQueueMedianMs':parent['timings']['queueCompletionLatencyMs']['median'],'candidateQueueMedianMs':c,'queueReductionVersusThree':reduction,'queueImprovementVersusThreeMs':improvement,'referenceRangeMs':drift,'noEndToEndRegressionVersusThree':vs_three,'noEndToEndRegressionVersusParent':vs_parent,'passed':reduction>=.10 and improvement>drift and vs_three and vs_parent};assert result==summary['benefitGates'][0]['blocks'][block-1];blocks.append(result)
assert summary['benefitGates'][0]['passed']==all(b['passed']for b in blocks);assert summary['allSteady']and summary['allCandidatePixelsExact']
report={'schema':'aperture.flat-draw-confirmation-root-recalculation.v1','status':'source-native-workload-pixel-closure-passed-gate-result-recomputed','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'executedReview':pin(__file__),'plan':plan_pin,'summary':pin(summary_path),'verifiedFiles':files_verified,'verifiedBytes':bytes_verified,'all18ActualChildWaitsAndLifecyclesPassed':True,'all1728SamplesRecomputedAndCanonicalWorkload':True,'ordinaryImages':ordinary_pixels,'pairedImages':paired,'attempts':attempts,'benefitBlocksRecomputed':blocks,'completeGatePassed':all(b['passed']for b in blocks),'limits':['Root artifact recalculation, not independent agent.','All96 measured samples per run; six fresh instances per role across all six permutations. No cross-window pooling.','Queue/fence latency on SwiftShader software WebGPU, not physical GPU timestamps.']}
with(BASE/'comparison-recalculation.json').open('x')as f:json.dump(report,f,indent=2);f.write('\n')
print(json.dumps({'status':report['status'],'verifiedFiles':files_verified,'blocks':blocks,'completeGatePassed':report['completeGatePassed']}))
