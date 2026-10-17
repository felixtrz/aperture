import {
  decodeTypedArrayTree,
  encodeTypedArrayTree,
} from "./typed-array-json.js";

export interface PortableShaderJobHeader {
  readonly format: "aperture.shader-job";
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  readonly resources: readonly Record<string, unknown>[];
  readonly frames: readonly {
    readonly input: Record<string, unknown>;
    readonly operations: readonly Record<string, unknown>[];
    readonly writes: readonly Record<string, unknown>[];
  }[];
}

export function isShaderJob(
  value: unknown,
): value is Record<string, unknown> & { format: "aperture.shader-job" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "format" in value &&
    value.format === "aperture.shader-job"
  );
}

/** Uses the same exact-byte codec as RenderSnapshot/source assets, in a separate envelope. */
export function encodeShaderJob(job: unknown): unknown {
  validateShaderJob(job);
  return {
    ...(encodeTypedArrayTree(job) as Record<string, unknown>),
    codec: "json-typed-array-v1",
  };
}

export function decodeShaderJob(value: unknown): PortableShaderJobHeader {
  if (!isShaderJob(value) || value.codec !== "json-typed-array-v1")
    throw new Error("Shader jobs require the json-typed-array-v1 codec.");
  const { codec: _codec, ...envelope } = value;
  const decoded = decodeTypedArrayTree(envelope);
  validateShaderJob(decoded);
  return decoded;
}

export function validateShaderJob(
  value: unknown,
): asserts value is PortableShaderJobHeader {
  assertData(value, "job", new Set());
  if (!isShaderJob(value) || value.version !== 1)
    throw new Error("Expected an aperture.shader-job version 1 envelope.");
  for (const dimension of [value.width, value.height])
    if (
      typeof dimension !== "number" ||
      !Number.isSafeInteger(dimension) ||
      dimension < 1 ||
      dimension > 16384
    )
      throw new Error(
        "Shader-job dimensions must be integers from 1 through 16384.",
      );
  if (
    !Array.isArray(value.resources) ||
    !Array.isArray(value.frames) ||
    value.frames.length === 0 ||
    value.frames.length > 4096
  )
    throw new Error(
      "Shader jobs need resources and 1–4096 declarative replay frames.",
    );
  const resourceIds = new Set<string>();
  for (const resource of value.resources) {
    if (
      !record(resource) ||
      typeof resource.id !== "string" ||
      !["buffer", "texture", "sampler"].includes(String(resource.kind)) ||
      resourceIds.has(resource.id)
    )
      throw new Error("Shader job contains an invalid or duplicate resource.");
    resourceIds.add(resource.id);
    if (resource.kind !== "sampler" && !Array.isArray(resource.usage))
      throw new Error(`Resource '${resource.id}' requires explicit usage.`);
    if (resource.data !== undefined && !(resource.data instanceof Uint8Array))
      throw new Error(
        `Resource '${resource.id}' initial contents must be encoded bytes.`,
      );
  }
  for (const frame of value.frames) {
    if (
      !record(frame) ||
      !record(frame.input) ||
      !Array.isArray(frame.operations) ||
      !Array.isArray(frame.writes)
    )
      throw new Error(
        "Each shader-job frame needs input, operations, and writes.",
      );
    const names = new Set<string>();
    for (const operation of frame.operations) {
      if (
        !record(operation) ||
        !["effect", "draw", "compute"].includes(String(operation.kind)) ||
        "encode" in operation ||
        "callback" in operation
      )
        throw new Error(
          "Portable shader jobs support only declarative effect/draw/compute operations; host callbacks are unsupported.",
        );
      if (typeof operation.name !== "string" || names.has(operation.name))
        throw new Error("Shader-job operation names must be unique per frame.");
      names.add(operation.name);
      const artifact = operation.shader;
      if (
        !record(artifact) ||
        artifact.format !== "aperture.shader" ||
        artifact.version !== 1 ||
        typeof artifact.code !== "string" ||
        !Array.isArray(artifact.bindings) ||
        !Array.isArray(artifact.entryPoints) ||
        !Array.isArray(artifact.requiredFeatures) ||
        !Array.isArray(artifact.sourceMap)
      )
        throw new Error(
          `Operation '${operation.name}' needs an embedded shader artifact; application module URLs are unsupported.`,
        );
    }
    for (const write of frame.writes)
      if (
        !record(write) ||
        typeof write.resource !== "string" ||
        !resourceIds.has(write.resource) ||
        !(write.data instanceof Uint8Array) ||
        !Number.isSafeInteger(write.offset)
      )
        throw new Error(
          "Shader-job buffer writes require a declared resource, integer offset and encoded bytes.",
        );
  }
}

export function shaderJobRequiredFeatures(
  job: PortableShaderJobHeader,
): readonly string[] {
  return [
    ...new Set(
      job.frames.flatMap((frame) =>
        frame.operations.flatMap(
          (operation) =>
            (operation.shader as { requiredFeatures: string[] })
              .requiredFeatures,
        ),
      ),
    ),
  ].sort();
}
function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value)
  );
}
function assertData(value: unknown, at: string, active: Set<object>): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return;
  if (typeof value !== "object")
    throw new Error(
      `${at}: portable shader jobs cannot contain functions, undefined, non-finite values, or other host state.`,
    );
  if (active.has(value))
    throw new Error(`${at}: portable shader jobs cannot contain cycles.`);
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new Error(
      `${at}: GPU/host objects cannot be captured; declare replayable resource contents.`,
    );
  active.add(value);
  for (const [key, child] of Object.entries(value))
    assertData(child, `${at}.${key}`, active);
  active.delete(value);
}
