import { describe, expect, it } from "vitest";
import {
  materialPipelineKeyInputToKey,
  preparedMaterialBindGroupResourceKey,
  preparedMaterialResourceKey,
  type MaterialPipelineKeyInput,
} from "@aperture-engine/render";

// Audit fix A4: the ~130 test/e2e/*.spec.ts proof specs are NOT run by `pnpm run
// check` (vitest excludes test/e2e), so resource-/pipeline-key FORMAT drift rots
// them silently (e.g. custom-material.spec asserted a stale `…|shader:` pipeline
// key, and any spec asserting an un-versioned `prepared-material:` key would now
// be stale after the M7-T6 @v change). These pure key-format contracts run in the
// always-on gate so drift fails fast where contributors expect it.

describe("material resource key format contract (audit A4)", () => {
  it("versions the prepared-material resource key (@v<version>)", () => {
    expect(preparedMaterialResourceKey("material:foo", 1)).toBe(
      "prepared-material:material:foo@v1",
    );
    expect(preparedMaterialResourceKey("material:foo", 7)).toBe(
      "prepared-material:material:foo@v7",
    );
  });

  it("versions the prepared-material bind-group key (@v<version>|pipeline:…)", () => {
    expect(
      preparedMaterialBindGroupResourceKey({
        sourceMaterialKey: "material:foo",
        pipelineKey: "standard|opaque|back|less|none",
        version: 2,
      }),
    ).toBe(
      "prepared-material-bind-group:material:foo@v2|pipeline:standard|opaque|back|less|none",
    );
  });
});

describe("material pipeline key format contract (audit A4 / #11)", () => {
  it("emits family|features…|alphaMode|cullMode|depth|blend with bindings:/specialization: (no shader:)", () => {
    const input = {
      shaderFamily: "example/water",
      features: ["bindings:0:uniform-buffer", "specialization:5465b825"],
      alphaMode: "alpha",
      cullMode: "none",
      frontFace: "ccw",
      depth: { compare: "less" },
      blend: { preset: "blend" },
      colorWriteMask: "all",
    } as unknown as MaterialPipelineKeyInput;

    const key = materialPipelineKeyInputToKey(input);

    expect(key).toBe(
      "example/water|bindings:0:uniform-buffer|specialization:5465b825|alpha|none|less|blend",
    );
    // The custom-material proof spec used to assert "example/water|shader:" — that
    // segment no longer exists; this guards against re-introducing the stale form.
    expect(key).not.toContain("shader:");
    expect(key).toContain("|bindings:");
    expect(key).toContain("|specialization:");
  });

  it("encodes nonzero material depth bias as a pipeline feature token", () => {
    const key = materialPipelineKeyInputToKey({
      shaderFamily: "unlit",
      features: [],
      alphaMode: "blend",
      cullMode: "none",
      frontFace: "ccw",
      depth: {
        test: true,
        write: false,
        compare: "less",
        bias: -2.3,
        biasSlopeScale: 1.5,
      },
      blend: { preset: "alpha" },
      colorWriteMask: "all",
    });

    expect(key).toBe("unlit|depth-bias:-2:1.5|blend|none|less|alpha");
  });

  it("encodes only non-default front-face state as a pipeline feature token", () => {
    const baseInput = {
      shaderFamily: "standard",
      features: ["baseColorTexture"],
      alphaMode: "opaque",
      cullMode: "back",
      depth: { compare: "less" },
      blend: { preset: "none" },
      colorWriteMask: "all",
    } as unknown as Omit<MaterialPipelineKeyInput, "frontFace">;

    expect(
      materialPipelineKeyInputToKey({ ...baseInput, frontFace: "ccw" }),
    ).toBe("standard|baseColorTexture|opaque|back|less|none");
    expect(
      materialPipelineKeyInputToKey({ ...baseInput, frontFace: "cw" }),
    ).toBe("standard|baseColorTexture|front-face:cw|opaque|back|less|none");
  });
});
