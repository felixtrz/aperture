import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#97b9df');
scene.fog = new THREE.Fog('#b7cddd', 38, 90);
const camera = new THREE.PerspectiveCamera(37, 1024/768, .1, 200);
camera.position.set(14,9,19); camera.lookAt(0,2.5,1);
const renderer = new THREE.WebGPURenderer({antialias:true,samples:4,forceWebGL:false,alpha:false});
renderer.setPixelRatio(1); renderer.setSize(1024,768);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const sun=new THREE.DirectionalLight('#fff0ce',3.6);
sun.position.set(-10,17,12); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-17;sun.shadow.camera.right=17;
sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.camera.near=.5;sun.shadow.camera.far=60;
sun.shadow.normalBias=.022;sun.shadow.bias=-.00008;scene.add(sun);scene.add(sun.target);
scene.add(new THREE.HemisphereLight('#c7defa','#77744c',1.45));
scene.add(new THREE.AmbientLight('#f6e4ce',.25));

let seed=8347;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
const range=(a,b)=>a+(b-a)*random();
const mat=(color,roughness=.8,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
function noiseTexture(colors,size=256,scale=1){
 const c=new OffscreenCanvas(size,size), ctx=c.getContext('2d'), im=ctx.createImageData(size,size);
 const col=colors.map(v=>new THREE.Color(v).convertLinearToSRGB());
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let n=random(), q=col[Math.floor(n*col.length)], k=.83+random()*.27;
  let i=(y*size+x)*4;im.data[i]=Math.min(255,q.r*255*k);im.data[i+1]=Math.min(255,q.g*255*k);im.data[i+2]=Math.min(255,q.b*255*k);im.data[i+3]=255;
 }
 ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(scale,scale);t.anisotropy=8;return t;
}
const stuccoTex=noiseTexture(['#ddd1b5','#e8dbc0','#d9cbae'],256,3);
const stucco=mat('#fff9ed',.94,{map:stuccoTex,bumpMap:stuccoTex,bumpScale:.022,side:THREE.DoubleSide});
const stoneTex=noiseTexture(['#c1b49c','#d3c6b0','#a79c85'],256,1.5);
const stoneMats=Array.from({length:6},(_,i)=>mat(new THREE.Color().setHSL(.105,.09,.49+i*.026),.93,{map:stoneTex,bumpMap:stoneTex,bumpScale:.025}));
const asphaltTex=noiseTexture(['#707071','#565657','#83817e'],512,8);
const roadMat=mat('#b5b5b2',.94,{map:asphaltTex,bumpMap:asphaltTex,bumpScale:.018});
const grassTex=noiseTexture(['#747d34','#828443','#526632','#9a9250'],512,9);
const grassMat=mat('#e7e9c4',.99,{map:grassTex,bumpMap:grassTex,bumpScale:.035});
const paleStone=mat('#d1c7ad',.86,{map:stoneTex});
const dark=mat('#24282a',.63), frameMat=mat('#313837',.65), wood=mat('#6e5131',.9);
const tileTex=noiseTexture(['#b66133','#d38a51','#bd713a'],128,1);
const tiles=Array.from({length:7},(_,i)=>mat(new THREE.Color().setHSL(.075,.12,.56+i*.035),.84,{map:tileTex,bumpMap:tileTex,bumpScale:.012,side:THREE.DoubleSide}));
const roofBase=mat('#784a2e',.94);
const batches=new Map();
const brickGeo=new RoundedBoxGeometry(1,1,1,2,.035);
const unitBox=new THREE.BoxGeometry(1,1,1), unitSphere=new THREE.IcosahedronGeometry(1,1);
const cylinder=new THREE.CylinderGeometry(1,1,1,10);
const temp=new THREE.Object3D();
function mesh(geometry,material,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],parent=scene){
 const m=new THREE.Mesh(geometry,material);m.position.fromArray(position);m.rotation.fromArray(rotation);m.scale.fromArray(scale);
 m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(w,h,d,x,y,z,material,parent=scene){return mesh(unitBox,material,[x,y,z],[0,0,0],[w,h,d],parent)}
function instance(geometry,material,position,scale=[1,1,1],rotation=[0,0,0],parent=scene){
 const key=geometry.uuid+'_'+material.uuid+'_'+parent.uuid;
 if(!batches.has(key))batches.set(key,{geometry,material,matrices:[],parent});
 temp.position.fromArray(position);temp.scale.fromArray(scale);temp.rotation.fromArray(rotation);temp.updateMatrix();
 batches.get(key).matrices.push(temp.matrix.clone());
}
function ibox(w,h,d,x,y,z,material,rotation=[0,0,0],parent=scene){instance(unitBox,material,[x,y,z],[w,h,d],rotation,parent)}
function rod(a,b,r,material,parent=scene,r2=r){
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
 const g=new THREE.CylinderGeometry(r2,r,d.length(),10);const m=mesh(g,material,av.clone().add(bv).multiplyScalar(.5).toArray(),[0,0,0],[1,1,1],parent);
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
}
function poly(vertices,material,parent=scene,indices=null){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
 geo.setIndex(indices||[0,1,2,0,2,3]);geo.computeVertexNormals();return mesh(geo,material,[0,0,0],[0,0,0],[1,1,1],parent);
}
function lineTube(points,r,material,parent=scene){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(c,Math.max(8,points.length*3),r,6,false),material,[0,0,0],[0,0,0],[1,1,1],parent)}

// The environment is a procedural sky reflection, not a scene photograph.
const envCanvas=new OffscreenCanvas(512,256),ec=envCanvas.getContext('2d');
const eg=ec.createLinearGradient(0,0,0,256);eg.addColorStop(0,'#708cac');eg.addColorStop(.48,'#d6e0e0');eg.addColorStop(.55,'#9b9d7a');eg.addColorStop(1,'#655443');ec.fillStyle=eg;ec.fillRect(0,0,512,256);
for(let i=0;i<60;i++){ec.fillStyle='rgba(250,240,217,.4)';ec.beginPath();ec.ellipse(range(0,512),range(15,100),range(5,45),range(2,8),0,0,Math.PI*2);ec.fill()}
const env=new THREE.CanvasTexture(envCanvas);env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;scene.environment=env;

// Gently raised garden terrain and a sweeping road.
box(72,.22,72,0,-.14,0,grassMat);
const centerline=new THREE.CatmullRomCurve3([
 new THREE.Vector3(-17,0,10.5),new THREE.Vector3(-9,0,10.5),new THREE.Vector3(-2,0,10.0),
 new THREE.Vector3(3,0,8.9),new THREE.Vector3(7.1,0,5.8),new THREE.Vector3(9.1,0,1),
 new THREE.Vector3(9.7,0,-6),new THREE.Vector3(12,0,-15)
],false,'catmullrom',.5);
function ribbon(path,width,y,material,offset=0,steps=180){
 const pos=[],uv=[],ids=[];
 for(let i=0;i<=steps;i++){let t=i/steps,p=path.getPointAt(t),d=path.getTangentAt(t),n=new THREE.Vector3(d.z,0,-d.x);
  for(let s of [-1,1]){let v=p.clone().addScaledVector(n,offset+s*width/2);pos.push(v.x,y,v.z);uv.push((s+1)/2,t*10)}
  if(i<steps){let a=i*2;ids.push(a,a+2,a+1,a+1,a+2,a+3)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return mesh(g,material);
}
ribbon(centerline,4.6,.012,roadMat);
ribbon(centerline,1.0,.11,paleStone,2.8);
ribbon(centerline,.18,.18,stoneMats[3],2.31);
ribbon(centerline,.24,.08,paleStone,-2.4);
const mark=mat('#e4ddc8',.96);
for(let distance=1.1;distance<centerline.getLength();distance+=2.9){
 const t=distance/centerline.getLength(),p=centerline.getPointAt(t),d=centerline.getTangentAt(t);
 ibox(.11,.018,1.4,p.x,.032,p.z,mark,[0,Math.atan2(d.x,d.z),0]);
}
for(let dist=.3;dist<centerline.getLength();dist+=.8){
 let t=dist/centerline.getLength(),p=centerline.getPointAt(t),d=centerline.getTangentAt(t),n=new THREE.Vector3(d.z,0,-d.x);
 p.addScaledVector(n,2.8);ibox(1,.11,.025,p.x,.18,p.z,stoneMats[1],[0,Math.atan2(-d.z,d.x),0]);
}

// Garden stone wall, with an entrance aligned to the front door.
const wallCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-10,0,6.6),new THREE.Vector3(-5,0,6.7),new THREE.Vector3(0,0,6.65),new THREE.Vector3(4.6,0,5.55),new THREE.Vector3(5.8,0,2.5),new THREE.Vector3(6.1,0,-3)],false,'catmullrom',.5);
for(let dist=0;dist<wallCurve.getLength();dist+=.58){
 const t=dist/wallCurve.getLength(),p=wallCurve.getPointAt(t),d=wallCurve.getTangentAt(t);
 if(p.z>6.3 && p.x>-.9 && p.x<1.4)continue;
 for(let row=0;row<3;row++){
  let q=wallCurve.getPointAt(Math.min(1,(dist+(row%2)*.27)/wallCurve.getLength()));
  instance(brickGeo,stoneMats[Math.floor(random()*6)],[q.x,.17+row*.26,q.z],[.55,.25+range(-.02,.02),.38],[range(-.015,.015),Math.atan2(-d.z,d.x),range(-.015,.015)]);
 }
 instance(brickGeo,stoneMats[4],[p.x,.86,p.z],[.59,.095,.45],[0,Math.atan2(-d.z,d.x),0]);
}
function gatePillar(x,z){
 for(let row=0;row<5;row++)box(.61,.26,.58,x,.13+row*.265,z,stoneMats[row%6]);
 box(.74,.13,.7,x,1.39,z,stoneMats[4]);box(.77,.05,.73,x,1.48,z,stoneMats[2]);
}
gatePillar(-1.03,6.65);gatePillar(1.35,6.42);

// Irregular fitted limestone paving stones.
function paving(cx,cz,width,length,angle=0){
 const verts=[],n=6;for(let i=0;i<n;i++){let a=i/n*Math.PI*2;verts.push([Math.cos(a)*width*(.4+range(0,.09)),Math.sin(a)*length*(.4+range(0,.09))])}
 const shape=new THREE.Shape();shape.moveTo(...verts[0]);verts.slice(1).forEach(v=>shape.lineTo(...v));shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.016,bevelThickness:.012,bevelSegments:1,steps:1});
 mesh(g,stoneMats[Math.floor(random()*6)],[cx,.09,cz],[-Math.PI/2,0,angle]);
}
for(let z=4.75;z<7.25;z+=.4)for(let x=-.65;x<1.0;x+=.48)paving(x+range(-.07,.07),z+range(-.05,.05),.51,.46,range(-.2,.2));
for(let z=-1.9;z<5.7;z+=.52)for(let x=4.05;x<5.65;x+=.52)paving(x+range(-.05,.05),z+range(-.05,.05),.58,.58,range(-.2,.2));
for(let i=0;i<9;i++)paving(1.1+i*.38,5.65-i*.08,.53,.52,range(-.2,.2));

const houseFirst=scene.children.length;
// House walls are subdivided around genuine inset window and door openings.
const houseX=3.65, houseZ=2.8, eave=6.05;
const frontOpenings=[
 {x:-2.35,y:4.85,w:1.3,h:1.55},{x:1.35,y:4.85,w:1.45,h:1.65},
 {x:-2.45,y:1.55,w:1.12,h:1.42},{x:.1,y:1.37,w:1.03,h:2.42},{x:1.82,y:1.55,w:.94,h:1.42}
];
function wallWithOpenings(openings,width,height,parent,plane){
 const xs=[-width/2,width/2],ys=[.08,height];
 openings.forEach(o=>{xs.push(o.x-o.w/2,o.x+o.w/2);ys.push(o.y-o.h/2,o.y+o.h/2)});
 xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
  if(openings.some(o=>x>o.x-o.w/2+.0001&&x<o.x+o.w/2-.0001&&y>o.y-o.h/2+.0001&&y<o.y+o.h/2-.0001))continue;
  if(xs[i+1]-xs[i]<.0001||ys[j+1]-ys[j]<.0001)continue;
  box(xs[i+1]-xs[i],ys[j+1]-ys[j],.28,x,y,0,stucco,parent);
 }
 parent.position.fromArray(plane.position);parent.rotation.y=plane.angle;
}
const frontWall=new THREE.Group();scene.add(frontWall);wallWithOpenings(frontOpenings,7.3,6.05,frontWall,{position:[0,0,2.68],angle:0});
const sideOpenings=[{x:-1.32,y:4.75,w:.75,h:1.5},{x:1.28,y:4.75,w:.8,h:1.5},{x:-1.35,y:1.55,w:.77,h:1.45},{x:1.27,y:1.55,w:.83,h:1.45}];
const rightWall=new THREE.Group();scene.add(rightWall);wallWithOpenings(sideOpenings,5.6,6.05,rightWall,{position:[3.53,0,0],angle:Math.PI/2});
const leftWall=new THREE.Group();scene.add(leftWall);wallWithOpenings(sideOpenings,5.6,6.05,leftWall,{position:[-3.53,0,0],angle:-Math.PI/2});
const backWall=new THREE.Group();scene.add(backWall);wallWithOpenings([{x:-1.8,y:4.8,w:1.25,h:1.5},{x:1.7,y:4.8,w:1.25,h:1.5},{x:0,y:1.55,w:1.3,h:1.5}],7.3,6.05,backWall,{position:[0,0,-2.68],angle:Math.PI});
box(7.32,.18,5.62,0,.08,0,stoneMats[2]);
const glass= new THREE.MeshPhysicalMaterial({color:'#4d5a5f',roughness:.2,metalness:.22,clearcoat:.8,envMapIntensity:.8});
const recess=mat('#30332e',.94);
const curtain=mat('#beae87',.97);
function window(o,parent){
 box(o.w+.02,o.h+.02,.06,o.x,o.y,-.13,recess,parent);
 box(o.w-.15,o.h-.15,.024,o.x,o.y,-.055,glass,parent);
 const w=.055;
 box(o.w,.075,.1,o.x,o.y+o.h/2-.02,.0,frameMat,parent);
 box(o.w,.075,.1,o.x,o.y-o.h/2+.02,.0,frameMat,parent);
 box(w,o.h,.1,o.x-o.w/2+.015,o.y,0,frameMat,parent);box(w,o.h,.1,o.x+o.w/2-.015,o.y,0,frameMat,parent);
 box(.045,o.h-.08,.09,o.x,o.y,.007,frameMat,parent);box(o.w-.05,.043,.09,o.x,o.y-.12,.008,frameMat,parent);
 box(o.w+.18,.105,.43,o.x,o.y-o.h/2-.045,.035,paleStone,parent);
 for(let s of [-1,1])box(.15,o.h-.19,.018,o.x+s*(o.w*.32),o.y,-.075,curtain,parent);
}
frontOpenings.filter((o,i)=>i!==3).forEach(o=>window(o,frontWall));
sideOpenings.forEach(o=>window(o,rightWall));sideOpenings.forEach(o=>window(o,leftWall));
[{x:-1.8,y:4.8,w:1.25,h:1.5},{x:1.7,y:4.8,w:1.25,h:1.5},{x:0,y:1.55,w:1.3,h:1.5}].forEach(o=>window(o,backWall));
const doorMat=mat('#454944',.7);
box(.95,2.35,.09,.1,1.365,-.02,doorMat,frontWall);
for(let y of [.72,1.73])for(let x of [-.12,.32]){
 box(.32,.76,.045,x,y,.038,frameMat,frontWall);box(.27,.7,.02,x,y,.071,doorMat,frontWall);
}
rod([-.29,1.15,2.78],[-.29,1.34,2.78],.026,mat('#b28b47',.4,{metalness:.7}));
box(1.2,.1,.34,.1,.14,2.85,paleStone);
for(let s of [-1,1]){
 box(.28,.34,5.6,s*3.53,6.2,0,stucco);
 poly([[s*3.67,6.37,-2.8],[s*3.67,6.37,2.8],[s*3.67,8.02,0]],stucco,scene,s===1?[0,2,1]:[0,1,2]);
}

// Sloped roof deck, individual curved terracotta barrel tiles, ridge and fascia.
function barrelGeometry(width=.245,length=.43,height=.07){
 const p=[],uv=[],idx=[],steps=8;
 for(let j=0;j<2;j++)for(let i=0;i<=steps;i++){let t=i/steps;let taper=1-j*.04;p.push((t-.5)*width*taper,Math.sin(t*Math.PI)*height+j*.018,j*length);uv.push(t,j)}
 for(let i=0;i<steps;i++)idx.push(i,i+1,i+steps+1,i+1,i+steps+2,i+steps+1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const tileG=barrelGeometry();
const pitch=Math.atan2(1.94,3.3),ridge=8.02;
for(let s of [-1,1]){
 poly([[-4.0,ridge,0],[4.0,ridge,0],[4.0,6.08,s*3.3],[-4.0,6.08,s*3.3]],roofBase,scene,s===1?[0,2,1,0,3,2]:[0,1,2,0,2,3]);
 for(let col=0;col<32;col++)for(let row=0;row<10;row++){
  let d=row*.374;
  instance(tileG,tiles[Math.floor(random()*tiles.length)],[-3.87+col*.25,ridge-d*Math.sin(pitch)+.017,s*d*Math.cos(pitch)],[1,1,1],[s*pitch,s===-1?Math.PI:0,0]);
 }
 box(8.04,.15,.18,0,6.035,s*3.31,wood);
 rod([-4.05,6.04,s*3.39],[4.05,6.04,s*3.39],.065,dark);
}
const ridgeG=barrelGeometry(.27,.40,.13);
for(let x=-4;x<4;x+=.36)instance(ridgeG,tiles[5],[x,8.05,0],[1,1,1],[0,Math.PI/2,0]);
for(let side of [-1,1]){
 rod([side*4.02,8.04,0],[side*4.02,6.08,3.32],.072,wood);
 rod([side*4.02,8.04,0],[side*4.02,6.08,-3.32],.072,wood);
 for(let s of [-1,1])for(let r=0;r<10;r++)instance(tileG,tiles[4],[side*3.98,8.045-r*.374*Math.sin(pitch),s*r*.374*Math.cos(pitch)],[1,1,1],[s*pitch,s===-1?Math.PI:0,0]);
}
// Chimney with a vented cap.
box(.65,1.42,.62,2.62,8.35,-.9,stucco);
box(.73,.1,.7,2.62,9.07,-.9,paleStone);
box(.48,.36,.46,2.62,9.25,-.9,dark);
for(let sx of [-1,1])for(let sz of [-1,1])box(.095,.38,.095,2.62+sx*.275,9.25,-.9+sz*.255,stucco);
box(.86,.13,.82,2.62,9.49,-.9,tiles[4]);
poly([[2.13,9.54,-1.34],[3.11,9.54,-1.34],[2.62,9.72,-.9]],tiles[4],scene,[0,1,2]);
poly([[3.11,9.54,-1.34],[3.11,9.54,-.46],[2.62,9.72,-.9]],tiles[3],scene,[0,1,2]);
poly([[3.11,9.54,-.46],[2.13,9.54,-.46],[2.62,9.72,-.9]],tiles[5],scene,[0,1,2]);
poly([[2.13,9.54,-.46],[2.13,9.54,-1.34],[2.62,9.72,-.9]],tiles[4],scene,[0,1,2]);
for(let x of [-3.6,3.6]){
 lineTube([[x,6,3.3],[x,5.85,3.3],[x,5.63,2.92],[x,.24,2.92]],.049,dark);
 box(.16,.08,.18,x,3.8,2.85,dark);
}

// Covered entry porch.
box(5.0,.16,2.0,.0,.22,3.6,paleStone);
box(2.75,.13,.48,.12,.08,4.82,paleStone);
box(2.64,.12,.39,.12,.16,4.58,paleStone);
for(let x of [-2.03,2.03]){
 box(.30,2.95,.34,x,1.70,4.25,stucco);
 box(.43,.16,.47,x,.30,4.25,paleStone);
 box(.47,.14,.49,x,3.12,4.25,paleStone);
}
box(5.02,.20,.28,0,3.17,4.36,wood);
box(4.85,.13,1.55,0,3.33,3.62,stucco);
const porchPitch=Math.atan2(.53,1.85);
poly([[-2.59,3.74,2.7],[2.59,3.74,2.7],[2.59,3.21,4.55],[-2.59,3.21,4.55]],roofBase,scene,[0,2,1,0,3,2]);
for(let col=0;col<21;col++)for(let row=0;row<5;row++)instance(tileG,tiles[Math.floor(random()*tiles.length)],[-2.48+col*.247,3.76-row*.375*Math.sin(porchPitch),2.69+row*.375*Math.cos(porchPitch)],[1,1,1],[porchPitch,0,0]);
box(5.25,.12,.18,0,3.15,4.57,wood);rod([-2.65,3.2,4.64],[2.65,3.2,4.64],.055,dark);
for(let x of [-2.62,2.62])rod([x,3.75,2.68],[x,3.22,4.56],.072,wood);
// Lantern next to the door.
rod([-.78,2.24,2.94],[-.78,2.45,3.04],.025,dark);
box(.2,.31,.2,-.78,2.18,3.13,mat('#e7c889',.5,{emissive:'#bb7833',emissiveIntensity:.14}));
for(let x of [-.89,-.67])for(let z of [3.02,3.24])rod([x,2.0,z],[x,2.33,z],.013,dark);
box(.26,.04,.26,-.78,2.0,3.13,dark);
mesh(new THREE.ConeGeometry(.2,.13,4),dark,[-.78,2.38,3.13],[0,Math.PI/4,0]);

const houseRoot=new THREE.Group();
for(const object of scene.children.slice(houseFirst))houseRoot.add(object);
scene.add(houseRoot);houseRoot.scale.set(1.11,.90,1.02);
// Garden trees with branching trunks and individual leaf sprays.
const bark=mat('#69533a',.98), leafMats=['#455733','#607545','#738650','#3c542e','#7f8b58'].map(c=>mat(c,.95));
const leafGeo=new THREE.SphereGeometry(1,5,3);
function leafSpray(cx,cy,cz,rx,ry,rz,count,materials=leafMats){
 for(let i=0;i<count;i++){
  const a=range(0,Math.PI*2),v=range(-1,1),r=Math.cbrt(random()),s=Math.sqrt(1-v*v);
  let x=cx+rx*r*s*Math.cos(a),y=cy+ry*r*v,z=cz+rz*r*s*Math.sin(a);
  instance(leafGeo,materials[Math.floor(random()*materials.length)],[x,y,z],[range(.035,.075),range(.09,.17),range(.009,.022)],[range(0,Math.PI),range(0,Math.PI),range(0,Math.PI)]);
 }
}
function olive(x,z,h=4.1,density=1){
 rod([x,.02,z],[x+.08,h*.6,z+.03],.16,bark,scene,.1);
 const tips=[];
 for(let i=0;i<7;i++){
  let a=i/7*Math.PI*2+range(-.3,.3),ex=x+Math.cos(a)*range(.7,1.3),ez=z+Math.sin(a)*range(.65,1.2),ey=h*range(.66,.88);
  const joint=[x+Math.cos(a)*.35,h*.5,z+Math.sin(a)*.27];
  rod([x+.07,h*.37,z],joint,.08,bark,scene,.045);rod(joint,[ex,ey,ez],.047,bark,scene,.018);tips.push([ex,ey,ez]);
  leafSpray(ex,ey,ez,.88,.70,.74,Math.round(440*density));
 }
 leafSpray(x,h*.9,z,1.05,.72,.85,Math.round(520*density));
 for(let t of tips)for(let i=0;i<3;i++){let p=[t[0]+range(-.45,.45),t[1]+range(-.2,.4),t[2]+range(-.45,.45)];rod(t,p,.014,bark,scene,.006)}
}
olive(-5.7,3.3,4.05);olive(6.0,-2.0,4.55);olive(-6.9,-3.8,4.2);
olive(-11,-6.5,3.4,.4);olive(10.8,-8,3.6,.4);olive(-3,-10,3.4,.4);
function bush(x,z,r=.6,height=.6){
 leafSpray(x,height*.6+.05,z,r,height*.58,r,240);
 for(let i=0;i<4;i++)rod([x,.03,z],[x+range(-r*.65,r*.65),height*.75,z+range(-r*.65,r*.65)],.012,bark,scene,.006);
}
for(let p of [[-3.9,3.6,.7],[-3.1,4.6,.55],[-4.8,5.7,.6],[-7.7,5.8,.7],[2.8,4.6,.6],[4.2,2.7,.7],[4.4,.6,.65],[4.4,-2.3,.7],[-7.9,-.2,.75]])bush(p[0],p[1],p[2],p[2]*1.1);
for(let i=0;i<28;i++){
 let t=range(0,1),p=wallCurve.getPoint(t);if(p.z>6.3&&p.x>-.9&&p.x<1.4)continue;
 bush(p.x-.2,p.z-.4,range(.32,.5),range(.35,.65));
}
const cypressMats=['#3e5324','#53692c','#68793b'].map(c=>mat(c,.97));
function cypress(x,z,h){
 rod([x,0,z],[x,h*.85,z],.07,bark,scene,.022);
 const profile=[];
 for(let i=0;i<=18;i++){const t=i/18;profile.push(new THREE.Vector2(.42*Math.pow(Math.sin(t*Math.PI),.72)*(1-t*.33)+.012,t*h));}
 const g=new THREE.LatheGeometry(profile,14);mesh(g,cypressMats[0],[x,.1,z]);
 for(let i=0;i<1100;i++){
  let t=range(.03,.985),a=range(0,Math.PI*2),r=(.42*Math.pow(Math.sin(t*Math.PI),.72)*(1-t*.33))*(.83+random()*.32);
  instance(leafGeo,cypressMats[Math.floor(random()*3)],[x+Math.cos(a)*r,t*h+.1,z+Math.sin(a)*r],[.038,range(.075,.12),.025],[range(-.25,.25),a,range(-.2,.2)]);
 }
}
cypress(-7.8,-3,6.6);cypress(-6.0,-6.0,5.2);cypress(7.2,-7.5,5.6);cypress(-10,-8,4.5);
const lavenderMats=['#8e7a9a','#9d83ae','#b4a0b4'].map(c=>mat(c,.94));
function lavender(x,z){
 bush(x,z,.35,.4);
 for(let i=0;i<20;i++){
  let a=range(0,Math.PI*2),r=range(.03,.35),px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,h=range(.38,.75);
  rod([px,.1,pz],[px,h,pz],.006,leafMats[0]);
  instance(unitSphere,lavenderMats[i%3],[px,h,pz],[.035,.105,.035]);
 }
}
for(let p of [[-3.4,4.2],[-4.0,4.8],[2.8,5.0],[4.1,1.7],[4.3,-1.0],[-6.8,5.5]])lavender(...p);
const potMat=mat('#aa6c41',.9);
function pot(x,z,r,h){
 const g=new THREE.CylinderGeometry(r,r*.68,h,18,1,true);mesh(g,potMat,[x,.28+h/2,z]);
 mesh(new THREE.TorusGeometry(r,.027,6,20),potMat,[x,.28+h,z],[Math.PI/2,0,0]);
 mesh(new THREE.CylinderGeometry(r*.88,r*.88,.02,18),mat('#493623',1),[x,.28+h-.05,z]);
 leafSpray(x,.28+h+.35,z,r*.8,.42,r*.8,85);
}
pot(-1.30,3.92,.29,.43);pot(1.12,3.92,.22,.33);pot(3.0,3.55,.32,.45);
rod([3.0,.7,3.55],[3.03,1.7,3.54],.024,bark);leafSpray(3.03,1.6,3.54,.54,.5,.44,190);
for(let i=0;i<1500;i++){
 let x=range(-9,5.8),z=range(-5.8,6.3);if(Math.abs(x)<3.9&&z<4.7)continue;if(x>-.8&&x<1.1&&z>4.7)continue;
 instance(leafGeo,leafMats[Math.floor(random()*4)],[x,range(.05,.15),z],[.014,range(.025,.09),.008],[0,range(0,6.28),range(-.25,.25)]);
}
// Mailbox beside the open entry.
const mailbox=mat('#4e5249',.77);
box(.085,1.08,.08,-.70,.54,6.85,dark);
box(.49,.37,.36,-.70,1.12,6.85,mailbox);
mesh(new THREE.CylinderGeometry(.245,.245,.37,16,1,false,0,Math.PI),mailbox,[-.70,1.29,6.85],[Math.PI/2,0,Math.PI/2]);
box(.19,.026,.016,-.7,1.17,7.044,dark);box(.12,.055,.01,-.7,1.06,7.049,paleStone);
// Wooden side gate.
for(let i=0;i<12;i++)ibox(.16,1.55,.10,5.82,.78,-.25+i*.17,wood);
box(.11,.12,2.25,5.75,.42,.7,dark);box(.11,.12,2.25,5.75,1.26,.7,dark);

// Contoured blue hatchback. The cabin, wheel openings and glazing are real solids.
const car=new THREE.Group();car.position.set(7.15,.04,5.0);car.rotation.y=1.10;scene.add(car);
const blue=new THREE.MeshPhysicalMaterial({color:'#164d86',metalness:.65,roughness:.24,clearcoat:1,clearcoatRoughness:.15,envMapIntensity:1.25});
const blue2=new THREE.MeshPhysicalMaterial({color:'#255c93',metalness:.6,roughness:.26,clearcoat:1,clearcoatRoughness:.18});
const rubber=mat('#181a1b',.92),chrome=mat('#b1b9b9',.27,{metalness:.9}),carBlack=mat('#171e24',.4,{side:THREE.DoubleSide});
const carGlass=new THREE.MeshPhysicalMaterial({color:'#26363f',metalness:.34,roughness:.13,clearcoat:1,clearcoatRoughness:.1,envMapIntensity:1.4,side:THREE.DoubleSide});
function loft(sections,material,parent){
 const p=[],ids=[],uv=[],ring=10;
 for(let i=0;i<sections.length;i++){
  const [x,w,y0,y1]=sections[i];
  const pts=[[-w*.78,y0],[-w,y0+.10],[-w,y1-.08],[-w*.84,y1],[0,y1+.035],[w*.84,y1],[w,y1-.08],[w,y0+.1],[w*.78,y0],[0,y0]];
  for(let j=0;j<ring;j++){p.push(x,pts[j][1],pts[j][0]);uv.push(i/(sections.length-1),j/ring)}
  if(i<sections.length-1)for(let j=0;j<ring;j++){let a=i*ring+j,b=i*ring+(j+1)%ring;ids.push(a,b,a+ring,b,b+ring,a+ring)}
 }
 for(let j=1;j<ring-1;j++){ids.push(0,j+1,j);let b=(sections.length-1)*ring;ids.push(b,b+j,b+j+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return mesh(g,material,[0,0,0],[0,0,0],[1,1,1],parent);
}
loft([[-2.24,.72,.43,.86],[-2.1,.84,.42,.99],[-1.65,.86,.43,1.06],[-.83,.86,.43,1.16],[.5,.88,.43,1.17],[1.7,.87,.44,1.1],[2.12,.75,.47,.98]],blue,car).scale.z=.82;
for(let side of [-1,1]){
 const s=new THREE.Shape();s.moveTo(-2.23,.9);s.quadraticCurveTo(-2.12,1.0,-1.65,1.08);s.lineTo(-.82,1.17);s.lineTo(.65,1.18);s.quadraticCurveTo(1.9,1.18,2.13,.96);s.lineTo(2.13,.45);s.lineTo(1.91,.45);
 s.bezierCurveTo(1.88,1.18,.82,1.18,.77,.45);s.lineTo(-.77,.45);s.bezierCurveTo(-.82,1.18,-1.88,1.18,-1.92,.45);s.lineTo(-2.23,.45);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelSize:.022,bevelThickness:.022,bevelSegments:2,curveSegments:12});
 mesh(g,blue,[0,0,side*.86],[0,0,0],[1,1,side],car);
}
loft([[-.46,.665,1.755,1.815],[.05,.68,1.835,1.90],[.62,.68,1.84,1.91],[1.21,.66,1.775,1.845]],blue2,car);
function carPanel(verts,material){return poly(verts,material,car);}
for(let side of [-1,1]){
 let z=side*.754,zt=side*.681;
 carPanel([[-.79,1.25,z],[-.37,1.79,zt],[.40,1.83,zt],[.40,1.25,z]],carBlack);
 carPanel([[-.70,1.29,z+side*.012],[-.34,1.745,zt+side*.015],[.34,1.79,zt+side*.015],[.34,1.29,z+side*.012]],carGlass);
 carPanel([[.46,1.25,z],[.46,1.83,zt],[1.18,1.77,zt],[1.62,1.26,z]],carBlack);
 carPanel([[.52,1.30,z+side*.012],[.52,1.79,zt+side*.013],[1.14,1.73,zt+side*.013],[1.51,1.30,z+side*.012]],carGlass);
 lineTube([[-.8,1.18,side*.891],[.44,1.18,side*.908],[1.73,1.10,side*.865]],.013,chrome,car);
 lineTube([[.45,1.19,side*.895],[.48,.93,side*.915],[.46,.52,side*.897]],.007,carBlack,car);
 lineTube([[1.62,1.10,side*.88],[1.7,.96,side*.9],[1.73,.60,side*.87]],.007,carBlack,car);
 lineTube([[-.72,1.15,side*.89],[-.68,.80,side*.9],[-.62,.49,side*.88]],.007,carBlack,car);
 for(let x of [.19,1.34]){box(.20,.041,.048,x,1.09,side*.935,carBlack,car);box(.16,.018,.052,x-.015,1.10,side*.959,blue2,car)}
 box(1.45,.09,.045,0,.45,side*.9,blue2,car);
 rod([-.63,1.20,side*.80],[-.6,1.23,side*1.03],.035,carBlack,car);
 mesh(new THREE.SphereGeometry(1,12,8),blue,[-.63,1.26,side*1.075],[0,0,0],[.20,.10,.14],car);
 box(.018,.10,.17,-.45,1.26,side*1.085,carGlass,car);
}
carPanel([[-.922,1.23,-.724],[-.46,1.82,-.655],[-.46,1.82,.655],[-.922,1.23,.724]],carBlack);
carPanel([[-.926,1.29,-.66],[-.48,1.77,-.615],[-.48,1.77,.615],[-.926,1.29,.66]],carGlass);
carPanel([[1.79,1.24,.69],[1.22,1.81,.64],[1.22,1.81,-.64],[1.79,1.24,-.69]],carBlack);
carPanel([[1.795,1.29,.63],[1.27,1.765,.60],[1.27,1.765,-.60],[1.795,1.29,-.63]],carGlass);
lineTube([[-.918,1.255,-.53],[-.875,1.30,-.23],[-.86,1.32,.16]],.014,carBlack,car);
lineTube([[-.918,1.255,.5],[-.825,1.38,.26],[-.765,1.45,.04]],.014,carBlack,car);
box(.19,.022,.11,.55,1.93,0,carBlack,car);rod([.55,1.94,0],[.7,2.24,0],.011,carBlack,car);
// Wheels with tires, deep rims, discs and paired radial spokes.
for(let x of [-1.36,1.36])for(let side of [-1,1]){
 const z=side*.88;
 mesh(new THREE.CylinderGeometry(.485,.485,.23,28),rubber,[x,.51,z],[Math.PI/2,0,0],[1,1,1],car);
 mesh(new THREE.TorusGeometry(.376,.108,10,28),rubber,[x,.51,z+side*.104],[0,0,0],[1,1,1],car);
 mesh(new THREE.CylinderGeometry(.352,.352,.026,24),carBlack,[x,.51,z+side*.135],[Math.PI/2,0,0],[1,1,1],car);
 mesh(new THREE.TorusGeometry(.321,.026,6,24),chrome,[x,.51,z+side*.16],[0,0,0],[1,1,1],car);
 mesh(new THREE.CylinderGeometry(.265,.265,.012,24),mat('#65686a',.4,{metalness:.8}),[x,.51,z+side*.15],[Math.PI/2,0,0],[1,1,1],car);
 for(let i=0;i<5;i++)for(let offset of [-.07,.07]){
  let a=i/5*Math.PI*2+offset;
  const spoke=box(.046,.265,.033,x+Math.sin(a)*.182,.51+Math.cos(a)*.182,z+side*.18,chrome,car);spoke.rotation.z=-a;
 }
 mesh(new THREE.CylinderGeometry(.085,.085,.038,16),chrome,[x,.51,z+side*.185],[Math.PI/2,0,0],[1,1,1],car);
 for(let i=0;i<5;i++){let a=i/5*6.28;mesh(new THREE.SphereGeometry(.013,6,4),dark,[x+Math.sin(a)*.057,.51+Math.cos(a)*.057,z+side*.21],[0,0,0],[1,1,1],car)}
}
// Front grille and sculpted headlamp clusters.
box(.025,.27,1.22,-2.251,.56,0,carBlack,car);
for(let y of [.46,.52,.58,.64])box(.036,.018,1.17,-2.271,y,0,dark,car);
box(.029,.115,1.15,-2.237,.82,0,carBlack,car);
for(let y of [.78,.84])box(.038,.018,1.13,-2.257,y,0,chrome,car);
mesh(new THREE.TorusGeometry(.082,.014,6,16),chrome,[-2.28,.825,0],[0,Math.PI/2,0],[1,1,1],car);
const headlight=new THREE.MeshPhysicalMaterial({color:'#eef1de',roughness:.12,metalness:.25,clearcoat:1,emissive:'#f1dec1',emissiveIntensity:.12});
const tail=mat('#a52d24',.25,{metalness:.2,emissive:'#a01005',emissiveIntensity:.12});
for(let side of [-1,1]){
 box(.11,.16,.39,-2.17,.94,side*.60,carBlack,car);
 box(.117,.118,.33,-2.186,.95,side*.61,headlight,car);
 for(let z of [side*.52,side*.69])mesh(new THREE.SphereGeometry(.064,10,6),headlight,[-2.252,.955,z],[0,0,0],[.18,1,1],car);
 box(.14,.017,.34,-2.19,.902,side*.62,chrome,car);
 box(.07,.10,.24,-2.20,.55,side*.64,carBlack,car);
 box(.08,.044,.11,-2.245,.55,side*.65,headlight,car);
 box(.10,.20,.20,2.105,1.01,side*.65,tail,car);
 box(.09,.035,.14,2.16,1.02,side*.65,headlight,car);
}
box(.06,.16,.42,-2.287,.62,0,mat('#b9b8a7',.55),car);
box(.05,.12,.43,2.16,.73,0,mat('#b9b8a7',.55),car);
box(.035,.105,.50,2.135,.92,0,carBlack,car);mesh(new THREE.TorusGeometry(.058,.011,6,14),chrome,[2.16,.98,0],[0,Math.PI/2,0],[1,1,1],car);
box(.14,.11,1.28,2.10,.48,0,carBlack,car);rod([2.12,.42,-.51],[2.24,.42,-.51],.049,chrome,car);
lineTube([[-2.04,1.04,-.64],[-1.49,1.10,-.58],[-.90,1.16,-.55]],.011,blue2,car);
lineTube([[-2.04,1.04,.64],[-1.49,1.10,.58],[-.90,1.16,.55]],.011,blue2,car);

// Atmospheric landscape is actual low rolling terrain outside the garden.
const skyGeo=new THREE.SphereGeometry(95,24,12);
const skyColors=[],sp=skyGeo.getAttribute('position');
for(let i=0;i<sp.count;i++){
 const t=Math.max(0,Math.min(1,sp.getY(i)/95));
 const c=new THREE.Color('#bed1e1').lerp(new THREE.Color('#4e85c1'),Math.pow(t,.22));
 skyColors.push(c.r,c.g,c.b);
}
skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyColors,3));
const sky=mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,toneMapped:false,fog:false}));
sky.castShadow=false;sky.receiveShadow=false;
for(let i=0;i<11;i++){
 const a=i/11*Math.PI*2,x=Math.cos(a)*32,z=Math.sin(a)*32;
 const g=new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2);
 const m=mesh(g,mat(i%2?'#81948a':'#758b84',1),[x,-.2,z],[0,range(0,6.28),0],[range(7,13),range(3,6.5),range(7,12)]);
 m.castShadow=false;
}

// Flush all repeated geometry into native instanced meshes.
for(let b of batches.values()){
 const m=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);
 b.matrices.forEach((v,i)=>m.setMatrixAt(i,v));m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.receiveShadow=true;
 ((b.geometry===tileG||b.geometry===ridgeG)?houseRoot:b.parent).add(m);m.name='repeated-'+b.geometry.type;
}
scene.updateMatrixWorld(true);

const ready=renderer.init().then(()=>{
 if(!renderer.backend.isWebGPUBackend)throw new Error('This scene requires the native WebGPU backend.');
});
globalThis.__AGENT_BENCHMARK__={
 engine:'three',canvas:renderer.domElement,ready,
 async setCamera(c){camera.position.fromArray(c.position);camera.lookAt(...c.target);camera.fov=c.fovYDegrees;camera.near=c.near;camera.far=c.far;camera.updateProjectionMatrix();},
 async renderFrame(){await ready;renderer.render(scene,camera);},
 async inspectGeometry(){
  scene.updateMatrixWorld(true);const entries=[];
  scene.traverse(o=>{
   if(!o.isMesh||!o.visible)return;
   let ancestor=o.parent;while(ancestor){if(!ancestor.visible)return;ancestor=ancestor.parent}
   const g=o.geometry,position=g.getAttribute('position'),normal=g.getAttribute('normal');
   const entry={id:o.uuid,positions:position.array,worldMatrix:o.matrixWorld.toArray()};
   if(g.index)entry.indices=g.index.array;if(normal)entry.normals=normal.array;
   if(o.isInstancedMesh){entry.instances=[];const m=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);entry.instances.push(o.matrixWorld.clone().multiply(m).toArray())}}
   entries.push(entry);
  });return {meshes:entries};
 },
 async dispose(){renderer.dispose();scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});}
};
