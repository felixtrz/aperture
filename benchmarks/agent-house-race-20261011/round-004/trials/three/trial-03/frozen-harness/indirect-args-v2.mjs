/** Self-contained for pre-boot injection. Reads only owned native CPU captures. */
export function createIndirectArgumentTrackerV2({ maxWitnesses = 16384 } = {}) {
  const states = new WeakMap(),
    witnesses = [],
    witnessByKey = new Map();
  let frameRefs = new Map(),
    frameUnretained = 0,
    capacityExceeded = false;
  const state = (record) => {
    let result = states.get(record);
    if (!result) {
      result = { ranges: [], reason: "no-proven-cpu-argument-span" };
      states.set(record, result);
    }
    return result;
  };
  const unknown = (reason) => ({ known: false, triangles: 0, reason });
  const invalidate = (record, reason) => {
    if (record) {
      const value = state(record);
      value.ranges = [];
      value.reason = reason;
    }
  };
  const cpuWrite = (
    record,
    offset,
    length,
    { retained = true, shared = false } = {},
  ) => {
    if (!(record.usage & 256)) return;
    if (
      !retained ||
      shared ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length <= 0 ||
      offset + length > record.requestedBytes
    ) {
      invalidate(
        record,
        shared
          ? "shared-cpu-write-unprovable"
          : "cpu-argument-capture-unavailable",
      );
      return;
    }
    const value = state(record),
      spans = [...value.ranges, [offset, offset + length]].sort(
        (a, b) => a[0] - b[0],
      ),
      merged = [];
    for (const span of spans) {
      const previous = merged.at(-1);
      if (previous && previous[1] >= span[0])
        previous[1] = Math.max(previous[1], span[1]);
      else merged.push(span.slice());
    }
    value.ranges = merged;
    value.reason = "no-proven-cpu-argument-span";
  };
  const inspect = (
    record,
    method,
    offset,
    topology,
    maxContribution = Number.MAX_SAFE_INTEGER,
  ) => {
    if (!record || !(record.usage & 256))
      return unknown("untracked-or-nonindirect-buffer");
    if (record.usage & 128) return unknown("storage-buffer-gpu-writable");
    if (record.destroyed || record.indirectMapped)
      return unknown("destroyed-or-mapped-buffer");
    const capture = record.argumentCapture ?? record;
    if (
      record.captureTruncated ||
      record.captureIncomplete ||
      capture.captureTruncated ||
      capture.captureIncomplete
    )
      return unknown("incomplete-native-capture");
    const indexed = method === "drawIndexedIndirect",
      length = indexed ? 20 : 16;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset % 4 ||
      offset + length > record.requestedBytes
    )
      return unknown("invalid-indirect-argument-offset");
    const value = state(record);
    if (
      !value.ranges.some(
        ([start, end]) => start <= offset && end >= offset + length,
      )
    )
      return unknown(value.reason);
    if (
      topology !== "triangle-list" &&
      !(topology === "triangle-strip" && !indexed)
    )
      return unknown(
        topology === "triangle-strip"
          ? "indexed-strip-restart-unproven"
          : "unsupported-indirect-topology",
      );
    const raw = new Uint8Array(length);
    for (let byte = 0; byte < length; byte++) {
      const absolute = offset + byte,
        segment = capture.segments.find(
          (part) =>
            part.offset <= absolute &&
            part.offset + part.bytes.length > absolute,
        );
      if (!segment) return unknown("argument-span-not-retained");
      raw[byte] = segment.bytes[absolute - segment.offset];
    }
    const view = new DataView(raw.buffer),
      count = view.getUint32(0, true),
      instances = view.getUint32(4, true);
    const triangles =
      (topology === "triangle-list"
        ? Math.floor(count / 3)
        : Math.max(0, count - 2)) * instances;
    if (!Number.isSafeInteger(triangles) || triangles > maxContribution)
      return unknown("unsafe-indirect-triangle-count");
    const witness = {
      sequence: witnesses.length,
      method,
      topology,
      bufferId: record.id,
      byteOffset: offset,
      argumentBytesHex: Array.from(raw, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
      count,
      instances,
      first: view.getUint32(8, true),
      ...(indexed
        ? {
            baseVertex: view.getInt32(12, true),
            firstInstance: view.getUint32(16, true),
          }
        : { firstInstance: view.getUint32(12, true) }),
      triangles,
    };
    witness.provenance = "complete-owned-cpu-span-with-no-modeled-gpu-mutation";
    const key = JSON.stringify([
      method,
      topology,
      record.id,
      offset,
      witness.argumentBytesHex,
      witness.provenance,
    ]);
    let id = witnessByKey.get(key);
    if (id === undefined) {
      if (witnesses.length >= maxWitnesses) {
        capacityExceeded = true;
        frameUnretained++;
        return {
          known: true,
          triangles,
          witnessId: null,
          proofIncomplete: true,
        };
      }
      id = witnesses.length;
      witness.sequence = id;
      witnesses.push(witness);
      witnessByKey.set(key, id);
    }
    frameRefs.set(id, (frameRefs.get(id) ?? 0) + 1);
    return { known: true, triangles, witnessId: id };
  };
  return {
    cpuWrite,
    invalidate,
    inspect,
    count: () => witnesses.length,
    beginSample: () => {
      frameRefs = new Map();
      frameUnretained = 0;
    },
    sampleReferences: () => ({
      references: [...frameRefs].sort(([a], [b]) => a - b),
      unretainedKnownDrawCalls: frameUnretained,
    }),
    exportProof: () => ({
      schema: "aperture.native-indirect-arguments.v2.1",
      capacityExceeded,
      maxWitnesses,
      witnesses: witnesses.map((item) => ({ ...item })),
    }),
    invalidateAll: (records, reason) => {
      for (const record of records)
        if (record.usage & 256) invalidate(record, reason);
    },
  };
}
