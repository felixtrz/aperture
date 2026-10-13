from pathlib import Path
from datetime import datetime, timezone
import importlib.util
import json
import os
import subprocess
import sys
import time

repo = Path('/workspace/aperture')
root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('readonly_inventory', repo / '.aperture-env/agent-house-race/validation/batch-003/repository-gate-001/gate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
stage, *child = sys.argv[1:]
assert stage and child
out = root / stage
out.mkdir(exist_ok=False)

def create(name, value):
    with (out / name).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')

create('source-before.json', module.manifest('source'))
create('dist-before.json', module.manifest('built-engine'))
argv = ['python3', '-B', 'tools/recovery/runtime_pressure.py', '--root', '/workspace/scratch/0190a8c72f8a/aperture-tmp', '--audit-dir', str(out / 'audits'), 'run', '--job', 'r005-authoring-dx-' + stage + '-001', '--recreation', 'Repeat the exact retained bounded CPU authoring-DX check; preserve failed attempts and source/build inputs. No browser, GPU, model, cache maintenance or full-gate job.', '--', *child]
env = os.environ.copy()
env['APERTURE_WEBGPU_RUNTIME'] = '/workspace/aperture/.aperture-env/render-runtime'
started = datetime.now(timezone.utc).isoformat()
clock = time.monotonic()
create('command.json', {'argv': argv, 'childArgv': child, 'cwd': str(repo), 'environment': {'APERTURE_WEBGPU_RUNTIME': env['APERTURE_WEBGPU_RUNTIME']}, 'startedAt': started})
with (out / 'stdout.log').open('xb') as stdout, (out / 'stderr.log').open('xb') as stderr:
    result = subprocess.run(argv, cwd=repo, env=env, stdout=stdout, stderr=stderr)
create('source-after.json', module.manifest('source'))
create('dist-after.json', module.manifest('built-engine'))
create('result.json', {'stage': stage, 'exitCode': result.returncode, 'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic() - clock})
print(json.dumps({'stage': stage, 'exitCode': result.returncode, 'stdout': str(out / 'stdout.log'), 'stderr': str(out / 'stderr.log')}))
sys.exit(result.returncode)
