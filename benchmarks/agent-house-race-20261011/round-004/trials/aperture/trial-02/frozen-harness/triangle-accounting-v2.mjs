export const TRIANGLE_ACCOUNTING_V2 = Object.freeze({
  schema: "aperture.native-triangle-accounting.v2.1",
  indirectArgumentBytes: "owned-cpu-capture-at-native-submit",
  captureLifetime: "aperture.native-indirect-capture-lifetime.v2.2",
  storageBuffers: "always-unknown",
  gpuMutations: "invalidate-until-full-argument-span-cpu-overwrite",
  maxWitnesses: 16384,
});
export function validateTriangleAccountingV2(sample) {
  const require = (value, message) => {
    if (!value) throw new Error(message);
  };
  for (const key of [
    "unknownDirectTriangleDrawCalls",
    "knownIndirectDrawCalls",
    "unknownIndirectDrawCalls",
    "knownIndirectTriangles",
  ])
    require(Number.isSafeInteger(sample[key]) &&
      sample[key] >= 0, `Invalid native accounting counter: ${key}`);
  require(sample.knownIndirectDrawCalls + sample.unknownIndirectDrawCalls ===
    sample.indirectDrawCalls, "Indirect native call partition differs");
  require(Array.isArray(sample.nativeIndirectArgumentReferences) &&
    Number.isSafeInteger(sample.unretainedKnownIndirectDrawCalls) &&
    sample.unretainedKnownIndirectDrawCalls >=
      0, "Native argument reference inventory missing");
  let count = sample.unretainedKnownIndirectDrawCalls;
  const ids = new Set();
  for (const [id, multiplicity] of sample.nativeIndirectArgumentReferences) {
    require(Number.isSafeInteger(id) &&
      id >= 0 &&
      !ids.has(id) &&
      Number.isSafeInteger(multiplicity) &&
      multiplicity > 0, "Invalid duplicate native argument reference");
    ids.add(id);
    count += multiplicity;
  }
  require(count ===
    sample.knownIndirectDrawCalls, "Native argument reference multiplicity differs");
  require(sample.unknownIndirectReasons &&
    Object.values(sample.unknownIndirectReasons).every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) &&
    Object.values(sample.unknownIndirectReasons).reduce(
      (sum, value) => sum + value,
      0,
    ) ===
      sample.unknownIndirectDrawCalls, "Unknown indirect reason counts differ");
  const confidence =
    sample.unknownDirectTriangleDrawCalls ||
    sample.unknownIndirectDrawCalls ||
    sample.unknownTopologyDrawCalls ||
    sample.unknownCommandBuffers
      ? "lower-bound"
      : "exact-supported-command-arguments";
  require(sample.submittedTriangleAccounting?.schema ===
    TRIANGLE_ACCOUNTING_V2.schema &&
    sample.submittedTriangleAccounting.confidence ===
      confidence, "Native triangle confidence differs");
  return sample;
}
export function validateTriangleArgumentProofV2(record) {
  const require = (value, message) => {
    if (!value) throw new Error(message);
  };
  const proof = record.nativeIndirectArgumentProof;
  require(proof?.schema === "aperture.native-indirect-arguments.v2.1" &&
    proof.capacityExceeded === false &&
    proof.maxWitnesses === TRIANGLE_ACCOUNTING_V2.maxWitnesses &&
    Array.isArray(proof.witnesses) &&
    proof.witnesses.length <=
      proof.maxWitnesses, "Native indirect argument proof incomplete or over capacity");
  const contributions = [];
  for (const [id, witness] of proof.witnesses.entries()) {
    const indexed = witness.method === "drawIndexedIndirect",
      bytes = indexed ? 20 : 16;
    require(witness.sequence === id &&
      ["drawIndirect", "drawIndexedIndirect"].includes(witness.method) &&
      /^[0-9a-f]+$/.test(witness.argumentBytesHex) &&
      witness.argumentBytesHex.length === bytes * 2 &&
      witness.provenance ===
        "complete-owned-cpu-span-with-no-modeled-gpu-mutation", "Invalid native argument witness bytes/provenance");
    require(witness.topology === "triangle-list" ||
      (!indexed &&
        witness.topology ===
          "triangle-strip"), "Unsupported known indirect topology");
    const raw = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++)
      raw[i] = parseInt(witness.argumentBytesHex.slice(i * 2, i * 2 + 2), 16);
    const view = new DataView(raw.buffer),
      count = view.getUint32(0, true),
      instances = view.getUint32(4, true),
      triangles =
        (witness.topology === "triangle-list"
          ? Math.floor(count / 3)
          : Math.max(0, count - 2)) * instances;
    require(Number.isSafeInteger(triangles) &&
      triangles === witness.triangles &&
      count === witness.count &&
      instances === witness.instances &&
      view.getUint32(8, true) === witness.first &&
      view.getUint32(indexed ? 16 : 12, true) === witness.firstInstance &&
      (!indexed ||
        view.getInt32(12, true) ===
          witness.baseVertex), "Native argument decode/count differs");
    require(Number.isSafeInteger(witness.bufferId) &&
      witness.bufferId >= 0 &&
      Number.isSafeInteger(witness.byteOffset) &&
      witness.byteOffset >= 0 &&
      witness.byteOffset % 4 === 0, "Native argument identity/offset differs");
    contributions.push(triangles);
  }
  for (const sample of [
    ...record.warmup,
    ...record.samples,
    ...(record.views ?? []).map((view) => view.frame),
  ]) {
    validateTriangleAccountingV2(sample);
    require(sample.unretainedKnownIndirectDrawCalls ===
      0, "Unretained known indirect arguments");
    let sum = 0;
    for (const [id, multiplicity] of sample.nativeIndirectArgumentReferences) {
      require(id <
        contributions.length, "Missing native argument dictionary entry");
      sum += contributions[id] * multiplicity;
    }
    require(Number.isSafeInteger(sum) &&
      sum === sample.knownIndirectTriangles &&
      sum <=
        sample.submittedTriangles, "Known indirect triangle contribution differs");
  }
  return record;
}
