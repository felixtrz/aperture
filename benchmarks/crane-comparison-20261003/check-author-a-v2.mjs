import {writeFile} from 'node:fs/promises';
import {constructScene} from './author-a/v2/scene.mjs';
import {geometryHealth,rayHits,maxPointDelta,centroid,sub} from './geometry-probes.mjs';
const cases=['baseline','shoulder','elbow','hoist','arch','pipe','tier','assembly'];
const scenes=Object.fromEntries(cases.map(e=>[e,constructScene(e).parts]));
const result={kind:'independent actual CPU vertex/triangle audit; native-stream equivalence requires separate review',checks:[],health:{}};
function check(name,ok,details){result.checks.push({name,passed:!!ok,details});}
const get=(edit,name)=>scenes[edit].find(m=>m.name===name);
const near=(a,b)=>Math.hypot(...sub(a,b))<2e-5;
const ends=(e,name)=>{const m=get(e,name);return [centroid(m,m.features.startRing),centroid(m,m.features.endRing)];};
for(const edit of cases){
 const meshes=scenes[edit];result.health[edit]=geometryHealth(meshes);check(`${edit}: finite nondegenerate triangles`,result.health[edit].problems.length===0,result.health[edit].problems);
 const wall=meshes.filter(m=>m.name.startsWith('wall.')),r=edit==='arch'?1.05:.8;
 for(const [tag,p,open] of [['center',[1.2,.7,-1.7],true],['head',[1.2,1.1+r-.04,-1.7],true],['left-jamb',[1.2-r-.04,.7,-1.7],false],['right-jamb',[1.2+r+.04,.7,-1.7],false]]){const n=rayHits(wall,p,[0,0,-1],.7).length;check(`${edit}: arch ${tag}`,open?n===0:n>0,{triangleHits:n});}
 const pipe=meshes.filter(m=>m.name.startsWith('pipe.')),R=edit==='pipe'?1.1:.8;
 for(const [tag,origin,dir,open] of [['start-bore',[.80,.24,1.72],[1,0,0],true],['start-rim',[.80,.24,1.925],[1,0,0],false],['end-bore',[.85+R,.29+R,1.72],[0,-1,0],true],['end-rim',[.85+R,.29+R,1.925],[0,-1,0],false]]){const n=rayHits(pipe,origin,dir,.1).length;check(`${edit}: pipe ${tag}`,open?n===0:n>0,{triangleHits:n});}
 const [lower0,lower1]=ends(edit,'crane.boom.lower'),[upper0,upper1]=ends(edit,'crane.boom.upper'),[cable0,cable1]=ends(edit,'crane.hoist.cable');
 check(`${edit}: lower boom length`,Math.abs(Math.hypot(...sub(lower1,lower0))-2.6)<2e-5);
 check(`${edit}: upper boom length`,Math.abs(Math.hypot(...sub(upper1,upper0))-1.7)<2e-5);
 check(`${edit}: coincident elbow`,near(lower1,upper0));check(`${edit}: cable attached tip`,near(upper1,cable0));
 check(`${edit}: cable world vertical`,Math.abs(cable1[0]-cable0[0])<2e-5&&Math.abs(cable1[2]-cable0[2])<2e-5);
 check(`${edit}: cable length`,Math.abs(Math.hypot(...sub(cable1,cable0))-(edit==='hoist'?1.9:1.5))<2e-5);
}
const scopes={shoulder:n=>n.startsWith('crane.'),elbow:n=>n.startsWith('crane.'),hoist:n=>n.startsWith('crane.'),arch:n=>n.startsWith('wall.')&&!n.includes('lamp')&&!n.endsWith('.cap'),pipe:n=>n.startsWith('pipe.'),tier:n=>n.startsWith('crane.')||n==='platform.upper',assembly:n=>n.startsWith('crane.')||n.startsWith('platform.')};
for(const [edit,affected] of Object.entries(scopes))for(const m of scenes.baseline){if(affected(m.name))continue;const d=maxPointDelta(m,get(edit,m.name));check(`${edit}: unaffected ${m.name}`,d<2e-5,{maxVertexDelta:d});}
for(const m of scenes.baseline.filter(m=>m.name.startsWith('crane.'))){const d=maxPointDelta(m,get('tier',m.name),p=>[p[0],p[1]+.2,p[2]]);check(`tier: crane translates ${m.name}`,d<2e-5,{maxVertexDelta:d});}
const a=20*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
for(const m of scenes.baseline.filter(m=>m.name.startsWith('crane.')||m.name.startsWith('platform.'))){const d=maxPointDelta(m,get('assembly',m.name),p=>[-2.15+c*(p[0]+2.15)+s*(p[2]-.15)+.55,p[1],.15-s*(p[0]+2.15)+c*(p[2]-.15)+.4]);check(`assembly: rigid vertices ${m.name}`,d<2e-5,{maxVertexDelta:d});}
result.passed=result.checks.filter(x=>x.passed).length;result.failed=result.checks.filter(x=>!x.passed);await writeFile(new URL('./independent-a-v2-geometry.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,total:result.checks.length,failed:result.failed}));
