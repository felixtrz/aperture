import datetime, hashlib, json, os, subprocess, time
from pathlib import Path
C=Path('/workspace/aperture/.aperture-env/agent-house-race/control')
D=C/'root-official-trials-r003-invocation-001';D.mkdir()
P=C/'official-trials-r003-control-plan-001.json';A=C/'root-official-trials-r003-authorization-001.json'
def pin(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(p,x):
 with p.open('xb') as f:f.write((json.dumps(x,indent=2)+'\n').encode());f.flush();os.fsync(f.fileno())
 p.chmod(0o444)
plan=json.loads(P.read_text()); assert pin(P)['sha256']=='98d3bc13325f70f28d120c49a448492e2f2b9d9d9289ddd1d92f2eae1b4f83ca'
av=['python3','-B',plan['driver']['path'],'--plan',str(P),'--plan-sha256',pin(P)['sha256'],'--authorization',str(A),'--authorization-sha256',pin(A)['sha256']]
write(D/'command.json',{'schema':'aperture.root-official-driver-command.v1','argv':av,'cwd':'/workspace/aperture','recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'plan':pin(P),'authorization':pin(A),'driver':pin(Path(plan['driver']['path']))})
started=time.monotonic_ns()
with (D/'stdout.bin').open('xb') as out,(D/'stderr.bin').open('xb') as err:
 process=subprocess.Popen(av,cwd='/workspace/aperture',stdout=out,stderr=err)
 write(D/'start.json',{'pid':process.pid,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 code=process.wait()
for n in ('stdout.bin','stderr.bin'):(D/n).chmod(0o444)
write(D/'result.json',{'schema':'aperture.root-official-driver-result.v1','finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'driverExitCode':code,'wallSeconds':(time.monotonic_ns()-started)/1e9,'stdout':pin(D/'stdout.bin'),'stderr':pin(D/'stderr.bin'),'childWaited':True,'scope':'Plain coordinator exit; each of six trials owns its independent adopted native cleanup evidence.'})
print(json.dumps({'driverExitCode':code,'result':pin(D/'result.json')}),flush=True)
raise SystemExit(code)
