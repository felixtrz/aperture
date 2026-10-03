#!/usr/bin/env python3
"""Write exclusive CPU/source-trace receipts. Never synthesizes native evidence."""
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parent;REPO=ROOT.parent.parent
log=ROOT/sys.argv[1]
lines=log.read_text().splitlines()
start=next(i for i,x in enumerate(lines) if x.startswith('# TOPOLOGY_CPU_SUMMARY '))
raw=lines[start].split('TOPOLOGY_CPU_SUMMARY ',1)[1]
for following in lines[start+1:]:
 try:
  summary=json.loads(raw);break
 except json.JSONDecodeError:
  assert following.startswith('# '), 'Unexpected split TAP stdout'
  raw+=following[2:]
else: summary=json.loads(raw)
assert '# fail 0' in lines and '# tests 22' in lines
summary.update(status='passed',tests=22,log=log.name,logSha256=hashlib.sha256(log.read_bytes()).hexdigest(),nativeStatus='unrun: separate admission required')
with (ROOT/'CPU_REPORT.json').open('x') as f:json.dump(summary,f,indent=2);f.write('\n')
traces=[
 ('packages/app/src/systems/meshes.ts',[(73,77),(100,115)],'meshes.publish resolves stable handle and registry.markReady returns actual asset version.'),
 ('packages/webgpu/src/resources/meshes/prepared-mesh-cache.ts',[(175,260),(325,351)],'Prepared layout keys include actual vertex/index counts and byte sizes. Changed topology may require a new resource; same-layout reuse is guarded.'),
 ('packages/webgpu/src/resources/meshes/mesh-buffer-descriptors.ts',[(109,151)],'GPU upload descriptors derive native vertex/index counts and byte lengths.'),
 ('shadow-lab/src/compare/three.webgpu.js',[(30702,30777),(30965,31013),(80128,80176),(80284,80294)],'New BufferAttributes create new GPU resources; existing attributes update fixed buffers. Geometry disposal deletes installed renderer attributes and destroys actual buffers. Replacement path avoids in-place attribute growth.'),
 ('benchmarks/crane-combined-edits-20261003/author-b/native-meshes.mjs',[(5,52)],'Inherited adapter shapeChanged branch replaces BufferGeometry/attributes, disposes old geometry, preserves Mesh.'),
 ('benchmarks/crane-combined-edits-20261003/author-a/scene-system.mjs',[(56,80)],'Inherited adapter uses meshes.publish with stable real entities and handles and counts publications.'),
]
entries=[]
for name,ranges,meaning in traces:
 raw=(REPO/name).read_bytes();text=raw.decode().splitlines()
 entries.append(dict(path=name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),meaning=meaning,excerpts=[dict(start=a,end=b,text='\n'.join(text[a-1:b])) for a,b in ranges]))
with (ROOT/'SOURCE_TRACE.json').open('x') as f:json.dump(dict(status='inspected',noEngineChanges=True,entries=entries),f,indent=2);f.write('\n')
print(json.dumps(dict(status='passed',tests=22,cpuStates=22,nativeStatus='unrun',reports=['CPU_REPORT.json','SOURCE_TRACE.json'])))
