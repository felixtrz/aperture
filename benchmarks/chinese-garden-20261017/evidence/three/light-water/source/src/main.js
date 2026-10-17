import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, vec4, mix, color, reflector, screenUV, vec2, sin, positionWorld } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let seed=28317;
const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const range=(a,b)=>a+(b-a)*rnd();
const scene=new THREE.Scene(); scene.background=new THREE.Color('#e9e1d7');
const buckets=new Map();
const materials=new Map();
function mat(hex,roughness=0.85){const key=hex+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:hex,roughness,flatShading:true,side:THREE.DoubleSide}));return materials.get(key)}
const stone=['#a8a597','#b9b4a6','#c8c0ae','#97998d','#cfc7b5'];
const leaves=['#53643b','#687440','#78834b','#8f9859','#455d39','#657344'];
const wood=mat('#794629'), woodLight=mat('#9b5731'), trim=mat('#b1aa94'), roof=mat('#4c535b');
const plaster=mat('#e6dec7'), sand=mat('#d6c9a9'), grass=mat('#82904c');
function add(g,m,p=[0,0,0],s=[1,1,1],rot=[0,0,0]){g=g.index?g.toNonIndexed():g.clone();g.deleteAttribute('uv');g.deleteAttribute('normal');const ob=new THREE.Object3D();ob.position.set(...p);ob.scale.set(...s);ob.rotation.set(...rot);ob.updateMatrix();g.applyMatrix4(ob.matrix);g.computeVertexNormals();if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g)}
function box(p,s,m=trim,rot=[0,0,0]){add(new THREE.BoxGeometry(1,1,1),m,p,s,rot)}
function cyl(a,b,r1,r2,m,segments=7){const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), dir=bv.clone().sub(av);let g=new THREE.CylinderGeometry(r2,r1,dir.length(),segments,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));add(g,m,av.clone().add(bv).multiplyScalar(.5).toArray())}
function meshGeo(v){let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g}
function tri(v,a,b,c){v.push(...a,...b,...c)}
function rock(x,z,sx=.6,sy=.5,sz=.5,y=.3){let g=new THREE.IcosahedronGeometry(1,1);const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),yy=pos.getY(i),zz=pos.getZ(i);const f=1+.12*Math.sin(x*13+yy*9+zz*17);pos.setXYZ(i,x*f,yy*f,zz*f)}add(g,mat(stone[Math.floor(rnd()*stone.length)]),[x,y+sy*.6,z],[sx,sy,sz],[0,rnd()*6.28,0])}
function foliage(x,y,z,sx,sy,sz,color){add(new THREE.IcosahedronGeometry(1,1),mat(color||leaves[Math.floor(rnd()*leaves.length)]),[x,y,z],[sx,sy,sz],[rnd()*.2,rnd()*6.28,rnd()*.2])}
function shrub(x,z,size=.45){for(let i=0;i<5;i++)foliage(x+range(-size,size),.38+range(.05,size*.85),z+range(-size,size),size*.55,size*.55,size*.5)}

// A raised square garden, surrounded by finely jointed limestone masonry.
box([0,-.12,0],[12,.6,12],mat('#b9b29f'));
box([0,.195,0],[11.9,.05,11.9],sand);
for(let side=0;side<4;side++)for(let i=0;i<16;i++){
 const q=-5.625+i*.75; const p=side===0?[q,-.12,6.015]:side===1?[6.015,-.12,q]:side===2?[q,-.12,-6.015]:[-6.015,-.12,q];
 box(p,side%2===0?[.737,.52,.055]:[.055,.52,.737],mat(stone[(i+side)%5]));
}
box([0,.23,5.94],[12,.12,.18],mat('#d4cbb6'));box([5.94,.23,0],[.18,.12,12],mat('#d4cbb6'));
box([0,-.47,0],[200,.08,200],mat('#e4dacf'));

// The plaster boundary wall with an actual circular opening.
const wallZ=-5.12, gateX=3.28, gateY=1.75, gateR=1.23;
const ws=new THREE.Shape(); ws.moveTo(-5.75,.28);ws.lineTo(5.75,.28);ws.lineTo(5.75,3.42);ws.lineTo(-5.75,3.42);ws.closePath();
const hole=new THREE.Path();hole.absarc(gateX,gateY,gateR,0,Math.PI*2,true);ws.holes.push(hole);
add(new THREE.ExtrudeGeometry(ws,{depth:.32,bevelEnabled:false,curveSegments:48}),plaster,[0,0,wallZ]);
box([-5.62,1.85,-2.91],[.32,3.14,4.75],plaster);
box([0,.40,wallZ+.18],[11.6,.22,.47],mat('#b5b0a0'));box([-5.62,.4,-2.91],[.48,.22,4.75],trim);
for(let i=0;i<28;i++){
 const a=i/28*2*Math.PI,b=(i+1)/28*2*Math.PI-.012;
 const sh=new THREE.Shape();sh.moveTo(gateX+Math.cos(a)*gateR,gateY+Math.sin(a)*gateR);sh.absarc(gateX,gateY,gateR,a,b,false);sh.lineTo(gateX+Math.cos(b)*(gateR+.16),gateY+Math.sin(b)*(gateR+.16));sh.absarc(gateX,gateY,gateR+.16,b,a,true);sh.closePath();
 add(new THREE.ExtrudeGeometry(sh,{depth:.42,bevelEnabled:false,curveSegments:3}),mat(stone[(i+2)%5]),[0,0,wallZ-.035]);
}
function wallCap(x,z,length,rot=0){const group=[];let cap=new THREE.BufferGeometry();const vs=[];for(let i=0;i<Math.ceil(length/.28);i++){
 const xx=-length/2+i*.28;const v=[];const cross=[[-.35,0],[-.12,.19],[0,.23],[.12,.19],[.35,0]];
 for(let j=0;j<4;j++){const a=cross[j],b=cross[j+1];tri(v,[xx,3.49+a[1],a[0]],[xx+.265,3.49+a[1],a[0]],[xx+.265,3.49+b[1],b[0]]);tri(v,[xx,3.49+a[1],a[0]],[xx+.265,3.49+b[1],b[0]],[xx,3.49+b[1],b[0]])}
 add(meshGeo(v),mat(i%3===0?'#64666a':'#515861'),[x,0,z],[1,1,1],[0,rot,0]);
 }
 box([x,3.69,z],rot===0?[length,.075,.11]:[.11,.075,length],mat('#6b6a67'));
}
wallCap(0,wallZ+.16,11.9);wallCap(-5.62,-2.85,4.9,Math.PI/2);

// Pavilion platform, stairs, timber columns and geometric balustrades.
const px=-3.02,pz=-2.25;
box([px,.39,pz],[4.03,.32,3.95],mat('#b2af9f'));
box([px,.59,pz],[3.72,.22,3.65],mat('#c9c2ad'));
box([px,.73,pz],[3.5,.12,3.42],mat('#ded3ba'));
for(let row=0;row<4;row++)for(let col=0;col<4;col++)box([px-1.3+col*.87,.803,pz-1.28+row*.85],[.85,.018,.83],mat(stone[(row+col+2)%5]));
for(let i=0;i<3;i++)box([px,.31+i*.13,pz+2.05-i*.22],[2.05,.14,.65],mat(i%2?'#cfc5af':'#c5bdab'));
const postY=.87, postTop=3.48;
for(const x of [-1.4,1.4])for(const z of [-1.35,1.35]){
 box([px+x,.88,pz+z],[.43,.18,.43],trim);
 box([px+x,2.19,pz+z],[.22,2.48,.22],woodLight);
 box([px+x,3.34,pz+z],[.37,.18,.37],wood);
 for(const sign of [-1,1]){cyl([px+x,3.09,pz+z],[px+x+sign*.42,3.47,pz+z],.052,.052,wood,4);cyl([px+x,3.09,pz+z],[px+x,3.47,pz+z+sign*.4],.052,.052,wood,4)}
}
box([px,3.47,pz-1.35],[3.23,.19,.19],woodLight);box([px,3.47,pz+1.35],[3.23,.19,.19],woodLight);
box([px-1.4,3.47,pz],[.19,.19,3.04],woodLight);box([px+1.4,3.47,pz],[.19,.19,3.04],woodLight);
function rail(a,b){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),len=av.distanceTo(bv),n=Math.round(len/.37);const d=bv.clone().sub(av).normalize();for(const h of [.10,.52])cyl([a[0],a[1]+h,a[2]],[b[0],b[1]+h,b[2]],.041,.041,woodLight,4);for(let i=0;i<=n;i++){const p=av.clone().lerp(bv,i/n);box([p.x,p.y+.30,p.z],[.055,.48,.055],wood)}
 for(let i=0;i<n;i++){const p=av.clone().lerp(bv,(i+.5)/n);cyl([p.x-d.x*.12,p.y+.25,p.z-d.z*.12],[p.x+d.x*.12,p.y+.25,p.z+d.z*.12],.026,.026,woodLight,4)}
}
rail([px-1.4,.92,pz-1.35],[px+1.4,.92,pz-1.35]);rail([px-1.4,.92,pz-1.35],[px-1.4,.92,pz+1.35]);rail([px+1.4,.92,pz-1.35],[px+1.4,.92,pz+1.35]);
rail([px-1.4,.92,pz+1.35],[px-.93,.92,pz+1.35]);rail([px+.93,.92,pz+1.35],[px+1.4,.92,pz+1.35]);
for(let side=0;side<4;side++)for(let i=0;i<10;i++){let x=-1.4+(i+.5)*.28; const a=side%2===0?[px+x,3.29,pz+(side===0?-1.35:1.35)]:[px+(side===1?-1.4:1.4),3.29,pz+x];box(a,[.06,.20,.06],woodLight)}
box([px,.99,pz],[.5,.4,.5],trim);box([px,1.24,pz],[1.25,.15,.86],mat('#c9c3b1'));
for(const x of [-.86,.86]){box([px+x,.99,pz],[.33,.36,.36],trim);box([px+x,1.2,pz],[.45,.11,.45],mat('#d5ccba'))}

// Four swept roof faces. The panel seams converge on a raised square finial.
function roofPoint(side,t,u){const a=2.03*t;let x=a*u,z=a;let y=5.34-1.70*Math.pow(t,.57)+.34*Math.pow(t,7)*Math.pow(Math.abs(u),5);for(let i=0;i<side;i++){[x,z]=[-z,x]}return [px+x,y,pz+z]}
for(let side=0;side<4;side++){
 for(let u=0;u<8;u++){const v=[];for(let j=0;j<7;j++){const t0=j/7,t1=(j+1)/7,u0=-1+u/4,u1=-1+(u+1)/4;const a=roofPoint(side,t0,u0),b=roofPoint(side,t1,u0),c=roofPoint(side,t1,u1),d=roofPoint(side,t0,u1);tri(v,a,c,b);tri(v,a,d,c)}add(meshGeo(v),mat(['#4a515c','#525761','#555b64','#60616a'][u%4]));}
 for(let u=0;u<=8;u++)for(let j=0;j<7;j++)cyl(roofPoint(side,j/7,-1+u/4),roofPoint(side,(j+1)/7,-1+u/4),.012,.012,mat('#777a7a'),4);
 for(let j=0;j<12;j++)cyl(roofPoint(side,1,-1+j/6),roofPoint(side,1,-1+(j+1)/6),.055,.055,mat('#51565d'),5);
 for(let j=0;j<8;j++)cyl(roofPoint(side,j/8,1),roofPoint(side,(j+1)/8,1),.045,.045,mat('#88877e'),5);
 const p=roofPoint(side,1,1);cyl(p,[p[0]+(p[0]-px)*.035,p[1]+.23,p[2]+(p[2]-pz)*.035],.07,.025,roof,5);
}
box([px,5.37,pz],[.22,.21,.22],roof);cyl([px,5.45,pz],[px,5.78,pz],.17,.02,mat('#64676c'),4);cyl([px,5.76,pz],[px,5.94,pz],.035,0,mat('#747675'),5);

// Curving water garden; the outer contour is deliberately irregular.
const pondPts=[];const N=42;for(let i=0;i<N;i++){const a=i/N*Math.PI*2;const factor=1+.055*Math.sin(a*5)+.035*Math.cos(a*9);pondPts.push([-.40+4.00*Math.cos(a)*factor,1.35+3.24*Math.sin(a)*factor])}
const pondSh=new THREE.Shape();pondPts.forEach((p,i)=>i?pondSh.lineTo(...p):pondSh.moveTo(...p));pondSh.closePath();
const waterGeo=new THREE.ShapeGeometry(pondSh);waterGeo.rotateX(Math.PI/2);
// Shape's positive y becomes positive z under this rotation.
// Water is rendered once, through a native reflective node material.
const waterTriangles=[];for(let i=0;i<N;i++){const a=pondPts[i],b=pondPts[(i+1)%N];tri(waterTriangles,[-.4,.277,1.35],[a[0],.277,a[1]],[b[0],.277,b[1]])}
const waterReflection=reflector({resolutionScale:.7,bounces:false});waterReflection.target.rotation.x=-Math.PI/2;waterReflection.target.position.y=.277;scene.add(waterReflection.target);
waterReflection.uvNode=screenUV.flipX().add(vec2(sin(positionWorld.z.mul(11)).mul(.0025),sin(positionWorld.x.mul(9)).mul(.0015)));
const wm=new THREE.MeshStandardNodeMaterial({roughness:.3,metalness:0,side:THREE.DoubleSide});wm.colorNode=mix(color('#558774'),waterReflection,.32);
const water=new THREE.Mesh(meshGeo(waterTriangles),wm);water.receiveShadow=true;scene.add(water);
for(let i=0;i<N;i++){const [x,z]=pondPts[i];if(x>2.25&&z<.90&&z>-.65)continue;rock(x,z,range(.36,.62),range(.22,.42),range(.3,.53),.25);if(i%4===0)shrub(x+(x+.4)*.12,z+(z-1.35)*.12,.30)}
// Subtle broad facets and ripples sit on the jade surface.
for(let i=0;i<65;i++){const x=range(-3.4,2.8),z=range(-1.1,3.9);if(((x+.4)/3.6)**2+((z-1.35)/2.8)**2>1)continue;const r=range(.12,.45),v=[];for(let j=0;j<6;j++){const a=j/6*Math.PI*2,b=(j+1)/6*Math.PI*2;tri(v,[x,.282,z],[x+Math.cos(a)*r,.282,z+Math.sin(a)*r*.5],[x+Math.cos(b)*r,.282,z+Math.sin(b)*r*.5])}const m=new THREE.MeshBasicMaterial({color:i%3===0?'#a3bc98':'#80aa92',transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide});scene.add(new THREE.Mesh(meshGeo(v),m))}

// A stone arch bridge crosses the pond's narrow north-east inlet.
const bx=2.58,bz=-.15, bl=2.8,bw=1.18;
const deckY=t=>.46+.51*Math.sin(Math.PI*t);
for(let i=0;i<14;i++){
 const t0=i/14,t1=(i+1)/14,z0=bz-bl/2+t0*bl,z1=bz-bl/2+t1*bl, y0=deckY(t0),y1=deckY(t1); const v=[];
 const a=[bx-bw/2,y0,z0],b=[bx+bw/2,y0,z0],c=[bx+bw/2,y1,z1],d=[bx-bw/2,y1,z1];tri(v,a,c,b);tri(v,a,d,c);add(meshGeo(v),mat(i%2?'#d6cbb4':'#c8bfab'));
 for(const side of [-1,1]){const x=bx+side*bw/2;const sv=[];tri(sv,[x,y0,z0],[x,y1,z1],[x,y1-.25,z1]);tri(sv,[x,y0,z0],[x,y1-.25,z1],[x,y0-.25,z0]);add(meshGeo(sv),mat('#b7b19e'))}
 // joints between paving slabs
 cyl([bx-bw/2,y0+.005,z0],[bx+bw/2,y0+.005,z0],.008,.008,mat('#a9a28f'),4);
}
for(const side of [-1,1])for(let i=0;i<7;i++){
 const t=i/6,z=bz-bl/2+t*bl,y=deckY(t),x=bx+side*(bw/2+.025);
 box([x,y+.34,z],[.14,.68,.16],mat('#c9c3b1'));box([x,y+.71,z],[.22,.10,.23],mat('#dad1bd'));
 if(i<6){const t2=(i+1)/6,zz=bz-bl/2+t2*bl,yy=deckY(t2);cyl([x,y+.60,z],[x,yy+.60,zz],.072,.072,mat('#d7cdb9'),4);cyl([x,y+.18,z],[x,yy+.18,zz],.05,.05,mat('#c5bda9'),4);
 const midz=(z+zz)/2,midy=(y+yy)/2;
 box([x,midy+.27,midz],[.13,.16,.42],mat('#c4bcaa'));box([x,midy+.54,midz],[.13,.14,.42],mat('#d2c8b4'));
 for(const dz of [-.155,.155])box([x,midy+.40,midz+dz],[.13,.20,.11],mat('#c9bfac'));
 }
}
// Arrival stones lead through the open circular gate and around the shore.
function paving(x,z,r=.46){const n=6,v=[];const rr=Array.from({length:n},()=>r*range(.83,1.13));for(let i=0;i<n;i++){const a=i/n*6.283,b=(i+1)/n*6.283;tri(v,[x,.31,z],[x+Math.cos(a)*rr[i],.31,z+Math.sin(a)*rr[i]],[x+Math.cos(b)*rr[(i+1)%n],.31,z+Math.sin(b)*rr[(i+1)%n]])}add(meshGeo(v),mat(stone[Math.floor(rnd()*3)+1]));}
for(const [x,z] of [[2.75,-2.0],[3,-2.85],[3.25,-3.65],[3.28,-4.5],[3.28,-5.5],[3.1,1.65],[3.9,2.25],[4.1,3.1],[3.8,4.0],[2.9,4.7],[1.75,5.0],[.55,4.95],[-.55,5.1],[-1.65,4.8]])paving(x,z,range(.38,.53));

// Twisting pines with broad, angular clouds of foliage.
function pine(x,z,scale=1,flip=1){const p=(a,b,c)=>[x+a*scale*flip,.3+b*scale,z+c*scale];
 const trunk=[[0,0,0],[-.12,.8,0],[.23,1.55,.05],[-.22,2.22,-.03],[.03,2.9,-.10],[.40,3.55,-.15],[.72,4.08,-.26]];
 for(let i=0;i<trunk.length-1;i++)cyl(p(...trunk[i]),p(...trunk[i+1]),(.24-i*.026)*scale,(.215-i*.026)*scale,mat(i%2?'#66523c':'#716047'),7);
 const branches=[[[.23,1.55,.05],[-.9,2.4,.1],[-1.6,2.55,.08]],[[.03,2.9,-.1],[1.04,3.19,.15],[1.64,3.37,.28]],[[.40,3.55,-.15],[-.45,3.92,-.35],[-.95,4.06,-.48]],[[.72,4.08,-.26],[1.26,4.5,-.33],[1.63,4.6,-.4]],[[.03,2.9,-.10],[-.35,3.16,.8],[-.75,3.38,1.04]],[[.72,4.08,-.26],[.48,4.7,-.45],[.2,4.87,-.5]]];
 for(const branch of branches){for(let i=0;i<2;i++)cyl(p(...branch[i]),p(...branch[i+1]),(.13-i*.07)*scale,(.075-i*.045)*scale,mat('#68553b'),6);const end=branch[2];for(let k=0;k<10;k++){const q=p(end[0]+range(-.65,.65),end[1]+range(-.05,.27),end[2]+range(-.4,.4));foliage(...q,range(.34,.62)*scale,range(.17,.31)*scale,range(.35,.61)*scale)}}
}
pine(-5.10,-1.40,1.07,1);pine(5.0,-3.93,.89,-1);

// Bamboo stems and narrow pointed leaves in the rear court.
for(let i=0;i<21;i++){
 const x=range(-.35,1.45),z=range(-4.75,-3.85),h=range(2.8,4.6); const leanX=range(-.30,.3),leanZ=range(-.18,.18);
 for(let j=0;j<8;j++){const a=j/8,b=(j+1)/8;cyl([x+leanX*a,.3+h*a,z+leanZ*a],[x+leanX*b,.3+h*b,z+leanZ*b],.032,.026,mat(i%2?'#6b7939':'#8a9143'),6);cyl([x+leanX*a,.3+h*a,z+leanZ*a],[x+leanX*a,.32+h*a,z+leanZ*a],.039,.039,mat('#a3a46b'),6);
 if(j>3)for(let k=0;k<3;k++){const angle=rnd()*Math.PI*2,reach=range(.25,.54),yy=.3+h*a;const tx=x+leanX*a+Math.cos(angle)*reach,tz=z+leanZ*a+Math.sin(angle)*reach;cyl([x+leanX*a,yy,z+leanZ*a],[tx,yy+range(.1,.35),tz],.012,.004,mat('#73813a'),4);for(let l=0;l<3;l++){const bx=tx+range(-.10,.10),by=yy+.15+range(0,.20),bz=tz+range(-.10,.10),ang=angle+range(-1.4,1.4),len=range(.19,.38);const dx=Math.cos(ang)*len,dz=Math.sin(ang)*len;const v=[];tri(v,[bx,by,bz],[bx+dx*.55-dz*.13,by+.06,bz+dz*.55+dx*.13],[bx+dx,by-.04,bz+dz]);tri(v,[bx,by,bz],[bx+dx,by-.04,bz+dz],[bx+dx*.55+dz*.13,by+.03,bz+dz*.55-dx*.13]);const m=mat(leaves[(i+j+k)%leaves.length]);m.side=THREE.DoubleSide;add(meshGeo(v),m)}}
 }
}

// Tall scholar stones: hollow, irregular faceted bodies.
function scholar(x,z,s=1){const v=[], n=11;const outer=[],inner=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;outer.push([Math.cos(a)*range(.53,.76)*s,1.1*s+Math.sin(a)*range(1.0,1.25)*s]);inner.push([Math.cos(a)*range(.17,.24)*s,1.05*s+Math.sin(a)*range(.22,.32)*s]);}
 for(let i=0;i<n;i++){const j=(i+1)%n;const of=[x+outer[i][0],.3+outer[i][1],z+.26*s],og=[x+outer[j][0],.3+outer[j][1],z+.24*s],inf=[x+inner[i][0],.3+inner[i][1],z+.29*s],ing=[x+inner[j][0],.3+inner[j][1],z+.27*s];tri(v,of,og,inf);tri(v,og,ing,inf);const ob=[of[0],of[1],z-.32*s],obg=[og[0],og[1],z-.32*s],inb=[inf[0],inf[1],z-.32*s],inbg=[ing[0],ing[1],z-.32*s];tri(v,of,ob,obg);tri(v,of,obg,og);tri(v,inf,ing,inbg);tri(v,inf,inbg,inb);tri(v,ob,inb,obg);tri(v,obg,inb,inbg)}
 const m=mat('#b2b0a2');m.side=THREE.DoubleSide;add(meshGeo(v),m);rock(x-.3*s,z+.15,.48*s,.45*s,.45*s);rock(x+.32*s,z,.35*s,.65*s,.4*s);
}
scholar(-4.65,2.15,1.0);scholar(-4.9,-.73,1.03);rock(4.62,-2.62,.63,1.0,.53);rock(.55,-3.45,.57,.64,.45);rock(1.30,-3.65,.43,.42,.43);rock(1.30,3.98,.56,.79,.55);
for(const [x,z,s] of [[-4.8,4.7,.5],[-3.6,4.45,.42],[-5.1,3.25,.35],[-4.9,.4,.46],[-1.6,-4.48,.40],[.1,-3.65,.45],[1.6,-3.65,.42],[4.7,-2.2,.5],[5.1,-.4,.5],[4.85,1.3,.35],[3.7,4.8,.38],[2,4.5,.38],[-.4,5.5,.43],[-2.6,4.7,.4],[-4.6,-4.7,.4]])shrub(x,z,s);
for(let i=0;i<27;i++){let x,z;if(i<12){x=range(-5.25,5.25);z=range(-4.9,-4.5)}else{x=range(-5.3,5.3);z=range(4.9,5.6)}if(x>2.3&&x<4.1&&z<0)continue;shrub(x,z,range(.15,.3));}
for(const [x,z] of [[-3.9,4.2],[-4.7,1.1],[-3.9,-.2],[4.2,-1.7],[4.8,.8],[1,4.6],[-1.6,5.3]])rock(x,z,.4,.27,.36);
// Sparse short grass tufts, each made from tapered blades.
for(let i=0;i<180;i++){const x=range(-5.5,5.5),z=range(-4.9,5.65);if(((x+.4)/4.05)**2+((z-1.35)/3.25)**2<1||x<-.9&&x>-4.9&&z<-1)continue;const v=[];for(let j=0;j<5;j++){const a=rnd()*6.28,h=range(.1,.29),dx=Math.cos(a),dz=Math.sin(a);tri(v,[x-dz*.025,.26,z+dx*.025],[x+dz*.025,.26,z-dx*.025],[x+dx*.12,.26+h,z+dz*.12]);}const m=mat(i%2?'#8c994d':'#a5a75a');m.side=THREE.DoubleSide;add(meshGeo(v),m)}
// Lotus pads with a notch and faceted rose petals.
function lotus(x,z,flower=false){const r=range(.22,.36),v=[];for(let j=1;j<13;j++){const a=j/13*6.283,b=(j+1)/13*6.283;tri(v,[x,.305,z],[x+Math.cos(a)*r,.305,z+Math.sin(a)*r*.8],[x+Math.cos(b)*r,.305,z+Math.sin(b)*r*.8])}const m=mat('#a7b95e');m.side=THREE.DoubleSide;add(meshGeo(v),m);for(let j=1;j<7;j++){let a=j/7*6.28;cyl([x,.31,z],[x+Math.cos(a)*r*.92,.31,z+Math.sin(a)*r*.74],.006,.003,mat('#7f9c54'),3)}
 if(flower){cyl([x,.29,z],[x,.50,z],.025,.025,mat('#6c8950'),5);for(let ring=0;ring<2;ring++)for(let k=0;k<8;k++){const a=k/8*6.28+ring*.4,len=ring?.22:.30;const v=[],p=[x,.48,z],tip=[x+Math.cos(a)*len,.53+(ring?.21:.11),z+Math.sin(a)*len],mid=[x+Math.cos(a)*len*.55,.52,z+Math.sin(a)*len*.55];tri(v,p,[mid[0]-Math.sin(a)*.065,mid[1],mid[2]+Math.cos(a)*.065],tip);tri(v,p,tip,[mid[0]+Math.sin(a)*.065,mid[1]+.03,mid[2]-Math.cos(a)*.065]);const m=mat(ring?'#edb594':'#edc1a6');m.side=THREE.DoubleSide;add(meshGeo(v),m)}foliage(x,.53,z,.07,.05,.07,'#dfb65f')}
}
for(const [x,z,f] of [[-2.6,1.5,true],[-2.1,2.1,true],[-3,1.15,false],[-2.7,2.0,false],[-1.55,2.3,false],[-1.85,2.8,false],[-2.9,2.7,false],[-2.1,1.3,false],[1.1,3.2,true],[1.65,3.25,false],[.8,3.6,false]])lotus(x,z,f);
// Two small warm maples give the quiet green palette a restrained accent.
function maple(x,z,s=.65){cyl([x,.3,z],[x,.3+s,z],.035,.015,wood,5);for(let i=0;i<18;i++){const a=rnd()*6.28,r=range(.12,.55)*s,h=.3+range(.45,.95)*s;cyl([x,.3+s*.6,z],[x+Math.cos(a)*r,h,z+Math.sin(a)*r],.012,.005,wood,4);foliage(x+Math.cos(a)*r,h,z+Math.sin(a)*r,.12,.04,.10,i%2?'#b27640':'#c08a4e')}}
maple(-3.7,.15,.75);maple(1.9,4.2,.60);maple(1,-1.65,.55);

// Thin moss beds connect the planting into a soft irregular shoreline.
for(let i=0;i<N;i++){const [x,z]=pondPts[i];if(x>2&&z<1.2)continue;const xx=x+(x+.4)*.12,zz=z+(z-1.35)*.12;const r=range(.35,.62),v=[];for(let j=0;j<9;j++){const a=j/9*6.283,b=(j+1)/9*6.283;tri(v,[xx,.242,zz],[xx+Math.cos(a)*r*range(.8,1.1),.242,zz+Math.sin(a)*r*.7],[xx+Math.cos(b)*r*range(.8,1.1),.242,zz+Math.sin(b)*r*.7])}add(meshGeo(v),mat(i%2?'#8c9452':'#9a9e5b'));}

// Batch static surfaces by material: low draw count, real geometry and shadows.
for(const [material,geometries] of buckets){const merged=mergeGeometries(geometries,false);const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);for(const g of geometries)g.dispose()}
const hemi=new THREE.HemisphereLight('#e0e8ec','#a29b87',1.7);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffefd7',3.3);sun.position.set(-9,15,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=.5;sun.shadow.camera.far=45;sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=5;sun.target.position.set(0,0,0);scene.add(sun,sun.target);
const camera=new THREE.OrthographicCamera(-9.9,9.9,7.425,-7.425,.1,100);camera.position.set(14,19.1,19);camera.lookAt(0,1.15,0);
const renderer=new THREE.WebGPURenderer({antialias:true,alpha:false});renderer._getFallback=null;renderer.setPixelRatio(1);renderer.setSize(1200,900);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;document.body.appendChild(renderer.domElement);
async function main(){await renderer.init();if(!renderer.backend.isWebGPUBackend)throw new Error('Native WebGPU required');const pipeline=new THREE.RenderPipeline(renderer);const sp=pass(scene,camera);sp.setMRT(mrt({output,normal:normalView}));const depth=sp.getTextureNode('depth');const normal=sp.getTextureNode('normal');const occ=ao(depth,normal,camera);occ.radius.value=.65;occ.thickness.value=1.0;occ.scale.value=.85;occ.samples.value=24;const smooth=denoise(occ.getTextureNode(),depth,normal,camera);pipeline.outputNode=vec4(sp.getTextureNode('output').rgb.mul(mix(1,smooth.r,.64)),1);pipeline.render();await renderer.backend.device.queue.onSubmittedWorkDone();globalThis.__APERTURE_RENDER_STATUS__={ok:true};}
main().catch(error=>{console.error(error);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(error)}});
