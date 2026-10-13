import type { RenderSnapshot } from "./snapshot-core-types.js";
/**
 * Recursively encode a structured-clone value into a JSON-safe value, replacing
 * every typed array (at any depth) with a tagged base64 node. Plain objects,
 * arrays, and primitives pass through unchanged; asset handles such as
 * `{ kind, id }` are ordinary objects and are preserved verbatim.
 */
export declare function encodeTypedArrayTree(value: unknown): unknown;
/**
 * Inverse of {@link encodeTypedArrayTree}: rebuild every tagged base64 node into
 * its exact typed-array constructor and otherwise clone the tree.
 */
export declare function decodeTypedArrayTree(value: unknown): unknown;
/**
 * Encode a {@link RenderSnapshot} to a JSON-safe value (typed arrays tagged).
 */
export declare function renderSnapshotToJsonValue(snapshot: RenderSnapshot): unknown;
/**
 * Rebuild a {@link RenderSnapshot} from a value produced by
 * {@link renderSnapshotToJsonValue}. The `quads` buffers are reconstructed
 * through {@link createQuadSnapshotBuffers} so their ABI version/stride literals
 * are canonical and pass `assertQuadSnapshotBuffers`.
 */
export declare function renderSnapshotFromJsonValue(value: unknown): RenderSnapshot;
//# sourceMappingURL=snapshot-json.d.ts.map