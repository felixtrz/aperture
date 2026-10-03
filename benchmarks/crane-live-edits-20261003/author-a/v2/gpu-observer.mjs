/** Transparent observation only: each original native API is called unchanged. */
export function installGpuObserver() {
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
      const record = { id: counts.buffersCreated, label: descriptor.label ?? '', size: descriptor.size, usage: descriptor.usage, geometry, bytes: geometry ? new Uint8Array(descriptor.size) : null, writes: 0, binds: 0, destroyed: false };
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
  function find(label) {
    return records.findLast(record => record.geometry && record.label === label && !record.destroyed && record.binds > 0);
  }
  function exportBuffer(record, expected, nativeType) {
    if (!record) return { ok: false, reason: 'No matching live native buffer was bound for a draw' };
    const Constructor = { Float32Array, Uint32Array, Uint16Array, Uint8Array }[nativeType];
    const expectedBytes = new Uint8Array(new Constructor(expected).buffer);
    const matches = expectedBytes.length <= record.bytes.length && expectedBytes.every((byte, i) => byte === record.bytes[i]);
    return { ok: matches, bufferId: record.id, label: record.label, allocationBytes: record.size, usage: record.usage, writeCalls: record.writes, nativeBindCalls: record.binds, fullUploadBytes: Array.from(record.bytes), definition: 'Bytes copied from successful actual queue.writeBuffer invocations into this genuine native GPUBuffer; full allocation includes zero padding. This is upload observation, not GPU readback or residency measurement.' };
  }
  return {
    evidence(meshes) {
      const checks = [], buffers = [];
      for (const mesh of meshes) {
        for (const stream of mesh.streams) {
          const label = `${mesh.name}/vertex:${stream.id}`;
          const record = exportBuffer(find(label), stream.data, stream.dataType);
          buffers.push({ name: mesh.name, streamId: stream.id, ...record });
          checks.push({ name: `${mesh.name}:${stream.id}:bound-GPU-upload-equals-native-stream`, ok: record.ok });
        }
        if (mesh.indexBuffer) {
          const record = exportBuffer(find(`${mesh.name}/index`), mesh.indexBuffer.data, mesh.indexBuffer.dataType);
          buffers.push({ name: mesh.name, kind: 'index', ...record });
          checks.push({ name: `${mesh.name}:bound-GPU-upload-equals-native-indices`, ok: record.ok });
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
