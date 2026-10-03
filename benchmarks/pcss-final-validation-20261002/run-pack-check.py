import os,sys,subprocess
from pathlib import Path
repo=Path.cwd();sys.path.insert(0,str(repo/'tools/recovery'));import setup
env=setup.environment(repo);env.update(os.environ);env.update(setup.environment(repo))
root=Path(os.environ['APERTURE_TMP_RUN']);wrapper=root/'pnpm';wrapper.write_text('#!/bin/sh\nexec node '+str(repo/'.recovery-env/corepack/v1/pnpm/10.12.1/bin/pnpm.cjs')+' "$@"\n');wrapper.chmod(0o700);env['PATH']=str(root)+os.pathsep+env['PATH'];env['TMPDIR']=str(root);env['TMP']=str(root);env['TEMP']=str(root)
p=subprocess.run(['node','scripts/check-pack-cli.mjs'],env=env,cwd=repo);raise SystemExit(p.returncode)
