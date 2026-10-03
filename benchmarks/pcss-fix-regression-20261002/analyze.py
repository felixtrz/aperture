#!/usr/bin/env python3
"""Assert retained native profiles and image compatibility. Does not launch."""
import hashlib,json,math
from pathlib import Path
from PIL import Image
base=Path(__file__).resolve().parent;repo=base.parent.parent

def load(name):return json.loads((base/'renders'/name/'result.json').read_text())
def pixels(path):return Image.open(path).convert('RGB')
before=load('01-synthetic-before');after=load('08-synthetic-after-corrected-features')
assert before['status']==after['status']=='passed'
a={p['id']:p for p in after['sceneStatus']['profiles']};b={p['id']:p for p in before['sceneStatus']['profiles']}
order=['contact','middle','far','maximum'];widths=[a[n]['transitionWidthTexels'] for n in order]
assert all(x<y for x,y in zip(widths,widths[1:])),widths
assert len({b[n]['transitionWidthTexels'] for n in order})==1
assert widths[0]<widths[-1]/3
assert a['no-blocker']['values']==[1]*256
assert a['fully-shadowed']['values']==[0]*256
invariance={n:max(abs(x-y) for x,y in zip(a['far']['values'],a[n]['values'])) for n in ['far-shifted-clip','far-wide-clip']}
assert all(value<0.00002 for value in invariance.values())
for n in ['hard-contact','hard-far','pcf-contact','pcf-far']:
 assert a[n]['values']==b[n]['values'],n
assert a['zero-radius']['values']==a['radius-one']['values']
for p in a.values():assert all(math.isfinite(x) and 0<=x<=1 for x in p['values'])
assert set(a['degenerate-projection']['values'])=={0,1}
assert all(not r['errors'] for r in after['sceneStatus']['compileReports'])
comparisons=[]
for new,old in [('03-cottage-front','01-front-baseline'),('04-cottage-rear','11-rear-baseline'),('06-cottage-hard','04-front-hard'),('07-cottage-pcf','05-front-weighted-pcf')]:
 result=load(new);assert result['status']=='passed'
 x=pixels(base/'renders'/new/'render.png');y=pixels(repo/'benchmarks/cottage-eave-diagnostic-20261002/renders'/old/'render.png')
 assert x.size==y.size==(800,800)
 changed=sum(a!=b for a,b in zip(x.getdata(),y.getdata()))
 if new in ['06-cottage-hard','07-cottage-pcf']:assert changed==0
 shadow=result['sceneStatus']['render']['shadow'];assert shadow['ready'] and shadow['casterCounts']['submittedDrawCalls']==34
 assert shadow['requestCoverage']['servedCount']==1 and shadow['requestCoverage']['omittedCount']==0
 assert result['sceneStatus']['render']['diagnostics']==[]
 comparisons.append(dict(after=new,before=old,changed_pixels=changed,shadow_kind=shadow['shadowKind'],caster_counts=shadow['casterCounts'],request_coverage=shadow['requestCoverage']))
front=pixels(base/'renders/03-cottage-front/render.png');oldfront=pixels(repo/'benchmarks/cottage-eave-diagnostic-20261002/renders/01-front-baseline/render.png')
transects={name:[list(im.getpixel((335,y))) for y in range(240,265)] for name,im in [('before',oldfront),('after',front)]}
counts={name:sum(v not in [[184,178,164],[223,220,212]] for v in vals) for name,vals in transects.items()}
assert counts=={'before':15,'after':3}
progress=json.loads((base/'progress.json').read_text());proofs=[];frozen_checks=0
for row in progress:
 r=load(row['id'])
 if row['status']=='passed':
  assert r['status']=='passed' and r['proof']['native'] and r['proof']['webglAttempts']==0 and r['proof']['errors']==[] and r['proof']['deviceLost']==[]
 proofs.append(dict(id=row['id'],status=row['status'],exit_code=row['exit_code'],native=r.get('proof'),free_bytes_before=row['free_bytes_before'],free_bytes_after=row['free_bytes_after']))
 for file,digest in row['pins'].items():
  if file.startswith(('benchmarks/cottage-comparison-20261002/','benchmarks/cottage-eave-diagnostic-20261002/')):
   assert hashlib.sha256((repo/file).read_bytes()).hexdigest()==digest,file
   frozen_checks+=1
out=dict(schema=1,metric='5–95% transition width in shadow texels for one fixed vertical blocker edge; deterministic numerical test, not an aesthetic score',blocker_separations=[a[n]['gap'] for n in order],before_widths=[b[n]['transitionWidthTexels'] for n in order],after_widths=widths,clip_range_max_visibility_error=invariance,compatibility_profiles_exact=True,no_blocker_exact=True,fully_shadowed_exact=True,zero_equals_radius_one=True,degenerate_finite_hard_fallback=True,compile_reports=after['sceneStatus']['compileReports'],image_comparisons=comparisons,eave_transect=dict(x=335,y0=240,y1=264,rgb=transects,intermediate_rows=counts),native_runs=proofs,frozen_input_pin_checks=frozen_checks)
(base/'measurements.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['before_widths','after_widths','clip_range_max_visibility_error','frozen_input_pin_checks']},indent=2))
