from pathlib import Path
from datetime import datetime,timezone
import hashlib,importlib.util,json,os,subprocess,sys,time
repo=Path('/workspace/aperture');root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('readonly_inventory',repo/'.aperture-env/agent-house-race/validation/batch-003/repository-gate-001/gate.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
stage=sys.argv[1];child=sys.argv[2:];assert stage and child
out=root/stage;out.mkdir(exist_ok=False)
def create(name,value):
 with (out/name).open('x') as f:json.dump(value,f,indent=2);f.write('\n')
create('source-before.json',module.manifest('source'));create('dist-before.json',module.manifest('built-engine'))
argv=['python3','-B','tools/recovery/runtime_pressure.py','--root','/workspace/scratch/0190a8c72f8a/aperture-tmp','--audit-dir',str(out/'audits'),'run','--job','execution-gate-'+stage+'-001','--recreation','Repeat exact bounded offline supervision/summary/scoring CPU command under adopted lifecycle; preserve failures and generated before/after evidence. No native/browser/model/fullgate job.','--',*child]
env=os.environ.copy();env['APERTURE_WEBGPU_RUNTIME']='/workspace/aperture/.aperture-env/render-runtime';env['EXECUTION_GATE_STAGE_OUT']=str(out)
start=datetime.now(timezone.utc).isoformat();t=time.monotonic();create('command.json',{'argv':argv,'childArgv':child,'cwd':str(repo),'environment':{'APERTURE_WEBGPU_RUNTIME':env['APERTURE_WEBGPU_RUNTIME'],'EXECUTION_GATE_STAGE_OUT':str(out)},'startedAt':start})
with (out/'stdout.log').open('xb') as stdout,(out/'stderr.log').open('xb') as stderr:r=subprocess.run(argv,cwd=repo,env=env,stdout=stdout,stderr=stderr)
create('source-after.json',module.manifest('source'));create('dist-after.json',module.manifest('built-engine'));create('result.json',{'stage':stage,'exitCode':r.returncode,'startedAt':start,'finishedAt':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-t})
print(json.dumps({'stage':stage,'exitCode':r.returncode,'stdout':str(out/'stdout.log'),'stderr':str(out/'stderr.log')}));sys.exit(r.returncode)
