/** Checks use actual native vertex buffers, native indices, and native matrices. */
import { buildScene, EDITS } from './scene-data.mjs';
const TOLERANCE=2e-5;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/length(a));
export function transformPoint(p,m) {
  return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
}
export function nativeVertex(mesh,i) { return transformPoint(Array.from(mesh.positions.slice(i*3,i*3+3)),mesh.matrix); }
export function marker(mesh,key) {
  const ids=mesh.markers[key];
  if(!ids?.length) throw new Error(`Missing vertex marker ${mesh.name}:${key}`);
  return mul(ids.reduce((sum,i)=>add(sum,nativeVertex(mesh,i)),[0,0,0]),1/ids.length);
}
function bounds(mesh) {
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<mesh.positions.length/3;i++) {
    const v=nativeVertex(mesh,i);
    for(let k=0;k<3;k++) { low[k]=Math.min(low[k],v[k]);high[k]=Math.max(high[k],v[k]); }
  }
  return [low,high];
}
function hitTriangle(origin,dir,a,b,c,limit) {
  const e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);
  if(Math.abs(det)<1e-10) return false;
  const inv=1/det,s=sub(origin,a),u=inv*dot(s,h);
  if(u < -1e-8 || u > 1+1e-8) return false;
  const q=cross(s,e1),v=inv*dot(dir,q);
  if(v < -1e-8 || u+v > 1+1e-8) return false;
  const t=inv*dot(e2,q);
  return t>1e-7 && t<limit-1e-7;
}
function anyHit(meshes,origin,dir,limit) {
  for(const mesh of meshes) for(let i=0;i<mesh.indices.length;i+=3) {
    if(hitTriangle(origin,dir,...Array.from(mesh.indices.slice(i,i+3),v=>nativeVertex(mesh,v)),limit)) return true;
  }
  return false;
}
export function inspectScene(data) {
  const meshes=new Map(data.meshes.map(m=>[m.name,m])),checks=[];
  const get=name=>{if(!meshes.has(name))throw new Error(`Missing mesh ${name}`);return meshes.get(name);};
  const at=(name,key)=>marker(get(name),key);
  const near=(name,actual,expected)=>{
    const error=Array.isArray(actual)?length(sub(actual,expected)):Math.abs(actual-expected);
    checks.push({name,ok:error<=TOLERANCE,error,actual,expected});
  };
  const predicate=(name,ok,details)=>checks.push({name,ok,...details});
  const p=data.parameters;
  const lower=get('crane.boom.lower'),P=marker(lower,'start'),E=marker(lower,'end');
  const upper=get('crane.boom.upper'),U=marker(upper,'start'),T=marker(upper,'end');
  const cable=get('crane.hoist.cable'),H=marker(cable,'end');
  near('lower boom length from end-face centroids',length(sub(E,P)),2.6);
  near('upper boom length from end-face centroids',length(sub(T,U)),1.7);
  near('elbow face centroids coincide',E,U);
  for(const [name,point] of [['shoulder',P],['elbow',E],['tip',T]]) {
    const pin=get(`crane.pin.${name}`);
    near(`${name} pin axis midpoint`,mul(add(marker(pin,'start'),marker(pin,'end')),.5),point);
  }
  near('cable attaches at native tip',marker(cable,'start'),T);
  near('cable world vertical and requested length',sub(T,H),[0,p.hoist_length,0]);
  near('hook first ring attaches at cable end',at('crane.hook','start'),H);
  near('hook bottom ring center',at('crane.hook','bottom'),add(H,[0,-.34,0]));
  const body=get('crane.hydraulic.body'),rod=get('crane.hydraulic.rod');
  const A=marker(body,'start'),bodyEnd=marker(body,'end'),rodStart=marker(rod,'start'),B=marker(rod,'end');
  const hydraulicAxis=unit(sub(B,A));
  near('hydraulic body length',length(sub(bodyEnd,A)),.64);
  near('rod overlap from actual end rings',length(sub(bodyEnd,rodStart)),.12);
  near('body and rod coaxial',length(cross(sub(bodyEnd,A),sub(B,A))),0);
  near('rod start coaxial',length(cross(sub(rodStart,A),sub(B,A))),0);
  near('hydraulic base eye midpoint',mul(add(at('crane.hydraulic.eye.base','start'),at('crane.hydraulic.eye.base','end')),.5),A);
  near('hydraulic moving eye midpoint',mul(add(at('crane.hydraulic.eye.boom','start'),at('crane.hydraulic.eye.boom','end')),.5),B);
  near('body end follows its axis',bodyEnd,add(A,mul(hydraulicAxis,.64)));
  // Compare local native markers with the specified local attachments; world yaw is applied by the native matrix.
  const lift=p.top_tier_height-.18,localP=[-2.15,1.25+lift,.15],theta=p.shoulder_deg*Math.PI/180;
  near('hydraulic fixed attachment',A,transformPoint(add(localP,[.5,-.35,.3]),body.matrix));
  near('hydraulic moving attachment',B,transformPoint(add(localP,[.9*Math.cos(theta),.9*Math.sin(theta),.3]),body.matrix));
  near('load center follows hoist',at('crane.load.body','center'),add(H,[0,-.83,0]));
  let si=0;
  for(const x of [-.39,.39]) for(const z of [-.27,.27]) {
    const sling=get(`crane.sling.${si++}`),end=marker(sling,'end');
    near(`${sling.name} top`,marker(sling,'start'),add(H,[0,-.30,0]));
    const offset=transformPoint([x,0,z],[...sling.matrix.slice(0,12),0,0,0,1]);
    near(`${sling.name} lower attachment`,end,add(H,add(offset,[0,-.562,0])));
    // Each native endpoint lies on the physical top reinforcement strip.
    const trim=get(`crane.load.strap-top.${x<0?0:1}`);
    const invYaw=-p.assembly_yaw_deg*Math.PI/180,delta=sub(end,marker(trim,'center'));
    const dx=Math.cos(invYaw)*delta[0]+Math.sin(invYaw)*delta[2];
    const dz=-Math.sin(invYaw)*delta[0]+Math.cos(invYaw)*delta[2];
    predicate(`${sling.name} intersects trim volume`,Math.abs(dx)<=.0425+TOLERANCE&&Math.abs(delta[1])<=.0175+TOLERANCE&&Math.abs(dz)<=.3925+TOLERANCE);
  }
  const r=p.opening_width/2;
  near('arch left actual inner edge',at('wall.arch.00','inner0'),[1.2-r,1.1,-2.05]);
  near('arch right actual inner edge',at('wall.arch.11','inner1'),[1.2+r,1.1,-2.05]);
  near('arch actual apex',at('wall.arch.05','inner1'),[1.2,1.1+r,-2.05]);
  for(let i=0;i<12;i++) {
    const name=`wall.arch.${String(i).padStart(2,'0')}`;
    near(`${name} radial thickness`,length(sub(at(name,'outer0'),at(name,'inner0'))),.2);
  }
  const wall=data.meshes.filter(m=>m.name.startsWith('wall.')&&!m.name.startsWith('wall.lamp'));
  for(const frac of [-.8,-.4,0,.4,.8]) for(const y of [.55,1.1+.5*Math.sqrt(r*r-(frac*r)**2)]) {
    predicate(`through-wall bore x=${frac}, y=${y}`,!anyHit(wall,[1.2+frac*r,y,0],[0,0,-1],4));
  }
  const tube=get('pipe.hollow-elbow'),R=p.pipe_bend_radius,centers=[];
  for(let i=0;i<=12;i++) {
    const outer=marker(tube,`outer.${i}`),inner=marker(tube,`inner.${i}`),a=i*Math.PI/24;
    centers.push(outer);
    near(`pipe ring ${i} centerline`,outer,[.85+R*Math.sin(a),.24+R*(1-Math.cos(a)),1.72]);
    near(`pipe ring ${i} concentric bore`,inner,outer);
    for(const [kind,radius] of [['outer',.24],['inner',.175]]) for(const vi of tube.markers[`${kind}.${i}`]) near(`pipe ${kind} ring ${i} vertex ${vi} radius`,length(sub(nativeVertex(tube,vi),outer)),radius);
  }
  predicate('pipe start open bore from native triangle intersections',!anyHit([tube],add(centers[0],[-.08,0,0]),[1,0,0],.12));
  predicate('pipe end open bore from native triangle intersections',!anyHit([tube],add(centers[12],[0,-.04,0]),[0,1,0],.12));
  const tierBounds=bounds(get('platform.upper'));
  near('upper tier bottom',tierBounds[0][1],.32);
  near('upper tier top',tierBounds[1][1],.32+p.top_tier_height);
  near('crane foot contact',bounds(get('crane.foot'))[0][1],tierBounds[1][1]);
  predicate('all native arrays finite',data.meshes.every(m=>[m.positions,m.normals,m.matrix].every(a=>Array.from(a).every(Number.isFinite))));
  predicate('all native indices in range',data.meshes.every(m=>Array.from(m.indices).every(i=>Number.isInteger(i)&&i>=0&&i<m.positions.length/3)));
  return {ok:checks.every(c=>c.ok),tolerance:TOLERANCE,checks,actual:{P,E,T,H,A,B,bodyEnd,rodStart,pipeCenters:centers,tierBounds},counts:{meshes:data.meshes.length,vertices:data.meshes.reduce((n,m)=>n+m.positions.length/3,0),triangles:data.meshes.reduce((n,m)=>n+m.indices.length/3,0)}};
}
function scoped(edit,name) {
  const suspended=name.startsWith('crane.load.')||name.startsWith('crane.sling.')||name==='crane.hook';
  if(edit==='shoulder') return suspended||['crane.boom.lower','crane.boom.upper','crane.pin.elbow','crane.pin-cap.elbow','crane.pin.tip','crane.pin-cap.tip','crane.hydraulic.body','crane.hydraulic.rod','crane.hydraulic.eye.boom','crane.hoist.cable'].includes(name);
  if(edit==='elbow') return suspended||['crane.boom.upper','crane.pin.tip','crane.pin-cap.tip','crane.hoist.cable'].includes(name);
  if(edit==='hoist') return suspended||name==='crane.hoist.cable';
  if(edit==='arch') return name.startsWith('wall.')&&!['wall.cap','wall.lamp.backplate','wall.lamp.diffuser'].includes(name);
  if(edit==='pipe') return name==='pipe.hollow-elbow';
  if(edit==='tier') return name==='platform.upper'||name.startsWith('crane.');
  if(edit==='assembly') return name.startsWith('platform.')||name.startsWith('crane.');
  return false;
}
export function checkEdits() {
  const baseline=buildScene(),baseByName=new Map(baseline.meshes.map(m=>[m.name,m])),results={baseline:inspectScene(baseline)};
  for(const edit of Object.keys(EDITS).filter(e=>e!=='baseline')) {
    const data=buildScene(edit),result=inspectScene(data),outside=[],motion=[];
    for(const mesh of data.meshes) {
      const base=baseByName.get(mesh.name);
      if(!scoped(edit,mesh.name)) {
        const exact=['positions','normals','indices','matrix'].every(key=>mesh[key].length===base[key].length&&Array.from(mesh[key]).every((v,i)=>Object.is(v,base[key][i])));
        outside.push({name:mesh.name,ok:exact});
      }
      if((edit==='tier'&&mesh.group==='crane')||(edit==='assembly'&&['platform','crane'].includes(mesh.group))||(edit==='hoist'&&(mesh.name==='crane.hook'||mesh.name.startsWith('crane.load.')||mesh.name.startsWith('crane.sling.')))) {
        let maxError=0;
        for(let i=0;i<mesh.positions.length/3;i++) {
          const v=nativeVertex(base,i);
          const expected=edit==='assembly'?transformPoint(v,mesh.matrix):add(v,[0,edit==='tier'?.2:-.4,0]);
          maxError=Math.max(maxError,length(sub(nativeVertex(mesh,i),expected)));
        }
        motion.push({name:mesh.name,ok:maxError<=TOLERANCE,maxError});
      }
    }
    result.unchangedOutsideScope=outside;result.rigidMotion=motion;
    result.ok&&=outside.every(c=>c.ok)&&motion.every(c=>c.ok);
    results[edit]=result;
  }
  return {ok:Object.values(results).every(r=>r.ok),tolerance:TOLERANCE,results};
}
