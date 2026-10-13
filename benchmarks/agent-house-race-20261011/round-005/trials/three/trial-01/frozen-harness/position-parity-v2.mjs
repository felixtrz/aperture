import { GEOMETRY_V2_LIMITS } from "./geometry-codec-v2.mjs";

/** Bounded exact search. The host independently checks every positive witness. */
export function matchPositionStreamV2(
  positions,
  buffers,
  work,
  limits = GEOMETRY_V2_LIMITS,
) {
  let comparisons = 0;
  const claim = () =>
    ++comparisons <= limits.parityComparisonsPerMesh &&
    ++work.comparisons <= limits.parityComparisonsTotal;
  for (const buffer of buffers) {
    if (!(buffer.usage & 32)) continue;
    for (const segment of buffer.segments) {
      const values = new DataView(
        segment.bytes.buffer,
        segment.bytes.byteOffset,
        segment.bytes.byteLength,
      );
      for (let offset = 0; offset + 12 <= values.byteLength; offset += 4) {
        if (!claim())
          return { matched: false, reason: "comparison-budget-exhausted" };
        if (
          ![0, 1, 2].every(
            (axis) =>
              values.getFloat32(offset + axis * 4, true) ===
              Math.fround(positions.get(axis)),
          )
        )
          continue;
        for (const stride of [12, 24, 32, 40, 48, 64]) {
          const end = offset + (positions.length / 3 - 1) * stride + 12;
          if (end > values.byteLength) continue;
          let matches = true;
          for (let i = 0; i < positions.length; i++) {
            if (!claim())
              return { matched: false, reason: "comparison-budget-exhausted" };
            if (
              values.getFloat32(
                offset + Math.floor(i / 3) * stride + (i % 3) * 4,
                true,
              ) !== Math.fround(positions.get(i))
            ) {
              matches = false;
              break;
            }
          }
          if (matches)
            return {
              matched: true,
              bufferId: buffer.id,
              byteOffset: segment.offset + offset,
              strideBytes: stride,
              vertexCount: positions.length / 3,
            };
        }
      }
    }
  }
  return { matched: false, reason: "no-exact-observed-vertex-upload" };
}

/** Hashes are computed from the owned snapshot before this factory is called. */
export function createPositionParityMatcherV2(
  buffers,
  limits = GEOMETRY_V2_LIMITS,
) {
  const positive = new Map(),
    work = { comparisons: 0, searches: 0, cacheHits: 0 };
  return {
    match(geometryHash, positions) {
      const cached = positive.get(geometryHash);
      if (cached) {
        work.cacheHits++;
        return { ...cached };
      }
      work.searches++;
      const witness = matchPositionStreamV2(positions, buffers, work, limits);
      if (witness.matched) positive.set(geometryHash, witness);
      return witness;
    },
    snapshot: () => ({ ...work }),
  };
}
