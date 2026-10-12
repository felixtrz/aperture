#!/usr/bin/env python3
"""Serial coordinator for isolated authors' approved SwiftShader previews."""
from pathlib import Path
import datetime as dt
import hashlib
import json
import os
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / '.aperture-env/agent-house-race/control/lanes.json'

def publish(path, value):
    payload = (json.dumps(value, indent=2) + '\n').encode()
    with open(path, 'xb') as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    path.chmod(0o444)


def main():
    config = json.loads(CONFIG.read_bytes())
    transcripts = Path(config['transcriptRoot'])
    print('Approved preview coordinator ready', flush=True)
    while True:
        requests = sorted(transcripts.glob('*/previews/*-request.json'), key=lambda p: json.loads(p.read_bytes())['requestedMonotonicNs'])
        for request_path in requests:
            raw = request_path.read_bytes()
            request = json.loads(raw)
            reply = Path(request['replyPath'])
            if reply.exists():
                continue
            lane = request['lane']
            expected = config['lanes'][lane]
            if request['engine'] != expected['engine'] or Path(request['appRoot']) != Path(expected['workspace']) / expected.get('buildDirectory', 'dist'):
                raise RuntimeError('Preview identity differs from frozen lane configuration')
            artifact = Path(request['artifactRoot'])
            if artifact.parent != request_path.parent or reply.parent != request_path.parent:
                raise RuntimeError('Preview artifact path differs')
            artifact.mkdir()
            output = artifact / 'attempt'
            print(f'Serving {lane} preview {request["number"]}', flush=True)
            command = ['python3', '-B', 'tools/recovery/runtime_pressure.py', '--root', '/workspace/scratch/0190a8c72f8a/aperture-tmp', '--audit-dir', str(artifact / 'audits'), 'run', '--job', f'house-{lane}-preview-{request["number"]}', '--recreation', 'Frozen own author dist; shared house benchmark native WebGPU route', '--', 'node', 'tools/agent-benchmark/run.mjs', '--app', request['appRoot'], '--engine', request['engine'], '--output', str(output), '--trial', str(request['number'])]
            env = os.environ.copy()
            env['APERTURE_WEBGPU_RUNTIME'] = str(ROOT / '.aperture-env/render-runtime')
            with (artifact / 'render.log').open('xb') as log:
                result = subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, check=False)
            paths = [str(output / f'{view}.png') for view in ['canonical', 'left-orbit', 'rear-orbit'] if (output / f'{view}.png').exists()]
            response = {'schema':'aperture.author-preview-result.v1','lane':lane,'engine':request['engine'],'number':request['number'],'requestSha256':hashlib.sha256(raw).hexdigest(),'completedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'status':'ok' if result.returncode == 0 and len(paths) == 3 else 'error','capturePaths':paths}
            if response['status'] == 'error':
                # Return actual own runtime errors, not implementation coaching.
                failure = output / 'failure.json'
                report = output / 'result.json'
                details = failure.read_text() if failure.exists() else report.read_text() if report.exists() else (artifact/'render.log').read_text()[-16000:]
                error = artifact / 'public-error.txt'
                with error.open('x') as stream: stream.write(details)
                response['errorPath'] = str(error)
            for p in artifact.rglob('*'):
                if p.is_file(): p.chmod(0o444)
            publish(reply, response)
            print(f'{lane} preview {request["number"]}: {response["status"]}', flush=True)
        if all((transcripts / lane / 'finish.json').exists() for lane in config['lanes']):
            print('Both authors finished; preview coordinator stopped', flush=True)
            return
        time.sleep(0.5)

if __name__ == '__main__':
    main()
