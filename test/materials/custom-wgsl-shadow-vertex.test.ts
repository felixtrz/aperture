import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  validateCustomMaterialSource,
  type CustomWgslMaterialAsset,
} from "@aperture-engine/render";

// A4 (three.js parity plan): optional `entryPoints.shadowVertex` on custom
// WGSL materials — validation, prepared-material flow, and pipeline-key
// stability (absent field => byte-identical key to the pre-A4 algorithm).

const FLAG_WGSL = [
  "struct V { p: vec4f }",
  "@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(0); }",
  "@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1); }",
  "@vertex fn shadow_main() -> @builtin(position) vec4f { return vec4f(0); }",
  "",
].join("\n");

// Byte-for-byte the key the pre-A4 algorithm produced for this source: the
// `shadow-vs:` segment participates only when the entry point is authored.
const BASELINE_PIPELINE_KEY =
  "example/flag|shader:513192bb|vs:vs_main|fs:fs_main|instance-attributes:none|features:|specialization:5465b825|bindings:|opaque|back|less|none";

function flagMaterial(
  entryPoints: CustomWgslMaterialAsset["entryPoints"],
  code: string = FLAG_WGSL,
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    familyKey: "example/flag",
    label: "Flag",
    shader: { kind: "inline-wgsl", code },
    entryPoints,
    bindings: [],
  });
}

describe("custom WGSL shadowVertex entry point", () => {
  it("accepts a valid optional shadow vertex entry point", () => {
    const diagnostics = validateCustomMaterialSource(
      flagMaterial({
        vertex: "vs_main",
        fragment: "fs_main",
        shadowVertex: "shadow_main",
      }),
    );

    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("keeps materials without a shadow vertex entry point valid", () => {
    const diagnostics = validateCustomMaterialSource(
      flagMaterial({ vertex: "vs_main", fragment: "fs_main" }),
    );

    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("rejects a shadow vertex entry point that is not a WGSL function name", () => {
    const diagnostics = validateCustomMaterialSource(
      flagMaterial({
        vertex: "vs_main",
        fragment: "fs_main",
        shadowVertex: "1-bad name",
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.invalidDependency",
        severity: "error",
        message: expect.stringContaining("entryPoints.shadowVertex"),
      }),
    );
  });

  it("rejects an inline shader missing the declared shadow vertex entry point", () => {
    const diagnostics = validateCustomMaterialSource(
      flagMaterial({
        vertex: "vs_main",
        fragment: "fs_main",
        shadowVertex: "missing_entry",
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.invalidDependency",
        severity: "error",
        message: expect.stringContaining(
          "missing shadow vertex entry point 'missing_entry'",
        ),
      }),
    );
  });

  it("keeps the pipeline key byte-identical when shadowVertex is absent", () => {
    const prepared = createPreparedCustomWgslMaterial({
      source: flagMaterial({ vertex: "vs_main", fragment: "fs_main" }),
      assetKey: "material:flag",
      shaderCode: FLAG_WGSL,
      shaderSourceKey: "inline:material:flag:source",
    });

    expect(prepared.pipelineKey).toBe(BASELINE_PIPELINE_KEY);
    expect(prepared.pipelineKey).not.toContain("shadow-vs:");
    expect(prepared.shader.shadowVertexEntryPoint).toBeUndefined();
    expect(prepared.pipeline.shadowVertexEntryPoint).toBeUndefined();
    expect("shadowVertexEntryPoint" in prepared.shader).toBe(false);
  });

  it("folds shadowVertex into the pipeline key and prepared material", () => {
    const prepared = createPreparedCustomWgslMaterial({
      source: flagMaterial({
        vertex: "vs_main",
        fragment: "fs_main",
        shadowVertex: "shadow_main",
      }),
      assetKey: "material:flag",
      shaderCode: FLAG_WGSL,
      shaderSourceKey: "inline:material:flag:source",
    });

    expect(prepared.pipelineKey).not.toBe(BASELINE_PIPELINE_KEY);
    expect(prepared.pipelineKey).toBe(
      BASELINE_PIPELINE_KEY.replace(
        "|fs:fs_main|",
        "|fs:fs_main|shadow-vs:shadow_main|",
      ),
    );
    expect(prepared.shader.shadowVertexEntryPoint).toBe("shadow_main");
    expect(prepared.pipeline.shadowVertexEntryPoint).toBe("shadow_main");
  });
});
