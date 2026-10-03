/** CPU checks operate on generated indexed vertices, never reported bounds. */
import { constructScene, BASELINE, EDITS, add, sub, mul, dot, cross, norm, mean, assemblyPoint } from './scene.mjs';
const TOLERANCE=2e-5;
const distance=(a,b)=>Math.hypot(...sub(a,b));
const center=(part,ring)=>mean(ring.map(i=>part.positions[i]));
const endpoints=part=>[center(part,part.features.startRing),center(part,part.features.endRing)];
const byName=scene=>new Map(scene.parts.map(part=>[part.name,part]));
const same=(a,b)=>JSON.stringify([a.positions,a.indices,a.worldMatrix])===JSON.stringify([b.positions,b.indices,b.worldMatrix]);
function bound(part,axis,hi){return (hi?Math.max:Math.min)(...part.indices.map(i=>part.positions[i][axis]));}
function geometryPoint(q,p,crane=true){return assemblyPoint(add(q,[0,crane?p.top_tier_height-.18:0,0]),p);}
function changedScope(edit,name){
 if(edit==='assembly')return /^(crane|platform)\./.test(name);
 if(edit==='tier')return name==='platform.upper'||name.startsWith('crane.');
 if(edit==='arch')return /^wall\.(pier|upper-side|arch|spandrel)\./.test(name);
 if(edit==='pipe')return name.startsWith('pipe.');
 const hanging=/^crane\.(hoist|hook|load|sling)(\.|$)/.test(name);
 if(edit==='hoist')return hanging;
 const upper=name==='crane.boom.upper'||/^crane\.pin(-cap)?\.tip$/.test(name)||hanging;
 if(edit==='elbow')return upper;
 if(edit==='shoulder')return upper||name==='crane.boom.lower'||/^crane\.pin(-cap)?\.elbow$/.test(name)||/^crane\.hydraulic\.(body|rod|eye\.boom)$/.test(name);
 return false;
}
function intersectsZLine(part,x,y){
 for(let i=0;i<part.indices.length;i+=3){const [a,b,c]=part.indices.slice(i,i+3).map(j=>part.positions[j]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;if(u>1e-6&&v>1e-6&&u+v<1-1e-6)return true;}
 return false;
}
function pipeTopology(parts){const edgeCounts=new Map();for(const part of parts)for(let i=0;i<part.indices.length;i+=3){const p=part.indices.slice(i,i+3).map(j=>part.positions[j].join(','));for(let j=0;j<3;j++){const key=[p[j],p[(j+1)%3]].sort().join('|');edgeCounts.set(key,(edgeCounts.get(key)??0)+1);}}return {edges:edgeCounts.size,nonManifoldEdges:[...edgeCounts.values()].filter(n=>n!==2).length};}
export function inspectGeometry(edit='baseline'){
 const scene=constructScene(edit),baseline=constructScene(),parts=byName(scene),base=byName(baseline),p=scene.parameters,checks=[];
 function check(name,ok,actual=null,expected=null){checks.push({name,ok,actual,expected});}
 function near(name,actual,expected){check(name,distance(actual,expected)<=TOLERANCE,actual,expected);}
 function scalar(name,actual,expected){check(name,Math.abs(actual-expected)<=TOLERANCE,actual,expected);}
 const lower=endpoints(parts.get('crane.boom.lower')),upper=endpoints(parts.get('crane.boom.upper')),cable=endpoints(parts.get('crane.hoist.cable')),body=endpoints(parts.get('crane.hydraulic.body')),rod=endpoints(parts.get('crane.hydraulic.rod'));
 const P=[-2.15,1.25,.15],t=p.shoulder_deg*Math.PI/180,e=(p.shoulder_deg+p.elbow_deg)*Math.PI/180,E=add(P,[2.6*Math.cos(t),2.6*Math.sin(t),0]),T=add(E,[1.7*Math.cos(e),1.7*Math.sin(e),0]),H=add(T,[0,-p.hoist_length,0]),A=add(P,[.5,-.35,.3]),B=add(P,[.9*Math.cos(t),.9*Math.sin(t),.3]);
 near('shoulder-from-lower-boom',lower[0],geometryPoint(P,p));
 near('elbow-coincidence',lower[1],upper[0]);near('elbow-position',lower[1],geometryPoint(E,p));
 near('tip-and-cable',upper[1],cable[0]);near('tip-position',upper[1],geometryPoint(T,p));
 scalar('lower-boom-length',distance(...lower),2.6);scalar('upper-boom-length',distance(...upper),1.7);
 near('world-vertical-cable',sub(cable[1],cable[0]),[0,-p.hoist_length,0]);
 for(const [name,expected] of [['shoulder',lower[0]],['elbow',lower[1]],['tip',upper[1]]])near(`pin-${name}-coincidence`,mean(endpoints(parts.get(`crane.pin.${name}`))),expected);
 near('hydraulic-fixed-eye',body[0],geometryPoint(A,p));near('hydraulic-moving-eye',rod[1],geometryPoint(B,p));
 scalar('hydraulic-body-length',distance(...body),.64);scalar('hydraulic-overlap',distance(body[1],rod[0]),.12);
 scalar('hydraulic-coaxial',Math.hypot(...cross(norm(sub(body[1],body[0])),norm(sub(rod[1],rod[0])))),0);
 near('hydraulic-base-eye',mean(endpoints(parts.get('crane.hydraulic.eye.base'))),body[0]);near('hydraulic-boom-eye',mean(endpoints(parts.get('crane.hydraulic.eye.boom'))),rod[1]);
 const hook=parts.get('crane.hook');near('hook-top-meets-cable',center(hook,hook.features.rings[0]),cable[1]);
 near('load-centre',mean(parts.get('crane.load.body').positions),geometryPoint(add(H,[0,-.83,0]),p));
 let n=0;for(const x of [-1,1])for(const z of [-1,1]){const sling=endpoints(parts.get(`crane.sling.${n}`));near(`sling-${n}-apex`,sling[0],geometryPoint(add(H,[0,-.30,0]),p));near(`sling-${n}-load-trim-attachment`,sling[1],geometryPoint(add(H,[x*.39,-.562,z*.27]),p));n++;}
 const wall=[...parts.values()].filter(part=>/^wall\.(pier|upper-side|arch|spandrel)\./.test(part.name));
 check('through-wall-opening',[[1.173,.53],[1.229,1.095],[1.193,1.1+p.opening_width/2-.015]].every(([x,y])=>!wall.some(part=>intersectsZLine(part,x,y))));
 scalar('opening-left-jamb',bound(parts.get('wall.pier.left'),0,true),1.2-p.opening_width/2);scalar('opening-right-jamb',bound(parts.get('wall.pier.right'),0,false),1.2+p.opening_width/2);
 const arch=parts.get('wall.arch.05');scalar('opening-apex-from-inner-vertex',arch.positions[1][1],1.1+p.opening_width/2);
 scalar('arch-radial-ring-thickness',distance(arch.positions[0],arch.positions[3]),.20);
 const pipe=parts.get('pipe.hollow-elbow.outer'),or=pipe.features.outerRings,ir=pipe.features.innerRings,pc=or.map(ring=>center(pipe,ring));
 near('pipe-start-centre',pc[0],[.85,.24,1.72]);near('pipe-end-centre',pc[12],[.85+p.pipe_bend_radius,.24+p.pipe_bend_radius,1.72]);
 scalar('pipe-start-plane-x',Math.max(...or[0].map(i=>Math.abs(pipe.positions[i][0]-.85))),0);scalar('pipe-end-plane-y',Math.max(...or[12].map(i=>Math.abs(pipe.positions[i][1]-(.24+p.pipe_bend_radius)))),0);
 for(let i=0;i<13;i++){const t=i*Math.PI/24;near(`pipe-centre-${i}`,pc[i],[.85+p.pipe_bend_radius*Math.sin(t),.24+p.pipe_bend_radius*(1-Math.cos(t)),1.72]);for(const [label,rings,radius] of [['outer',or,.24],['inner',ir,.175]])scalar(`pipe-${label}-radius-${i}`,Math.max(...rings[i].map(j=>Math.abs(distance(pipe.positions[j],pc[i])-radius))),0);}
 const topology=pipeTopology(scene.parts.filter(part=>part.name.startsWith('pipe.')));check('pipe-closed-wall-manifold-with-open-bores',topology.nonManifoldEdges===0,topology);
 scalar('upper-tier-bottom',bound(parts.get('platform.upper'),1,false),.32);scalar('upper-tier-top',bound(parts.get('platform.upper'),1,true),.32+p.top_tier_height);
 scalar('crane-foot-contact',bound(parts.get('crane.foot'),1,false),.32+p.top_tier_height);
 for(const part of scene.parts){if(!changedScope(edit,part.name))check(`unchanged:${part.name}`,same(part,base.get(part.name)));for(let i=0;i<part.indices.length;i+=3){const [a,b,c]=part.indices.slice(i,i+3).map(j=>part.positions[j]);if(Math.hypot(...cross(sub(b,a),sub(c,a)))<=1e-12)check(`nondegenerate:${part.name}:${i/3}`,false);}}
 if(edit==='assembly')for(const part of scene.parts.filter(part=>part.group==='crane'||part.group==='platform')){const original=base.get(part.name);const max=Math.max(...part.positions.map((v,i)=>distance(v,assemblyPoint(original.positions[i],p))));check(`rigid-yaw-translation:${part.name}`,max<=TOLERANCE,max);}
 return {edit,tolerance:TOLERANCE,ok:checks.every(c=>c.ok),checks,partCount:scene.parts.length,triangleCount:scene.parts.reduce((n,part)=>n+part.indices.length/3,0)};
}
export function inspectAllEdits(){return Object.keys(EDITS).map(inspectGeometry);}
/** Decode exact native POSITION values after Aperture's mesh factory. */
export function decodeNativePositions(native){const stream=native.streams.find(s=>s.attributes.some(a=>a.semantic==='POSITION'));const attribute=stream.attributes.find(a=>a.semantic==='POSITION');const C={Float32Array,Uint16Array,Uint8Array}[stream.dataType],data=new C(stream.data),bytes=new DataView(data.buffer);return Array.from({length:stream.vertexCount},(_,i)=>[0,1,2].map(k=>bytes.getFloat32(i*stream.arrayStride+attribute.offset+k*4,true)));}
export function inspectNativeEvidence(evidence){return evidence.nativeMeshes.map(native=>{const part=evidence.scene.parts.find(p=>p.name===native.name),positions=decodeNativePositions(native),expected=part.indices.map(i=>part.positions[i]);return {name:native.name,ok:positions.length===expected.length&&positions.every((v,i)=>distance(v,expected[i])===0)&&JSON.stringify(native.worldMatrix)===JSON.stringify(part.worldMatrix),nativeVertices:positions.length};});}
