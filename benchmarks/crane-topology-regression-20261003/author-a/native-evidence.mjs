/** Read native MeshAsset arrays without replacing, transforming or welding them. */
export const jsonValue = value => JSON.parse(JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? Array.from(v) : v));
const ARRAY_TYPES = { Float32Array, Uint32Array, Uint16Array, Uint8Array };
const RAW_BYTE_ENCODING = 'native-typed-array-u8-v1';

/** Capture the genuine view's byte range before any JSON/numeric conversion. */
export function nativeArrayEvidence(data) {
  const Constructor = ARRAY_TYPES[data?.constructor?.name];
  if (!Constructor || !(data instanceof Constructor)) throw Error('Unsupported native typed array');
  const rawBytes = Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return { rawByteEncoding: RAW_BYTE_ENCODING, rawBytes, dataType: data.constructor.name,
    byteLength: data.byteLength, dataByteOffset: data.byteOffset, dataLength: data.length,
    dataBufferByteLength: data.buffer.byteLength, data: Array.from(data) };
}

/** Raw bytes are mandatory. Numeric JSON arrays can never reconstruct evidence. */
export function nativeEvidenceBytes(evidence) {
  const Constructor = ARRAY_TYPES[evidence?.dataType];
  if (!Constructor || evidence.rawByteEncoding !== RAW_BYTE_ENCODING) throw Error('Missing native raw-byte encoding');
  const { rawBytes, byteLength, dataByteOffset, dataLength, dataBufferByteLength } = evidence;
  if (![byteLength, dataByteOffset, dataLength, dataBufferByteLength].every(n => Number.isSafeInteger(n) && n >= 0)
    || byteLength !== dataLength * Constructor.BYTES_PER_ELEMENT
    || dataByteOffset % Constructor.BYTES_PER_ELEMENT !== 0
    || dataByteOffset + byteLength > dataBufferByteLength
    || !Array.isArray(rawBytes) || rawBytes.length !== byteLength) {
    throw Error('Invalid native raw-byte range or payload');
  }
  // Iteration also sees sparse holes as undefined, rather than silently zero-filling.
  for (const byte of rawBytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw Error('Invalid native raw-byte payload value');
  }
  return new Uint8Array(rawBytes);
}

function nativeBufferEvidence(buffer) {
  const { data, ...layout } = buffer;
  const captured = nativeArrayEvidence(data);
  return { ...jsonValue(layout), ...captured };
}

export function decodePositions(streams) {
  const stream = streams.find(s => s.attributes.some(a => a.semantic === 'POSITION'));
  if (!stream) throw Error('Native POSITION stream missing');
  const attribute = stream.attributes.find(a => a.semantic === 'POSITION');
  if (attribute.format !== 'float32x3') throw Error(`Unsupported native POSITION format: ${attribute.format}`);
  const rawBytes = nativeEvidenceBytes(stream);
  const bytes = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength), values = [];
  for (let vertex = 0; vertex < stream.vertexCount; vertex++) for (let axis = 0; axis < 3; axis++) values.push(bytes.getFloat32(vertex * stream.arrayStride + attribute.offset + axis * 4, true));
  return values;
}
export function nativeMeshEvidence(name, asset, worldMatrix, metadata = {}) {
  const streams = asset.vertexStreams.map(nativeBufferEvidence);
  const indexBuffer = asset.indexBuffer ? nativeBufferEvidence(asset.indexBuffer) : null;
  return { name, ...metadata, positions: decodePositions(streams), indices: indexBuffer ? indexBuffer.data : [], indexed: !!indexBuffer, indexBuffer, streams, submeshes: jsonValue(asset.submeshes), worldMatrix, localAabb: jsonValue(asset.localAabb), localSphere: jsonValue(asset.localSphere) };
}
export function compareNativeToSource(scene, meshes) {
  const checks = [];
  for (const part of scene.parts) {
    const native = meshes.find(m => m.name === part.name);
    if (!native) { checks.push({ name: `${part.name}:present`, ok: false }); continue; }
    const expected = part.extrusion ? part.positions.flat() : part.indices.flatMap(i => part.positions[i]);
    checks.push({ name: `${part.name}:exact-native-positions`, ok: JSON.stringify(native.positions) === JSON.stringify(expected), vertices: native.positions.length / 3 });
    checks.push({ name: `${part.name}:actual-indices`, ok: JSON.stringify(native.indices) === JSON.stringify(part.extrusion ? part.indices : []) });
    checks.push({ name: `${part.name}:ECS-world-matrix`, ok: JSON.stringify(native.worldMatrix) === JSON.stringify(part.worldMatrix) });
    const triangleIndices = native.indexed ? native.indices : Array.from({ length: native.positions.length / 3 }, (_, i) => i);
    const valid = triangleIndices.length % 3 === 0 && triangleIndices.every(i => Number.isInteger(i) && i >= 0 && i * 3 + 2 < native.positions.length) && native.positions.every(Number.isFinite);
    checks.push({ name: `${part.name}:finite-native-triangles`, ok: valid, triangles: triangleIndices.length / 3 });
  }
  return { ok: checks.every(c => c.ok), checks };
}
