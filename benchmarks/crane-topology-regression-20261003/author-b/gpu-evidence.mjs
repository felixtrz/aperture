/** Read actual renderer-owned buffers without modifying engine sources or data. */
export function createGpuEvidence(renderer, topologyDraws) {
  const device = renderer.backend.device;
  const bufferIds = new WeakMap();
  const previousBuffers = new Map();
  let nextBufferId = 1, staging = null, stagingSize = 0;
  const counters = { distinctGeometryGpuBuffersObserved: 0, geometryGpuBufferReplacementsObserved: 0, readbackBuffersCreated: 0, readbackBufferDestroyCalls: 0, readbackSubmissions: 0, completedReadbacks: 0 };
  const idFor = buffer => {
    if (!bufferIds.has(buffer)) { bufferIds.set(buffer, nextBufferId++); counters.distinctGeometryGpuBuffersObserved++; }
    return bufferIds.get(buffer);
  };
  async function read(meshes) {
    const slots = [], inventory = [];
    let byteLength = 0;
    for (const mesh of meshes) for (const [semantic, attribute] of [['position', mesh.geometry.getAttribute('position')], ['normal', mesh.geometry.getAttribute('normal')], ['index', mesh.geometry.index]]) {
      const buffer = renderer.backend.get(attribute).buffer;
      const descriptor = { mesh: mesh.name, semantic, geometryId: mesh.geometry.id, attributeId: attribute.id,
        attributeVersion: attribute.version, arrayType: attribute.array.constructor.name, itemSize: attribute.itemSize,
        count: attribute.count, normalized: attribute.normalized, cpuByteOffset: attribute.array.byteOffset, cpuByteLength: attribute.array.byteLength, attributeUsage: attribute.usage,
        gpuAllocated: Boolean(buffer) };
      if (buffer) {
        const key = `${mesh.id}:${semantic}`, prior = previousBuffers.get(key);
        if (prior && prior !== buffer) counters.geometryGpuBufferReplacementsObserved++;
        previousBuffers.set(key, buffer);
        Object.assign(descriptor, { nativeDrawBufferId: topologyDraws.idFor(buffer), observedGpuBufferIdentity: idFor(buffer), gpuBufferSize: buffer.size, gpuBufferUsage: buffer.usage, gpuBufferLabel: buffer.label });
        if (!(buffer.usage & GPUBufferUsage.COPY_SRC)) throw Error(`Native stream is not readable: ${key}`);
        if (buffer.size !== attribute.array.byteLength) throw Error(`Unexpected native stream layout: ${key}`);
        slots.push({ mesh, semantic, attribute, buffer, offset: byteLength, descriptor });
        byteLength += buffer.size;
      } else if (semantic !== 'normal') throw Error(`Rendered native ${semantic} GPUBuffer absent: ${mesh.name}`);
      inventory.push(descriptor);
    }
    if (!staging || stagingSize < byteLength) {
      if (staging) { staging.destroy(); counters.readbackBufferDestroyCalls++; }
      staging = device.createBuffer({ label: 'crane-live-native-readback', size: byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      stagingSize = byteLength; counters.readbackBuffersCreated++;
    }
    const encoder = device.createCommandEncoder({ label: 'crane-live-native-readback' });
    for (const slot of slots) encoder.copyBufferToBuffer(slot.buffer, 0, staging, slot.offset, slot.buffer.size);
    device.queue.submit([encoder.finish()]); counters.readbackSubmissions++;
    await staging.mapAsync(GPUMapMode.READ, 0, byteLength);
    const bytes = staging.getMappedRange(0, byteLength).slice();
    staging.unmap(); counters.completedReadbacks++;
    const streamsByMesh = new Map(meshes.map(mesh => [mesh.name, []]));
    const comparisons = [];
    for (const slot of slots) {
      const actualBytes = new Uint8Array(bytes, slot.offset, slot.buffer.size);
      const cpuBytes = new Uint8Array(slot.attribute.array.buffer, slot.attribute.array.byteOffset, slot.attribute.array.byteLength);
      const matches = cpuBytes.every((value, i) => value === actualBytes[i]);
      comparisons.push({ name: `${slot.mesh.name}:${slot.semantic} actual GPU bytes equal installed native CPU bytes`, ok: matches, byteLength: actualBytes.length });
      streamsByMesh.get(slot.mesh.name).push({ semantic: slot.semantic, provenance: 'Actual renderer.backend BufferAttribute GPUBuffer copied by GPUCommandEncoder.copyBufferToBuffer then MAP_READ',
        arrayType: slot.attribute.array.constructor.name, itemSize: slot.attribute.itemSize, count: slot.attribute.count, normalized: slot.attribute.normalized,
        byteOffset: 0, byteStride: slot.attribute.itemSize * slot.attribute.array.BYTES_PER_ELEMENT, byteLength: slot.buffer.size,
        format: slot.semantic === 'index' ? 'uint32' : 'float32x3', bufferUsage: slot.buffer.usage,
        rawBytes: Array.from(actualBytes), byteOrder: new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4 ? 'little-endian' : 'big-endian',
        data: Array.from(new slot.attribute.array.constructor(bytes, slot.offset, slot.attribute.array.length)) });
    }
    return { streamsByMesh, comparisons, inventory, counters: { ...counters }, stagingBufferSize: stagingSize };
  }
  return { read, counters };
}
