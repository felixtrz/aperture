import {createSystem,material} from '@aperture-engine/app/systems';
import {createTriangleListMeshAsset,createSamplerAsset,createRoundedBoxMeshAsset} from '@aperture-engine/render';
import {createSamplerHandle,createEnvironmentMapHandle} from '@aperture-engine/simulation';
type V=number[];
const add=(a:V,b:V)=>a.map((v,i)=>v+b[i]);
const sub=(a:V,b:V)=>a.map((v,i)=>v-b[i]);
const mul=(a:V,s:number)=>a.map(v=>v*s);
const cross=(a:V,b:V)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V)=>mul(a,1/Math.hypot(...a));
let seed=44129;function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const batches=new Map<string,{p:V[],n:V[],uv:V[],col:string,rough:number,metal:number}>();
function mat(id:string,col:string,rough=.85,metal=0){batches.set(id,{p:[],n:[],uv:[],col,rough,metal});}
function tri(id:string,a:V,b:V,c:V,n?:V[],uv?:V[]){const m=batches.get(id)!;const norm=unit(cross(sub(b,a),sub(c,a)));if(!Number.isFinite(norm[0]))throw Error('degenerate '+id);m.p.push(a,b,c);m.n.push(...(n??[norm,norm,norm]));m.uv.push(...(uv??[[0,0],[1,0],[1,1]]));}
function quad(id:string,a:V,b:V,c:V,d:V){tri(id,a,b,c);tri(id,a,c,d);}
function box(id:string,c:V,s:V,fn?:(v:V)=>V){
 const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>{const p=v.map((x,i)=>x*s[i]/2+c[i]);return fn?fn(p):p;});
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(id,...f.map(i=>v[i]) as [V,V,V,V]);
}
function bevelBox(id:string,c:V,size:V,fn?:(v:V)=>V){
 const asset=createRoundedBoxMeshAsset({halfExtents:size.map(v=>v/2) as any,radius:Math.min(.035,...size.map(v=>v*.2)),bevelSegments:1});
 const stream=asset.vertexStreams[0],stride=stream.arrayStride/4,data=stream.data as Float32Array,idx=asset.indexBuffer?.data;
 const outP:V[]=[],outN:V[]=[];for(let i=0;i<stream.vertexCount;i++){const a=i*stride,p=[data[a]+c[0],data[a+1]+c[1],data[a+2]+c[2]],n=[data[a+3],data[a+4],data[a+5]];outP.push(fn?fn(p):p);outN.push(fn?unit(sub(fn(add(p,n)),fn(p))):n);}
 const count=idx?.length??outP.length;for(let i=0;i<count;i+=3){const ids=[idx?idx[i]:i,idx?idx[i+1]:i+1,idx?idx[i+2]:i+2];tri(id,outP[ids[0]],outP[ids[1]],outP[ids[2]],ids.map(j=>outN[j]));}
}
function leafCloud(c:V,r:V,count=140,slender=1){
 for(let i=0;i<count;i++){
 const a=rand()*6.283,b=Math.acos(2*rand()-1),radius=Math.cbrt(rand()),pos=add(c,[Math.cos(a)*Math.sin(b)*radius*r[0],Math.cos(b)*radius*r[1],Math.sin(a)*Math.sin(b)*radius*r[2]]);
 const yaw=rand()*6.283,tilt=(rand()-.5)*1.2,U=[Math.cos(yaw)*Math.cos(tilt),Math.sin(tilt),Math.sin(yaw)*Math.cos(tilt)],Vv=[-Math.sin(yaw),0,Math.cos(yaw)];
 const len=(.075+rand()*.07)*slender,w=.025+rand()*.015,tip1=add(pos,mul(U,len)),tip2=add(pos,mul(U,-len)),e1=add(pos,mul(Vv,w)),e2=add(pos,mul(Vv,-w)),ridge=add(pos,[0,.018,0]),id='leaf'+Math.floor(rand()*4);
 for(const [aa,bb] of [[tip1,e1],[e1,tip2],[tip2,e2],[e2,tip1]]){tri(id,aa,ridge,bb);tri(id,bb,ridge,aa);}
 }
}
function slab(id:string,c:V,w:number,d:number){
 const n=6,rings:V[]=[];for(let i=0;i<n;i++){const t=i*6.283/n,rr=.87+rand()*.15;rings.push([c[0]+Math.cos(t)*w*.5*rr,c[1],c[2]+Math.sin(t)*d*.5*rr]);}
 for(let i=0;i<n;i++){const a=rings[i],b=rings[(i+1)%n];tri(id,c,b,a);const A=[a[0],a[1]-.08,a[2]],B=[b[0],b[1]-.08,b[2]];quad(id,a,A,B,b);}
}
function ellipsoid(id:string,c:V,r:V,seg=10,rows=7){
 const p=(a:number,b:number)=>add(c,[r[0]*Math.sin(b)*Math.cos(a),r[1]*Math.cos(b),r[2]*Math.sin(b)*Math.sin(a)]);
 const n=(a:number,b:number)=>unit([Math.sin(b)*Math.cos(a)/r[0],Math.cos(b)/r[1],Math.sin(b)*Math.sin(a)/r[2]]);
 for(let j=0;j<rows;j++)for(let i=0;i<seg;i++){const a=i*2*Math.PI/seg,A=(i+1)*2*Math.PI/seg,b=j*Math.PI/rows,B=(j+1)*Math.PI/rows;const vs=[p(a,b),p(a,B),p(A,B),p(A,b)],ns=[n(a,b),n(a,B),n(A,B),n(A,b)];if(j>0)tri(id,vs[0],vs[3],vs[1],[ns[0],ns[3],ns[1]]);if(j<rows-1)tri(id,vs[1],vs[3],vs[2],[ns[1],ns[3],ns[2]]);}
}
function rod(id:string,a:V,b:V,r:number,R=r,seg=10){
 const y=unit(sub(b,a)),x=unit(cross(y,Math.abs(y[1])<.9?[0,1,0]:[1,0,0])),z=cross(x,y);
 const circle=(c:V,rr:number,t:number)=>add(c,add(mul(x,rr*Math.cos(t)),mul(z,rr*Math.sin(t))));
 for(let i=0;i<seg;i++){let t=i*2*Math.PI/seg,T=(i+1)*2*Math.PI/seg,p=circle(a,r,t),q=circle(a,r,T),s=circle(b,R,T),v=circle(b,R,t);quad(id,p,v,s,q);tri(id,a,p,q);tri(id,b,s,v);}
}
function beam(id:string,a:V,b:V,w:number,d=w){
 const y=unit(sub(b,a)),x=unit(cross(y,Math.abs(y[1])<.9?[0,1,0]:[1,0,0])),z=cross(x,y),c=mul(add(a,b),.5);
 box(id,[0,0,0],[w,Math.hypot(...sub(b,a)),d],p=>add(c,add(mul(x,p[0]),add(mul(y,p[1]),mul(z,p[2])))));
}
function tile(id:string,x:number,z0:number,z1:number,y0:number,y1:number,width=.28){
 const r=width*.5,th=.022,axis=unit([0,y1-y0,z1-z0]),normal=unit(cross([1,0,0],axis)),center0=[x,y0,z0],center1=[x,y1,z1];
 const p=(c:V,t:number,R:number)=>add(c,add([R*Math.cos(t),0,0],mul(normal,R*Math.sin(t))));
 for(let s=0;s<6;s++){const t=s*Math.PI/6,T=(s+1)*Math.PI/6;const a=p(center0,t,r),b=p(center0,T,r),c=p(center1,T,r),d=p(center1,t,r);quad(id,a,d,c,b);quad(id,p(center0,t,r-th),p(center0,T,r-th),p(center1,T,r-th),p(center1,t,r-th));quad(id,b,a,p(center0,t,r-th),p(center0,T,r-th));quad(id,d,c,p(center1,T,r-th),p(center1,t,r-th));}
}
function wallFace(u0:number,u1:number,y0:number,y1:number,holes:number[][],fn:(p:V)=>V){
 const xs=[u0,u1,...holes.flatMap(h=>[h[0],h[1]])].sort((a,b)=>a-b),ys=[y0,y1,...holes.flatMap(h=>[h[2],h[3]])].sort((a,b)=>a-b);
 const X=[...new Set(xs)],Y=[...new Set(ys)];
 for(let i=0;i<X.length-1;i++)for(let j=0;j<Y.length-1;j++){const x=(X[i]+X[i+1])/2,y=(Y[j]+Y[j+1])/2;if(holes.some(h=>x>h[0]&&x<h[1]&&y>h[2]&&y<h[3]))continue;box('stucco',[x,y,-.14],[X[i+1]-X[i],Y[j+1]-Y[j],.28],fn);}
}
function windowPart(u:number,y:number,w:number,h:number,fn:(p:V)=>V){
 box('inside',[u,y,-.21],[w,h,.075],fn);
 box('glass',[u,y,-.14],[w-.14,h-.14,.025],fn);
 for(const [x,Y,W,H] of [[u-w/2+.045,y,.09,h],[u+w/2-.045,y,.09,h],[u,y-h/2+.045,w,.09],[u,y+h/2-.045,w,.09],[u,y,.055,h],[u,y-.06,w,.045]])box('frame',[x,Y,-.015],[W,H,.09],fn);
 bevelBox('sill',[u,y-h/2-.11,.035],[w+.24,.16,.33],fn);
 // Interior curtains behind the glazing and small planter silhouettes.
 for(const x of [u-w*.34,u+w*.34])box('curtain',[x,y,-.16],[w*.12,h-.21,.025],fn);
 box('pot',[u-.26,y-h/2+.11,-.085],[.2,.23,.09],fn);
 ellipsoid('leaf2',fn([u-.26,y-h/2+.36,-.05]),[.13,.2,.05],8,5);
}
function roofSurface(x0:number,x1:number,z0:number,z1:number,y0:number,y1:number,step=.29){
 quad('roofbase',[x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1]);
 const rows=Math.ceil(Math.abs(z1-z0)/.4);for(let i=0;i<Math.ceil((x1-x0)/step);i++)for(let j=0;j<rows;j++){const t=j/rows,T=Math.min(1,(j+1.08)/rows),z=z0+(z1-z0)*t,Z=z0+(z1-z0)*T;tile('tile'+Math.floor(rand()*5),x0+step*.5+i*step,z,Z,y0+(y1-y0)*t+.045,y0+(y1-y0)*T+.045,step*.96);}
}
function bush(x:number,z:number,r=.6,height=.7){
 for(let k=0;k<10;k++){const a=rand()*Math.PI*2,rr=rand()*r,c=[x+Math.cos(a)*rr,.35+height*(.45+rand()*.4),z+Math.sin(a)*rr];leafCloud(c,[r*(.32+rand()*.18),height*(.3+rand()*.2),r*(.32+rand()*.18)],85,.9);}
}
function tree(x:number,z:number,size=1){
 rod('bark',[x,.22,z],[x+.16*size,2.15*size,z],.16*size,.09*size,10);
 for(let j=0;j<7;j++){const a=j*2.4,tip=[x+Math.cos(a)*.95*size,(2.4+rand()*.6)*size,z+Math.sin(a)*.9*size];rod('bark',[x+.12*size,1.3*size,z],tip,.07*size,.025*size,8);}
 for(let k=0;k<32;k++){const a=rand()*6.283,b=rand()*Math.PI,r=1.25*size;leafCloud([x+Math.cos(a)*Math.sin(b)*r,(2.6+Math.cos(b)*.65)*size,z+Math.sin(a)*Math.sin(b)*r],[.55*size,.44*size,.54*size],170,1.0);}
}
function cypress(x:number,z:number,h=4){
 rod('bark',[x,.2,z],[x,h*.7,z],.09,.055,8);
 for(let i=0;i<14;i++)leafCloud([x+.03*Math.sin(i),.5+h*(i+.4)/15,z],[.53*(1-i/16),h*.1,.47*(1-i/16)],260,.65);
}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export default class Setup extends createSystem({priority:0}){
 init(){
 mat('stucco','#ead9b5');mat('sill','#baad91');mat('inside','#171e21');mat('frame','#323c40',.47,.15);mat('glass','#547082',.16,.35);mat('curtain','#c6bda1');mat('roofbase','#714022');
 ['#b76630','#aa5528','#c77b3e','#b95e2b','#ce8044'].forEach((c,i)=>mat('tile'+i,c,.75));
 mat('wood','#67533d');mat('door','#424d53',.62);mat('pot','#ab6438');mat('bark','#756044');
 ['#506234','#728044','#899053','#5a6c37'].forEach((c,i)=>mat('leaf'+i,c,.97));
 mat('meadow','#85936a');mat('hills','#697e73');mat('hills2','#819494');mat('grass','#7c813e');mat('grass2','#96984e');mat('dirt','#89775a');mat('asphalt','#4d5052');
 mat('mortar','#9b947e');['#bab296','#c9c0a5','#aca68d','#d1c5a6','#bcb29d'].forEach((c,i)=>mat('stone'+i,c));
 mat('paver','#c3bea9');mat('paver2','#b1ad99');mat('white','#d7d7c4');mat('lavender','#8c7eac');mat('flower','#c7ba6b');
 mat('blue','#1f5c97',.24,.32);mat('blue2','#336dac',.23,.3);mat('black','#151b21',.65);
 mat('chrome','#aeb4b5',.22,.8);mat('carGlass','#2f485a',.13,.45);mat('headlight','#e5e1c2',.22,.18);mat('red','#a82721',.27);mat('seat','#756e60');mat('plate','#c4c4b7');
 // Native sky plus matching source environment illumination.
 const env=createEnvironmentMapHandle('daylight');this.assetsRegistry.register(env);
 const pixels=new Uint8Array(64*32*4);for(let y=0;y<32;y++)for(let x=0;x<64;x++){const t=y/31,base=[.61+.05*t,.64+.04*t,.65+.09*t];for(let c=0;c<3;c++)pixels[(y*64+x)*4+c]=Math.round(base[c]*.53*255);pixels[(y*64+x)*4+3]=255;}
 this.assetsRegistry.markReady(env,{kind:'environment-map',label:'Soft daylight',diffuseResourceKey:'environment-map:daylight:diffuse',specularResourceKey:'environment-map:daylight:specular',equirectSource:{label:'daylight',resourceKey:'environment-map:daylight:equirect-cube',width:64,height:32,data:pixels,faceSize:64,format:'rgba8unorm',mipLevelCount:4},standardMaterialCount:1});
 this.spawn.proceduralSky({key:'sky.daylight',topColor:[.15,.29,.49],horizonColor:[.57,.63,.72],bottomColor:[.72,.70,.61],horizonPosition:0,horizonSoftness:.35,sunRadius:0,sunGlow:0});
 this.spawn.light({key:'light.environment',kind:'environment',light:{environmentMap:env}});
 // Sun and normal ECS camera.
 this.spawn.camera({key:'camera.main',transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:.1,far:200,aspect:4/3,autoAspect:false}});
 this.spawn.light({key:'light.sun',kind:'directional',color:[1,.86,.68,1],intensity:3.1,transform:{rotationEulerDegrees:[-49,-43,0]},shadow:{enabled:true,mapSize:2048,cascadeCount:1,shadowType:1,strength:.84,filterRadius:1.8,normalBias:.02,center:[0,3,0],orthographicSize:32,near:.1,far:65,lightDistance:30}});
 this.spawn.light({key:'light.fill',kind:'ambient',color:[.68,.79,1,1],intensity:.16});
 box('meadow',[0,-.3,0],[50,.5,50]);
 ellipsoid('hills2',[-16,-.4,-21],[13,4.3,7],32,12);ellipsoid('hills',[0,-.4,-23],[17,3.6,6],32,12);ellipsoid('hills2',[19,-.4,-22],[13,5.7,7],32,12);box('grass',[-1,.02,-2],[20,.12,17.0]);
 // Road: a smooth bend from the front to the right of the house.
 const path:V[]=[];for(let i=0;i<=60;i++){const t=i/60;let x,z;if(t<.5){const u=t*2;x=-16+22*u;z=9-.25*Math.sin(u*Math.PI);}else{const u=(t-.5)*2;x=6+7.3*Math.sin(u*Math.PI/2);z=9-25*(1-Math.cos(u*Math.PI/2));}path.push([x,.04,z]);}
 const edge=(i:number,off:number)=>{const d=unit(sub(path[Math.min(i+1,60)],path[Math.max(i-1,0)]));return add(path[i],[d[2]*off,0,-d[0]*off]);};
 for(let i=0;i<60;i++){
   const a=edge(i,-4.2),b=edge(i+1,-4.2),c=edge(i+1,2.2),d=edge(i,2.2);quad('asphalt',a,b,c,d);
   const A=edge(i,2.24),B=edge(i+1,2.24),C=edge(i+1,3.14),D=edge(i,3.14);A[1]=B[1]=C[1]=D[1]=.19;quad('paver',A,B,C,D);quad('stone1',edge(i,2.24),A,B,edge(i+1,2.24));
 }
 // Curbstones, sidewalk seams, and broken center markings.
 for(let i=0;i<60;i++){const a=edge(i,2.17),b=edge(i+1,2.17);a[1]=b[1]=.15;beam('stone'+(i%5),a,b,.17,.22);if(i%3===0){const A=edge(i,-1.07),B=edge(Math.min(i+1,60),-1.07),C=edge(Math.min(i+1,60),-.93),D=edge(i,-.93);for(const p of [A,B,C,D])p[1]=.047;quad('white',A,B,C,D);}}
 // Asphalt aggregate flecks.
 for(let i=0;i<2700;i++){const k=Math.floor(rand()*59),o=-4.1+rand()*6.2,p=edge(k,o);p[0]+=rand()*.3;p[1]=.047;const s=.007+rand()*.017;tri(i%2?'stone2':'black',[p[0]-s,p[1],p[2]],[p[0],p[1],p[2]+s],[p[0]+s,p[1],p[2]]);}
 // Inset house walls, with genuine openings and deep reveals.
 const front=(p:V)=>[p[0],p[1],3.06+p[2]],back=(p:V)=>[-p[0],p[1],-3.06-p[2]],right=(p:V)=>[4.04+p[2],p[1],-p[0]],left=(p:V)=>[-4.04-p[2],p[1],p[0]];
 const holes=[[-2.92,-1.62,.86,2.35],[1.54,2.84,.86,2.35],[-2.8,-1.35,4.12,5.65],[1.48,2.93,4.12,5.65],[-.53,.63,.3,2.53]];
 wallFace(-4,4,.28,6.3,holes,front);
 for(const h of holes.slice(0,4))windowPart((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],front);
 for(const f of [right,left]){const hs=[[-2.08,-1.05,.92,2.35],[1.25,2.25,.92,2.35],[-2.06,-1.12,4.17,5.55],[1.22,2.16,4.17,5.55]];wallFace(-3.06,3.06,.28,6.3,hs,f);for(const h of hs)windowPart((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],f);tri('stucco',f([-3.06,6.3,0]),f([3.06,6.3,0]),f([0,8.22,0]));}
 const bh=[[-2.9,-1.5,4.15,5.65],[1.5,2.9,4.15,5.65],[-2.7,-1.3,1.15,2.5],[1.4,2.7,1.15,2.5]];wallFace(-4,4,.28,6.3,bh,back);for(const h of bh)windowPart((h[0]+h[1])/2,(h[2]+h[3])/2,h[1]-h[0],h[3]-h[2],back);
 box('sill',[0,.23,0],[8.16,.3,6.2]);
 box('door',[.05,1.4,2.91],[1.1,2.24,.15]);for(const x of [-.24,.32])for(const y of [.86,1.95])box('frame',[x,y,3.0],[.41,.7,.035]);rod('chrome',[-.36,1.25,3.04],[-.36,1.4,3.04],.027,.027,8);
 // Main terracotta roof and timber fascia.
 roofSurface(-4.46,4.46,3.49,0,6.31,8.25);roofSurface(-4.46,4.46,0,-3.49,8.25,6.31);
 for(const z of [-3.49,3.49])box('wood',[0,6.25,z],[9.05,.19,.15]);
 for(const x of [-4.46,4.46]){beam('wood',[x,6.3,-3.5],[x,8.24,0],.15);beam('wood',[x,8.24,0],[x,6.3,3.5],.15);}
 for(let i=0;i<28;i++)rod('tile2',[-4.45+i*.32,8.28,0],[-4.12+i*.32,8.28,0],.17,.17,10);
 for(const x of [-3.92,3.92]){rod('frame',[x,6.19,3.43],[x,5.92,3.38],.055);rod('frame',[x,5.92,3.38],[x,.3,3.2],.055);}
 // Chimney with an open cap and roof-tile lid.
 box('stucco',[2.5,8.4,-.85],[.72,1.7,.65]);box('sill',[2.5,9.13,-.85],[.9,.16,.83]);for(const x of [2.19,2.81])for(const z of [-1.13,-.57])box('stucco',[x,9.32,z],[.13,.36,.13]);box('inside',[2.5,9.17,-.85],[.59,.03,.49]);box('tile2',[2.5,9.52,-.85],[1.03,.13,.94]);
 // Covered porch, two posts, stone steps and light.
 bevelBox('paver',[0,.31,3.92],[5.4,.28,1.94]);bevelBox('paver2',[0,.17,4.96],[3.35,.2,.44]);bevelBox('paver',[0,.08,5.26],[2.85,.16,.38]);
 for(const x of [-2.22,2.22]){box('stucco',[x,1.64,4.51],[.29,2.65,.34]);box('sill',[x,.4,4.51],[.42,.16,.47]);box('sill',[x,2.92,4.51],[.44,.16,.47]);}
 box('wood',[0,2.97,4.52],[5.3,.22,.2]);box('wood',[0,3.17,3.18],[5.3,.18,.18]);roofSurface(-2.65,2.65,4.8,3.1,3.07,3.67,.28);box('wood',[0,3.01,4.82],[5.5,.12,.12]);
 box('frame',[-.96,2.15,3.18],[.06,.44,.06]);box('headlight',[-.96,2.14,3.22],[.14,.22,.15]);box('frame',[-.96,2.32,3.22],[.21,.045,.21]);
 // Low stone garden boundary with a front entry.
 const masonry=(a:V,b:V,h=.86)=>{const len=Math.hypot(...sub(b,a)),d=unit(sub(b,a)),n=[-d[2],0,d[0]],mid=mul(add(a,b),.5);box('mortar',[mid[0],h*.5+.17,mid[2]],[len,h,.33],p=>[mid[0]+(p[0]-mid[0])*d[0]+(p[2]-mid[2])*n[0],p[1],mid[2]+(p[0]-mid[0])*d[2]+(p[2]-mid[2])*n[2]]);
 for(let row=0;row<3;row++){const count=Math.ceil(len/.61);for(let j=0;j<count;j++){const t=(j+.5)/count,pos=add(a,mul(sub(b,a),t));bevelBox('stone'+((j+row*2)%5),[0,.18+(row+.5)*h/3,0],[len/count-.035,h/3-.02,.38],p=>[pos[0]+p[0]*d[0]+p[2]*n[0],p[1],pos[2]+p[0]*d[2]+p[2]*n[2]]);}}beam('stone1',[a[0],h+.2,a[2]],[b[0],h+.2,b[2]],.42,.13);};
 masonry([-9,.2,6.52],[-1.4,.2,6.52]);masonry([1.4,.2,6.52],[6.5,.2,6.52]);masonry([6.5,.2,6.52],[8.2,.2,4.9]);masonry([8.2,.2,4.9],[9.1,.2,1.1]);masonry([9.1,.2,1.1],[9.1,.2,-7]);
 for(const x of [-1.55,1.55]){for(let j=0;j<5;j++)bevelBox('stone'+j%5,[x,.17+(j+.5)*.27,6.52],[.51,.245,.52]);box('stone1',[x,1.57,6.52],[.68,.15,.67]);}
 // Irregular stone path from the garden gate to the porch.
 box('mortar',[0,.11,6.0],[2.36,.08,1.93]);
 for(let row=0;row<8;row++)for(let j=0;j<4;j++){const x=-1.06+j*.55+(row%2?.09:-.04),z=5.1+row*.25;slab((row+j)%2?'paver':'paver2',[x,.2,z],.6,.34);}
 // Right driveway, individual pavers.
 box('mortar',[5.87,.13,1.3],[3.75,.1,9.8]);
 for(let i=0;i<8;i++)for(let j=0;j<16;j++)slab((i+j)%3?'paver':'paver2',[4.3+i*.43+(j%2?.08:0),.195,5.8-j*.6],.54,.71);
 // Mailbox: arched top, opening, post and flag.
 box('wood',[-1.93,.62,6.84],[.1,1.1,.11]);box('frame',[-1.93,1.25,6.84],[.42,.28,.56]);ellipsoid('frame',[-1.93,1.39,6.84],[.21,.14,.28],12,6);box('inside',[-1.93,1.24,7.135],[.29,.035,.01]);box('plate',[-1.93,1.31,7.141],[.15,.07,.01]);box('red',[-1.69,1.42,6.84],[.022,.18,.035]);
 // Terracotta pots and plants around the door.
 for(const [x,z,r] of [[-1.25,4.05,.26],[.92,4.02,.23],[3.19,3.91,.31]]){
 rod('pot',[x,.35,z],[x,.79,z],r*.75,r,14);rod('pot',[x,.78,z],[x,.84,z],r*1.08,r*1.08,14);rod('dirt',[x,.837,z],[x,.85,z],r*.9,r*.9,12);bush(x,z,r*1.6,.75);
 }
 // Garden clusters, olive trees, narrow cypresses and lavender borders.
 tree(-6.4,3.95,1.34);tree(7.5,-3.9,1.05);tree(-7,-5.3,1.3);
 cypress(-7.7,-2.2,5.7);cypress(-6.0,-6.9,4.8);cypress(6.0,-7.5,4.5);
 for(const [x,z,r] of [[-8.2,5.8,.7],[-5.8,6,.7],[-3.7,5.9,.55],[3.3,5.9,.55],[6.3,5.8,.7],[7.9,4.3,.6],[8.7,2.1,.7],[-3.4,3.8,.5],[3.5,3.65,.6],[4.7,-1.8,.5]])bush(x,z,r,.73);
 for(let j=0;j<20;j++){const x=-4.8+rand()*9.6,z=3.5+rand()*2.35;if(Math.abs(x)<1.3)continue;for(let k=0;k<4;k++){const xx=x+(rand()-.5)*.25,zz=z+(rand()-.5)*.25;rod('leaf1',[xx,.16,zz],[xx,.62,zz],.022,.012,5);ellipsoid('lavender',[xx,.62,zz],[.065,.16,.065],6,5);}}
 for(let i=0;i<1800;i++){const x=-9.1+rand()*18,z=-7.8+rand()*14;if(Math.abs(x)<4.2&&Math.abs(z)<3.3||Math.abs(x)<1.3&&z>3||x>4&&z>1)continue;const h=.035+rand()*.1;tri(i%4?'grass':'grass2',[x-.013,.095,z],[x,.095+h,z],[x+.013,.095,z+.01]);}
 // Blue hatchback; all components are authored geometry.
 this.car();
 const meshes:any[]=[];
 const sampler=createSamplerHandle('surface.repeat');this.assetsRegistry.register(sampler);this.assetsRegistry.markReady(sampler,createSamplerAsset({addressModeU:'repeat',addressModeV:'repeat',magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'}));
 for(const [id,b] of batches){if(!b.p.length)continue;
 const textureId=id==='stucco'?'stucco':id.startsWith('stone')||id.startsWith('paver')?'stone':id==='asphalt'?'asphalt':id.startsWith('grass')||id==='meadow'?'grass':null;
 const positionsAuthored=b.p.map(p=>p.map(v=>v*.87));
 const uvs=b.p.map((p,i)=>{const n=b.n[i],a=n.map(Math.abs),axis=a.indexOf(Math.max(...a));return axis===1?[p[0]*.8,p[2]*.8]:axis===0?[p[2]*1.1,p[1]*1.1]:[p[0]*1.1,p[1]*1.1];});
 const asset=createTriangleListMeshAsset({label:id,positions:positionsAuthored as any,normals:b.n as any,uvs:uvs as any});const handle=this.meshes.publish('scene.'+id,asset).handle;this.spawn.mesh({key:'scene.'+id,mesh:handle,material:material.standard({baseColor:b.col,roughness:b.rough,metallic:b.metal,...(textureId?{baseColorTexture:{texture:this.assets.texture(textureId).renderHandle,sampler}}:{})}),castShadow:!['asphalt','grass','grass2'].includes(id),receiveShadow:true});
 const s=asset.vertexStreams[0],data=s.data as Float32Array,step=s.arrayStride/4,positions=new Float32Array(s.vertexCount*3),normals=new Float32Array(s.vertexCount*3);for(let i=0;i<s.vertexCount;i++){positions.set(data.subarray(i*step,i*step+3),i*3);normals.set(data.subarray(i*step+3,i*step+6),i*3);}meshes.push({id,positions,normals,worldMatrix:identity,...(asset.indexBuffer?{indices:asset.indexBuffer.data}:{})});}
 globalThis.postMessage({type:'authored-geometry',meshes});
 }
 car(){
 const C=[9.2,.15,6.4],angle=1.05;
 const F=(p:V)=>[C[0]+p[0]*Math.cos(angle)+p[2]*Math.sin(angle),C[1]+p[1],C[2]-p[0]*Math.sin(angle)+p[2]*Math.cos(angle)];
 const B=(id:string,c:V,s:V)=>box(id,c,s,F),Q=(id:string,a:V,b:V,c:V,d:V)=>quad(id,F(a),F(b),F(c),F(d)),R=(id:string,a:V,b:V,r:number,r2=r,seg=12)=>rod(id,F(a),F(b),r,r2,seg);
 // A body loft with rounded front/rear corners and a sculpted hood.
 const sections=[[-2.2,.75,.44,.68],[-2.02,.91,.38,.91],[-1.4,.95,.37,1.0],[-.65,.96,.38,1.02],[.65,.97,.38,1.03],[1.66,.92,.4,1.03],[2.1,.82,.45,.93]];
 const ring=(s:V)=>{const [x,w,lo,hi]=s;return [[x,lo,-w*.83],[x,lo+.14,-w],[x,hi-.15,-w],[x,hi,-w*.77],[x,hi,w*.77],[x,hi-.15,w],[x,lo+.14,w],[x,lo,w*.83]];};
 for(let i=0;i<sections.length-1;i++){const a=ring(sections[i]),b=ring(sections[i+1]);for(let j=0;j<8;j++)Q(j===3?'blue2':'blue',a[j],a[(j+1)%8],b[(j+1)%8],b[j]);}
 const a=ring(sections[0]),b=ring(sections[sections.length-1]);for(let j=1;j<a.length-1;j++){tri('blue',F(a[0]),F(a[j+1]),F(a[j]));tri('blue',F(b[0]),F(b[j]),F(b[j+1]));}
 // Cabin silhouette, roof, front windscreen and rear hatch glass.
 const cab=[[-.76,1.02,-.82],[-.05,1.72,-.73],[1.26,1.73,-.73],[1.87,1.06,-.83],[-.76,1.02,.82],[-.05,1.72,.73],[1.26,1.73,.73],[1.87,1.06,.83]];
 for(const face of [[0,1,2,3],[4,7,6,5],[1,5,6,2],[0,4,5,1],[2,6,7,3]])Q('blue',...face.map(i=>cab[i]) as [V,V,V,V]);
 Q('carGlass',[-.735,1.055,.745],[-.04,1.68,.67],[-.04,1.68,-.67],[-.735,1.055,-.745]);
 Q('carGlass',[1.29,1.68,.66],[1.835,1.09,.745],[1.835,1.09,-.745],[1.29,1.68,-.66]);
 for(const s of [-1,1]){
 const sideQ=(a:V,b:V,c:V,d:V)=>s>0?Q('carGlass',d,c,b,a):Q('carGlass',a,b,c,d);
 sideQ([-.63,1.075,s*.829],[-.04,1.665,s*.75],[.52,1.67,s*.75],[.53,1.073,s*.935]);
 sideQ([.64,1.073,s*.935],[.64,1.67,s*.75],[1.23,1.67,s*.75],[1.71,1.073,s*.84]);
 B('black',[.58,1.4,s*.847],[.065,.62,.035]);B('blue',[.13,.9,s*.967],[.97,.07,.015]);B('blue',[1.15,.91,s*.94],[.93,.07,.015]);
 R('black',[.57,.46,s*.982],[.57,1.04,s*.982],.012,.012,6);R('black',[-.66,.48,s*.962],[-.66,1.04,s*.962],.009,.009,6);
 R('black',[1.73,.49,s*.924],[1.73,1.07,s*.924],.01,.01,6);
 B('black',[.25,.995,s*.989],[.18,.035,.04]);B('black',[1.28,.995,s*.958],[.17,.035,.04]);
 R('black',[-.55,1.15,s*.88],[-.52,1.16,s*1.085],.038);ellipsoid('blue',F([-.51,1.2,s*1.11]),[.17,.075,.1],12,6);
 B('black',[0,.42,s*.952],[3.47,.09,.04]);
 }
 B('seat',[.14,1.14,0],[.25,.58,1.12]);B('seat',[1.13,1.15,0],[.18,.48,1.1]);
 // Four tires, alloy rims, lug centers and ten thin spokes per wheel.
 for(const x of [-1.36,1.4])for(const z of [-.98,.98]){
 const s=Math.sign(z),w=.19,y=.48;
 const profile=[[.32,-w*.55],[.42,-w*.5],[.49,-w*.24],[.49,w*.24],[.43,w*.5],[.32,w*.55]];
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<32;i++){const t=i*2*Math.PI/32,T=(i+1)*2*Math.PI/32,p=(k:number,a:number)=>[x+profile[k][0]*Math.cos(a),y+profile[k][0]*Math.sin(a),z+profile[k][1]];Q('black',p(j,t),p(j,T),p(j+1,T),p(j+1,t));}
 R('black',[x,y,z-w*.45],[x,y,z+w*.45],.34,.34,24);
 R('chrome',[x,y,z+s*.08],[x,y,z+s*.104],.33,.33,24);R('black',[x,y,z+s*.109],[x,y,z+s*.116],.27,.27,24);
 for(let i=0;i<10;i++){const t=i*6.283/10;R('chrome',[x+.07*Math.cos(t),y+.07*Math.sin(t),z+s*.13],[x+.30*Math.cos(t+.12),y+.30*Math.sin(t+.12),z+s*.13],.019,.014,7);}
 R('chrome',[x,y,z+s*.13],[x,y,z+s*.145],.076,.076,12);
 // Painted wheel arch lip above each tire.
 for(let i=0;i<16;i++){let t=i*Math.PI/16,T=(i+1)*Math.PI/16;Q('blue',[x+.53*Math.cos(t),y+.53*Math.sin(t),z-s*.02],[x+.56*Math.cos(t),y+.56*Math.sin(t),z-s*.02],[x+.56*Math.cos(T),y+.56*Math.sin(T),z-s*.02],[x+.53*Math.cos(T),y+.53*Math.sin(T),z-s*.02]);}
 }
 // Front grille, headlamps, bumper intake and badge.
 B('black',[-2.21,.69,0],[.025,.17,1.13]);B('chrome',[-2.23,.79,0],[.027,.035,1.19]);
 for(const y of [.64,.69,.74])B('chrome',[-2.235,y,0],[.025,.011,1.08]);
 B('black',[-2.202,.46,0],[.035,.16,1.17]);B('plate',[-2.245,.55,0],[.029,.1,.52]);
 for(const z of [-.66,.66]){bevelBox('headlight',[-2.145,.77,z],[.07,.18,.38],F);B('chrome',[-2.172,.72,z],[.021,.027,.39]);B('black',[-2.17,.46,z],[.05,.16,.25]);B('headlight',[-2.2,.46,z],[.023,.065,.10]);B('red',[2.094,.9,z],[.06,.24,.25]);}
 R('chrome',[-2.25,.74,0],[-2.26,.74,0],.065,.065,16);
 B('black',[2.107,.49,0],[.027,.12,1.28]);B('plate',[2.14,.74,0],[.022,.11,.49]);
 B('blue',[1.4,1.75,0],[.21,.065,1.55]);R('black',[.77,1.78,0],[.93,2.08,0],.011,.006,7);
 // Subtle hood creases and painted side contours.
 for(const z of [-.48,.48])R('blue2',[-2.0,.925,z],[-.78,1.055,z*.88],.008,.008,6);
 for(const z of [-.954,.954])R('blue2',[-1.12,.73,z],[1.34,.75,z],.006,.006,6);
 // Wipers on glass.
 R('black',[-.719,1.069,-.49],[-.52,1.24,-.10],.009,.009,6);R('black',[-.719,1.069,.10],[-.52,1.24,.51],.009,.009,6);
 }
}
