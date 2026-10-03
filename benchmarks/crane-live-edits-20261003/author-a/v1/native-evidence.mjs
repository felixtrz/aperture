/** Read native MeshAsset arrays without replacing, transforming or welding them. */
export const jsonValue = value => JSON.parse(JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? Array.from(v) : v));
export function decodePositions(streams) {
  const stream = streams.find(s => s.attributes.some(a => a.semantic === 'POSITION'));
  if (!stream) throw Error('Native POSITION stream missing');
  const attribute = stream.attributes.find(a => a.semantic === 'POSITION');
  if (attribute.format !== 'float32x3') throw Error(`Unsupported native POSITION format: ${attribute.format}`);
  const Constructor = { Float32Array, Uint32Array, Uint16Array, Uint8Array }[stream.dataType];
  if (!Constructor) throw Error(`Unsupported stream type: ${stream.dataType}`);
  const bytes = new DataView(new Constructor(stream.data).buffer), values = [];
  for (let vertex = 0; vertex < stream.vertexCount; vertex++) for (let axis = 0; axis < 3; axis++) values.push(bytes.getFloat32(vertex * stream.arrayStride + attribute.offset + axis * 4, true));
  return values;
}
export function nativeMeshEvidence(name, asset, worldMatrix, metadata = {}) {
  const streams = asset.vertexStreams.map(stream => ({ ...jsonValue(stream), dataType: stream.data.constructor.name, byteLength: stream.data.byteLength, data: Array.from(stream.data) }));
  return { name, ...metadata, positions: decodePositions(streams), indices: asset.indexBuffer ? Array.from(asset.indexBuffer.data) : [], indexed: !!asset.indexBuffer, indexBuffer: asset.indexBuffer ? { ...jsonValue(asset.indexBuffer), dataType: asset.indexBuffer.data.constructor.name, byteLength: asset.indexBuffer.data.byteLength } : null, streams, submeshes: jsonValue(asset.submeshes), worldMatrix, localAabb: jsonValue(asset.localAabb), localSphere: jsonValue(asset.localSphere) };
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
