"""Inspect retained actual native streams; no scene construction or browser calls."""
import json,pathlib,collections,hashlib,shutil
base=pathlib.Path(__file__).resolve().parent
if shutil.disk_usage(base).free<2147483648:raise RuntimeError('Low storage; no new writes')
def capture(n):return json.loads((base/f'renders/attempt-{n:03}/result.json').read_text())['sceneStatus']
def canonical(m):
 if 'streams' in m:
  s=m['streams'][0];stride=s['arrayStride']//4;posoff=next(a['offset']//4 for a in s['attributes'] if a['semantic']=='POSITION');normoff=next(a['offset']//4 for a in s['attributes'] if a['semantic']=='NORMAL');data=s['data']
  p=[data[i+posoff:i+posoff+3] for i in range(0,len(data),stride)];n=[data[i+normoff:i+normoff+3] for i in range(0,len(data),stride)];indices=m['indices'] or list(range(len(p)))
 else:p=[m['positions'][i:i+3] for i in range(0,len(m['positions']),3)];n=[m['normals'][i:i+3] for i in range(0,len(m['normals']),3)];indices=m['indices']
 return p,n,indices
report={'purpose':'Actual baseline native wall topology and normal/material inspection','engines':{},'native_controls':{}}
for engine,number in [('a',1),('b',2)]:
 status=capture(number);data=status['geometryEvidence'] if engine=='a' else status['nativeGeometry'];meshes=data['nativeMeshes'] if engine=='a' else data['meshes'];a_materials={m['name']:m['material'] for m in data['scene']['parts']} if engine=='a' else {}
 faces=collections.defaultdict(list);panels=[]
 for m in meshes:
  if not (m['name'].startswith('wall.pier.') or m['name'].startswith('wall.upper-side.') or m['name'].startswith('wall.spandrel.')):continue
  p,n,ind=canonical(m);external=[]
  for i in range(0,len(ind),3):
   ids=ind[i:i+3];pts=[p[x] for x in ids]
   if len(set(x[2] for x in pts))==1:
    external.append({'triangle':i//3,'z':pts[0][2],'normals':[n[x] for x in ids]})
  panels.append({'name':m['name'],'material':a_materials.get(m['name'],m.get('materials')),'external_triangles':external,'unique_positions':sorted(set(tuple(v) for v in p))})
  # Each closed wall prism has six authored planar quads (two triangles each).
  for i in range(0,len(ind),6):
   ids=ind[i:i+6];points=sorted(set(tuple(p[x]) for x in ids));normals=set(tuple(n[x]) for x in ids)
   if len(points)==4 and len(normals)==1:
    normal=next(iter(normals))
    if abs(normal[0])==1 and normal[1]==0 and normal[2]==0:
     faces[tuple(points)].append({'mesh':m['name'],'index_offset':i,'index_count':6,'normal':normal})
 pairs=[]
 for pts,members in faces.items():
  if len(members)==2 and members[0]['normal'][0]==-members[1]['normal'][0]:pairs.append({'points':pts,'faces':members})
 report['engines'][engine]={'brick_panels':panels,'exact_opposite_interior_pairs':pairs,'paired_quad_count':len(pairs),'paired_triangle_count':len(pairs)*4,'flat_exterior_normals':all(len(set(tuple(v) for v in t['normals']))==1 and abs(t['normals'][0][2])==1 and t['normals'][0][0]==t['normals'][0][1]==0 for q in panels for t in q['external_triangles']),'front_back_z_values':sorted(set(t['z'] for q in panels for t in q['external_triangles']))}
for number,baseline in [(3,1),(4,2),(5,2),(6,2),(7,1)]:
 p=base/f'renders/attempt-{number:03}/result.json'
 if not p.exists():continue
 a=capture(baseline);b=capture(number);key='geometryEvidence' if baseline==1 else 'nativeGeometry'
 report['native_controls'][str(number)]={'baseline_attempt':baseline,'exact_geometry_evidence_equal':a[key]==b[key]}
left={p['name']:p for p in report['engines']['a']['brick_panels']};right={p['name']:p for p in report['engines']['b']['brick_panels']}
report['cross_engine_wall_positions_exact']=all(left[k]['unique_positions']==right[k]['unique_positions'] for k in left)
(base/'native-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pairs':{e:d['paired_quad_count'] for e,d in report['engines'].items()},'flat_normals':{e:d['flat_exterior_normals'] for e,d in report['engines'].items()},'cross_engine_wall_positions_exact':report['cross_engine_wall_positions_exact'],'native_controls':report['native_controls']}))
