import { describe, expect, it } from "vitest";

import {
  appendQueuedBuiltInFrameResourceViaAdapter,
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
  createQueuedBuiltInFrameResourceViaAdapter,
  type PreparedAppTextureSamplerResources,
  type QueuedBuiltInFrameResource,
  type QueuedMaterialFrameResourceAdapterResult,
} from "@aperture-engine/webgpu";

describe("built-in material app resource adapter factory", () => {
  it("composes route adapters with caller-provided resource callbacks", () => {
    const calls: string[] = [];
    const families = createQueuedBuiltInAppResourceFamilyAdapterTable<
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
    const registry = createQueuedBuiltInAppResourceAdapterRegistry({
      families,
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
    const unlitFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("unlit")?.createFrameResources({ token: "d" }) ??
      frameResult();
    const matcapFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("matcap")?.createFrameResources({ token: "e" }) ??
      frameResult();
    const standardFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("standard")?.createFrameResources({ token: "f" }) ??
      frameResult();

    expect(calls).toEqual([
      "texture:unlit:a",
      "texture:matcap:b",
      "texture:standard:c",
      "frame:unlit:d",
      "frame:matcap:e",
      "frame:standard:f",
    ]);
    expect([
      unlitFrameResources,
      matcapFrameResources,
      standardFrameResources,
    ]).toEqual([frameResult(), frameResult(), frameResult()]);
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

  it("creates and appends frame resources through the generic adapter helper", () => {
    const registry = createQueuedBuiltInAppResourceAdapterRegistry<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      createUnlitFrameResources: () => ({
        valid: true,
        resources: fakeResource("unlit") as never,
        diagnostics: [],
      }),
      createMatcapFrameResources: () => ({
        valid: true,
        resources: fakeResource("matcap") as never,
        diagnostics: [],
      }),
      createStandardFrameResources: () => ({
        valid: true,
        resources: fakeResource("standard") as never,
        diagnostics: [],
      }),
    });
    const buckets = { unlit: [], matcap: [], standard: [] };

    const reports = registry.adapters.map((adapter) =>
      createQueuedBuiltInFrameResourceViaAdapter({
        adapter,
        frameOptions: {},
        buckets,
      }),
    );

    expect(reports).toEqual([
      { valid: true, status: "appended", family: "unlit", diagnostics: [] },
      { valid: true, status: "appended", family: "matcap", diagnostics: [] },
      { valid: true, status: "appended", family: "standard", diagnostics: [] },
    ]);
    expect(buckets).toEqual({
      unlit: [fakeResource("unlit")],
      matcap: [fakeResource("matcap")],
      standard: [fakeResource("standard")],
    });
    expect(JSON.stringify(reports)).not.toContain("resources");
    expect(JSON.stringify(reports)).not.toContain("GPU");
  });

  it("appends an already-created frame-resource result through the generic helper", () => {
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
    const buckets = { unlit: [], matcap: [], standard: [] };
    const resources = fakeResource("standard");

    const report = appendQueuedBuiltInFrameResourceViaAdapter({
      adapter: registry.get("standard")!,
      result: {
        valid: true,
        resources: resources as never,
        diagnostics: [],
      },
      buckets,
    });

    expect(report).toEqual({
      valid: true,
      status: "appended",
      family: "standard",
      diagnostics: [],
    });
    expect(buckets).toEqual({
      unlit: [],
      matcap: [],
      standard: [resources],
    });
  });

  it("keeps failed frame-resource results out of family buckets", () => {
    const registry = createQueuedBuiltInAppResourceAdapterRegistry<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      createUnlitFrameResources: () => ({
        valid: false,
        resources: null,
        diagnostics: [{ code: "fake.failed", raw: () => "not json" } as never],
      }),
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
    });
    const buckets = { unlit: [], matcap: [], standard: [] };

    const report = createQueuedBuiltInFrameResourceViaAdapter({
      adapter: registry.get("unlit")!,
      frameOptions: {},
      buckets,
    });

    expect(report).toEqual({
      valid: false,
      status: "failed",
      family: "unlit",
      diagnostics: [{ code: "fake.failed", raw: expect.any(Function) }],
    });
    expect(buckets).toEqual({ unlit: [], matcap: [], standard: [] });
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
