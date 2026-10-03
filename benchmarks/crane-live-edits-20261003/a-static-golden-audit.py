"""Independent retained-native-buffer comparison; does not launch a browser."""
import json,pathlib,struct,hashlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
def read(p):return json.loads((ROOT/p).read_text())
def native(p):return read(p)['sceneStatus']['geometryEvidence']['nativeMeshes']
def positions(m):
 s=next(s for s in m['streams'] if any(a['semantic']=='POSITION' for a in s['attributes']))
 a=next(a for a in s['attributes'] if a['semantic']=='POSITION');assert a['format']=='float32x3'
 fmt={'Float32Array':'f','Uint32Array':'I','Uint16Array':'H','Uint8Array':'B'}[s['dataType']]
 b=struct.pack('<'+fmt*len(s['data']),*s['data'])
 return [struct.unpack_from('<fff',b,i*s['arrayStride']+a['offset']) for i in range(s['vertexCount'])]
def triangles(m):
 p=positions(m);mat=m['worldMatrix'];out=[]
 for sub in m['submeshes']:
  assert sub['topology']=='triangle-list'
  indices=m.get('indices')
  ix=indices[sub['indexStart']:sub['indexStart']+sub['indexCount']] if indices else range(sub['vertexStart'],sub['vertexStart']+sub['vertexCount'])
  assert len(ix)%3==0
  for i in ix:
   x,y,z=p[i];out.extend(mat[k]*x+mat[k+4]*y+mat[k+8]*z+mat[k+12] for k in range(3))
 return out
base='benchmarks/crane-wall-continuity-20261003/renders/'
baseline=native(base+'attempt-002/result.json');arch=native(base+'attempt-006/result.json')
golden={'baseline':baseline,'arch':arch};paths=[base+'attempt-002/result.json',base+'attempt-006/result.json']
body=next(m for m in baseline if m['name']=='wall.body.continuous')
for edit,num in [('shoulder',5),('elbow',6),('hoist',7),('pipe',9),('tier',10),('assembly',11)]:
 p=f'benchmarks/crane-comparison-20261003/renders/a/attempt-{num:03}/result.json';paths.append(p)
 meshes=native(p)
 golden[edit]=[m for m in meshes if not (m['name'].startswith('wall.pier.') or m['name'].startswith('wall.upper-side.') or m['name'].startswith('wall.spandrel.'))]+[body]
report={'schema':'aperture.crane-live-static-golden.v1','tolerance':2e-5,'scope':'Actual native POSITION streams, genuine indexed/nonindexed submesh triangle ranges and ECS world matrices. No source mesh proxy. Float32 world-transform numerical comparison; not raw-byte equality.','goldenSha256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths},'states':[]}
files=sorted((ROOT/sys.argv[1]/'states').glob('*.json'))
for p in files:
 d=json.loads(p.read_text());state=d['state'];meshes=d['evidence']['nativeGeometry']['meshes'];expected={m['name']:m for m in golden[state['edit']]};assert {m['name'] for m in meshes}==set(expected)
 checks=[]
 for m in meshes:
  a,b=triangles(m),triangles(expected[m['name']]);assert len(a)==len(b),m['name']
  error=max((abs(x-y) for x,y in zip(a,b)),default=0);checks.append({'mesh':m['name'],'coordinateCount':len(a),'maxError':error,'ok':error<=2e-5})
 report['states'].append({'id':state['id'],'checks':checks,'ok':all(c['ok'] for c in checks)})
report['ok']=len(files)==29 and all(s['ok'] for s in report['states']);print(json.dumps(report,indent=2));sys.exit(0 if report['ok'] else 1)
