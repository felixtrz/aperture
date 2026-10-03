"""Read immutable native artifacts without launching or modifying a renderer."""
import json,pathlib,struct
from PIL import Image
import numpy as np
root=pathlib.Path(__file__).resolve().parents[3];base=root/'benchmarks';out=base/'crane-live-edits-20261003/renders/threejs/attempt-001'
def native(p):return json.loads(p.read_text())['sceneStatus']['nativeGeometry']['meshes']
baseline=native(base/'crane-wall-continuity-20261003/renders/attempt-004/result.json');gold={'baseline':baseline,'arch':native(base/'crane-wall-continuity-20261003/renders/attempt-007/result.json')};body=next(m for m in baseline if m['name']=='wall.body.continuous')
for edit,n in [('shoulder',5),('elbow',6),('hoist',7),('pipe',9),('tier',10),('assembly',11)]:
 ms=native(base/f'crane-comparison-20261003/renders/b/attempt-{n:03}/result.json');gold[edit]=[m for m in ms if not(m['name'].startswith('wall.pier.') or m['name'].startswith('wall.upper-side.') or m['name'].startswith('wall.spandrel.'))]+[body]
checks=0;maxerror=0;bad=[];states=[]
for p in sorted((out/'states').glob('*.json')):
 d=json.loads(p.read_text());states.append(d);expected={m['name']:m for m in gold[d['state']['edit']]};ms=d['evidence']['nativeGeometry']['meshes'];assert set(expected)=={m['name'] for m in ms}
 for m in ms:
  e=expected[m['name']]
  for k in ['positions','normals','indices','matrix']:
   a,b=m[k],e[k];assert len(a)==len(b)
   err=max((abs(x-y) for x,y in zip(a,b)),default=0);maxerror=max(maxerror,err);checks+=1
   if err> (0 if k=='indices' else 2e-5):bad.append((p.name,m['name'],k,err))
a=np.array(Image.open(out/'states/s00-baseline.png').convert('RGBA'));resets={f.name:int(np.count_nonzero(np.any(a!=np.array(Image.open(f).convert('RGBA')),axis=2))) for f in sorted((out/'states').glob('*reset*.png'))};static=int(np.count_nonzero(np.any(a!=np.array(Image.open(base/'crane-wall-continuity-20261003/renders/attempt-004/render.png').convert('RGBA')),axis=2)))
f=base/'crane-live-edits-20261003/renders/aperture/attempt-002/failure.json';d=json.loads(f.read_text())['partialState']['evidence'];by={m['name']:m for m in d['nativeGeometry']['meshes']};diffbytes=numeric=signedzeros=0
for b in d['nativeGeometry']['gpuBuffers']:
 if b.get('streamId'):
  s=next(x for x in by[b['name']]['streams'] if x['id']==b['streamId']);raw=bytes(b['fullUploadBytes']);expected=struct.pack('<'+'f'*len(s['data']),*s['data']);assert len(raw)==len(expected);diffbytes+=sum(x!=y for x,y in zip(raw,expected));vals=struct.unpack('<'+'f'*(len(raw)//4),raw)
  for x,y in zip(vals,s['data']):
   if x!=y:numeric+=1
   elif x==0 and struct.pack('<f',x)!=struct.pack('<f',y):signedzeros+=1
report={'threejs':{'states':len(states),'meshFieldComparisons':checks,'maxNumericError':maxerror,'failures':bad,'nativeChecks':sum(len(d['evidence']['nativeChecks']['checks']) for d in states),'resetPixelDifferences':resets,'staticBaselinePixelDifferences':static,'finalResources':{k:states[-1]['evidence']['resources'][k] for k in ['nativeObjects','gpu']}},'apertureAttempt002':{'failed':True,'failure':'Native GPU upload byte equality rejected JSON-normalized negative zero','mismatchedBytes':diffbytes,'numericFloatDifferences':numeric,'signedZeroDifferences':signedzeros,'interpretation':'All444 differences are sign bits on zero; preserves failed result. This diagnoses evidence serialization loss, not a demonstrated engine geometry defect. No relaxed raw-byte gate or rerun performed.'},'scope':'Exploratory retained-artifact audit. Float32 numeric comparison tolerance2e-5, measured Berror0; raw GPU bytes tested separately. No score/performance claim.'}
print(json.dumps(report,indent=2))
assert len(states)==29 and checks==7308 and not bad and maxerror==0 and not any(resets.values()) and static==0
assert diffbytes==signedzeros==444 and numeric==0
