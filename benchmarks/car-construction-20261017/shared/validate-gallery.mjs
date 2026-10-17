import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const site=process.argv[2];assert(site,'Pass deployed static directory');
const page=path.join(site,'car-construction');
const html=fs.readFileSync(path.join(page,'index.html'),'utf8');
let assets=0;
for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
 const value=m[1];if(/^(?:https?:|#)/.test(value))continue;
 const p=path.resolve(page,value);assert(p.startsWith(path.resolve(site)));assert(fs.existsSync(p),`Missing: ${value}`);assets++;
}
for(const file of fs.readdirSync(path.join(page,'images'))){const b=fs.readFileSync(path.join(page,'images',file));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),1200);assert.equal(b.readUInt32BE(20),900);}
const images=['before','after','three','street-after','side','rear'].map(n=>({src:`images/${n}.png`,alt:n}));
const links=images.map(img=>({href:img.src,querySelector:()=>img}));
const buttons=['before','after'].map(n=>({dataset:{street:n},attrs:{},setAttribute(k,v){this.attrs[k]=v;}}));
const enlarged={},original={},caption={};
const viewer={open:false,querySelector:()=>enlarged,showModal(){this.open=true;},close(){this.open=false;},addEventListener(event,fn){this[event]=fn;}};
const elements={'street-image':images[3],'street-link':links[3],'street-caption':caption,viewer,original};
const document={getElementById:id=>elements[id],querySelectorAll:q=>q==='button[data-street]'?buttons:q==='.image-link'?links:[]};
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
vm.runInNewContext(script,{document});
buttons[0].onclick();assert.equal(images[3].src,'images/street-before.png');assert.equal(links[3].href,images[3].src);assert.equal(buttons[0].attrs['aria-pressed'],'true');
buttons[1].onclick();assert.equal(images[3].src,'images/street-after.png');assert.equal(buttons[0].attrs['aria-pressed'],'false');
for(const link of links){let prevented=false;link.onclick({preventDefault(){prevented=true;}});assert(prevented&&viewer.open);assert.equal(original.href,link.querySelector().src);assert.equal(enlarged.src,original.href);viewer.click({target:viewer});assert.equal(viewer.open,false);}
viewer.showModal=undefined;let prevented=false;links[0].onclick({preventDefault(){prevented=true;}});assert.equal(prevented,false);
console.log(JSON.stringify({assetsChecked:assets,pngsChecked:9,streetToggle:true,imageViewer:true,pngFallback:true,browserQA:false}));
