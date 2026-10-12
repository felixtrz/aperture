export const GEOMETRY_V2_LIMITS = Object.freeze({
  chunkBytes: 4 * 1024 * 1024,
  geometryBytes: 256 * 1024 * 1024,
  nativeBytes: 64 * 1024 * 1024,
  manifestBytes: 8 * 1024 * 1024,
  meshes: 5000,
  nativeBuffers: 100000,
  nativeSegments: 10000,
  nativeSegmentsPerBuffer: 1000,
  matrixRows: 1000000,
  matrixSourceTypeRuns: 20000,
  transformedVertices: 20000000,
  instancedTriangles: 10000000,
  parityComparisonsPerMesh: 20000000,
  parityComparisonsTotal: 1000000000,
});

const dtypes = Object.freeze({
  Int8Array: { name: "i8", bytes: 1, write: "setInt8", read: "getInt8" },
  Uint8Array: { name: "u8", bytes: 1, write: "setUint8", read: "getUint8" },
  Uint8ClampedArray: {
    name: "u8",
    bytes: 1,
    write: "setUint8",
    read: "getUint8",
  },
  Int16Array: { name: "i16le", bytes: 2, write: "setInt16", read: "getInt16" },
  Uint16Array: {
    name: "u16le",
    bytes: 2,
    write: "setUint16",
    read: "getUint16",
  },
  Int32Array: { name: "i32le", bytes: 4, write: "setInt32", read: "getInt32" },
  Uint32Array: {
    name: "u32le",
    bytes: 4,
    write: "setUint32",
    read: "getUint32",
  },
  Float32Array: {
    name: "f32le",
    bytes: 4,
    write: "setFloat32",
    read: "getFloat32",
  },
  Float64Array: {
    name: "f64le",
    bytes: 8,
    write: "setFloat64",
    read: "getFloat64",
  },
  Array: { name: "f64le", bytes: 8, write: "setFloat64", read: "getFloat64" },
  "matrix-list": {
    name: "f64le",
    bytes: 8,
    write: "setFloat64",
    read: "getFloat64",
  },
});

function requireDraft(value, message) {
  if (!value) throw new Error(message);
}

function sourceType(value) {
  if (Array.isArray(value)) return "Array";
  requireDraft(ArrayBuffer.isView(value), "Numeric array/view required");
  requireDraft(
    Object.prototype.toString.call(value.buffer) !==
      "[object SharedArrayBuffer]",
    "Inspector must return an owned coherent snapshot, not a live SharedArrayBuffer view",
  );
  const name = Object.prototype.toString.call(value).slice(8, -1);
  requireDraft(
    dtypes[name],
    "Unsupported numeric view (BigInt/DataView rejected)",
  );
  return name;
}

function scalarPlan(value) {
  const type = sourceType(value);
  requireDraft(
    Number.isSafeInteger(value.length) && value.length > 0,
    "Nonempty bounded numeric array required",
  );
  return {
    sourceType: type,
    spec: dtypes[type],
    elementCount: value.length,
    get: (offset) => value[offset],
  };
}

function matrixListPlan(value, limits, claimSourceTypeRun) {
  requireDraft(
    Array.isArray(value) &&
      value.length > 0 &&
      value.length <= limits.matrixRows,
    "Invalid matrix-list size",
  );
  // Preserve row container types without one JSON record for every repeated row.
  const sourceTypeRuns = [];
  for (const row of value) {
    const type = sourceType(row);
    requireDraft(
      row.length === 16,
      "Each matrix row must have exactly16 values",
    );
    const prior = sourceTypeRuns.at(-1);
    if (prior?.sourceType === type) prior.count++;
    else {
      claimSourceTypeRun();
      sourceTypeRuns.push({ sourceType: type, count: 1 });
    }
  }
  return {
    sourceType: "matrix-list",
    spec: dtypes["matrix-list"],
    elementCount: value.length * 16,
    sourceTypeRuns,
    get: (offset) => value[Math.floor(offset / 16)][offset % 16],
  };
}

/**
 * Preflight lengths first, then synchronously copy all values into owned chunks
 * before the first hash/POST await. Never retain live author/SAB numeric views.
 * Untyped numbers and all matrix-list values use exact IEEE754 Float64LE.
 */
export function snapshotGeometryNumericArrays(
  meshes,
  limits = GEOMETRY_V2_LIMITS,
) {
  requireDraft(
    Array.isArray(meshes) &&
      meshes.length > 0 &&
      meshes.length <= limits.meshes,
    "Invalid geometry mesh count",
  );
  requireDraft(
    Number.isSafeInteger(limits.chunkBytes) &&
      limits.chunkBytes >= 8 &&
      limits.chunkBytes % 8 === 0,
    "Chunk size must be a positive multiple of8",
  );
  const ids = new Set(),
    plans = [],
    resultMeshes = [];
  let bytes = 0,
    transformedVertices = 0,
    instancedTriangles = 0,
    matrixSourceTypeRuns = 0,
    matrixRows = 0;
  const claimSourceTypeRun = () => {
    matrixSourceTypeRuns++;
    requireDraft(
      matrixSourceTypeRuns <= limits.matrixSourceTypeRuns,
      "Matrix source-type metadata budget exceeded",
    );
  };
  const field = (value, role, components, optional = false) => {
    if (optional && value === undefined) return null;
    const plan =
      role === "instances"
        ? matrixListPlan(value, limits, claimSourceTypeRun)
        : scalarPlan(value);
    requireDraft(
      plan.elementCount % components === 0,
      "Numeric component count differs",
    );
    if (role === "worldMatrix")
      requireDraft(
        plan.elementCount === 16,
        "World matrix must have exactly16 values",
      );
    if (role === "worldMatrix" || role === "instances") {
      matrixRows += plan.elementCount / 16;
      requireDraft(
        matrixRows <= limits.matrixRows,
        "Aggregate matrix row budget exceeded",
      );
    }
    const alignment = plan.spec.bytes;
    const byteOffset = Math.ceil(bytes / alignment) * alignment;
    const byteLength = plan.elementCount * alignment;
    requireDraft(
      Number.isSafeInteger(byteLength) &&
        byteOffset + byteLength <= limits.geometryBytes,
      "Declared geometry byte budget exceeded",
    );
    const descriptor = {
      role,
      sourceType: plan.sourceType,
      dtype: plan.spec.name,
      components,
      elementCount: plan.elementCount,
      byteOffset,
      byteLength,
      ...(plan.sourceTypeRuns ? { sourceTypeRuns: plan.sourceTypeRuns } : {}),
    };
    plans.push({ ...plan, descriptor });
    bytes = byteOffset + byteLength;
    return descriptor;
  };
  for (const mesh of meshes) {
    requireDraft(
      typeof mesh?.id === "string" &&
        new TextEncoder().encode(mesh.id).length > 0 &&
        new TextEncoder().encode(mesh.id).length <= 256 &&
        !ids.has(mesh.id),
      "Missing, duplicate or oversized mesh id",
    );
    ids.add(mesh.id);
    const positions = field(mesh.positions, "positions", 3);
    const indices = field(mesh.indices, "indices", 3, true);
    const normals = field(mesh.normals, "normals", 3, true);
    requireDraft(
      !normals || normals.elementCount === positions.elementCount,
      "Normal element count differs",
    );
    const worldMatrix = field(mesh.worldMatrix, "worldMatrix", 16, true);
    const instances = field(mesh.instances, "instances", 16, true);
    requireDraft(
      worldMatrix || instances,
      "Actual world or instance matrices required",
    );
    const vertices = positions.elementCount / 3;
    const effectiveIndexCount = indices?.elementCount ?? vertices;
    requireDraft(
      effectiveIndexCount % 3 === 0,
      "Triangle-list cardinality differs",
    );
    const instanceCount = instances ? instances.elementCount / 16 : 1;
    transformedVertices += vertices * instanceCount;
    instancedTriangles += (effectiveIndexCount / 3) * instanceCount;
    requireDraft(
      Number.isSafeInteger(transformedVertices) &&
        transformedVertices <= limits.transformedVertices &&
        Number.isSafeInteger(instancedTriangles) &&
        instancedTriangles <= limits.instancedTriangles,
      "Declared exact-inspection work budget exceeded",
    );
    resultMeshes.push({
      id: mesh.id,
      positions,
      indices,
      normals,
      worldMatrix,
      instances,
    });
  }
  const chunkCount = Math.ceil(bytes / limits.chunkBytes);
  const chunks = Array.from(
    { length: chunkCount },
    (_, index) =>
      new Uint8Array(
        Math.min(limits.chunkBytes, bytes - index * limits.chunkBytes),
      ),
  );
  const views = chunks.map(
    (chunk) => new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength),
  );
  for (const plan of plans) {
    const { descriptor, spec } = plan;
    for (let offset = 0; offset < plan.elementCount; offset++) {
      const value = plan.get(offset);
      requireDraft(
        typeof value === "number" && Number.isFinite(value),
        "Nonfinite/non-numeric inspector value",
      );
      const absolute = descriptor.byteOffset + offset * spec.bytes;
      const chunkIndex = Math.floor(absolute / limits.chunkBytes);
      const local = absolute % limits.chunkBytes;
      requireDraft(
        local + spec.bytes <= chunks[chunkIndex].length,
        "Numeric element unexpectedly crosses chunk boundary",
      );
      views[chunkIndex][spec.write](local, value, true);
    }
  }
  return {
    schema: "aperture.geometry-numeric-snapshot.v2",
    endianness: "little",
    totalBytes: bytes,
    chunkBytes: limits.chunkBytes,
    chunkCount,
    limits: { ...limits },
    meshes: resultMeshes,
    chunks,
    // Scalar finite checks above do not replace downstream index-range/affine
    // matrix/triangle/bounds/native parity validation. Those remain mandatory.
  };
}

/** Decoder must be called only after independent file/ACK/chunk SHA validation. */
export function numericFieldReader(descriptor, chunks, chunkBytes) {
  requireDraft(
    Number.isSafeInteger(chunkBytes) && chunkBytes >= 8 && chunkBytes % 8 === 0,
    "Invalid chunk size",
  );
  const spec = Object.values(dtypes).find(
    (item) => item.name === descriptor.dtype,
  );
  requireDraft(
    spec &&
      Number.isSafeInteger(descriptor.byteOffset) &&
      descriptor.byteOffset >= 0 &&
      descriptor.byteOffset % spec.bytes === 0 &&
      Number.isSafeInteger(descriptor.elementCount) &&
      descriptor.elementCount > 0 &&
      Number.isSafeInteger(descriptor.byteLength) &&
      descriptor.byteLength === descriptor.elementCount * spec.bytes &&
      Number.isSafeInteger(descriptor.byteOffset + descriptor.byteLength),
    "Invalid numeric field descriptor",
  );
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  requireDraft(
    descriptor.byteOffset + descriptor.byteLength <= totalBytes,
    "Numeric field escapes retained stream",
  );
  const views = chunks.map((chunk, index) => {
    requireDraft(
      chunk instanceof Uint8Array &&
        chunk.byteLength > 0 &&
        chunk.byteLength <= chunkBytes &&
        (index === chunks.length - 1 || chunk.byteLength === chunkBytes),
      "Invalid chunk layout",
    );
    return new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  });
  return {
    length: descriptor.elementCount,
    get(offset) {
      requireDraft(
        Number.isSafeInteger(offset) &&
          offset >= 0 &&
          offset < descriptor.elementCount,
        "Numeric read outside declared field",
      );
      const absolute = descriptor.byteOffset + offset * spec.bytes;
      return views[Math.floor(absolute / chunkBytes)][spec.read](
        absolute % chunkBytes,
        true,
      );
    },
    *[Symbol.iterator]() {
      for (let index = 0; index < descriptor.elementCount; index++)
        yield this.get(index);
    },
  };
}
