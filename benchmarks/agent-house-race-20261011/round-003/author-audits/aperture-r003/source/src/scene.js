const PI=Math.PI;
const batches=new Map();
let seed=427;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const V=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{let l=Math.hypot(...a);return a.map(v=>v/l);};
function mat(k,color,r=.8,metallic=0,cast=true){batches.set(k,{p:[],n:[],uv:[],color,roughness:r,metallic,cast});return k;}
let xf=p=>p;
function tri(k,a,b,c,ns){
 const o0=xf([0,0,0]), ax=V(xf([1,0,0]),o0), ay=V(xf([0,1,0]),o0), az=V(xf([0,0,1]),o0);
 if(cross(ax,ay).reduce((v,n,i)=>v+n*az[i],0)<0){[b,c]=[c,b];if(ns)ns=[ns[0],ns[2],ns[1]];}
 a=xf(a);b=xf(b);c=xf(c);
 const normal=unit(cross(V(b,a),V(c,a)));if(!Number.isFinite(normal[0]))return;
 const q=batches.get(k);q.p.push(a,b,c);
 const abs=normal.map(Math.abs),dominant=abs.indexOf(Math.max(...abs)),scale=k==='asphalt'?.34:k.startsWith('tile')?.9:1.1;
 for(const p of [a,b,c])q.uv.push(dominant===1?[p[0]*scale,p[2]*scale]:dominant===0?[p[2]*scale,p[1]*scale]:[p[0]*scale,p[1]*scale]);
 // Authored normals use the same current rigid transform.
 if(ns){const o=xf([0,0,0]);q.n.push(...ns.map(n=>unit(V(xf(n),o))));}else q.n.push(normal,normal,normal);
}
function quad(k,a,b,c,d,ns){tri(k,a,b,c,ns?[ns[0],ns[1],ns[2]]:null);tri(k,a,c,d,ns?[ns[0],ns[2],ns[3]]:null);
 if(k==='carGlass'||k==='carTrim'||k==='headlight'||k==='alloy'){tri(k,c,b,a);tri(k,d,c,a);}
}
function box(k,c,s,angle=0){
 const [x,y,z]=c,[w,h,d]=s.map(v=>v/2),co=Math.cos(angle),si=Math.sin(angle);
 const p=(a,b,e)=>[x+a*co+e*si,y+b,z-a*si+e*co];
 const v=[p(-w,-h,-d),p(w,-h,-d),p(w,h,-d),p(-w,h,-d),p(-w,-h,d),p(w,-h,d),p(w,h,d),p(-w,h,d)];
 for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(k,...f.map(i=>v[i]));
}
function sphere(k,c,s,seg=12,rings=7){
 const p=(t,a)=>[c[0]+s[0]*Math.sin(t)*Math.cos(a),c[1]+s[1]*Math.cos(t),c[2]+s[2]*Math.sin(t)*Math.sin(a)];
 const n=(t,a)=>unit([Math.sin(t)*Math.cos(a)/s[0],Math.cos(t)/s[1],Math.sin(t)*Math.sin(a)/s[2]]);
 for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){
  let a=i*2*PI/seg,b=(i+1)*2*PI/seg,t=j*PI/rings,u=(j+1)*PI/rings;
  if(j===0)tri(k,p(t,a),p(u,b),p(u,a),[n(t,a),n(u,b),n(u,a)]);
  else if(j===rings-1)tri(k,p(t,a),p(t,b),p(u,a),[n(t,a),n(t,b),n(u,a)]);
  else quad(k,p(t,a),p(t,b),p(u,b),p(u,a),[n(t,a),n(t,b),n(u,b),n(u,a)]);
 }
}
function tube(k,a,b,r1,r2=r1,seg=10,cap=true){
 const axis=unit(V(b,a)),ref=Math.abs(axis[1])<.9?[0,1,0]:[1,0,0],u=unit(cross(axis,ref)),v=cross(axis,u);
 const p=(c,r,t)=>c.map((e,i)=>e+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t)));
 for(let i=0;i<seg;i++){
  let t=i*2*PI/seg,q=(i+1)*2*PI/seg;
  quad(k,p(a,r1,t),p(a,r1,q),p(b,r2,q),p(b,r2,t));
  if(cap){tri(k,a,p(a,r1,q),p(a,r1,t));tri(k,b,p(b,r2,t),p(b,r2,q));}
 }
}
function slab(k,points,y,th=.08){
 let area=points.reduce((s,p,i)=>{let q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0);
 if(area<0)points=[...points].reverse();
 let c=[points.reduce((s,p)=>s+p[0],0)/points.length,y,points.reduce((s,p)=>s+p[1],0)/points.length];
 for(let i=0;i<points.length;i++){let p=points[i],q=points[(i+1)%points.length];tri(k,c,[q[0],y,q[1]],[p[0],y,p[1]]);quad(k,[p[0],y,p[1]],[q[0],y,q[1]],[q[0],y-th,q[1]],[p[0],y-th,p[1]]);}
}
function irregularStone(k,x,z,w,d,y=.12){
 let p=[];for(let i=0;i<6;i++){let a=i*2*PI/6;p.push([x+Math.cos(a)*w*(.42+rand()*.1),z+Math.sin(a)*d*(.42+rand()*.1)]);}slab(k,p,y,.07);
}
function wall(k,width,height,depth,holes,mapper){
 const old=xf;xf=p=>old(mapper(p));
 let xx=[-width/2,width/2,...holes.flatMap(h=>[h[0]-h[2]/2,h[0]+h[2]/2])].sort((a,b)=>a-b);
 let yy=[.18,height,...holes.flatMap(h=>[h[1]-h[3]/2,h[1]+h[3]/2])].sort((a,b)=>a-b);
 for(let i=0;i<xx.length-1;i++)for(let j=0;j<yy.length-1;j++){
  if(xx[i+1]-xx[i]<.01||yy[j+1]-yy[j]<.01)continue;
  let x=(xx[i]+xx[i+1])/2,y=(yy[j]+yy[j+1])/2;
  if(holes.some(h=>Math.abs(x-h[0])<h[2]/2-.001&&Math.abs(y-h[1])<h[3]/2-.001))continue;
  box(k,[x,y,0],[xx[i+1]-xx[i],yy[j+1]-yy[j],depth]);
 }
 xf=old;
}
function window(x,y,w,h,mapper){
 const old=xf;xf=p=>old(mapper(p));
 box('glass',[x,y,-.10],[w-.12,h-.12,.035]);
 box('interior',[x,y,-.16],[w,h,.02]);
 // warm curtain slats, held inside actual wall opening
 for(let side of [-1,1])box('curtain',[x+side*w*.33,y,-.08],[w*.16,h-.12,.022]);
 for(let s of [-1,1]){box('frame',[x+s*w/2,y,.028],[.09,h+.12,.105]);box('frame',[x,y+s*h/2,.028],[w+.09,.09,.105]);}
 box('frame',[x,y,.085],[.07,h,.07]);box('frame',[x,y-.03,.085],[w,.055,.07]);
 box('sill',[x,y-h/2-.12,.075],[w+.26,.14,.32]);
 xf=old;
}
function barrel(k,x,y,z,len,r,slope=0,along='z'){
 // Upper half-cylinder roof tile, closed with thin thickness.
 const p=(a,t,off=0)=>along==='z'?[x+(r-off)*Math.cos(a),y+(r-off)*Math.sin(a)+t*slope,z+t]:[x+t,y+(r-off)*Math.sin(a)+t*slope,z+(r-off)*Math.cos(a)];
 for(let i=0;i<6;i++){
  let a=i*PI/6,b=(i+1)*PI/6;
  quad(k,p(a,0),p(b,0),p(b,len),p(a,len));
  quad(k,p(a,0,.035),p(a,len,.035),p(b,len,.035),p(b,0,.035));
  quad(k,p(a,0),p(a,0,.035),p(b,0,.035),p(b,0));
  quad(k,p(a,len),p(b,len),p(b,len,.035),p(a,len,.035));
 }
}
function roof(width,front,back,eave,peak,roofm='roof'){
 const hx=width/2,zm=(front+back)/2,half=(front-back)/2;
 quad(roofm,[-hx,eave,front],[hx,eave,front],[hx,peak,zm],[-hx,peak,zm]);
 quad(roofm,[-hx,peak,zm],[hx,peak,zm],[hx,eave,back],[-hx,eave,back]);
 for(let x=-hx+.14;x<hx;x+=.285)for(let s of [-1,1]){
  for(let row=0;row<Math.ceil(half/.46);row++){
   let z=zm+s*row*.46,remain=Math.min(.51,half-row*.46);
   if(remain<=.035)continue;
   let yy=peak-Math.abs(z-zm)*(peak-eave)/half+.035;
   const old=xf;if(s===-1)xf=p=>old([p[0],p[1],2*z-p[2]]);
   barrel('tile'+(Math.floor(rand()*5)),x,yy,z,remain,.145,-(peak-eave)/half);
   xf=old;
  }
 }
 for(let x=-hx;x<hx;x+=.4)barrel('ridge',x,peak+.13,zm,.43,.20,0,'x');
 for(let z of [front,back])box('wood',[0,eave-.08,z],[width+.18,.16,.16]);
 for(let x of [-hx,hx]){
  tube('wood',[x,eave-.08,front],[x,peak-.07,zm],.065,.065,6);
  tube('wood',[x,peak-.07,zm],[x,eave-.08,back],.065,.065,6);
 }
}
export function makeScene(){
 seed=427;batches.clear();
 mat('stucco','#e8d6b6');mat('stuccoShade','#dac6a6');mat('sill','#c7b493');mat('wood','#6b4a2c');mat('roof','#965137');
 for(let i=0;i<5;i++)mat('tile'+i,['#b96d42','#b5673d','#b76b41','#c1784a','#aa5c36'][i],.76);
 mat('ridge','#c67a48');mat('frame','#323b3c',.5);mat('glass','#3f5158',.18,.15);mat('interior','#151a1a');mat('curtain','#a79577');mat('door','#3b484d',.62);mat('doorPanel','#455256',.6);mat('metal','#252b2b',.35,.55);mat('gold','#b59a63',.34,.6);mat('lamp','#edc07a',.32);mat('ground','#65783c');
 mat('grass0','#758843');mat('grass1','#5f7435');mat('grass2','#8c9650');mat('earth','#8b7653');mat('asphalt','#555354',.98,0,false);mat('mark','#e1dfd1',.9,0,false);mat('curb','#aaa69a');
 for(let i=0;i<6;i++)mat('stone'+i,['#b3a48a','#c1b399','#a2957d','#b7aa94','#a89e88','#c8b9a0'][i],.96);
 mat('mortar','#8e8b78');mat('bark','#67503a');mat('bark2','#806044');
 for(let i=0;i<5;i++)mat('leaf'+i,['#4b612d','#62783e','#788448','#536a37','#889054'][i],.92);
 mat('cypress','#354d2c');mat('lavender','#8b7aa4');mat('yellow','#ccab48');mat('pot','#9f5e36');mat('potEdge','#bd7850');mat('soil','#493e29');
 mat('carPaint','#22558a',.28,.32);mat('carPaintLight','#346da2',.25,.3);mat('carTrim','#202b32',.42,.25);mat('carGlass','#495f6e',.14,.18);mat('rubber','#252627',.91);mat('alloy','#a2a7aa',.28,.78);mat('brake','#45494b',.5,.5);mat('headlight','#dad8b8',.18,.3);mat('red','#a93423',.3);mat('plate','#e3d9b8',.6);mat('chrome','#bfc1bb',.18,.9);
 ground();house();garden();car();backdrop();
 return [...batches].filter(([k,b])=>b.p.length);
}
function ground(){
 box('earth',[0,-.24,0],[28,.42,28]);
 slab('ground',Array.from({length:120},(_,i)=>{let a=i*2*PI/120;return [-3+11.18*Math.sin(a),-4+10.67*Math.cos(a)];}),.043,.045);
 // Elliptical roadway wraps around a fixed garden, with actual curb segments.
 const cx=-3,cz=-4,rx=12,rz=11.5;
 const P=(t,r)=>[cx+(rx+r)*Math.sin(t),cz+(rz+r)*Math.cos(t)];
 for(let i=0;i<100;i++){
  let a=-1.45+i*2.9/100,b=-1.45+(i+1)*2.9/100;
  let A=P(a,0),B=P(b,0),C=P(b,4.6),D=P(a,4.6);
  quad('asphalt',[A[0],.035,A[1]],[D[0],.035,D[1]],[C[0],.035,C[1]],[B[0],.035,B[1]]);
  let E=P(a,-.8),F=P(b,-.8);quad('curb',[E[0],.12,E[1]],[A[0],.12,A[1]],[B[0],.12,B[1]],[F[0],.12,F[1]]);
  quad('curb',[A[0],.12,A[1]],[A[0],.035,A[1]],[B[0],.035,B[1]],[B[0],.12,B[1]]);
  // segment edges articulated with a narrow mortar joint.
  tube('mortar',[A[0],.121,A[1]],[E[0],.121,E[1]],.008,.008,4);
 }
 for(let i=0;i<24;i++){
  let a=-1.4+i*.118,b=a+.057;
  let A=P(a,2.5),B=P(b,2.5),C=P(b,2.65),D=P(a,2.65);
  quad('mark',[A[0],.045,A[1]],[D[0],.045,D[1]],[C[0],.045,C[1]],[B[0],.045,B[1]]);
 }
 // Mottled lawn patches stay low and follow the garden footprint.
 for(let i=0;i<230;i++){let x=-10+rand()*17,z=-9+rand()*15;if(z>5.5||x>7.5||((x+3)/11.0)**2+((z+4)/10.5)**2>.92||Math.abs(x)<4.2&&Math.abs(z)<3.3)continue;slab('grass'+i%3,Array.from({length:6},(_,j)=>{let a=j*PI/3;return [x+Math.cos(a)*(.25+rand()*.35),z+Math.sin(a)*(.2+rand()*.3)]}),.045,.005);}
}
function house(){
 const front=p=>[p[0],p[1],3+p[2]],back=p=>[-p[0],p[1],-3-p[2]],right=p=>[4+p[2],p[1],-p[0]],left=p=>[-4-p[2],p[1],p[0]];
 const holes=[[-2.5,1.6,1.2,1.55],[2.5,1.6,1.2,1.55],[-2.05,4.8,1.65,1.7],[2.05,4.8,1.65,1.7],[0,1.37,1.18,2.5]];
 wall('stucco',8,6.4,.30,holes,front);
 for(const h of holes.slice(0,4))window(...h,front);
 for(const [mapper,k] of [[right,'stuccoShade'],[left,'stucco'],[back,'stuccoShade']]){
  let hs=mapper===back?[[-2,1.65,1.3,1.55],[2,1.65,1.3,1.55],[-2,4.8,1.4,1.7],[2,4.8,1.4,1.7]]:[[-1.6,1.65,1.0,1.6],[1.6,1.65,1,1.6],[-1.6,4.8,1.0,1.7],[1.6,4.8,1,1.7]];
  wall(k,mapper===back?8:6,6.4,.3,hs,mapper);for(let h of hs)window(...h,mapper);
 }
 // Solid gables are closed prisms; ridge runs left/right.
 for(let x of [-4,4]){
  const old=xf;xf=p=>[x+(x>0?p[2]:-p[2]),p[1],p[0]];
  tri('stucco',[-3,6.4,.0],[3,6.4,.0],[0,8.35,.0]);
  tri('stucco',[0,8.35,.22],[3,6.4,.22],[-3,6.4,.22]);
  for(let [a,b] of [[[-3,6.4],[3,6.4]],[[3,6.4],[0,8.35]],[[0,8.35],[-3,6.4]]])quad('stucco',[a[0],a[1],0],[a[0],a[1],.22],[b[0],b[1],.22],[b[0],b[1],0]);
  xf=old;
 }
 roof(8.7,3.5,-3.5,6.4,8.5);
 box('sill',[0,.20,0],[8.24,.25,6.22]);
 // Downpipes and thin eave gutter.
 tube('metal',[-4.17,6.3,3.44],[4.17,6.3,3.44],.06,.06,10);
 for(let x of [-3.87,3.87]){tube('metal',[x,6.3,3.45],[x,5.99,3.22],.046,.046);tube('metal',[x,5.99,3.22],[x,.32,3.22],.046,.046);tube('metal',[x,.32,3.22],[x,.21,3.46],.046,.046);}
 // Porch slab, two broad stucco posts and capital/collar details.
 box('stone2',[0,.24,4.02],[4.65,.27,2.1]);
 box('stone1',[0,.13,5.18],[4.7,.16,.44]);
 box('stone3',[0,.055,5.48],[4.7,.1,.30]);
 for(let x of [-2.02,2.02]){
  box('stucco',[x,1.8,4.72],[.32,3.05,.34]);
  box('sill',[x,.43,4.72],[.48,.16,.5]);
  box('stucco',[x,3.30,4.72],[.48,.18,.52]);
 }
 box('wood',[0,3.4,4.66],[4.6,.20,.24]);
 // Single-slope tiled porch covering.
 const pfront=5.0,pback=3.04,h=3.55,top=4.02;
 quad('roof',[-2.4,h,pfront],[2.4,h,pfront],[2.4,top,pback],[-2.4,top,pback]);
 for(let x=-2.3;x<2.4;x+=.285)for(let row=0;row<5;row++){let z=pback+row*.41,y=top-(z-pback)*.24;barrel('tile'+Math.floor(rand()*5),x,y+.035,z,.45,.145,-.24);}
 box('wood',[0,3.53,5.0],[4.85,.16,.13]);
 for(let x of [-2.4,2.4])tube('wood',[x,3.55,5],[x,4.02,3.04],.06,.06);
 box('door',[0,1.43,2.95],[1.10,2.45,.13]);
 for(let x of [-.26,.26])for(let y of [.93,1.94])box('doorPanel',[x,y,3.031],[.40,.75,.045]);
 for(let x of [-.61,.61])box('sill',[x,1.46,3.01],[.095,2.62,.18]);
 box('sill',[0,2.79,3.01],[1.3,.12,.19]);box('gold',[-.40,1.29,3.075],[.065,.24,.05]);tube('gold',[-.4,1.3,3.11],[-.4,1.3,3.20],.025,.025);
 // Wall lantern to the left of the entry.
 box('metal',[-.96,2.57,3.22],[.09,.31,.08]);tube('metal',[-.96,2.68,3.24],[-.96,2.73,3.48],.023);
 box('lamp',[-.96,2.53,3.48],[.17,.24,.15]);
 for(let x of [-1.055,-.865])for(let z of [3.395,3.565])tube('metal',[x,2.39,z],[x,2.68,z],.013);
 box('metal',[-.96,2.38,3.48],[.23,.04,.23]);
 sphere('metal',[-.96,2.71,3.48],[.17,.10,.16],8,4);
 // Chimney on the right roof slope, with cap, visible vent cavity and tiny flue pillars.
 box('stucco',[2.25,8.32,-.7],[.67,1.34,.71]);
 box('sill',[2.25,8.99,-.7],[.79,.12,.83]);
 box('interior',[2.25,9.19,-.7],[.59,.31,.60]);
 for(let x of [1.98,2.52])for(let z of [-.97,-.43])box('stucco',[x,9.18,z],[.095,.32,.095]);
 box('sill',[2.25,9.39,-.7],[.91,.14,.91]);sphere('ridge',[2.25,9.50,-.7],[.48,.12,.48],4,2);
}
function hedge(x,z,s=1){
 for(let i=0;i<9;i++){
  let a=rand()*2*PI,r=rand()*.6*s;
  sphere('leaf'+i%5,[x+Math.cos(a)*r,.27+rand()*.37*s,z+Math.sin(a)*r],[.34*s,.3*s,.33*s],8,5);
 }
}
function tree(x,z,s=1){
 tube('bark',[x,0,z],[x+.08*s,2.3*s,z],.14*s,.07*s,9);
 for(let i=0;i<8;i++){
  let a=i*2.4,ex=x+Math.cos(a)*(.55+rand()*.8)*s,ez=z+Math.sin(a)*(.55+rand()*.7)*s,ey=(1.85+rand()*.85)*s;
  tube(i%2?'bark':'bark2',[x+.05*s,1.0*s,z],[ex,ey,ez],.075*s,.025*s,7);
  tube('bark',[ex,ey,ez],[ex+.20*s,ey+.5*s,ez-.2*s],.025*s,.008*s,5);
  for(let j=0;j<6;j++){
   sphere('leaf'+(i+j)%5,[ex+(rand()-.5)*.65*s,ey+(rand()-.2)*.65*s,ez+(rand()-.5)*.65*s],[.4*s,.3*s,.43*s],8,5);
  }
 }
}
function cypress(x,z,h=5){
 tube('bark',[x,0,z],[x,h*.65,z],.07,.025,8);
 for(let i=0;i<9;i++)sphere('cypress',[x+(rand()-.5)*.12, .5+i*h/10,z+(rand()-.5)*.1],[.3*(1-i*.055),h*.14,.29*(1-i*.055)],9,5);
}
function flowers(x,z,count=24,s=1){
 for(let i=0;i<count;i++){
  let a=rand()*2*PI,r=rand()*.55*s,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,h=.25+rand()*.33*s;
  tube('leaf1',[xx,.06,zz],[xx+.05,h,zz],.012,.008,4);
  sphere(i%3===0?'yellow':'lavender',[xx+.05,h,zz],[.045,.08,.045],5,3);
 }
}
function pot(x,z,s=1){
 tube('pot',[x,.1,z],[x,.55*s,z],.23*s,.33*s,14);
 tube('potEdge',[x,.51*s,z],[x,.59*s,z],.34*s,.34*s,16);
 tube('soil',[x,.594*s,z],[x,.602*s,z],.3*s,.3*s,14);
 tree(x,z,.34*s);
}
function garden(){
 // Path from the entry to the gap between garden piers.
 for(let row=0;row<10;row++)for(let col=0;col<3;col++){let x=-.75+col*.55+(rand()-.5)*.15,z=5.25+row*.235;irregularStone('stone'+Math.floor(rand()*6),x,z,.60,.40,.125);}
 // Side path and back terrace form real individual paving stones.
 for(let row=0;row<22;row++)for(let col=0;col<4;col++){let x=4.55+col*.43,z=-3+row*.43;irregularStone('stone'+Math.floor(rand()*6),x+(rand()-.5)*.12,z+(rand()-.5)*.12,.51,.48,.12);}
 pot(-1.42,3.68,.85);pot(1.45,3.74,.72);pot(3.23,3.6,1.0);
 // A curved masonry garden wall, each course bonded with varied stones.
 const cx=-3,cz=-4,rx=11.10,rz=10.6;
 for(let i=0;i<100;i++){
  let a=-1.4+i*2.8/100,b=a+2.8/100,mid=(a+b)/2,x=cx+rx*Math.sin(mid),z=cz+rz*Math.cos(mid);
  if(z>5&&Math.abs(x)<1.24)continue;
  let A=[cx+(rx-.17)*Math.sin(a),cz+(rz-.17)*Math.cos(a)],B=[cx+(rx-.17)*Math.sin(b),cz+(rz-.17)*Math.cos(b)],C=[cx+(rx+.17)*Math.sin(b),cz+(rz+.17)*Math.cos(b)],D=[cx+(rx+.17)*Math.sin(a),cz+(rz+.17)*Math.cos(a)];
  slab('mortar',[A,B,C,D],.92,.86);
 }
 for(let j=0;j<3;j++)for(let i=0;i<50;i++){
  let a=-1.4+(i+.5*(j%2))*2.8/50,b=a+2.8/50-.006;
  let mid=(a+b)/2,x=cx+rx*Math.sin(mid),z=cz+rz*Math.cos(mid);
  if(z>5&&Math.abs(x)<1.24)continue;
  let p1=[cx+rx*Math.sin(a),cz+rz*Math.cos(a)],p2=[cx+rx*Math.sin(b),cz+rz*Math.cos(b)];
  let width=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
  box('stone'+Math.floor(rand()*6),[x,.22+j*.28,z],[width,.26,.43],mid);
 }
 for(let i=0;i<80;i++){
  let a=-1.4+(i+.5)*2.8/80,x=cx+rx*Math.sin(a),z=cz+rz*Math.cos(a);
  if(z>5&&Math.abs(x)<1.24)continue;
  box('stone'+i%6,[x,1.01,z],[.38,.13,.54],a);
 }
 for(let x of [-1.32,1.32]){
  let z=cz+rz*Math.sqrt(1-((x-cx)/rx)**2);
  for(let j=0;j<5;j++)box('stone'+j%6,[x,.18+j*.25,z],[.53,.235,.56]);
  box('sill',[x,1.42,z],[.70,.15,.72]);
 }
 // Mailbox on a slender freestanding support at the entry.
 let mbx=-1.9,mbz=6.12;
 box('metal',[mbx,.66,mbz],[.08,1.28,.08]);
 box('metal',[mbx,1.38,mbz],[.5,.40,.34]);
 sphere('metal',[mbx,1.59,mbz],[.25,.18,.17],10,5);
 box('gold',[mbx,1.4,mbz+.175],[.17,.035,.008]);
 box('door',[mbx+.24,1.55,mbz],[.012,.20,.20]);
 // Greenery along front and side masonry boundary.
 for(let i=0;i<29;i++){
  let a=-1.28+i*2.55/29,x=cx+10.25*Math.sin(a),z=cz+9.8*Math.cos(a);
  if(z>4.8&&Math.abs(x)<1.75)continue;
  hedge(x,z,.6+rand()*.5);
 }
 tree(-6.5,2.7,1.45);tree(7,-2.5,1.05);tree(-7.5,-4.6,1.25);
 cypress(-8,-2.0,5.8);cypress(-6.3,-6.8,5.0);cypress(7.4,-6.6,4.5);
 for(let x of [-3.3,3.3]){hedge(x,4.7,.78);flowers(x,4.85,28,.85);}
 for(let i=0;i<9;i++){hedge(4.7,-2.5+i*.72,.72);flowers(5.0,-2.5+i*.72,12,.8);}
 flowers(-5,4.8,50,1.2);flowers(-7,1.2,35,1);
 // Timber gate closing the side passage.
 for(let i=0;i<13;i++)box('wood',[6.25,-.02+1.02,-2.6+i*.075],[.09,1.95,.065]);
 box('wood',[6.25,1.01,-2.15],[.17,1.95,.95]);
 for(let i=0;i<9;i++)box('bark2',[6.345,1.04,-2.54+i*.10],[.018,1.88,.014]);
}
function car(){
 const old=xf,angle=.77,co=Math.cos(angle),si=Math.sin(angle),cx=6.0,cz=5.4;
 xf=p=>[cx+p[0]*co+p[2]*si,p[1]+.055,cz-p[0]*si+p[2]*co];
 // Smooth hood, fenders, trunk and compound body contour.
 const sections=[
 [-2.28,.73,.73],[-2.12,.96,.90],[-1.70,1.15,.96],[-1.00,1.20,.96],[-.6,1.17,.95],[.25,1.16,.96],[1.10,1.13,.94],[1.75,1.05,.9],[2.05,1.0,.8],[2.16,.94,.70]
 ];
 for(let i=0;i<sections.length-1;i++){
  let A=sections[i],B=sections[i+1];
  // Hood top slopes down over front; rear deck is narrow and under window.
  for(let side of [-1,1]){
   let pp=[[A[0],A[1],0],[B[0],B[1],0],[B[0],B[1]-.075,side*B[2]],[A[0],A[1]-.075,side*A[2]]];
   if(side===1)pp.reverse();
   quad('carPaintLight',...pp);
  }
 }
 // Continuous side panels shaped around the four true wheel openings.
 const at=x=>{
  let i=sections.findIndex(s=>s[0]>=x);if(i<1)return sections[Math.max(0,i)];let a=sections[i-1],b=sections[i],t=(x-a[0])/(b[0]-a[0]);return [x,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];
 };
 for(let side of [-1,1])for(let i=0;i<92;i++){
  let x=-2.28+i*4.44/92,q=x+4.44/92,A=at(x),B=at(q);
  const low=x=>{let y=.43;for(let w of [-1.4,1.35])if(Math.abs(x-w)<.50)y=Math.max(y,.48+Math.sqrt(.50**2-(x-w)**2));return y;};
  let ya=low(x),yb=low(q),ta=A[1]-.075,tb=B[1]-.075;
  if(ya<ta&&yb<tb)quad('carPaint',[x,ya,side*(A[2]-.015)],[q,yb,side*(B[2]-.015)],[q,tb,side*(B[2]+.02)],[x,ta,side*(A[2]+.02)]);
  // Raised wheel arch lips run as a semicircular bodywork ribbon.
 }
 for(let x of [-1.4,1.35])for(let side of [-1,1])for(let i=0;i<20;i++){
  let a=i*PI/20,b=(i+1)*PI/20,r=.50,R=.525;
  quad('carPaintLight',[x+r*Math.cos(a),.48+r*Math.sin(a),side*.972],[x+r*Math.cos(b),.48+r*Math.sin(b),side*.972],[x+R*Math.cos(b),.48+R*Math.sin(b),side*.975],[x+R*Math.cos(a),.48+R*Math.sin(a),side*.975]);
 }
 // Roof canopy and hatch rear.
 quad('carPaintLight',[-.13,1.67,-.71],[-.13,1.67,.71],[.97,1.7,.72],[.97,1.7,-.72]);
 quad('carGlass',[-.66,1.16,-.77],[-.66,1.16,.77],[-.16,1.65,.695],[-.16,1.65,-.695]);
 quad('carGlass',[1.04,1.67,-.69],[1.04,1.67,.69],[1.78,1.08,.76],[1.78,1.08,-.76]);
 for(let side of [-1,1]){
  // Bordered side windows, front and rear trapezoids.
  quad('carTrim',[-.71,1.13,side*.88],[-.16,1.70,side*.73],[1.03,1.73,side*.74],[1.79,1.09,side*.87]);
  quad('carGlass',[-.58,1.2,side*.886],[-.1,1.64,side*.735],[.48,1.66,side*.747],[.53,1.19,side*.914]);
  quad('carGlass',[.62,1.19,side*.914],[.58,1.66,side*.75],[.98,1.65,side*.75],[1.62,1.16,side*.883]);
  tube('carPaint',[-.68,1.14,side*.89],[-.13,1.70,side*.73],.046,.042,8);
  tube('carPaint',[-.13,1.70,side*.73],[1.02,1.73,side*.74],.038,.038,8);
  tube('carPaint',[1.02,1.73,side*.74],[1.79,1.10,side*.87],.046,.042,8);
  tube('carTrim',[-.68,1.14,side*.912],[1.75,1.12,side*.928],.024,.024,7);
  tube('carTrim',[.55,1.16,side*.935],[.52,1.69,side*.74],.034,.034,7);
  // Door gaps below glazing, handles, rocker trim and mirror assemblies.
  tube('carTrim',[.56,.56,side*.955],[.56,1.13,side*.979],.009,.009,4);
  tube('carTrim',[-.67,.54,side*.93],[-.67,1.14,side*.979],.008,.008,4);
  tube('carTrim',[1.75,.58,side*.895],[1.72,1.07,side*.924],.009,.009,4);
  tube('carTrim',[-.8,.46,side*.94],[.8,.46,side*.94],.033,.033,8);
  box('carTrim',[.29,1.06,side*.981],[.19,.045,.05]);box('carTrim',[1.35,1.05,side*.956],[.17,.045,.05]);
  tube('carTrim',[-.56,1.18,side*.87],[-.6,1.19,side*1.04],.038,.038,7);
  sphere('carPaint',[-.61,1.22,side*1.08],[.16,.095,.11],12,6);
  box('carGlass',[-.61,1.245,side*1.171],[.19,.075,.012]);
 }
 // Sculpted nose and bumpers.
 quad('carPaint',[-2.29,.75,-.72],[-2.29,.75,.72],[-2.14,1.00,.86],[-2.14,1.00,-.86]);
 box('carPaint',[-2.22,.56,0],[.18,.27,1.67]);
 box('carTrim',[-2.323,.58,0],[.015,.18,1.02]);
 box('carTrim',[-2.312,.86,0],[.02,.16,.90]);
 for(let y of [.52,.58,.64,.82,.88])box('chrome',[-2.335,y,0],[.01,.014,1.00]);
 for(let s of [-1,1]){
  quad('headlight',[-2.327,.82,s*.48],[-2.23,.83,s*.84],[-2.12,.985,s*.87],[-2.32,.965,s*.46]);
  tube('chrome',[-2.32,.81,s*.47],[-2.23,.82,s*.84],.018,.018,6);
  sphere('headlight',[-2.323,.63,s*.64],[.018,.051,.071],8,5);
  box('carTrim',[-2.28,.63,s*.64],[.015,.11,.19]);
  // Rear lamp stacks, hatch seams.
  box('red',[2.18,.81,s*.65],[.05,.14,.25]);
  box('headlight',[2.209,.81,s*.65],[.012,.035,.18]);
 }
 box('carPaint',[2.12,.62,0],[.15,.28,1.52]);box('carTrim',[2.20,.49,0],[.02,.075,1.42]);
 box('plate',[-2.342,.70,0],[.012,.14,.36]);box('plate',[2.205,.76,0],[.016,.14,.36]);
 tube('chrome',[-2.347,.925,0],[-2.365,.925,0],.056,.056,16);
 sphere('chrome',[2.20,1.015,0],[.012,.04,.04],12,5);
 tube('carTrim',[.7,1.73,0],[.86,1.99,0],.013,.006,7);
 // Wipers on the windscreen.
 tube('carTrim',[-.57,1.235,-.63],[-.38,1.39,-.16],.014,.011,5);
 tube('carTrim',[-.57,1.235,.14],[-.37,1.39,.64],.014,.011,5);
 // Four wheels: round shoulder/tread profiles, alloy spokes, hub and brake disk.
 for(let x of [-1.4,1.35])for(let side of [-1,1]){
  const z=side*.95,cy=.48;
  const profile=[[-.145,.33],[-.115,.40],[-.06,.445],[.06,.445],[.115,.40],[.145,.33]];
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<32;i++){
   const a=i*2*PI/32,b=(i+1)*2*PI/32,p=(ang,j)=>[x+Math.cos(ang)*profile[j][1],cy+Math.sin(ang)*profile[j][1],z+profile[j][0]];
   quad('rubber',p(a,j),p(b,j),p(b,j+1),p(a,j+1));
  }
  const out=z+side*.145;
  tube('brake',[x,cy,out-side*.025],[x,cy,out],.322,.322,24);
  for(let i=0;i<10;i++){
   let a=i*2*PI/10;
   const u=[x+Math.cos(a)*.09,cy+Math.sin(a)*.09,out+side*.018],v=[x+Math.cos(a+.08)*.312,cy+Math.sin(a+.08)*.312,out+side*.012];
   tube('alloy',u,v,.024,.028,5);
  }
  tube('alloy',[x,cy,out],[x,cy,out+side*.028],.085,.085,12);
  for(let i=0;i<32;i++){
   let a=i*2*PI/32,b=(i+1)*2*PI/32;
   quad('alloy',[x+.306*Math.cos(a),cy+.306*Math.sin(a),out],[x+.306*Math.cos(b),cy+.306*Math.sin(b),out],[x+.336*Math.cos(b),cy+.336*Math.sin(b),out],[x+.336*Math.cos(a),cy+.336*Math.sin(a),out]);
  }
  for(let i=0;i<5;i++){let a=i*2*PI/5;tube('chrome',[x+.05*Math.cos(a),cy+.05*Math.sin(a),out+side*.03],[x+.05*Math.cos(a),cy+.05*Math.sin(a),out+side*.038],.009,.009,6);}
 }
 // Dashboard and seats visible through side glints are actual interior volumes.
 box('carTrim',[-.35,1.15,0],[.48,.14,1.3]);
 for(let x of [.12,.85])for(let z of [-.43,.43]){sphere('interior',[x,1.24,z],[.19,.23,.19],10,5);sphere('interior',[x+.1,1.47,z],[.13,.12,.15],8,5);}
 xf=old;
}
function backdrop(){
 // Distant low terrain and olive groves provide a soft horizon.
 for(let i=0;i<9;i++){
  let x=-24+i*6,z=-24-rand()*5;
  sphere(i%2?'leaf1':'leaf2',[x,-1.6,z],[6,3.3+rand()*2.5,5],14,6);
 }
 for(let i=0;i<12;i++)tree(-14+i*2.6,-12-rand()*3,.65+rand()*.4);
}
