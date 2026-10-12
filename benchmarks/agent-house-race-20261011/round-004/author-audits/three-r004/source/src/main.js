import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { color, mix, positionWorldDirection } from 'three/tsl';

let seed = 17429;
function rand(){ seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bed5e7');
scene.backgroundNode=mix(color('#e6e2d5'),color('#9fc5e8'),positionWorldDirection.y.mul(6).add(.68).clamp(0,1));
scene.fog = new THREE.Fog('#c6d7df',35,100);
const camera = new THREE.PerspectiveCamera(37,1024/768,.1,200);
camera.position.set(14,9,19); camera.lookAt(0,2.5,1);
if(!navigator.gpu)throw new Error('This scene requires native WebGPU.');
const renderer = new THREE.WebGPURenderer({antialias:true, samples:4, forceWebGL:false, alpha:false});
renderer.setPixelRatio(1); renderer.setSize(1024,768);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const sun=new THREE.DirectionalLight('#fff1d5',3.3);
sun.position.set(-11,16,10);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;
sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.camera.near=.5;sun.shadow.camera.far=65;
sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);scene.add(sun.target);
scene.add(new THREE.HemisphereLight('#d5e7f7','#9d9d69',1.35));
scene.add(new THREE.AmbientLight('#ffedd0',.18));

function texture(kind,size=256){
 const cv=document.createElement('canvas');cv.width=cv.height=size;const ctx=cv.getContext('2d');
 const palettes={stucco:[240,232,213],stone:[208,197,175],asphalt:[93,95,94],grass:[114,128,62],wood:[120,88,55],tile:[203,126,74]};
 const base=palettes[kind]; const im=ctx.createImageData(size,size);
 for(let p=0;p<size*size;p++){const a=(rand()-.5)*(kind==='stucco'?23:kind==='grass'?45:35);im.data[p*4]=base[0]+a;im.data[p*4+1]=base[1]+a;im.data[p*4+2]=base[2]+a;im.data[p*4+3]=255;}
 ctx.putImageData(im,0,0);
 if(kind==='grass'){for(let i=0;i<3500;i++){const x=rand()*size,y=rand()*size;ctx.strokeStyle=rand()>.5?'#849748':'#59652e';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*3-1.5,y-2-rand()*4);ctx.stroke();}}
 if(kind==='wood'){for(let i=0;i<80;i++){ctx.strokeStyle='rgba(24,15,8,.16)';ctx.beginPath();const x=rand()*size;ctx.moveTo(x,0);ctx.bezierCurveTo(x+8,80,x-8,160,x,size);ctx.stroke();}}
 const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(kind==='grass'?22:kind==='asphalt'?18:kind==='stucco'?5:1,kind==='grass'?22:kind==='asphalt'?18:kind==='stucco'?5:1);tx.anisotropy=4;return tx;
}
const stuccoTex=texture('stucco'),stoneTex=texture('stone'),asphaltTex=texture('asphalt'),grassTex=texture('grass'),woodTex=texture('wood'),tileTex=texture('tile');
function mat(c,extra={}){return new THREE.MeshStandardMaterial({color:c,roughness:.78,...extra});}
const M={
 stucco:mat('#ffffff',{map:stuccoTex,bumpMap:stuccoTex,bumpScale:.12}),
 trim:mat('#f8f0db',{map:stoneTex,bumpMap:stoneTex,bumpScale:.035}),
 stone:mat('#faf6eb',{map:stoneTex,bumpMap:stoneTex,bumpScale:.06}),
 stoneDark:mat('#ded6c5',{map:stoneTex}),
 mortar:mat('#857e6b'),asphalt:mat('#ffffff',{map:asphaltTex,bumpMap:asphaltTex,bumpScale:.028}),
 grass:mat('#e5e9cc',{map:grassTex,bumpMap:grassTex,bumpScale:.045}),
 terra:mat('#ffffff',{map:tileTex,bumpMap:tileTex,bumpScale:.025}),
 roofDark:mat('#7e4227'),frame:mat('#333b3d',{metalness:.45,roughness:.38}),
 glass:mat('#71848c',{metalness:.23,roughness:.16,transparent:true,opacity:.62,depthWrite:false}),
 brass:mat('#9a7850',{metalness:.7,roughness:.35}),
 dark:mat('#1c2428'),wood:mat('#d2a373',{map:woodTex}),white:mat('#e9e5d6'),pot:mat('#ab623b',{roughness:.9}),
 bark:mat('#72604a',{map:woodTex}),leaf:mat('#64733a'),leafLight:mat('#859052'),leafDark:mat('#455728'),
 blue:new THREE.MeshPhysicalMaterial({color:'#246da9',metalness:.28,roughness:.28,clearcoat:1,clearcoatRoughness:.2}),
 blueDark:mat('#153c64',{metalness:.5,roughness:.32}),silver:mat('#a5a9a7',{metalness:.85,roughness:.23}),
 rubber:mat('#181b1d',{roughness:.87}),lamp:mat('#eee8cb',{metalness:.15,roughness:.18}),
 red:mat('#9d2520',{metalness:.25,roughness:.2}),chrome:mat('#e0ded7',{metalness:.95,roughness:.13})
};
let id=0;
function add(g,m,pos=[0,0,0],rot=[0,0,0],parent=scene){
 const mesh=new THREE.Mesh(g,m);mesh.name='part-'+(++id);mesh.position.set(...pos);mesh.rotation.set(...rot);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
const boxG=new THREE.BoxGeometry(1,1,1),ballG=new THREE.IcosahedronGeometry(1,1),stoneG=new RoundedBoxGeometry(1,1,1,2,.07);
function box(w,h,d,pos,m,rot=[0,0,0],parent=scene){const o=add(boxG,m,pos,rot,parent);o.scale.set(w,h,d);return o;}
function sphere(pos,scale,m,parent=scene){const o=add(ballG,m,pos,[0,0,0],parent);o.scale.set(...scale);return o;}
function cyl(r1,r2,h,pos,m,n=12,rot=[0,0,0],parent=scene){return add(new THREE.CylinderGeometry(r1,r2,h,n),m,pos,rot,parent);}
function beam(a,b,r,m,parent=scene){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),dir=q.clone().sub(p);const o=cyl(r*.76,r,dir.length(),p.clone().add(q).multiplyScalar(.5).toArray(),m,8,[0,0,0],parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return o;}
function surface(points,indices,m,parent=scene){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex(indices);g.computeVertexNormals();return add(g,m,[0,0,0],[0,0,0],parent);}
function polygon(points,m,parent=scene){return surface(points,Array.from({length:points.length-2},(_,i)=>[0,i+1,i+2]).flat(),m,parent);}
function batch(g,m,rows,name){
 const o=new THREE.InstancedMesh(g,m,rows.length);o.name=name+'-'+(++id);const dummy=new THREE.Object3D();
 rows.forEach((a,i)=>{dummy.position.set(...a.p);dummy.rotation.set(...(a.r||[0,0,0]));dummy.scale.set(...(a.s||[1,1,1]));dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);if(a.c)o.setColorAt(i,new THREE.Color(a.c));});
 o.instanceMatrix.needsUpdate=true;o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;
}
box(44,.3,44,[0,-.2,0],M.grass);
// Road ribbons: a curve wraps around the planted lot.
const curve=new THREE.CatmullRomCurve3([
 new THREE.Vector3(-19,0,9.8),new THREE.Vector3(-10,0,9.9),new THREE.Vector3(-2,0,10.1),
 new THREE.Vector3(5.4,0,8.9),new THREE.Vector3(10.4,0,3.9),new THREE.Vector3(11,0,-5),new THREE.Vector3(10.7,0,-19)
]);
function sample(t,offset=0){const p=curve.getPoint(t),tan=curve.getTangent(t);return new THREE.Vector3(p.x+tan.z*offset,0,p.z-tan.x*offset);}
function ribbon(a,b,y,m,steps=160){
 const pos=[],ix=[];
 for(let i=0;i<=steps;i++){const t=i/steps;for(const off of[a,b]){const p=sample(t,off);pos.push(p.x,y,p.z);}}
 for(let i=0;i<steps;i++){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
 const uv=[];for(let i=0;i<=steps;i++){uv.push(i/steps,0,i/steps,1);}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 return add(g,m);
}
ribbon(-2.3,2.3,.015,M.asphalt);ribbon(2.3,3.25,.12,M.trim);
const curbRows=[],paveRows=[];
for(let i=0;i<100;i++){const t=(i+.5)/100,p=sample(t,2.28),tan=curve.getTangent(t),angle=Math.atan2(tan.x,tan.z);curbRows.push({p:[p.x,.08,p.z],r:[0,angle,0],s:[.18,.18,.57],c:i%3===0?'#beb7a5':'#d9cfb8'});}
batch(stoneG,M.stone,curbRows,'curb-blocks');
for(let i=0;i<90;i++){const t=(i+.5)/90,p=sample(t,2.79),tan=curve.getTangent(t);paveRows.push({p:[p.x,.116,p.z],r:[0,Math.atan2(tan.x,tan.z),0],s:[.83,.09,.63]});}
batch(stoneG,M.stone,paveRows,'sidewalk-slabs');
for(let i=1;i<27;i+=2){const t=i/27,p=sample(t,-.35),tangent=curve.getTangent(t);box(.14,.012,1.4,[p.x,.026,p.z],M.white,[0,Math.atan2(tangent.x,tangent.z),0]);}
// House: front z=2.2, two storeys and gable across the short dimension.
const hx=-1,front=2.1,back=-4.1,wallTop=5.7,halfW=4.25;
box(8.7,.35,6.45,[hx,.2,-1],M.stoneDark);
function facade(horizontal,depth,width,height,openings,side=false){
 let xs=[-width/2,width/2],ys=[.36,height];openings.forEach(o=>{xs.push(o.x-o.w/2,o.x+o.w/2);ys.push(o.y-o.h/2,o.y+o.h/2);});xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
 xs=[...new Set(xs)];ys=[...new Set(ys)];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;if(openings.some(o=>Math.abs(x-o.x)<o.w/2&&Math.abs(y-o.y)<o.h/2))continue;
 if(side)box(.25,ys[j+1]-ys[j],xs[i+1]-xs[i],[horizontal,y,depth+x],M.stucco);
 else box(xs[i+1]-xs[i],ys[j+1]-ys[j],.25,[horizontal+x,y,depth],M.stucco);}
}
const frontOpen=[{x:-2.65,y:1.82,w:1.05,h:1.45},{x:2.35,y:1.82,w:1.05,h:1.45},{x:-2.5,y:4.48,w:1.4,h:1.5},{x:1.95,y:4.48,w:1.5,h:1.5},{x:.1,y:1.62,w:1.12,h:2.52}];
const sideOpen=[{x:-1.5,y:1.82,w:.95,h:1.45},{x:1.35,y:1.82,w:.95,h:1.45},{x:-1.5,y:4.48,w:.88,h:1.5},{x:1.35,y:4.48,w:.88,h:1.5}];
facade(hx,front,8.5,wallTop,frontOpen);
facade(hx,back,8.5,wallTop,[{x:-2.3,y:4.48,w:1.4,h:1.5},{x:2.3,y:4.48,w:1.4,h:1.5},{x:0,y:1.82,w:1.4,h:1.45}]);
facade(hx+halfW,-1,6.2,wallTop,sideOpen,true);facade(hx-halfW,-1,6.2,wallTop,sideOpen,true);
const peak=7.72,eave=5.74,roofFront=2.58,roofBack=-4.58,roofMid=-1;
for(const x of[hx-halfW,hx+halfW]){
 polygon([[x,wallTop,front],[x,wallTop,back],[x,peak,roofMid]],M.stucco);
 polygon([[x-.12,wallTop,back],[x-.12,wallTop,front],[x-.12,peak,roofMid]],M.stucco);
}
function windowUnit(x,y,z,w,h,yaw=0){
 const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=yaw;scene.add(group);
 box(w+.09,h+.09,.16,[0,0,-.055],M.trim,[0,0,0],group);
 box(w-.13,h-.1,.05,[0,0,.015],M.dark,[0,0,0],group);
 box(w-.2,h-.22,.025,[0,0,.046],M.glass,[0,0,0],group);
 for(const dx of[-w/2+.04,w/2-.04,0])box(.058,h,.13,[dx,0,.09],M.frame,[0,0,0],group);
 for(const dy of[-h/2+.04,h/2-.04,0])box(w,.05,.13,[0,dy,.09],M.frame,[0,0,0],group);
 box(w+.28,.09,.36,[0,-h/2-.07,.11],M.trim,[0,0,0],group);
 // Curtain strips are tucked behind the glazing.
 for(const dx of[-w*.33,w*.33])box(w*.18,h*.9,.016,[dx,0,.035],mat('#b8ad96'),[0,0,0],group);
}
frontOpen.filter(o=>o.h<2).forEach(o=>windowUnit(hx+o.x,o.y,front+.075,o.w,o.h));
for(const x of[hx-halfW,hx+halfW])for(const o of sideOpen)windowUnit(x+(x>hx?.075:-.075),o.y,-1+o.x,o.w,o.h,x>hx?Math.PI/2:-Math.PI/2);
windowUnit(hx-2.3,4.48,back-.08,1.4,1.5,Math.PI);windowUnit(hx+2.3,4.48,back-.08,1.4,1.5,Math.PI);
windowUnit(hx,1.82,back-.08,1.4,1.45,Math.PI);
box(1.04,2.48,.16,[hx+.1,1.62,front-.06],M.frame);
for(const y of[.95,1.92])for(const x of[-.24,.25]){box(.37,.7,.035,[hx+.1+x,y,front+.037],M.dark);box(.3,.62,.023,[hx+.1+x,y,front+.06],M.frame);}
box(.025,.22,.04,[hx-.26,1.55,front+.15],M.brass);
box(1.15,.06,.35,[hx+.1,.38,front+.14],M.trim);
function roof(width,z0,z1,y0,y1,centerX,name){
 const slope=Math.atan((y1-y0)/(z1-z0)),length=Math.hypot(z1-z0,y1-y0);
 box(width,.15,length,[centerX,(y0+y1)/2,(z0+z1)/2],M.roofDark,[-slope,0,0]);
 const rows=[], channels=Math.round(width/.28),runs=Math.ceil(length/.42);
 const tileG=new THREE.BufferGeometry(),tp=[],ti=[],tu=[];
 for(let r=0;r<4;r++)for(let v=0;v<=8;v++){const a=v/8*Math.PI;const z=[-.265,-.235,.19,.265][r];tp.push(Math.cos(a)*.141,Math.sin(a)*(.118+(r===0?.014:0))+(r===0?.022:0),z);tu.push(v/8,r/3);}
 for(let r=0;r<3;r++)for(let v=0;v<8;v++){const a=r*9+v;ti.push(a,a+1,a+9,a+1,a+10,a+9);}
 tileG.setAttribute('position',new THREE.Float32BufferAttribute(tp,3));tileG.setAttribute('uv',new THREE.Float32BufferAttribute(tu,2));tileG.setIndex(ti);tileG.computeVertexNormals();
 // Barrel axes run from eaves toward ridge. A curved half cylinder provides the actual tile profile.
 for(let a=0;a<channels;a++)for(let b=0;b<runs;b++){
 const u=(b+.35)/runs,z=z0+(z1-z0)*u,y=y0+(y1-y0)*u;
 const shade=['#ffefdd','#e8d0b4','#fff9ee','#d8bc9e','#f9e3c9'][Math.floor(rand()*5)];
 rows.push({p:[centerX-width/2+(a+.5)*width/channels,y+.105,z],r:[-slope,0,0],s:[1,1,length/runs/.48],c:shade});
 }
 batch(tileG,M.terra,rows,name+'-barrel-tiles');
 // Eave fascia and gutters.
 box(width,.14,.14,[centerX,y0-.06,z0],M.wood);
}
roof(9.4,roofFront,roofMid,eave,peak,hx,'front-roof');
roof(9.4,roofBack,roofMid,eave,peak,hx,'back-roof');
const ridgeRows=[];for(let i=0;i<33;i++)ridgeRows.push({p:[hx-4.7+(i+.5)*9.4/33,peak+.13,roofMid],r:[0,0,Math.PI/2],s:[1,1,.7],c:'#f6e1ca'});
batch(new THREE.CylinderGeometry(.18,.18,.42,10,1,true,0,Math.PI),M.terra,ridgeRows,'ridge-caps');
box(9.4,.09,.24,[hx,peak+.02,roofMid],M.terra);
for(const x of[hx-4.69,hx+4.69]){
 beam([x,eave-.12,roofFront+.06],[x,peak+.03,roofMid],.065,M.wood);beam([x,peak+.03,roofMid],[x,eave-.12,roofBack-.06],.065,M.wood);
}
for(const z of[roofFront+.05,roofBack-.05]){
 cyl(.065,.065,9.5,[hx,eave-.1,z],M.frame,12,[0,0,Math.PI/2]);
 for(const x of[hx-4.25,hx+4.25]){beam([x,eave-.1,z],[x,5.45,z+.07],.042,M.frame);beam([x,5.45,z+.07],[x,.22,z+.07],.042,M.frame);}
}
// Porch with a shallow tiled lean-to, capitals, beams and two real supports.
const porchX=hx+.1,porchWidth=5.6;
box(5.75,.2,1.8,[porchX,.35,3],M.trim);
box(3.5,.13,.48,[porchX,.22,4.02],M.stone);box(2.9,.13,.46,[porchX,.1,4.44],M.stone);
for(const x of[porchX-2.4,porchX+2.4]){
 box(.37,2.65,.37,[x,1.8,3.78],M.stucco);box(.53,.18,.52,[x,.53,3.78],M.trim);box(.55,.17,.52,[x,3.01,3.78],M.trim);
 box(.44,.12,.44,[x,2.87,3.78],M.trim);
}
box(5.65,.22,.28,[porchX,3.13,3.8],M.wood);
roof(porchWidth,4.08,2.07,3.23,3.75,porchX,'porch');
box(5.7,.13,.17,[porchX,3.22,4.1],M.frame);
// Chimney with open black flue, supporting posts and terracotta cap.
const chimneyX=hx+2.6,chimneyZ=-.55;
box(.7,1.25,.72,[chimneyX,7.53,chimneyZ],M.stucco);box(.84,.12,.86,[chimneyX,8.11,chimneyZ],M.trim);
box(.5,.18,.5,[chimneyX,8.24,chimneyZ],M.dark);
for(const x of[-.31,.31])for(const z of[-.31,.31])box(.12,.42,.12,[chimneyX+x,8.37,chimneyZ+z],M.trim);
box(.98,.13,1.0,[chimneyX,8.59,chimneyZ],M.terra);
const capG=new THREE.ConeGeometry(.73,.16,4);add(capG,M.terra,[chimneyX,8.72,chimneyZ],[0,Math.PI/4,0]);
// Front lantern.
beam([hx-.86,2.42,front+.12],[hx-.86,2.42,front+.46],.03,M.dark);
box(.2,.3,.2,[hx-.86,2.23,front+.43],M.lamp);
for(const x of[-.11,.11])for(const z of[-.11,.11])box(.022,.36,.022,[hx-.86+x,2.23,front+.43+z],M.dark);
add(new THREE.ConeGeometry(.19,.16,4),M.dark,[hx-.86,2.46,front+.43],[0,Math.PI/4,0]);

// Irregular flagstone entrance and side walk.
const pathRows=[];
function paver(x,z,w,d){pathRows.push({p:[x,.045,z],s:[w,.1,d],r:[0,(rand()-.5)*.16,0],c:['#cac1aa','#bcb9a5','#d4cbb4','#b1ab99'][Math.floor(rand()*4)]});}
for(let z=4.6;z<7.6;z+=.43)for(let x=porchX-1.05;x<=porchX+1.05;x+=.52)paver(x+(rand()-.5)*.07,z,.48,.4);
for(let z=-4.6;z<6.6;z+=.55)for(let x=3.6;x<6.8;x+=.59)paver(x,z,.55,.5);
const flagG=new THREE.BufferGeometry(),fp=[],fi=[];
const outline=[[-.48,-.32],[-.28,-.5],[.34,-.46],[.5,-.1],[.43,.39],[.08,.5],[-.42,.42]];
for(const y of [-.5,.5])for(const p of outline)fp.push(p[0],y,p[1]);
for(let i=1;i<outline.length-1;i++){fi.push(7,7+i+1,7+i);fi.push(0,i,i+1);}
for(let i=0;i<7;i++){const j=(i+1)%7;fi.push(i,j,i+7,j,j+7,i+7);}
flagG.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));flagG.setIndex(fi);flagG.computeVertexNormals();
batch(flagG,M.stone,pathRows,'flagstone-path');
// Boundary masonry with staggered blocks and a capped top. Opening aligns with path.
const wallBlockRows=[],wallCapRows=[];
function wallSegment(a,b){
 const v=new THREE.Vector3(b[0]-a[0],0,b[1]-a[1]),len=v.length(),ang=Math.atan2(v.x,v.z),n=Math.ceil(len/.6);
 box(.42,.88,len,[(a[0]+b[0])/2,.49,(a[1]+b[1])/2],M.mortar,[0,ang,0]);
 for(let row=0;row<4;row++)for(let k=0;k<n;k++){const u=(k+.5+(row%2)*.45)/n;if(u>1)continue;
 wallBlockRows.push({p:[a[0]+v.x*u,.18+row*.21,a[1]+v.z*u],s:[.47,.18,len/n-.025],r:[0,ang,0],c:['#b8ad92','#cbc0a1','#a79f89','#d0c3a8'][Math.floor(rand()*4)]});}
 for(let k=0;k<n;k++){const u=(k+.5)/n;wallCapRows.push({p:[a[0]+v.x*u,.95,a[1]+v.z*u],s:[.57,.13,len/n+.01],r:[0,ang,0],c:'#d1c5ac'});}
}
const wb=[];for(let i=12;i<=67;i++){const t=i/100,p=sample(t,3.55);wb.push([p.x,p.z]);}
for(let i=0;i<wb.length-1;i++){const a=wb[i],b=wb[i+1];if((a[0]+b[0])/2>porchX-1.25&&(a[0]+b[0])/2<porchX+1.25&&a[1]>5)continue;wallSegment(a,b);}
batch(stoneG,M.stone,wallBlockRows,'boundary-stone-blocks');batch(stoneG,M.stone,wallCapRows,'boundary-coping');
for(const x of[porchX-1.28,porchX+1.28]){
 const z=sample(.34,3.55).z;
 box(.62,1.46,.62,[x,.73,z],M.mortar);
 const rows=[];for(let r=0;r<6;r++)for(let k=0;k<2;k++)rows.push({p:[x+(k-.5)*.3,.13+r*.23,z+.31],s:[.29,.205,.08],c:r%2?'#b3a58a':'#c4b799'});
 batch(stoneG,M.stone,rows,'gate-pillar-faces');box(.81,.15,.81,[x,1.47,z],M.trim);
}
// Mailbox at entrance, arched roof and front slot.
const mailX=porchX-1.87,mailZ=6.65;
box(.1,1.18,.1,[mailX,.62,mailZ],M.frame);box(.55,.43,.34,[mailX,1.23,mailZ],M.frame);
add(new THREE.CylinderGeometry(.28,.28,.37,16,1,false,0,Math.PI),M.frame,[mailX,1.43,mailZ],[Math.PI/2,0,0]);
box(.28,.025,.013,[mailX,1.34,mailZ+.19],M.dark);box(.11,.04,.02,[mailX+.13,1.2,mailZ+.19],M.brass);

// Fixed-seed vegetation. Branches and leaf volumes are authored in the world.
const leafRows={dark:[],mid:[],light:[]};
function leafClump(p,s,mode='mid'){leafRows[mode].push({p,s,r:[rand()*2,rand()*6,rand()*2]});}
function shrub(x,z,r=.65,y=.18){
 for(let i=0;i<12;i++){const a=rand()*Math.PI*2,rr=Math.sqrt(rand())*r;const h=.22+rand()*.38;leafClump([x+Math.cos(a)*rr,y+h,z+Math.sin(a)*rr],[.25+rand()*.23,.26+rand()*.35,.25+rand()*.22],i%4===0?'light':i%3===0?'dark':'mid');}
}
function tree(x,z,size=1){
 beam([x,.05,z],[x+.12*size,1.9*size,z],.15*size,M.bark);
 for(let j=0;j<7;j++){const a=j/7*Math.PI*2+.4,px=x+Math.cos(a)*1.2*size,pz=z+Math.sin(a)*1.2*size,py=(2.1+rand()*.7)*size;
 beam([x+.1*size,1.35*size,z],[px,py,pz],.08*size,M.bark);
 for(let k=0;k<9;k++){const a2=rand()*Math.PI*2,rr=rand()*.8*size;leafClump([px+Math.cos(a2)*rr,py+rand()*.8*size,pz+Math.sin(a2)*rr],[(.45+rand()*.4)*size,(.36+rand()*.4)*size,(.45+rand()*.4)*size],k%3===0?'light':'mid');}
 }
}
tree(-7,3.35,.95);tree(6.2,-3,.82);tree(-8,-5.5,.93);tree(5.8,-9,.96);
function cypress(x,z,h){
 beam([x,0,z],[x,h*.72,z],.12,M.bark);
 for(let i=0;i<9;i++){const y=.45+i*h/10,r=.7*(1-i/11);leafClump([x+(rand()-.5)*.14,y,z+(rand()-.5)*.14],[r,h*.15,r],'dark');}
}
cypress(-8.6,-3.7,6.1);cypress(-6.8,-7,5.2);cypress(8,-11,5.6);
for(const p of[[-5.7,1.9],[-4.7,3.3],[-6,5.7],[-4,5.6],[1.7,5.3],[2.7,4.9],[4.9,2.1],[5.5,-.5],[5.6,-5.5],[-7.7,.8],[-9.2,5],[-10,6.3]])shrub(...p,.55);
for(let i=21;i<64;i+=2){const p=sample(i/100,4.05);if(p.x>porchX-1.5&&p.x<porchX+1.5&&p.z>5)continue;shrub(p.x,p.z,.44,.25);}
function pot(x,z,r=.34){
 cyl(r*.9,r*.65,.52,[x,.57,z],M.pot,20);cyl(r,r,.09,[x,.85,z],M.pot,20);cyl(r*.86,r*.86,.03,[x,.88,z],mat('#483b29'),20);
 beam([x,.88,z],[x,1.75,z],.025,M.bark);
 for(let j=0;j<9;j++){const a=j/9*Math.PI*2;leafClump([x+Math.cos(a)*.3,1.63+rand()*.25,z+Math.sin(a)*.3],[.23,.3,.23],'mid');}
}
pot(-2.62,2.92);pot(.0,3.07,.28);pot(2.55,3.0,.4);
// Dense, small, slightly folded individual leaves break up olive crowns.
const leafG=new THREE.BufferGeometry();
leafG.setAttribute('position',new THREE.Float32BufferAttribute([-.42,0,0, 0,.08,.9, .42,0,0, 0,-.07,-.9, 0,.12,0],3));
leafG.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);leafG.computeVertexNormals();
for(const key of ['dark','mid','light']){
 const fine=[],cores=[];
 for(const a of leafRows[key]){
  cores.push({p:a.p,s:a.s.map(v=>v*.27),r:a.r});
  const count=a.s[1]>1?55:28;
  for(let j=0;j<count;j++){
   const az=rand()*Math.PI*2,v=rand()*2-1,rad=Math.cbrt(rand()),rr=Math.sqrt(1-v*v);
   fine.push({p:[a.p[0]+Math.cos(az)*rr*rad*a.s[0],a.p[1]+v*rad*a.s[1],a.p[2]+Math.sin(az)*rr*rad*a.s[2]],s:[.12+rand()*.10,.9,.12+rand()*.09],r:[rand()*Math.PI,rand()*6.28,rand()*3]});
  }
 }
 const lm=mat(key==='dark'?'#4c6032':key==='light'?'#8b975e':'#72804b',{side:THREE.DoubleSide,roughness:.9});
 batch(leafG,lm,fine,'individual-'+key+'-leaves');
 batch(ballG,lm,cores,key+'-foliage-cores');
}
// Lavender beside the porch and daisies in the low border.
const flowerRows=[],grassBladeRows=[];
for(const p of[[-4.25,3.5],[1.6,3.9],[-5.3,5.6],[3.2,4.7]]){
 for(let i=0;i<28;i++){const x=p[0]+(rand()-.5)*.9,z=p[1]+(rand()-.5)*.8,h=.25+rand()*.4;beam([x,.1,z],[x,h,z],.008,M.leafDark);flowerRows.push({p:[x,h,z],s:[.04,.11,.04],c:i%3?'#8e789a':'#b29bba'});}
}
batch(ballG,mat('#a390b1'),flowerRows,'lavender');
for(let i=0;i<250;i++){const x=-10+rand()*18,z=-6+rand()*13;if(z>5.8&&Math.abs(x-porchX)<1.2)continue;grassBladeRows.push({p:[x,.14,z],s:[.025,.1+rand()*.12,.025],r:[0,rand()*6,(rand()-.5)*.4]});}
batch(new THREE.ConeGeometry(1,1,3),M.leaf,grassBladeRows,'grass-tufts');
// Wooden side garden gate.
for(let i=0;i<13;i++)box(.16,1.6,.12,[5.5+i*.17,.86,-3.3],M.wood);
for(const y of[.4,1.3])box(2.4,.1,.18,[6.5,y,-3.36],M.bark);

// Blue hatchback, assembled in its local coordinates, facing forward (+Z).
const car=new THREE.Group();car.name='blue-hatchback';car.position.set(7.6,.05,6.6);car.rotation.y=-.75;scene.add(car);
function cbox(w,h,d,p,m,rot=[0,0,0]){return box(w,h,d,p,m,rot,car);}
function cpoly(p,m){return polygon(p,m,car);}
function loft(stations,m){
 const verts=[],idx=[];const profile=[[-.82,.02],[-1,.22],[-1,.68],[-.9,.83],[-.68,1],[.68,1],[.9,.83],[1,.68],[1,.22],[.82,.02]];
 stations.forEach(s=>{for(const p of profile)verts.push(p[0]*s.w,s.bottom+p[1]*s.h,s.z);});
 const n=profile.length;for(let k=0;k<stations.length-1;k++)for(let j=0;j<n;j++){let a=k*n+j,b=k*n+(j+1)%n,c=(k+1)*n+j,d=(k+1)*n+(j+1)%n;idx.push(a,c,b,b,c,d);}
 for(let k of[0,stations.length-1])for(let j=1;j<n-1;j++){if(k===0)idx.push(k*n,k*n+j,k*n+j+1);else idx.push(k*n,k*n+j+1,k*n+j);}
 return surface(Array.from({length:verts.length/3},(_,i)=>verts.slice(i*3,i*3+3)),idx,m,car);
}
loft([{z:-2.06,w:.82,bottom:.35,h:.68},{z:-1.82,w:.99,bottom:.36,h:.78},{z:-1,w:1,bottom:.34,h:.78},{z:.85,w:1,bottom:.33,h:.79},{z:1.82,w:.94,bottom:.34,h:.7},{z:2.1,w:.84,bottom:.38,h:.49}],M.blue);
cbox(1.55,.14,3.4,[0,.34,0],M.dark);
// Bonnet, roof and cabin shell are separate contoured surfaces.
// Cabin roof has a gently crowned surface; its sides remain open for glazing.
surface([[-.77,1.66,-1.05],[.77,1.66,-1.05],[-.77,1.7,.14],[.77,1.7,.14],[0,1.77,-1.05],[0,1.8,.14]],
[0,2,4,4,2,5,4,5,1,1,5,3],M.blue,car);
cbox(1.64,.1,.31,[0,1.05,-1.8],M.blue);

cbox(1.74,.055,2.62,[0,.84,-.11],M.dark);
const carGlass=new THREE.MeshPhysicalMaterial({color:'#384b57',metalness:.2,roughness:.12,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false,clearcoat:1});
cpoly([[-.72,1.67,.17],[.72,1.67,.17],[.87,1.07,.91],[-.87,1.07,.91]],carGlass);
cpoly([[.71,1.65,-.99],[-.71,1.65,-.99],[-.82,1.13,-1.65],[.82,1.13,-1.65]],carGlass);
for(const sx of[-1,1]){
 cpoly([[sx*.91,1.06,.75],[sx*.77,1.66,.12],[sx*.77,1.67,-.48],[sx*.95,1.07,-.48]],carGlass);
 cpoly([[sx*.95,1.07,-.61],[sx*.77,1.67,-.61],[sx*.78,1.63,-.99],[sx*.89,1.11,-1.5]],carGlass);
 beam([sx*.96,1.04,-.54],[sx*.77,1.73,-.54],.037,M.dark,car);
 beam([sx*.91,1.04,.78],[sx*.77,1.7,.14],.037,M.blue,car);
 beam([sx*.9,1.05,-1.58],[sx*.76,1.67,-1.02],.045,M.blue,car);
 beam([sx*.96,1.04,.81],[sx*.95,1.04,-1.58],.022,M.chrome,car);
 cbox(.045,.065,.24,[sx*1.005,1.0,-.4],M.blueDark);
 cbox(.045,.065,.24,[sx*1.005,1.0,-1.36],M.blueDark);
 // Door seams and rocker contours.
 beam([sx*1.006,.45,-.57],[sx*1.006,1.03,-.57],.009,M.blueDark,car);
 beam([sx*.99,.47,1.04],[sx*1.015,.99,.74],.008,M.blueDark,car);
 beam([sx*.98,.49,-1.68],[sx*1.006,1.05,-1.55],.008,M.blueDark,car);
 cbox(.07,.11,2.74,[sx*.98,.4,-.04],M.blueDark);
 beam([sx*.9,1.1,.64],[sx*1.14,1.15,.67],.05,M.dark,car);
 sphere([sx*1.16,1.17,.66],[.2,.11,.18],M.blue,car);
 cbox(.017,.105,.23,[sx*1.3,1.175,.66],M.glass);
}
for(const x of[-.43,.43]){
 cbox(.48,.43,.21,[x,1.04,-.22],mat('#8b897b'));cbox(.3,.19,.14,[x,1.37,-.22],mat('#9d9b8c'));
 cbox(.5,.21,.64,[x,.82,.07],mat('#858477'));
 cbox(.47,.41,.2,[x,1.0,-1.0],mat('#858477'));
}
cbox(1.65,.15,.33,[0,1.02,.66],M.dark);
const steer=add(new THREE.TorusGeometry(.17,.027,8,24),M.dark,[-.46,1.17,.53],[-.6,0,0],car);
beam([-.46,1.06,.59],[-.46,1.17,.53],.033,M.dark,car);
// Window wipers and short antenna.
beam([-.61,1.085,.893],[-.2,1.13,.84],.012,M.dark,car);beam([.2,1.085,.893],[.65,1.12,.85],.012,M.dark,car);
beam([.1,1.77,-.77],[.1,2.03,-.89],.012,M.dark,car);
// Wheels, rubber tread bands, alloy spokes and brake discs.
for(const x of[-1.005,1.005])for(const z of[-1.3,1.32]){
 const sx=Math.sign(x);
 cyl(.43,.43,.28,[x,.5,z],M.rubber,28,[0,0,Math.PI/2],car);
 for(const dx of[-.11,.11])add(new THREE.TorusGeometry(.38,.055,7,28),M.rubber,[x+dx,.5,z],[0,Math.PI/2,0],car);
 cyl(.32,.32,.025,[x+sx*.147,.5,z],M.silver,24,[0,0,Math.PI/2],car);
 cyl(.254,.254,.03,[x+sx*.167,.5,z],M.dark,24,[0,0,Math.PI/2],car);
 add(new THREE.TorusGeometry(.292,.028,7,24),M.chrome,[x+sx*.19,.5,z],[0,Math.PI/2,0],car);
 for(let a=0;a<10;a++){const an=a/10*Math.PI*2;beam([x+sx*.198,.5+Math.cos(an)*.085,z+Math.sin(an)*.085],[x+sx*.198,.5+Math.cos(an+.1)*.275,z+Math.sin(an+.1)*.275],.018,M.silver,car);}
 cyl(.073,.073,.025,[x+sx*.2,.5,z],M.chrome,16,[0,0,Math.PI/2],car);
 // Upper wheel arch lips, open below the axle.
 const arch=new THREE.TorusGeometry(.465,.035,6,20,Math.PI);
 add(arch,M.blue,[x,.5,z],[0,Math.PI/2,-Math.PI/2],car);
}
cbox(1.65,.22,.13,[0,.47,2.02],M.blue);
cbox(1.25,.18,.08,[0,.5,2.101],M.dark);
for(let y=.445;y<=.565;y+=.04)cbox(1.25,.014,.018,[0,y,2.152],M.frame);
cbox(1.37,.13,.06,[0,.83,2.04],M.dark);
for(let y=.79;y<=.86;y+=.035)cbox(1.37,.012,.014,[0,y,2.075],M.chrome);
cbox(.45,.14,.027,[0,.66,2.14],M.frame);
add(new THREE.TorusGeometry(.082,.022,6,20),M.chrome,[0,.86,2.09],[0,0,0],car);
for(const x of[-.7,.7]){
 sphere([x,.85,1.996],[.23,.09,.06],M.chrome,car);
 sphere([x,.856,2.043],[.21,.067,.025],M.lamp,car);
 sphere([x+Math.sign(x)*.13,.854,2.034],[.045,.065,.035],mat('#c7a465'),car);
 cbox(.26,.095,.065,[x,.49,2.044],M.dark);sphere([x,.49,2.084],[.095,.03,.016],M.lamp,car);
 sphere([x,.96,-1.995],[.16,.19,.085],M.red,car);
}
cbox(1.75,.18,.14,[0,.49,-2.015],M.blueDark);cbox(.45,.16,.025,[0,.78,-2.1],M.white);
cbox(1.6,.06,.18,[0,1.7,-1.15],M.blue);beam([-.35,1.26,-1.55],[.35,1.29,-1.55],.018,M.dark,car);

// Rounded distant ridges soften the sky line.
for(let i=0;i<7;i++){const x=-29+i*9;const hill=add(new THREE.SphereGeometry(1,24,12),mat(i%2?'#91a5ab':'#a1afb1'),[x,-.5,-30-rand()*5]);hill.scale.set(7+rand()*4,2+rand()*2,6);hill.castShadow=false;}
// A procedural sky/ground environment supplies natural reflection highlights.
const envFaces=[];
for(let side=0;side<6;side++){
 const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d');
 const gr=ctx.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#b7d3e9');gr.addColorStop(.48,'#edf0e9');gr.addColorStop(.55,'#d6cdb5');gr.addColorStop(1,'#687345');
 ctx.fillStyle=gr;ctx.fillRect(0,0,128,128);
 if(side===2){ctx.fillStyle='#dae6ee';ctx.fillRect(0,0,128,128);}
 if(side===3){ctx.fillStyle='#859164';ctx.fillRect(0,0,128,128);}
 envFaces.push(cv);
}
const env=new THREE.CubeTexture(envFaces);env.colorSpace=THREE.SRGBColorSpace;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.55;
// A uniform layout scale gives the fixed cameras margin around the car and lot.
const village=new THREE.Group();village.name='village';
for(const o of [...scene.children])if(o.isMesh||o.isGroup)village.add(o);
village.scale.setScalar(.9);scene.add(village);
scene.updateMatrixWorld(true);
const ready=renderer.init().then(()=>{if(!renderer.backend.isWebGPUBackend)throw new Error('Native WebGPU backend is required.');});
globalThis.__AGENT_BENCHMARK__={
 engine:'three',canvas:renderer.domElement,ready,
 async setCamera(c){camera.position.fromArray(c.position);camera.fov=c.fovYDegrees;camera.near=c.near;camera.far=c.far;camera.lookAt(new THREE.Vector3().fromArray(c.target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);},
 async renderFrame(){await ready;renderer.render(scene,camera);},
 async inspectGeometry(){
  scene.updateMatrixWorld(true);const meshes=[];
  scene.traverse(o=>{if(!o.isMesh||!o.visible)return;const g=o.geometry;if(!g?.attributes.position)return;
   const p=g.getAttribute('position'),n=g.getAttribute('normal'),ix=g.getIndex();
   const entry={id:o.name||o.uuid,positions:new Float32Array(p.array),worldMatrix:o.matrixWorld.toArray()};
   if(ix)entry.indices=ix.array instanceof Uint32Array?new Uint32Array(ix.array):new Uint16Array(ix.array);
   if(n)entry.normals=new Float32Array(n.array);
   if(o.isInstancedMesh){entry.instances=[];const local=new THREE.Matrix4(),world=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,local);world.multiplyMatrices(o.matrixWorld,local);entry.instances.push(world.toArray());}}
   meshes.push(entry);
  });return{meshes};
 },
 async dispose(){const gs=new Set(),ms=new Set(),ts=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();env.dispose();renderer.dispose();}
};
