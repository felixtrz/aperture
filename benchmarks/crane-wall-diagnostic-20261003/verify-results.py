"""Final evidence invariants and pixel differences. Does not render or alter images."""
from pathlib import Path
import json,hashlib,shutil,collections
from PIL import Image
import numpy as np
base=Path(__file__).resolve().parent;repo=base.parents[1]
if shutil.disk_usage(base).free<2147483648:raise RuntimeError('Low storage; no new writes')
def read(n):return json.loads((base/f'renders/attempt-{n:03}/result.json').read_text())
def pix(n):return np.asarray(Image.open(base/f'renders/attempt-{n:03}/render.png').convert('RGB')).astype(np.int16)
reports=[read(i) for i in range(1,9)];summaries=[json.loads((base/f'attempt-{i:03}-summary.json').read_text()) for i in range(1,9)]
assert len(list(base.glob('attempt-*-before.json')))==8
assert all(r['status']=='passed' and r['proof']['native'] and not r['proof']['webglAttempts'] and not r['proof']['errors'] and not r['proof']['deviceLost'] for r in reports)
assert all(s['pins_unchanged'] for s in summaries)
assert summaries[0]['exact_retained_png_bytes'] and summaries[1]['exact_retained_png_bytes']
before=reports[3]['sceneStatus']['nativeGeometry'];after=reports[7]['sceneStatus']['nativeGeometry']
cases=json.loads((base/'cases.json').read_text());remove=cases[-1]['removed_index_offsets'];changes=[];total_removed=0
assert {k:v for k,v in before.items() if k!='meshes'}=={k:v for k,v in after.items() if k!='meshes'}
for a,b in zip(before['meshes'],after['meshes'],strict=True):
 assert {k:v for k,v in a.items() if k not in ('indices','groups')}=={k:v for k,v in b.items() if k not in ('indices','groups')},a['name']
 if a['name'] in remove:
  gone=set(remove[a['name']]);expected=[v for i,v in enumerate(a['indices']) if i not in gone]
  assert expected==b['indices'];assert b['groups']==[{'start':0,'count':len(expected),'materialIndex':0}]
  total_removed+=len(gone)//3;changes.append({'mesh':a['name'],'removed_triangles':len(gone)//3,'positions_normals_materials_matrices_markers_exact':True})
 else:assert a==b,a['name']
assert total_removed==52
pixel={}
for i,j in [(1,3),(2,4),(2,5),(2,6),(1,7),(4,8)]:
 d=pix(i)-pix(j);mask=np.any(d!=0,axis=2);ys,xs=np.where(mask)
 pixel[f'{i:03}-vs-{j:03}']={'changed_pixels':int(mask.sum()),'bbox_inclusive':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())] if len(xs) else None,'maximum_absolute_channel_difference':int(abs(d).max()),'mean_absolute_channel_difference':float(abs(d).mean())}
# Descriptive roughness in a fixed, inspected patch above the arch, not a quality score.
# Includes authored seams for both filters and thus does not count isolated noise alone.
roi=(655,383,696,417);x0,y0,x1,y1=roi;roughness={}
for n in [2,4,5,6,8]:
 v=pix(n)[y0:y1,x0:x1].astype(float).mean(axis=2);lap=4*v[1:-1,1:-1]-v[:-2,1:-1]-v[2:,1:-1]-v[1:-1,:-2]-v[1:-1,2:]
 roughness[str(n)]={'mean_absolute_4_neighbor_laplacian':float(abs(lap).mean()),'p95_absolute_4_neighbor_laplacian':float(np.percentile(abs(lap),95))}
audit=[]
for p in sorted((base/'lifecycle-audits').glob('*.jsonl')):
 events=[json.loads(l) for l in p.read_text().splitlines()];assert events[0]['event']=='run-start';assert events[-1]['event']=='run-completed' and events[-1]['exitcode']==0
 audit.append({'file':str(p.relative_to(base)),'job':events[0]['job'],'run':events[0]['run'],'completed':True,'exitcode':events[-1]['exitcode']})
assert len(audit)==8
pins=json.loads((base/'runtime-pins.json').read_text());assert all(hashlib.sha256((repo/p).read_bytes()).hexdigest()==h for p,h in pins.items())
result={'all_8_native_passed':True,'fresh_baselines_exact_retained_png_bytes':True,'all_source_dependency_pins_unchanged':True,'all_control_native_geometry_exact':all(reports[n-1]['sceneStatus'][k]==reports[b-1]['sceneStatus'][k] for n,b,k in [(3,1,'geometryEvidence'),(4,2,'nativeGeometry'),(5,2,'nativeGeometry'),(6,2,'nativeGeometry'),(7,1,'geometryEvidence')]),'interior_removal':{'removed_triangles':total_removed,'only_specified_indices_and_group_counts_changed':True,'changes':changes},'pixel_differences':pixel,'wall_roughness':{'roi_exclusive':list(roi),'caveat':'descriptive patch metric only; includes remaining authored seams; not an engine score','cases':roughness},'lifecycle':audit,'free_bytes_final':shutil.disk_usage(base).free}
(base/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['interior_removal','lifecycle']},indent=2))
