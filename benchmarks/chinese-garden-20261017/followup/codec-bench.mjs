import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {decodeTypedArrayTree as before} from './codec-before.mjs';
import {decodeTypedArrayTree as after} from '../../../packages/shader/dist/typed-array-json.js';
const bundle=JSON.parse(await fs.readFile(new URL('./garden.bundle.json',import.meta.url),'utf8'));
const input={entries:bundle.assets.entries};
assert.deepEqual(after(input),before(input));
const results={before:[],after:[],identical:true};
for(let i=0;i<7;i++) for(const [name,decode] of i%2?[['after',after],['before',before]]:[['before',before],['after',after]]) {
  const start=performance.now(); decode(input); results[name].push(performance.now()-start);
}
await fs.writeFile(new URL('./codec-bench.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
