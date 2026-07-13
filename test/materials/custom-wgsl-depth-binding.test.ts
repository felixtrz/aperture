import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  createSamplerAsset,
  validateCustomMaterialSource,
  type CustomWgslBindingDeclaration,
  type CustomWgslMaterialAsset,
  type RenderStateDescriptor,
} from "@aperture-engine/render";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

// B4 (three.js parity plan): custom materials can bind a depth texture and the
// renderer-owned scene depth, with a comparison-capable sampler option. The
// binding-layout variants (depth / unfilterable-float / comparison /
// multisampled / cube / scene-depth) close the pre-B4 float/2d/filtering
// hard-coding, and participate in the pipeline key ONLY when set to a
// non-default value so every pre-B4 material keeps a byte-identical key.

const WGSL = `
@vertex fn vs_main(@location(0) p: vec3f) -> @builtin(position) vec4f { return vec4f(p, 1.0); }
@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }
`;

const TEXTURE = createTextureHandle("b4.texture");

const TRANSPARENT_STATE: Partial<RenderStateDescriptor> = {
  alphaMode: "blend",
  blend: { preset: "alpha" },
  depth: { test: true, write: false, compare: "less-equal" },
};

function material(
  bindings: CustomWgslBindingDeclaration[],
  renderState?: Partial<RenderStateDescriptor>,
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    familyKey: "test/b4",
    label: "B4",
    shader: { kind: "inline-wgsl", code: WGSL },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    ...(renderState === undefined ? {} : { renderState }),
    bindings,
  });
}

function prepared(source: CustomWgslMaterialAsset) {
  return createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:test/b4",
    shaderCode: WGSL,
    shaderSourceKey: "inline:test",
  });
}

function codes(source: CustomWgslMaterialAsset): readonly string[] {
  return validateCustomMaterialSource(source, {
    expectedFamily: source.familyKey,
  }).map((diagnostic) => diagnostic.code);
}

const defaultTextureBinding: CustomWgslBindingDeclaration = {
  name: "tex",
  binding: 0,
  kind: "texture",
  visibility: ["fragment"],
  texture: TEXTURE,
};

const sceneDepthBinding: CustomWgslBindingDeclaration = {
  name: "sceneDepth",
  binding: 0,
  kind: "texture",
  visibility: ["fragment"],
  source: "scene-depth",
  sampleType: "depth",
};

describe("depth/variant binding declaration validation (B4)", () => {
  it("accepts a scene-depth binding on a transparent material", () => {
    expect(codes(material([sceneDepthBinding], TRANSPARENT_STATE))).toEqual([]);
  });

  it("rejects a scene-depth binding on an opaque material (post-opaque phase)", () => {
    expect(codes(material([sceneDepthBinding]))).toContain(
      "customMaterialSource.sceneDepthRequiresTransparent",
    );
  });

  it("requires sampleType 'depth' for a scene-depth binding", () => {
    expect(
      codes(
        material(
          [{ ...sceneDepthBinding, sampleType: "float" }],
          TRANSPARENT_STATE,
        ),
      ),
    ).toContain("customMaterialSource.invalidBindingDeclaration");
  });

  it("rejects a source-backed binding that ALSO declares a texture handle", () => {
    expect(
      codes(
        material(
          [{ ...sceneDepthBinding, texture: TEXTURE }],
          TRANSPARENT_STATE,
        ),
      ),
    ).toContain("customMaterialSource.invalidBindingDeclaration");
  });

  it("still requires a texture handle for a handle-backed texture binding", () => {
    expect(
      codes(
        material([
          { name: "t", binding: 0, kind: "texture", visibility: ["fragment"] },
        ]),
      ),
    ).toContain("customMaterialSource.invalidBindingDeclaration");
  });

  it("accepts a handle-backed depth texture + comparison sampler pair", () => {
    expect(
      codes(
        material([
          {
            name: "depthTex",
            binding: 0,
            kind: "texture",
            visibility: ["fragment"],
            texture: TEXTURE,
            sampleType: "depth",
          },
          {
            name: "depthSampler",
            binding: 1,
            kind: "sampler",
            visibility: ["fragment"],
            sampler: createSceneSampler(),
            samplerType: "comparison",
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("rejects unknown sampleType / samplerType", () => {
    expect(
      codes(
        material([
          {
            name: "t",
            binding: 0,
            kind: "texture",
            visibility: ["fragment"],
            texture: TEXTURE,
            sampleType: "rgba" as never,
          },
        ]),
      ),
    ).toContain("customMaterialSource.invalidBindingDeclaration");
    expect(
      codes(
        material([
          {
            name: "s",
            binding: 0,
            kind: "sampler",
            visibility: ["fragment"],
            sampler: createSceneSampler(),
            samplerType: "cmp" as never,
          },
        ]),
      ),
    ).toContain("customMaterialSource.invalidBindingDeclaration");
  });
});

describe("prepared scene-depth flag + dependency derivation (B4)", () => {
  it("marks samplesSceneDepth only when a scene-depth binding is present", () => {
    expect(
      prepared(material([sceneDepthBinding], TRANSPARENT_STATE))
        .samplesSceneDepth,
    ).toBe(true);
    expect(prepared(material([defaultTextureBinding])).samplesSceneDepth).toBe(
      undefined,
    );
  });

  it("derives no texture dependency for a source-backed binding", () => {
    const source = material([sceneDepthBinding], TRANSPARENT_STATE);
    expect(source.dependencies).toEqual([]);
    const handleBacked = material([defaultTextureBinding]);
    expect(handleBacked.dependencies).toContainEqual({
      kind: "texture",
      handle: TEXTURE,
    });
  });
});

describe("pipeline-key participation (byte-identity rule) (B4)", () => {
  it("keeps a default float/2d texture binding byte-identical to pre-B4", () => {
    // Byte-for-byte the key the pre-B4 algorithm produced (a default texture
    // binding emits no variant tokens): `0:texture:visibility:fragment`.
    expect(prepared(material([defaultTextureBinding])).pipelineKey).toBe(
      "test/b4|shader:4487ce1b|vs:vs_main|fs:fs_main|instance-attributes:none|features:|specialization:5465b825|bindings:0:texture:visibility:fragment|opaque|back|less|none",
    );
  });

  it("adds the depth + scene-depth variant tokens only when declared", () => {
    expect(
      prepared(material([sceneDepthBinding], TRANSPARENT_STATE)).pipelineKey,
    ).toContain(
      "bindings:0:texture:visibility:fragment:sample:depth:source:scene-depth",
    );
  });

  it("adds sampler:comparison, multisampled, and dim:cube tokens when declared", () => {
    const key = prepared(
      material([
        {
          name: "tex",
          binding: 0,
          kind: "texture",
          visibility: ["fragment"],
          texture: TEXTURE,
          sampleType: "unfilterable-float",
          multisampled: true,
        },
        {
          name: "cube",
          binding: 1,
          kind: "texture",
          visibility: ["fragment"],
          texture: TEXTURE,
          viewDimension: "cube",
        },
        {
          name: "cmp",
          binding: 2,
          kind: "sampler",
          visibility: ["fragment"],
          sampler: createSceneSampler(),
          samplerType: "comparison",
        },
      ]),
    ).pipelineKey;
    expect(key).toContain(
      "0:texture:visibility:fragment:sample:unfilterable-float:multisampled",
    );
    expect(key).toContain("1:texture:visibility:fragment:dim:cube");
    expect(key).toContain("2:sampler:visibility:fragment:sampler:comparison");
  });

  it("keeps a default filtering sampler byte-identical (no variant token)", () => {
    expect(
      prepared(
        material([
          {
            name: "s",
            binding: 0,
            kind: "sampler",
            visibility: ["fragment"],
            sampler: createSceneSampler(),
          },
        ]),
      ).pipelineKey,
    ).toContain("bindings:0:sampler:visibility:fragment|");
  });
});

describe("comparison sampler asset (B4)", () => {
  it("carries the compare function only when set", () => {
    expect(createSamplerAsset({ compare: "less" }).compare).toBe("less");
    expect(createSamplerAsset({}).compare).toBeUndefined();
  });
});

function createSceneSampler() {
  return createSamplerHandle("b4.sampler");
}
