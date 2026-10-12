import { createSystem, mesh, material, color } from "@aperture-engine/app/systems";

import { createStandardMaterialAsset, createTextureAsset, createSamplerAsset, createTriangleListMeshAsset } from "@aperture-engine/render";
import { createMaterialHandle, createTextureHandle, createSamplerHandle } from "@aperture-engine/simulation";
type V=[number,number,number];
const TAU=Math.PI*2;
let seed=94173;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function vadd(a:V,b:V):V{return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function vmul(a:V,s:number):V{return [a[0]*s,a[1]*s,a[2]*s]}
function sub(a:V,b:V):V{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function cross(a:V,b:V):V{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function norm(a:V):V{let l=Math.hypot(...a);return vmul(a,1/l)}
const palette:any={
 stucco:["#e6d9bf",.93,0], stuccoShade:["#d7c5a5",.95,0], foundation:["#bbae95",.95,0],
 tile0:["#a75c35",.82,0],tile1:["#b9663a",.83,0],tile2:["#ae5c33",.88,0],tile3:["#c17543",.78,0],
 roofdark:["#6a432c",.93,0],timber:["#756247",.88,0],
 stone0:["#b7ac91",.93,0],stone1:["#c1b59b",.92,0],stone2:["#ac9d83",.96,0],stone3:["#cfc3ab",.9,0],mortar:["#8d8472",1,0],
 path0:["#c7bdab",.9,0],path1:["#aaa492",.95,0],path2:["#d4cbb6",.9,0],
 asphalt:["#575452",.95,0],asphaltDark:["#474642",1,0],asphaltLight:["#6d665d",1,0],
 curb:["#bcb7a8",.93,0],line:["#e2dfd5",.88,0],earth:["#887b50",1,0],
 lawn:["#7b824a",1,0],grass0:["#687239",1,0],grass1:["#8c934a",1,0],grass2:["#a29a51",1,0],
 leaf0:["#4e6336",.92,0],leaf1:["#6a7b43",.95,0],leaf2:["#84915b",.9,0],leaf3:["#9b9b69",.95,0],
 trunk:["#6c5942",.98,0],bark:["#857057",.95,0],lavender:["#847790",1,0],
 frame:["#363c3d",.5,.15],glass:["#344851",.18,.22],glassLight:["#65777a",.26,.16],
 curtain:["#a69e8e",.93,0],door:["#444849",.65,.05],handle:["#b2a47c",.3,.7],black:["#202327",.68,.1],
 blue:["#174971",.26,.45],blueLight:["#326a9b",.3,.3],blueDark:["#153c62",.35,.25],
 tire:["#212323",.98,0],rim:["#b8b9b1",.3,.8],headlight:["#e5e4cd",.22,.2],tail:["#9b302c",.35,.1],plate:["#dfdac9",.75,0],pot:["#ac7047",.92,0],
 landscape0:["#8d947d",1,0],landscape1:["#a0a89a",1,0],landscape2:["#b2b7aa",1,0]
};
type Batch={positions:V[],normals:V[],uvs:[number,number][]};
const batches=new Map<string,Batch>();
let transform=(p:V):V=>p;
function tri(m:string,a:V,b:V,c:V,n?:V){
 a=transform(a);b=transform(b);c=transform(c);
 const normal=n?norm(sub(transform(n),transform([0,0,0]))):norm(cross(sub(b,a),sub(c,a)));
 if(!Number.isFinite(normal[0]))return;
 let g=batches.get(m);if(!g){g={positions:[],normals:[],uvs:[]};batches.set(m,g)}
 g.positions.push(a,b,c);g.normals.push(normal,normal,normal);
 const ax=Math.abs(normal[0]),ay=Math.abs(normal[1]),az=Math.abs(normal[2]);
 const scale=m==="lawn"?.26:m.startsWith("asphalt")?2:m.startsWith("tile")?2.3:m.startsWith("stone")?3:2.8;
 for(const p of [a,b,c])g.uvs.push(ay>ax&&ay>az?[p[0]*scale,p[2]*scale]:ax>az?[p[2]*scale,p[1]*scale]:[p[0]*scale,p[1]*scale]);
}
function quad(m:string,a:V,b:V,c:V,d:V){tri(m,a,b,c);tri(m,a,c,d)}
function box(m:string,c:V,s:V,yaw=0){
 const cs=Math.cos(yaw),sn=Math.sin(yaw);
 const p=(x:number,y:number,z:number):V=>[c[0]+x*cs+z*sn,c[1]+y,c[2]-x*sn+z*cs];
 let x=s[0]/2,y=s[1]/2,z=s[2]/2;
 const q=[p(-x,-y,-z),p(x,-y,-z),p(x,y,-z),p(-x,y,-z),p(-x,-y,z),p(x,-y,z),p(x,y,z),p(-x,y,z)];
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(m,q[f[0]],q[f[1]],q[f[2]],q[f[3]]);
}
function beam(m:string,a:V,b:V,r:number,segments=9,r2=r){
 const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])<.95?[0,1,0]:[1,0,0])),v=cross(axis,u);
 const p=(c:V,rad:number,i:number)=>vadd(c,vadd(vmul(u,Math.cos(i*TAU/segments)*rad),vmul(v,Math.sin(i*TAU/segments)*rad)));
 for(let i=0;i<segments;i++){
  let j=i+1;quad(m,p(a,r,i),p(a,r,j),p(b,r2,j),p(b,r2,i));
  tri(m,a,p(a,r,j),p(a,r,i));tri(m,b,p(b,r2,i),p(b,r2,j));
 }
}
function smoothTri(m:string,a:V,b:V,c:V,na:V,nb:V,nc:V){
 tri(m,a,b,c);
 const g=batches.get(m)!;
 const zero=transform([0,0,0]);
 g.normals.splice(g.normals.length-3,3,...[na,nb,nc].map(n=>norm(sub(transform(n),zero))));
}
function ellipsoid(m:string,c:V,s:V,seg=10,rings=6){
 const et=(a:V,b:V,d:V)=>{
  const n=(p:V):V=>norm([(p[0]-c[0])/(s[0]*s[0]),(p[1]-c[1])/(s[1]*s[1]),(p[2]-c[2])/(s[2]*s[2])]);
  smoothTri(m,a,b,d,n(a),n(b),n(d));
 };
 for(let j=0;j<rings;j++){
  const p=(i:number,k:number):V=>{let phi=-Math.PI/2+k*Math.PI/rings,t=i*TAU/seg;return [c[0]+s[0]*Math.cos(phi)*Math.cos(t),c[1]+s[1]*Math.sin(phi),c[2]+s[2]*Math.cos(phi)*Math.sin(t)]};
  for(let i=0;i<seg;i++){
   if(j===0)et(p(i,j),p(i,j+1),p(i+1,j+1));
   else if(j===rings-1)et(p(i,j),p(i,j+1),p(i+1,j));
   else {et(p(i,j),p(i,j+1),p(i+1,j+1));et(p(i,j),p(i+1,j+1),p(i+1,j));};
  }
 }
}
function slabWall(axis:"x"|"z",at:number,min:number,max:number,holes:number[][]){
 const xs=[min,max,...holes.flatMap(h=>[h[0],h[1]])].sort((a,b)=>a-b);
 const ys=[.35,6.15,...holes.flatMap(h=>[h[2],h[3]])].sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  let x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
  if(xs[i+1]-xs[i]<.0001||ys[j+1]-ys[j]<.0001||holes.some(h=>x>h[0]&&x<h[1]&&y>h[2]&&y<h[3]))continue;
  if(axis==="z")box("stucco",[x,y,at],[xs[i+1]-xs[i],ys[j+1]-ys[j],.34]);
  else box("stucco",[at,y,x],[.34,ys[j+1]-ys[j],xs[i+1]-xs[i]]);
 }
}
function windowFront(x:number,y:number,w:number,h:number,z:number,side=false){
 const put=(m:string,c:V,s:V)=>side?box(m,[z,c[1],c[0]],[s[2],s[1],s[0]]):box(m,[c[0],c[1],z+c[2]],s);
 const recess=side?-.12:-.12;
 put("black",[x,y,recess-.09],[w,h,.08]);
 put("curtain",[x-.27*w,y,recess-.05],[w*.28,h*.89,.02]);
 put("curtain",[x+.27*w,y,recess-.05],[w*.28,h*.89,.02]);
 put("glass",[x,y,recess],[w-.13,h-.13,.045]);
 for(let s of [-1,1]){
  put("frame",[x+s*(w/2-.05),y,0],[.09,h,.12]);
  put("frame",[x,y+s*(h/2-.05),0],[w,.09,.12]);
 }
 put("frame",[x,y,.028],[.05,h,.08]);
 put("frame",[x,y-.13,.03],[w,.04,.08]);
 put("stone3",[x,y-h/2-.065,.07],[w+.23,.12,.34]);
 // Muted highlights and interior depth details.
 put("glassLight",[x-w*.36,y,.003],[.026,h*.82,.014]);
 if(!side){box("pot",[x+w*.2,y-h*.36,z-.17],[.22,.18,.13]);ellipsoid("leaf1",[x+w*.2,y-h*.2,z-.17],[.13,.23,.07],7,4);}
}
function roofTiles(x0:number,x1:number,z0:number,z1:number,y0:number,y1:number,front:boolean){
 // Each convex overlapping clay tile is a genuine curved shell, with a hollow end.
 const cols=Math.round((x1-x0)/.25), rows=Math.ceil(Math.hypot(z1-z0,y1-y0)/.44);
 const down=norm([0,y1-y0,z1-z0]), outward=norm(cross([1,0,0],down));
 const n=outward[1]>0?outward:vmul(outward,-1);
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const frac=row/rows;
  const cx=x0+(col+.5)*(x1-x0)/cols;
  const start:V=[cx,y0+(y1-y0)*frac,z0+(z1-z0)*frac];
  const len=Math.hypot(z1-z0,y1-y0)/rows+.08;
  const r=.132,mat="tile"+Math.floor(rnd()*4);
  const pt=(angle:number,t:number,rad:number):V=>vadd(vadd(start,vmul(down,t)),[Math.cos(angle)*rad,n[1]*Math.sin(angle)*rad,n[2]*Math.sin(angle)*rad]);
  for(let k=0;k<7;k++){
   let a=k*Math.PI/7,b=(k+1)*Math.PI/7;
   quad(mat,pt(a,0,r),pt(b,0,r),pt(b,len,r*.93),pt(a,len,r*.93));
   quad("roofdark",pt(a,0,r-.025),pt(a,len,r*.93-.025),pt(b,len,r*.93-.025),pt(b,0,r-.025));
   quad(mat,pt(a,len,r*.93),pt(b,len,r*.93),pt(b,len,r*.93-.025),pt(a,len,r*.93-.025));
  }
 }
}
function shrub(x:number,z:number,r:number=.65,y=.6){
 beam("trunk",[x,.3,z],[x,y+.3,z],r*.075,6);
 for(let k=0;k<32;k++){
  let t=rnd()*TAU,rr=rnd()*r;
  let p:V=[x+Math.cos(t)*rr,y+rnd()*.55,z+Math.sin(t)*rr];
  ellipsoid("leaf"+Math.floor(rnd()*3),p,[r*.23,r*.24,r*.21],9,5);
  oliveLeaves(p,r*.5,9);
 }
}
function oliveLeaves(c:V,r:number,count=15){
 for(let k=0;k<count;k++){
  let t=rnd()*TAU,p:V=[c[0]+(rnd()-.5)*r,c[1]+(rnd()-.5)*r,c[2]+(rnd()-.5)*r];
  let along:V=[Math.cos(t)*(.09+rnd()*.075),.025+rnd()*.055,Math.sin(t)*(.09+rnd()*.075)];
  let side:V=[-Math.sin(t)*.037,0,Math.cos(t)*.037];
  let a=vadd(p,along),b=vadd(p,side),d=sub(p,side),e=sub(p,along),ridge=vadd(p,[0,.014,0]),m="leaf"+Math.floor(rnd()*4);
  tri(m,a,b,ridge);tri(m,b,e,ridge);tri(m,e,d,ridge);tri(m,d,a,ridge);
  tri("leaf2",a,ridge,b);tri("leaf2",b,ridge,e);tri("leaf2",e,ridge,d);tri("leaf2",d,ridge,a);
 }
}
function tree(x:number,z:number,h:number,r:number){
 let base:V=[x,.3,z],top:V=[x+.1,h*.65,z+.1];
 beam("trunk",base,top,.18,10,.095);
 for(let j=0;j<7;j++){
  let t=j*TAU/7+.3, tip:V=[x+Math.cos(t)*r*.76,h*.70+rnd()*.45,z+Math.sin(t)*r*.76];
  beam("bark",[x,h*.40,z],tip,.07,7,.025);
 }
 for(let j=0;j<140;j++){
  let t=rnd()*TAU,rr=Math.sqrt(rnd())*r;
  let yy=h*.63+Math.sqrt(Math.max(0,1-(rr/r)**2))*h*.27+(rnd()-.5)*.65;
  let p:V=[x+Math.cos(t)*rr,yy,z+Math.sin(t)*rr];
  ellipsoid("leaf"+Math.floor(rnd()*3),p,[.18+rnd()*.11,.15+rnd()*.09,.18+rnd()*.11],10,6);
  oliveLeaves(p,.5,18);
 }
}
function pot(x:number,z:number,r=.35){
 beam("pot",[x,.35,z],[x,.88,z],r*.7,16,r);
 beam("pot",[x,.87,z],[x,.94,z],r*1.08,16);
 beam("earth",[x,.945,z],[x,.951,z],r*.91,16);
 shrub(x,z,r*1.65,1.2);
}
function paving(x0:number,x1:number,z0:number,z1:number,size=.55){
 box("mortar",[(x0+x1)/2,.30,(z0+z1)/2],[x1-x0,.14,z1-z0]);
 for(let z=z0;z<z1;z+=size)for(let x=x0;x<x1;x+=size){
  let w=Math.min(size-.025,x1-x-.013),d=Math.min(size-.025,z1-z-.013);
  if(w<=0||d<=0)continue;
  box("path"+Math.floor(rnd()*3),[x+w/2+.009,.39+(rnd()-.5)*.018,z+d/2+.009],[w,.06,d],(rnd()-.5)*.035);
 }
}
export default class HouseScene extends createSystem({priority:0}){
 init(){
 seed=94173;batches.clear();
 this.spawn.camera({key:"camera.main",transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:.1,far:200,aspect:1024/768,autoAspect:false,frustumCulling:false}});
 this.spawn.light({key:"sun",kind:"directional",intensity:3.1,color:[1,.88,.70,1],transform:{rotationEulerDegrees:[-43,-48,0]},shadow:{mapSize:2048,cascadeCount:1,strength:.8,filterRadius:2,normalBias:.018,bias:.0005,orthographicSize:34,center:[0,2,1],lightDistance:32,near:.1,far:75}});
 this.spawn.light({key:"ambient",kind:"ambient",intensity:.22,color:[.71,.80,1,1]});
 // Broad ground and garden.
 box("earth",[0,-.25,0],[130,.4,130]);
 const garden:V[]=[[-9,.14,-9],[7.76,.14,-9],[7.76,.14,3.6]];
 for(let i=1;i<=32;i++){let t=i*Math.PI/2/32;garden.push([4+3.76*Math.cos(t),.14,3.6+3.76*Math.sin(t)]);}
 garden.push([-9,.14,7.36]);
 for(let i=0;i<garden.length;i++)tri("lawn",[0,.14,0],garden[(i+1)%garden.length],garden[i]);
 // Two-storey solid facade, with full-depth openings.
 const frontH=[[-3.3,-1.95,1.2,2.65],[1.75,3,1.2,2.65],[-3.05,-1.6,4.15,5.65],[1.4,2.95,4.15,5.65],[-.2,.85,.4,2.7]];
 slabWall("z",2.9,-4.2,4.2,frontH);
 const sideH=[[-1.85,-.75,1.25,2.7],[1.05,2.15,1.25,2.7],[-1.8,-.7,4.15,5.65],[.8,1.9,4.15,5.65]];
 slabWall("x",4.03,-3.2,2.9,sideH);
 slabWall("x",-4.03,-3.2,2.9,sideH);
 slabWall("z",-3.2,-4.2,4.2,[[-2.8,-1.4,1.3,2.7],[1.1,2.6,4.15,5.65]]);
 box("foundation",[0,.3,-.15],[8.6,.35,6.55]);
 // Interior darkness behind glass.
 box("black",[0,3.1,-.15],[7.95,5.5,5.8]);
 for(const h of frontH.slice(0,4))windowFront((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],3.08);
 for(const h of sideH)windowFront((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],4.20,true);
 // Left side and rear windows preserve other-view details.
 const save=transform;
 transform=(p:V)=>[-p[0],p[1],p[2]];
 for(const h of sideH)windowFront((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],4.2,true);
 transform=(p:V)=>[p[0],p[1],-p[2]-.3];
 windowFront(-2.1,2,1.4,1.4,3.08);windowFront(1.85,4.9,1.5,1.5,3.08);
 transform=save;
 // Fine stippled relief on the largest stucco surfaces.
 for(let i=0;i<1100;i++){
  let x=-4.05+rnd()*8.10,y=.6+rnd()*5.38;
  if(frontH.some(h=>x>h[0]-.03&&x<h[1]+.03&&y>h[2]-.03&&y<h[3]+.03))continue;
  let r=.006+rnd()*.009;
  tri("stuccoShade",[x-r,y,3.073],[x,y-r,3.074],[x+r,y+r*.7,3.073]);
 }
 // Gable stucco ends, ridge along X.
 for(const x of [-4.2,4.2]){
  const m=x>0?"stucco":"stuccoShade";
  tri(m,[x,6.15,3.12],[x,8.25,-.15],[x,6.15,-3.42]);
  tri(m,[x,6.15,-3.42],[x,8.25,-.15],[x,6.15,3.12]);
 }
 box("timber",[0,6.12,3.31],[9.15,.19,.18]);
 box("timber",[0,6.12,-3.61],[9.15,.19,.18]);
 // Dark base roof facets and repeated individually curved terracotta tile runs.
 quad("roofdark",[-4.65,6.13,3.63],[4.65,6.13,3.63],[4.65,8.33,-.15],[-4.65,8.33,-.15]);
 quad("roofdark",[-4.65,8.33,-.15],[4.65,8.33,-.15],[4.65,6.13,-3.93],[-4.65,6.13,-3.93]);
 roofTiles(-4.7,4.7,-.15,3.64,8.36,6.16,true);
 roofTiles(-4.7,4.7,-.15,-3.94,8.36,6.16,false);
 for(let x=-4.7;x<4.7;x+=.36)beam("tile3",[x,8.40,-.15],[x+.38,8.40,-.15],.15,12);
 for(const x of [-4.66,4.66]){
  beam("timber",[x,6.07,3.67],[x,8.29,-.15],.085,6);
  beam("timber",[x,8.29,-.15],[x,6.07,-3.97],.085,6);
 }
 // Gutters/downpipes.
 for(const x of [-4.27,4.27]){
  beam("frame",[x,.42,3.2],[x,5.84,3.2],.047,10);
  beam("frame",[x,5.84,3.2],[x,6.14,3.46],.047,10);
 }
 beam("frame",[-4.73,6.12,3.59],[4.73,6.12,3.59],.06,10);
 // Chimney with open cap, four uprights, and little tiled hip cap.
 box("stucco",[2.7,8.22,-.7],[.62,2.0,.64]);
 box("stone3",[2.7,9.05,-.7],[.74,.12,.75]);
 box("black",[2.7,9.22,-.7],[.55,.28,.52]);
 for(let a of [-1,1])for(let b of [-1,1])box("stucco",[2.7+a*.27,9.27,-.7+b*.27],[.12,.36,.12]);
 box("tile1",[2.7,9.48,-.7],[.93,.1,.93]);
 for(const [a,b] of [[[-.48,0,-.48],[.48,0,-.48]],[[.48,0,-.48],[.48,0,.48]],[[.48,0,.48],[-.48,0,.48]],[[-.48,0,.48],[-.48,0,-.48]]] as any)tri("tile2",vadd([2.7,9.53,-.7],a),[2.7,9.72,-.7],vadd([2.7,9.53,-.7],b));
 // Covered porch roof and chunky stucco posts.
 for(const x of [-1.85,2.02]){
  box("stucco",[x,1.76,4.31],[.28,2.7,.32]);
  box("stone3",[x,.48,4.31],[.44,.21,.47]);
  box("stone3",[x,3.04,4.31],[.46,.15,.48]);
 }
 box("timber",[.085,3.18,4.35],[4.5,.23,.24]);
 box("timber",[.085,3.22,3.32],[4.5,.2,2.0]);
 quad("roofdark",[-2.25,3.28,4.6],[2.4,3.28,4.6],[2.4,3.85,2.83],[-2.25,3.85,2.83]);
 roofTiles(-2.3,2.45,2.79,4.64,3.86,3.31,true);
 beam("frame",[-2.35,3.25,4.64],[2.5,3.25,4.64],.053,10);
 box("stone1",[.35,.30,3.97],[4.5,.3,2.38]);
 box("stone3",[.35,.24,5.03],[2.1,.17,.45]);
 box("stone1",[.35,.16,5.40],[2.35,.12,.39]);
 box("door",[.325,1.55,3.075],[1.05,2.30,.12]);
 for(const x of [-.075,.725])box("frame",[x,1.54,3.155],[.055,2.08,.045]);
 for(const y of [.67,1.38,2.41])box("frame",[.325,y,3.155],[.82,.05,.045]);
 for(const x of [.15,.55])box("door",[x,1.96,3.18],[.24,.66,.055]);
 for(const x of [.15,.55])box("door",[x,.99,3.18],[.24,.45,.055]);
 beam("handle",[-.03,1.4,3.22],[-.03,1.58,3.22],.022,8);
 // Porch lamp.
 box("frame",[-.7,2.55,3.2],[.12,.2,.09]);beam("frame",[-.7,2.63,3.2],[-.7,2.63,3.49],.025,8);
 box("headlight",[-.7,2.35,3.48],[.14,.24,.13]);
 for(const x of [-.8,-.6])beam("frame",[x,2.2,3.5],[x,2.5,3.5],.012,6);
 box("frame",[-.7,2.51,3.48],[.25,.05,.24]);box("frame",[-.7,2.18,3.48],[.22,.05,.2]);
 // Stone entry path and side paved walk.
 paving(-.68,1.27,5.49,7.57,.43);
 paving(4.35,6.38,-3.4,6.6,.64);
 paving(2.7,6.38,5.5,7.3,.59);
 pot(-1.12,3.7,.34);pot(1.27,4.04,.29);pot(3.65,3.8,.36);
 // Curved roadway and sidewalk, flat across left foreground then turns right.
 const path:V[]=[];
 for(let i=0;i<=32;i++){let x=-17+i*21/32;path.push([x,.025,9.6]);}
 const cx=4,cz=3.6,radius=6;
 for(let i=1;i<=32;i++){let t=i*Math.PI/2/32;path.push([cx+radius*Math.sin(t),.025,cz+radius*Math.cos(t)]);}
 for(let i=1;i<=28;i++)path.push([10,.025,3.6-i*18/28]);
 const tangent=(i:number)=>norm(sub(path[Math.min(i+1,path.length-1)],path[Math.max(0,i-1)]));
 const offset=(i:number,o:number,y:number):V=>{const t=tangent(i);return [path[i][0]+t[2]*o,y,path[i][2]-t[0]*o]};
 const roadHalf=2.1;
 for(let i=0;i<path.length-1;i++){
  quad("asphalt",offset(i,-roadHalf,.025),offset(i+1,-roadHalf,.025),offset(i+1,roadHalf,.025),offset(i,roadHalf,.025));
  for(const side of [-1,1]){
   let a=offset(i,side*2.12,.09),b=offset(i+1,side*2.12,.09),c=offset(i+1,side*2.9,.09),d=offset(i,side*2.9,.09);
   quad("curb",a,b,c,d);
   beam("curb",offset(i,side*2.1,.14),offset(i+1,side*2.1,.14),.10,4);
   beam("mortar",offset(i+1,side*2.12,.095),offset(i+1,side*2.9,.095),.008,4);
  }
 }
 // Broken road center lines spaced by arc length.
 let traveled=0,nextMark=0;
 for(let i=0;i<path.length-1;i++){
  const len=Math.hypot(...sub(path[i+1],path[i]));
  if(traveled>=nextMark){
   const t=tangent(i),center=vadd(path[i],vmul(t,.48));
   box("line",[center[0],.034,center[2]],[.92,.014,.11],Math.atan2(-t[2],t[0]));
   nextMark=traveled+2.2;
  }
  traveled+=len;
 }
 // Fine asphalt aggregate, truly modeled tiny triangles.
 for(let k=0;k<6000;k++){
  let i=Math.floor(rnd()*(path.length-1)),t=rnd(),o=(rnd()-.5)*4.05;
  let a=offset(i,o,.038),b=offset(i+1,o,.038),p=vadd(vmul(a,1-t),vmul(b,t)),s=.008+rnd()*.018;
  tri(k%3?"asphaltDark":"asphaltLight",[p[0]-s,p[1],p[2]],[p[0],p[1],p[2]+s],[p[0]+s,p[1],p[2]-.6*s]);
 }
 // Low garden wall with distinct blocks, and gateway piers.
 function boundary(a:V,b:V,height=1.05){
  let t=norm(sub(b,a)),len=Math.hypot(...sub(b,a)),yaw=Math.atan2(-t[2],t[0]);
  box("mortar",vadd(vmul(vadd(a,b),.5),[0,height/2+.12,0]),[len,height,.37],yaw);
  for(let row=0;row<4;row++){
   let offset=row%2?-.29:0;
   for(let d=offset;d<len;d+=.6){
    let start=Math.max(0,d),end=Math.min(len,d+.57);if(end-start<.05)continue;
    let p=vadd(a,vmul(t,(start+end)/2));
    box("stone"+Math.floor(rnd()*4),[p[0],.25+row*.235,p[2]],[end-start,.214,.42+(rnd()-.5)*.018],yaw);
   }
  }
  for(let d=0;d<len;d+=.61){let end=Math.min(len,d+.59),p=vadd(a,vmul(t,(d+end)/2));box("stone3",[p[0],1.02,p[2]],[end-d,.115,.48],yaw);}
 }
 boundary([-9,.12,7.39],[-1.07,.12,7.39]);
 boundary([1.65,.12,7.39],[4.1,.12,7.39]);
 for(let i=0;i<22;i++){
  let a=i*Math.PI/2/22,b=(i+1)*Math.PI/2/22;
  boundary([4+3.76*Math.sin(a),.12,3.6+3.76*Math.cos(a)],[4+3.76*Math.sin(b),.12,3.6+3.76*Math.cos(b)]);
 }
 boundary([7.76,.12,3.6],[7.76,.12,-6]);
 for(const x of [-1.07,1.65]){
  box("mortar",[x,.86,7.39],[.57,1.55,.58]);
  for(let row=0;row<6;row++)box("stone"+(row%4),[x,.22+row*.248,7.39],[.60,.226,.62]);
  box("stone3",[x,1.68,7.39],[.75,.15,.76]);
 }
 // Mailbox on post with rounded roof and letter slot.
 beam("frame",[-.56,.13,7.26],[-.56,1.38,7.26],.054,8);
 box("frame",[-.56,1.43,7.26],[.45,.46,.50]);
 for(let k=0;k<12;k++){
  let a=k*Math.PI/12,b=(k+1)*Math.PI/12;
  quad("frame",[-.56+Math.cos(a)*.235,1.66+Math.sin(a)*.21,7.01],[-.56+Math.cos(b)*.235,1.66+Math.sin(b)*.21,7.01],[-.56+Math.cos(b)*.235,1.66+Math.sin(b)*.21,7.51],[-.56+Math.cos(a)*.235,1.66+Math.sin(a)*.21,7.51]);
 }
 box("handle",[-.56,1.54,7.523],[.22,.035,.013]);box("black",[-.56,1.35,7.524],[.028,.03,.01]);
 // Planting layers and a characterful olive tree on left.
 tree(-6.2,4.7,4.7,2.1);tree(-6.8,-3.5,5.5,2);tree(6.1,-4.8,4.7,1.45);
 for(let i=0;i<22;i++){
  let x=-8.6+i*.57;if(x>-1.7&&x<2)continue;
  shrub(x,6.9,.37,.40);
 }
 for(let i=0;i<17;i++){let t=i*Math.PI/2/17;shrub(4+3.15*Math.sin(t),3.6+3.15*Math.cos(t),.40,.47);}
 shrub(-3.8,3.75,.62,.52);shrub(3.75,4.8,.62,.6);shrub(4.85,1.9,.47,.5);shrub(-5.8,1.7,.65,.45);
 // Cypress trees at rear-left.
 for(const [x,z,h] of [[-8,-1,7],[-7,-6,6],[6,-7,5.5]]){
  beam("trunk",[x,.2,z],[x,h*.85,z],.13,7,.055);
  for(let j=0;j<9;j++){let y=.9+j*h*.083,rr=.65*(1-j/10);ellipsoid("leaf0",[x+(rnd()-.5)*.1,y,z],[rr,h*.19,rr],9,5);}
 }
 // Meadow blades and lavender, low clusters avoid the paved regions.
 for(let k=0;k<2800;k++){
  let x=-8.7+rnd()*16,z=-6.5+rnd()*13.4;
  if((Math.abs(x)<4.45&&z<3.5)||(x>4.3&&x<6.5)||(x>-.85&&x<1.4&&z>4.5))continue;
  if(x>4&&Math.hypot(x-4,z-3.6)>3.1)continue;
  const h=.06+rnd()*.14,mat="grass"+Math.floor(rnd()*3),w=.024;
  tri(mat,[x-w,.17,z],[x+w,.17,z],[x+.03,.17+h,z-.02]);
  tri(mat,[x,.17,z-w],[x,.17+h,z+.04],[x,.17,z+w]);
 }
 for(let k=0;k<220;k++){
  let side=k%2?1:-1,x=side*(1.7+rnd()*2.5),z=4.9+rnd()*1.7,y=.25+rnd()*.45;
  beam("grass0",[x,.17,z],[x,y,z],.012,4);
  ellipsoid("lavender",[x,y,z],[.045,.09,.045],5,3);
 }
 // Blue hatchback. Its modeled local longitudinal axis is +X.
 const yaw=-Math.PI*.75,cc=Math.cos(yaw),ss=Math.sin(yaw);
 transform=(p:V)=>[5.4+(p[0]*cc+p[2]*ss)*1.05,p[1]*1.05+.04,9.35+(-p[0]*ss+p[2]*cc)*1.05];
 // Lower contour, engine hood, rear hatch, beltline and bumper.
 const sections=[
 [-2.20,.69,.43,.81],[-1.97,.95,.43,.94],[-1.60,1.08,.44,.99],[-.95,1.12,.46,1.01],
 [.70,1.10,.46,1.01],[1.40,.96,.46,.99],[1.99,.77,.48,.91],[2.20,.69,.49,.77]
 ];
 // Profile perimeter has bevels and a contoured sill.
 function ring(s:number[]):V[]{let [x,top,bot,w]=s;return [[x,bot,-w*.88],[x,bot+.12,-w],[x,top-.13,-w],[x,top,-w*.87],[x,top,w*.87],[x,top-.13,w],[x,bot+.12,w],[x,bot,w*.88]]}
 for(let k=0;k<sections.length-1;k++){
  let a=ring(sections[k]),b=ring(sections[k+1]);
  for(let j=0;j<8;j++){let q=(j+1)%8;quad(j===3?"blueLight":"blue",a[j],a[q],b[q],b[j]);}
 }
 const r0=ring(sections[0]),r1=ring(sections.at(-1)!);
 for(let j=1;j<r0.length-1;j++)tri("blue",r0[0],r0[j+1],r0[j]);
 for(let j=1;j<r1.length-1;j++)tri("blue",r1[0],r1[j],r1[j+1]);
 // Cabin wedge with real separate window panes, pillars, solid roof.
 const A:V=[-1.83,1.09,-.87],B:V=[.99,1.06,-.87],C:V=[.31,1.84,-.76],D:V=[-1.30,1.86,-.74];
 const Ap:V=[-1.83,1.09,.87],Bp:V=[.99,1.06,.87],Cp:V=[.31,1.84,.76],Dp:V=[-1.30,1.86,.74];
 quad("glass",A,D,C,B);quad("glass",Ap,Bp,Cp,Dp);
 quad("glass",B,C,Cp,Bp);quad("glass",A,Ap,Dp,D);
 quad("blueLight",D,Dp,Cp,C);
 const lerp=(a:V,b:V,t:number):V=>vadd(vmul(a,1-t),vmul(b,t));
 const glassOffset:V=[.010,.012,0];
 quad("glassLight",vadd(lerp(B,C,.87),glassOffset),vadd(lerp(B,C,.92),glassOffset),vadd(lerp(Bp,Cp,.92),glassOffset),vadd(lerp(Bp,Cp,.87),glassOffset));
 for(const sign of [-1,1])beam("glassLight",[-1.18,1.80,sign*.768],[-.33,1.79,sign*.785],.008,4);
 // Pillar trim across both flanks.
 for(let sign of [-1,1]){
  beam("blueDark",[-1.83,1.10,sign*.883],[-1.30,1.85,sign*.755],.046,6);
  beam("blueDark",[.99,1.06,sign*.883],[.31,1.84,sign*.775],.045,6);
  beam("frame",[-.20,1.08,sign*.893],[-.18,1.845,sign*.77],.038,6);
  beam("frame",[-1.83,1.09,sign*.89],[.98,1.06,sign*.89],.029,6);
  beam("blue",[-1.3,1.86,sign*.75],[.31,1.84,sign*.775],.038,6);
  // Real doors, horizontal sculpted contour line, handles.
  beam("blueDark",[-.2,.55,sign*1.02],[-.2,1.08,sign*1.02],.012,4);
  beam("blueDark",[.97,.60,sign*.99],[.99,1.03,sign*.99],.01,4);
  beam("blueLight",[-1.82,.65,sign*.995],[1.65,.62,sign*.99],.014,5);
  box("black",[-.53,1.02,sign*1.027],[.20,.052,.025]);
  box("blueDark",[.68,1.00,sign*1.017],[.20,.05,.025]);
  ellipsoid("blue",[.85,1.25,sign*1.08],[.17,.09,.16],12,6);
  ellipsoid("black",[.855,1.25,sign*1.12],[.13,.055,.13],10,5);
 }
 // Hood panel seams and windshield wipers.
 beam("blueDark",[1.03,1.07,-.83],[1.9,.79,-.81],.009,4);
 beam("blueDark",[1.03,1.07,.83],[1.9,.79,.81],.009,4);
 beam("frame",[.90,1.13,-.70],[.58,1.18,-.30],.013,6);
 beam("frame",[.88,1.13,.1],[.62,1.19,.56],.013,6);
 // Four tires, alloy rims with spokes and hubs.
 for(let x of [-1.43,1.42])for(let sign of [-1,1]){
  const z=sign*.99;
  beam("tire",[x,.50,z-.14],[x,.50,z+.14],.49,32);
  beam("rim",[x,.50,sign*1.145],[x,.50,sign*1.158],.35,24);
  beam("black",[x,.50,sign*1.164],[x,.50,sign*1.169],.30,24);
  beam("rim",[x,.50,sign*1.170],[x,.50,sign*1.191],.075,16);
  for(let j=0;j<10;j++){
   let t=j*TAU/10;
   beam("rim",[x+Math.cos(t)*.10,.5+Math.sin(t)*.10,sign*1.18],[x+Math.cos(t+.13)*.31,.5+Math.sin(t+.13)*.31,sign*1.18],.024,5);
  }
  for(let j=0;j<5;j++){let t=j*TAU/5;ellipsoid("black",[x+Math.cos(t)*.05,.5+Math.sin(t)*.05,sign*1.20],[.014,.014,.006],5,3);}
  // Wheel arch crescent is modeled above tire.
  for(let j=0;j<20;j++){
   let a=j*Math.PI/20,b=(j+1)*Math.PI/20;
   let p=(t:number,r:number):V=>[x+Math.cos(t)*r,.5+Math.sin(t)*r,sign*1.025];
   quad("blue",p(a,.50),p(b,.50),p(b,.56),p(a,.56));
  }
 }
 // Sculpted front face, grille, headlights, badge and fog lights.
 box("black",[2.14,.61,0],[.06,.21,1.23]);
 box("black",[2.1,.82,0],[.06,.14,.80]);
 for(let j=0;j<3;j++)box("rim",[2.138,.78+j*.034,0],[.014,.007,.73]);
 box("blue",[-1.42,1.88,0],[.27,.07,1.5]);
 beam("frame",[-1.77,1.18,-.5],[-1.57,1.3,.3],.012,6);
 for(let j=0;j<4;j++)box("rim",[2.181,.54+j*.045,0],[.012,.009,1.15]);
 box("blueDark",[2.19,.40,0],[.05,.13,1.53]);
 box("plate",[2.184,.57,0],[.018,.16,.42]);
 for(let sign of [-1,1]){
  const z=sign*.67;
  quad("frame",[2.13,.74,z-.23],[2.10,.88,z-.22],[1.97,.93,z+.20],[2.12,.76,z+.23]);
  quad("headlight",[2.142,.757,z-.20],[2.117,.865,z-.19],[1.985,.901,z+.18],[2.13,.775,z+.20]);
  beam("rim",[2.15,.79,z-.18],[2.05,.86,z+.15],.015,5);
  beam("rim",[2.19,.435,sign*.64],[2.20,.435,sign*.64],.065,12);
  ellipsoid("headlight",[2.213,.435,sign*.64],[.019,.040,.050],10,4);
  ellipsoid("tail",[-2.09,.90,sign*.77],[.09,.15,.17],12,5);
 }
 beam("rim",[2.191,.80,0],[2.211,.80,0],.08,18);
 box("black",[-2.219,.56,0],[.027,.14,1.38]);box("plate",[-2.24,.71,0],[.018,.15,.40]);
 box("blueDark",[-.50,1.89,0],[1.67,.045,1.48]);
 beam("black",[-.65,1.91,0],[-.85,2.16,0],.010,6);
 // Interior silhouettes visible as shapes behind glazing.
 for(let sign of [-1,1]){ellipsoid("black",[.10,1.20,sign*.43],[.31,.41,.22],10,6);ellipsoid("black",[.06,1.53,sign*.43],[.17,.17,.15],10,5);}
 transform=save;
 // Distant low hills, actual triangulated ground surfaces.
 for(let band=0;band<3;band++){
  const z0=-16-band*16;
  const H=(x:number,z:number)=>1.2+band*1.1+3.5*Math.pow(.5+.5*Math.sin(x*.13+band*1.2),2)+2.1*Math.sin(x*.29+z*.1)**2;
  for(let ix=0;ix<48;ix++)for(let iz=0;iz<5;iz++){
   let xa=-65+ix*2.7,xb=xa+2.7,za=z0-iz*3.2,zb=za-3.2;
   quad("landscape"+band,[xa,H(xa,za),za],[xb,H(xb,za),za],[xb,H(xb,zb),zb],[xa,H(xa,zb),zb]);
  }
 }
 // Source texture assets are generated and registered in the simulation worker.
 const sampler=createSamplerHandle("scene.surface.sampler");
 this.assetsRegistry.register(sampler);
 this.assetsRegistry.markReady(sampler,createSamplerAsset({addressModeU:"repeat",addressModeV:"repeat",magFilter:"linear",minFilter:"linear",maxAnisotropy:4}));
 const texture=(id:string,kind:string,normal=false)=>{
  const handle=createTextureHandle("scene."+id),size=256,pixels=new Uint8Array(size*size*4);
  const noise=(x:number,y:number)=>{let n=Math.imul(x+971,374761393)^Math.imul(y+541,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};
  const height=(x:number,y:number)=>{
   const n=noise((x+size)%size,(y+size)%size);
   if(kind==="asphalt")return .45+n*.55;
   if(kind==="lawn")return .67+n*.20+.11*Math.sin(x*.12)*Math.sin(y*.15);
   if(kind==="stone")return .81+n*.15+.04*Math.sin(x*.15+y*.04);
   if(kind==="tile")return .85+n*.1+.035*Math.sin(y*.22);
   return .87+n*.12;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const k=(y*size+x)*4;
   if(normal){
    const dx=(height(x+1,y)-height(x-1,y))*1.6,dy=(height(x,y+1)-height(x,y-1))*1.6;
    const n=norm([-dx,-dy,1]);pixels[k]=(n[0]*.5+.5)*255;pixels[k+1]=(n[1]*.5+.5)*255;pixels[k+2]=(n[2]*.5+.5)*255;
   }else{const value=height(x,y)*255;pixels[k]=pixels[k+1]=pixels[k+2]=value;}
   pixels[k+3]=255;
  }
  this.assetsRegistry.register(handle);
  this.assetsRegistry.markReady(handle,createTextureAsset({label:id,dimension:"2d",width:size,height:size,format:normal?"rgba8unorm":"rgba8unorm-srgb",colorSpace:normal?"data":"srgb",semantic:normal?"normal":"base-color",sourceData:{bytes:pixels,bytesPerRow:size*4}}));
  return {texture:handle,sampler};
 };
 const maps:any={};
 for(const kind of ["stucco","stone","asphalt","lawn","tile"]){maps[kind]={baseColorTexture:texture(kind+".color",kind),...(kind==="lawn"||kind==="tile"?{}:{normalTexture:texture(kind+".normal",kind,true),normalScale:.5})};}
 // Publish ordinary static ECS meshes, batched by material.
 for(const [name,g] of batches){
  const [baseColor,roughness,metallic]=palette[name];
  const matHandle=createMaterialHandle("scene."+name+".pbr");
  let kind=name.startsWith("stucco")?"stucco":name.startsWith("stone")||name.startsWith("path")?"stone":name==="asphalt"?"asphalt":name==="lawn"?"lawn":name.startsWith("tile")?"tile":null;
  this.assetsRegistry.register(matHandle);
  this.assetsRegistry.markReady(matHandle,createStandardMaterialAsset({label:name,baseColorFactor:color.srgbHex(baseColor),roughnessFactor:roughness,metallicFactor:metallic,...(kind?maps[kind]:{}),...(name.startsWith("blue")?{clearcoatFactor:.55,clearcoatRoughnessFactor:.22}:{})}));
  let sourceMesh=createTriangleListMeshAsset({label:name,positions:g.positions.map(p=>[p[0]*.88,p[1]*.88,(p[2]-.6)*.88] as V),normals:g.normals,uvs:g.uvs});
  if(kind==="stucco"||kind==="stone"||kind==="asphalt"){
   const tangents=new Float32Array(g.positions.length*4);
   for(let j=0;j<g.positions.length;j+=3){
    const e1=sub(g.positions[j+1],g.positions[j]),e2=sub(g.positions[j+2],g.positions[j]);
    const u1=g.uvs[j+1][0]-g.uvs[j][0],v1=g.uvs[j+1][1]-g.uvs[j][1],u2=g.uvs[j+2][0]-g.uvs[j][0],v2=g.uvs[j+2][1]-g.uvs[j][1];
    const determinant=u1*v2-u2*v1;
    const t=vmul(sub(vmul(e1,v2),vmul(e2,v1)),1/determinant),bt=vmul(sub(vmul(e2,u1),vmul(e1,u2)),1/determinant);
    for(let k=0;k<3;k++){
     const n=g.normals[j+k],dot=t[0]*n[0]+t[1]*n[1]+t[2]*n[2],tan=norm(sub(t,vmul(n,dot))),c=cross(n,tan);
     const w=c[0]*bt[0]+c[1]*bt[1]+c[2]*bt[2]<0?-1:1;
     tangents.set([tan[0],tan[1],tan[2],w],(j+k)*4);
    }
   }
   if(!tangents.every(Number.isFinite))throw new Error("Invalid authored surface tangents: "+name);
   sourceMesh={...sourceMesh,vertexStreams:[...sourceMesh.vertexStreams,{id:"authored-tangents",arrayStride:16,vertexCount:g.positions.length,attributes:[{semantic:"TANGENT",format:"float32x4",offset:0}],data:tangents}]};
  }
  const meshHandle=this.meshes.publish("scene."+name+".geometry",sourceMesh).handle;
  this.spawn.mesh({key:"scene."+name,name:"Authored "+name,mesh:meshHandle,material:matHandle,castShadow:!name.startsWith("asphalt"),receiveShadow:true});
 }
 this.diagnostics.info("scene.authored",{seed:94173,batches:batches.size,triangles:[...batches.values()].reduce((n,b)=>n+b.positions.length/3,0)});
 }
}
