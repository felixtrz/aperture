import shadowShader from './shadow.wgsl';
import sceneShader from './scene.wgsl';
import { init, geometry, draw, frame, surface, target } from 'vgpu';
import { mat4 } from 'wgpu-matrix';

// One authored triangle stream, two native vGPU passes: sun depth, then lit scene.
const vertices=[];
const C={cream:'#dfbd92',trim:'#efcfaa',stone:'#d8cbb6',pave:'#d4c8b4',road:'#575554',edge:'#a99c89',green:'#929971',darkGreen:'#3e503b',teal:'#254a47',glass:'#345355',wood:'#a76e39',leaf:'#778b32',iron:'#303b39',gold:'#eabf69',blue:'#6094af',yellow:'#e7ad3b'};
const color=h=>{if(Array.isArray(h))return h; h=C[h]||h;return [parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]};
let seed=91373;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const norm=a=>{let l=Math.hypot(...a);return a.map(x=>x/l)};
function tri(a,b,c,col){let n=norm(cross(sub(b,a),sub(c,a))),k=color(col);for(let p of [a,b,c])vertices.push(...p,...n,...k);}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col)}
function box(x,y,z,w,h,d,col,ry=0){let co=Math.cos(ry),si=Math.sin(ry);let v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>[x+p[0]*w*.5*co+p[2]*d*.5*si,y+p[1]*h*.5,z-p[0]*w*.5*si+p[2]*d*.5*co]);for(let f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(...f.map(i=>v[i]),col)}
function cylinder(x,y,z,r,h,col,n=10,rt=r){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;let a0=[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],b0=[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r],a1=[x+Math.cos(a)*rt,y+h/2,z+Math.sin(a)*rt],b1=[x+Math.cos(b)*rt,y+h/2,z+Math.sin(b)*rt];quad(a0,a1,b1,b0,col);tri([x,y+h/2,z],b1,a1,col);tri([x,y-h/2,z],a0,b0,col)}}
function branch(a,b,r,col,n=7){const dir=norm(sub(b,a)),u=norm(cross(dir,Math.abs(dir[1])>.9?[1,0,0]:[0,1,0])),v=cross(dir,u);for(let i=0;i<n;i++){let ang=i*6.283/n,ang2=(i+1)*6.283/n;const p=(q,s,aa)=>q.map((e,j)=>e+(u[j]*Math.cos(aa)+v[j]*Math.sin(aa))*s);quad(p(a,r,ang),p(b,r*.75,ang),p(b,r*.75,ang2),p(a,r,ang2),col);tri(a,p(a,r,ang2),p(a,r,ang),col);tri(b,p(b,r*.75,ang),p(b,r*.75,ang2),col)}}
function poly(x,y,z,rx,ry,rz,col){const rings=5,segments=9;let rows=[];for(let j=0;j<=rings;j++){let phi=Math.PI*j/rings;let row=[];for(let i=0;i<segments;i++){let a=2*Math.PI*i/segments+(j%2)*.27;let rr=j===0||j===rings?1:.88+rnd()*.2;row.push([x+rx*Math.sin(phi)*Math.cos(a)*rr,y+ry*Math.cos(phi)*rr,z+rz*Math.sin(phi)*Math.sin(a)*rr])}rows.push(row)}for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){let k=(i+1)%segments,c=color(col).map(v=>Math.min(1,v*(.88+rnd()*.24)));tri(rows[j][i],rows[j+1][k],rows[j+1][i],c);tri(rows[j][i],rows[j][k],rows[j+1][k],c)}}
function faceBox(side,t,y,depth,w,h,d,col){if(side==='front')box(t,y,2.5+depth,w,h,d,col);else box(depth,y,t,d,h,w,col)}
function windowUnit(side,t,y,w=0.82,h=1.2,shop=false){const dep=.035;faceBox(side,t,y,dep,w+.19,h+.19,.09,'trim');faceBox(side,t,y,dep+.065,w,h,.08,'teal');faceBox(side,t,y,dep+.112,w-.13,h-.13,.025,shop?'#9f8651':'glass');
 // Simple warm interior slivers and dark reflected panes.
 faceBox(side,t-w*.17,y+.08,dep+.13,w*.24,h-.24,.024,'#59695b');faceBox(side,t+w*.23,y-.03,dep+.131,w*.17,h-.24,.025,'#9a8961');
 for(let dt of [-w/2,w/2,0])faceBox(side,t+dt,y,dep+.16,.052,h+.03,.058,'teal');for(let dy of [-h/2,h/2,.08])faceBox(side,t,y+dy,dep+.17,w+.05,.055,.055,'teal');faceBox(side,t,y-h/2-.09,dep+.17,w+.22,.11,.22,'trim');
 if(shop){for(let i=0;i<5;i++)faceBox(side,t-w*.35+i*w*.16,y-h*.21,dep+.143,.08,.26,.025,['#bd8b42','#53736b','#896642'][i%3]);}}
function awning(side,start,end){let count=Math.round((end-start)/.31);for(let i=0;i<count;i++){let t0=start+i*(end-start)/count,t1=start+(i+1)*(end-start)/count;let col=i%2?'#f6d6ae':'#b95841';let p=(t,y,d)=>side==='front'?[t,y,2.5+d]:[d,y,t];quad(p(t0,2.72,.10),p(t0,2.25,.75),p(t1,2.25,.75),p(t1,2.72,.10),col);quad(p(t0,2.25,.75),p(t0,2.03,.75),p(t1,2.03,.75),p(t1,2.25,.75),col)}}
const glyphs={C:['01110','11001','10000','10000','10000','11001','01110'],A:['00100','01110','11011','10001','11111','10001','10001'],F:['11111','10000','10000','11110','10000','10000','10000'],E:['11111','10000','10000','11110','10000','10000','11111'],B:['11110','10001','10001','11110','10001','10001','11110'],O:['01110','10001','10001','10001','10001','10001','01110'],K:['10001','10010','10100','11000','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110']};
function textSign(txt,side,center,y,d,size){let total=(txt.length*6-1)*size;for(let k=0;k<txt.length;k++){let g=glyphs[txt[k]];for(let j=0;j<7;j++)for(let i=0;i<5;i++)if(g[j][i]==='1'){let t=center+(side==='front'?1:-1)*(-total/2+(k*6+i+.5)*size);faceBox(side,t,y+(3-j)*size,d-.022,size*1.25,size*1.25,.04,'#756a52');faceBox(side,t,y+(3-j)*size,d,size*.97,size*.97,.03,'#f5dfb0')}}}

// Floating square block and L-shaped streets.
box(0,.05,0,12.8,.65,12.8,'edge');box(0,.39,0,12.7,.07,12.7,'road');box(-2.15,.50,-1.35,8.45,.24,10,'pave');
// Individual paving joints, kept restrained.
for(let x=-6.1;x<2.05;x+=.7)box(x,.627,-1.35,.016,.008,9.8,'#b8ae9d');for(let z=-6.1;z<3.68;z+=.7)box(-2.15,.628,z,8.3,.008,.016,'#b8ae9d');
for(let x=-6.05;x<2.1;x+=.65)box(x,.56,3.7,.63,.28,.22,'stone');for(let z=-6.05;z<3.65;z+=.65)box(2.12,.56,z,.22,.28,.63,'stone');
for(let x=-5.3;x<5.8;x+=1.6)box(x,.435,5.05,.77,.012,.10,'#e1cdaa');for(let z=-5.1;z<5.9;z+=1.6)box(4.45,.436,z,.10,.012,.77,'#e1cdaa');
for(let x=2.5;x<6.1;x+=.63)box(x,.444,2.25,.36,.012,1.62,'#eee0c6');
// Cream corner building.
box(-2,3.91,.5,4,6.56,4,'cream');
for(let y of [.78,2.85,4.70,6.93]){box(-2,y,.5,4.15,.16,4.15,'trim');box(-2,y+.10,.5,4.04,.06,4.04,'#c7a47f')}
box(-2,7.16,.5,4.28,.22,4.28,'trim');box(-2,7.29,.5,4.1,.10,4.1,'#ae9f8b');
for(let x of [-4.04,.04])box(x,7.43,.5,.12,.28,4.2,'trim');for(let z of [-1.56,2.56])box(-2,7.43,z,4.2,.28,.12,'trim');
box(-2.9,7.85,-.65,.62,1.05,.62,'cream');box(-2.9,8.39,-.65,.76,.13,.76,'trim');cylinder(-2.9,8.51,-.65,.10,.18,'#676663');box(-1.5,7.58,.55,.9,.48,.8,'#aaa18f');
for(let y of [3.78,5.73])for(let t of [-3.13,-1.04])windowUnit('front',t,y,.81,1.22,true);
for(let y of [3.78,5.73])for(let t of [-.58,1.55])windowUnit('side',t,y,.81,1.22,true);
// Sparse dressed corner stones.
for(let y=.95;y<6.85;y+=.38)for(let [x,z]of[[-3.94,2.51],[-.06,2.51]])box(x,y,z,.24,.23,.10,y%1<.5?'#c9a582':'#d5b390');
for(let y=.95;y<6.85;y+=.38)box(.035,y,2.37,.10,.23,.25,'#d0ac87');
// Cafe ground floor glazing, panelled teal bases and doors.
function storefront(side,start,end){let center=(start+end)/2,w=end-start;faceBox(side,center,1.52,.065,w,1.72,.12,'teal');faceBox(side,center,1.60,.14,w-.15,1.38,.035,'#a77e40');for(let t=start+.12;t<end;t+=.67){faceBox(side,t,1.56,.22,.075,1.75,.13,'teal');faceBox(side,t+.26,1.45,.185,.38,.55,.03,'#bd9555');}faceBox(side,center,.88,.245,w,.36,.16,'teal');faceBox(side,center,2.36,.24,w,.12,.16,'teal');for(let t=start+.4;t<end;t+=1.1){faceBox(side,t,1.15,.21,.51,.06,.12,'wood');faceBox(side,t,1.01,.21,.05,.3,.08,'wood');} }
storefront('front',-3.62,-.38);storefront('side',-1.18,2.14);
faceBox('front',-2,2.99,.12,3.4,.35,.08,'cream');textSign('CAFE','front',-2,3.02,.19,.058);awning('front',-3.91,-.10);awning('side',-1.41,2.40);
// Bookshop, two storeys, adjoining on the far side of the cafe.
box(-1.7,2.96,-3.62,3.4,4.66,4.24,'green');
box(-1.7,5.31,-3.62,3.64,.18,4.45,'trim');box(-1.7,5.39,-3.62,3.45,.06,4.25,'#8d8980');
for(let x of [-3.46,.06])box(x,5.48,-3.62,.12,.20,4.4,'stone');for(let z of [-5.80,-1.44])box(-1.70,5.48,z,3.6,.20,.12,'stone');
box(-1.5,5.75,-4.28,.83,.69,.82,'#8d8b80');box(-1.5,6.12,-4.28,.92,.07,.91,'#ada89b');cylinder(-.70,5.69,-5.04,.09,.47,'#535751');cylinder(-.70,5.94,-5.04,.14,.08,'#aaa89d');
for(let t of [-4.97,-3.60,-2.23])windowUnit('side',t,4.10,.73,1.26,true);
for(let y=2.9;y<5.15;y+=.34)for(let z=-5.6;z<-1.7;z+=.65)box(.012,y,z,.012,.012,.58,'#7e8765');
faceBox('side',-3.62,1.47,.07,4.12,1.70,.15,'darkGreen');faceBox('side',-3.94,1.54,.17,2.82,1.44,.04,'#ad8c45');
for(let t=-5.27;t<-2.58;t+=.38){faceBox('side',t,1.58,.21,.045,1.40,.045,'wood');for(let y of [1.10,1.55,2.0]){faceBox('side',t+.15,y,.22,.30,.045,.045,'wood');for(let j=0;j<3;j++)faceBox('side',t+.04+j*.09,y+.13,.225,.065,.20+rnd()*.07,.035,['#657c64','#b08848','#804b30'][j]);}}
for(let t of [-5.64,-2.52,-1.60])faceBox('side',t,1.51,.28,.10,1.83,.18,'darkGreen');
faceBox('side',-3.62,.80,.27,4.10,.26,.18,'darkGreen');faceBox('side',-2.06,1.57,.28,.74,1.56,.13,'darkGreen');faceBox('side',-2.06,1.75,.36,.56,.9,.03,'#9f8b50');faceBox('side',-2.06,1.28,.39,.60,.08,.06,'darkGreen');faceBox('side',-2.32,1.43,.4,.04,.17,.04,'gold');
faceBox('side',-3.62,2.60,.22,4.18,.59,.24,'darkGreen');faceBox('side',-3.62,2.92,.25,4.28,.09,.3,'#526045');faceBox('side',-3.62,2.27,.25,4.28,.09,.3,'#526045');textSign('BOOKS','side',-3.62,2.62,.36,.060);
// Trees, raised planters and faceted foliage.
function tree(x,z,sz=1){box(x,.79,z,1.05,.37,1.05,'stone');box(x,.99,z,.86,.035,.86,'#637336');cylinder(x,1.8,z,.075,1.8,'#6d4c30',7);for(let i=0;i<4;i++){let a=i*1.8;branch([x,1.65,z],[x+Math.cos(a)*.42,2.6,z+Math.sin(a)*.42],.045,'#694d30')}poly(x,3.1,z,.90*sz,1.2*sz,.85*sz,'leaf');poly(x-.35,2.95,z+.15,.53*sz,.76*sz,.60*sz,'#869738');poly(x+.3,3.28,z-.12,.55*sz,.82*sz,.57*sz,'#82933a')}
tree(-5.20,2.27,1.05);tree(1.02,-5.05,.88);
// Cast iron street lanterns.
function lamp(x,z){cylinder(x,.73,z,.19,.24,'iron');cylinder(x,1.00,z,.12,.4,'iron');cylinder(x,2.09,z,.045,2.1,'iron');cylinder(x,2.83,z,.074,.13,'iron');box(x,3.20,z,.25,.48,.25,'#f3ce7c');for(let dx of [-.145,.145])for(let dz of [-.145,.145])branch([x+dx*.7,2.95,z+dz*.7],[x+dx,3.47,z+dz],.018,'iron',5);cylinder(x,3.49,z,.27,.15,'iron',4,0);cylinder(x,3.58,z,.04,.09,'iron',7);cylinder(x,2.94,z,.19,.07,'iron',4)}
lamp(-4.45,3.25);lamp(1.61,-5.48);
// Slatted bench facing the road.
function bench(x,z){for(let s=0;s<4;s++)box(x+.15+s*.10,1.08,z,.085,.07,1.50,'wood');for(let j=0;j<3;j++)box(x-.11,1.28+j*.14,z,.065,.10,1.50,'wood');for(let zz of [z-.60,z+.60]){branch([x-.06,.65,zz],[x-.02,1.62,zz],.035,'iron');branch([x+.51,.65,zz],[x+.45,1.10,zz],.035,'iron');box(x+.22,1.27,zz,.51,.045,.045,'iron');}}
bench(1.0,-2.91);
// Bistro table and two chairs.
cylinder(-2.10,1.10,3.19,.36,.07,'wood',16);cylinder(-2.10,.86,3.19,.035,.44,'iron');for(let a=0;a<3;a++)branch([-2.1,.75,3.19],[-2.1+Math.cos(a*2.094)*.24,.65,3.19+Math.sin(a*2.094)*.24],.022,'iron');
function chair(x,z,rot){for(let dx of [-.15,.15])for(let dz of [-.15,.15])branch([x+dx,.64,z+dz],[x+dx*.8,1.0,z+dz*.8],.022,'iron');box(x,1.0,z,.39,.05,.37,'wood');for(let j=0;j<3;j++)box(x,1.17+j*.09,z+.16,.37,.065,.04,'wood');branch([x-.17,.95,z+.17],[x-.17,1.43,z+.17],.018,'iron');branch([x+.17,.95,z+.17],[x+.17,1.43,z+.17],.018,'iron')}
chair(-2.79,3.05);chair(-1.39,3.34);
function pot(x,z,scale=1,base=.64){cylinder(x,base+.19*scale,z,.15*scale,.38*scale,'#bd8c56',9,.21*scale);cylinder(x,base+.39*scale,z,.21*scale,.055*scale,'#cda777',9);for(let i=0;i<6;i++){let a=i*1.047;branch([x,base+.42*scale,z],[x+Math.cos(a)*.23*scale,base+.64*scale,z+Math.sin(a)*.23*scale],.018*scale,'#6d7e32');poly(x+Math.cos(a)*.17*scale,base+.65*scale,z+Math.sin(a)*.17*scale,.09*scale,.22*scale,.07*scale,'#7e943f')}}
pot(.55,-1.13,1);pot(.48,2.12,.85);pot(-2.10,3.19,.32,1.14);
// Chalk pavement board, beside the cafe corner.
box(.47,.99,2.93,.09,.70,.49,'wood',-.12);box(.53,1.04,2.93,.035,.52,.37,'#34423a',-.12);branch([.31,.64,2.68],[.47,1.36,2.68],.035,'wood');branch([.70,.64,3.18],[.47,1.36,3.18],.035,'wood');
// Compact period cars; local X is travel direction.
function car(cx,cz,rot,col){let c=Math.cos(rot),s=Math.sin(rot);const p=(x,y,z)=>[cx+x*c+z*s,y,cz-x*s+z*c];const b=(x,y,z,w,h,d,cc)=>{let q=p(x,y,z);box(...q,w,h,d,cc,rot)};b(0,.91,0,2.05,.48,1.02,col);b(.80,1.04,0,.48,.20,1.03,col);b(-.79,1.11,0,.40,.19,1.03,col);const cabin=[p(-.73,1.17,-.48),p(.58,1.17,-.48),p(.58,1.17,.48),p(-.73,1.17,.48),p(-.55,1.63,-.44),p(.38,1.63,-.44),p(.38,1.63,.44),p(-.55,1.63,.44)];for(let f of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]])quad(...f.map(i=>cabin[i]),col);b(-.085,1.665,0,1.03,.07,.95,col);
 // Sloped windscreen/cabin polygon.
 let side=(zz)=>{quad(p(-.68,1.19,zz),p(-.55,1.62,zz),p(-.12,1.62,zz),p(-.12,1.19,zz),'#34484b');quad(p(-.05,1.19,zz),p(-.05,1.62,zz),p(.40,1.62,zz),p(.54,1.19,zz),'#3c5054')};side(.485);side(-.485);quad(p(.56,1.19,-.44),p(.40,1.62,-.44),p(.40,1.62,.44),p(.56,1.19,.44),'#3e4c4d');quad(p(-.70,1.20,.44),p(-.56,1.62,.44),p(-.56,1.62,-.44),p(-.70,1.20,-.44),'#34494c');
 b(1.055,.88,0,.05,.19,.67,'#353f3e');for(let yy of [.83,.88,.93])b(1.087,yy,0,.015,.013,.64,'#a8a99b');for(let zz of [-.40,.40])b(1.07,.98,zz,.06,.15,.14,'#f8e6b7');b(1.10,.71,0,.10,.10,1.08,'#b6b7ab');b(-1.06,.73,0,.07,.09,1.06,'#a7ac9f');for(let xx of [-.69,.65])for(let zz of [-.54,.54]){let q=p(xx,.71,zz); // Axles aligned across the body.
 const a=p(xx,.71,zz-.10),e=p(xx,.71,zz+.10);branch(a,e,.245,'#282c2a',12);const out=p(xx,.71,zz+(zz>0?.115:-.115));const inn=p(xx,.71,zz+(zz>0?.10:-.10));branch(inn,out,.144,'#9da49e',12);}
 for(let zz of [-.505,.505]){b(-.26,1.12,zz,.15,.025,.018,'#c5c7b9');b(.49,1.24,zz*1.16,.12,.09,.12,col)} }
car(-.70,4.96,0,'blue');car(4.42,-2.45,-Math.PI/2,'yellow');
// Matte backdrop receives cast shadows.
box(0,-.32,0,200,.02,200,'#f7efdf');



async function main(){const gpu=await init();let error=null;gpu.onError(e=>{error=e;console.error(e);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(e)}});const canvas=document.querySelector('canvas');const screen=surface(gpu,canvas,{size:[1200,900],dpr:1,depth:true,msaa:4,clearColor:[.97,.944,.891,1]});const shadow=target(gpu,{size:[2048,2048],format:'r32float',depth:true,clearColor:[1,1,1,1]});const geo=geometry(gpu,{buffers:[{data:new Float32Array(vertices),attributes:{position:'float32x3',normal:'float32x3',color:'float32x3'}}],vertexCount:vertices.length/9});
const cameraVP=mat4.multiply(mat4.ortho(-9.55,9.55,-7.1625,7.1625,.1,80),mat4.lookAt([16,19,18],[0,2.65,0],[0,1,0]));const lightVP=mat4.multiply(mat4.ortho(-12,12,-12,12,.1,60),mat4.lookAt([14,23,11],[0,1.5,0],[0,1,0]));const depthDraw=draw(gpu,{shader:shadowShader,geometry:geo,set:{lightVP},cull:'none'});const sceneDraw=draw(gpu,{shader:sceneShader,geometry:geo,set:{cameraVP,lightVP,shadowTex:shadow.color},cull:'none'});await depthDraw.compile(shadow);await sceneDraw.compile(screen);const rendered=frame(gpu,f=>{f.pass(shadow,depthDraw);f.pass(screen,sceneDraw)});await rendered.done;await gpu.settled();await globalThis.__APERTURE_WAIT_GPU__();if(error)throw error;globalThis.__APERTURE_RENDER_STATUS__={ok:true};}
main().catch(e=>{console.error(e);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:e.stack||String(e)}});
