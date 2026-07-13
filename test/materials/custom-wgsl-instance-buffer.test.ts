import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  defineInstanceAttributes,
  validateCustomMaterialSource,
  type CustomWgslMaterialAsset,
} from "@aperture-engine/render";
import { createBufferHandle } from "@aperture-engine/simulation";

// C1 (three.js parity plan): a custom material's per-instance vertex data at
// @location(6+) can be sourced ZERO-COPY from a realized BufferAsset (a compute
// output) instead of from CPU-authored InstanceData. The buffer-backed instance
// stream participates in the pipeline key ONLY when declared (via the same
// `instance-attributes:<layoutKey>` segment as CPU instance attributes), so
// every pre-C1 material keeps a byte-identical key.

const WGSL = `
@vertex fn vs_main(@location(0) p: vec3f) -> @builtin(position) vec4f { return vec4f(p, 1.0); }
@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }
`;

const BUFFER = createBufferHandle("c1.buffer");
const OTHER_BUFFER = createBufferHandle("c1.other-buffer");

function material(
  extra: Partial<CustomWgslMaterialAsset>,
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    familyKey: "test/c1",
    label: "C1",
    shader: { kind: "inline-wgsl", code: WGSL },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    bindings: [
      {
        name: "data",
        binding: 0,
        kind: "storage-buffer",
        visibility: ["vertex"],
        buffer: BUFFER,
      },
    ],
    ...extra,
  });
}

function pipelineKey(source: CustomWgslMaterialAsset): string {
  return createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:test/c1",
    shaderCode: WGSL,
    shaderSourceKey: "inline:test",
  }).pipeline.pipelineKey;
}

function codes(source: CustomWgslMaterialAsset): readonly string[] {
  return validateCustomMaterialSource(source, {
    expectedFamily: source.familyKey,
  }).map((diagnostic) => diagnostic.code);
}

describe("buffer-backed instance stream — pipeline key stability (C1)", () => {
  // Captured from the pre-C1 code path (my change is additive): a storage-binding
  // material without an instance stream is byte-identical. If this literal ever
  // changes, a pre-C1 material's pipeline cache / snapshot / golden would break.
  const PRE_C1_STORAGE_KEY =
    "test/c1|shader:4487ce1b|vs:vs_main|fs:fs_main|instance-attributes:none|features:|specialization:5465b825|bindings:0:storage-buffer:visibility:vertex|opaque|back|less|none";

  it("keeps a storage-binding material byte-identical to the pre-C1 key", () => {
    expect(pipelineKey(material({}))).toBe(PRE_C1_STORAGE_KEY);
  });

  it("binding a writable vs read-only buffer does NOT change the key", () => {
    // The buffer SOURCE (handle / usage) is not a layout fact, so it never
    // enters the pipeline key — only the binding index/kind/visibility do.
    const readOnly = pipelineKey(material({}));
    const other = pipelineKey(
      material({
        bindings: [
          {
            name: "data",
            binding: 0,
            kind: "storage-buffer",
            visibility: ["vertex"],
            buffer: OTHER_BUFFER,
          },
        ],
      }),
    );
    expect(other).toBe(readOnly);
  });

  it("a buffer-backed instance stream adds the instance-attributes segment", () => {
    const withStream = pipelineKey(
      material({
        instanceBuffer: {
          buffer: BUFFER,
          attributes: defineInstanceAttributes([
            { name: "instanceState", format: "float32x4" },
          ]),
        },
      }),
    );

    expect(withStream).not.toBe(PRE_C1_STORAGE_KEY);
    expect(withStream).toContain("instance-attributes:");
    expect(withStream).not.toContain("instance-attributes:none");
    // Only the instance-attributes segment differs; everything else is stable.
    const segments = withStream.split("|");
    const baseSegments = PRE_C1_STORAGE_KEY.split("|");
    const diff = segments.filter((s, i) => s !== baseSegments[i]);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toContain("instance-attributes:");
  });

  it("carries the buffer-backed marker on the prepared pipeline ONLY when declared", () => {
    const plain = createPreparedCustomWgslMaterial({
      source: material({}),
      assetKey: "material:test/c1",
      shaderCode: WGSL,
      shaderSourceKey: "inline:test",
    });
    expect(plain.pipeline.instanceBuffer).toBeUndefined();
    expect(plain.pipeline.instanceAttributes).toBeNull();

    const streamed = createPreparedCustomWgslMaterial({
      source: material({
        instanceBuffer: {
          buffer: BUFFER,
          attributes: defineInstanceAttributes([
            { name: "instanceState", format: "float32x4" },
          ]),
        },
      }),
      assetKey: "material:test/c1",
      shaderCode: WGSL,
      shaderSourceKey: "inline:test",
    });
    expect(streamed.pipeline.instanceBuffer).toEqual({ buffer: BUFFER });
    expect(streamed.pipeline.instanceAttributes?.stride).toBe(16);
    expect(streamed.pipeline.instanceAttributes?.attributes[0]).toMatchObject({
      name: "instanceState",
      format: "float32x4",
      shaderLocation: 6,
    });
  });

  it("derives a buffer dependency from the instance stream (gates readiness)", () => {
    const source = material({
      instanceBuffer: {
        buffer: OTHER_BUFFER,
        attributes: defineInstanceAttributes([
          { name: "instanceState", format: "float32x4" },
        ]),
      },
    });
    expect(source.dependencies).toContainEqual({
      kind: "buffer",
      handle: OTHER_BUFFER,
    });
  });
});

describe("buffer-backed instance stream — validation (C1)", () => {
  it("accepts a well-formed instance stream", () => {
    expect(
      codes(
        material({
          instanceBuffer: {
            buffer: BUFFER,
            attributes: defineInstanceAttributes([
              { name: "instanceState", format: "float32x4" },
            ]),
          },
        }),
      ),
    ).toEqual([]);
  });

  it("rejects declaring BOTH instanceAttributes and instanceBuffer", () => {
    expect(
      codes(
        material({
          instanceAttributes: defineInstanceAttributes([
            { name: "phase", format: "float32" },
          ]),
          instanceBuffer: {
            buffer: BUFFER,
            attributes: defineInstanceAttributes([
              { name: "instanceState", format: "float32x4" },
            ]),
          },
        }),
      ),
    ).toContain("customMaterialSource.invalidInstanceBuffer");
  });

  it("rejects an instance stream without a buffer handle", () => {
    expect(
      codes(
        material({
          instanceBuffer: {
            buffer: undefined as never,
            attributes: defineInstanceAttributes([
              { name: "instanceState", format: "float32x4" },
            ]),
          },
        }),
      ),
    ).toContain("customMaterialSource.invalidInstanceBuffer");
  });

  it("rejects an instance stream with no attributes", () => {
    expect(
      codes(
        material({
          instanceBuffer: {
            buffer: BUFFER,
            attributes: { attributes: [] },
          },
        }),
      ),
    ).toContain("customMaterialSource.invalidInstanceBuffer");
  });
});
