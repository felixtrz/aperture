/** Transparent observation only: each original native API is called unchanged. */
import { nativeEvidenceBytes } from './native-evidence.mjs';

export function compareNativeUploadBytes(uploadBytes, native) {
  let expectedBytes;
  try { expectedBytes = nativeEvidenceBytes(native); }
  catch (error) { return { ok: false, reason: String(error.message ?? error) }; }
  if (!(uploadBytes instanceof Uint8Array) || uploadBytes.length < expectedBytes.length) {
    return { ok: false, reason: 'Observed GPU allocation is shorter than the native byte range', nativeByteLength: expectedBytes.length };
  }
  let mismatchCount = 0, firstMismatchByte = null;
  for (let i = 0; i < expectedBytes.length; i++) {
    if (expectedBytes[i] !== uploadBytes[i]) { mismatchCount++; firstMismatchByte ??= i; }
  }
  return { ok: mismatchCount === 0, nativeByteLength: expectedBytes.length,
    nativeDataByteOffset: native.dataByteOffset, mismatchCount, firstMismatchByte,
    comparison: 'Exact preserved native Uint8 bytes against observed upload bytes; allocation padding is outside the native view.' };
}

export function installGpuObserver(topologyDraws) {
  const byObject = new WeakMap(), records = [], devices = [];
  const counts = { buffersCreated: 0, bufferDestroyCalls: 0, queueWriteBufferCalls: 0, geometryBufferCreates: 0, geometryBufferReplacements: 0, geometryBufferWrites: 0, geometryBytesWritten: 0 };
  const labelsSeen = new Set();
  const nativeRequest = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...args) {
    const device = await nativeRequest.apply(this, args);
    devices.push(device);
    const createBuffer = device.createBuffer;
    device.createBuffer = function (...values) {
      const buffer = createBuffer.apply(this, values), descriptor = values[0];
      counts.buffersCreated++;
      const geometry = !!(descriptor.usage & (0x10 | 0x20));
      const record = { id: counts.buffersCreated, nativeDrawBufferId: topologyDraws.idFor(buffer), label: descriptor.label ?? '', size: descriptor.size, usage: descriptor.usage, geometry, bytes: geometry ? new Uint8Array(descriptor.size) : null, writes: 0, binds: 0, destroyed: false };
      if (geometry) {
        counts.geometryBufferCreates++;
        if (labelsSeen.has(record.label)) counts.geometryBufferReplacements++;
        labelsSeen.add(record.label);
      }
      byObject.set(buffer, record); records.push(record);
      const destroy = buffer.destroy;
      buffer.destroy = function (...values) { const result = destroy.apply(this, values); record.destroyed = true; counts.bufferDestroyCalls++; return result; };
      return buffer;
    };
    const writeBuffer = device.queue.writeBuffer;
    device.queue.writeBuffer = function (buffer, bufferOffset, data, dataOffset = 0, size) {
      const result = writeBuffer.call(this, buffer, bufferOffset, data, dataOffset, size);
      counts.queueWriteBufferCalls++;
      const record = byObject.get(buffer);
      if (record?.geometry) {
        const elementBytes = ArrayBuffer.isView(data) ? (data.BYTES_PER_ELEMENT ?? 1) : 1;
        const sourceBuffer = ArrayBuffer.isView(data) ? data.buffer : data;
        const sourceStart = (ArrayBuffer.isView(data) ? data.byteOffset : 0) + dataOffset * elementBytes;
        const byteLength = size === undefined ? data.byteLength - dataOffset * elementBytes : size * elementBytes;
        record.bytes.set(new Uint8Array(sourceBuffer, sourceStart, byteLength), bufferOffset);
        record.writes++; counts.geometryBufferWrites++; counts.geometryBytesWritten += byteLength;
      }
      return result;
    };
    return device;
  };
  for (const prototype of [globalThis.GPURenderPassEncoder?.prototype, globalThis.GPURenderBundleEncoder?.prototype]) {
    if (!prototype) continue;
    for (const method of ['setVertexBuffer', 'setIndexBuffer']) {
      const original = prototype[method];
      prototype[method] = function (...args) {
        const result = original.apply(this, args), buffer = args[method === 'setVertexBuffer' ? 1 : 0], record = byObject.get(buffer);
        if (record) record.binds++;
        return result;
      };
    }
  }
  function exportBuffer(record, native) {
    if (!record) return { ok: false, reason: 'No matching live native buffer was bound for a draw' };
    const comparison = compareNativeUploadBytes(record.bytes, native);
    return { ...comparison, bufferId: record.id, nativeDrawBufferId: record.nativeDrawBufferId, label: record.label, allocationBytes: record.size, usage: record.usage, writeCalls: record.writes, nativeBindCalls: record.binds, fullUploadBytes: Array.from(record.bytes), definition: 'Bytes copied from successful actual queue.writeBuffer invocations into this genuine native GPUBuffer; full allocation includes zero padding. This is upload observation, not GPU readback or residency measurement.' };
  }
  return {
    evidence(meshes, submittedDraws) {
      const checks = [], buffers = [];
      const submitted = submittedDraws.draws.flatMap(draw => [...draw.vertices, ...(draw.index ? [draw.index] : [])]);
      const matches = label => { const ids = [...new Set(submitted.filter(binding => binding.label === label).map(binding => binding.id))]; return ids.length ? ids.map(id => records.find(record => record.nativeDrawBufferId === id && record.label === label && !record.destroyed)) : [null]; };
      for (const mesh of meshes) {
        for (const stream of mesh.streams) {
          const label = `${mesh.name}/vertex:${stream.id}`;
          for (const selected of matches(label)) {
            const record = exportBuffer(selected, stream);
            buffers.push({ name: mesh.name, streamId: stream.id, ...record });
            checks.push({ name: `${mesh.name}:${stream.id}:submitted-exact-buffer-upload-equals-native-stream`, ok: record.ok });
          }
        }
        if (mesh.indexBuffer) {
          for (const selected of matches(`${mesh.name}/index`)) {
            const record = exportBuffer(selected, mesh.indexBuffer);
            buffers.push({ name: mesh.name, kind: 'index', ...record });
            checks.push({ name: `${mesh.name}:submitted-exact-buffer-upload-equals-native-indices`, ok: record.ok });
          }
        }
      }
      return { buffers, checks };
    },
    counters() { return { ...counts, deviceCount: devices.length, liveGeometryBuffers: records.filter(r => r.geometry && !r.destroyed).length, definitions: {
      buffersCreated: 'Successful actual GPUDevice.createBuffer returns on the persistent device.',
      geometryBufferCreates: 'Actual buffers created with VERTEX or INDEX usage.',
      geometryBufferReplacements: 'Additional actual VERTEX/INDEX buffer allocations having an already-observed native buffer label; initial allocations excluded.',
      geometryBufferWrites: 'Actual successful queue.writeBuffer calls targeting observed VERTEX or INDEX buffers.',
      geometryBytesWritten: 'Bytes passed to those native writes, including rewrites; not memory consumption.',
      bufferDestroyCalls: 'Explicit destroy calls on actual observed GPUBuffer objects; no GC inference.',
      nativeBindCalls: 'Observed actual setVertexBuffer/setIndexBuffer calls on render-pass or render-bundle encoders.'
    } }; }
  };
}
