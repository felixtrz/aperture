// Independent actual-triangle probes. No renderer, imports from authors, or parameter claims here.
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function worldVertices(mesh) {
  const raw=mesh.positions, m=mesh.matrix??mesh.worldMatrix;
  const points=Array.isArray(raw[0])?raw:Array.from({length:raw.length/3},(_,i)=>Array.from(raw.slice(3*i,3*i+3)));
  return points.map(p=>m?[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]:p);
}
export function rayHits(meshes,origin,direction,maxDistance=Infinity) {
  const hits=[];
  for(const mesh of meshes) {
    const v=worldVertices(mesh),ix=mesh.indices;
    for(let i=0;i<ix.length;i+=3) {
      const a=v[ix[i]],b=v[ix[i+1]],c=v[ix[i+2]],e1=sub(b,a),e2=sub(c,a),p=cross(direction,e2),det=dot(e1,p);
      if(Math.abs(det)<1e-10)continue;
      const inv=1/det,tv=sub(origin,a),u=dot(tv,p)*inv;
      if(u< -1e-7||u>1+1e-7)continue;
      const q=cross(tv,e1),w=dot(direction,q)*inv;
      if(w< -1e-7||u+w>1+1e-7)continue;
      const t=dot(e2,q)*inv;
      if(t>=0&&t<=maxDistance)hits.push({mesh:mesh.name,triangle:i/3,distance:t});
    }
  }
  return hits.sort((a,b)=>a.distance-b.distance);
}
export function geometryHealth(meshes) {
  const problems=[]; let vertices=0,triangles=0;
  for(const m of meshes) {
    const v=worldVertices(m);vertices+=v.length;triangles+=m.indices.length/3;
    if(m.indices.length%3)problems.push(`${m.name}: incomplete triangle`);
    if(v.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x))))problems.push(`${m.name}: invalid vertex`);
    if(Array.from(m.indices).some(i=>!Number.isInteger(i)||i<0||i>=v.length))problems.push(`${m.name}: invalid index`);
    if(!problems.length)for(let i=0;i<m.indices.length;i+=3){const [a,b,c]=Array.from(m.indices.slice(i,i+3)).map(i=>v[i]);if(Math.hypot(...cross(sub(b,a),sub(c,a)))<1e-10)problems.push(`${m.name}: degenerate triangle ${i/3}`);}
  }
  return {vertices,triangles,problems};
}
export function maxPointDelta(a,b,map=p=>p) {
  const av=worldVertices(a),bv=worldVertices(b);
  if(av.length!==bv.length||a.indices.length!==b.indices.length)return Infinity;
  return Math.max(...av.map((p,i)=>Math.hypot(...sub(map(p),bv[i]))));
}
export function centroid(mesh,indices){const v=worldVertices(mesh);return indices.reduce((s,i)=>s.map((x,j)=>x+v[i][j]/indices.length),[0,0,0]);}
