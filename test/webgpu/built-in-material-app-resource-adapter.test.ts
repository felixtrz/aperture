import { describe, expect, it } from "vitest";

import {
  createQueuedBuiltInAppResourceAdapterRegistry,
  type PreparedAppTextureSamplerResources,
  type QueuedBuiltInFrameResource,
} from "@aperture-engine/webgpu";

describe("built-in material app resource adapter factory", () => {
  it("composes route adapters with caller-provided resource callbacks", () => {
    const calls: string[] = [];
    const registry = createQueuedBuiltInAppResourceAdapterRegistry<
      { readonly token: string },
      { readonly token: string }
    >({
      prepareUnlitTextureSamplerResources: (options) => {
        calls.push(`texture:unlit:${options.token}`);
        return prepared();
      },
      prepareMatcapTextureSamplerResources: (options) => {
        calls.push(`texture:matcap:${options.token}`);
        return prepared();
      },
      prepareStandardTextureSamplerResources: (options) => {
        calls.push(`texture:standard:${options.token}`);
        return prepared();
      },
      createUnlitFrameResources: (options) => {
        calls.push(`frame:unlit:${options.token}`);
        return frameResult();
      },
      createMatcapFrameResources: (options) => {
        calls.push(`frame:matcap:${options.token}`);
        return frameResult();
      },
      createStandardFrameResources: (options) => {
        calls.push(`frame:standard:${options.token}`);
        return frameResult();
      },
    });

    expect(registry.adapters.map((adapter) => adapter.kind)).toEqual([
      "unlit",
      "matcap",
      "standard",
    ]);
    expect(registry.diagnostics).toEqual([]);

    registry.get("unlit")?.prepareTextureSamplerResources({ token: "a" });
    registry.get("matcap")?.prepareTextureSamplerResources({ token: "b" });
    registry.get("standard")?.prepareTextureSamplerResources({ token: "c" });
    registry.get("unlit")?.createFrameResources({ token: "d" });
    registry.get("matcap")?.createFrameResources({ token: "e" });
    registry.get("standard")?.createFrameResources({ token: "f" });

    expect(calls).toEqual([
      "texture:unlit:a",
      "texture:matcap:b",
      "texture:standard:c",
      "frame:unlit:d",
      "frame:matcap:e",
      "frame:standard:f",
    ]);
  });

  it("appends created frame resources into the matching family buckets", () => {
    const registry = createQueuedBuiltInAppResourceAdapterRegistry<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
    });
    const unlit = fakeResource("unlit");
    const matcap = fakeResource("matcap");
    const standard = fakeResource("standard");
    const buckets = { unlit: [], matcap: [], standard: [] };

    registry.get("unlit")?.appendFrameResource(unlit, buckets);
    registry.get("matcap")?.appendFrameResource(matcap, buckets);
    registry.get("standard")?.appendFrameResource(standard, buckets);

    expect(buckets).toEqual({
      unlit: [unlit],
      matcap: [matcap],
      standard: [standard],
    });
  });
});

function prepared(): PreparedAppTextureSamplerResources {
  return {
    valid: true,
    textures: [],
    samplers: [],
    textureKeys: [],
    samplerKeys: [],
    diagnostics: [],
  };
}

function frameResult() {
  return {
    valid: false,
    resources: null,
    diagnostics: [],
  };
}

function fakeResource(family: string): QueuedBuiltInFrameResource {
  return { family } as unknown as QueuedBuiltInFrameResource;
}
