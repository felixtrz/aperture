#!/usr/bin/env python3
"""Retry environment-limited checks without changing source or assertions."""
import json,os,shlex,subprocess,sys,tempfile,time
from pathlib import Path
base=Path(__file__).resolve().parent;repo=base.parent.parent
sys.path.insert(0,str(repo/'tools/recovery'));import setup
env=setup.environment(repo);binpath=Path(tempfile.mkdtemp(prefix='aperture-pcss-retry-bin-'))
wrapper=binpath/'pnpm';wrapper.write_text('#!/bin/sh\nexec node '+shlex.quote(str(repo/'.recovery-env/corepack/v1/pnpm/10.12.1/bin/pnpm.cjs'))+' "$@"\n');wrapper.chmod(0o755)
env.update(PATH=str(binpath)+os.pathsep+env['PATH'],XDG_CONFIG_HOME=str(binpath/'config'),ASTRO_TELEMETRY_DISABLED='1',NODE_OPTIONS='--max-old-space-size=6144')
rows=[]
for step in ['check:docs','lint']:
 print('START '+step,flush=True);start=time.time();logfile=base/('retry-'+step.replace(':','-')+'.log')
 with logfile.open('x') as log:p=subprocess.run([str(wrapper),'run',step],env=env,cwd=repo,stdout=log,stderr=subprocess.STDOUT)
 row=dict(stage=step,exit_code=p.returncode,seconds=round(time.time()-start,3),log=logfile.name,environment=dict(XDG_CONFIG_HOME=env['XDG_CONFIG_HOME'],ASTRO_TELEMETRY_DISABLED='1',NODE_OPTIONS=env['NODE_OPTIONS']));rows.append(row);(base/'retry-results.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
