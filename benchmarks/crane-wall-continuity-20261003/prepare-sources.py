from pathlib import Path
import json,shutil,hashlib,difflib,collections
repo=Path(__file__).resolve().parents[2];base=Path(__file__).resolve().parent;old=repo/'benchmarks/crane-comparison-20261003';prior=repo/'benchmarks/crane-wall-diagnostic-20261003'
assert shutil.disk_usage(repo).free>=2147483648
pairs=json.loads((prior/'native-inspection.json').read_text())['engines']['a']['exact_opposite_interior_pairs'];remove=collections.defaultdict(set)
for pair in pairs:
 for f in pair['faces']:remove[f['mesh']].update(range(f['index_offset'],f['index_offset']+f['index_count']))
for n in ['left','right']:
 remove[f'wall.pier.{n}'].update(range(18,24));remove[f'wall.upper-side.{n}'].update(range(12,18))
remove={k:sorted(v) for k,v in sorted(remove.items())};assert sum(map(len,remove.values()))==180
cases=[{'id':'a-hidden-faces-removed','engine':'a','edit':'baseline','view':'front-quarter','variable':'delete 13 exact interior pairs plus pier tops and upper-side bottoms; receiveShadow remains false','comparator':'../crane-wall-diagnostic-20261003/renders/attempt-003','removed_index_offsets':remove}]
for e in ['a','b']:
 for view in ['front-quarter','rear-quarter']:
  cases.append({'id':f'{e}-continuous-{view}','engine':e,'edit':'baseline','view':view,'variable':'replace 16 plain brick parts with one continuous native extrusion','comparator':f'../crane-comparison-20261003/renders/{e}/attempt-'+('002' if view=='front-quarter' else '003')})
for e in ['a','b']:
 cases.append({'id':f'{e}-continuous-arch-front','engine':e,'edit':'arch','view':'front-quarter','variable':'continuous brick-body representation at frozen opening_width=2.1','comparator':f'../crane-comparison-20261003/renders/{e}/attempt-008'})
outline='''function continuousWallProfile(width) {
  const f = Math.fround, cx = 1.2, spring = 1.1, r = width / 2, outer = r + .2;
  const points = [[-.6,0],[cx-r,0],[cx-r,spring]];
  for (let i=0;i<=12;i++) {
    const angle=Math.PI-i*Math.PI/12;
    points.push([cx+outer*Math.cos(angle),spring+outer*Math.sin(angle)]);
  }
  points.push([cx+r,spring],[cx+r,0],[3,0],[3,2.6],[-.6,2.6]);
  const zBack=f(-2.2),zFront=f(-1.9);
  return {outline:points.map(p=>p.map(f)),depth:zFront-zBack,zOffset:zBack};
}
const isPlainBrickWall = name => /^wall\\.(pier|upper-side|spandrel)\\./.test(name);
'''
ahelper='''function continuousWallPart(width) {
  const extrusion=continuousWallProfile(width);
  const asset=createExtrudeMeshAsset({label:'wall.body.continuous',outline:extrusion.outline,depth:extrusion.depth});
  const stream=asset.vertexStreams.find(s=>s.attributes.some(a=>a.semantic==='POSITION'));
  const stride=stream.arrayStride/4,po=stream.attributes.find(a=>a.semantic==='POSITION').offset/4;
  const no=stream.attributes.find(a=>a.semantic==='NORMAL').offset/4;
  const positions=[],normals=[];
  for(let i=0;i<stream.vertexCount;i++) {
    positions.push(Array.from(stream.data.slice(i*stride+po,i*stride+po+3)));
    normals.push(Array.from(stream.data.slice(i*stride+no,i*stride+no+3)));
  }
  const worldMatrix=[...identity];worldMatrix[14]=extrusion.zOffset;
  return {name:'wall.body.continuous',material:'brick',group:'static',positions,normals,
    indices:Array.from(asset.indexBuffer.data),features:{kind:'continuous-extrusion'},worldMatrix,extrusion};
}
'''
bhelper='''function continuousWallMesh(width) {
  const profile=continuousWallProfile(width),shape=new Shape();
  shape.moveTo(...profile.outline[0]);
  for(const point of profile.outline.slice(1))shape.lineTo(...point);
  shape.closePath();
  const geometry=new ExtrudeGeometry(shape,{depth:profile.depth,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.translate(0,0,profile.zOffset);
  const positions=new Float32Array(geometry.getAttribute('position').array);
  const normals=new Float32Array(geometry.getAttribute('normal').array);
  const indices=geometry.index?new Uint32Array(geometry.index.array):new Uint32Array(Array.from({length:positions.length/3},(_,i)=>i));
  geometry.dispose();
  return {name:'wall.body.continuous',group:'static',positions,normals,indices,
    materials:['brick'],groups:[{start:0,count:indices.length,materialIndex:0}],matrix:identity(),markers:{},profile};
}
'''
for c in cases:
 src=old/f'author-{c["engine"]}/v2';dst=base/'sources'/c['id'];shutil.copytree(src,dst)
 if c['id']=='a-hidden-faces-removed':
  wp=dst/'worker.mjs';s=wp.read_text();assert s.count('receiveShadow:true')==1;wp.write_text(s.replace('receiveShadow:true','receiveShadow:false'))
  p=dst/'scene.mjs';s=p.read_text();anchor=" return {schema:'aperture.crane-author-a.v1'";assert s.count(anchor)==1
  addition=" if(edit!=='baseline')throw Error('Interior-face diagnostic is baseline-only.');\n const hiddenIndexOffsets="+json.dumps(remove,separators=(',',':'))+";\n for(const part of parts){const offsets=hiddenIndexOffsets[part.name];if(offsets){const hidden=new Set(offsets);part.indices=part.indices.filter((_,i)=>!hidden.has(i));}}\n"
  p.write_text(s.replace(anchor,addition+anchor));comparison=prior/'sources/a-no-receive-shadow'
 elif c['engine']=='a':
  p=dst/'scene.mjs';s=p.read_text();s="import { createExtrudeMeshAsset } from '/worker-modules/packages/render/dist/index.js';\n"+s
  anchor="export function constructScene(edit='baseline'){";assert s.count(anchor)==1;s=s.replace(anchor,outline+ahelper+'\n'+anchor)
  anchor=" return {schema:'aperture.crane-author-a.v1'";assert s.count(anchor)==1
  s=s.replace(anchor," const at=parts.findIndex(part=>isPlainBrickWall(part.name));\n const kept=parts.filter(part=>!isPlainBrickWall(part.name));\n kept.splice(at,0,continuousWallPart(p.opening_width));parts.splice(0,parts.length,...kept);\n"+anchor);p.write_text(s)
  p=dst/'worker.mjs';s=p.read_text();needle='mesh:mesh.triangleList({label:part.name,positions:part.positions,indices:part.indices})';assert s.count(needle)==1
  s=s.replace(needle,"mesh:part.extrusion?mesh.extrude({label:part.name,outline:part.extrusion.outline,depth:part.extrusion.depth}):mesh.triangleList({label:part.name,positions:part.positions,indices:part.indices}),...(part.extrusion?{transform:{translation:[0,0,part.extrusion.zOffset]}}:{})");p.write_text(s);comparison=src
 else:
  p=dst/'scene-data.mjs';s=p.read_text();s="import { Shape, ExtrudeGeometry } from '/three.core.js';\n"+s
  anchor="export function buildScene(edit='baseline') {";assert s.count(anchor)==1;s=s.replace(anchor,outline+bhelper+'\n'+anchor)
  anchor="  return { schema:'crane-three-author-b.v1'";assert s.count(anchor)==1
  s=s.replace(anchor,"  const at=meshes.findIndex(item=>isPlainBrickWall(item.name));\n  const kept=meshes.filter(item=>!isPlainBrickWall(item.name));\n  kept.splice(at,0,continuousWallMesh(p.opening_width));meshes.splice(0,meshes.length,...kept);\n"+anchor);p.write_text(s);comparison=src
 c['source_sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(dst.iterdir()) if p.is_file()}
 diffs=[]
 for p in sorted(dst.iterdir()):
  if p.is_file():diffs.extend(difflib.unified_diff((comparison/p.name).read_text().splitlines(True),p.read_text().splitlines(True),fromfile=f'comparator/{p.name}',tofile=f'{c["id"]}/{p.name}'))
 (base/f'{c["id"]}.diff').write_text(''.join(diffs))
(base/'cases.json').write_text(json.dumps(cases,indent=2)+'\n')
print('Prepared',len(cases),'cases.')
