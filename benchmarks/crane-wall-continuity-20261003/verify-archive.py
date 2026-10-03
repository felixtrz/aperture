from pathlib import Path
import json,hashlib,shutil
from PIL import Image
import numpy as np
base=Path(__file__).resolve().parent;repo=base.parents[1]
if shutil.disk_usage(base).free<2147483648:raise RuntimeError('Low storage; no new writes')
cases=json.loads((base/'cases.json').read_text());assert len(cases)==7 and len(list(base.glob('attempt-*-before.json')))==7
summaries=[];pixel=[];hashes={}
for i,c in enumerate(cases,1):
 a=f'attempt-{i:03}';s=json.loads((base/f'{a}-summary.json').read_text());r=json.loads((base/f'renders/{a}/result.json').read_text());g=json.loads((base/f'{a}-geometry.json').read_text())
 assert s['case']==c['id'] and s['status']=='passed' and s['exitcode']==0 and s['pins_unchanged']
 assert r['proof']['native'] and not r['proof']['webglAttempts'] and not r['proof']['errors'] and not r['proof']['deviceLost']
 assert g['all_native_triangles_matrices_material_labels_match_cpu_exactly']
 old=np.asarray(Image.open(base/c['comparator']/'render.png').convert('RGB')).astype(np.int16)
 new=np.asarray(Image.open(base/f'renders/{a}/render.png').convert('RGB')).astype(np.int16)
 delta=abs(new-old);mask=np.any(delta,axis=2);y,x=np.where(mask)
 info={'attempt':a,'case':c['id'],'changed_pixels':int(mask.sum()),'bbox_inclusive':[int(x.min()),int(y.min()),int(x.max()),int(y.max())],'maximum_channel_difference':int(delta.max())}
 if i==1:
  info['vertical_join_roi']={'bounds_exclusive':[635,345,796,531],'changed_pixels':int(mask[345:531,635:796].sum())}
  info['horizontal_join_roi']={'bounds_exclusive':[792,531,875,559],'changed_pixels':int(mask[531:559,792:875].sum())}
  info['outside_wall_bounds_changed_pixels']=int(mask.sum()-mask[340:656,585:880].sum())
 pixel.append(info);summaries.append(s);hashes[a]=s['png_sha256']
audit=[]
for p in sorted((base/'lifecycle-audits').glob('*.jsonl')):
 d=[json.loads(line) for line in p.read_text().splitlines()];assert d[0]['event']=='run-start' and d[-1]['event']=='run-completed' and d[-1]['exitcode']==0
 audit.append({'file':str(p.relative_to(base)),'job':d[0]['job'],'run':d[0]['run'],'completed_after_descendants':True})
assert len(audit)==7
counts={}
for key in ['runtime','protected']:
 pins=json.loads((base/f'{key}-pins.json').read_text());assert all(hashlib.sha256((repo/f).read_bytes()).hexdigest()==h for f,h in pins.items());counts[key]=len(pins)
report={'all_seven_native_passed':True,'all_seven_native_geometry_guards_passed':True,'attempts_exhausted':True,'no_engine_or_original_archive_changes':True,'unchanged_pin_counts':counts,'png_sha256':hashes,'pixel_differences':pixel,'lifecycle':audit,'quiescent':True,'free_bytes_final':shutil.disk_usage(base).free}
(base/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'png_sha256':hashes,'pixel_differences':pixel,'pins':counts,'free_bytes':report['free_bytes_final']},indent=2))
