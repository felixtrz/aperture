#!/usr/bin/env python3
"""Bounded, sequential diagnostic renders through the adopted lifecycle only."""
import hashlib,json,os,shutil,subprocess,sys
from pathlib import Path
base=Path(__file__).resolve().parent;repo=base.parent.parent
root=repo.parent/'aperture-tmp';pins=json.loads((base/'input-pins.json').read_text())
for kind in ['verified_helpers','frozen_files','engine_files']:
 for name,expected in pins[kind].items():
  assert hashlib.sha256((repo/name).read_bytes()).hexdigest()==expected,(kind,name)
cases=json.loads((base/'cases.json').read_text())
selected=sys.argv[1:]
assert selected and len(selected)==len(set(selected))
assert all(any(c['id']==name for c in cases) for name in selected)
(base/'renders').mkdir(exist_ok=True)
env=dict(os.environ,APERTURE_WEBGPU_RUNTIME=str(repo/'.aperture-env/render-runtime'))
progress=base/'progress.json';rows=json.loads(progress.read_text()) if progress.exists() else []
for name in selected:
 assert not any(r['id']==name for r in rows),'A case cannot be rerun or overwritten'
 assert len(rows)<12,'Bounded native attempt budget exhausted'
 c=next(c for c in cases if c['id']==name)
 for filename,expected in c['files'].items():
  assert hashlib.sha256((base/'sources'/name/filename).read_bytes()).hexdigest()==expected
 free=shutil.disk_usage(root).free
 if free<2147483648:raise RuntimeError('Low disk; stop and preserve all files')
 cmd=['python3','-B',str(repo/'tools/recovery/runtime_pressure.py'),'--root',str(root),'--audit-dir',str(base/'lifecycle-audits'),'run','--job','eave-'+name,'--recreation','Render immutable controlled cottage source with runVerifiedScene','--','node',str(base/'run-case.mjs'),name]
 row={'id':name,'view':c['view'],'control':c['control'],'free_bytes_before':free,'status':'started','command':cmd};rows.append(row)
 progress.write_text(json.dumps(rows,indent=2)+'\n')
 print(json.dumps({'id':name,'free_bytes_before':free}),flush=True)
 with (base/(name+'.log')).open('xb') as log:
  proc=subprocess.Popen(cmd,cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
  for line in proc.stdout:
   log.write(line);log.flush();sys.stdout.buffer.write(line);sys.stdout.buffer.flush()
  code=proc.wait()
 row.update(exit_code=code,free_bytes_after=shutil.disk_usage(root).free,status='passed' if code==0 else 'failed')
 progress.write_text(json.dumps(rows,indent=2)+'\n')
 if code:raise SystemExit(code)
