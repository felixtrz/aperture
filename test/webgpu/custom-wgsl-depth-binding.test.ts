import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  type CustomWgslBindingDeclaration,
  type CustomWgslMaterialAsset,
  type PreparedCustomWgslMaterial,
  type RenderStateDescriptor,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createCustomWgslMaterialBindGroupLayoutDescriptor,
  prepareCustomWgslAppTextureSamplerBindingResources,
} from "@aperture-engine/webgpu/test-support";

// B4: the WebGPU-side layer of custom-material depth access — the bind-group
// layout honors the declared variant (depth / unfilterable-float / comparison /
// multisampled / cube) instead of the pre-B4 float/2d/filtering hard-coding,
// and a `source: "scene-depth"` binding resolves to the frame's stored depth
// view (or a diagnostic when the route supplied none).

const WGSL = `
@vertex fn vs_main(@location(0) p: vec3f) -> @builtin(position) vec4f { return vec4f(p, 1.0); }
@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }
`;

const TRANSPARENT: Partial<RenderStateDescriptor> = {
  alphaMode: "blend",
  blend: { preset: "alpha" },
  depth: { test: true, write: false, compare: "less-equal" },
};

function prepared(
  bindings: CustomWgslBindingDeclaration[],
  renderState?: Partial<RenderStateDescriptor>,
): PreparedCustomWgslMaterial {
  const source: CustomWgslMaterialAsset = createCustomWgslMaterialAsset({
    familyKey: "test/b4-webgpu",
    label: "B4 WebGPU",
    shader: { kind: "inline-wgsl", code: WGSL },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    ...(renderState === undefined ? {} : { renderState }),
    bindings,
  });
  return createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:test/b4-webgpu",
    shaderCode: WGSL,
    shaderSourceKey: "inline:test",
  });
}

const sceneDepthBinding: CustomWgslBindingDeclaration = {
  name: "sceneDepth",
  binding: 0,
  kind: "texture",
  visibility: ["fragment"],
  source: "scene-depth",
  sampleType: "depth",
};

describe("custom WGSL bind-group layout variants (B4)", () => {
  it("emits a filterable float 2d entry for a default texture binding", () => {
    const descriptor = createCustomWgslMaterialBindGroupLayoutDescriptor(
      prepared([
        {
          name: "tex",
          binding: 0,
          kind: "texture",
          visibility: ["fragment"],
          texture: createTextureHandle("b4.tex"),
        },
      ]),
    );
    expect(descriptor.entries[0]).toMatchObject({
      binding: 0,
      texture: {
        sampleType: "float",
        viewDimension: "2d",
        multisampled: false,
      },
    });
  });

  it("emits a depth 2d entry for a scene-depth binding", () => {
    const descriptor = createCustomWgslMaterialBindGroupLayoutDescriptor(
      prepared([sceneDepthBinding], TRANSPARENT),
    );
    expect(descriptor.entries[0]).toMatchObject({
      binding: 0,
      texture: {
        sampleType: "depth",
        viewDimension: "2d",
        multisampled: false,
      },
    });
  });

  it("emits a multisampled depth entry when declared (MSAA scene depth)", () => {
    const descriptor = createCustomWgslMaterialBindGroupLayoutDescriptor(
      prepared([{ ...sceneDepthBinding, multisampled: true }], TRANSPARENT),
    );
    expect(descriptor.entries[0]?.texture).toMatchObject({
      sampleType: "depth",
      multisampled: true,
    });
  });

  it("emits unfilterable-float / cube / comparison variants when declared", () => {
    const descriptor = createCustomWgslMaterialBindGroupLayoutDescriptor(
      prepared([
        {
          name: "data",
          binding: 0,
          kind: "texture",
          visibility: ["fragment"],
          texture: createTextureHandle("b4.data"),
          sampleType: "unfilterable-float",
        },
        {
          name: "cube",
          binding: 1,
          kind: "texture",
          visibility: ["fragment"],
          texture: createTextureHandle("b4.cube"),
          viewDimension: "cube",
        },
        {
          name: "cmp",
          binding: 2,
          kind: "sampler",
          visibility: ["fragment"],
          sampler: createSamplerHandle("b4.cmp"),
          samplerType: "comparison",
        },
      ]),
    );
    expect(descriptor.entries[0]?.texture?.sampleType).toBe(
      "unfilterable-float",
    );
    expect(descriptor.entries[1]?.texture?.viewDimension).toBe("cube");
    expect(descriptor.entries[2]?.sampler?.type).toBe("comparison");
  });
});

describe("scene-depth binding resolution (B4)", () => {
  const sceneDepthView = { kind: "scene-depth-view" };

  function resolve(sceneDepth: { view: unknown; sampleCount: number } | null) {
    const source = createCustomWgslMaterialAsset({
      familyKey: "test/b4-webgpu",
      label: "B4 WebGPU",
      shader: { kind: "inline-wgsl", code: WGSL },
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: TRANSPARENT,
      bindings: [sceneDepthBinding],
    });
    const material = createPreparedCustomWgslMaterial({
      source,
      assetKey: "material:test/b4-webgpu",
      shaderCode: WGSL,
      shaderSourceKey: "inline:test",
    });
    return prepareCustomWgslAppTextureSamplerBindingResources({
      assets: new AssetRegistry(),
      device: {},
      cache: { textures: new Map(), samplers: new Map() },
      reuse: {
        textureResourcesCreated: 0,
        textureResourcesReused: 0,
        samplerResourcesCreated: 0,
        samplerResourcesReused: 0,
      },
      source,
      material,
      sceneDepth,
    });
  }

  it("binds the frame's scene depth view for a scene-depth binding", () => {
    const result = resolve({ view: sceneDepthView, sampleCount: 1 });
    expect(result.valid).toBe(true);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.resource).toBe(sceneDepthView);
    expect(result.diagnostics).toEqual([]);
  });

  it("diagnoses (loudly) when no scene depth is available this frame", () => {
    const result = resolve(null);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "webGpuApp.customWgslSceneDepthUnavailable",
    );
  });
});
