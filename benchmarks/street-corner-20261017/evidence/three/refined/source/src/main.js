import * as THREE from 'three/webgpu';
import {pass, mrt, output, normalView, vec4} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';

// A fixed, authored little street: all shapes and shop artwork are procedural.
let seed=137; function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const scene=new THREE.Scene(); scene.background=new THREE.Color('#f4ecdc');
const colors={cream:'#e9cfa7',trim:'#f4ddbc',trimDark:'#d6b48e',green:'#a2aa78',greenDark:'#344d3a',frame:'#284c45',roof:'#9c9388',road:'#383a3d',pave:'#d8cbb4',curb:'#c8bca5',blue:'#648da3',mustard:'#e9ae43',iron:'#303c3c',wood:'#b98143'};
const mats={}; function mat(c, opts={}){const k=c+JSON.stringify(opts);return mats[k]??=new THREE.MeshStandardMaterial({color:c,roughness:.88,metalness:0,...opts});}
function mesh(geo,m,parent=scene){const o=new THREE.Mesh(geo,typeof m==='string'?mat(m):m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,x,y,z,c,parent=scene){const o=mesh(new THREE.BoxGeometry(w,h,d),c,parent);o.position.set(x,y,z);return o;}
function cyl(rt,rb,h,x,y,z,c,seg=10,parent=scene){const o=mesh(new THREE.CylinderGeometry(rt,rb,h,seg),c,parent);o.position.set(x,y,z);return o;}
function ball(r,x,y,z,c,detail=0,parent=scene){const o=mesh(new THREE.IcosahedronGeometry(r,detail),c,parent);o.position.set(x,y,z);return o;}
function rod(a,b,r,c,parent=scene){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const o=cyl(r,r,delta.length(),0,0,0,c,8,parent);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function group(x,y,z,rot=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);return g;}
function textSign(txt,w,h,x,y,z,bg,fg,parent,font='Georgia',sz=95){const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const ctx=cv.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle=fg;ctx.font=`600 ${sz}px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,512,137);const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const o=mesh(new THREE.PlaneGeometry(w,h),mat('#ffffff',{map:tx,roughness:1}),parent);o.position.set(x,y,z);return o;}

// Sand-colored presentation plinth and two asphalt streets.
box(13.4,.65,11.2,-.7,-.325,.3,'#b8a994');
box(13.32,.045,11.12,-.7,.023,.3,colors.road);
box(200,.1,200,0,-.76,0,'#f1e7d5').castShadow=false;
box(10.5,.2,7.9,.3,.14,-1.25,colors.curb);
box(10.38,.035,7.78,.3,.255,-1.25,colors.pave);
// Individual stone paving joints, drawn as shallow mortar channels.
for(let x=-4.8;x<5.5;x+=.67){box(.012,.005,7.77,x,.277,-1.25,'#bcae99');}
for(let z=-5.0;z<2.65;z+=.66){box(10.38,.005,.012,.3,.278,z,'#bcae99');}
for(let x=-4.85;x<5.5;x+=.66){box(.63,.21,.16,x,.145,2.68,colors.curb);}
for(let z=-5.05;z<2.65;z+=.66){box(.16,.21,.63,-4.99,.145,z,colors.curb);}
// Broken center line on each arm of the road.
for(let x=-5.4;x<5.6;x+=1.6)box(.72,.008,.085,x,.052,4.15,'#cfbea0');
for(let z=-4.3;z<3.6;z+=1.6)box(.085,.008,.66,-6.25,.052,z,'#cfbea0');
for(let x=-.6;x<2.3;x+=.52)box(.32,.012,1.94,x,.056,3.82,'#eee2c9');
// Tactile curb ramp, set flush with the pale paving.
box(.8,.018,.46,-.66,.28,2.32,'#d9b576');
for(let a=0;a<7;a++)for(let b=0;b<4;b++)cyl(.013,.013,.011,-1.0+a*.11,.296,2.15+b*.1,'#bfa271',6);

// Tall cream corner cafe.
const cafe={x:-1.9,z:-1.35,w:3.8,d:3.8,h:6.6};
box(cafe.w,cafe.h,cafe.d,cafe.x,.28+cafe.h/2,cafe.z,colors.cream);
for(const [y,h,over,c] of [[.43,.22,.04,colors.trimDark],[2.52,.12,.12,colors.trimDark],[2.66,.11,.15,colors.trim],[4.55,.11,.10,colors.trim],[6.75,.14,.17,colors.trimDark],[6.88,.15,.23,colors.trim]])box(cafe.w+over,h,cafe.d+over,cafe.x,y,cafe.z,c);
// Four slightly raised quoins give the building's corner a readable rhythm.
for(const x of [-3.8,-.0])for(const z of [-3.25,.55])for(let y=.65;y<6.6;y+=.45)box(.24,.28,.24,x,y,z,colors.trimDark);
// Recessed roof, coping, chimney, and modest equipment.
box(3.64,.09,3.65,-1.9,6.98,-1.35,colors.roof);
for(const x of [-3.8,0])box(.12,.27,3.92,x,7.10,-1.35,colors.trim);
for(const z of [-3.25,.55])box(3.9,.27,.12,-1.9,7.10,z,colors.trim);
box(.62,.75,.58,-2.7,7.42,-2.65,colors.trimDark);box(.72,.10,.68,-2.7,7.84,-2.65,colors.trim);
cyl(.095,.095,.2,-2.7,7.98,-2.65,'#69645c',10);
box(.96,.44,.67,-1.2,7.22,-1.6,'#b4aa99');box(1.0,.04,.70,-1.2,7.46,-1.6,'#c4b9a8');

const cafeFront=group(-1.9,0,.562);const cafeWest=group(-3.812,0,-1.35,-Math.PI/2);
// Opaque inset window panes, mullions and shallow interior silhouettes.
function upperWindow(parent,u,y,w=.72,h=1.25,books=false){
 box(w+.18,h+.18,.09,u,y,-.004,colors.trimDark,parent);
 box(w,h,.07,u,y,.055,'#183d3d',parent);
 box(w-.10,h-.08,.035,u,y,.10,'#536759',parent);
 // Warm room backing and a small curtain at one side.
 box(w*.28,h-.12,.018,u+w*.27,y,.124,'#bca675',parent);
 if(books){for(let row=0;row<3;row++){box(w-.08,.045,.08,u,y-h/2+.2+row*.36,.15,colors.wood,parent);for(let j=0;j<6;j++)box(.045,.17+rnd()*.09,.055,u-w/2+.10+j*.09,y-h/2+.32+row*.36,.17,['#b67e45','#b0a374','#6a7e6b','#c5b18b'][j%4],parent);}}
 else {box(.24,.13,.07,u-.12,y-h/2+.14,.15,'#a77c48',parent);for(let i=0;i<3;i++)ball(.075,u-.18+i*.07,y-h/2+.29+i*.025,.15,'#6b7641',0,parent);}
 for(const s of [-1,1]){box(.055,h+.02,.10,u+s*w/2,y,.17,colors.frame,parent);box(w+.25,.065,.14,u,y+s*(h/2+.07),.10,colors.trim,parent);}
 box(.045,h,.08,u,y,.18,colors.frame,parent);box(w,.047,.08,u,y+.05,.18,colors.frame,parent);
}
for(const face of [cafeFront,cafeWest])for(const y of [3.58,5.54])for(const u of [-.94,.94])upperWindow(face,u,y,.70,1.28);

function storefront(parent,w,sign,awning=true){
 box(w-.25,1.95,.10,0,1.29,.065,colors.frame,parent);
 box(w-.45,1.60,.06,0,1.42,.125,'#987641',parent);
 // Shelves, counters and lamps are deliberately broad silhouettes.
 for(const u of [-w*.29,w*.26]){
 box(w*.28,.12,.12,u,.72,.19,'#c89653',parent);box(w*.28,.07,.09,u,1.22,.19,'#b48140',parent);
 for(let k=0;k<3;k++)box(.10,.20,.08,u-.17+k*.15,1.36,.23,['#6b7a4c','#c8a15c','#7c643f'][k],parent);
 cyl(.022,.022,.28,u,1.97,.25,colors.iron,6,parent);ball(.095,u,1.77,.25,mat('#ffdb7b',{emissive:'#ffb63a',emissiveIntensity:.35}),1,parent);
 }
 // Frames and panelled lower doors.
 for(const u of [-w/2+.18,-w*.19,w*.19,w/2-.18])box(.075,1.9,.14,u,1.25,.28,colors.frame,parent);
 box(w-.25,.10,.14,0,2.19,.28,colors.frame,parent);box(w-.25,.10,.14,0,.40,.28,colors.frame,parent);
 box(w-.28,.38,.12,0,.61,.28,colors.frame,parent);
 for(const u of [-w*.32,0,w*.32]){box(w*.26,.23,.035,u,.61,.36,'#345a4b',parent);box(.04,.16,.04,u+.21,1.06,.37,'#c3a366',parent);}
 box(w+.05,.43,.16,0,2.40,.12,colors.cream,parent);
 textSign(sign,w*.75,.34,0,2.48,.215,colors.cream,'#624b38',parent,'Georgia',125);
 if(awning){const count=10,sw=(w+.2)/count;for(let i=0;i<count;i++){
 const a=box(sw-.008,.055,.88,-(w+.2)/2+sw*(i+.5),2.13,.56,i%2===0?'#b8503b':'#f4dfb6',parent);a.rotation.x=.38;
 const fr=box(sw-.008,.21,.075,-(w+.2)/2+sw*(i+.5),1.865,.963,i%2===0?'#b8503b':'#f4dfb6',parent);
 }}
}
storefront(cafeFront,3.65,'CAFÉ');storefront(cafeWest,3.65,'CAFE');

// Lower sage bookshop adjoins the cafe on the same street line.
box(3.7,4.76,3.58,1.87,2.66,-1.24,colors.green);
box(3.84,.14,3.72,1.87,4.99,-1.24,'#c7c49c');
box(3.85,.11,3.72,1.87,5.13,-1.24,colors.trim);
box(3.60,.07,3.47,1.87,5.20,-1.24,'#8e8980');
for(const x of [.02,3.72])box(.11,.18,3.72,x,5.27,-1.24,'#c6bea7');
for(const z of [-3.03,.55])box(3.81,.18,.11,1.87,5.27,z,'#c6bea7');
box(.67,.62,.62,2.38,5.53,-1.9,'#979180');box(.74,.06,.69,2.38,5.87,-1.9,'#b4ad9a');
box(.43,.42,.02,2.38,5.55,-1.58,'#7d796d');cyl(.09,.09,.32,3.1,5.4,-.6,'#676962');cyl(.13,.13,.055,3.1,5.59,-.6,'#b5ae9e');
const books=group(1.87,0,.562);
for(const u of [-1.15,0,1.15])upperWindow(books,u,3.95,.62,1.21,true);
// Masonry courses on sage facade.
for(let y=2.93;y<4.9;y+=.28){box(3.65,.008,.009,0,y,.001,'#8f976e',books);for(let u=-1.7;u<1.8;u+=.58)box(.009,.26,.008,u+((Math.round(y*10)%2)*.17),y+.14,.002,'#92996e',books);}
box(3.72,2.18,.13,0,1.38,.06,colors.greenDark,books);
// Left narrow door and right book window.
box(.78,1.52,.045,-1.25,1.25,.15,'#7c805a',books);box(2.35,1.36,.04,.45,1.38,.15,'#987a45',books);
for(let row=0;row<3;row++){
 const y=.89+row*.39;box(2.27,.055,.10,.45,y,.21,'#ba894a',books);
 for(let i=0;i<19;i++){const h=.20+rnd()*.12;box(.06+rnd()*.025,h,.07,-.61+i*.117,y+h/2+.03,.25,['#c4a46e','#7d8658','#a66e39','#78958a','#d5bf81'][i%5],books);}
}
for(const u of [-1.75,-.78,1.73])box(.10,1.75,.18,u,1.27,.28,colors.greenDark,books);
box(.055,1.50,.14,-1.25,1.25,.28,colors.greenDark,books);box(.74,.35,.14,-1.25,.60,.28,colors.greenDark,books);
box(.045,.14,.05,-.99,1.10,.38,'#c6a96c',books);
box(2.5,.11,.18,.45,.62,.28,colors.greenDark,books);box(2.4,.23,.11,.45,.43,.23,'#405a40',books);
box(3.83,.57,.19,0,2.37,.18,colors.greenDark,books);textSign('BOOKS',2.7,.49,0,2.39,.285,colors.greenDark,'#e9d6a4',books,'Georgia',119);
box(3.87,.08,.28,0,2.7,.20,'#69734f',books);box(3.87,.07,.24,0,2.06,.19,'#516544',books);
ball(.10,-.48,1.86,.35,mat('#f5d17c',{emissive:'#efb54b',emissiveIntensity:.3}),1,books);

// Trees have asymmetric clusters of faceted foliage and visible forked trunks.
function tree(x,z,s=1){
 box(.87,.29,.83,x,.40,z,'#c7bba2');box(.72,.018,.68,x,.555,z,'#727947');
 cyl(.07*s,.11*s,1.8*s,x,.56+.9*s,z,'#775332',7);
 rod([x,1.35*s,z],[x-.30*s,2.05*s,z+.10*s],.045*s,'#775332');rod([x,1.4*s,z],[x+.29*s,2.15*s,z-.1*s],.045*s,'#775332');
 const crownGeometry=new THREE.IcosahedronGeometry(1,2);
 const pos=crownGeometry.getAttribute('position');
 for(let i=0;i<pos.count;i++){const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i);const jitter=1+.09*Math.sin(px*27+py*19+pz*31);pos.setXYZ(i,px*jitter,py*jitter,pz*jitter);}
 crownGeometry.computeVertexNormals();
 const crown=mesh(crownGeometry,mat('#849b3d',{flatShading:true}),scene);crown.position.set(x,2.58*s,z);crown.scale.set(.77*s,1.18*s,.72*s);
 const leaves=crownGeometry.getAttribute('position');const col=[];for(let i=0;i<leaves.count;i+=3){const variation=.88+rnd()*.26;for(let k=0;k<3;k++)col.push(variation,variation,variation);}
 crownGeometry.setAttribute('color',new THREE.Float32BufferAttribute(col,3));crown.material=mat('#8fa345',{flatShading:true,vertexColors:true});
}
tree(-4.40,-3.35,1.08);tree(4.70,.32,.96);
function plant(x,z,s=.5){cyl(.18*s,.13*s,.40*s,x,.28+.20*s,z,'#bd8a50');cyl(.19*s,.19*s,.055*s,x,.28+.41*s,z,'#d6a367');for(let i=0;i<7;i++){let a=i*2.399;const o=ball(.20*s,x+Math.cos(a)*.13*s,.28+(.62+(i%3)*.10)*s,z+Math.sin(a)*.13*s,'#738432',0);o.scale.set(.48,1.8,.45);o.rotation.z=Math.cos(a)*.6;}}
plant(-.22,1.10,1.25);plant(.55,.99,1.0);

function lamp(x,z){
 cyl(.17,.20,.10,x,.32,z,colors.iron);cyl(.08,.12,.23,x,.48,z,colors.iron);cyl(.041,.065,2.45,x,1.76,z,colors.iron);cyl(.075,.075,.08,x,2.8,z,colors.iron);
 const glass=mat('#f8d27b',{emissive:'#edb64d',emissiveIntensity:.32});
 cyl(.16,.10,.42,x,3.02,z,glass,4).rotation.y=Math.PI/4;
 cyl(.22,.10,.16,x,3.30,z,colors.iron,4).rotation.y=Math.PI/4;
 for(const dx of [-1,1])for(const dz of [-1,1])rod([x+dx*.08,2.8,z+dz*.08],[x+dx*.12,3.25,z+dz*.12],.017,colors.iron);
 ball(.05,x,3.43,z,colors.iron);cyl(.13,.13,.06,x,2.79,z,colors.iron,4).rotation.y=Math.PI/4;
}
lamp(-4.45,.12);lamp(4.92,1.70);

function bench(x,z){const g=group(x,.28,z);for(const a of [-.64,.64]){rod([a,0,.27],[a,.51,.19],.035,colors.iron,g);rod([a,0,-.23],[a,.49,-.14],.035,colors.iron,g);rod([a,.44,-.18],[a,.94,-.34],.032,colors.iron,g);rod([a,.65,-.27],[a,.65,.27],.025,colors.iron,g);rod([a,.43,.28],[a,.65,.27],.025,colors.iron,g);}for(let i=0;i<4;i++)box(1.62,.055,.115,0,.46,-.17+i*.12,colors.wood,g);for(let i=0;i<3;i++){const b=box(1.63,.13,.06,0,.64+i*.16,-.29-i*.035,colors.wood,g);b.rotation.x=-.16;}}
bench(2.25,1.56);
// Bistro set on the cafe corner.
const tx=-3.67,tz=1.40;
cyl(.34,.34,.055,tx,.93,tz,'#be8c4e',16);cyl(.04,.04,.60,tx,.61,tz,colors.iron);cyl(.24,.24,.035,tx,.31,tz,colors.iron,8);
function chair(x,z,rot){const g=group(x,.28,z,rot);box(.35,.055,.34,0,.40,0,colors.wood,g);for(const dx of [-.14,.14])for(const dz of [-.13,.13])rod([dx*1.3,0,dz*1.3],[dx,.42,dz],.018,colors.iron,g);for(const dx of [-.14,.14])rod([dx,.41,-.13],[dx,.84,-.21],.019,colors.iron,g);for(let i=0;i<3;i++)box(.36,.065,.035,0,.62+i*.085,-.18-i*.015,colors.wood,g);}
chair(-4.28,1.4,-Math.PI/2);chair(-3.17,1.65,Math.PI/2);cyl(.065,.048,.12,tx,1.02,tz,'#aa7741',9);ball(.10,tx,1.14,tz,'#7c8b3a',0);
// Chalkboard A-frame with visible feet.
const chalk=group(-2.15,.28,1.44,-.10);const board=box(.56,.68,.05,0,.45,0,'#303b36',chalk);board.rotation.x=-.12;
for(const x of [-.31,.31]){rod([x,0,.16],[x,.84,-.05],.03,'#c59552',chalk);rod([x,0,-.31],[x,.84,-.05],.03,'#c59552',chalk);}box(.66,.05,.06,0,.81,-.04,'#c59552',chalk);box(.65,.06,.06,0,.12,.05,'#c59552',chalk);
textSign('coffee',.43,.17,0,.56,.065,'#303b36','#e1d4b6',chalk,'Georgia',110);

// Two compact eighties hatchbacks, with shaped glazed cabins and rubber tires.
function car(x,z,color,rotation=0){const g=group(x,.05,z,rotation);g.scale.setScalar(1.12);
 box(1.02,.43,1.89,0,.52,0,color,g);box(.99,.18,2.02,0,.36,.0,color,g);
 box(.98,.10,.60,0,.77,.62,color,g);box(1.0,.08,.30,0,.75,-.80,color,g);
 // Tapered cabin: six clean surfaces, then dark windows offset just forward.
 const vertices=new Float32Array([-.49,.72,-.62,.49,.72,-.62,.49,.72,.51,-.49,.72,.51,-.38,1.25,-.42,.38,1.25,-.42,.38,1.25,.28,-.38,1.25,.28]);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);geo.computeVertexNormals();mesh(geo,color,g);
 // Windshield and rear glass are planar trapezoids.
 function quad(v,c){const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(v,3));q.setIndex([0,1,2,0,2,3]);q.computeVertexNormals();mesh(q,mat(c,{side:THREE.DoubleSide,roughness:.37}),g);}
 quad([-.42,.77,.50,.42,.77,.50,.335,1.20,.307,-.335,1.20,.307],'#34474a');
 quad([-.42,.78,-.627,-.335,1.2,-.447,.335,1.2,-.447,.42,.78,-.627],'#354648');
 for(const side of [-1,1]){
 const a=side*.496,b=side*.395;
 quad([a,.78,-.54,a,.78,-.08,b,1.19,-.08,b,1.19,-.39],'#33464a');
 quad([a,.78,-.025,a,.78,.41,b,1.19,.24,b,1.19,-.025],'#3b4c4d');
 box(.028,.018,1.65,a,.65,-.02,'#497181',g);box(.04,.045,.12,a*1.025,.67,-.16,'#b8bcb3',g);
 box(.13,.095,.12,a*1.14,.81,.27,color,g);
 for(const zz of [-.62,.62]){const tire=cyl(.245,.245,.14,side*.52,.27,zz,'#292d2d',14,g);tire.rotation.z=Math.PI/2;const hub=cyl(.142,.142,.15,side*.54,.27,zz,'#a3a79d',12,g);hub.rotation.z=Math.PI/2;const cap=cyl(.093,.093,.157,side*.55,.27,zz,'#646d6a',10,g);cap.rotation.z=Math.PI/2;}
 }
 box(1.05,.13,.10,0,.30,1.02,'#a8aba0',g);box(1.03,.10,.08,0,.34,-1.02,'#a8aba0',g);
 box(.51,.21,.035,0,.52,1.0,'#313c3d',g);for(let i=0;i<4;i++)box(.47,.012,.04,0,.46+i*.045,1.023,'#7f8984',g);
 for(const xx of [-.39,.39]){box(.18,.19,.04,xx,.53,1.01,'#f4dc9a',g);box(.16,.13,.03,xx,.53,-1.015,'#9c4a32',g);}
 box(.30,.075,.02,0,.31,1.085,'#d8d5bc',g);
}
car(-6.20,1.18,colors.blue,0);car(3.8,4.14,colors.mustard,-Math.PI/2);

// Warm studio sunlight, ample soft fill, and physical contact shadows.
scene.add(new THREE.HemisphereLight('#fff5e6','#aaa297',1.65));
const sun=new THREE.DirectionalLight('#fff0d8',3.0);sun.position.set(-3,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.camera.near=.5;sun.shadow.camera.far=35;sun.shadow.bias=-.00025;sun.shadow.normalBias=.018;sun.shadow.radius=4;scene.add(sun);scene.add(sun.target);
const fill=new THREE.DirectionalLight('#e8f0fa',.45);fill.position.set(8,7,-5);scene.add(fill);
const camera=new THREE.OrthographicCamera(-9.6,9.6,7.2,-7.2,.1,80);camera.position.set(-15.5,14.3,17);camera.lookAt(-.65,2.1,-.05);

async function start(){
 const renderer=new THREE.WebGPURenderer({antialias:true,forceWebGL:false});
 // Three's default fallback is deliberately disabled for this benchmark.
 renderer._getFallback=null;
 renderer.setPixelRatio(1);renderer.setSize(1200,900);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 document.body.appendChild(renderer.domElement);await renderer.init();
 if(!renderer.backend.isWebGPUBackend)throw new Error('Native WebGPU backend required');
 const scenePass=pass(scene,camera);
 scenePass.setMRT(mrt({output,normal:normalView}));
 const sceneColor=scenePass.getTextureNode('output');
 const occlusion=ao(scenePass.getTextureNode('depth'),scenePass.getTextureNode('normal'),camera);
 occlusion.radius.value=.32;occlusion.thickness.value=.5;occlusion.samples.value=24;occlusion.scale.value=1.2;
 const pipeline=new THREE.RenderPipeline(renderer);
 pipeline.outputNode=vec4(sceneColor.rgb.mul(occlusion.getTextureNode().r.mul(.70).add(.30)),sceneColor.a);
 pipeline.render();
 await globalThis.__APERTURE_WAIT_GPU__();
 globalThis.__APERTURE_RENDER_STATUS__={ok:true};
}
start().catch(error=>{console.error(error);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(error.stack||error)};});
