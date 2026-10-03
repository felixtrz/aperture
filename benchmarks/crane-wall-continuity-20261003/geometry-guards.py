"""Exact binary-rational surface-coverage guards and retained-native comparison."""
from pathlib import Path
from fractions import Fraction as F
from collections import Counter
import json,struct,math,shutil,sys
base=Path(__file__).resolve().parent
plain=lambda name:name.startswith(('wall.pier.','wall.upper-side.','wall.spandrel.'))
def f32(v):return struct.unpack('f',struct.pack('f',v))[0]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def source_mesh(m,engine):
 if engine=='a':return {'name':m['name'],'p':m['positions'],'n':m.get('normals'),'i':m['indices'],'m':m['worldMatrix'],'mat':m['material']}
 return {'name':m['name'],'p':[m['positions'][i:i+3] for i in range(0,len(m['positions']),3)],'n':[m['normals'][i:i+3] for i in range(0,len(m['normals']),3)],'i':m['indices'],'m':m['matrix'],'mat':m['materials']}
def actual_a(m,materials):
 s=m['streams'][0];stride=s['arrayStride']//4;po=next(a['offset']//4 for a in s['attributes'] if a['semantic']=='POSITION');no=next(a['offset']//4 for a in s['attributes'] if a['semantic']=='NORMAL');d=s['data']
 return {'name':m['name'],'p':[d[i+po:i+po+3] for i in range(0,len(d),stride)],'n':[d[i+no:i+no+3] for i in range(0,len(d),stride)],'i':m['indices'] if m['indices'] is not None else list(range(s['vertexCount'])),'m':m['worldMatrix'],'mat':materials[m['name']]}
def world(m):
 a=m['m'];return [[f32(a[k]*v[0]+a[k+4]*v[1]+a[k+8]*v[2]+a[k+12]) for k in range(3)] for v in m['p']]
def triangles(m):
 p=world(m);return [[p[j] for j in m['i'][i:i+3]] for i in range(0,len(m['i']),3)]
def rational(t):return [tuple(F(x) for x in p) for p in t]
def area2(poly):return sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1]))
def area(poly):return abs(area2(poly))/2

def split_boundary(ts,points):
 edges=Counter()
 for tri in ts:
  for a,b in zip(tri,tri[1:]+tri[:1]):
   d=(b[0]-a[0],b[1]-a[1]);axis=0 if abs(d[0])>=abs(d[1]) else 1
   cuts=[]
   for p in points:
    if (p[0]-a[0])*d[1]!=(p[1]-a[1])*d[0]:continue
    t=(p[axis]-a[axis])/d[axis]
    if 0<=t<=1:cuts.append((t,p))
   cuts=sorted(set(cuts))
   for (_,u),(_,v) in zip(cuts,cuts[1:]):edges[(u,v)]+=1
 result=Counter()
 for (u,v),n in edges.items():
  net=n-edges[(v,u)]
  if net>0:result[(u,v)]=net
 return result

def cap(meshes,z):
 out=[]
 for m in meshes:
  for tri in triangles(m):
   if all(p[2]==z for p in tri):
    t=[(F(p[0]),F(p[1])) for p in tri];assert area(t)>0,'Degenerate cap'
    if area2(t)<0:t.reverse()
    out.append(t)
 return out

def clip(subject,clipper):
 if area2(clipper)<0:clipper=list(reversed(clipper))
 out=subject
 for a,b in zip(clipper,clipper[1:]+clipper[:1]):
  current=out;out=[]
  if not current:break
  def side(p):return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
  for p,q in zip(current,current[1:]+current[:1]):
   sp,sq=side(p),side(q)
   if sp>=0:out.append(p)
   if (sp<0 and sq>0) or (sp>0 and sq<0):
    t=sp/(sp-sq);out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
 return out

def classify(t):
 n=cross(sub(t[1],t[0]),sub(t[2],t[0]));nonzero=[i for i,x in enumerate(n) if x]
 if len(nonzero)!=1:return None
 axis=nonzero[0]
 if len(set(p[axis] for p in t))!=1:return None
 return axis,t[0][axis],1 if n[axis]>0 else -1

def exact_hidden_coverage(original,modified,removed):
 alltris=[(m['name'],t,classify(t)) for m in original.values() if m['name'].startswith('wall.') for t in triangles(m)]
 checked=[]
 for name,offsets in removed.items():
  a=original[name];b=modified[name];assert a['p']==b['p'] and a['m']==b['m'] and a['mat']==b['mat']
  assert b['i']==[x for j,x in enumerate(a['i']) if j not in set(offsets)]
  tris=triangles(a)
  for start in offsets[::3]:
   tri=tris[start//3];axis,value,sign=classify(tri);axes=[i for i in range(3) if i!=axis];p=[tuple(F(v[i]) for i in axes) for v in tri]
   needed=area(p);covered=F(0);partners=set()
   for other,q,classification in alltris:
    if other==name or classification!=(axis,value,-sign):continue
    q2=[tuple(F(v[i]) for i in axes) for v in q];inter=clip(p,q2)
    covered+=area(inter) if len(inter)>=3 else F(0)
    if len(inter)>=3 and area(inter)>0:partners.add(other)
   assert needed==covered,(name,start,float(needed),float(covered))
   checked.append({'mesh':name,'source_index_offset':start,'area':float(needed),'coverage_fraction_exact':'1','opposite_surface_parts':sorted(partners)})
 assert len(checked)==60
 return checked

def surface_equivalence(original,body):
 brick=[v for k,v in original.items() if plain(k)];oldpos=[p for m in brick for p in world(m)];newpos=world(body)
 oldbounds=[[min(p[k] for p in oldpos),max(p[k] for p in oldpos)] for k in range(3)];newbounds=[[min(p[k] for p in newpos),max(p[k] for p in newpos)] for k in range(3)];assert oldbounds==newbounds,(oldbounds,newbounds)
 front=max(p[2] for p in oldpos);back=min(p[2] for p in oldpos);assert set(p[2] for p in newpos)=={front,back}
 results=[]
 for z in [back,front]:
  a=cap(brick,z);b=cap([body],z);points=set(p for t in a+b for p in t);ae=split_boundary(a,points);be=split_boundary(b,points)
  assert ae==be,('Boundary mismatch',z,len(ae),len(be),list((ae-be).items())[:3],list((be-ae).items())[:3])
  aa=sum(map(area,a));ba=sum(map(area,b));assert aa==ba,('Area mismatch',float(aa),float(ba))
  assert all(n==1 for n in ae.values())
  results.append({'z':z,'source_triangles':len(a),'continuous_triangles':len(b),'area_exact_rational':str(aa),'normalized_directed_boundary_segments':len(ae),'coverage_exact':True})
 # Surface closure with normals independent of cap triangulation.
 allts=triangles(body);points3=set(tuple(p) for t in allts for p in t);counts=Counter();directed=Counter()
 for point in points3:assert all(math.isfinite(v) for v in point)
 for tri in allts:
  n=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));assert math.hypot(*n)>0
  for a,b in zip(tri,tri[1:]+tri[:1]):
   a,b=tuple(a),tuple(b);counts[tuple(sorted((a,b)))]+=1;directed[(a,b)]+=1
 assert all(v==2 for v in counts.values()),'Continuous body is not closed two-manifold'
 assert all(n==directed[(b,a)] for (a,b),n in directed.items()),'Inconsistent directed winding'
 if body['n']:
  for n in body['n']:assert abs(math.hypot(*n)-1)<1e-6
  for i in range(0,len(body['i']),3):
   ids=body['i'][i:i+3];tri=[newpos[x] for x in ids];crossn=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));length=math.hypot(*crossn)
   for x in ids:assert sum(a*b for a,b in zip(body['n'][x],crossn))/length>1-1e-6,'Normal/winding mismatch'
   if all(v[2]==front for v in tri):assert all(body['n'][x]==[0,0,1] for x in ids)
   if all(v[2]==back for v in tri):assert all(body['n'][x]==[0,0,-1] for x in ids)
 return {'bounds_exact':oldbounds,'cap_coverage':results,'closed_two_manifold':True,'positive_finite_triangles':len(allts),'normals_winding_consistent':True}

def get_original(c):
 s=json.loads((base/c['comparator']/'result.json').read_text())['sceneStatus']
 if c['engine']=='a':data=s['geometryEvidence'];return {m['name']:source_mesh(m,'a') for m in data['scene']['parts']},data
 data=s['nativeGeometry'];return {m['name']:source_mesh(m,'b') for m in data['meshes']},data

def opening_probes(meshes,width):
 wall=[m for m in meshes.values() if m['name'].startswith('wall.') and not m['name'].startswith('wall.lamp')]
 def hit(x,y):
  for m in wall:
   for tri in triangles(m):
    a,b,c=tri;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-14:continue
    u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
    v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
    if u>=-1e-10 and v>=-1e-10 and u+v<=1+1e-10:return True
  return False
 r=width/2;checks=[]
 for fraction in [-.8,-.4,0,.4,.8]:
  x=1.2+fraction*r
  for y in [.55,1.1+.5*math.sqrt(r*r-(fraction*r)**2)]:
   assert not hit(x,y),(x,y);checks.append({'point':[x,y],'through_wall':True})
 for x,expected in [(f32(1.2-r)-.0001,True),(f32(1.2-r)+.0001,False),(f32(1.2+r)-.0001,False),(f32(1.2+r)+.0001,True)]:
  assert hit(x,.55)==expected;checks.append({'point':[x,.55],'blocked':expected})
 return checks

def check(c,native=None):
 original,original_data=get_original(c);cpu=json.loads((base/'cpu'/f'{c["id"]}.json').read_text());arr=cpu['parts'] if c['engine']=='a' else cpu['meshes'];new={m['name']:source_mesh(m,c['engine']) for m in arr}
 result={'case':c['id'],'phase':'native' if native else 'cpu'}
 if native is not None:
  if c['engine']=='a':
   ev=native['geometryEvidence'];materials={m['name']:m['material'] for m in ev['scene']['parts']};actual={m['name']:actual_a(m,materials) for m in ev['nativeMeshes']}
  else:actual={m['name']:source_mesh(m,'b') for m in native['nativeGeometry']['meshes']}
  assert actual.keys()==new.keys()
  for name,m in actual.items():
   expected=new[name];assert m['m']==expected['m'] and m['mat']==expected['mat']
   # Triangle-expanded streams may differ from indexed source layout; oriented triangles must be exact.
   assert triangles(m)==triangles(expected),('Native triangle mismatch',name)
   if expected['n'] is not None:
    an=[m['n'][i] for i in m['i']];en=[expected['n'][i] for i in expected['i']];assert an==en,('Native normal mismatch',name)
  new=actual;result['all_native_triangles_matrices_material_labels_match_cpu_exactly']=True
 if c['id']=='a-hidden-faces-removed':
  # CPU index deletion is the exact raw-source control; native expansion verified above.
  checked=exact_hidden_coverage(original,{m['name']:source_mesh(m,'a') for m in arr},c['removed_index_offsets']);result['covered_removed_triangles']=checked
  expected_unchanged=[k for k in original if k not in c['removed_index_offsets']]
  for k in expected_unchanged:
   assert triangles(original[k])==triangles(new[k]);assert original[k]['m']==new[k]['m'] and original[k]['mat']==new[k]['mat']
  result['unchanged_other_meshes']=len(expected_unchanged)
 else:
  assert 'wall.body.continuous' in new;assert not any(plain(k) for k in new)
  expected_unchanged=[k for k in original if not plain(k)];assert set(new)==set(expected_unchanged)|{'wall.body.continuous'}
  for k in expected_unchanged:
   assert triangles(original[k])==triangles(new[k]),('Unrelated geometry changed',k);assert original[k]['m']==new[k]['m'] and original[k]['mat']==new[k]['mat']
  body=new['wall.body.continuous'];assert body['mat'] in ('brick',['brick']);result['surface_equivalence']=surface_equivalence(original,body);result['unchanged_other_meshes']=len(expected_unchanged)
  result['opening_probes']=opening_probes(new,2.1 if c['edit']=='arch' else 1.6)
 if native is not None and c['engine']=='a':
  old_native={m['name']:m for m in original_data['nativeMeshes']};new_native={m['name']:m for m in native['geometryEvidence']['nativeMeshes']}
  for name in expected_unchanged:assert old_native[name]==new_native[name],('Unaffected native stream changed',name)
  result['unaffected_native_streams_exact']=True
 if c['engine']=='b':
  for name in expected_unchanged:assert original[name]['n']==new[name]['n'],('Unaffected normal changed',name)
  result['unaffected_normals_exact']=True
 return result

if __name__=='__main__':
 if shutil.disk_usage(base).free<2147483648:raise RuntimeError('Low storage; no new writes')
 cases=json.loads((base/'cases.json').read_text())
 if len(sys.argv)==3:
  cid,attempt=sys.argv[1:];c=next(x for x in cases if x['id']==cid);native=json.loads((base/'renders'/attempt/'result.json').read_text())['sceneStatus'];result=check(c,native);p=base/(attempt+'-geometry.json');p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'case':cid,'native_geometry_guards':'passed'}))
 else:
  out=[]
  for c in cases:
   result=check(c);out.append(result);print(json.dumps({'case':c['id'],'cpu_geometry_guards':'passed'}),flush=True)
  (base/'cpu-geometry-guards.json').write_text(json.dumps(out,indent=2)+'\n')
