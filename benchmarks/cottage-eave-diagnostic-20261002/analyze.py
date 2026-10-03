#!/usr/bin/env python3
"""Analyze retained captures only. Never launches a browser or edits scene inputs."""
from pathlib import Path
import hashlib
import json
from datetime import datetime, timezone
from PIL import Image
import numpy as np

BASE = Path(__file__).resolve().parent
REPO = BASE.parent.parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def pixels(path):
    return np.asarray(Image.open(path).convert('RGB'))

def compare(actual, expected):
    delta = np.abs(actual.astype(np.int16) - expected.astype(np.int16))
    return {'changed_pixels': int(np.any(delta != 0, axis=2).sum()),
            'maximum_channel_difference': int(delta.max()),
            'mean_absolute_channel_difference': float(delta.mean()),
            'pixel_equal': bool(np.array_equal(actual, expected))}

def runs(values):
    result = []
    for y, value in enumerate(values, 240):
        rgb = value.tolist()
        if result and result[-1]['rgb'] == rgb:
            result[-1]['y_last_inclusive'] = y
        else:
            result.append({'y_first': y, 'y_last_inclusive': y, 'rgb': rgb})
    return result

pins = json.loads((BASE / 'input-pins.json').read_text())
cases = json.loads((BASE / 'cases.json').read_text())
checks = []
for kind in ['verified_helpers', 'frozen_files', 'engine_files', 'existing_images']:
    for name, expected in pins[kind].items():
        checks.append({'kind': kind, 'path': name, 'expected': expected,
                       'actual': digest(REPO / name), 'matches': digest(REPO / name) == expected})
for case in cases:
    for filename, expected in case['files'].items():
        path = BASE / 'sources' / case['id'] / filename
        checks.append({'kind': 'controlled_source', 'path': str(path.relative_to(REPO)),
                       'expected': expected, 'actual': digest(path), 'matches': digest(path) == expected})
assert all(row['matches'] for row in checks), 'Retained input changed; inspect before continuing'

baseline = {view: pixels(BASE / 'renders' / name / 'render.png')
            for view, name in [('front', '01-front-baseline'), ('rear', '11-rear-baseline')]}
rows = []
for case in cases:
    path = BASE / 'renders' / case['id']
    report = json.loads((path / 'result.json').read_text())
    image = pixels(path / 'render.png')
    frame = report['sceneStatus']['render']
    shadow = frame.get('shadow')
    row = {'id': case['id'], 'view': case['view'], 'control': case['control'],
           'render_status': report['status'], 'native_proof': report['proof'],
           'frame_diagnostics': frame['diagnostics'],
           'shadow_request_count': None if shadow is None else shadow['requestCount'],
           'shadow_caster_counts': None if shadow is None else shadow['casterCounts'],
           'shadow_descriptors': None if shadow is None else shadow['descriptor']['descriptors'],
           'image_sha256': digest(path / 'render.png'),
           'result_sha256': digest(path / 'result.json'),
           'difference_from_same_view_baseline': compare(image, baseline[case['view']])}
    if case['view'] == 'front':
        line = image[240:265, 335]
        lit, dark = np.array([223, 220, 212]), np.array([184, 178, 164])
        intermediate = np.any(line != lit, axis=1) & np.any(line != dark, axis=1)
        ys = (np.flatnonzero(intermediate) + 240).tolist()
        row['front_eave_transect'] = {'x': 335, 'y_first': 240, 'y_last_inclusive': 264,
            'intermediate_rows': ys, 'intermediate_row_count': len(ys), 'runs': runs(line)}
    rows.append(row)

historical = []
for name, old, view in [('01-front-baseline', '002', 'front'), ('11-rear-baseline', '003', 'rear')]:
    prior = REPO / f'benchmarks/cottage-comparison-20261002/renders/a/attempt-{old}/render.png'
    historical.append({'case': name, 'historical_image': str(prior.relative_to(REPO)),
                       **compare(baseline[view], pixels(prior))})

audits = []
for path in sorted((BASE / 'lifecycle-audits').glob('*.jsonl')):
    records = [json.loads(line) for line in path.read_text().splitlines() if line]
    starts = [r for r in records if r['event'] == 'run-start']
    completed = [r for r in records if r['event'] == 'run-completed']
    assert len(starts) == len(completed) == 1
    assert completed[0]['exitcode'] == 0 and completed[0]['run'] == starts[0]['run']
    audits.append({'path': str(path.relative_to(BASE)), 'run': starts[0]['run'],
                   'job': starts[0]['job'], 'exit_code': completed[0]['exitcode']})
assert len(audits) == len(cases) == 12
result = {'schema': 1, 'classification': 'exploratory diagnosis; not formal quality or performance scores',
          'measured_at': datetime.now(timezone.utc).isoformat(),
          'method': 'Exact RGB decoded-pixel comparisons and one descriptive, selected front-eave vertical transect. Counts are observations, not a generalized quality metric.',
          'pin_checks': checks, 'historical_baselines': historical, 'cases': rows,
          'lifecycle_audits': audits,
          'analysis_failures': [{'phase': 'initial read-only inspection',
                                'error': "KeyError: 'shadow' for shadow-off case",
                                'resolution': 'Handled absent shadow report; no render failed, repeated or altered.'}]}
output = BASE / 'measurements.json'
with output.open('x') as f:
    f.write(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(output), 'pin_checks_passed': len(checks),
                  'native_passed': sum(r['render_status'] == 'passed' for r in rows),
                  'completed_lifecycles': len(audits), 'historical_baselines': historical}, indent=2))
