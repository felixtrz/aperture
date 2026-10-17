import {createSystem,mesh,material} from '@aperture-engine/app/systems';
type V=[number,number,number];
let seed=7193;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:V):V=>mul(a,1/Math.hypot(...a));
const lerp=(a:V,b:V,t:number):V=>add(mul(a,1-t),mul(b,t));
const palette:Record<string,[number,number,number]>={
 sand:[.64,.55,.40],sandLight:[.72,.64,.49],stone:[.53,.51,.44],stoneLight:[.68,.65,.55],stoneDark:[.36,.38,.34],mortar:[.36,.34,.28],plaster:[.83,.77,.64],wood:[.25,.105,.045],woodLight:[.39,.19,.08],woodDark:[.16,.072,.035],roof:[.12,.15,.18],roofLight:[.19,.22,.24],roofEdge:[.24,.25,.25],bark:[.18,.14,.09],barkLight:[.28,.22,.14],leaf:[.19,.26,.085],leafLight:[.30,.37,.12],leafDark:[.105,.16,.055],leafGold:[.28,.33,.085],bamboo:[.22,.29,.07],bambooNode:[.40,.44,.14],water:[.16,.35,.29],waterLight:[.19,.39,.32],waterDark:[.13,.30,.25],lotus:[.40,.53,.16],lotusLight:[.56,.64,.25],pink:[.83,.37,.29],petal:[.95,.61,.43],cream:[.96,.78,.49],ochre:[.55,.21,.07],background:[.72,.66,.57]
};
const buckets=new Map<string,V[]>();
function tri(k:string,a:V,b:V,c:V){if(Math.hypot(...cross(sub(b,a),sub(c,a)))<1e-7)return;let v=buckets.get(k);if(!v)buckets.set(k,v=[]);v.push(a,b,c)}
function quad(k:string,a:V,b:V,c:V,d:V){tri(k,a,b,c);tri(k,a,c,d)}
function box(k:string,c:V,s:V,ry=0){const p:V[]=[];for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1]){const xx=x*s[0]/2,zz=z*s[2]/2;p.push([c[0]+xx*Math.cos(ry)+zz*Math.sin(ry),c[1]+y*s[1]/2,c[2]-xx*Math.sin(ry)+zz*Math.cos(ry)])}for(const f of [[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[2,6,7,3],[0,1,5,4]])quad(k,p[f[0]],p[f[1]],p[f[2]],p[f[3]])}
function tube(k:string,a:V,b:V,r:number,r2=r,n=7){const axis=norm(sub(b,a));const u=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0]));const v=cross(axis,u);const pa:V[]=[],pb:V[]=[];for(let i=0;i<n;i++){const ang=i/n*Math.PI*2;const d=add(mul(u,Math.cos(ang)),mul(v,Math.sin(ang)));pa.push(add(a,mul(d,r)));pb.push(add(b,mul(d,r2)))}for(let i=0;i<n;i++){const j=(i+1)%n;quad(k,pa[i],pa[j],pb[j],pb[i]);tri(k,a,pa[j],pa[i]);tri(k,b,pb[i],pb[j])}}
const phi=(1+Math.sqrt(5))/2;
const iv:V[]=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(norm);
const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
function rock(k:string,c:V,s:V,detail=1,jitter=.13){const f:V[][]=[];for(const face of faces){const [a,b,d]=face.map(i=>iv[i]);if(detail){const ab=norm(add(a,b)),bd=norm(add(b,d)),da=norm(add(d,a));f.push([a,ab,da],[b,bd,ab],[d,da,bd],[ab,bd,da])}else f.push([a,b,d])}const cache=new Map<string,V>();const tf=(p:V):V=>{let v=cache.get(p.join(','));if(v)return v;const q=1+(rnd()-.5)*jitter;v=[c[0]+p[0]*s[0]*q,c[1]+p[1]*s[1]*q,c[2]+p[2]*s[2]*q];cache.set(p.join(','),v);return v};for(const t of f){let col=k;if(k==='stone')col=rnd()<.20?'stoneLight':rnd()<.18?'stoneDark':k; if(k==='leaf')col=rnd()<.25?'leafLight':rnd()<.2?'leafDark':k;tri(col,tf(t[0]),tf(t[1]),tf(t[2]))}}
function leaf(k:string,a:V,b:V,width:number){const dir=sub(b,a),side=norm(cross(dir,[0,1,.2]));const m=lerp(a,b,.48),l=add(m,mul(side,width)),r=add(m,mul(side,-width));tri(k,a,l,b);tri(k,a,b,r);tri(k,b,l,a);tri(k,r,b,a)}
const pond:V[]=[[-4.5,.18,.5],[-4.0,.18,-.3],[-3,.18,-.5],[-2,.18,-.25],[-1,.18,-.55],[.15,.18,-.5],[1.1,.18,-1.5],[2.1,.18,-1.65],[2.9,.18,-.8],[3.25,.18,.35],[3.55,.18,1.65],[3.1,.18,2.9],[2.2,.18,3.8],[.7,.18,4.35],[-.7,.18,4.5],[-2,.18,4.05],[-3.3,.18,3.2],[-4.2,.18,2.1]];
function disk(k:string,c:V,r:number,n=12){for(let i=0;i<n;i++){const a=i/n*2*Math.PI,b=(i+1)/n*2*Math.PI;tri(k,c,[c[0]+r*Math.cos(b),c[1],c[2]+r*Math.sin(b)],[c[0]+r*Math.cos(a),c[1],c[2]+r*Math.sin(a)])}}
function pine(x:number,z:number,s:number,mirror=1){
 const T=(v:V):V=>[x+v[0]*s*mirror,.25+v[1]*s,z+v[2]*s];
 const trunk:V[]=[[0,0,0],[.1,.85,.05],[-.3,1.6,.1],[-.45,2.25,0],[.08,3.15,-.12],[.35,3.75,-.18]];
 for(let i=0;i<trunk.length-1;i++){tube(i%2?'bark':'barkLight',T(trunk[i]),T(trunk[i+1]),(.30-i*.042)*s,(.26-i*.042)*s,7)}
 const branches:[[number,number,number],[number,number,number],[number,number,number]][]=[[[.0,3.1,-.1],[-1.2,3.7,.0],[-1.8,3.8,.05]],[[-.43,2.2,0],[-1.1,2.8,.28],[-2.05,2.95,.4]],[[-.25,1.7,.1],[-.6,2.55,.1],[-1.0,2.8,.3]],[[.25,3.6,-.15],[1.0,3.95,-.3],[1.65,4.0,-.2]],[[.25,3.7,-.15],[.15,4.3,.2],[.1,4.5,.35]]];
 for(const b of branches){tube('bark',T(b[0]),T(b[1]),.13*s,.075*s,6);tube('barkLight',T(b[1]),T(b[2]),.075*s,.035*s,6);const p=b[2];for(let j=0;j<7;j++){const a=j*2.4;rock('leaf',T([p[0]+Math.cos(a)*(.35+rnd()*.25),p[1]+rnd()*.35,p[2]+Math.sin(a)*.45]),[s*(.39+rnd()*.24),s*(.19+rnd()*.12),s*(.36+rnd()*.18)],1,.23)}}
}
function shrub(x:number,z:number,s=.45){for(let i=0;i<5;i++){const a=i*2.4;rock(i%3?'leaf':'leafGold',[x+Math.cos(a)*s*.7,.3+s*.35+rnd()*s*.25,z+Math.sin(a)*s*.7],[s*.55,s*.4,s*.5],0,.24)}}
function grass(x:number,z:number,s=.3){for(let j=0;j<5;j++){const a=rnd()*6.28;leaf(j%2?'leafLight':'leafGold',[x,.27,z],[x+Math.sin(a)*s*.6,.27+s*(.6+rnd()*.7),z+Math.cos(a)*s*.6],.025)}}
function lotus(x:number,z:number,s=.3,flower=false){const y=.198;for(let i=0;i<11;i++){const a=(i+.2)/12*6.28,b=(i+1.2)/12*6.28;tri(i%3?'lotus':'lotusLight',[x,y,z],[x+Math.cos(b)*s,y,z+Math.sin(b)*s],[x+Math.cos(a)*s,y,z+Math.sin(a)*s])}if(flower){tube('bamboo',[x,.18,z],[x,.38,z],.018,.014,5);for(let ring=0;ring<2;ring++)for(let i=0;i<8;i++){const a=i*Math.PI/4+ring*.3;const base:V=[x,.35,z];const end:V=[x+Math.cos(a)*(.27-ring*.08),.43+ring*.10,z+Math.sin(a)*(.27-ring*.08)];const m=lerp(base,end,.55),side:V=[-Math.sin(a)*.075,.0,Math.cos(a)*.075];tri(ring?'petal':'pink',base,add(m,side),end);tri('petal',base,end,sub(m,side));}rock('cream',[x,.44,z],[.09,.065,.09],0,0)}}
export default class GardenSystem extends createSystem({priority:0}){
 override init(){
  this.spawn.camera({key:'camera.garden',transform:{translation:[13,16.5,19],lookAt:[0,1.4,0]},camera:{projection:'orthographic',orthographicHeight:15.2,near:.1,far:120,aspect:4/3}});
  this.spawn.light({key:'sun',kind:'directional',color:[1,.87,.69,1],intensity:3.3,transform:{rotationEulerDegrees:[-48,-35,0]},shadow:{mapSize:2048,cascadeCount:1,shadowType:1,strength:.73,filterRadius:2.5,normalBias:.025}});
  box('background',[0,-.69,0],[180,.1,180]);box('stone',[0,-.22,0],[12,.8,12]);
  // The sand perimeter is a real ring, leaving the pool basin open.
  const center:V=[-.45,.26,1.4];
  for(let i=0;i<pond.length;i++){const a=pond[i],b=pond[(i+1)%pond.length];const ray=(p:V):V=>{const dx=p[0]-center[0],dz=p[2]-center[2];const tx=(dx>0?5.96-center[0]:-5.96-center[0])/dx;const tz=(dz>0?5.96-center[2]:-5.96-center[2])/dz;const t=Math.min(tx,tz);return [center[0]+dx*t,.26,center[2]+dz*t]};const aa:V=[a[0],.26,a[2]],bb:V=[b[0],.26,b[2]],oa=ray(a),ob=ray(b);quad('sand',aa,bb,ob,oa);tri(i%4?'water':'waterLight',[center[0],.18,center[2]],b,a);const L=Math.hypot(b[0]-a[0],b[2]-a[2]);for(let j=0;j<Math.ceil(L/.62);j++){const p=lerp(a,b,(j+.45)/Math.ceil(L/.62));rock('stone',[p[0],.29+rnd()*.05,p[2]],[.42+rnd()*.13,.24+rnd()*.14,.32+rnd()*.1],1,.27)}}
  // Complete square corners around the radial ring.
  const outer=[[-5.96,.26,-5.96],[5.96,.26,-5.96],[5.96,.26,5.96],[-5.96,.26,5.96]] as V[];
  // Sand patches fill the rectangular extremes outside the pond.
  box('sand',[-.2,.20,-3.75],[11.5,.12,3.1]);box('sand',[4.9,.20,.8],[2.1,.12,10.1]);box('sand',[-5.3,.20,.9],[1.3,.12,10.1]);box('sand',[0,.20,5.4],[11.8,.12,1.2]);
  // Stone retaining course and its joints.
  for(let i=-6;i<=6;i+=.75){box('mortar',[i,-.23,6.005],[.014,.77,.008]);box('mortar',[6.005,-.23,i],[.008,.77,.014]);}box('mortar',[0,-.23,6.01],[12,.015,.012]);box('mortar',[6.01,-.23,0],[.012,.015,12]);
  // Plaster enclosure with a real circular aperture.
  const gateX=2.72,gateY=1.75,gateR=1.28;
  const hole=Array.from({length:40},(_,i)=>[gateX+Math.cos(i/40*6.283185)*gateR,gateY+Math.sin(i/40*6.283185)*gateR] as [number,number]);
  this.spawn.mesh({key:'wall.moon-opening',mesh:mesh.extrude({outline:[[-5.75,.26],[5.75,.26],[5.75,3.45],[-5.75,3.45]],holes:[hole],depth:.27}),material:material.standard({baseColor:[...palette.plaster,1]}),transform:{translation:[0,0,-5.65]},castShadow:true,receiveShadow:true});
  box('plaster',[-5.66,1.84,-4.1],[.27,3.16,3.15]);box('stoneLight',[0,.39,-5.43],[11.5,.25,.34]);
  for(let i=0;i<32;i++){const a=i/32*6.283185,b=(i+1)/32*6.283185;const P=(r:number,t:number,z:number):V=>[gateX+Math.cos(t)*r,gateY+Math.sin(t)*r,z];const k=i%4===0?'stone':'stoneLight';quad(k,P(gateR,a,-5.31),P(gateR+.20,a,-5.31),P(gateR+.20,b,-5.31),P(gateR,b,-5.31));quad(k,P(gateR,a,-5.31),P(gateR,a,-5.66),P(gateR,b,-5.66),P(gateR,b,-5.31));}
  box('stoneLight',[gateX,.40,-5.2],[2.5,.18,.8]);
  for(let x=-5.8;x<5.85;x+=.31){const p:V[]=[[x,3.42,-5.94],[x,3.65,-5.53],[x,3.42,-5.13],[x+.29,3.42,-5.94],[x+.29,3.65,-5.53],[x+.29,3.42,-5.13]];quad('roof',p[0],p[3],p[4],p[1]);quad('roofLight',p[1],p[4],p[5],p[2]);tube('roofEdge',[x,3.66,-5.53],[x+.29,3.66,-5.53],.045,.045,5)}
  for(let z=-5.7;z<-2.4;z+=.32){box('roof',[-5.65,3.5,z],[.72,.15,.3],0)}
  // Pavilion stone podium and broad stairs.
  const px=-2.8,pz=-3.15;
  box('stone',[px,.4,pz],[3.7,.28,3.6]);box('stoneLight',[px,.56,pz],[3.48,.17,3.38]);
  for(let i=0;i<3;i++)box(i%2?'stone':'stoneLight',[px,.30+i*.105,-.92-i*.26],[2.08,.15,.5]);
  for(let ix=0;ix<5;ix++)for(let iz=0;iz<5;iz++)box((ix+iz)%4?'stoneLight':'stone',[px-1.38+ix*.69,.655,pz-1.32+iz*.66],[.672,.035,.645]);
  for(const x of [-1.42,1.42])for(const z of [-1.34,1.34]){const X=px+x,Z=pz+z;box('stoneLight',[X,.76,Z],[.42,.24,.42]);tube('wood',[X,.85,Z],[X,3.65,Z],.135,.12,8);box('woodLight',[X,3.37,Z],[.32,.36,.32]);}
  for(const z of [-1.34,1.34]){box('woodLight',[px,3.58,pz+z],[3.2,.24,.25]);box('woodDark',[px,3.76,pz+z],[3.35,.14,.3]);}
  for(const x of [-1.42,1.42])box('wood',[px+x,3.59,pz],[.25,.25,3.1]);
  // Repeating geometric fretwork under the eaves.
  for(let x=-1.35;x<1.4;x+=.35)for(const z of [-1.35,1.35]){box('wood',[px+x,3.31,pz+z],[.055,.25,.065]);box('woodLight',[px+x+.13,3.22,pz+z],[.28,.05,.065]);}
  const rail=(a:V,b:V)=>{for(const y of [1.02,1.48])tube('woodLight',[a[0],y,a[2]],[b[0],y,b[2]],.045,.045,4);const n=Math.ceil(Math.hypot(a[0]-b[0],a[2]-b[2])/.33);for(let i=0;i<=n;i++){const p=lerp(a,b,i/n);box('wood',[p[0],1.23,p[2]],[.055,.5,.055]);if(i<n){const q=lerp(a,b,(i+.5)/n);tube('wood',[p[0],1.2,p[2]],[q[0],1.2,q[2]],.025,.025,4);box('wood',[q[0],1.31,q[2]],[.04,.22,.04]);}}};
  rail([px-1.4,0,pz-1.34],[px+1.4,0,pz-1.34]);for(const x of [-1.4,1.4])rail([px+x,0,pz-1.34],[px+x,0,pz+1.34]);rail([px-1.4,0,pz+1.34],[px-.85,0,pz+1.34]);rail([px+.85,0,pz+1.34],[px+1.4,0,pz+1.34]);
  // Stone table and stools inside the open pavilion.
  box('stone',[px,1.06,pz],[.45,.8,.45]);box('stoneLight',[px,1.49,pz],[1.25,.15,.83]);for(const x of [-.8,.8]){tube('stoneLight',[px+x,.67,pz+.4],[px+x,1.03,pz+.4],.18,.22,6)}
  // Concave four-sided tiled roof. Each panel is an authored low-poly strip.
  const roofP=(side:number,t:number,r:number):V=>{let x=t*2.12*r,z=2.12*r;const a=side*Math.PI/2;const xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a);return [px+xx,3.88+1.67*Math.pow(1-r,2)+.42*Math.pow(Math.abs(t),8)*Math.pow(r,6),pz+zz]};
  const rings=[.015,.20,.42,.65,.83,1];for(let side=0;side<4;side++){for(let j=0;j<12;j++){const t0=-1+j/6,t1=-1+(j+1)/6;for(let k=0;k<rings.length-1;k++){quad((j+side)%4?'roof':'roofLight',roofP(side,t0,rings[k]),roofP(side,t0,rings[k+1]),roofP(side,t1,rings[k+1]),roofP(side,t1,rings[k]));}for(let k=0;k<rings.length-1;k++)tube('roofEdge',roofP(side,t0,rings[k]),roofP(side,t0,rings[k+1]),.012,.012,4)}for(let j=0;j<12;j++)tube('roofEdge',roofP(side,-1+j/6,1),roofP(side,-1+(j+1)/6,1),.065,.065,6);for(let k=0;k<rings.length-1;k++)tube('roofEdge',roofP(side,1,rings[k]),roofP(side,1,rings[k+1]),.045,.045,6);const tip=roofP(side,1,1);tube('roofEdge',tip,[tip[0]+(tip[0]-px)*.065,tip[1]+.22,tip[2]+(tip[2]-pz)*.065],.065,.035,6)}
  tube('roofEdge',[px,5.5,pz],[px,5.82,pz],.11,.10,8);tube('roofLight',[px,5.82,pz],[px,6.14,pz],.16,0,4);
  // Arched bridge, with segmented deck, a thin open parapet, and capped piers.
  const bc:V=[2.0,0,-.25],ang=.32,L=3.4,W=1.05;
  const BP=(u:number,y:number,v:number):V=>[bc[0]+u*Math.cos(ang)-v*Math.sin(ang),y,bc[2]+u*Math.sin(ang)+v*Math.cos(ang)];
  const arch=(u:number)=>.45+.58*(1-Math.pow(u/(L/2),2));
  for(let i=0;i<12;i++){const a=-L/2+i*L/12,b=a+L/12;quad('stoneLight',BP(a,arch(a),-W/2),BP(a,arch(a),W/2),BP(b,arch(b),W/2),BP(b,arch(b),-W/2));for(const s of [-1,1]){quad('stone',BP(a,arch(a)-.19,s*W/2),BP(b,arch(b)-.19,s*W/2),BP(b,arch(b),s*W/2),BP(a,arch(a),s*W/2));tube('stoneLight',BP(a,arch(a)+.57,s*W/2),BP(b,arch(b)+.57,s*W/2),.095,.095,4);tube('stone',BP(a,arch(a)+.18,s*W/2),BP(b,arch(b)+.18,s*W/2),.075,.075,4)}tube('stone',BP(a,arch(a)+.004,-W/2),BP(a,arch(a)+.004,W/2),.008,.008,4)}
  for(let i=0;i<=6;i++){const u=-L/2+i*L/6;for(const v of [-W/2,W/2]){tube('stoneLight',BP(u,arch(u)+.12,v),BP(u,arch(u)+.62,v),i%6===0?.115:.067,i%6===0?.115:.067,4);if(i%6===0)box('stoneLight',BP(u,arch(u)+.69,v),[.23,.14,.23],-ang)}}
  for(const u of [-1.85,1.85])box('stoneLight',BP(u,.35,0),[.5,.18,1.35],-ang);
  // Carefully spaced stepping stones from gate and around the pool.
  const steps:V[]=[[2.75,.30,-4.65],[2.55,.30,-3.8],[2.4,.30,-2.9],[3.9,.30,1.0],[4.4,.30,1.8],[4.35,.30,2.8],[3.95,.30,3.8],[3.25,.30,4.6],[2.15,.30,5.1],[.8,.30,5.25],[-.6,.30,5.2],[-2,.30,4.9]];for(const p of steps)rock('stoneLight',p,[.48,.065,.34],1,.30);
  // Pines frame the architecture without hiding the door or roof.
  pine(-4.95,-3.85,1.13,1);pine(5.2,-2.45,.92,-1);
  // Bamboo grove: thin jointed culms, branch sprays and lanceolate leaves.
  for(let i=0;i<21;i++){const x=-.35+rnd()*1.45,z=-4.75+rnd()*.9,h=2.7+rnd()*2.2,lean=(rnd()-.5)*.38;for(let j=0;j<7;j++){const a:V=[x+lean*j/7,.28+h*j/7,z],b:V=[x+lean*(j+1)/7,.28+h*(j+1)/7,z];tube('bamboo',a,b,.032,.027,6);tube('bambooNode',b,[b[0],b[1]+.025,b[2]],.04,.04,6);if(j>2){const sign=j%2?1:-1,end:V=[b[0]+sign*(.3+rnd()*.35),b[1]+.12,b[2]+(rnd()-.5)*.3];tube('bamboo',b,end,.013,.006,5);for(let l=0;l<5;l++){const a=lerp(b,end,.3+l*.14);leaf(l%3?'leafLight':'leafGold',a,[a[0]+sign*(.17+rnd()*.2),a[1]+(rnd()-.3)*.3,a[2]+(l%2?1:-1)*(.12+rnd()*.18)],.045)}}}}
  // Tall scholar rocks, including a genuine opening assembled from faceted pieces.
  for(const [x,z,s] of [[-4.65,-1.9,1.2],[-4.7,2.0,1.0],[4.7,-2.25,1.05]] as number[][]){rock('stone',[x-.27*s,.95*s,z],[.36*s,.93*s,.46*s],1,.3);rock('stone',[x+.34*s,.82*s,z+.04],[.33*s,.8*s,.40*s],1,.3);rock('stone',[x,1.58*s,z],[.55*s,.47*s,.4*s],1,.3);rock('stone',[x,.36,z-.1],[.62*s,.32,.48*s],1,.3)}
  for(const [x,z,s] of [[-.1,-2.7,.7],[1.0,-3.1,.55],[.8,4.0,.75],[-3.7,3.4,.6],[4.1,4.8,.4],[-.8,5.5,.4]] as number[][])rock('stone',[x,.25+s*.58,z],[s*.8,s,s*.65],1,.32);
  // Ground-cover masses reinforce the edge, leaving generous quiet sand paths.
  const shrubs=[[-5.1,-.6],[-5.2,1.0],[-4.3,-2.8],[-3.9,-4.8],[-1.1,-4.6],[-.8,-2.4],[.9,-2.5],[1.2,-4.9],[4.8,-1.5],[5.0,-4.7],[4.0,-4.9],[4.7,.1],[4.9,3.7],[2.7,4.6],[1.1,4.4],[-.2,5.5],[-2.7,4.2],[-4.6,3.0],[-5.0,4.7],[-4.8,-4.8]];for(const [x,z]of shrubs)shrub(x,z,.4+rnd()*.25);
  for(let i=0;i<pond.length;i++){const p=pond[i],d=norm([p[0]+.45,0,p[2]-1.4]);for(let j=0;j<3;j++)grass(p[0]+d[0]*(.35+rnd()*.3)+(rnd()-.5)*.5,p[2]+d[2]*(.35+rnd()*.3)+(rnd()-.5)*.5,.22+rnd()*.14)}
  for(const [x,z] of [[-3.7,-.3],[1.2,-.85],[1.9,4.1]]){tube('bark',[x,.25,z],[x,.9,z],.035,.016,5);for(let j=0;j<7;j++){const a=j*2.4;const p:V=[x+Math.cos(a)*.3,.65+rnd()*.35,z+Math.sin(a)*.3];tube('bark',[x,.55,z],p,.012,.005,4);for(let k=0;k<3;k++)leaf('ochre',p,[p[0]+(rnd()-.5)*.3,p[1]+.03,p[2]+(rnd()-.5)*.3],.06)}}
  for(const [x,z,s,f] of [[-2.8,1.1,.34,1],[-2.1,1.6,.33,0],[-2.6,2.1,.34,1],[-1.7,2.45,.33,0],[-3.3,1.65,.3,0],[-1.9,.8,.25,0],[1.1,3.3,.32,1],[1.7,3.4,.28,0],[.6,3.7,.30,0]] as number[][])lotus(x,z,s,!!f);
  // Small ripples and restrained faceted color in the jade water.
  for(let i=0;i<34;i++){const x=-2.8+rnd()*5,z=.2+rnd()*3.1;const w=.1+rnd()*.28;quad(i%4?'waterLight':'waterDark',[x,.184,z],[x-.025,.184,z+.015],[x+w*.85,.184,z+.035],[x+w,.184,z+.02])}
  for(const [k,positions] of buckets){const c=palette[k];this.spawn.mesh({key:'garden.'+k,mesh:mesh.triangleList({positions,label:k}),material:material.standard({baseColor:[...c,1],roughness:k.startsWith('water')?.24:.88,metallic:k.startsWith('water')?.12:0}),castShadow:!k.startsWith('water')&&k!=='background',receiveShadow:true})}
 }
}
