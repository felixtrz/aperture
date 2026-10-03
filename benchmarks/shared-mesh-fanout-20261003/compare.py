#!/usr/bin/env python3
"""Independent Pillow decoded RGB controls after all seven separately admitted sessions."""
import hashlib,json,sys
from pathlib import Path
from PIL import Image,ImageChops
root=Path(__file__).resolve().parent
sessions=['live','shared-baseline','shared-grow','shared-shrink','unshared-baseline','unshared-grow','unshared-shrink']
records={};images={};inputs=[]
for session in sessions:
 directory=root/'renders'/'aperture'/session/'attempt-001'
 outcome=json.loads((directory/'outcome.json').read_text());assert outcome['status']=='passed' and outcome['sourcePinsUnchanged'] and outcome['serverClosed']
 states=sorted((directory/'states').glob('*.json'));assert len(states)==(8 if session=='live' else 1)
 for path in states:
  record=json.loads(path.read_text());png=path.with_suffix('.png');image=Image.open(png);image.load();assert image.size==(1024,1024) and image.mode in ('RGB','RGBA')
  if image.mode=='RGBA':assert image.getchannel('A').getextrema()==(255,255)
  image=image.convert('RGB');assert any(a!=b for a,b in image.getextrema());key=(session,record['state']['index']);records[key]=record;images[key]=image
  inputs.append({'path':str(png.relative_to(root)),'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'rgbSha256':hashlib.sha256(image.tobytes()).hexdigest()})
def geometry(record):
 return [{k:m.get(k) for k in ('name','positions','indices','worldMatrix','streams','submeshes')} for m in record['evidence']['nativeGeometry']['meshes']]
controls=[]
for key,record in records.items():
 if key[0]!='live':continue
 other=('shared-'+record['state']['edit'],0);a,b=images[key],images[other];assert a.tobytes()==b.tobytes();assert geometry(record)==geometry(records[other]);controls.append({'live':list(key),'cold':list(other),'differingRgbPixels':0,'rawGeometryEqual':True})
for edit in ('baseline','grow','shrink'):
 a,b=('shared-'+edit,0),('unshared-'+edit,0);assert images[a].tobytes()==images[b].tobytes();assert geometry(records[a])==geometry(records[b]);controls.append({'shared':list(a),'unshared':list(b),'differingRgbPixels':0,'rawGeometryEqual':True})
mutations=[]
for edit in ('grow','shrink'):
 diff=ImageChops.difference(images[('shared-baseline',0)],images[('shared-'+edit,0)]);count=sum(p!=(0,0,0) for p in diff.getdata());assert count>0;mutations.append({'edit':edit,'differingRgbPixels':count,'maximumChannelDifference':max(v[1] for v in diff.getextrema())})
assert len(inputs)==14 and len(controls)==11
report={'status':'passed','decoder':'Pillow '+Image.__version__,'captures':inputs,'exactControls':controls,'visibleMutations':mutations,'scope':'Aperture within-fixture pixels only; no performance/memory/cross-engine claims'}
output=root/(sys.argv[1] if len(sys.argv)>1 else 'comparison-001.json')
assert output.parent==root and not output.exists()
with output.open('x') as file:json.dump(report,file,indent=2);file.write('\n')
print(json.dumps({'status':'passed','captures':14,'exactControls':11,'output':output.name}))
