#!/usr/bin/env python3
"""At most 16 sequential native launches, only through the approved lifecycle."""
import hashlib,json,os,shutil,subprocess,sys
from pathlib import Path
base=Path(__file__).resolve().parent;repo=base.parent.parent;root=repo.parent/'aperture-tmp'
cases=json.loads((base/'cases.json').read_text());selected=sys.argv[1:]
assert selected and len(selected)==len(set(selected))
assert all(any(c['id']==name for c in cases) for name in selected)
progress=base/'progress.json';rows=json.loads(progress.read_text()) if progress.exists() else []
env=dict(os.environ,APERTURE_WEBGPU_RUNTIME=str(repo/'.aperture-env/render-runtime'))
for name in selected:
 assert not any(r['id']==name for r in rows),'No repeated or overwritten runs'
 assert len(rows)+len(list((base/'cli-native').glob('**/*.report.json')))<16,'Native launch budget exhausted (including CLI adapter runs)'
 free=shutil.disk_usage(root).free
 if free<2147483648:raise RuntimeError('Low disk; stop and preserve files')
 c=next(c for c in cases if c['id']==name)
 pins={str(p.relative_to(repo)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (repo/c['source']).iterdir() if p.is_file()}
 for path in ['scripts/verified-webgpu.mjs','scripts/local-webgpu.mjs','tools/recovery/runtime_pressure.py','packages/webgpu/src/materials/standard/standard-shader-shadow-sampling.ts','packages/webgpu/src/materials/standard/standard-shader-directional-pcss.ts','packages/webgpu/dist/materials/standard/standard-shader-shadow-sampling.js','packages/webgpu/dist/materials/standard/standard-shader-directional-pcss.js']:
  p=repo/path
  if p.exists():pins[path]=hashlib.sha256(p.read_bytes()).hexdigest()
 cmd=['python3','-B',str(repo/'tools/recovery/runtime_pressure.py'),'--root',str(root),'--audit-dir',str(base/'lifecycle-audits'),'run','--job','pcss-'+name,'--recreation','Repeat retained PCSS regression source with runVerifiedScene','--','node',str(base/'run-case.mjs'),name]
 row={'id':name,'free_bytes_before':free,'status':'started','command':cmd,'pins':pins};rows.append(row);progress.write_text(json.dumps(rows,indent=2)+'\n')
 print(json.dumps({'id':name,'free_bytes_before':free}),flush=True)
 with (base/(name+'.log')).open('xb') as log:
  proc=subprocess.Popen(cmd,cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
  for line in proc.stdout:log.write(line);log.flush();sys.stdout.buffer.write(line);sys.stdout.buffer.flush()
  code=proc.wait()
 row.update(exit_code=code,free_bytes_after=shutil.disk_usage(root).free,status='passed' if code==0 else 'failed');progress.write_text(json.dumps(rows,indent=2)+'\n')
 if code:raise SystemExit(code)
