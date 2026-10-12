import argparse,datetime,hashlib,json,pathlib,subprocess,time,sys
ROOT=pathlib.Path('/workspace/aperture')
HERE=ROOT/'.aperture-env/agent-house-race/control/r004-author-audits-001'
ROUND=ROOT/'benchmarks/agent-house-race-20261011/round-004'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def pin(path):
 raw=path.read_bytes();return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def new_json(path,value):
 with path.open('x') as stream:json.dump(value,stream,indent=2);stream.write('\n')
 path.chmod(0o444)
parser=argparse.ArgumentParser(description='Root-authorized adopted audit worker; use coordinator-capture.py, never launch standalone')
parser.add_argument('--authorization',required=True,type=pathlib.Path)
parser.add_argument('--authorization-sha256',required=True)
args=parser.parse_args()
authorization_raw=args.authorization.read_bytes()
assert hashlib.sha256(authorization_raw).hexdigest()==args.authorization_sha256
activation=json.loads(authorization_raw)
assert activation['schema']=='aperture.round004-coordinator-phase-activation.v1' and activation['round']=='round-004' and activation['phase']=='audits' and activation['status']=='authorized' and activation['authorizedBy']=='/root'
assert pin(pathlib.Path(__file__).resolve())==activation['pins']['worker']
baseline=json.loads(pathlib.Path(activation['pins']['sourceTemplatePins']['path']).read_bytes())
assert pin(pathlib.Path(activation['pins']['sourceTemplatePins']['path']))==activation['pins']['sourceTemplatePins']
source_pins=baseline['currentControlSourcePins']
for item in source_pins:assert pin(pathlib.Path(item['path']))==item
known={key:activation['pins'][key] for key in ('configuration','dispatch','inputFreeze','coordinatorResult')}
known['captureSource']=pin(pathlib.Path(__file__).resolve());known['sources']=source_pins
for key in ('configuration','dispatch','inputFreeze','coordinatorResult'):assert pin(pathlib.Path(known[key]['path']))==known[key]
dispatch=json.loads(pathlib.Path(known['dispatch']['path']).read_bytes())
assert dispatch['schema']=='aperture.house-race-author-dispatch.v2' and dispatch['round']=='round-004' and dispatch['forkTurns']=='none' and dispatch['suppliedHistory']=='none' and dispatch['freshIndependentAuthors'] and dispatch['peerContactProhibited']
assert dispatch['authorBudgetSeconds']==1800 and dispatch['previewAllowance']==3 and dispatch['officialTrialOrder']==['aperture','three','three','aperture','aperture','three']
assert not HERE.exists();HERE.mkdir()
coordinator=json.loads((ROUND/'preview-operations/result.json').read_text());assert coordinator['coordinatorExitCode']==0 and coordinator['status']=='closed-coordinator-after-both-finishes'
new_json(HERE/'inputs-before.json',known)
results=[]
for engine in ['three','aperture']:
 lane=engine+'-r004';operation=HERE/lane;operation.mkdir();output=ROUND/'author-audits'/lane
 assert not output.exists()
 argv=['python3','-B',str(ROOT/'tools/agent-benchmark/audit-authors.py'),lane,'--output',str(output)]
 start=now();clock=time.monotonic();new_json(operation/'command.json',{'schema':'aperture.r004-author-audit-command.v1','argv':argv,'cwd':str(ROOT),'startedAt':start,'sources':source_pins,'knownInputs':known,'outputCreateOnly':True,'rendering':False})
 print(json.dumps({'status':'starting-author-audit','lane':lane,'command':str(operation/'command.json')}),flush=True)
 with (operation/'stdout.bin').open('xb') as stdout,(operation/'stderr.bin').open('xb') as stderr:
  child=subprocess.run(argv,cwd=ROOT,stdout=stdout,stderr=stderr,check=False)
 result={'schema':'aperture.r004-author-audit-operation.v1','lane':lane,'startedAt':start,'finishedAt':now(),'exitCode':child.returncode,'processWallSeconds':time.monotonic()-clock,'stdout':pin(operation/'stdout.bin'),'stderr':pin(operation/'stderr.bin'),'audit':pin(output/'audit.json') if (output/'audit.json').is_file() else None}
 new_json(operation/'result.json',result)
 for path in operation.iterdir():
  if path.is_file():path.chmod(0o444)
 results.append(result);print(json.dumps(result),flush=True)
 if child.returncode:
  new_json(HERE/'audits-halted.json',{'status':'halted-preserve-no-retry','results':results});sys.exit(child.returncode)
for key in ['configuration','dispatch','inputFreeze','coordinatorResult','captureSource']:
 assert pin(pathlib.Path(known[key]['path']))==known[key]
for item in source_pins:assert pin(pathlib.Path(item['path']))==item
new_json(HERE/'audits-completed.json',{'schema':'aperture.r004-author-audits-completed.v1','status':'both-exact-audits-exited-zero','results':results,'knownInputs':known,'sourceAndControlBeforeAfterParity':True,'nativeLaunched':False,'trialsAuthorized':False})
