import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  createTextureAsset,
  type CustomWgslBindingDeclaration,
  type CustomWgslMaterialAsset,
  type PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createCustomWgslMaterialBindGroupLayoutDescriptor,
  prepareCustomWgslAppTextureSamplerBindingResources,
} from "@aperture-engine/webgpu/test-support";

// E5: custom-material texture bindings gain "3d" (`texture_3d<f32>`) and
// "2d-array" (`texture_2d_array<f32>`) view dimensions on top of the B4 2d/cube
// set. The variant participates in the bind-group layout and the pipeline key
// ONLY when non-default, so 2d bindings stay byte-identical.

const WGSL = `
@vertex fn vs_main(@location(0) p: vec3f) -> @builtin(position) vec4f { return vec4f(p, 1.0); }
@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }
`;

function prepared(
  bindings: CustomWgslBindingDeclaration[],
): PreparedCustomWgslMaterial {
  const source: CustomWgslMaterialAsset = createCustomWgslMaterialAsset({
    familyKey: "test/e5-textures",
    label: "E5 textures",
    shader: { kind: "inline-wgsl", code: WGSL },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    bindings,
  });
  return createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:test/e5-textures",
    shaderCode: WGSL,
    shaderSourceKey: "inline:test",
  });
}

function textureBinding(
  viewDimension: "2d" | "cube" | "3d" | "2d-array" | undefined,
): CustomWgslBindingDeclaration {
  return {
    name: "vol",
    binding: 0,
    kind: "texture",
    visibility: ["fragment"],
    texture: createTextureHandle("e5.vol"),
    ...(viewDimension === undefined ? {} : { viewDimension }),
  };
}

describe("custom WGSL texture view dimensions (E5)", () => {
  it("emits 3d and 2d-array bind-group layout entries when declared", () => {
    const volume = createCustomWgslMaterialBindGroupLayoutDescriptor(
      prepared([textureBinding("3d")]),
    );
    expect(volume.entries[0]?.texture?.viewDimension).toBe("3d");

    const array = createCustomWgslMaterialBindGroupLayoutDescriptor(
      prepared([{ ...textureBinding("2d-array"), name: "atlas" }]),
    );
    expect(array.entries[0]?.texture?.viewDimension).toBe("2d-array");
  });

  it("adds a dim: pipeline-key token only for non-2d view dimensions", () => {
    const twoD = prepared([textureBinding("2d")]).pipelineKey;
    const defaulted = prepared([textureBinding(undefined)]).pipelineKey;
    const volume = prepared([textureBinding("3d")]).pipelineKey;
    const array = prepared([textureBinding("2d-array")]).pipelineKey;

    // A default/explicit-2d binding contributes no dim token (byte-identical).
    expect(twoD).not.toContain("dim:");
    expect(defaulted).not.toContain("dim:");
    expect(twoD).toBe(defaulted);
    // The new dimensions each get a distinct token → a distinct pipeline.
    expect(volume).toContain("dim:3d");
    expect(array).toContain("dim:2d-array");
    expect(new Set([twoD, volume, array]).size).toBe(3);
  });

  it("realizes a 3d texture-asset binding through a dimension:'3d' view", () => {
    const view = realizeCustomTextureView("3d", "e5.vol.3d");
    expect(view.diagnostics).toEqual([]);
    expect(view.valid).toBe(true);
    // The 3D volume is created with a 3D storage dimension and a 3D view.
    expect(view.createDescriptor).toMatchObject({ dimension: "3d" });
    expect(view.viewDescriptor).toEqual({ dimension: "3d" });
  });

  it("realizes a 2d-array texture-asset binding through a dimension:'2d-array' view", () => {
    const view = realizeCustomTextureView("2d-array", "e5.vol.array");
    expect(view.diagnostics).toEqual([]);
    expect(view.valid).toBe(true);
    // A 2d-array uses 2D storage (no storage dimension) + a 2d-array view.
    expect(
      Object.prototype.hasOwnProperty.call(view.createDescriptor, "dimension"),
    ).toBe(false);
    expect(view.viewDescriptor).toEqual({ dimension: "2d-array" });
  });

  it("realizes a plain 2d texture-asset binding without a view descriptor (byte-identity)", () => {
    const view = realizeCustomTextureView("2d", "e5.vol.2d");
    expect(view.valid).toBe(true);
    expect(view.viewDescriptor).toBeUndefined();
  });
});

interface RealizedCustomTextureView {
  readonly valid: boolean;
  readonly diagnostics: readonly { readonly code: string }[];
  readonly createDescriptor: Record<string, unknown>;
  readonly viewDescriptor: unknown;
}

function realizeCustomTextureView(
  dimension: "2d" | "3d" | "2d-array",
  handleId: string,
): RealizedCustomTextureView {
  const handle = createTextureHandle(handleId);
  const assets = new AssetRegistry();
  assets.register(handle);
  assets.markReady(
    handle,
    createTextureAsset({
      label: handleId,
      dimension,
      width: 2,
      height: 2,
      depthOrLayers: dimension === "2d" ? 1 : 2,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array(2 * 2 * (dimension === "2d" ? 1 : 2) * 4),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );

  const binding: CustomWgslBindingDeclaration = {
    name: "vol",
    binding: 0,
    kind: "texture",
    visibility: ["fragment"],
    texture: handle,
    viewDimension: dimension,
  };
  const source = createCustomWgslMaterialAsset({
    familyKey: "test/e5-textures",
    label: "E5 textures",
    shader: { kind: "inline-wgsl", code: WGSL },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    bindings: [binding],
  });
  const material = createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:test/e5-textures",
    shaderCode: WGSL,
    shaderSourceKey: "inline:test",
  });

  let createDescriptor: Record<string, unknown> = {};
  let viewDescriptor: unknown;
  const device = {
    createTexture: (input: Record<string, unknown>) => {
      createDescriptor = input;
      return {
        createView: (descriptor?: unknown) => {
          viewDescriptor = descriptor;
          return { kind: "view", descriptor };
        },
      };
    },
    queue: { writeTexture: () => undefined },
  };

  const result = prepareCustomWgslAppTextureSamplerBindingResources({
    assets,
    device,
    cache: { textures: new Map(), samplers: new Map() },
    reuse: {
      textureResourcesCreated: 0,
      textureResourcesReused: 0,
      samplerResourcesCreated: 0,
      samplerResourcesReused: 0,
    },
    source,
    material,
  });

  return {
    valid: result.valid,
    diagnostics: result.diagnostics,
    createDescriptor,
    viewDescriptor,
  };
}
