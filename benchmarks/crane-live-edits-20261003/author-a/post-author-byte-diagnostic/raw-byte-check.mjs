/** CPU fixtures only. Mock GPU APIs are never native WebGPU proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeArrayEvidence, nativeEvidenceBytes, nativeMeshEvidence, decodePositions } from './native-evidence.mjs';
import { compareNativeUploadBytes, installGpuObserver } from './gpu-observer.mjs';
const json = value => JSON.parse(JSON.stringify(value));
const bytes = view => new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const stream = data => ({ id:'position', data, vertexCount:data.length/3, arrayStride:12, attributes:[{semantic:'POSITION',format:'float32x3',offset:0}] });
const asset = (data, indices) => ({ vertexStreams:[stream(data)], ...(indices ? {indexBuffer:{data:indices,format:indices instanceof Uint16Array?'uint16':'uint32'}} : {}), submeshes:[],localAabb:{min:[0,0,0],max:[1,1,1]},localSphere:{center:[0,0,0],radius:1} });

test('signed zero survives raw capture and repeated JSON; legacy reconstruction fails', () => {
  const source = new Float32Array([-0,0,1,-2,3,-0]);
  const evidence = json(json(nativeArrayEvidence(source)));
  assert.equal(Object.is(evidence.data[0],-0),false);
  assert.deepEqual(nativeEvidenceBytes(evidence),bytes(source));
  assert.equal(compareNativeUploadBytes(bytes(source),evidence).ok,true);
  const legacy = bytes(new Float32Array(evidence.data));
  const result = compareNativeUploadBytes(legacy,evidence);
  assert.equal(result.ok,false); assert.equal(result.mismatchCount,2);
});

test('a corrupt sign bit fails even when decoded numeric values compare equal', () => {
  const source = new Float32Array([-0,0,0]); const evidence = json(nativeArrayEvidence(source));
  const corrupt = bytes(source); corrupt[3]^=128;
  assert.ok(new DataView(corrupt.buffer).getFloat32(0,true) === source[0]);
  assert.deepEqual(compareNativeUploadBytes(corrupt,evidence),{
    ok:false,nativeByteLength:12,nativeDataByteOffset:0,mismatchCount:1,firstMismatchByte:3,
    comparison:'Exact preserved native Uint8 bytes against observed upload bytes; allocation padding is outside the native view.'
  });
});

test('a corrupt captured byte fails despite unchanged numeric evidence', () => {
  const source = new Float32Array([1,2,3]); const evidence=json(nativeArrayEvidence(source));
  evidence.rawBytes[0]^=1;
  assert.deepEqual(evidence.data,Array.from(source));
  assert.equal(compareNativeUploadBytes(bytes(source),evidence).ok,false);
});

test('missing raw evidence never falls back to numerically correct arrays', () => {
  const source=new Float32Array([1,2,3]); const evidence=json(nativeArrayEvidence(source));
  delete evidence.rawBytes;
  assert.equal(compareNativeUploadBytes(bytes(source),evidence).ok,false);
  assert.throws(()=>nativeEvidenceBytes(evidence),/raw-byte/);
});

test('view offset and length exclude backing sentinels and capture immutable bytes', () => {
  const backing=new Float32Array([123,-0,2,3,456]); const view=backing.subarray(1,4);
  const original=bytes(view); const evidence=json(nativeArrayEvidence(view));
  assert.equal(evidence.dataByteOffset,4); assert.equal(evidence.byteLength,12);
  assert.equal(evidence.dataLength,3); assert.equal(evidence.dataBufferByteLength,20);
  assert.deepEqual(evidence.rawBytes,Array.from(original));
  backing.fill(9);
  assert.deepEqual(nativeEvidenceBytes(evidence),original);
});

test('POSITION decoding uses captured bytes, stride and attribute offset', () => {
  const backing=new Float32Array([88, 7,-0,2,3, 8,4,5,6, 99]);
  const evidence=nativeArrayEvidence(backing.subarray(1,9));
  const positions=decodePositions([{...json(evidence),vertexCount:2,arrayStride:16,attributes:[{semantic:'POSITION',format:'float32x3',offset:4}]}]);
  assert.deepEqual(positions,[-0,2,3,4,5,6]); assert.equal(Object.is(positions[0],-0),true);
});

for (const Constructor of [Uint16Array,Uint32Array]) test(`${Constructor.name} actual index view survives JSON and rejects corruption`, () => {
  const backing=new Constructor([99,0,1,2,77]),view=backing.subarray(1,4);
  const evidence=json(nativeArrayEvidence(view)), padded=new Uint8Array(Math.ceil(view.byteLength/4)*4);
  padded.set(bytes(view));
  assert.equal(evidence.dataByteOffset,Constructor.BYTES_PER_ELEMENT);
  assert.equal(compareNativeUploadBytes(padded,evidence).ok,true);
  padded[2]^=1; assert.equal(compareNativeUploadBytes(padded,evidence).ok,false);
});

test('mesh serialization retains actual index arrays and does not invent nonindexed indices', () => {
  const positions=new Float32Array([-0,0,0,1,0,0,0,1,0]);
  const indices=new Uint32Array([0,1,2]);
  const indexed=json(nativeMeshEvidence('triangle',asset(positions,indices),identity));
  assert.deepEqual(indexed.indices,[0,1,2]); assert.equal(indexed.indexed,true);
  assert.deepEqual(nativeEvidenceBytes(indexed.indexBuffer),bytes(indices));
  assert.deepEqual(nativeEvidenceBytes(indexed.streams[0]),bytes(positions));
  const nonindexed=json(nativeMeshEvidence('triangle',asset(positions),identity));
  assert.deepEqual(nonindexed.indices,[]);assert.equal(nonindexed.indexBuffer,null);assert.equal(nonindexed.indexed,false);
});

test('malformed byte payload, metadata and truncation fail closed', () => {
  const source=new Float32Array([1,2,3]),original=json(nativeArrayEvidence(source));
  const cases=[
    e=>delete e.rawByteEncoding,e=>e.rawByteEncoding='numeric-fallback',e=>e.dataType='Float64Array',
    e=>e.rawBytes.pop(),e=>e.rawBytes.push(0),e=>delete e.rawBytes[0],e=>e.rawBytes[0]=256,e=>e.rawBytes[0]=-1,e=>e.rawBytes[0]=1.5,
    e=>e.byteLength++,e=>e.dataLength++,e=>e.dataByteOffset=-4,e=>e.dataByteOffset=1,e=>e.dataBufferByteLength--
  ];
  for(const mutate of cases){const e=json(original);mutate(e);assert.equal(compareNativeUploadBytes(bytes(source),e).ok,false);}
  assert.equal(compareNativeUploadBytes(bytes(source).subarray(0,11),original).ok,false);
});

async function withMockGpu(run) {
  const keys=['GPUAdapter','GPURenderPassEncoder','GPURenderBundleEncoder'];
  const saved=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  const calls={requests:[],creates:[],writes:[],binds:[],destroy:0};
  const writeResult=Symbol('original write result');
  class MockBuffer { constructor(descriptor){this.descriptor=descriptor;} destroy(){calls.destroy++;} }
  const queue={writeBuffer(...args){calls.writes.push({receiver:this,args});return writeResult;}};
  const device={queue,createBuffer(...args){calls.creates.push({receiver:this,args});return new MockBuffer(args[0]);}};
  class MockAdapter{async requestDevice(...args){calls.requests.push({receiver:this,args});return device;}}
  class MockEncoder{setVertexBuffer(...args){calls.binds.push({receiver:this,kind:'vertex',args});}setIndexBuffer(...args){calls.binds.push({receiver:this,kind:'index',args});}}
  globalThis.GPUAdapter=MockAdapter;globalThis.GPURenderPassEncoder=MockEncoder;
  globalThis.GPURenderBundleEncoder=class MockBundle extends MockEncoder{};
  try {const observer=installGpuObserver(),adapter=new MockAdapter();const descriptor={label:'cpu-mock-only'};assert.equal(await adapter.requestDevice(descriptor),device);await run({observer,device,encoder:new MockEncoder(),calls,writeResult});}
  finally {for(let i=0;i<keys.length;i++){if(saved[i])Object.defineProperty(globalThis,keys[i],saved[i]);else delete globalThis[keys[i]];}}
}

test('synthetic observer forwards native API inputs and compares genuine view bytes after JSON',async()=>withMockGpu(async({observer,device,encoder,calls,writeResult})=>{
  const backing=new Float32Array([99,-0,2,3,88]),view=backing.subarray(1,4);
  const mesh=json(nativeMeshEvidence('fixture',asset(view),identity));
  const descriptor={label:'fixture/vertex:position',size:12,usage:0x20};
  const buffer=device.createBuffer(descriptor);
  assert.equal(device.queue.writeBuffer(buffer,0,view),writeResult);
  encoder.setVertexBuffer(0,buffer);
  assert.equal(calls.creates[0].receiver,device);assert.equal(calls.creates[0].args[0],descriptor);
  assert.equal(calls.writes[0].receiver,device.queue);assert.equal(calls.writes[0].args[0],buffer);assert.equal(calls.writes[0].args[2],view);
  const result=observer.evidence([mesh]);assert.equal(result.checks.length,1);assert.equal(result.checks[0].ok,true);
  assert.deepEqual(result.buffers[0].fullUploadBytes,Array.from(bytes(view)));
  const corrupt=bytes(view);corrupt[3]^=128;device.queue.writeBuffer(buffer,0,corrupt);
  assert.equal(observer.evidence([mesh]).checks[0].ok,false);
}));

test('synthetic observer handles typed data offsets/sizes, padded indices and missing binds',async()=>withMockGpu(async({observer,device,encoder})=>{
  const backing=new Uint16Array([99,0,1,2,77,66]);const upload=backing.subarray(0,5),native=backing.subarray(1,4);
  const mesh={name:'indexed',streams:[],indexBuffer:json(nativeArrayEvidence(native))};
  const buffer=device.createBuffer({label:'indexed/index',size:8,usage:0x10});
  // Four Uint16 elements uploaded; only three belong to the native index view.
  device.queue.writeBuffer(buffer,0,upload,1,4);
  assert.equal(observer.evidence([mesh]).checks[0].ok,false);
  encoder.setIndexBuffer(buffer,'uint16');
  const result=observer.evidence([mesh]);assert.equal(result.checks[0].ok,true);
  assert.equal(result.buffers[0].nativeByteLength,6);assert.equal(result.buffers[0].fullUploadBytes.length,8);
  const corrupt=bytes(native);corrupt[0]^=1;const padded=new Uint8Array(8);padded.set(corrupt);
  device.queue.writeBuffer(buffer,0,padded);assert.equal(observer.evidence([mesh]).checks[0].ok,false);
  buffer.destroy();assert.equal(observer.evidence([mesh]).checks[0].ok,false);
}));

test('synthetic observer handles ArrayBuffer/DataView byte offsets and destination offsets',async()=>withMockGpu(async({observer,device,encoder})=>{
  const original=new Uint8Array([99,1,2,3,4,5,6,7,8,88]);
  const expected=new Uint8Array([0,0,0,0,3,4,5,6]);
  const mesh={name:'bytes',streams:[{id:'raw',...json(nativeArrayEvidence(expected))}],indexBuffer:null};
  const buffer=device.createBuffer({label:'bytes/vertex:raw',size:8,usage:0x20});encoder.setVertexBuffer(0,buffer);
  device.queue.writeBuffer(buffer,4,original.buffer,3,4);
  assert.equal(observer.evidence([mesh]).checks[0].ok,true);
  const view=new DataView(original.buffer,1,8);
  device.queue.writeBuffer(buffer,4,view,2,4);
  assert.equal(observer.evidence([mesh]).checks[0].ok,true);
}));
