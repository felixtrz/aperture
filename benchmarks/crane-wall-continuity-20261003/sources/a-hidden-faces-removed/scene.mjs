/** Independent authored crane. No reference assets are loaded at runtime. */
export const BASELINE = Object.freeze({shoulder_deg:50, elbow_deg:-35, hoist_length:1.5, opening_width:1.6, pipe_bend_radius:.8, top_tier_height:.18, assembly_yaw_deg:0, assembly_dx:0, assembly_dz:0});
export const EDITS = Object.freeze({baseline:{}, shoulder:{shoulder_deg:65}, elbow:{elbow_deg:-60}, hoist:{hoist_length:1.9}, arch:{opening_width:2.1}, pipe:{pipe_bend_radius:1.1}, tier:{top_tier_height:.38}, assembly:{assembly_yaw_deg:20,assembly_dx:.55,assembly_dz:.4}});
export const CAMERAS = Object.freeze({'front-quarter':[8,6.5,10], 'rear-quarter':[-8,5,-9], 'high-oblique':[6,11,5]});
export const PALETTE = Object.freeze({
 brick:['#B4775D',.94,0], 'brick-alt':['#C78C6A',.91,0], cap:['#DBB18B',.88,0], crane:['#E1A330',.54,.12], 'crane-light':['#F3C35C',.58,.08], dark:['#263944',.58,.1], edge:['#56646D',.88,0], ground:['#78868B',.95,0], lamp:['#FFE1A3',.35,0], pipe:['#367F82',.58,.12], 'pipe-inside':['#285458',.73,.05], steel:['#A5B6C0',.32,.55], tier:['#405C70',.72,.05], 'tier-light':['#6D8694',.72,.05], wood:['#AF7950',.85,0], 'wood-trim':['#E4BF85',.85,0]
});
export const CONFIG = Object.freeze({mode:'browser',canvas:'#scene',assets:{},render:{defaultCamera:false,defaultLight:false,defaultEnvironment:false,tonemap:'agx',exposure:1,sampleCount:4,pixelRatio:1,maxPixelRatio:1,cadence:'demand',clearColor:[.115,.17,.209,1],bloom:{threshold:1,intensity:.025,radiusPixels:2}},diagnostics:{level:'warn'}});
export const add=(a,b)=>a.map((n,i)=>n+b[i]);
export const sub=(a,b)=>a.map((n,i)=>n-b[i]);
export const mul=(a,s)=>a.map(n=>n*s);
export const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>mul(a,1/Math.hypot(...a));
export const mean=a=>mul(a.reduce((s,p)=>add(s,p),[0,0,0]),1/a.length);
const D=Math.PI/180;
export function linearColor(hex){return [1,3,5].map(i=>{const s=parseInt(hex.slice(i,i+2),16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});}
export function parametersFor(edit='baseline'){if(!Object.hasOwn(EDITS,edit))throw Error(`Unknown edit: ${edit}`);return {...BASELINE,...EDITS[edit]};}
export function assemblyPoint(q,p){const a=p.assembly_yaw_deg*D,c=Math.cos(a),s=Math.sin(a),x=q[0]+2.15,z=q[2]-.15;return [-2.15+c*x+s*z+p.assembly_dx,q[1],.15-s*x+c*z+p.assembly_dz];}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

export function constructScene(edit='baseline'){
 const p=parametersFor(edit),parts=[];
 function finish(name,material,group,positions,indices,features={}){
  const final=positions.map(v=>{let q=v;if(group==='crane')q=add(q,[0,p.top_tier_height-.18,0]);if(group==='crane'||group==='platform')q=assemblyPoint(q,p);return q.map(Math.fround);});
  const part={name,material,group,positions:final,indices,features,worldMatrix:[...identity]};parts.push(part);return part;
 }
 function poly(name,material,group,v,faces,features={}){
  const center=mean(v),ii=[];
  for(let face of faces){face=[...face];const normal=cross(sub(v[face[1]],v[face[0]]),sub(v[face[2]],v[face[0]]));if(dot(normal,sub(mean(face.map(i=>v[i])),center))<0)face.reverse();for(let i=1;i<face.length-1;i++)ii.push(face[0],face[i],face[i+1]);}
  return finish(name,material,group,v,ii,features);
 }
 function box(name,material,group,center,size){const v=[];for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])v.push(add(center,[x*size[0]/2,y*size[1]/2,z*size[2]/2]));return poly(name,material,group,v,[[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]],{kind:'box'});}
 function bar(name,material,group,a,b,w,d){const u=norm(sub(b,a)),v=[-u[1],u[0],0],z=[0,0,1],vs=[];for(const q of [a,b])for(const signs of [[-1,-1],[1,-1],[1,1],[-1,1]])vs.push(add(q,add(mul(v,signs[0]*w/2),mul(z,signs[1]*d/2))));return poly(name,material,group,vs,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],{kind:'bar',startRing:[0,1,2,3],endRing:[4,5,6,7]});}
 function cylinder(name,material,group,a,b,r,n=12){const axis=norm(sub(b,a)),seed=Math.abs(axis[2])<.9?[0,0,1]:[0,1,0],u=norm(cross(axis,seed)),v=cross(axis,u),verts=[];for(const q of [a,b])for(let i=0;i<n;i++)verts.push(add(q,add(mul(u,r*Math.cos(2*Math.PI*i/n)),mul(v,r*Math.sin(2*Math.PI*i/n)))));const faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i)];for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j,n+j,n+i]);}return poly(name,material,group,verts,faces,{kind:'cylinder',startRing:Array.from({length:n},(_,i)=>i),endRing:Array.from({length:n},(_,i)=>i+n),radius:r});}
 function extrude(name,material,group,xy,z0,z1){const v=[...xy.map(a=>[...a,z0]),...xy.map(a=>[...a,z1])],n=xy.length,faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i+n)];for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j,n+j,n+i]);}return poly(name,material,group,v,faces,{kind:'extruded-polygon',front:xy.map((_,i)=>i+n),back:xy.map((_,i)=>i)});}
 function crate(name,group,c,s){box(`${name}.body`,'wood',group,c,s);for(let i=0;i<2;i++){const x=c[0]+(i?1:-1)*s[0]*.39;for(const [face,sign] of [['front',1],['back',-1]])box(`${name}.strap-${face}.${i}`,'wood-trim',group,[x,c[1],c[2]+sign*(s[2]/2+.014)],[s[0]*.085,s[1]+.035,.034]);box(`${name}.strap-top.${i}`,'wood-trim',group,[x,c[1]+s[1]/2+.018,c[2]],[s[0]*.085,.035,s[2]+.065]);}}
 function tube(name,material,group,centers,radials,r,sides=8){const verts=[],indices=[],rings=[];for(let i=0;i<centers.length;i++){const ids=[];for(let j=0;j<sides;j++){ids.push(verts.length);const a=2*Math.PI*j/sides;verts.push(add(centers[i],add(mul(radials[i],r*Math.cos(a)),[0,0,r*Math.sin(a)])));}rings.push(ids);}
  function quad(ids,out){if(dot(cross(sub(verts[ids[1]],verts[ids[0]]),sub(verts[ids[2]],verts[ids[0]])),out)<0)ids.reverse();indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);}
  for(let i=0;i<centers.length-1;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides,ids=[rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]],out=sub(mean(ids.map(i=>verts[i])),mean([centers[i],centers[i+1]]));quad(ids,out);}
  for(const k of [0,centers.length-1]){const out=k===0?sub(centers[0],centers[1]):sub(centers[k],centers[k-1]),ids=[...rings[k]];if(dot(cross(sub(verts[ids[1]],verts[ids[0]]),sub(verts[ids[2]],verts[ids[0]])),out)<0)ids.reverse();for(let j=1;j<sides-1;j++)indices.push(ids[0],ids[j],ids[j+1]);}
  return finish(name,material,group,verts,indices,{kind:'solid-bent-tube',rings});
 }
 box('courtyard.slab','ground','static',[0,-.11,0],[7.9,.22,6]);
 box('platform.lower','edge','platform',[-2.15,.08,.15],[3.05,.16,2.35]);
 box('platform.middle','tier-light','platform',[-2.15,.24,.15],[2.72,.16,2.02]);
 box('platform.upper','tier','platform',[-2.15,.32+p.top_tier_height/2,.15],[2.36,p.top_tier_height,1.65]);
 const P=[-2.15,1.25,.15],u=[Math.cos(p.shoulder_deg*D),Math.sin(p.shoulder_deg*D),0],v=[Math.cos((p.shoulder_deg+p.elbow_deg)*D),Math.sin((p.shoulder_deg+p.elbow_deg)*D),0],E=add(P,mul(u,2.6)),T=add(E,mul(v,1.7)),H=add(T,[0,-p.hoist_length,0]),A=add(P,[.5,-.35,.3]),B=add(add(P,mul(u,.9)),[0,0,.3]);
 box('crane.foot','dark','crane',[-2.15,.56,.15],[.86,.12,.80]);
 cylinder('crane.turntable','steel','crane',[-2.15,.62,.15],[-2.15,.77,.15],.36,16);
 box('crane.pedestal','crane','crane',[-2.15,.98,.15],[.46,.46,.46]);
 box('crane.counterweight','dark','crane',[-2.52,1.02,.15],[.46,.34,.64]);
 bar('crane.boom.lower','crane','crane',P,E,.30,.36);
 bar('crane.boom.upper','crane-light','crane',E,T,.24,.29);
 for(const [name,c,r,depth] of [['shoulder',P,.225,.68],['elbow',E,.175,.57],['tip',T,.135,.46]]){cylinder(`crane.pin.${name}`,'dark','crane',add(c,[0,0,-depth/2]),add(c,[0,0,depth/2]),r);cylinder(`crane.pin-cap.${name}`,'steel','crane',add(c,[0,0,depth/2]),add(c,[0,0,depth/2+.045]),r*.54);}
 box('crane.hydraulic-mount','crane','crane',A,[.25,.20,.20]);
 const hydraulicAxis=norm(sub(B,A)),bodyEnd=add(A,mul(hydraulicAxis,.64)),rodStart=add(A,mul(hydraulicAxis,.52));
 cylinder('crane.hydraulic.body','dark','crane',A,bodyEnd,.09);
 cylinder('crane.hydraulic.rod','steel','crane',rodStart,B,.043);
 for(const [name,c] of [['base',A],['boom',B]])cylinder(`crane.hydraulic.eye.${name}`,'crane-light','crane',add(c,[0,0,-.12]),add(c,[0,0,.12]),.113);
 cylinder('crane.hoist.cable','dark','crane',T,H,.025,8);
 const hookCenter=add(H,[0,-.17,0]),hookCenters=[],hookRadials=[];for(let i=0;i<=18;i++){const a=Math.PI/2+1.5*Math.PI*i/18;const radial=[Math.cos(a),Math.sin(a),0];hookCenters.push(add(hookCenter,mul(radial,.17)));hookRadials.push(radial);}tube('crane.hook','steel','crane',hookCenters,hookRadials,.045,8);
 crate('crane.load','crane',add(H,[0,-.83,0]),[1,.5,.72]);
 let slingIndex=0;for(const x of [-1,1])for(const z of [-1,1])cylinder(`crane.sling.${slingIndex++}`,'dark','crane',add(H,[0,-.30,0]),add(H,[x*.39,-.562,z*.27]),.022,8);
 const r=p.opening_width/2,outer=r+.2,cx=1.2,sy=1.1;
 box('wall.pier.left','brick','static',[(-.6+cx-r)/2,.55,-2.05],[cx-r+.6,1.1,.3]);
 box('wall.pier.right','brick','static',[(cx+r+3)/2,.55,-2.05],[3-cx-r,1.1,.3]);
 box('wall.upper-side.left','brick','static',[(-.6+cx-outer)/2,1.85,-2.05],[cx-outer+.6,1.5,.3]);
 box('wall.upper-side.right','brick','static',[(cx+outer+3)/2,1.85,-2.05],[3-cx-outer,1.5,.3]);
 for(let i=0;i<12;i++){const a=Math.PI-i*Math.PI/12,b=Math.PI-(i+1)*Math.PI/12,point=(t,rr)=>[cx+rr*Math.cos(t),sy+rr*Math.sin(t)],ia=point(a,r),ib=point(b,r),oa=point(a,outer),ob=point(b,outer),suffix=String(i).padStart(2,'0');extrude(`wall.arch.${suffix}`,i%2?'brick-alt':'cap','static',[ia,ib,ob,oa],-2.212,-1.888);extrude(`wall.spandrel.${suffix}`,'brick','static',[oa,ob,[ob[0],2.6],[oa[0],2.6]],-2.20,-1.90);}
 box('wall.cap','cap','static',[1.2,2.66,-2.05],[3.78,.12,.42]);
 box('wall.lamp.backplate','dark','static',[2.61,1.76,-1.85],[.22,.30,.06]);
 box('wall.lamp.diffuser','lamp','static',[2.61,1.76,-1.795],[.14,.20,.055]);
 // One topological hollow surface, separated by material only at its rims.
 const R=p.pipe_bend_radius,O=[.85,.24,1.72],verts=[],outerRings=[],innerRings=[],centers=[],outs=[],ins=[],rims=[];
 for(let i=0;i<=12;i++){const t=i*Math.PI/24,c=add(O,[R*Math.sin(t),R*(1-Math.cos(t)),0]),n=[-Math.sin(t),Math.cos(t),0];centers.push(c);const outerIds=[],innerIds=[];for(const [radius,ids] of [[.24,outerIds],[.175,innerIds]])for(let j=0;j<12;j++){ids.push(verts.length);const a=j*Math.PI/6;verts.push(add(c,add(mul(n,radius*Math.cos(a)),[0,0,radius*Math.sin(a)])));}outerRings.push(outerIds);innerRings.push(innerIds);}
 function pipeQuad(list,ids,out){if(dot(cross(sub(verts[ids[1]],verts[ids[0]]),sub(verts[ids[2]],verts[ids[0]])),out)<0)ids.reverse();list.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);}
 for(let i=0;i<12;i++)for(let j=0;j<12;j++){const k=(j+1)%12;for(const [rings,list,sign] of [[outerRings,outs,1],[innerRings,ins,-1]]){const ids=[rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]],out=mul(sub(mean(ids.map(v=>verts[v])),mean([centers[i],centers[i+1]])),sign);pipeQuad(list,ids,out);}}
 for(const i of [0,12])for(let j=0;j<12;j++){const k=(j+1)%12;pipeQuad(rims,[outerRings[i][j],innerRings[i][j],innerRings[i][k],outerRings[i][k]],i===0?[-1,0,0]:[0,1,0]);}
 finish('pipe.hollow-elbow.outer','pipe','static',verts,outs,{kind:'hollow-pipe',outerRings,innerRings});
 finish('pipe.hollow-elbow.inner','pipe-inside','static',verts,ins,{kind:'hollow-pipe',outerRings,innerRings});
 finish('pipe.hollow-elbow.rims','pipe','static',verts,rims,{kind:'hollow-pipe',outerRings,innerRings});
 crate('prop.crate','static',[2.92,.32,.58],[.66,.64,.64]);
 cylinder('prop.drum.body','pipe','static',[-3.16,0,2.05],[-3.16,.69,2.05],.29);
 for(const [i,y] of [[0,.10],[1,.59]])cylinder(`prop.drum.band.${i}`,'steel','static',[-3.16,y-.025,2.05],[-3.16,y+.025,2.05],.307);
 cylinder('prop.bollard','crane','static',[3.24,0,-1.12],[3.24,.65,-1.12],.105);
 cylinder('prop.bollard.cap','dark','static',[3.24,.55,-1.12],[3.24,.64,-1.12],.113);
 if(edit!=='baseline')throw Error('Interior-face diagnostic is baseline-only.');
 const hiddenIndexOffsets={"wall.pier.left":[18,19,20,21,22,23],"wall.pier.right":[18,19,20,21,22,23],"wall.spandrel.00":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.01":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.02":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.03":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.04":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.05":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.06":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.07":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.08":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.09":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.10":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.spandrel.11":[18,19,20,21,22,23,30,31,32,33,34,35],"wall.upper-side.left":[12,13,14,15,16,17,30,31,32,33,34,35],"wall.upper-side.right":[12,13,14,15,16,17,24,25,26,27,28,29]};
 for(const part of parts){const offsets=hiddenIndexOffsets[part.name];if(offsets){const hidden=new Set(offsets);part.indices=part.indices.filter((_,i)=>!hidden.has(i));}}
 return {schema:'aperture.crane-author-a.v1',edit,parameters:p,parts,cameras:CAMERAS,cameraTarget:[0,1.4,0],verticalSpan:10.5};
}
