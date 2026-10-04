#!/usr/bin/env python3
"""Independent stdlib/Pillow audit of immutable records. Never renders or edits inputs."""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
FIXTURE = REPO / 'benchmarks/indexed-shared-mesh-fanout-20261004'
PIN = '1658813197a595f2505f3a66c87a7cc0d65aed8da87bc65ac4d580fb9041aa4d'
SESSIONS = ['live', 'shared-baseline', 'shared-grow', 'shared-shrink',
            'unshared-baseline', 'unshared-grow', 'unshared-shrink']
EDITS = ['baseline', 'baseline', 'grow', 'grow', 'shrink', 'baseline', 'grow', 'baseline']
TOPO = {'baseline': (12, 12), 'grow': (24, 16), 'shrink': (6, 8)}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read(path):
    return json.loads(path.read_bytes())

def same(a, b, why):
    assert a == b, why

def geometry(record):
    keys = ('name', 'positions', 'indices', 'indexBuffer', 'worldMatrix', 'streams', 'submeshes')
    return [{key: m[key] for key in keys} for m in record['evidence']['nativeGeometry']['meshes']]

def proof(p):
    assert p['native'] is True and p['canvasWebGPU'] == 1 and p['webglAttempts'] == 0
    assert p['submissions'] > 0 and p['draws'] > 0 and not p['errors'] and not p['deviceLost']
    assert p['adapters'] and all(a['architecture'] == 'swiftshader' for a in p['adapters'])

def upload(scope, draw, ident, length, offset=0, allowed=None):
    key = f"{draw['submissionSerial']}:{ident}"
    assert draw['uploadSnapshotIds'].count(key) == 1, 'Ambiguous/missing exact draw upload'
    u = scope['bufferSnapshots'][key]
    assert u['id'] == ident and u['submissionSerial'] == draw['submissionSerial']
    assert u['contentVersion'] > 0 and u['writeCalls'] > 0 and not u['destroyed']
    assert u['allocationBytes'] == len(u['fullUploadBytes']) and 0 <= offset <= offset + length <= u['allocationBytes']
    assert any(a <= offset and b >= offset + length for a, b in u['writtenRanges'])
    assert not any(a < offset + length and b > offset for a, b in u['uncertainRanges'])
    if allowed is not None:
        assert u['usage'] & allowed[0] and u['usage'] & ~allowed[1] == 0
    return bytes(u['fullUploadBytes'][offset:offset + length]), u

def is_main(scope, d):
    # Descriptor plus compiled shader source establish role independently of labels.
    p = scope['pipelineSnapshots'][d['pipelineId']]
    assert d['pass']['depth'] and p['vertex']['code'] and not p.get('unobserved')
    if d['pass']['colors']:
        assert p['targets'] and 'worldTransforms' in p['vertex']['code']
        return True
    assert not p['targets']
    return False

def draw_audit(scope, draws, commands, meshes, main, shared):
    result = []
    coverage = {m['name']: 0 for m in meshes}
    for d in draws:
        matched = [m for m in meshes if any(v['label'] == m['assetLabel'] + '/vertex:' + s['id']
                   for v in d['vertices'] for s in m['streams'])]
        if not matched:
            continue
        if is_main(scope, d) != main:
            continue
        assert any(c['id'] == d['commandBufferId'] and c['encoderId'] == d['commandEncoderId']
                   and c['submissionSerial'] == d['submissionSerial'] for c in commands)
        m = matched[0]
        assert is_main(scope, d) == main, 'Unexpected consumed geometry pass'
        indexed = m['indexed']
        if 'Indirect' in d['method']:
            assert d['method'] == 'drawIndexedIndirect' and indexed
            raw, u = upload(scope, d, d['indirect']['buffer']['id'], 20,
                            d['indirect']['offset'], (256, 256 | 8 | 4))
            count, instances, start, base, first = struct.unpack('<IIIiI', raw)
            assert first == 0 or u['indirectFirstInstanceSupported'] is True
            assert not any(k in d for k in ('count', 'instances', 'start', 'baseVertex', 'firstInstance'))
            arg = {'bufferId': u['id'], 'version': u['contentVersion'], 'submission': u['submissionSerial'],
                   'offset': d['indirect']['offset'], 'count': count, 'instances': instances,
                   'firstIndex': start, 'baseVertex': base, 'firstInstance': first}
        else:
            assert d['method'] == ('drawIndexed' if indexed else 'draw')
            count, instances, start, first = (d[k] for k in ('count', 'instances', 'start', 'firstInstance'))
            base = d.get('baseVertex', 0)
            arg = {'method': d['method'], 'count': count, 'instances': instances, 'firstInstance': first}
        assert count == (len(m['indices']) if indexed else len(m['positions']) // 3) and start == base == 0
        if indexed:
            b = d['index']
            assert b['format'] == 'uint16' and b['label'] == m['assetLabel'] + '/index' and b['offset'] == 0
            assert b['size'] >= m['indexBuffer']['byteLength'] and b['size'] <= b['allocationBytes']
            raw, u = upload(scope, d, b['id'], m['indexBuffer']['byteLength'], allowed=(16, 16 | 8 | 4))
            same(raw, bytes(m['indexBuffer']['rawBytes']), 'Consumed index bytes differ')
        for s in m['streams']:
            selected = [v for v in d['vertices'] if v['label'] == m['assetLabel'] + '/vertex:' + s['id']]
            assert len(selected) == 1
            b = selected[0]
            assert b['offset'] == 0 and s['byteLength'] <= b['size'] <= b['allocationBytes']
            raw, _ = upload(scope, d, b['id'], s['byteLength'])
            same(raw, bytes(s['rawBytes']), 'Consumed vertex bytes differ')
        groups = [g for g in d['groups'] if g['index'] == (1 if main else 0)]
        assert len(groups) == 1 and not groups[0]['dynamicOffsets']
        entries = [e for e in groups[0]['entries'] if e['binding'] == (0 if main else 1)]
        assert len(entries) == 1
        b = entries[0]['buffer']
        assert first * 64 + instances * 64 <= b['size']
        raw, _ = upload(scope, d, b['id'], instances * 64, b['offset'] + first * 64)
        matrices = [list(struct.unpack_from('<16f', raw, i * 64)) for i in range(instances)]
        for matrix in matrices:
            matches = [x for x in matched if x['worldMatrix'] == matrix]
            assert len(matches) == 1, 'Missing/duplicate consumed instance transform'
            coverage[matches[0]['name']] += 1
        if main and indexed and shared:
            slot = ['inner', 'outer', 'rims'].index(m['partName'].split('.')[-1])
            assert d['method'] == 'drawIndexedIndirect' and instances == 3 and first == slot * 3
            assert arg['offset'] == slot * 20
        result.append({'mesh': m['partName'] if indexed else m['name'], 'indexed': indexed, **arg})
    assert all(n == 1 for n in coverage.values()), f'Incomplete geometry coverage: {coverage}'
    pipes = [d for d in result if d['indexed']]
    if main and shared:
        assert len(pipes) == 3
        assert len({(x['bufferId'], x['version'], x['submission']) for x in pipes}) == 1
    return result

def state_audit(r):
    e = r['evidence']; state = r['state']; ng = e['nativeGeometry']; meshes = ng['meshes']; scope = ng['submittedDraws']
    assert len(meshes) == 11 and scope['frame'] == r['receipt']['nativeFrame'] == ng['actualSubmittedSnapshot']['frame']
    proof(r['proof'])
    assert r['capture']['gpuFenceCompleted'] and r['capture']['presentationFrames'] >= 2
    c, radial = TOPO[state['edit']]
    for m in meshes:
        for s in m['streams']:
            # JSON numeric arrays canonicalize -0 to 0; exact-byte equality uses rawBytes.
            same(list(struct.unpack('<' + 'f' * len(s['data']), bytes(s['rawBytes']))), s['data'], 'Vertex float/byte disagreement')
            assert len(s['rawBytes']) == s['byteLength'] == s['arrayStride'] * s['vertexCount']
            position = next(a for a in s['attributes'] if a['semantic'] == 'POSITION')
            decoded = [v for i in range(s['vertexCount']) for v in struct.unpack_from('<3f', bytes(s['rawBytes']), i * s['arrayStride'] + position['offset'])]
            same(decoded, m['positions'], 'Position stream/numeric disagreement')
        if m['indexed']:
            n = 12 * radial if m['partName'].endswith('rims') else 6 * c * radial
            same(m['indices'], list(range(n)), 'Nonidentity/truncated index array')
            same(bytes(m['indexBuffer']['rawBytes']), struct.pack('<' + 'H' * n, *range(n)), 'Index byte/numeric disagreement')
            assert len(m['positions']) == n * 3
            sub = m['submeshes'][0]
            assert len(m['submeshes']) == 1 and sub['vertexStart'] == sub['indexStart'] == 0 and sub['vertexCount'] == sub['indexCount'] == n
            source = next(p for p in e['sourceGeometry']['parts'] if p['name'] == m['name'])
            expanded = [v for idx in source['indices'] for v in source['positions'][idx]]
            same(expanded, m['positions'], 'Source triangles differ from native positions')
    main = draw_audit(scope, scope['draws'], scope['commands'], meshes, True, e['shared'])
    geometry_draws = [d for d in scope['draws'] if any(v['label'].startswith(('pipe.hollow-elbow', 'courtyard.slab', 'prop.crate.body')) for v in d['vertices']) and is_main(scope, d)]
    sampled = {x['texture']['textureId'] for d in geometry_draws for g in d['groups'] for x in g['entries'] if 'texture' in x}
    histories = [h for h in scope['shadowHistory'] if h['textureId'] in sampled]
    assert len(histories) == 1
    h = histories[0]
    for d in geometry_draws:
        assert any(x['textureId'] == h['textureId'] and x['contentRevision'] == h['contentRevision'] for x in d['sampledTextureVersions'])
    assert h['submissionSerial'] <= max(c['submissionSerial'] for c in scope['commands'])
    assert not any(x['textureId'] == h['textureId'] and x['contentRevision'] > h['contentRevision'] for x in scope['textureInvalidations'])
    shadow = draw_audit(scope, h['draws'], h['commands'], meshes, False, e['shared'])
    return {'state': state['id'], 'nativeFrame': scope['frame'], 'main': main, 'shadow': shadow,
            'shadowOriginalFrame': h['frame'], 'shadowOriginalSubmission': h['submissionSerial'],
            'preparedFacadeEntries': e['resources']['nativeRenderer']['preparedMeshFacade']['totalEntries'],
            'retainedGeometryEntries': e['resources']['nativeRenderer']['preparedMeshCache']['totalEntries']}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('output'); parser.add_argument('--sessions', nargs='+', choices=SESSIONS, default=SESSIONS); args = parser.parse_args()
    out = HERE / args.output
    assert out.parent == HERE and not out.exists()
    pins_raw = (FIXTURE / 'source-pins.json').read_bytes(); same(sha(pins_raw), PIN, 'Frozen pins changed'); pins = json.loads(pins_raw)
    for name, expected in pins['files'].items():
        path = REPO / name; raw = path.read_bytes()
        same(len(raw), expected['bytes'], f'Pinned size: {name}'); same(sha(raw), expected['sha256'], f'Pinned hash: {name}')
    states = {}; images = {}; reports = []; inventory = []
    for session in args.sessions:
        folder = FIXTURE / 'renders/aperture' / session / 'attempt-001'
        outcome = read(folder / 'outcome.json'); complete = read(folder / 'complete.json'); runner = read(folder / 'verified-runner.json')
        assert outcome['status'] == 'passed' and outcome['sourcePinsUnchanged'] and outcome['serverClosed'] and not outcome['requestErrors']
        same(outcome['sourcePinsSha256'], PIN, 'Outcome pins'); same(read(folder / 'inputs.json')['sourcePinsSha256'], PIN, 'Attempt input pins')
        assert runner['status'] == 'passed' and not runner['errors'] and runner['launch']['sandboxLaunchEnabled']
        same(runner['launch']['actualArgv'][1:], runner['launch']['requested']['args'], 'Actual launch flags')
        assert '--enable-unsafe-webgpu' in runner['launch']['actualArgv'] and '--no-sandbox' not in runner['launch']['actualArgv']
        proof(runner['proof']); proof(complete['proof'])
        expected_states = 8 if session == 'live' else 1
        assert complete['states'] == expected_states and len(complete['artifacts']) == 2 * expected_states
        for artifact in complete['artifacts']:
            path = folder / artifact['path']; raw = path.read_bytes()
            same(len(raw), artifact['bytes'], 'Artifact size'); same(sha(raw), artifact['sha256'], 'Artifact digest')
            assert len(raw) <= (16 if path.suffix == '.json' else 8) * 1024 * 1024
        files = sorted((folder / 'states').glob('*.json')); assert len(files) == expected_states
        for path in files:
            record = read(path); key = (session, record['state']['index']); states[key] = record
            reports.append({'session': session, **state_audit(record)})
            png = path.with_suffix('.png'); image = Image.open(png); image.load()
            assert image.size == (1024, 1024) and image.mode in ('RGB', 'RGBA')
            if image.mode == 'RGBA': assert image.getchannel('A').getextrema() == (255, 255)
            image = image.convert('RGB'); assert any(a != b for a, b in image.getextrema()); images[key] = image
            inventory.append({'path': str(png.relative_to(REPO)), 'sha256': sha(png.read_bytes()), 'rgbSha256': sha(image.tobytes())})
        for path in sorted(folder.rglob('*')):
            if path.is_file():
                inventory.append({'path': str(path.relative_to(REPO)), 'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())})
    controls = []
    for key, record in states.items():
        if key[0] == 'live':
            other = ('shared-' + record['state']['edit'], 0)
            if other in states:
                same(images[key].tobytes(), images[other].tobytes(), 'Live/cold RGB'); same(geometry(record), geometry(states[other]), 'Live/cold raw geometry')
                controls.append({'a': key, 'b': other, 'differentRgbPixels': 0, 'rawGeometryEqual': True})
    for edit in TOPO:
        a, b = ('shared-' + edit, 0), ('unshared-' + edit, 0)
        if a in states and b in states:
            same(images[a].tobytes(), images[b].tobytes(), 'Shared/unshared RGB'); same(geometry(states[a]), geometry(states[b]), 'Shared/unshared raw geometry')
            controls.append({'a': a, 'b': b, 'differentRgbPixels': 0, 'rawGeometryEqual': True})
    changes = []
    for edit in ('grow', 'shrink'):
        a, b = ('shared-baseline', 0), ('shared-' + edit, 0)
        if a in images and b in images:
            diff = ImageChops.difference(images[a], images[b]); count = sum(p != (0, 0, 0) for p in diff.getdata()); assert count > 0
            changes.append({'edit': edit, 'differentRgbPixels': count, 'maximumChannelDifference': max(x[1] for x in diff.getextrema())})
    full = args.sessions == SESSIONS
    if full: assert len(states) == 14 and len(controls) == 11 and len(changes) == 2
    result = {'status': 'passed' if full else 'partial-passed', 'sessions': args.sessions, 'pending': [s for s in SESSIONS if s not in args.sessions],
              'sourcePinsSha256': PIN, 'pinnedFilesVerified': len(pins['files']), 'states': reports, 'exactControls': controls,
              'visibleChanges': changes, 'inventory': inventory, 'decoder': 'Pillow ' + Image.__version__,
              'scope': 'CPU audit of retained native evidence; no new browser, performance, memory, or score claim.'}
    out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'sessions': len(args.sessions), 'states': len(states), 'exactControls': len(controls), 'visibleChanges': changes, 'output': out.name}))

if __name__ == '__main__':
    main()
