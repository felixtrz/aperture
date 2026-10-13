import {createSystem,mesh,color} from '@aperture-engine/app/systems';
import {createStandardMaterialAsset,createTextureAsset,createSamplerAsset} from '@aperture-engine/render';
import {createMaterialHandle,createTextureHandle,createSamplerHandle} from '@aperture-engine/simulation';

// Every part is authored in the simulation worker and published as ordinary ECS meshes.
// A deterministic material batching builder preserves all real surface vertices.
let seed=8137;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), mul=(a,s)=>a.map(x=>x*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/Math.hypot(...a));
const batches=new Map();
function batch(k){if(!batches.has(k))batches.set(k,{p:[],n:[],uv:[],idx:[]});return batches.get(k);}
function tri(k,a,b,c,ns,uvs){
 const q=batch(k),n=norm(cross(sub(b,a),sub(c,a))),off=q.p.length/3;
 for(let j=0;j<3;j++){q.p.push(...[a,b,c][j]);q.n.push(...(ns?ns[j]:n));const v=[a,b,c][j];const axis=Math.abs(n[1])>Math.abs(n[0])&&Math.abs(n[1])>Math.abs(n[2])?1:Math.abs(n[0])>Math.abs(n[2])?0:2;q.uv.push(...(uvs?uvs[j]:axis===1?[v[0]*1.5,v[2]*1.5]:axis===0?[v[2]*1.5,v[1]*1.5]:[v[0]*1.5,v[1]*1.5]));}
 q.idx.push(off,off+1,off+2);
}
function quad(k,a,b,c,d,uvs){tri(k,a,b,c,null,uvs?[uvs[0],uvs[1],uvs[2]]:null);tri(k,a,c,d,null,uvs?[uvs[0],uvs[2],uvs[3]]:null);}
function box(k,c,s,yaw=0){
 const [x,y,z]=s.map(v=>v/2),co=Math.cos(yaw),si=Math.sin(yaw);
 const at=(a,b,d)=>[c[0]+a*co+d*si,c[1]+b,c[2]-a*si+d*co];
 const v=[at(-x,-y,-z),at(x,-y,-z),at(x,y,-z),at(-x,y,-z),at(-x,-y,z),at(x,-y,z),at(x,y,z),at(-x,y,z)];
 for(const f of [[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]])quad(k,...f.map(i=>v[i]));
}
function ellipsoid(k,c,s,seg=10,rings=6){
 const p=(i,j)=>{const t=i*Math.PI/rings,a=j*2*Math.PI/seg;return [c[0]+Math.sin(t)*Math.cos(a)*s[0],c[1]+Math.cos(t)*s[1],c[2]+Math.sin(t)*Math.sin(a)*s[2]];};
 const n=p=>norm([(p[0]-c[0])/(s[0]*s[0]),(p[1]-c[1])/(s[1]*s[1]),(p[2]-c[2])/(s[2]*s[2])]);
 for(let i=0;i<rings;i++)for(let j=0;j<seg;j++){
  const a=p(i,j),b=p(i+1,j),cc=p(i+1,j+1),d=p(i,j+1);
  if(i>0)tri(k,a,d,b,[n(a),n(d),n(b)]);
  if(i<rings-1)tri(k,b,d,cc,[n(b),n(d),n(cc)]);
 }
}
function cylinder(k,a,b,r1,r2=r1,seg=10){
 const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),v=cross(axis,u);
 const point=(c,r,j)=>add(c,add(mul(u,r*Math.cos(j*2*Math.PI/seg)),mul(v,r*Math.sin(j*2*Math.PI/seg))));
 for(let j=0;j<seg;j++){
  const p=point(a,r1,j),q=point(a,r1,j+1),r=point(b,r2,j+1),s=point(b,r2,j);
  quad(k,p,q,r,s);tri(k,a,q,p);tri(k,b,s,r);
 }
}
function tube(k,c,major,minor,axis='z',segments=28,sides=8){
 const p=(i,j)=>{const a=i*2*Math.PI/segments,b=j*2*Math.PI/sides,r=major+minor*Math.cos(b),h=minor*Math.sin(b);return axis==='z'?[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),c[2]+h]:[c[0]+r*Math.cos(a),c[1]+h,c[2]+r*Math.sin(a)];};
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=p(i,j),b=p(i+1,j),cc=p(i+1,j+1),d=p(i,j+1);quad(k,a,b,cc,d);}
}
function line(k,a,b,r=.03){cylinder(k,a,b,r,r,8);}
function slab(k,points,y,thick){
 for(let i=1;i<points.length-1;i++)tri(k,[points[0][0],y,points[0][1]],[points[i+1][0],y,points[i+1][1]],[points[i][0],y,points[i][1]]);
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];quad(k,[a[0],y-thick,a[1]],[b[0],y-thick,b[1]],[b[0],y,b[1]],[a[0],y,a[1]]);}
}
function roofTile(k,x,z,span,y0,slope,dir=1){
 // Tapered half-cylinder barrel tile, with real top, undersurface, and end lips.
 const length=.58,rad=.142,steps=8;
 const tq=(a,b,c,d)=>dir===1?quad(k,d,c,b,a):quad(k,a,b,c,d);
 const at=(t,a,under=0)=>[x+Math.cos(a)*rad*(1+.09*t),y0+slope*t+Math.sin(a)*rad*.56-under,z+dir*t];
 for(let j=0;j<steps;j++){
  const a=j*Math.PI/steps,b=(j+1)*Math.PI/steps;
  tq(at(0,a),at(length,a),at(length,b),at(0,b));
  tq(at(0,b,.028),at(length,b,.028),at(length,a,.028),at(0,a,.028));
  tq(at(0,a,.028),at(0,a),at(0,b),at(0,b,.028));
  tq(at(length,b,.028),at(length,b),at(length,a),at(length,a,.028));
 }
}
function roof(width,cx,zFront,zBack,eave,ridge){
 const rz=(zFront+zBack)/2,half=(zFront-zBack)/2;
 quad('roofUnder',[cx-width/2,eave,zFront],[cx+width/2,eave,zFront],[cx+width/2,ridge,rz],[cx-width/2,ridge,rz]);
 quad('roofUnder',[cx-width/2,ridge,rz],[cx+width/2,ridge,rz],[cx+width/2,eave,zBack],[cx-width/2,eave,zBack]);
 for(const dir of [-1,1]){
  const end=dir===1?zFront:zBack;
  for(let x=cx-width/2+.14;x<cx+width/2-.06;x+=.285)for(let t=0;t<half;t+=.49){
   roofTile('tile'+Math.floor(rnd()*5),x,rz+dir*t,0,ridge-(ridge-eave)*t/half,-(ridge-eave)/half,dir);
  }
 }
 for(let x=cx-width/2;x<cx+width/2;x+=.49)cylinder('tile2',[x,ridge+.08,rz],[x+.52,ridge+.08,rz],.165,.16,10);
 for(const z of [zFront,zBack])box('fascia',[cx,eave-.07,z],[width,.14,.13]);
 for(const x of [cx-width/2,cx+width/2]){line('fascia',[x,eave,zFront],[x,ridge,rz],.075);line('fascia',[x,ridge,rz],[x,eave,zBack],.075);}
}
function windowFront(x,y,z,w=1.45,h=1.65){
 box('reveal',[x,y,z-.1],[w+.17,h+.17,.2]);box('glass',[x,y,z-.075],[w-.13,h-.13,.06]);
 box('sill',[x,y-h/2-.06,z+.08],[w+.25,.12,.34]);
 for(const a of [-1,1])box('frame',[x+a*(w/2-.035),y,z+.018],[.072,h,.09]);
 for(const a of [-1,1])box('frame',[x,y+a*(h/2-.035),z+.018],[w,.072,.09]);
 box('frame',[x,y,z+.025],[.055,h,.07]);box('frame',[x,y-.12,z+.025],[w,.045,.07]);
 // Soft pale curtains sit behind dark mullions.
 for(const a of [-1,1])box('curtain',[x+a*w*.3,y,z-.025],[w*.19,h-.16,.023]);
}
function windowSide(x,y,z,w=1,h=1.65,side=1){
 box('reveal',[x-side*.08,y,z],[.19,h+.17,w+.17]);box('glass',[x-side*.065,y,z],[.055,h-.13,w-.13]);
 box('sill',[x+side*.08,y-h/2-.06,z],[.34,.12,w+.25]);
 for(const a of [-1,1])box('frame',[x+side*.02,y,z+a*(w/2-.035)],[.09,h,.07]);
 for(const a of [-1,1])box('frame',[x+side*.02,y+a*(h/2-.035),z],[.09,.07,w]);
 box('frame',[x+side*.025,y,z],[.07,h,.05]);box('frame',[x+side*.025,y-.12,z],[.07,.045,w]);
}
function wallGrid(k,x0,x1,y0,y1,z,openings){
 const xs=[x0,x1,...openings.flatMap(o=>[o[0]-o[2]/2,o[0]+o[2]/2])].sort((a,b)=>a-b);
 const ys=[y0,y1,...openings.flatMap(o=>[o[1]-o[3]/2,o[1]+o[3]/2])].sort((a,b)=>a-b);
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
  const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
  if(xs[i+1]-xs[i]<.001||ys[j+1]-ys[j]<.001||openings.some(o=>Math.abs(x-o[0])<o[2]/2&&Math.abs(y-o[1])<o[3]/2))continue;
  box(k,[x,y,z-.12],[xs[i+1]-xs[i],ys[j+1]-ys[j],.24]);
 }
}
function bush(c,size=1,count=24){
 for(let i=0;i<count;i++){
  const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*size;
  const p=[c[0]+Math.cos(a)*r,c[1]+rnd()*size*.45,c[2]+Math.sin(a)*r];
 ellipsoid('leaf'+Math.floor(rnd()*5),p,[.15+rnd()*.15,.13+rnd()*.16,.15+rnd()*.15],7,4);
 for(let n=0;n<3;n++)leaf('leaf'+Math.floor(rnd()*5),[p[0]+(rnd()-.5)*.42,p[1]+rnd()*.2,p[2]+(rnd()-.5)*.42],.09+rnd()*.06,.042+rnd()*.025,rnd()*Math.PI*2,(rnd()-.5)*1.8);
 }
}

function leaf(k,c,length,width,yaw,pitch){
 const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const at=(x,y,z)=>[c[0]+co*x+si*(z*cp-y*sp),c[1]+y*cp+z*sp,c[2]-si*x+co*(z*cp-y*sp)];
 const points=[at(-length,0,0),at(0,0,width),at(length,0,0),at(0,0,-width)];
 const top=at(0,.016,0),bottom=at(0,-.006,0);
 for(let j=0;j<4;j++){tri(k,points[j],points[(j+1)%4],top);tri(k,points[(j+1)%4],points[j],bottom);}
}

function olive(x,z,h=4.5){
 const base=[x,.1,z],fork=[x+.18,h*.48,z-.05];cylinder('bark',base,fork,.17,.1,9);
 for(let i=0;i<8;i++){const a=i*2.4,b=[x+Math.cos(a)*(1+rnd()*.65),h*(.62+rnd()*.23),z+Math.sin(a)*(1+rnd()*.65)];
 cylinder('bark',fork,b,.075,.022,7);
 for(let j=0;j<28;j++){
 const an=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.9,center=[b[0]+Math.cos(an)*r,b[1]+(rnd()-.5)*.7,b[2]+Math.sin(an)*r];
 ellipsoid('olive'+Math.floor(rnd()*4),center,[.15+rnd()*.1,.1+rnd()*.1,.13+rnd()*.13],7,4);
 for(let n=0;n<5;n++){const p=[center[0]+(rnd()-.5)*.55,center[1]+(rnd()-.5)*.35,center[2]+(rnd()-.5)*.55];leaf('olive'+Math.floor(rnd()*4),p,.13+rnd()*.08,.037+rnd()*.025,rnd()*Math.PI*2,(rnd()-.5)*1.6);}
 }
 }
}
function cypress(x,z,h){
 cylinder('bark',[x,0,z],[x,h*.7,z],.1,.025,8);
 for(let j=0;j<12;j++){const y=.55+j*h/13,r=.22+Math.sin(j/12*Math.PI)*.35;ellipsoid('cypress',[x+(rnd()-.5)*.14,y,z+(rnd()-.5)*.14],[r,h*.10,r*.8],9,5);}
}
function stoneSegment(a,b,height=.85,width=.36){
 const d=sub(b,a),len=Math.hypot(d[0],d[2]),angle=Math.atan2(-d[2],d[0]);
 box('mortar',[(a[0]+b[0])/2,height/2+.1,(a[2]+b[2])/2],[len,height,width],angle);
 const rows=Math.ceil(height/.23),n=Math.ceil(len/.55);
 for(let j=0;j<rows;j++)for(let i=0;i<n;i++){
  const t=(i+.5+(j%2)*.3)/n;if(t>1)continue;
  box('stone'+Math.floor(rnd()*5),[a[0]+d[0]*t,.23+j*.23,a[2]+d[2]*t],[len/n-.025,.2+rnd()*.02,width+.025],angle);
 }
 for(let i=0;i<n;i++){const t=(i+.5)/n;box('sill',[a[0]+d[0]*t,height+.13,a[2]+d[2]*t],[len/n-.015,.10,width+.13],angle);}
}
function pillar(x,z){
 box('mortar',[x,.72,z],[.54,1.3,.54]);
 for(let y=.15;y<1.35;y+=.23)for(const dx of [-.145,.145])for(const dz of [-.145,.145])box('stone'+Math.floor(rnd()*5),[x+dx,y+.1,z+dz],[.277,.215,.277]);
 box('sill',[x,1.43,z],[.7,.15,.7]);
}
function path(){
 for(let row=0;row<9;row++)for(let col=0;col<4;col++){
 const z=3.75+row*.27,x=-1.1+(col-1.5)*.35+(row%2)*.08;
 const points=[[x-.16,z-.12],[x+.12,z-.13],[x+.19,z+.05],[x+.1,z+.15],[x-.16,z+.1]];
 slab('stone'+Math.floor(rnd()*5),points,.14,.07);
 }
 for(let row=0;row<20;row++)for(let col=0;col<5;col++){
 const x=3.8+col*.32+(row%2)*.1,z=-4+row*.49;
 slab('stone'+Math.floor(rnd()*5),[[x-.15,z-.22],[x+.14,z-.22],[x+.18,z+.2],[x-.12,z+.23]],.1,.05);
 }
}
const carOrigin=[6.55,-.085,6.35],carYaw=.90;
function cp(p){const c=Math.cos(carYaw),s=Math.sin(carYaw);return [carOrigin[0]+p[0]*c+p[2]*s,carOrigin[1]+p[1],carOrigin[2]-p[0]*s+p[2]*c];}
function cb(k,p,s,yaw=0){const center=cp(p);box(k,center,s,carYaw+yaw);}
function cq(k,pts){quad(k,...pts.map(cp));}
function cl(k,a,b,r){line(k,cp(a),cp(b),r);}
function car(){
 const sections=[[-2.35,.70,.61,.81],[-2.25,.85,.69,.92],[-2.05,.95,.75,1.025],[-1.65,1.005,.78,1.075],[-1.15,1.015,.80,1.10],[-.55,1.00,.84,1.12],[.1,1.015,.86,1.12],[.65,1.02,.86,1.12],[1.2,1.00,.85,1.12],[1.7,.97,.81,1.07],[2.07,.9,.75,1.0],[2.22,.80,.68,.91]];
 const ring=s=>{const [x,w,low,high]=s;return [[x,.40,-w*.90],[x,low,-w],[x,high,-w*.92],[x,high,w*.92],[x,low,w],[x,.4,w*.90]];};
 for(let j=0;j<sections.length-1;j++){const a=ring(sections[j]),b=ring(sections[j+1]);for(let i=0;i<6;i++)cq('blue',[a[i],a[(i+1)%6],b[(i+1)%6],b[i]]);}
 const f=ring(sections[0]),r=ring(sections.at(-1));for(let i=1;i<5;i++){tri('blue',cp(f[0]),cp(f[i+1]),cp(f[i]));tri('blue',cp(r[0]),cp(r[i]),cp(r[i+1]));}
 // Roof and tinted glass cabin follow the hatchback's sloping windshield and rear hatch.
 cq('blue',[[-.55,1.11,-.91],[.02,1.76,-.77],[1.26,1.77,-.77],[1.94,1.10,-.88]]);
 cq('blue',[[1.94,1.10,.88],[1.26,1.77,.77],[.02,1.76,.77],[-.55,1.11,.91]]);
 const crown=(u,v)=>[.02+u*1.24,1.765+u*.005+.068*Math.sin(u*Math.PI)*(1-v*v),.77*v];
 for(let i=0;i<6;i++)for(let j=0;j<8;j++){const u=i/6,v=-1+j/4;cq('blue',[crown(u,v),crown(u,v+.25),crown(u+1/6,v+.25),crown(u+1/6,v)]);}
 cq('glass',[[.045,1.735,.72],[.045,1.735,-.72],[-.60,1.14,-.83],[-.60,1.14,.83]]);
 cq('glass',[[1.94,1.14,.79],[1.94,1.14,-.79],[1.32,1.70,-.71],[1.32,1.70,.71]]);
 for(const side of [-1,1]){
  const z=side;
  const front=[[-.48,1.17,.906*z],[.07,1.69,.789*z],[.64,1.69,.79*z],[.66,1.16,.929*z]];
  const back=[[.76,1.16,.931*z],[.74,1.69,.79*z],[1.23,1.69,.79*z],[1.77,1.16,.89*z]];
  cq('glass',side===1?front.reverse():front);cq('glass',side===1?back.reverse():back);
  cl('chrome',[-.53,1.14,.938*z],[1.88,1.14,.937*z],.014);
  cl('trim',[.69,1.13,.947*z],[.68,1.73,.79*z],.04);
  for(const x of [.48,1.55])cb('trim',[x,1.03,1.002*z],[.2,.045,.035]);
  cl('seam',[.66,.49,1.026*z],[.68,1.13,.975*z],.012);
  cl('seam',[1.72,.49,.985*z],[1.8,1.13,.94*z],.009);
  cb('blue',[-.42,1.15,1.095*z],[.30,.14,.18]);cb('glass',[-.40,1.17,1.185*z],[.21,.08,.021]);
 }
 cb('trim',[-2.37,.65,0],[.055,.22,1.45]);cb('trim',[-2.38,.43,0],[.04,.11,1.4]);
 for(const z of [-.45,-.25,0,.25,.45])cl('chrome',[-2.393,.55,z-.1],[-2.393,.55,z+.1],.009);
 cb('plate',[-2.411,.61,0],[.022,.12,.45]);
 cl('chrome',[-2.405,.76,-.7],[-2.405,.76,.7],.012);
 cylinder('chrome',cp([-2.43,.785,0]),cp([-2.405,.785,0]),.072,.072,18);
 cylinder('trim',cp([-2.438,.785,0]),cp([-2.432,.785,0]),.049,.049,16);
 for(const z of [-.70,.70]){
  const side=z<0?-1:1;
 const lens=[[-2.295,.825,.43*side],[-2.19,.975,.43*side],[-2.095,.976,.84*side],[-2.265,.824,.78*side]];
 const n=cross(sub(lens[1],lens[0]),sub(lens[2],lens[0]));
 cq('lamp',n[0]>0?lens.reverse():lens);
 cl('chrome',lens[0],lens[1],.014);cl('chrome',lens[1],lens[2],.014);cl('chrome',lens[2],lens[3],.014);cl('chrome',lens[3],lens[0],.014);
 for(const zz of [.53,.68,.79])cl('lampBright',[-2.25,.853,zz*side],[-2.15,.95,zz*side],.019);cb('lamp',[-2.33,.47,z],[.035,.075,.14]);
  cb('red',[2.15,.91,z],[.09,.18,.3]);
 }
 cb('trim',[2.225,.47,0],[.04,.13,1.6]);
 cl('trim',[1.44,1.785,0],[1.55,2.08,0],.012);
 for(const x of [-1.45,1.45])for(const side of [-1,1]){
  const z=1.02*side,c=cp([x,.57,z]);
 for(let j=0;j<18;j++){const a=j*Math.PI/18,b=(j+1)*Math.PI/18;cl('trim',[x+.475*Math.cos(a),.57+.475*Math.sin(a),1.037*side],[x+.475*Math.cos(b),.57+.475*Math.sin(b),1.037*side],.023);}
 
  // Tire has a rounded tread crown and alloy hub; four true volumetric wheels.
  const tb=batch('tire'),begin=tb.p.length;tube('tire',[x,.57,z],.34,.12,'z',32,10);for(let n=begin;n<tb.p.length;n+=3){const v=cp(tb.p.slice(n,n+3));tb.p.splice(n,3,...v);const nn=tb.n.slice(n,n+3),co=Math.cos(carYaw),si=Math.sin(carYaw);tb.n.splice(n,3,nn[0]*co+nn[2]*si,nn[1],-nn[0]*si+nn[2]*co);}
  cylinder('tire',cp([x,.57,z-.09]),cp([x,.57,z+.09]),.355,.355,28);
  const outer=z+side*.153;
  cylinder('alloy',cp([x,.57,outer-side*.025]),cp([x,.57,outer]),.32,.32,24);
  cylinder('trim',cp([x,.57,outer]),cp([x,.57,outer+side*.01]),.275,.275,24);
  for(let j=0;j<10;j++){
   const a=j*Math.PI/5,b=a+.09;
   const pa=[x+Math.cos(a)*.09,.57+Math.sin(a)*.09,outer+side*.02];
   const pb=[x+Math.cos(b)*.29,.57+Math.sin(b)*.29,outer+side*.025];
   cl('alloy',pa,pb,.022);
  }
  cylinder('alloy',cp([x,.57,outer]),cp([x,.57,outer+side*.032]),.09,.09,16);
 }
 for(const side of [-1,1]){
 cl('chrome',[-.92,.42,.984*side],[1.09,.42,.984*side],.013);
 cl('blueHighlight',[-1.0,.90,1.027*side],[1.15,.90,1.026*side],.015);
 }
 cl('seam',[-2.05,1.066,-.58],[-.62,1.142,-.7],.012);cl('seam',[-2.05,1.066,.58],[-.62,1.142,.7],.012);
}
function ribbon(k,center,width,y){
 for(let i=0;i<center.length-1;i++){
  const pa=center[Math.max(0,i-1)],pb=center[Math.min(center.length-1,i+1)];
  const qa=center[i],qb=center[i+1],pc=center[Math.min(center.length-1,i+2)];
  const na=norm([-(pb[2]-pa[2]),0,pb[0]-pa[0]]),nb=norm([-(pc[2]-qa[2]),0,pc[0]-qa[0]]);
  quad(k,[qa[0]-na[0]*width/2,y,qa[2]-na[2]*width/2],[qa[0]+na[0]*width/2,y,qa[2]+na[2]*width/2],[qb[0]+nb[0]*width/2,y,qb[2]+nb[2]*width/2],[qb[0]-nb[0]*width/2,y,qb[2]-nb[2]*width/2]);
 }
}
function road(){
 const pts=[];
 for(let x=-19;x<3;x+=.5)pts.push([x,0,8]);
 for(let j=0;j<=36;j++){const a=Math.PI/2-j/36*Math.PI/2;pts.push([3+7*Math.cos(a),0,1+7*Math.sin(a)]);}
 for(let z=.5;z>-20;z-=.5)pts.push([10,0,z]);
 ribbon('asphalt',pts,4.2,.025);
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);
  if(l<.01)continue;
  const nx=-dz/l,nz=dx/l,angle=Math.atan2(-dz,dx);
  for(const side of [-1,1]){
   box('sill',[(a[0]+b[0])/2+nx*side*2.17,.095,(a[2]+b[2])/2+nz*side*2.17],[l-.012,.14,.28],angle);
   box('sidewalk',[(a[0]+b[0])/2+nx*side*2.54,.065,(a[2]+b[2])/2+nz*side*2.54],[l-.013,.1,.47],angle);
  }
  if(i%5<2)box('marking',[(a[0]+b[0])/2-.0*nx,.037,(a[2]+b[2])/2-.0*nz],[l+.008,.012,.115],angle);
 }
}
function garden(){
 path();
 stoneSegment([-12,0,5.3],[-2.1,0,5.3],.9);stoneSegment([-.15,0,5.3],[4.5,0,5.3],.9);
 for(let j=0;j<12;j++){
  const a=j/12*Math.PI/2,b=(j+1)/12*Math.PI/2;
  stoneSegment([4.5+3.3*Math.sin(a),0,2+3.3*Math.cos(a)],[4.5+3.3*Math.sin(b),0,2+3.3*Math.cos(b)],.85);
 }
 stoneSegment([7.8,0,2],[7.8,0,-9],.85);
 for(const x of [-2.1,-.15,4.5])pillar(x,5.3);
 for(let x=-11;x<4.5;x+=.75){if(x>-2.4&&x<.2)continue;bush([x,.43,4.74],.45,14);}
 for(let z=-8;z<3.8;z+=.72)bush([7.23,.44,z],.48,16);
 for(const [x,z,s] of [[-4.3,2.6,.7],[2.6,2.9,.7],[-2.8,3.7,.5],[.3,3.9,.65],[4.0,-1,.7],[4.5,-3,.75],[-6.1,-1,1.1]])bush([x,.25,z],s,32);
 olive(-8,2.6,4.8);olive(7,-4,4.6);olive(-8,-5,5.1);
 cypress(-7,-6.6,6.5);cypress(-10,-9,5.3);cypress(6.5,-9,5.8);
 // terracotta planters beside the sheltered entry
 for(const [x,z,s] of [[-2.25,3.16,.34],[.22,3.16,.29],[2.2,3.7,.37]]){
  cylinder('pot',[x,.17,z],[x,.68,z],s*.72,s,18);cylinder('potRim',[x,.65,z],[x,.73,z],s*1.03,s*1.03,18);
  cylinder('soil',[x,.734,z],[x,.745,z],s*.86,s*.86,16);
  bush([x,.87,z],s*1.25,20);
 }
 // lavender flowers around low shrubs, individual slender stems and blossom clusters
 for(let j=0;j<100;j++){
  const side=j%2===0?-1:1,x=-1.1+side*(1.25+rnd()*1.2),z=3.8+rnd()*.65,y=.33+rnd()*.25;
  line('leaf2',[x,.14,z],[x,y,z],.009);
  ellipsoid('lavender',[x,y+.055,z],[.035,.095,.035],6,4);
 }
 // small grass tuft blades on the lawn, not on the entry path
 for(let i=0;i<1700;i++){
  const x=-11+rnd()*17,z=-6+rnd()*11.0;
  if((x>-5.5&&x<3.5&&z<2.4)||(Math.abs(x+1.1)<.9&&z>3.4)||(x>3.3&&x<5.6&&z<5))continue;
  const h=.045+rnd()*.1,k='grassBlade'+Math.floor(rnd()*3);
  tri(k,[x-.016,.06,z],[x+.012,.06,z],[x+.025,.06+h,z-.015]);
  tri(k,[x+.012,.06,z],[x-.016,.06,z],[x+.025,.06+h,z-.015]);
 }
 // roadside mailbox, rounded lid, mounting post and brass latch
 box('frame',[-2.74,.8,5.17],[.1,1.5,.1]);
 box('mailbox',[-2.74,1.56,5.19],[.48,.42,.36]);
 cylinder('mailbox',[-2.98,1.76,5.19],[-2.50,1.76,5.19],.18,.18,14);
 box('chrome',[-2.74,1.6,5.38],[.075,.045,.015]);
 box('plate',[-2.74,1.44,5.38],[.13,.047,.012]);
}
function house(){
 const cx=-1,front=2.2,back=-4.4,left=-5.2,right=3.2,eave=6.25,ridge=8.15;
 const opens=[[-3.6,4.82,1.45,1.65],[1.4,4.82,1.55,1.65],[-3.65,1.78,1.1,1.60],[1.55,1.78,1.1,1.60],[-1.1,1.34,1.13,2.45]];
 wallGrid('stucco',left,right,.14,eave,front,opens);
 box('stucco',[cx,3.2,back],[8.4,6.13,.23]);
 // side walls also include real apertures via the same wall subdivision with rotation
 const before=batch('stucco').p.length;
 wallGrid('stucco',-4.4,2.2,.14,eave,0,[[-2.7,4.78,1,1.65],[.35,4.78,1,1.65],[-2.65,1.75,1,1.65],[.35,1.75,1,1.65]]);
 const sb=batch('stucco');
 for(let i=before;i<sb.p.length;i+=3){const z=sb.p[i],x=sb.p[i+2];sb.p[i]=right-.24-x;sb.p[i+2]=z;const nx=sb.n[i],nz=sb.n[i+2];sb.n[i]=-nz;sb.n[i+2]=nx;}
 const lb=batch('stucco'),start=lb.p.length;
 wallGrid('stucco',-2.2,4.4,.14,eave,0,[[2.7,4.78,1,1.65],[-.35,4.78,1,1.65],[2.65,1.75,1,1.65],[-.35,1.75,1,1.65]]);
 for(let i=start;i<lb.p.length;i+=3){const z=lb.p[i],x=lb.p[i+2];lb.p[i]=left+.24+x;lb.p[i+2]=-z;const nx=lb.n[i],nz=lb.n[i+2];lb.n[i]=nz;lb.n[i+2]=-nx;}
 for(const z of [-2.7,.35])for(const y of [1.75,4.78])windowSide(left,y,z,1,1.65,-1);
 tri('stucco',[right,eave,back],[right,ridge,-1.1],[right,eave,front]);
 tri('stucco',[left,eave,front],[left,ridge,-1.1],[left,eave,back]);
 box('foundation',[cx,.18,-1.1],[8.48,.32,6.68]);
 for(const o of opens.slice(0,4))windowFront(o[0],o[1],front,o[2],o[3]);
 for(const z of [-2.7,.35])for(const y of [1.75,4.78])windowSide(right,y,z);
 // windows and sills on rear and unseen left surfaces remain modeled
 for(const x of [-3.6,1.4])for(const y of [1.8,4.82]){
  box('reveal',[x,y,back-.13],[1.4,1.65,.04]);box('glass',[x,y,back-.16],[1.23,1.49,.02]);
  for(const a of [-1,1])box('frame',[x+a*.67,y,back-.19],[.07,1.65,.05]);
  for(const a of [-1,1])box('frame',[x,y+a*.79,back-.19],[1.4,.07,.05]);
  box('frame',[x,y,back-.2],[.06,1.6,.05]);box('sill',[x,y-.91,back-.18],[1.63,.13,.26]);
 }
 box('door',[-1.1,1.34,front-.065],[1.08,2.41,.12]);
 for(const y of [.81,1.87])for(const x of [-1.33,-.87]){
  box('doorPanel',[x,y,front+.013],[.34,.8,.016]);
  for(const dx of [-.17,.17])box('doorTrim',[x+dx,y,front+.03],[.025,.8,.025]);
  for(const dy of [-.4,.4])box('doorTrim',[x,y+dy,front+.03],[.365,.025,.025]);
 }
 box('chrome',[-1.53,1.29,front+.086],[.03,.18,.04]);box('chrome',[-1.49,1.33,front+.12],[.12,.025,.03]);
 // Roof and gutter assemblies
 roof(9.1,cx,2.68,-4.88,eave,8.22);
 for(const x of [-4.9,2.98]){line('gutter',[x,6.18,2.75],[x,5.87,2.78],.052);line('gutter',[x,5.87,2.78],[x,.32,2.78],.05);line('gutter',[x,.32,2.78],[x,.2,3.00],.048);}
 line('gutter',[-5.6,6.20,2.7],[3.6,6.20,2.7],.065);
 // The porch has a shallow tiled shed roof, ivory posts and stone step.
 for(const x of [-2.78,.73]){
  box('stucco',[x,1.47,3.71],[.26,2.67,.28]);box('sill',[x,.2,3.71],[.4,.18,.41]);box('sill',[x,2.83,3.71],[.40,.18,.41]);
 }
 box('porchWood',[-1.02,2.91,3.68],[4.20,.20,.25]);
 box('porchWood',[-1.02,3.04,2.28],[4.2,.25,.17]);
 const porchW=4.55,porchFront=4.04,porchBack=2.20,py=2.96,slope=.22;
 quad('roofUnder',[-3.295,py,porchFront],[1.255,py,porchFront],[1.255,py+slope*(porchFront-porchBack),porchBack],[-3.295,py+slope*(porchFront-porchBack),porchBack]);
 for(let x=-3.17;x<1.19;x+=.285)for(let z=porchBack;z<porchFront;z+=.48)roofTile('tile'+Math.floor(rnd()*5),x,z,0,py+slope*(porchFront-z),-slope,1);
 box('fascia',[-1.02,py-.06,porchFront],[4.63,.13,.12]);
 for(const x of [-3.34,1.30])line('porchWood',[x,py,porchFront],[x,py+slope*(porchFront-porchBack),porchBack],.06);
 box('step',[-1.02,.155,3.4],[3.9,.22,1.9]);box('step',[-1.02,.10,4.43],[3.65,.13,.3]);
 // Chimney with open cap and small clay-tiled crown
 box('stucco',[1.8,8.10,-2.1],[.63,1.65,.68]);box('sill',[1.8,8.92,-2.1],[.78,.12,.81]);
 box('chimneyDark',[1.8,9.09,-2.1],[.64,.3,.68]);
 for(const x of [1.49,2.11])for(const z of [-2.4,-1.8])box('stucco',[x,9.09,z],[.09,.36,.09]);
 box('tile2',[1.8,9.29,-2.1],[.93,.09,.92]);
 const cap=[[1.31,9.335,-2.58],[2.29,9.335,-2.58],[2.29,9.335,-1.62],[1.31,9.335,-1.62]],peak=[1.8,9.54,-2.1];
 for(let j=0;j<4;j++)tri('tile2',cap[(j+1)%4],cap[j],peak);
 // warm black metal lantern next to the door
 line('frame',[-2.13,2.25,2.3],[-2.13,2.25,2.56],.025);
 box('lamp',[-2.13,2.02,2.53],[.16,.25,.12]);box('frame',[-2.13,2.19,2.53],[.24,.07,.23]);box('frame',[-2.13,1.84,2.53],[.23,.07,.21]);
 for(const x of [-2.23,-2.03])for(const z of [2.44,2.62])line('frame',[x,1.87,z],[x,2.17,z],.013);
 // timber side gate
 for(let i=0;i<12;i++)box('wood',[5.1+i*.16,1.08,-2.8],[.14,2,.09]);
 box('wood',[5.98,.7,-2.73],[1.95,.1,.12]);box('wood',[5.98,1.64,-2.73],[1.95,.1,.12]);
}
function landscape(){
 box('grass',[0,-.17,-25],[120,.32,110]);
 // distant rolling land is also real low frequency triangulated terrain
 const pts=[],cols=35,rows=17;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const x=-75+i*4.5,z=-16-j*4.7;
  const y=-1+Math.min(1.5,Math.max(0,(-z-22)/23))*(2.4+1.7*Math.sin(x*.08)+1.2*Math.sin(x*.2+z*.07));
  pts.push([x,y,z]);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=j*(cols+1)+i,b=a+1,c=a+cols+2,d=a+cols+1;
  quad('hill'+((i+j)%3),pts[a],pts[b],pts[c],pts[d]);
 }
 for(let i=0;i<18;i++){const x=-32+rnd()*65,z=-19-rnd()*13;if(i%3===0)cypress(x,z,3+rnd()*3);else olive(x,z,2.8+rnd()*1.6);}
}
const palette={
 stucco:['#eee2c8',.91,0,'stucco'],foundation:['#b5aa91',.93,0,'stone'],roofUnder:['#683c28',.95,0],fascia:['#534737',.8,0],gutter:['#4c4b40',.58,.25],porchWood:['#826448',.84,0],
 tile0:['#bd7044',.85,0,'tile'],tile1:['#b06136',.84,0,'tile'],tile2:['#cb8551',.80,0,'tile'],tile3:['#a45531',.86,0,'tile'],tile4:['#d09660',.86,0,'tile'],
 reveal:['#554d43',.9,0],frame:['#323938',.56,.15],glass:['#394a52',.12,.26],sill:['#c8b998',.88,0,'stone'],curtain:['#baa98c',.98,0],door:['#4c5351',.72,0],doorPanel:['#414746',.8,0],doorTrim:['#5a615c',.7,0],porchWood:['#826f55',.84,0],
 stone0:['#b5a487',.95,0,'stone'],stone1:['#cabaa0',.95,0,'stone'],stone2:['#a99f89',.95,0,'stone'],stone3:['#c2b195',.95,0,'stone'],stone4:['#d0c1a6',.95,0,'stone'],mortar:['#827b69',1,0],step:['#bcab8c',.94,0,'stone'],sidewalk:['#afa99a',.92,0,'stone'],
 leaf0:['#526323',.97,0],leaf1:['#7f8533',.97,0],leaf2:['#687d2e',.96,0],leaf3:['#465626',.97,0],leaf4:['#899340',.97,0],
 olive0:['#7a8052',.96,0],olive1:['#626e40',.97,0],olive2:['#8b946a',.96,0],olive3:['#9ca578',.96,0],cypress:['#42512d',.98,0],bark:['#65513b',.98,0],
 grass:['#8c8d49',.97,0,'grass'],grassBlade0:['#828b39',.98,0],grassBlade1:['#a1a050',.98,0],grassBlade2:['#707d2d',.98,0],lavender:['#7f789c',.98,0],pot:['#99623c',.9,0],potRim:['#b07646',.85,0],soil:['#393326',1,0],
 asphalt:['#77716c',.95,0,'asphalt'],marking:['#dbd6be',.85,0],blue:['#2162a0',.24,.32],blueHighlight:['#3d77a1',.32,.3],lampBright:['#f7f2da',.12,.12],tire:['#242526',.92,0],alloy:['#b8b9b0',.26,.8],trim:['#242c2e',.66,.05],seam:['#243c4b',.63,0],chrome:['#9fa69f',.3,.78],lamp:['#efe5be',.2,.10],red:['#b53924',.35,.1],plate:['#cbc4ac',.75,0],
 mailbox:['#484a46',.72,.2],chimneyDark:['#463c2e',.92,0],wood:['#815b35',.94,0,'tile'],
 hill0:['#849074',1,0],hill1:['#929c80',1,0],hill2:['#798871',1,0]
};
export const authoredStats={};
export default class SceneSystem extends createSystem({priority:0}){
 init(){
  seed=8137;batches.clear();
  this.spawn.camera({key:'camera.main',transform:{translation:[14,9,19],lookAt:[0,2.5,1]},fovYDegrees:37,camera:{near:.1,far:200}});
  this.spawn.light({key:'light.sun',kind:'directional',color:[1,.89,.70,1],intensity:3.15,transform:{rotationEulerDegrees:[-40,-55,0]},shadow:{enabled:true,mapSize:2048,center:[0,2,0],orthographicSize:32,near:1,far:85,lightDistance:40,bias:.0003,normalBias:.025,strength:.84,filterRadius:1.7}});
  this.spawn.light({key:'light.ambient',kind:'ambient',color:[.72,.80,1,1],intensity:.16});
  const sampler=createSamplerHandle('surface.repeat');this.assetsRegistry.register(sampler);this.assetsRegistry.markReady(sampler,createSamplerAsset({label:'Surface grain repeat'}));
  const textures={};
  for(const kind of ['stucco','stone','tile','asphalt','grass']){
   const h=createTextureHandle('procedural.'+kind),N=128,bytes=new Uint8Array(N*N*4);
   for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const r=rnd(),grain=(r-.5)*(kind==='asphalt'?85:kind==='grass'?24:kind==='stucco'?12:26);
    let value=kind==='asphalt'?182:kind==='grass'?210:235;
    value+=grain+8*Math.sin(x*.21)*Math.sin(y*.29);
    for(let j=0;j<3;j++)bytes[(y*N+x)*4+j]=Math.max(0,Math.min(255,value+(j===2&&kind==='grass'?-8:0)));
    bytes[(y*N+x)*4+3]=255;
   }
   this.assetsRegistry.register(h);this.assetsRegistry.markReady(h,createTextureAsset({label:'Deterministic '+kind+' grain',dimension:'2d',width:N,height:N,format:'rgba8unorm-srgb',colorSpace:'srgb',semantic:'base-color',sourceData:{bytes,bytesPerRow:N*4}}));textures[kind]={texture:h,sampler};
  }
  landscape();road();house();garden();car();
  authoredStats.meshes=batches.size;authoredStats.vertices=0;authoredStats.triangles=0;
  for(const [k,q] of batches){
   authoredStats.vertices+=q.p.length/3;authoredStats.triangles+=q.idx.length/3;
   const pal=palette[k];if(!pal)throw new Error('Missing palette '+k);
   if(k==='blue'){
 const groups=new Map();
 for(let i=0;i<q.p.length;i+=3){const key=q.p.slice(i,i+3).map(v=>v.toFixed(5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const source=q.n.slice();
 for(const ids of groups.values())for(const i of ids){let n=[0,0,0];for(const j of ids){const dot=source[i]*source[j]+source[i+1]*source[j+1]+source[i+2]*source[j+2];if(dot>.45)n=add(n,source.slice(j,j+3));}n=norm(n);q.n[i]=n[0];q.n[i+1]=n[1];q.n[i+2]=n[2];}
 }
 const mat=createMaterialHandle('material.'+k);this.assetsRegistry.register(mat);this.assetsRegistry.markReady(mat,createStandardMaterialAsset({label:k,baseColorFactor:color.srgbHex(pal[0]),roughnessFactor:pal[1],metallicFactor:pal[2],baseColorTexture:pal[3]?textures[pal[3]]:null,clearcoatFactor:k==='blue'?.42:0,clearcoatRoughnessFactor:.18}));
   this.spawn.mesh({key:'scene.'+k,mesh:mesh.triangleList({label:k+' authored batch',positions:new Float32Array(q.p),normals:new Float32Array(q.n),uvs:new Float32Array(q.uv),indices:new Uint32Array(q.idx)}),material:mat,castShadow:!['asphalt','marking','hill0','hill1','hill2','grass'].includes(k),receiveShadow:true});
  }
 }
}
