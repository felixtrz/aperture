import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let state = 120517;
const rnd = () => { state = (Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
const rand=(a,b)=>a+(b-a)*rnd();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#83a9d2');
scene.fog = new THREE.Fog('#b5c5cf', 44, 95);
const camera = new THREE.PerspectiveCamera(37, 1024/768, .1, 200);
camera.position.set(14,9,19); camera.lookAt(0,2.5,1);
const renderer = new THREE.WebGPURenderer({ antialias:true, samples:4, forceWebGL:false });
renderer.setPixelRatio(1); renderer.setSize(1024,768);
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
document.body.style.cssText='margin:0;overflow:hidden;background:#b8cee2';
document.body.appendChild(renderer.domElement);
const hemi = new THREE.HemisphereLight('#dbe6f4','#958b6a',.65); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe0b0',3.05);
sun.position.set(-12,17,12); sun.target.position.set(-1,1,0);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-19; sun.shadow.camera.right=19; sun.shadow.camera.top=19; sun.shadow.camera.bottom=-19;
sun.shadow.camera.near=.5; sun.shadow.camera.far=60; sun.shadow.bias=-.0004; sun.shadow.normalBias=.045;
scene.add(sun,sun.target);
const materials = [];
function mat(color,roughness=.8,extra={}) { const m=new THREE.MeshStandardMaterial({color,roughness,...extra}); materials.push(m); return m; }
function noiseTexture(base,amplitude=20,size=256) {
 const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
 const d=ctx.createImageData(size,size),co=new THREE.Color(base).convertLinearToSRGB();
 const grid=Array.from({length:81},()=>rnd()-.5);
 for(let i=0;i<size*size;i++){ const xx=(i%size)/size*8,zz=Math.floor(i/size)/size*8,gx=Math.floor(xx),gz=Math.floor(zz),tx=xx-gx,tz=zz-gz;
 const lo=(grid[gz*9+gx]*(1-tx)+grid[gz*9+gx+1]*tx)*(1-tz)+(grid[(gz+1)*9+gx]*(1-tx)+grid[(gz+1)*9+gx+1]*tx)*tz;
 const n=((rnd()-.5)*.7+lo*.8)*amplitude; d.data[i*4]=Math.min(255,co.r*255+n); d.data[i*4+1]=Math.min(255,co.g*255+n); d.data[i*4+2]=Math.min(255,co.b*255+n); d.data[i*4+3]=255; }
 ctx.putImageData(d,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t;
}
function textured(color,roughness,repeat,amplitude=20) { const t=noiseTexture(color,amplitude); t.repeat.set(...repeat); return mat('#ffffff',roughness,{map:t,bumpMap:t,bumpScale:.025}); }
const stucco=textured('#e9ddc2',.95,[3,3],18);
const stone=textured('#d1c7b8',.96,[2,2],38);
const sandstone=textured('#c5b9a2',.92,[1,1],25);
const dark=mat('#252c2b',.65);
const gutter=mat('#403b31',.7,{metalness:.35});
const terracotta=textured('#bd744c',.94,[1,1],36);
const mortar=mat('#a69b8c',1);
const wood=textured('#74553a',.87,[1,3],30);
const asphalt=textured('#686662',.96,[10,10],50);
asphalt.bumpScale=.018;
const grass=textured('#627c35',1,[25,25],46); grass.bumpScale=.04;
const concrete=textured('#c2b8a6',1,[3,3],26);
const black=mat('#101819',.75);
const glass=mat('#354b57',.22,{metalness:.22});
const reflectGlass=mat('#77919c',.26,{metalness:.3});
const curtain=mat('#c3b6a1',1);
const blue=new THREE.MeshPhysicalMaterial({color:'#1b5c95',roughness:.24,metalness:.42,clearcoat:.8,clearcoatRoughness:.16,envMapIntensity:1.7});materials.push(blue);
const chrome=mat('#a5b0b1',.28,{metalness:.85});
const tire=mat('#171a1b',.98);
const lamp=mat('#f7e8bd',.25,{emissive:'#d4b56f',emissiveIntensity:.15});
const red=mat('#9b2721',.24,{metalness:.1});
const greenMats=['#4a6229','#657739','#7b8443','#394f24'].map(c=>mat(c,.92));
const lavender=mat('#807093',.9);
const geometries=[];let authorMeshSerial=0;
function add(geo,material,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0],parent=scene) {
 const m=new THREE.Mesh(geo,material);m.name='authored-mesh-'+(++authorMeshSerial); m.position.set(...pos); m.scale.set(...scale); m.rotation.set(...rot);
 m.castShadow=true; m.receiveShadow=true; parent.add(m); geometries.push(geo); return m;
}
const boxGeo = new THREE.BoxGeometry(1,1,1);
const roundGeo = new RoundedBoxGeometry(1,1,1,2,.08);
const sphereGeo = new THREE.IcosahedronGeometry(1,1);
function box(material,pos,size,rot=[0,0,0],parent=scene) { return add(boxGeo,material,pos,size,rot,parent); }
function rounded(material,pos,size,rot=[0,0,0],parent=scene) { return add(roundGeo,material,pos,size,rot,parent); }
function ball(material,pos,size,parent=scene){return add(sphereGeo,material,pos,size,[0,0,0],parent);}
function tube(a,b,r,material,parent=scene,sides=8,r2=r) {
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
 const m=add(new THREE.CylinderGeometry(r2,r,v.length(),sides,1),material,av.clone().add(bv).multiplyScalar(.5).toArray(),[1,1,1],[0,0,0],parent);
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()); return m;
}
function batch(geo,material,list,parent=scene,colors=null) {
 const m=new THREE.InstancedMesh(geo,material,list.length);m.name='authored-mesh-'+(++authorMeshSerial); const temp=new THREE.Object3D();
 list.forEach((t,i)=>{temp.position.set(...t.p);temp.scale.set(...(t.s||[1,1,1]));temp.rotation.set(...(t.r||[0,0,0]));temp.updateMatrix();m.setMatrixAt(i,temp.matrix); if(colors)m.setColorAt(i,colors[i]);});
 m.castShadow=true;m.receiveShadow=true; m.instanceMatrix.needsUpdate=true; if(colors)m.instanceColor.needsUpdate=true; parent.add(m); geometries.push(geo); return m;
}
function poly(points,material,parent=scene) {
 const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
 const idx=[];for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);g.setIndex(idx);g.computeVertexNormals(); return add(g,material,[0,0,0],[1,1,1],[0,0,0],parent);
}
function outline(points,r,material,parent=scene) {
 for(let i=0;i<points.length-1;i++)tube(points[i],points[i+1],r,material,parent,6);
}

// The garden and road use a continuous curved plan rather than a straight slab.
box(grass,[0,-.18,-10],[110,.35,115]);
const roadCurve=new THREE.CatmullRomCurve3([
 new THREE.Vector3(-19,.025,9.5),new THREE.Vector3(-10,.025,9.4),new THREE.Vector3(-2,.025,9.1),
 new THREE.Vector3(4,.025,8.5),new THREE.Vector3(8,.025,6.4),new THREE.Vector3(10.4,.025,2),
 new THREE.Vector3(10.8,.025,-5),new THREE.Vector3(10.3,.025,-14)
]);
function strip(curve,left,right,material,segments=140,y=.025) {
 const p=[],uv=[],ix=[];
 for(let i=0;i<=segments;i++){const t=i/segments,v=curve.getPoint(t),tan=curve.getTangent(t),n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
 for(const offset of [left,right]){p.push(v.x+n.x*offset,y,v.z+n.z*offset);uv.push(t*24,offset);}
 if(i<segments){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
 const m=add(g,material);m.receiveShadow=true;return m;
}
strip(roadCurve,-2.15,2.15,asphalt);
strip(roadCurve,-3.35,-2.17,concrete,140,.10);
strip(roadCurve,2.18,2.58,concrete,140,.075);
const curbList=[],curbColors=[];
for(let i=0;i<100;i++){
 const t=(i+.5)/100,p=roadCurve.getPoint(t),tan=roadCurve.getTangent(t),n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
 for(const off of [-2.18,2.18]){curbList.push({p:[p.x+n.x*off,.105,p.z+n.z*off],s:[.48,.19,.22],r:[0,Math.atan2(-tan.z,tan.x),0]});curbColors.push(new THREE.Color().setHSL(.10,.13,rand(.52,.64)));}
}
batch(roundGeo,concrete,curbList,scene,curbColors);
const marks=[]; for(let i=0;i<29;i++){const t=(i+.5)/29,p=roadCurve.getPoint(t),tan=roadCurve.getTangent(t); marks.push({p:[p.x,.033,p.z],s:[.91,.012,.12],r:[0,Math.atan2(-tan.z,tan.x),0]});}
batch(boxGeo,mat('#dedbd0',.9),marks);

// Continuous masonry with true window and door apertures.
const houseStart=scene.children.length;
const house={x:-2,z:-2,w:8,d:6.2,y:6.13};
box(stone,[-2,.18,-2],[8.13,.36,6.33]);
function wallGrid(axis,plane,u0,u1,y0,y1,openings) {
 const us=[u0,u1],ys=[y0,y1];
 for(const o of openings){us.push(o.u-o.w/2,o.u+o.w/2);ys.push(o.y-o.h/2,o.y+o.h/2);}
 us.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
 for(let i=0;i<us.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const u=(us[i]+us[i+1])/2,y=(ys[j]+ys[j+1])/2,du=us[i+1]-us[i],dy=ys[j+1]-ys[j];
  if(du<.001||dy<.001||openings.some(o=>Math.abs(u-o.u)<o.w/2-.001&&Math.abs(y-o.y)<o.h/2-.001))continue;
  if(axis==='z')box(stucco,[u,y,plane],[du,dy,.26]);else box(stucco,[plane,y,u],[.26,dy,du]);
 }
}
const frontOpen=[
 {u:-4.75,y:1.63,w:1.18,h:1.55},{u:.55,y:1.63,w:1.13,h:1.55},
 {u:-4.55,y:4.5,w:1.5,h:1.65},{u:.10,y:4.5,w:1.6,h:1.65},
 {u:-1.15,y:1.38,w:1.1,h:2.35}
];
wallGrid('z',1.1,-6,2,.35,6.13,frontOpen);
const sideOpen=[{u:-.12,y:1.65,w:.9,h:1.6},{u:-3.43,y:1.65,w:.83,h:1.6},{u:-.13,y:4.5,w:.88,h:1.6},{u:-3.4,y:4.5,w:.8,h:1.6}];
wallGrid('x',2,-5.1,1.1,.35,6.13,sideOpen);
const leftOpen=[{u:-.3,y:1.6,w:1.03,h:1.5},{u:-3.5,y:4.4,w:1.14,h:1.6}];
wallGrid('x',-6,-5.1,1.1,.35,6.13,leftOpen);
const backOpen=[{u:-4.6,y:4.5,w:1.4,h:1.6},{u:.25,y:4.5,w:1.4,h:1.6},{u:-4.5,y:1.6,w:1.2,h:1.5},{u:.4,y:1.6,w:1.2,h:1.5}];
wallGrid('z',-5.1,-6,2,.35,6.13,backOpen);
const gablemat=stucco.clone(); gablemat.side=THREE.DoubleSide;
for(const x of [-6,2]) poly([[x,6.13,1.1],[x,8.04,-2],[x,6.13,-5.1]],gablemat);
function windowAt(axis,plane,u,y,w,h,sign=1){
 const group=new THREE.Group(); scene.add(group);
 group.position.set(axis==='z'?u:plane,y,axis==='z'?plane:u);
 if(axis==='x')group.rotation.y=sign>0?Math.PI/2:-Math.PI/2;else if(sign<0)group.rotation.y=Math.PI;
 // Interior back face, reveal and individual panes.
 box(dark,[0,0,-.105],[w,h,.07],[0,0,0],group);
 box(curtain,[-w*.25,0,-.064],[w*.25,h*.92,.025],[0,0,0],group);
 box(curtain,[w*.29,0,-.065],[w*.19,h*.92,.025],[0,0,0],group);
 for(const side of [-1,1])box(glass,[side*w*.235,0,-.039],[w*.43,h*.89,.025],[0,0,0],group);
 for(const x of [-w/2+.035,0,w/2-.035])box(dark,[x,0,.016],[.066,h,.073],[0,0,0],group);
 for(const yy of [-h/2+.035,0,h/2-.035])box(dark,[0,yy,.016],[w,.061,.073],[0,0,0],group);
 box(sandstone,[0,-h/2-.065,.03],[w+.23,.11,.30],[0,0,0],group);
 box(stucco,[0,h/2+.025,-.10],[w+.08,.06,.24],[0,0,0],group);
 box(reflectGlass,[-w*.23,h*.15,-.019],[w*.055,h*.55,.006],[0,0,-.04],group);
 box(reflectGlass,[w*.23,h*.20,-.019],[w*.13,h*.50,.006],[0,0,-.07],group);
}
frontOpen.slice(0,4).forEach(o=>windowAt('z',1.1,o.u,o.y,o.w,o.h));
sideOpen.forEach(o=>windowAt('x',2,o.u,o.y,o.w,o.h));
leftOpen.forEach(o=>windowAt('x',-6,o.u,o.y,o.w,o.h,-1));
backOpen.forEach(o=>windowAt('z',-5.1,o.u,o.y,o.w,o.h,-1));
// A paneled entry door sits behind its stucco reveals.
const door=mat('#384246',.8);
box(door,[-1.15,1.36,1.038],[1.04,2.30,.095]);
for(const x of [-1.39,-.91])for(const y of [.82,1.8]){
 box(dark,[x,y,1.10],[.36,.75,.022]);
 box(door,[x,y,1.117],[.29,.67,.018]);
}
box(chrome,[-1.56,1.4,1.166],[.025,.15,.04]);ball(mat('#a58b49',.35,{metalness:.7}),[-1.53,1.42,1.185],[.03,.03,.025]);
box(sandstone,[-1.15,.29,1.1],[1.25,.10,.44]);

// Barrel tiles are individually modelled and instanced with warm variation.
function tileGeometry(length=.43,radius=.108){
 const p=[],uv=[],idx=[];
 for(let j=0;j<=2;j++)for(let i=0;i<=8;i++){const theta=i/8*Math.PI,rr=radius*(.94+.06*j/2);p.push(Math.cos(theta)*rr,Math.sin(theta)*rr,j/2*length);uv.push(i/8,j/2);}
 for(let j=0;j<2;j++)for(let i=0;i<8;i++){let a=j*9+i;idx.push(a,a+9,a+1,a+1,a+9,a+10);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const tileGeo=tileGeometry(), tileMat=terracotta.clone();tileMat.side=THREE.DoubleSide;
const tiles=[],tileColors=[];
const slope=1.96/3.60,angle=Math.atan(slope);
for(const side of [-1,1]){
 const front=side===1;
 box(terracotta,[-2,7.08,-2+side*1.82],[8.78,.16,4.12],[front?angle:-angle,0,0]);
 for(let col=0;col<41;col++)for(let row=0;row<11;row++){
  const z=-2+side*(.01+row*.34),y=8.09-Math.abs(z+2)*slope;
  tiles.push({p:[-6.38+col*.216,y,z],r:[front?angle:-angle,0,0]});
  tileColors.push(new THREE.Color().setHSL(rand(.045,.075),rand(.40,.53),rand(.41,.55)));
 }
}
batch(tileGeo,tileMat,tiles,scene,tileColors);
const lipPositions=[],lipIndices=[];
for(let j=0;j<2;j++)for(let i=0;i<=8;i++){const a=i/8*Math.PI,rr=j===0?.114:.098;lipPositions.push(Math.cos(a)*rr,Math.sin(a)*rr,.43);}
for(let i=0;i<8;i++)lipIndices.push(i,i+1,i+9,i+1,i+10,i+9);
const lipGeo=new THREE.BufferGeometry();lipGeo.setAttribute('position',new THREE.Float32BufferAttribute(lipPositions,3));lipGeo.setIndex(lipIndices);lipGeo.computeVertexNormals();
batch(lipGeo,mat('#865033',.96,{side:THREE.DoubleSide}),tiles);

for(const z of [1.65,-5.65]){
 box(gutter,[-2,6.14,z],[8.85,.13,.13]);
 box(wood,[-2,6.23,z-.03],[8.88,.16,.16]);
}
for(const x of [-6.4,2.4]){
 outline([[x,6.13,1.64],[x,8.17,-2],[x,6.13,-5.64]],.075,wood);
}
const ridge=[];for(let i=0;i<29;i++)ridge.push({p:[-6.4+i*.305,8.11,-2],s:[1.37,1.37,.82],r:[0,Math.PI/2,0]});batch(tileGeo,tileMat,ridge);
for(const x of [-5.83,1.89]){
 outline([[x,6.15,1.66],[x,5.97,1.66],[x,5.78,1.25],[x,.35,1.25]],.052,gutter);
 tube([x,.35,1.25],[x,.29,1.55],.052,gutter);
 for(const y of [1.0,3.1,5.2])box(gutter,[x,y,1.29],[.14,.055,.05]);
}
// Chimney with open ventilated cowl.
box(stucco,[.27,8.37,-2.80],[.68,1.45,.74]);
box(sandstone,[.27,8.98,-2.8],[.80,.12,.86]);
for(const x of [-.01,.55])for(const z of [-3.10,-2.50])box(stucco,[x,9.22,z],[.10,.42,.1]);
box(dark,[.27,9.10,-2.8],[.57,.025,.58]);
box(terracotta,[.27,9.45,-2.8],[.99,.14,.99]);
poly([[-.25,9.5,-3.3],[.27,9.70,-3.3],[.79,9.5,-3.3]],tileMat);
poly([[-.25,9.5,-2.3],[.79,9.5,-2.3],[.27,9.70,-2.3]],tileMat);
poly([[-.25,9.5,-3.3],[-.25,9.5,-2.3],[.27,9.70,-2.3],[.27,9.70,-3.3]],tileMat);
poly([[.27,9.70,-3.3],[.27,9.70,-2.3],[.79,9.5,-2.3],[.79,9.5,-3.3]],tileMat);
// Covered porch and two square columns.
box(concrete,[-1.10,.16,2.18],[5.65,.31,2.44]);
box(sandstone,[-1.10,.12,3.48],[3.25,.24,.45]);
box(sandstone,[-1.10,.055,3.76],[2.65,.11,.43]);
for(const x of [-3.6,1.38]){
 box(stucco,[x,1.57,3.04],[.34,2.59,.36]);
 box(sandstone,[x,.39,3.04],[.48,.22,.49]);
 box(sandstone,[x,2.80,3.04],[.51,.19,.48]);
 box(stucco,[x,2.98,2.97],[.58,.17,.48]);
}
box(wood,[-1.1,2.90,3.05],[5.64,.25,.24]);
const porchSlope=.36/2.47,pa=Math.atan(porchSlope);
box(terracotta,[-1.1,3.23,2.22],[5.97,.15,2.62],[pa,0,0]);
const porchTiles=[],porchColors=[];
for(let c=0;c<28;c++)for(let r=0;r<7;r++){const z=1.0+r*.37;porchTiles.push({p:[-4.04+c*.216,3.43-(z-1)*porchSlope,z],r:[pa,0,0]});porchColors.push(new THREE.Color().setHSL(rand(.045,.07),.48,rand(.43,.54)));}
batch(tileGeo,tileMat,porchTiles,scene,porchColors);batch(lipGeo,mat('#8e5837',.96,{side:THREE.DoubleSide}),porchTiles);
box(gutter,[-1.1,3.035,3.58],[6.05,.10,.12]);
for(const x of [-4.12,1.92])outline([[x,3.08,3.59],[x,3.47,.96]],.062,wood);
// Entry lantern.
tube([-2.17,2.28,1.27],[-2.17,2.40,1.57],.024,black);
box(black,[-2.17,2.18,1.56],[.19,.30,.19]);
box(lamp,[-2.17,2.19,1.56],[.13,.23,.13]);
add(new THREE.ConeGeometry(.17,.17,4),black,[-2.17,2.40,1.56],[1,1,1],[0,Math.PI/4,0]);

// Irregular stone paving, laid in a mortar bed.
const houseGroup=new THREE.Group();
for(const o of scene.children.slice(houseStart))houseGroup.add(o);
houseGroup.scale.set(1.08,1,.96);houseGroup.position.set(-.35,0,-.76);scene.add(houseGroup);
stucco.bumpScale=.065;terracotta.bumpScale=.04;

const paveMats=['#b4b0a3','#bcb6a5','#a8aaa1','#c2b8a2'].map(c=>textured(c,.98,[1.5,1.5],38));
function pavingStone(cx,cz,w,d,y=.075) {
 const points=[[-w*.47,-d*.34],[-w*.30,-d*.49],[w*.35,-d*.46],[w*.49,-d*.23],[w*.45,d*.36],[w*.25,d*.49],[-w*.38,d*.44],[-w*.49,d*.22]].map(p=>new THREE.Vector2(p[0]*rand(.94,1.04),p[1]*rand(.95,1.05)));
 const sh=new THREE.Shape(points);const g=new THREE.ExtrudeGeometry(sh,{depth:.08,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.016,bevelThickness:.016});
 const m=add(g,paveMats[Math.floor(rnd()*paveMats.length)],[cx,y,cz],[1,1,1],[-Math.PI/2,0,rand(-.055,.055)]); return m;
}
box(mortar,[-2.02,.025,4.37],[1.67,.08,2.97],[0,-.29,0]);
for(let row=0;row<8;row++)for(let col=0;col<3;col++){
 const z=2.93+row*.40,cx=-1.59+(z-2.93)/2.8*(-.86),x=cx+(col-1)*.48;
 pavingStone(x,z,.45,.38);
}
box(mortar,[3.86,.024,-.25],[4.15,.09,6.9]);
for(let row=0;row<15;row++)for(let col=0;col<7;col++)pavingStone(2.08+col*.58+(row%2)*.10,-3.5+row*.46,.55,.43,.067);

// Low garden boundary with staggered blocks, stone coping and pillars.
const wallStones=[],stoneColors=[],caps=[];
function stoneWall(a,b,height=1.02){
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),len=av.distanceTo(bv),dir=bv.clone().sub(av).normalize(),yaw=Math.atan2(-dir.z,dir.x);
 box(mortar,av.clone().add(bv).multiplyScalar(.5).setY(height/2).toArray(),[len,height,.38],[0,yaw,0]);
 const count=Math.ceil(len/.67),bw=len/count;
 for(let r=0;r<3;r++)for(let c=0;c<count;c++){
  const shift=(r%2)*bw*.45,t=(c+.5)*bw+shift;
  if(t>len-.1)continue;const p=av.clone().addScaledVector(dir,t);
  wallStones.push({p:[p.x,.18+r*.30+rand(-.018,.018),p.z+rand(-.015,.015)],s:[bw-rand(.015,.043),rand(.259,.282),.415],r:[0,yaw,0]});stoneColors.push(new THREE.Color().setHSL(.095,rand(.07,.15),rand(.59,.79)));
 }
 for(let c=0;c<count;c++){const p=av.clone().addScaledVector(dir,(c+.5)*bw);caps.push({p:[p.x,1.015,p.z],s:[bw-.012,.13,.49],r:[0,yaw,0]});}
}
stoneWall([-10,0,5.73],[-3.45,0,5.73]);stoneWall([-1.48,0,5.73],[4.87,0,5.73]);
stoneWall([4.87,0,5.73],[6.75,0,4.93]);stoneWall([6.75,0,4.93],[7.73,0,3.48]);
stoneWall([7.73,0,3.48],[8.16,0,1.43]);stoneWall([8.16,0,1.43],[8.22,0,-4.8]);
const rubbleGeo=roundGeo.clone();const rv=rubbleGeo.getAttribute('position');
for(let i=0;i<rv.count;i++){const x=rv.getX(i),y=rv.getY(i),z=rv.getZ(i);rv.setXYZ(i,x+.018*Math.sin(y*13+z*19),y+.018*Math.sin(x*15+z*21),z+.014*Math.sin(x*27+y*17));}rv.needsUpdate=true;rubbleGeo.computeVertexNormals();
batch(rubbleGeo,stone,wallStones,scene,stoneColors);batch(roundGeo,sandstone,caps);
for(const x of [-3.45,-1.48,5.2]){
 box(mortar,[x,.75,5.74],[.59,1.5,.60]);
 for(let r=0;r<5;r++)rounded(stone,[x,.16+r*.286,5.74],[.62,.27,.63]);
 box(sandstone,[x,1.52,5.74],[.79,.15,.79]);
}
// Mailbox on its own slender post beside the garden entrance.
box(dark,[-3.08,.81,5.18],[.095,1.62,.095]);
rounded(mat('#424443',.65),[-3.08,1.56,5.17],[.41,.39,.45]);
add(new THREE.CylinderGeometry(.205,.205,.44,12,1,false,0,Math.PI),dark,[-3.08,1.69,5.17],[1,1,1],[Math.PI/2,0,0]);
box(black,[-3.08,1.59,5.405],[.18,.031,.008]);
box(sandstone,[-3.08,1.49,5.415],[.12,.052,.008]);
// Cedar side gate.
for(let i=0;i<16;i++)box(wood,[6.65+i*.093,1.01,-3.96],[.078,1.88,.14]);
for(const y of [.3,1.55])box(wood,[7.36,y,-3.91],[1.61,.13,.16]);
for(const x of [6.54,8.17])box(stone,[x,1.05,-3.96],[.30,2.1,.31]);

// Garden plants: branching olive trees, small-leaved shrubs and lavender.
const bark=mat('#63543e',.94);
const leafGeo=new THREE.BufferGeometry();
leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,-.03,0,-.05,0,.012,-.035,.09,0,0,.17,.008,.035,.09,0,.05,0,.012,0,-.03,.005],3));
leafGeo.setIndex([0,1,2,0,2,3,0,3,4,0,4,5,0,5,6]);leafGeo.computeVertexNormals();
const leafMat=mat('#ffffff',.95,{side:THREE.DoubleSide});
const leaves=[],leafColors=[];
function olive(x,z,height=3.6,crown=1.5){
 const trunkTop=[x+.19,height*.58,z-.08];
 tube([x,.02,z],[x-.1,height*.33,z+.1],.14,bark,scene,9,.11);
 tube([x-.1,height*.33,z+.1],trunkTop,.11,bark,scene,8,.072);
 const centres=[];
 for(let i=0;i<10;i++){
  const az=i/10*Math.PI*2+rand(-.3,.3),rr=crown*rand(.38,.8);
  const c=[x+Math.cos(az)*rr,height*.66+rand(0,height*.18),z+Math.sin(az)*rr];
  tube(trunkTop,c,.056,bark,scene,7,.020);centres.push(c);
  const tip=[c[0]+Math.cos(az)*crown*.18,c[1]+.28,c[2]+Math.sin(az)*crown*.2];tube(c,tip,.018,bark,scene,5,.006);
 }
 for(let i=0;i<4000;i++){
  const c=centres[i%centres.length],az=rand(0,Math.PI*2),u=rand(-1,1),r=Math.cbrt(rnd())*crown*.54,ss=Math.sqrt(1-u*u);
  leaves.push({p:[c[0]+Math.cos(az)*r*ss,c[1]+u*r*.64,c[2]+Math.sin(az)*r*ss],s:[rand(.65,1.2),rand(.7,1.35),1],r:[rand(-1.2,1.2),rand(0,Math.PI*2),rand(-Math.PI,Math.PI)]});
  leafColors.push(new THREE.Color().setHSL(rand(.20,.27),rand(.25,.42),rand(.14,.29)));
 }
}
olive(-8.18,2.3,4.1,2.0);olive(-8.65,-5.4,3.4,1.55);olive(5.22,-3.9,3.5,1.4);olive(5.1,-.55,3.0,1.2);
batch(leafGeo,leafMat,leaves,scene,leafColors);
const shrubs=[[],[],[],[]],flowers=[];
function bush(x,z,r=.45,h=.55){
 for(let i=0;i<80;i++){const a=rand(0,Math.PI*2),rr=Math.sqrt(rnd())*r,y=rand(.12,h);
 shrubs[i%4].push({p:[x+Math.cos(a)*rr,y,z+Math.sin(a)*rr],s:[rand(.055,.095),rand(.055,.08),rand(.055,.095)],r:[rand(0,3),rand(0,3),rand(0,3)]});}
}
for(let i=0;i<32;i++)bush(-9.5+i*.18,5.1,rand(.33,.45),rand(.45,.75));
for(let i=0;i<29;i++)bush(-1.0+i*.19,5.13,.34,.55);
for(let i=0;i<25;i++)bush(7.53,3.6-i*.31,.44,.70);
for(const [x,z,r]of[[-5.0,1.72,.7],[-3.55,2.25,.45],[1.2,2.13,.58],[2.64,-.5,.55],[2.58,-3.4,.56],[-7.3,3.0,.58],[-6.9,-1.7,.7]])bush(x,z,r,.62);
for(const [x,z] of[[-4.1,2.73],[-.0,3.08],[3.08,1.25],[5.87,4.27],[-7.2,4.0]]) {
 bush(x,z,.30,.35);
 for(let i=0;i<45;i++){const a=rand(0,Math.PI*2),r=rand(0,.38),xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,yy=rand(.35,.75);
 tube([xx,.1,zz],[xx,yy,zz],.006,greenMats[1],scene,4);flowers.push({p:[xx,yy,zz],s:[.042,.085,.045]});}
}
shrubs.forEach((list,i)=>batch(sphereGeo,greenMats[i],list));batch(sphereGeo,lavender,flowers);
const shrubLeaves=[],shrubLeafColors=[];
for(const list of shrubs)for(const t of list)for(let k=0;k<3;k++){
 shrubLeaves.push({p:[t.p[0]+rand(-.08,.08),t.p[1]+rand(-.02,.08),t.p[2]+rand(-.08,.08)],s:[.45,.60,.6],r:[rand(-1.2,1.2),rand(0,6.3),rand(0,6.3)]});
 shrubLeafColors.push(new THREE.Color().setHSL(rand(.20,.27),rand(.32,.55),rand(.11,.24)));
}
batch(leafGeo,leafMat,shrubLeaves,scene,shrubLeafColors);
// Terracotta pots with inset dark soil and twigged plants.
function pot(x,z,r=.30,h=.46){
 add(new THREE.CylinderGeometry(r,r*.69,h,14),terracotta,[x,h/2+.26,z]);
 add(new THREE.TorusGeometry(r,.025,6,18),terracotta,[x,h+.26,z],[1,1,1],[Math.PI/2,0,0]);
 add(new THREE.CylinderGeometry(r*.88,r*.88,.02,14),mat('#40392a',1),[x,h+.249,z]);
 tube([x,h+.25,z],[x+.04,h+1.0,z],.023,bark);
 for(let i=0;i<5;i++){const a=i*1.25; tube([x,h+.65,z],[x+Math.cos(a)*.29,h+.90,z+Math.sin(a)*.29],.012,bark,scene,5);}
 for(let i=0;i<35;i++){const a=rand(0,Math.PI*2),rr=rand(0,.34);ball(greenMats[i%4],[x+Math.cos(a)*rr,h+.8+rand(-.1,.32),z+Math.sin(a)*rr],[.12,.08,.13]);}
}
pot(-2.82,2.23,.28,.43);pot(.15,2.55,.24,.36);pot(2.2,2.39,.32,.5);
// Fine grass accents around the wall and tree base.
const bladeGeo=new THREE.BufferGeometry();
bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.02,0,0,.02,0,0,.014,.18,.016,0,.26,.03,0,0,-.02,0,0,.02,.025,.18,.01,.035,.24,0],3));
bladeGeo.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);bladeGeo.computeVertexNormals();
const blades=[];for(let i=0;i<1450;i++){const x=rand(-10,7),z=rand(1.7,5.58);if(Math.abs(x-(-2.3+(5.5-z)*.18))<.90||x>2.1&&z<4.4)continue;blades.push({p:[x,.0,z],s:[rand(.5,1.0),rand(.3,.85),rand(.5,1.0)],r:[0,rand(0,6.3),0]});}
batch(bladeGeo,mat('#77823f',1,{side:THREE.DoubleSide}),blades);
// Slender cypress trees add the vertical shapes seen behind the house.
function cypress(x,z,h){
 tube([x,.1,z],[x,h*.8,z],.085,bark);
 for(let i=0;i<7;i++){const y=.8+i*h*.115,r=(1-i/8)*.52;ball(greenMats[i%4],[x+rand(-.05,.05),y,z+rand(-.05,.05)],[r,h*.20,r]);}
}
cypress(-10,-4.9,6.0);cypress(-7.4,-8.9,4.7);cypress(8.0,-10.5,4.3);

// A complete hatchback with contoured hood, pierced wheel arches and a glass cabin.
const car=new THREE.Group();car.position.set(5.95,.07,7.1);car.rotation.y=-Math.PI*.10;scene.add(car);
function cbox(m,p,s,r=[0,0,0]){return box(m,p,s,r,car);}
function cround(m,p,s,r=[0,0,0]){return rounded(m,p,s,r,car);}
function cpoly(points,m){return poly(points,m,car);}
function ctube(a,b,r,m,s=8){return tube(a,b,r,m,car,s);}
cround(blue,[0,.59,0],[1.59,.57,3.86]);
cround(blue,[0,.87,1.08],[1.72,.27,1.78]);
cround(blue,[0,.9,-1.47],[1.76,.30,.90]);
// Sculpted upper body loft.
const sections=[[-1.97,.79,.91],[-1.75,.93,1.01],[-1.2,.94,1.06],[-.55,.92,1.03],[.45,.91,1.01],[1.15,.90,.98],[1.75,.83,.88],[1.97,.75,.78]];
const p=[],idx=[];
for(const [z,w,h] of sections)for(const [xx,yy] of [[-w,.83],[-w*.90,h],[-w*.55,h+.035],[0,h+.065],[w*.55,h+.035],[w*.90,h],[w,.83]])p.push(xx,yy,z);
for(let s=0;s<sections.length-1;s++)for(let i=0;i<6;i++){const a=s*7+i;idx.push(a,a+7,a+1,a+1,a+7,a+8);}
const bodyGeo=new THREE.BufferGeometry();bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));bodyGeo.setIndex(idx);bodyGeo.computeVertexNormals();add(bodyGeo,blue,[0,0,0],[1,1,1],[0,0,0],car);
function sidePanel(sign){
 const contour=[];
 contour.push(new THREE.Vector2(-1.96,.34));
 for(const wheel of [-1.22,1.22]){
  contour.push(new THREE.Vector2(wheel-.43,.34));
  for(let i=0;i<=16;i++){const a=Math.PI-i/16*Math.PI;contour.push(new THREE.Vector2(wheel+Math.cos(a)*.44,.38+Math.sin(a)*.46));}
  contour.push(new THREE.Vector2(wheel+.43,.34));
 }
 contour.push(new THREE.Vector2(1.96,.34),new THREE.Vector2(1.96,.75),new THREE.Vector2(1.78,.9),new THREE.Vector2(1.2,1.00),new THREE.Vector2(.55,1.01),new THREE.Vector2(-.6,1.04),new THREE.Vector2(-1.3,1.04),new THREE.Vector2(-1.81,.95),new THREE.Vector2(-1.96,.81));
 const triangles=THREE.ShapeUtils.triangulateShape(contour,[]),ps=[];for(const v of contour)ps.push(sign*.94,v.y,v.x);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setIndex(triangles.flat());g.computeVertexNormals();
 const m=blue.clone();m.side=THREE.DoubleSide;add(g,m,[0,0,0],[1,1,1],[0,0,0],car);
 for(const zz of [-1.22,1.22]){
  const curve=[];for(let i=0;i<=18;i++){const a=Math.PI-i/18*Math.PI;curve.push([sign*.952,.38+Math.sin(a)*.463,zz+Math.cos(a)*.445]);}
  outline(curve,.018,blue,car);
 }
}
sidePanel(1);sidePanel(-1);
cround(blue,[0,.34,1.91],[1.76,.23,.25]);cround(blue,[0,.36,-1.91],[1.76,.20,.23]);
for(const sign of [-1,1])cbox(blue,[sign*.925,.30,0],[.08,.14,1.54]);
const autoGlass=mat('#3c5361',.16,{metalness:.33,envMapIntensity:2.0,side:THREE.DoubleSide});
const cabinTopY=1.53;
cpoly([[-.72,1.04,.72],[.72,1.04,.72],[.635,1.49,.12],[-.635,1.49,.12]],autoGlass);
cpoly([[-.71,1.04,-1.72],[-.635,1.48,-1.16],[.635,1.48,-1.16],[.71,1.04,-1.72]],autoGlass);
for(const sign of [-1,1]){
 cpoly([[sign*.75,1.04,.58],[sign*.66,1.46,.08],[sign*.65,1.46,-.43],[sign*.75,1.05,-.49]],autoGlass);
 cpoly([[sign*.75,1.05,-.59],[sign*.65,1.46,-.53],[sign*.64,1.46,-1.13],[sign*.73,1.07,-1.55]],autoGlass);
 ctube([sign*.74,1.02,.69],[sign*.64,1.51,.12],.04,blue);
 ctube([sign*.74,1.03,-1.69],[sign*.64,1.50,-1.16],.06,blue);
 ctube([sign*.748,1.04,-.54],[sign*.65,1.49,-.49],.031,black);
 outline([[sign*.76,1.04,.63],[sign*.76,1.04,-1.62]],.025,black,car);
 // Door contours and handles.
 outline([[sign*.946,.91,.57],[sign*.950,.73,.51],[sign*.951,.43,.45],[sign*.95,.36,-.45],[sign*.95,.83,-.51],[sign*.755,1.035,-.52]],.006,black,car);
 outline([[sign*.95,.36,-.45],[sign*.95,.40,-.77],[sign*.95,.87,-1.18],[sign*.755,1.036,-1.54]],.006,black,car);
 cround(black,[sign*.961,.96,-.32],[.036,.038,.16]);
 cround(black,[sign*.963,.97,-1.08],[.036,.038,.15]);
 ctube([sign*.75,1.08,.50],[sign*1.04,1.09,.45],.028,black);
 cround(blue,[sign*1.055,1.12,.45],[.20,.13,.25]);
 cbox(autoGlass,[sign*1.061,1.121,.333],[.16,.087,.015]);
}
add(new RoundedBoxGeometry(1.35,.15,1.35,3,.06),blue,[0,1.53,-.53],[1,1,1],[0,0,0],car);
ctube([0,1.59,-1.04],[0,1.9,-1.19],.011,black,6);
// Fine sky glints across the windshield are actual inset glass surfaces.
cpoly([[-.50,1.11,.62],[-.38,1.13,.60],[-.25,1.46,.17],[-.39,1.46,.17]],reflectGlass);
cpoly([[.09,1.11,.62],[.15,1.12,.60],[.31,1.46,.17],[.22,1.46,.17]],reflectGlass);
for(const x of [-.31,.31]){
 cround(mat('#807c70',.9),[x,1.03,-.31],[.41,.48,.37]);
 cround(dark,[x,1.30,-.36],[.29,.18,.15]);
}
// Front grille, lower intake, lamps, license plate and badge.
cround(black,[0,.72,1.989],[1.13,.23,.027]);
for(let i=0;i<4;i++)cbox(chrome,[0,.646+i*.044,2.012],[1.05,.011,.018]);
cround(black,[0,.43,2.025],[1.09,.22,.035]);
for(let i=0;i<5;i++)cbox(gutter,[0,.36+i*.035,2.045],[.97,.011,.013]);
cbox(sandstone,[0,.57,2.055],[.42,.105,.025]);
cbox(black,[0,.57,2.073],[.32,.064,.007]);
for(const sign of [-1,1]){
 cpoly([[sign*.59,.70,2.002],[sign*.86,.74,1.91],[sign*.84,.89,1.92],[sign*.57,.87,2.00]],chrome);
 cpoly([[sign*.61,.724,2.016],[sign*.83,.756,1.932],[sign*.82,.86,1.936],[sign*.60,.846,2.017]],lamp);
 for(const xx of [.67,.77])ball(lamp,[sign*xx,.79,1.993-(xx-.67)*.3],[.055,.046,.022],car);
 cround(black,[sign*.73,.43,1.992],[.27,.16,.044]);
 ball(lamp,[sign*.735,.44,2.026],[.075,.045,.022],car);
 cround(red,[sign*.79,.92,-1.930],[.26,.19,.095]);
 cbox(lamp,[sign*.79,.87,-1.991],[.19,.035,.018]);
 cbox(chrome,[sign*.947,.88,.73],[.017,.035,.09]);
 outline([[sign*.52,.96,1.77],[sign*.57,1.02,.77]],.007,blue,car);
}
add(new THREE.TorusGeometry(.075,.016,6,16),chrome,[0,.74,2.048],[1,1,1],[0,0,0],car);
ctube([-.031,.755,2.05],[0,.72,2.05],.007,chrome,5);ctube([0,.72,2.05],[.033,.756,2.05],.007,chrome,5);
// Four separate tyres, alloy rims, brake discs and ten spokes each.
for(const sign of [-1,1])for(const z of [-1.22,1.22]){
 const x=sign*.93,y=.385;
 add(new THREE.TorusGeometry(.294,.084,10,28),tire,[x,y,z],[1,1,1],[0,Math.PI/2,0],car);
 add(new THREE.CylinderGeometry(.26,.26,.15,28),black,[x,y,z],[1,1,1],[0,0,Math.PI/2],car);
 add(new THREE.CylinderGeometry(.235,.235,.012,24),chrome,[x+sign*.085,y,z],[1,1,1],[0,0,Math.PI/2],car);
 add(new THREE.CylinderGeometry(.207,.207,.015,24),dark,[x+sign*.098,y,z],[1,1,1],[0,0,Math.PI/2],car);
 add(new THREE.TorusGeometry(.239,.017,5,24),chrome,[x+sign*.110,y,z],[1,1,1],[0,Math.PI/2,0],car);
 for(let k=0;k<10;k++){const a=k/10*Math.PI*2,yy=y+Math.sin(a)*.138,zz=z+Math.cos(a)*.138;cbox(chrome,[x+sign*.118,yy,zz],[.023,.027,.192],[-a,0,0]);}
 add(new THREE.CylinderGeometry(.068,.068,.026,14),chrome,[x+sign*.128,y,z],[1,1,1],[0,0,Math.PI/2],car);
 for(let k=0;k<5;k++){const a=k/5*Math.PI*2;ball(dark,[x+sign*.145,y+Math.sin(a)*.042,z+Math.cos(a)*.042],[.010,.010,.010],car);}
}

// Distant terrain uses true low relief geometry, with an unobtrusive warm haze.
const terrainP=[],terrainC=[],terrainI=[];
for(let row=0;row<=16;row++)for(let col=0;col<=40;col++){
 const x=-45+col*2.25,z=-27-row*2.6;
 const y=.7+2.4*Math.sin(x*.065+1.2)+1.1*Math.cos(x*.16+row*.27)+Math.sin(row*.41)*1.1;
 terrainP.push(x,Math.max(.2,y),z);const c=new THREE.Color().setHSL(.15,.17,.18+row*.002);terrainC.push(c.r,c.g,c.b);
 if(row<16&&col<40){const a=row*41+col;terrainI.push(a,a+1,a+41,a+1,a+42,a+41);}
}
const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(terrainP,3));tg.setAttribute('color',new THREE.Float32BufferAttribute(terrainC,3));tg.setIndex(terrainI);tg.computeVertexNormals();
add(tg,mat('#ffffff',1,{vertexColors:true}));
box(mat('#7b9dba',.4),[0,.005,-22.6],[65,.03,7]);
const distantFoliage=[],distantColors=[];
for(let i=0;i<95;i++){
 const x=rand(-28,27),z=rand(-23,-11),h=rand(1.1,2.6),r=rand(.55,1.1);
 if(x>-11&&x<3&&z>-15)continue;
 tube([x,.02,z],[x,h*.7,z],.06,bark,scene,5,.03);
 for(let k=0;k<9;k++){
 distantFoliage.push({p:[x+rand(-r*.65,r*.65),h*.72+rand(-.15,.45),z+rand(-r*.60,r*.60)],s:[r*.48,r*.42,r*.48]});
 distantColors.push(new THREE.Color().setHSL(rand(.2,.25),.35,rand(.06,.14)));
 }
}
batch(sphereGeo,mat('#ffffff',.98),distantFoliage,scene,distantColors);

// Soft cloud banks are ellipsoidal volumes in the far sky.
const cloudMat=mat('#f6efe3',1);
for(const [cx,cy,cz,s] of [[-18,15,-30,1.5],[18,14,-42,1.8],[-38,13,-16,1.3]]){
 for(let i=0;i<7;i++){const m=ball(cloudMat,[cx+i*1.7*s,cy+rand(-.3,.4),cz+rand(-.7,.7)],[2.0*s,.42*s,.7*s]);m.castShadow=false;}
}


// Procedural daylight environment: a sky gradient and broad cloud reflection bands.
const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;
const envCtx=envCanvas.getContext('2d');
const gradient=envCtx.createLinearGradient(0,0,0,256);
gradient.addColorStop(0,'#91b8df');gradient.addColorStop(.38,'#d7e4ee');
gradient.addColorStop(.49,'#f0e6d3');gradient.addColorStop(.51,'#b1aa98');gradient.addColorStop(1,'#6e7660');
envCtx.fillStyle=gradient;envCtx.fillRect(0,0,512,256);
envCtx.fillStyle='rgba(255,249,235,0.68)';envCtx.fillRect(22,79,158,18);
envCtx.fillStyle='rgba(255,251,240,0.48)';envCtx.fillRect(268,61,137,13);
const env=new THREE.CanvasTexture(envCanvas);env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;
scene.environment=env;scene.environmentIntensity=.30;
// Keep the foreground car and the complete garden inside the fixed camera frustum.
const sceneModel=new THREE.Group();
const authored=scene.children.filter(o=>o!==hemi&&o!==sun&&o!==sun.target);
for(const o of authored)sceneModel.add(o);
sceneModel.position.z=-2.2;scene.add(sceneModel);

// All exported arrays are copied from actual rendered buffer attributes and instance matrices.
scene.updateMatrixWorld(true);
const ready=(async()=>{
 if(!navigator.gpu)throw new Error('Native WebGPU is required');
 const adapter=await navigator.gpu.requestAdapter();
 if(!adapter)throw new Error('Native WebGPU adapter is unavailable');
 await renderer.init();
 if(!renderer.backend.isWebGPUBackend)throw new Error('WebGPU backend is required; no WebGL rendering allowed');
 await renderer.compileAsync(scene,camera);
})();
globalThis.__AGENT_BENCHMARK__={
 engine:'three',canvas:renderer.domElement,ready,
 async setCamera(c){camera.position.fromArray(c.position);camera.fov=c.fovYDegrees;camera.near=c.near;camera.far=c.far;camera.lookAt(new THREE.Vector3().fromArray(c.target));camera.updateProjectionMatrix();camera.updateMatrixWorld();},
 async renderFrame(){await ready;renderer.render(scene,camera);},
 async inspectGeometry(){
  scene.updateMatrixWorld(true);const meshes=[];
  scene.traverse(o=>{
   if(!o.isMesh||!o.visible)return;
   const g=o.geometry,pa=g.getAttribute('position'),na=g.getAttribute('normal');
   const positions=new Float32Array(pa.count*3);for(let i=0;i<pa.count;i++){positions[i*3]=pa.getX(i);positions[i*3+1]=pa.getY(i);positions[i*3+2]=pa.getZ(i);}
   const entry={id:o.name,positions,worldMatrix:o.matrixWorld.toArray()};
   if(g.index)entry.indices=g.index.array.slice();
   if(na){const normals=new Float32Array(na.count*3);for(let i=0;i<na.count;i++){normals[i*3]=na.getX(i);normals[i*3+1]=na.getY(i);normals[i*3+2]=na.getZ(i);}entry.normals=normals;}
   if(o.isInstancedMesh){entry.instances=[];const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);entry.instances.push(new THREE.Matrix4().multiplyMatrices(o.matrixWorld,m).toArray());}}
   meshes.push(entry);
  });return {meshes};
 },
 async dispose(){renderer.dispose();scene.traverse(o=>{if(o.isMesh)o.geometry.dispose();});materials.forEach(m=>m.dispose());}
};
