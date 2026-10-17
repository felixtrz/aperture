import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {readPngImage} from '../../../test/e2e/png.ts';
const root=path.resolve(import.meta.dirname,'..');
const site='/workspace/sites/chinese-garden-comparison-20261016/dist';
const dir=path.join(site,'street-corner');
const html=await fs.readFile(path.join(dir,'index.html'),'utf8');
assert(html.startsWith('<!doctype html>'));
assert(!html.includes('data:image/'),'Images must remain external files');
const checked=new Set();
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 const target=match[1];if(/^(?:https?:|#)/.test(target))continue;
 const file=path.resolve(dir,target);const stat=await fs.stat(file);
 if(stat.isDirectory())await fs.access(path.join(file,'index.html'));
 checked.add(target);
}
for(const file of ['REPORT.md','FOLLOW_UP_PLAN.md']){
 const markdown=await fs.readFile(path.join(dir,file),'utf8');
 for(const match of markdown.matchAll(/\]\(([^)]+)\)/g)){
  const target=match[1];if(/^(?:https?:|#)/.test(target))continue;
  await fs.access(path.resolve(dir,target));checked.add(target);
 }
}
const pngs=[];
for(const file of await fs.readdir(path.join(dir,'images'))){
 const png=readPngImage(await fs.readFile(path.join(dir,'images',file)));
 assert(png.width>0&&png.height>0);pngs.push({file,width:png.width,height:png.height});
}
const paths=JSON.parse(html.match(/<script type="application\/json" id="image-paths">([\s\S]*?)<\/script>/)[1]);
const images=Object.keys(paths.final).map(name=>({dataset:{framework:name},src:paths.final[name],alt:name,parentElement:{href:paths.final[name]}}));
const buttons=['first','final'].map(view=>({dataset:{view},attributes:{},classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=v;}}));
const reference={src:'images/reference.png',alt:'reference'};
const links=[reference,...images].map(img=>({querySelector(){return img;}}));
const enlarged={};const viewer={open:false,querySelector(){return enlarged;},showModal(){this.open=true;},close(){this.open=false;},addEventListener(event,fn){this[event]=fn;}};
const document={getElementById(id){return id==='image-paths'?{textContent:JSON.stringify(paths)}:viewer;},querySelectorAll(selector){return selector==='button[data-view]'?buttons:selector==='.image-link'?links:images;}};
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(js,{document});
for(const [i,phase] of ['first','final'].entries()){
 buttons[i].onclick();assert.equal(buttons[i].attributes['aria-pressed'],'true');
 for(const img of images){assert.equal(img.src,paths[phase][img.dataset.framework]);assert.equal(img.parentElement.href,img.src);await fs.access(path.join(dir,img.src));}
}
let prevented=false;links[1].onclick({preventDefault(){prevented=true;}});
assert(prevented&&viewer.open);assert.equal(enlarged.src,images[0].src);
viewer.click({target:viewer});assert(!viewer.open);
viewer.showModal=undefined;prevented=false;links[1].onclick({preventDefault(){prevented=true;}});assert(!prevented,'Direct image fallback must remain available');
const report={checkedAt:new Date().toISOString(),passed:true,localAssetReferences:checked.size,pngs,interactionChecks:['first/final toggle updates all images and links','pressed-state updates','enlargement opens current image','backdrop closes dialog','direct image link preserved without dialog support'],limits:'Local static assets and JavaScript behavior verified. No authenticated hosted-browser visual inspection was available.'};
await fs.writeFile(path.join(root,'evidence/gallery-qa.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
