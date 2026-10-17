import * as THREE from 'three/webgpu';
import {pass, mrt, normalView, builtinAOContext, screenUV, texture, convertToTexture} from 'three/tsl';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {denoise} from 'three/addons/tsl/display/DenoiseNode.js';

// A fixed, authored little street: all shapes and shop artwork are procedural.
let seed=137; function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const scene=new THREE.Scene(); scene.background=new THREE.Color('#f4ecdc');
const colors={cream:'#edcdb0',trim:'#f4ddbc',trimDark:'#dabe9d',green:'#a2aa78',greenDark:'#344d3a',frame:'#284c45',roof:'#9c9388',road:'#383a3d',pave:'#d8cbb4',curb:'#c8bca5',blue:'#648da3',mustard:'#e9ae43',iron:'#303c3c',wood:'#b98143'};
const mats={}; function mat(c, opts={}){const k=c+JSON.stringify(opts);return mats[k]??=new THREE.MeshStandardMaterial({color:c,roughness:.88,metalness:0,...opts});}
function mesh(geo,m,parent=scene){const o=new THREE.Mesh(geo,typeof m==='string'?mat(m):m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(w,h,d,x,y,z,c,parent=scene){const o=mesh(new THREE.BoxGeometry(w,h,d),c,parent);o.position.set(x,y,z);return o;}
function cyl(rt,rb,h,x,y,z,c,seg=10,parent=scene){const o=mesh(new THREE.CylinderGeometry(rt,rb,h,seg),c,parent);o.position.set(x,y,z);return o;}
function ball(r,x,y,z,c,detail=0,parent=scene){const o=mesh(new THREE.IcosahedronGeometry(r,detail),c,parent);o.position.set(x,y,z);return o;}
function rod(a,b,r,c,parent=scene){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const o=cyl(r,r,delta.length(),0,0,0,c,8,parent);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function group(x,y,z,rot=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;scene.add(g);return g;}
function textSign(txt,w,h,x,y,z,bg,fg,parent,font='Georgia',sz=95){const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const ctx=cv.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle=fg;ctx.font=`600 ${sz}px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,512,137);const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;const o=mesh(new THREE.PlaneGeometry(w,h),mat('#ffffff',{map:tx,roughness:1}),parent);o.position.set(x,y,z);return o;}

// Two compact eighties hatchbacks, with shaped glazed cabins and rubber tires.
function car(x,z,color,rotation=0){const g=group(x,.05,z,rotation);g.scale.setScalar(1.12);
 box(1.02,.43,1.89,0,.52,0,color,g);box(.99,.18,2.02,0,.36,.0,color,g);
 box(.98,.10,.60,0,.77,.62,color,g);box(1.0,.08,.30,0,.75,-.80,color,g);
 // Tapered cabin: six clean surfaces, then dark windows offset just forward.
 const vertices=new Float32Array([-.49,.72,-.62,.49,.72,-.62,.49,.72,.51,-.49,.72,.51,-.38,1.25,-.42,.38,1.25,-.42,.38,1.25,.28,-.38,1.25,.28]);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);const inds=geo.getIndex();for(let i=0;i<inds.count;i+=3){const t=inds.getX(i+1);inds.setX(i+1,inds.getX(i+2));inds.setX(i+2,t);}geo.computeVertexNormals();mesh(geo,color,g);
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
car(0,0,colors.blue,0);
box(200,.08,200,0,-.04,0,'#e7ddc7').castShadow=false;
// Warm studio sunlight, ample soft fill, and physical contact shadows.
scene.add(new THREE.HemisphereLight('#fff5e6','#aaa297',1.65));
const sun=new THREE.DirectionalLight('#fff0d8',3.0);sun.position.set(-3,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.camera.near=.5;sun.shadow.camera.far=35;sun.shadow.bias=-.00025;sun.shadow.normalBias=.018;sun.shadow.radius=4;scene.add(sun);scene.add(sun.target);
const fill=new THREE.DirectionalLight('#e8f0fa',.45);fill.position.set(8,7,-5);scene.add(fill);
const camera=new THREE.OrthographicCamera(-3.5*2/3,3.5*2/3,1.75,-1.75,.1,80);camera.position.set(4.5,2.9,5.7);camera.lookAt(0,.68,0);

async function start(){
 const renderer=new THREE.WebGPURenderer({antialias:true,forceWebGL:false});
 // Three's default fallback is deliberately disabled for this benchmark.
 renderer._getFallback=null;
 renderer.setPixelRatio(1);renderer.setSize(1200,900);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 document.body.appendChild(renderer.domElement);await renderer.init();
 if(!renderer.backend.isWebGPUBackend)throw new Error('Native WebGPU backend required');
 const gpuErrors=[];
 renderer.backend.device.addEventListener('uncapturederror',event=>gpuErrors.push(event.error.message));
 // GTAO requires a non-multisampled depth prepass. The beauty pass retains MSAA.
 const prePass=pass(scene,camera,{samples:0});
 prePass.setMRT(mrt({output:normalView}));
 const occlusion=ao(prePass.getTextureNode('depth'),prePass.getTextureNode(),camera);
 occlusion.radius.value=.32;occlusion.thickness.value=.5;occlusion.samples.value=24;occlusion.scale.value=1.2;
 const smoothedAO=denoise(occlusion.getTextureNode(),prePass.getTextureNode('depth'),prePass.getTextureNode(),camera);
 smoothedAO.radius.value=3;
 // Replace denoiser's default random noise with a reproducible authored tile.
 const noiseData=new Uint8Array(16*16*4);for(let i=0;i<noiseData.length;i++)noiseData[i]=Math.floor(rnd()*256);
 const noiseTex=new THREE.DataTexture(noiseData,16,16);noiseTex.wrapS=noiseTex.wrapT=THREE.RepeatWrapping;noiseTex.needsUpdate=true;
 smoothedAO.noiseNode=texture(noiseTex);
 const scenePass=pass(scene,camera);
 scenePass.contextNode=builtinAOContext(convertToTexture(smoothedAO).sample(screenUV).r);
 const pipeline=new THREE.RenderPipeline(renderer);
 pipeline.outputNode=scenePass;
 pipeline.render();
 await globalThis.__APERTURE_WAIT_GPU__();
 if(gpuErrors.length)throw new Error(gpuErrors.join("\n"));
 globalThis.__APERTURE_RENDER_STATUS__={ok:true};
}
start().catch(error=>{console.error(error);globalThis.__APERTURE_RENDER_STATUS__={ok:false,error:String(error.stack||error)};});
