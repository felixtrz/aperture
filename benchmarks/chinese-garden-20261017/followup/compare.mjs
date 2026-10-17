import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readPngImage} from '../../../test/e2e/png.ts';
const dir=import.meta.dirname;
const pairs=[['dawn-cold-3.png','browser-3.png'],['browser-3.png','generated-3.png'],['generated-1.png','generated-3.png'],['generated-3.png','../diagnostics/outlines/fixed/render.png']];
const comparisons=[];
for(const [a,b] of pairs){
 const x=readPngImage(await fs.readFile(`${dir}/${a}`)),y=readPngImage(await fs.readFile(`${dir}/${b}`));
 assert.equal(x.width,y.width); assert.equal(x.height,y.height);
 let max=0,sum=0,changed=0;
 for(let p=0;p<x.width*x.height;p++){let differs=false;for(let c=0;c<3;c++){const d=Math.abs(x.pixels[p*x.bytesPerPixel+c]-y.pixels[p*y.bytesPerPixel+c]);max=Math.max(max,d);sum+=d;differs ||= d!==0;}if(differs)changed++;}
 comparisons.push({a,b,max,mean:sum/(x.width*x.height*3),changedPixels:changed});
}
await fs.writeFile(`${dir}/comparison.json`,JSON.stringify({tolerance:{mean:0.5,max:12},comparisons},null,2));
console.log(JSON.stringify(comparisons));
assert(comparisons.every(c=>c.mean<=0.5&&c.max<=12));
