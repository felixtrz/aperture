import type { RenderSnapshot } from "./snapshot-core-types.js";
import {
  createQuadSnapshotBuffers,
  type QuadSnapshotBuffers,
} from "./quad-snapshot.js";

import {
  encodeTypedArrayTree,
  decodeTypedArrayTree,
} from "@aperture-engine/shader";
export {
  encodeTypedArrayTree,
  decodeTypedArrayTree,
} from "@aperture-engine/shader";

/**
 * Encode a {@link RenderSnapshot} to a JSON-safe value (typed arrays tagged).
 */
export function renderSnapshotToJsonValue(snapshot: RenderSnapshot): unknown {
  return encodeTypedArrayTree(snapshot);
}

/**
 * Rebuild a {@link RenderSnapshot} from a value produced by
 * {@link renderSnapshotToJsonValue}. The `quads` buffers are reconstructed
 * through {@link createQuadSnapshotBuffers} so their ABI version/stride literals
 * are canonical and pass `assertQuadSnapshotBuffers`.
 */
export function renderSnapshotFromJsonValue(value: unknown): RenderSnapshot {
  const decoded = decodeTypedArrayTree(value);

  if (!isPlainRecord(decoded)) {
    throw new TypeError(
      "Cannot rebuild a RenderSnapshot: the decoded value is not an object.",
    );
  }

  const quads = decoded["quads"];

  if (isPlainRecord(quads)) {
    decoded["quads"] = canonicalizeQuadBuffers(quads);
  }

  return decoded as unknown as RenderSnapshot;
}

function canonicalizeQuadBuffers(
  quads: Record<string, unknown>,
): QuadSnapshotBuffers {
  const instanceFloats = quads["instanceFloats"];
  const instanceWords = quads["instanceWords"];

  return createQuadSnapshotBuffers({
    ...(instanceFloats instanceof Float32Array ? { instanceFloats } : {}),
    ...(instanceWords instanceof Uint32Array ? { instanceWords } : {}),
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value)
  );
}
