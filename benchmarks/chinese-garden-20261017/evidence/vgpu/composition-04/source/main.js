import {init,geometry,draw,frame,surface,target} from 'vgpu';
import {group,orthographic,viewMatrices,multiplyMatrices} from 'vgpu/scene';
import shader from './scene.wgsl';
import shadowShader from './shadow.wgsl';
import reflectionShader from './reflection.wgsl';
let seed=24017;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}function rr(a,b){return a+(b-a)*rnd();}
const V=[],W=[];let dest=V;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/Math.hypot(...a));
function col(h,v=1){return [0,2,4].map(i=>Math.pow(parseInt(h.slice(i,i+2),16)/255,2.2)*v)}
const C={sand:col('d8c6a4'),stone:col('b6b2a5'),pale:col('d6cdb7'),wall:col('e4d8bb'),roof:col('626772'),wood:col('8d4d2e'),green:col('717e3d'),darkgreen:col('788553'),bark:col('66513a')};
function tri(a,b,c,color,mat=0){let n=norm(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])dest.push(...p,...n,...color,mat);}
function quad(a,b,c,d,color,mat=0){tri(a,b,c,color,mat);tri(a,c,d,color,mat);}
function box(p,s,color){const [x,y,z]=p,[a,b,c]=s.map(v=>v/2);let q=[[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y+b,z-c],[x-a,y+b,z-c],[x-a,y-b,z+c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x-a,y+b,z+c]];for(let f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(...f.map(i=>q[i]),color);}
function beam(a,b,r,color,r2=r,n=7){let d=norm(sub(b,a)),u=norm(cross(d,Math.abs(d[1])>.95?[1,0,0]:[0,1,0])),v=cross(d,u);let A=[],B=[];for(let i=0;i<n;i++){let t=i/n*Math.PI*2,off=add(mul(u,Math.cos(t)),mul(v,Math.sin(t)));A.push(add(a,mul(off,r)));B.push(add(b,mul(off,r2)));}for(let i=0;i<n;i++){let j=(i+1)%n;quad(A[i],A[j],B[j],B[i],color);tri(a,A[j],A[i],color);tri(b,B[i],B[j],color);}}
function rock(p,s,color=C.stone,n=7){let rings=[];for(let j=0;j<4;j++){let yy=[-.48,-.22,.25,.5][j],rad=[.65,1,.82,.36][j];let ring=[];for(let i=0;i<n;i++){let t=i/n*Math.PI*2+.19*j;let r=rad*rr(.87,1.13);ring.push([p[0]+Math.cos(t)*s[0]*r*.5,p[1]+(yy+rr(-.07,.07))*s[1],p[2]+Math.sin(t)*s[2]*r*.5]);}rings.push(ring);}for(let j=0;j<3;j++)for(let i=0;i<n;i++){let k=(i+1)%n;let co=mul(color,rr(.82,1.12));tri(rings[j][i],rings[j][k],rings[j+1][i],co);tri(rings[j][k],rings[j+1][k],rings[j+1][i],co);}for(let i=0;i<n;i++)tri(rings[3][i],rings[3][(i+1)%n],[p[0],p[1]+s[1]*.53,p[2]],mul(color,rr(.9,1.1)));}
function leaf(a,b,w,c){let d=sub(b,a),side=mul(norm(cross(d,[0,1,0])),w);let mid=add(a,mul(d,.52));tri(a,add(mid,side),b,c);tri(a,b,sub(mid,side),mul(c,.8));}
function shrub(x,z,s=.45){for(let j=0;j<6;j++){let a=j/6*6.28,r=rr(.08,.3)*s/.45;rock([x+Math.cos(a)*r,.16+rr(.16,.32)*s/.45,z+Math.sin(a)*r],[s*rr(.65,1),s*rr(.6,.95),s*rr(.65,1)],mul(C.green,rr(.6,1.1)),5);}}
function tuft(x,z,s=.25){for(let j=0;j<7;j++){let a=rr(0,6.28);leaf([x,.07,z],[x+Math.cos(a)*s*.6,rr(.16,.38),z+Math.sin(a)*s*.6],.025,mul(C.green,rr(.7,1.3)));}}
// raised square foundation and warm surroundings
box([0,-.49,0],[200,.1,200],col('e1d6c6'));
box([0,-.24,0],[11.3,.48,10.4],C.pale);box([0,.015,0],[11.08,.08,10.18],C.sand);
for(let x=-5.4;x<5.5;x+=.68){box([x,-.21,5.2],[.65,.45,.11],mul(C.pale,rr(.9,1.05)));box([x,-.21,-5.2],[.65,.45,.11],C.pale);}
for(let z=-4.85;z<5.1;z+=.68){box([5.65,-.21,z],[.1,.45,.65],mul(C.pale,rr(.9,1.05)));box([-5.65,-.21,z],[.1,.45,.65],C.pale);}
// jade pond silhouette, with a hand-shaped scalloped shore
let pond=[];for(let i=0;i<40;i++){let t=i/40*Math.PI*2;let r=1+.055*Math.sin(3*t)+.035*Math.cos(7*t);let x=-.15+3.85*r*Math.cos(t),z=1.20+2.91*r*Math.sin(t);if(x< -1.75&&z<1.35)x=-1.75;pond.push([x,.105,z]);}
dest=W;for(let i=0;i<pond.length;i++)tri([-.15,.105,1.2],pond[(i+1)%pond.length],pond[i],col('669a83'),1);dest=V;
for(let i=0;i<40;i++){let p=pond[i];if(p[0]>2.2&&p[2]<1.6&&p[2]>-1.3)continue;rock([p[0],.19,p[2]],[rr(.48,.9),rr(.3,.63),rr(.5,.88)],mul(C.stone,rr(.86,1.1)));if(i%3===0)shrub(p[0]*1.06,p[2]*1.07,.37);}
// back wall with a real circular aperture
const gateX=2.5,gateY=1.16,R=1.07,zWall=-4.52,H=2.65;
box([-1.9,H/2,zWall],[6.66,H,.27],C.wall);box([4.65,H/2,zWall],[1.68,H,.27],C.wall);
const N=32;for(let i=0;i<N;i++){let a=i/N*2*Math.PI,b=(i+1)/N*2*Math.PI;let p=[gateX+R*Math.cos(a),gateY+R*Math.sin(a)],q=[gateX+R*Math.cos(b),gateY+R*Math.sin(b)];let outer=(t)=>{let dx=Math.cos(t),dy=Math.sin(t);let scale=Math.min(1.35/Math.max(Math.abs(dx),.0001),(dy>0?H-gateY:gateY)/Math.max(Math.abs(dy),.0001));return [gateX+dx*scale,gateY+dy*scale];};let u=outer(a),v=outer(b);for(let z of [zWall-.14,zWall+.14])quad([p[0],p[1],z],[q[0],q[1],z],[v[0],v[1],z],[u[0],u[1],z],C.wall);let r2=R+.15,pa=[gateX+r2*Math.cos(a),gateY+r2*Math.sin(a)],pb=[gateX+r2*Math.cos(b),gateY+r2*Math.sin(b)];quad([p[0],p[1],zWall+.18],[pa[0],pa[1],zWall+.18],[pb[0],pb[1],zWall+.18],[q[0],q[1],zWall+.18],mul(C.pale,rr(.82,1.02)));quad([p[0],p[1],zWall-.16],[p[0],p[1],zWall+.18],[q[0],q[1],zWall+.18],[q[0],q[1],zWall-.16],C.stone);}
box([0,2.68,zWall],[11.05,.12,.47],C.roof);for(let x=-5.45;x<5.5;x+=.23){beam([x,2.77,zWall-.27],[x,2.77,zWall+.27],.10,mul(C.roof,rr(.85,1.18)),.10,5);}
box([-5.3,1.15,-1.5],[.25,2.3,6],C.wall);box([-5.3,2.32,-1.5],[.5,.16,6.1],C.roof);for(let z=-4.5;z<1.5;z+=.24)beam([-5.56,2.41,z],[-5.04,2.41,z],.1,C.roof,.1,5);
// pavilion plinth, stairs, posts and intricately open timber rails
const pavilionStart=V.length;const PX=-3.65,PZ=-.5;box([PX,.18,PZ],[3.4,.34,3.25],C.pale);box([PX,.4,PZ],[3.1,.15,2.96],C.stone);box([PX,.5,PZ],[2.95,.12,2.8],C.pale);
for(let j=0;j<3;j++)box([PX,.10+j*.11,PZ+1.88-j*.22],[1.85,.2+j*.09,.5],mul(C.pale,.93+j*.025));
for(let x of [-1.2,1.2])for(let z of [-1.08,1.08]){box([PX+x,.6,PZ+z],[.35,.2,.35],C.pale);box([PX+x,1.75,PZ+z],[.19,2.3,.19],C.wood);box([PX+x,2.85,PZ+z],[.38,.2,.38],C.wood);}
for(let x of [-1.22,1.22]){box([PX+x,2.87,PZ],[.19,.24,2.62],C.wood);box([PX+x,.89,PZ],[.11,.1,2.4],C.wood);box([PX+x,1.22,PZ],[.13,.11,2.4],C.wood);for(let z=-1.05;z<1.15;z+=.35){box([PX+x,1.05,PZ+z],[.08,.33,.07],C.wood);box([PX+x,1.09,PZ+z+.1],[.08,.06,.22],C.wood);}}
for(let z of [-1.1,1.1]){box([PX,2.87,PZ+z],[2.65,.24,.2],C.wood);for(let x=-1.1;x<1.2;x+=.28){box([PX+x,2.66,PZ+z],[.05,.3,.06],C.wood);box([PX+x+.09,2.59,PZ+z],[.23,.055,.06],C.wood);}}
box([PX,1.0,PZ-.15],[.78,.1,.62],C.pale);box([PX,.77,PZ-.15],[.26,.47,.26],C.stone);for(let x of [-.72,.72])box([PX+x,.7,PZ-.15],[.38,.3,.38],C.pale);
// compound curved hip roof, radial panels and upturned corner ridges
const roofR=2.03,roofY=2.98,peak=4.35;function roofPoint(side,u,t){let x,z;if(side===0){x=-1+2*u;z=1;}if(side===1){x=1;z=1-2*u;}if(side===2){x=1-2*u;z=-1;}if(side===3){x=-1;z=-1+2*u;}let corner=Math.pow(Math.max(Math.abs(x),Math.abs(z))*Math.min(Math.abs(x),Math.abs(z)),5);let y=peak-(peak-roofY)*Math.pow(t,.57)+.30*Math.pow(t,8)*corner;return [PX+x*roofR*t,y,PZ+z*roofR*t];}
for(let s=0;s<4;s++)for(let j=0;j<9;j++)for(let k=0;k<7;k++){let a=j/9,b=(j+1)/9,t=k/7,u=(k+1)/7;quad(roofPoint(s,a,t),roofPoint(s,b,t),roofPoint(s,b,u),roofPoint(s,a,u),mul(C.roof,rr(.92,1.08)));}
for(let s=0;s<4;s++){for(let j=0;j<9;j++){let a=j/9;for(let k=1;k<7;k++){let p=roofPoint(s,a,k/7),q=roofPoint(s,a,(k+1)/7);p[1]+=.013;q[1]+=.013;beam(p,q,.012,mul(C.roof,.73),.012,4);}}for(let j=0;j<12;j++){let p=roofPoint(s,j/12,1),q=roofPoint(s,(j+1)/12,1);beam(p,q,.052,mul(C.roof,1.12),.052,5);}for(let k=0;k<7;k++){let p=roofPoint(s,0,k/7),q=roofPoint(s,0,(k+1)/7);p[1]+=.035;q[1]+=.035;beam(p,q,.045,mul(C.roof,1.22),.05,5);}let p=roofPoint(s,0,1);beam(p,[p[0]+(p[0]-PX)*.07,p[1]+.31,p[2]+(p[2]-PZ)*.07],.048,C.roof,.018,5);}
beam([PX,4.32,PZ],[PX,4.68,PZ],.11,C.roof,.08,6);beam([PX,4.67,PZ],[PX,5.0,PZ],.14,mul(C.roof,1.15),0,5);
for(let i=pavilionStart;i<V.length;i+=10){let x=V[i]-PX,z=V[i+2]-PZ,nx=V[i+3],nz=V[i+5];V[i]=PX+z;V[i+2]=PZ-x;V[i+3]=nz;V[i+5]=-nx;}
// arched bridge, individually stepped deck stones, two pierced stone balustrades
const bx=2.58,bz=-.05,L=2.8;function by(z){let t=z/(L/2);return .25+.53*(1-t*t);}
for(let i=0;i<14;i++){let z1=-L/2+i*L/14,z2=z1+L/14,y1=by(z1),y2=by(z2);quad([bx-.63,y1,bz+z1],[bx+.63,y1,bz+z1],[bx+.63,y2,bz+z2],[bx-.63,y2,bz+z2],mul(C.pale,rr(.9,1.04)));for(let x of [bx-.64,bx+.64])quad([x,y1-.23,bz+z1],[x,y2-.23,bz+z2],[x,y2,bz+z2],[x,y1,bz+z1],C.stone);beam([bx-.62,y1+.005,bz+z1],[bx+.62,y1+.005,bz+z1],.009,mul(C.stone,.7),.009,4);}
for(let side of [-1,1]){let x=bx+side*.66;for(let j=0;j<6;j++){let z=-L/2+j*L/5,y=by(z);box([x,y+.36,bz+z],[.17,.72,.17],C.pale);box([x,y+.75,bz+z],[.23,.09,.23],C.pale);}for(let j=0;j<20;j++){let z=-L/2+j*L/20,q=z+L/20;beam([x,by(z)+.68,bz+z],[x,by(q)+.68,bz+q],.085,C.pale,.085,4);beam([x,by(z)+.17,bz+z],[x,by(q)+.17,bz+q],.075,C.pale,.075,4);}for(let j=0;j<10;j++){let z=-L/2+(j+.5)*L/10;box([x,by(z)+.43,bz+z],[.1,.39,.09],C.pale);}}
for(let z of [-1,1])box([bx,.13,bz+z*1.58],[1.5,.22,.35],C.pale);
// winding stepping stones through gate, along right and front shore
for(let p of [[2.5,-4.75],[2.5,-4.1],[2.55,-3.4],[2.6,-2.7],[2.65,-2.0],[2.7,1.95],[3.3,2.7],[3.6,3.5],[3.0,4.35],[1.8,4.5],[.5,4.56],[-.8,4.5],[-2,4.24],[-3.25,3.75]])rock([p[0],.10,p[1]],[rr(.63,.88),.13,rr(.5,.72)],mul(C.pale,rr(.9,1.02)),6);
// twisted pines with layered broad, faceted cloud foliage
function pine(x,z,h,flip=1){let points=[[x,.08,z],[x+.18*flip,h*.27,z-.04],[x-.22*flip,h*.49,z+.05],[x+.12*flip,h*.70,z-.09],[x+.28*flip,h*.88,z-.12]];for(let i=0;i<4;i++)beam(points[i],points[i+1],.24-i*.035,C.bark,.20-i*.035,6);const branches=[[-1.15,.56,.12],[.92,.69,.02],[-.5,.85,-.16],[.54,.95,.04],[-1.45,.73,.1],[1.0,.87,-.12]];for(let [dx,yy,dz] of branches){let start=points[yy>.7?3:2],end=[x+dx*flip,h*yy,z+dz];beam(start,end,.10,C.bark,.035,6);for(let j=0;j<5;j++){let a=j*2.4;let p=[end[0]+Math.cos(a)*.42,h*yy+rr(-.08,.16),end[2]+Math.sin(a)*.39];rock(p,[rr(.72,1.04),rr(.36,.55),rr(.64,.92)],mul(C.darkgreen,rr(.8,1.3)),6);}}}
pine(-4.65,.70,5.2,1);pine(4.44,-3.55,3.9,-1);
// bamboo grove behind the pond, slender jointed stems and lance leaves
for(let i=0;i<18;i++){let x=rr(-.05,1.08),z=rr(-4.05,-3.08),h=rr(2.8,4.35),dx=rr(-.2,.24);for(let j=0;j<9;j++){let y=j*h/9,q=(j+1)*h/9;beam([x+dx*j/9,y,z],[x+dx*(j+1)/9,q,z],.029,col('68773b'),.025,6);beam([x+dx*j/9,y,z],[x+dx*j/9,y+.035,z],.037,col('a2a05b'),.037,6);}for(let k=0;k<5;k++){let y=h*.48+k*h*.1,a=rr(0,6.28),end=[x+Math.cos(a)*.43,y+.22,z+Math.sin(a)*.43];beam([x,y,z],end,.012,C.green,.007,4);for(let j=0;j<4;j++){let b=add(end,[rr(-.40,.40),rr(.02,.22),rr(-.4,.4)]);leaf(end,b,.045,mul(C.green,rr(.8,1.3)));}}}
// scholar stones: stacked irregular pillars with a visible hole formed by stone lobes
function scholar(x,z,s=1){let outer=[],inner=[],back=[];const n=12;for(let i=0;i<n;i++){let a=i/n*Math.PI*2,r=rr(.86,1.10);outer.push([x+Math.cos(a)*.59*s*r,(.99+Math.sin(a)*.96*r)*s,z+rr(-.06,.06)]);inner.push([x+Math.cos(a)*.19*s,(.77+Math.sin(a)*.28)*s,z+.20*s]);back.push([x+Math.cos(a)*.20*s,(.77+Math.sin(a)*.29)*s,z-.23*s]);}for(let i=0;i<n;i++){let j=(i+1)%n,co=mul(C.stone,rr(.85,1.15)),o=outer[i],q=outer[j],ob=[o[0],o[1],z-.28*s],qb=[q[0],q[1],z-.28*s];quad(o,q,inner[j],inner[i],co);quad(ob,back[i],back[j],qb,mul(co,.9));quad(inner[i],inner[j],back[j],back[i],mul(co,.75));quad(o,ob,qb,q,co);}rock([x-.24*s,.22*s,z+.05],[.65*s,.45*s,.75*s],C.stone);rock([x+.36*s,.28*s,z-.04],[.5*s,.62*s,.65*s],C.stone);}

scholar(-4.1,3.2,1.05);scholar(-5.0,1.38,.8);scholar(4.35,-1.7,.92);rock([1.3,.52,-2.66],[1.0,1.06,.8]);rock([1.4,.45,3.65],[.85,.9,.7]);
// bank planting, ground grass and tiny warm red maples
for(let i=0;i<86;i++){let x=rr(-5.2,5.2),z=rr(-4.3,4.8),pondTest=((x+.7)/4.14)**2+((z-.9)/3.4)**2;if(pondTest<1.03||Math.abs(x-bx)<.9&&z<2.2||x<-1.6&&z<1.4&&z>-2.5)continue;shrub(x,z,rr(.22,.48));}
for(let i=0;i<140;i++){let x=rr(-5.35,5.3),z=rr(-4.35,4.9);if(((x+.7)/4.12)**2+((z-.9)/3.45)**2>1.02)tuft(x,z);}
for(let [x,z] of [[-3.7,-.6],[.7,-1.7],[2.0,3.7]]){beam([x,.1,z],[x,.77,z],.025,C.wood,.013,5);for(let j=0;j<12;j++){let a=rr(0,6.28),r=rr(.1,.37);let p=[x+r*Math.cos(a),rr(.5,.9),z+r*Math.sin(a)];beam([x,.45,z],p,.012,C.wood,.005,4);for(let k=0;k<3;k++)leaf(p,add(p,[rr(-.16,.16),rr(-.04,.07),rr(-.16,.16)]),.09,col('b46f43',rr(.85,1.1)));}}

// compact groundcover beds and clustered perimeter planting
for(let i=0;i<62;i++){let t=i/62*Math.PI*2;let r=1.07+rr(0,.035),x=-.15+3.85*r*Math.cos(t),z=1.2+2.91*r*Math.sin(t);if(x<-1.7&&z<1.4)continue;if(x>2&&z<2&&z>-2)continue;shrub(x,z,rr(.24,.48));if(i%2===0)tuft(x,z,.3);}
for(let i=0;i<38;i++){let x=rr(-5,5.1),z=rr(-4.30,-3.65);if(x>1.35&&x<3.65)continue;if(x<-1.1&&x>-4.15)continue;shrub(x,z,rr(.30,.55));}

shrub(2.1,-4.98,.35);shrub(2.9,-4.98,.32);
// lotus pads and pale apricot blossoms
function pad(x,z,r){let center=[x,.13,z];for(let i=0;i<13;i++){let a=.12+i/14*6.0,b=.12+(i+1)/14*6.0;tri(center,[x+Math.cos(b)*r,.13,z+Math.sin(b)*r],[x+Math.cos(a)*r,.13,z+Math.sin(a)*r],col('8da852',rr(.9,1.05)));}}
for(let [x,z] of [[-2.8,1.2],[-2.2,1.4],[-2.5,2],[-1.7,1.9],[-2.9,.6],[-1.8,2.55],[-1.3,2.2],[.7,2.8],[1.2,2.9],[.9,3.15]])pad(x,z,rr(.19,.3));
for(let [x,z] of [[-2.5,1.17],[-1.9,1.95],[.8,2.8]]){beam([x,.11,z],[x,.34,z],.014,C.green,.012,5);for(let ring=0;ring<2;ring++)for(let i=0;i<8;i++){let a=i/8*6.28+ring*.3;let end=[x+Math.cos(a)*(.22-ring*.07),.39+ring*.14,z+Math.sin(a)*(.22-ring*.07)];leaf([x,.29,z],end,.075,col(ring?'f6c28c':'e6a398'));}rock([x,.38,z],[.11,.10,.11],col('e8bc58'),6);}
function cameraVP(eye,look,width,height){const node=group({position:eye}).lookAt(look);const mats={view:new Float32Array(16),viewProjection:new Float32Array(16)};viewMatrices({position:new Float32Array(eye),quaternion:new Float32Array(node.quaternion)},orthographic({left:-width/2,right:width/2,bottom:-height/2,top:height/2,near:.1,far:100},new Float32Array(16)),mats);return mats.viewProjection;}
async function main(){const gpu=await init();gpu.onError(error=>{console.error(error);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(error)}});const canvas=document.querySelector('canvas');const screen=surface(gpu,canvas,{depth:true,msaa:true});const reflection=target(gpu,{size:[1200,900],format:'rgba8unorm',depth:true});const shadow=target(gpu,{size:[2048,2048],format:'rgba16float',depth:true});const mesh=data=>geometry(gpu,{buffers:[{attributes:{position:'float32x3',normal:'float32x3',color:'float32x4'},data:new Float32Array(data)}],vertexCount:data.length/10});const solid=mesh(V),water=mesh(W);const eye=[17,14,12],vp=cameraVP(eye,[0,1.3,0],16.9,12.675),lightVP=cameraVP([-10,20,9],[0,0,0],20,20);const shadowDraw=draw(gpu,{shader:shadowShader,geometry:solid});shadowDraw.set({camera:{vp:lightVP}});const reflectVP=multiplyMatrices(vp,new Float32Array([1,0,0,0,0,-1,0,0,0,0,1,0,0,.21,0,1]),new Float32Array(16));const reflectedDraw=draw(gpu,{shader:reflectionShader,geometry:solid});reflectedDraw.set({camera:{vp:reflectVP,lightVP,eye},shadowMap:shadow});const sceneDraw=draw(gpu,{shader,geometry:solid}),waterDraw=draw(gpu,{shader,geometry:water});for(let d of [sceneDraw,waterDraw])d.set({camera:{vp,lightVP,eye},shadowMap:shadow,reflectionMap:reflection});frame(gpu,f=>{f.pass({target:shadow,clear:[1,1,1,1]},p=>p.draw(shadowDraw));f.pass({target:reflection,clear:[.70,.75,.68,1]},p=>p.draw(reflectedDraw));f.pass({target:screen,clear:[.86,.825,.77,1]},p=>{p.draw(sceneDraw);p.draw(waterDraw);});});await gpu.settled();await gpu.gpu.queue.onSubmittedWorkDone();globalThis.__APERTURE_RENDER_STATUS__={ok:true};}
main().catch(error=>{console.error(error);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(error)}});
