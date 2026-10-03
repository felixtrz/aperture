#!/usr/bin/env python3
"""Run applicable aggregate stages without installing dependencies or browsers."""
import json,os,subprocess,sys,tempfile,time
from pathlib import Path
base=Path(__file__).resolve().parent;repo=base.parent.parent
sys.path.insert(0,str(repo/'tools/recovery'));import setup
import shlex
binpath=Path(tempfile.mkdtemp(prefix='aperture-pcss-check-bin-'))
manager=repo/'.recovery-env/corepack/v1/pnpm/10.12.1/bin/pnpm.cjs'
assert manager.exists()
wrapper=binpath/'pnpm';wrapper.write_text('#!/bin/sh\nexec node '+shlex.quote(str(manager))+' "$@"\n');wrapper.chmod(0o755)
env=setup.environment(repo);env['PATH']=str(binpath)+os.pathsep+env['PATH']
steps=['test:cloud-renderer','check:boundaries','check:headless-boundaries','check:e2e-hygiene','check:release-config','typecheck','check:publish','check:render-bundles','typecheck:test','check:examples','check:docs','check:diagnostics','lint','format:check']
rows=[]
for step in steps:
 cmd=[str(wrapper),'run',step];start=time.time();print('START '+step,flush=True)
 logfile=base/('check-'+step.replace(':','-')+'.log')
 with logfile.open('x') as log:
  result=subprocess.run(cmd,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
 row=dict(stage=step,exit_code=result.returncode,seconds=round(time.time()-start,3),log=logfile.name);rows.append(row);(base/'check-results.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
cmd=[str(repo/'node_modules/.bin/vitest'),'run','--exclude','test/cli/dev-session.test.ts','--maxWorkers=2'];start=time.time();print('START vitest non-browser aggregate',flush=True)
with (base/'check-vitest-nonbrowser.log').open('x') as log:result=subprocess.run(cmd,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
rows.append(dict(stage='vitest non-browser aggregate',exit_code=result.returncode,seconds=round(time.time()-start,3),log='check-vitest-nonbrowser.log',command=cmd));(base/'check-results.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows[-1]),flush=True)
