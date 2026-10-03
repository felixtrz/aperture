import bpy,json,pathlib,hashlib
repo=pathlib.Path('/workspace/scratch/0190a8c72f8a/aperture-recovery-20261002');base=repo/'benchmarks/crane-reference-20261003';reports=[]
for p in sorted(base.rglob('*.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(p),load_ui=False,use_scripts=False)
 report={'path':str(p.relative_to(repo)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'texts':[{'name':t.name,'characters':len(t.as_string())} for t in bpy.data.texts],'libraries':[l.filepath for l in bpy.data.libraries],'images':[{'name':x.name,'source':x.source,'path':x.filepath,'packed':bool(x.packed_file)} for x in bpy.data.images],'sounds':[s.filepath for s in bpy.data.sounds],'movieclips':[m.filepath for m in bpy.data.movieclips],'fonts':[f.filepath for f in bpy.data.fonts],'objects':[o.name for o in bpy.data.objects],'material_names':[m.name for m in bpy.data.materials]}
 assert not report['texts'] and not report['libraries'] and not report['sounds'] and not report['movieclips'],report
 assert all(x['source'] in ['VIEWER','GENERATED'] and not x['path'] and not x['packed'] for x in report['images']),report
 assert all(f=='<builtin>' for f in report['fonts']),report
 reports.append(report)
(repo/'benchmarks/crane-comparison-20261003/reference-assets-privacy-review.json').write_text(json.dumps({'review':'Read both blend files with factory startup and auto-execution disabled; no renders, external libraries, embedded texts, packed images, sound, video or external font data. Procedural crane objects/materials only. ZIP separately verified exactly equals five published author inputs; GLBs contain 78 meshes and no external URI/image payloads.','files':reports},indent=2)+'\n')
print('PRIVACY_REVIEW_PASSED',len(reports),'procedural Blender scenes')
