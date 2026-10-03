import { Shape, ExtrudeGeometry } from '/three.core.js';
/** Deterministic, renderer-independent construction. No reference assets are loaded. */
export const BASELINE = Object.freeze({
  shoulder_deg: 50, elbow_deg: -35, hoist_length: 1.5,
  opening_width: 1.6, pipe_bend_radius: 0.8, top_tier_height: 0.18,
  assembly_yaw_deg: 0, assembly_dx: 0, assembly_dz: 0,
});
export const EDITS = Object.freeze({
  baseline: {}, shoulder: { shoulder_deg: 65 }, elbow: { elbow_deg: -60 },
  hoist: { hoist_length: 1.9 }, arch: { opening_width: 2.1 },
  pipe: { pipe_bend_radius: 1.1 }, tier: { top_tier_height: 0.38 },
  assembly: { assembly_yaw_deg: 20, assembly_dx: 0.55, assembly_dz: 0.4 },
});
export const CAMERAS = Object.freeze({
  'front-quarter': { position: [8, 6.5, 10], target: [0, 1.4, 0], vertical_span: 10.5 },
  'rear-quarter': { position: [-8, 5, -9], target: [0, 1.4, 0], vertical_span: 10.5 },
  'high-oblique': { position: [6, 11, 5], target: [0, 1.4, 0], vertical_span: 10.5 },
});
export const PALETTE = Object.freeze({
  brick: { srgb: '#B4775D', roughness: .94, metallic: 0 },
  'brick-alt': { srgb: '#C78C6A', roughness: .91, metallic: 0 },
  cap: { srgb: '#DBB18B', roughness: .88, metallic: 0 },
  crane: { srgb: '#E1A330', roughness: .54, metallic: .12 },
  'crane-light': { srgb: '#F3C35C', roughness: .58, metallic: .08 },
  dark: { srgb: '#263944', roughness: .58, metallic: .1 },
  edge: { srgb: '#56646D', roughness: .88, metallic: 0 },
  ground: { srgb: '#78868B', roughness: .95, metallic: 0 },
  lamp: { srgb: '#FFE1A3', roughness: .35, metallic: 0 },
  pipe: { srgb: '#367F82', roughness: .58, metallic: .12 },
  'pipe-inside': { srgb: '#285458', roughness: .73, metallic: .05 },
  steel: { srgb: '#A5B6C0', roughness: .32, metallic: .55 },
  tier: { srgb: '#405C70', roughness: .72, metallic: .05 },
  'tier-light': { srgb: '#6D8694', roughness: .72, metallic: .05 },
  wood: { srgb: '#AF7950', roughness: .85, metallic: 0 },
  'wood-trim': { srgb: '#E4BF85', roughness: .85, metallic: 0 },
});
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a, 1 / Math.hypot(...a));
const radians = d => d * Math.PI / 180;
const range = n => Array.from({ length: n }, (_, i) => i);
const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

/** Faces are convex polygons, consistently outward-wound. Flat vertices are real GPU data. */
function mesh(name, group, vertices, faces, materials, markers = {}, matrix = identity()) {
  const positions = [], normals = [], indices = [], groups = [];
  const firstNative = new Map();
  for (const entry of faces) {
    const polygon = Array.isArray(entry) ? entry : entry.vertices;
    const materialIndex = Array.isArray(entry) ? 0 : (entry.materialIndex ?? 0);
    const n = unit(cross(sub(vertices[polygon[1]], vertices[polygon[0]]), sub(vertices[polygon[2]], vertices[polygon[0]])));
    const base = positions.length / 3;
    for (const vi of polygon) {
      if (!firstNative.has(vi)) firstNative.set(vi, positions.length / 3);
      positions.push(...vertices[vi]); normals.push(...n);
    }
    const start = indices.length;
    for (let j = 1; j + 1 < polygon.length; j++) indices.push(base, base+j, base+j+1);
    const previous = groups.at(-1);
    if (previous && previous.materialIndex === materialIndex) previous.count += indices.length - start;
    else groups.push({ start, count: indices.length-start, materialIndex });
  }
  const nativeMarkers = Object.fromEntries(Object.entries(markers).map(([key, ids]) => [key, ids.map(i => firstNative.get(i))]));
  return { name, group, positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint32Array(indices), materials: [...materials], groups, matrix: [...matrix], markers: nativeMarkers };
}

function box(name, group, center, size, material, matrix) {
  const [x,y,z] = center, [a,b,c] = size.map(v => v / 2);
  const vertices = [[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y+b,z-c],[x-a,y+b,z-c],
    [x-a,y-b,z+c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x-a,y+b,z+c]];
  return mesh(name, group, vertices,
    [[3,2,1,0],[4,5,6,7],[0,1,5,4],[7,6,2,3],[0,4,7,3],[2,6,5,1]], [material],
    { center: range(8), bottom: [0,1,4,5], top: [2,3,6,7] }, matrix);
}
function beam(name, a, b, thickness, depth, material, matrix) {
  const d = unit(sub(b,a)), v = [-d[1],d[0],0];
  const vertices = [];
  for (const p of [a,b]) for (const [s,z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) vertices.push(add(add(p, mul(v,s*thickness/2)),[0,0,z*depth/2]));
  return mesh(name, 'crane', vertices,
    [[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]], [material],
    { start: [0,1,2,3], end: [4,5,6,7] }, matrix);
}
function cylinder(name, group, a, b, radius, sides, material, matrix) {
  const t = unit(sub(b,a)), ref = Math.abs(t[2]) < .9 ? [0,0,1] : [1,0,0];
  const u = unit(sub(ref,mul(t,dot(t,ref)))), v = cross(t,u), vertices = [];
  for (const p of [a,b]) for (let j=0;j<sides;j++) {
    const angle = j*2*Math.PI/sides;
    vertices.push(add(p, add(mul(u,radius*Math.cos(angle)),mul(v,radius*Math.sin(angle)))));
  }
  const faces = [];
  for(let j=0;j<sides;j++) { const k=(j+1)%sides; faces.push([j,k,sides+k,sides+j]); }
  faces.push(range(sides).reverse(),range(sides).map(j=>j+sides));
  return mesh(name,group,vertices,faces,[material], { start:range(sides),end:range(sides).map(j=>j+sides) }, matrix);
}
function extrude(name, polygon, front, back, material, markers = {}) {
  const n=polygon.length;
  const vertices = [...polygon.map(([x,y])=>[x,y,front]),...polygon.map(([x,y])=>[x,y,back])];
  const faces = [range(n),range(n).reverse().map(j=>j+n)];
  for(let j=0;j<n;j++) { const k=(j+1)%n; faces.push([j+n,k+n,k,j]); }
  return mesh(name,'static',vertices,faces,[material],markers);
}
function hook(h, matrix) {
  const center=add(h,[0,-.17,0]), vertices=[], faces=[], segments=18,sides=8;
  for(let i=0;i<=segments;i++) {
    const a=Math.PI/2+(Math.PI*1.5)*i/segments;
    const p=add(center,[.17*Math.cos(a),.17*Math.sin(a),0]);
    for(let j=0;j<sides;j++) {
      const b=2*Math.PI*j/sides;
      vertices.push(add(p,[.045*Math.cos(b)*Math.cos(a),.045*Math.cos(b)*Math.sin(a),-.045*Math.sin(b)]));
    }
  }
  for(let i=0;i<segments;i++) for(let j=0;j<sides;j++) {
    const k=(j+1)%sides; faces.push([i*sides+j,i*sides+k,(i+1)*sides+k,(i+1)*sides+j]);
  }
  faces.push(range(sides).reverse(),range(sides).map(j=>segments*sides+j));
  return mesh('crane.hook','crane',vertices,faces,['steel'], {
    start:range(sides), end:range(sides).map(j=>segments*sides+j),
    bottom:range(sides).map(j=>12*sides+j),
  },matrix);
}
function pipe(radius, {curveSegments:segments, radialSegments:sides}) {
  const vertices=[],faces=[],ringCount=segments+1;
  for(const r of [.24,.175]) for(let i=0;i<=segments;i++) {
    const a=i*Math.PI/2/segments, p=[.85+radius*Math.sin(a),.24+radius*(1-Math.cos(a)),1.72];
    for(let j=0;j<sides;j++) {
      const b=j*2*Math.PI/sides;
      vertices.push(add(p,[-r*Math.cos(b)*Math.sin(a),r*Math.cos(b)*Math.cos(a),r*Math.sin(b)]));
    }
  }
  const offset=ringCount*sides;
  for(let i=0;i<segments;i++) for(let j=0;j<sides;j++) {
    const k=(j+1)%sides;
    const q=[i*sides+j,i*sides+k,(i+1)*sides+k,(i+1)*sides+j];
    faces.push({vertices:q, materialIndex:0});
  }
  for(let i=0;i<segments;i++) for(let j=0;j<sides;j++) {
    const k=(j+1)%sides;
    const q=[i*sides+j,i*sides+k,(i+1)*sides+k,(i+1)*sides+j];
    faces.push({vertices:q.reverse().map(v=>v+offset),materialIndex:1});
  }
  for(let j=0;j<sides;j++) {
    const k=(j+1)%sides, end=segments*sides;
    faces.push({vertices:[j,offset+j,offset+k,k],materialIndex:0});
    faces.push({vertices:[end+j,end+k,offset+end+k,offset+end+j],materialIndex:0});
  }
  const markers={};
  for(let i=0;i<ringCount;i++) {
    markers[`outer.${i}`]=range(sides).map(j=>i*sides+j);
    markers[`inner.${i}`]=range(sides).map(j=>offset+i*sides+j);
  }
  return mesh('pipe.hollow-elbow','static',vertices,faces,['pipe','pipe-inside'],markers);
}
function assemblyMatrix(p) {
  const a=radians(p.assembly_yaw_deg), c=Math.cos(a),s=Math.sin(a),px=-2.15,pz=.15;
  return [c,0,-s,0, 0,1,0,0, s,0,c,0,
    px-c*px-s*pz+p.assembly_dx,0,pz+s*px-c*pz+p.assembly_dz,1];
}

/** Calling with an edit always starts from the frozen baseline, never the last scene. */
function continuousWallProfile(width) {
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
const isPlainBrickWall = name => /^wall\.(pier|upper-side|spandrel)\./.test(name);
function continuousWallMesh(width) {
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

import { parametersFor, topologyFor } from '../contract.mjs';
export function buildScene(edit='baseline') {
  const p=parametersFor(edit), meshes=[], matrix=assemblyMatrix(p);
  const put=m=>{meshes.push(m);return m;};
  const lift=p.top_tier_height-.18, P=[-2.15,1.25+lift,.15];
  const theta=radians(p.shoulder_deg),alpha=radians(p.shoulder_deg+p.elbow_deg);
  const E=add(P,[2.6*Math.cos(theta),2.6*Math.sin(theta),0]);
  const T=add(E,[1.7*Math.cos(alpha),1.7*Math.sin(alpha),0]);
  const H=add(T,[0,-p.hoist_length,0]);
  const A=add(P,[.5,-.35,.3]),B=add(P,[.9*Math.cos(theta),.9*Math.sin(theta),.3]);
  const axis=unit(sub(B,A));
  put(box('courtyard.slab','static',[0,-.11,0],[7.9,.22,6],'ground'));
  put(box('platform.lower','platform',[-2.15,.08,.15],[3.05,.16,2.35],'edge',matrix));
  put(box('platform.middle','platform',[-2.15,.24,.15],[2.72,.16,2.02],'tier-light',matrix));
  put(box('platform.upper','platform',[-2.15,.32+p.top_tier_height/2,.15],[2.36,p.top_tier_height,1.65],'tier',matrix));
  const craneBox=(name,center,size,mat)=>put(box(name,'crane',add(center,[0,lift,0]),size,mat,matrix));
  craneBox('crane.foot',[-2.15,.56,.15],[.86,.12,.8],'dark');
  put(cylinder('crane.turntable','crane',[-2.15,.62+lift,.15],[-2.15,.77+lift,.15],.36,16,'steel',matrix));
  craneBox('crane.pedestal',[-2.15,.98,.15],[.46,.46,.46],'crane');
  craneBox('crane.counterweight',[-2.52,1.02,.15],[.46,.34,.64],'dark');
  put(beam('crane.boom.lower',P,E,.30,.36,'crane',matrix));
  put(beam('crane.boom.upper',E,T,.24,.29,'crane-light',matrix));
  for(const [name,point,r,d] of [['shoulder',P,.225,.68],['elbow',E,.175,.57],['tip',T,.135,.46]]) {
    put(cylinder(`crane.pin.${name}`,'crane',add(point,[0,0,-d/2]),add(point,[0,0,d/2]),r,12,'dark',matrix));
    put(cylinder(`crane.pin-cap.${name}`,'crane',add(point,[0,0,d/2]),add(point,[0,0,d/2+.045]),r*.54,12,'steel',matrix));
  }
  put(box('crane.hydraulic-mount','crane',A,[.25,.20,.20],'dark',matrix));
  put(cylinder('crane.hydraulic.body','crane',A,add(A,mul(axis,.64)),.09,12,'dark',matrix));
  put(cylinder('crane.hydraulic.rod','crane',add(A,mul(axis,.52)),B,.043,12,'steel',matrix));
  for(const [name,point] of [['base',A],['boom',B]]) put(cylinder(`crane.hydraulic.eye.${name}`,'crane',add(point,[0,0,-.12]),add(point,[0,0,.12]),.113,12,'crane',matrix));
  put(cylinder('crane.hoist.cable','crane',T,H,.025,8,'dark',matrix));
  put(hook(H,matrix));
  const crate=(name,center,size,group,transform)=>{
    const [w,h,d]=size;
    put(box(`${name}.body`,group,center,size,'wood',transform));
    for(const [i,s] of [[0,-1],[1,1]]) {
      const x=s*.39*w;
      put(box(`${name}.strap-front.${i}`,group,add(center,[x,0,d/2+.014]),[w*.085,h+.035,.034],'wood-trim',transform));
      put(box(`${name}.strap-back.${i}`,group,add(center,[x,0,-d/2-.014]),[w*.085,h+.035,.034],'wood-trim',transform));
      put(box(`${name}.strap-top.${i}`,group,add(center,[x,h/2+.018,0]),[w*.085,.035,d+.065],'wood-trim',transform));
    }
  };
  crate('crane.load',add(H,[0,-.83,0]),[1,.5,.72],'crane',matrix);
  let sling=0;
  for(const x of [-.39,.39]) for(const z of [-.27,.27]) put(cylinder(`crane.sling.${sling++}`,'crane',add(H,[0,-.30,0]),add(H,[x,-.562,z]),.018,8,'dark',matrix));

  const r=p.opening_width/2,ro=r+.20,cx=1.2,spring=1.1;
  put(box('wall.pier.left','static',[(-.6+cx-r)/2,spring/2,-2.05],[cx-r+.6,spring,.3],'brick'));
  put(box('wall.pier.right','static',[(cx+r+3)/2,spring/2,-2.05],[3-cx-r,spring,.3],'brick'));
  put(box('wall.upper-side.left','static',[(-.6+cx-ro)/2,1.85,-2.05],[cx-ro+.6,1.5,.3],'brick'));
  put(box('wall.upper-side.right','static',[(cx+ro+3)/2,1.85,-2.05],[3-cx-ro,1.5,.3],'brick'));
  for(let i=0;i<12;i++) {
    const a=Math.PI-i*Math.PI/12,b=Math.PI-(i+1)*Math.PI/12;
    const innerA=[cx+r*Math.cos(a),spring+r*Math.sin(a)],innerB=[cx+r*Math.cos(b),spring+r*Math.sin(b)];
    const outerA=[cx+ro*Math.cos(a),spring+ro*Math.sin(a)],outerB=[cx+ro*Math.cos(b),spring+ro*Math.sin(b)];
    const id=String(i).padStart(2,'0');
    put(extrude(`wall.arch.${id}`,[innerA,innerB,outerB,outerA],-1.888,-2.212,i%2?'brick-alt':'cap',
      {inner0:[0,4],inner1:[1,5],outer0:[3,7],outer1:[2,6]}));
    put(extrude(`wall.spandrel.${id}`,[outerA,outerB,[outerB[0],2.6],[outerA[0],2.6]],-1.9,-2.2,'brick'));
  }
  put(box('wall.cap','static',[1.2,2.66,-2.05],[3.78,.12,.42],'cap'));
  put(box('wall.lamp.backplate','static',[2.61,1.76,-1.85],[.22,.30,.06],'dark'));
  put(box('wall.lamp.diffuser','static',[2.61,1.76,-1.795],[.14,.20,.055],'lamp'));
  put(pipe(p.pipe_bend_radius,topologyFor(edit)));
  crate('prop.crate',[2.92,.32,.58],[.66,.64,.64],'static',identity());
  put(cylinder('prop.drum.body','static',[-3.16,0,2.05],[-3.16,.69,2.05],.29,12,'pipe'));
  for(const [i,y] of [[0,.10],[1,.59]]) put(cylinder(`prop.drum.band.${i}`,'static',[-3.16,y-.025,2.05],[-3.16,y+.025,2.05],.307,12,'steel'));
  put(cylinder('prop.bollard','static',[3.24,0,-1.12],[3.24,.65,-1.12],.105,12,'crane'));
  put(cylinder('prop.bollard.cap','static',[3.24,.55,-1.12],[3.24,.64,-1.12],.113,12,'dark'));
  const at=meshes.findIndex(item=>isPlainBrickWall(item.name));
  const kept=meshes.filter(item=>!isPlainBrickWall(item.name));
  kept.splice(at,0,continuousWallMesh(p.opening_width));meshes.splice(0,meshes.length,...kept);
  return { schema:'crane-three-author-b.v1',edit,parameters:p,cameras:CAMERAS,palette:PALETTE,meshes };
}
