import { describe, expect, it } from "vitest";

import {
  appendQueuedBuiltInFrameResourceViaAdapter,
  BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
  createQueuedBuiltInAppResourceAdapterRegistry,
  createQueuedBuiltInAppResourceFamilyAdapterTable,
  createQueuedBuiltInAppResourceAdapterRegistrations,
  createQueuedBuiltInFrameResourceViaAdapter,
  createQueuedMaterialAdapterRegistry,
  queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue,
  type PreparedAppTextureSamplerResources,
  type QueuedBuiltInFrameResource,
  type QueuedMaterialFrameResourceAdapterResult,
  validateQueuedBuiltInAppResourceAdapterRegistry,
} from "@aperture-engine/webgpu";

describe("built-in material app resource adapter factory", () => {
  it("exposes the active built-in app resource adapter family registry shape", () => {
    expect(BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES).toEqual([
      "unlit",
      "matcap",
      "standard",
      "debug-normal",
    ]);
    expect(new Set(BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES).size).toBe(
      BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES.length,
    );
  });

  it("creates uniquely keyed app resource adapter registrations from shared family metadata", () => {
    const registrations = createQueuedBuiltInAppResourceAdapterRegistrations<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    });

    expect(registrations.map((adapter) => adapter.kind)).toEqual(
      BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
    );
    expect(new Set(registrations.map((adapter) => adapter.kind)).size).toBe(
      registrations.length,
    );
    expect(
      registrations.every(
        (adapter) =>
          typeof adapter.prepareRoute === "function" &&
          typeof adapter.prepareTextureSamplerResources === "function" &&
          typeof adapter.createFrameResources === "function" &&
          typeof adapter.appendFrameResource === "function",
      ),
    ).toBe(true);
  });

  it("validates the default built-in app resource adapter registry", () => {
    const registry = createQueuedBuiltInAppResourceAdapterRegistry<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    });
    const report = validateQueuedBuiltInAppResourceAdapterRegistry(registry);

    expect(report).toEqual({
      valid: true,
      expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
      registeredFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
      diagnostics: [],
    });
    expect(
      queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(
        report,
      ),
    ).toEqual(report);
  });

  it("reports duplicate built-in app resource adapter families deterministically", () => {
    const registrations = createQueuedBuiltInAppResourceAdapterRegistrations<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    });
    const registry = createQueuedMaterialAdapterRegistry([
      ...registrations,
      registrations[0]!,
    ]);
    const report = validateQueuedBuiltInAppResourceAdapterRegistry(registry);

    expect(report).toMatchObject({
      valid: true,
      expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
      registeredFamilies: [
        "unlit",
        "matcap",
        "standard",
        "debug-normal",
        "unlit",
      ],
      diagnostics: [
        {
          code: "queuedMaterialAdapter.duplicateFamily",
          severity: "warning",
          family: "unlit",
          firstIndex: 0,
          duplicateIndex: 4,
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("prepareTextureSampler");
    expect(JSON.stringify(report)).not.toContain("createFrameResources");
  });

  it("reports missing built-in app resource adapter families deterministically", () => {
    const registrations = createQueuedBuiltInAppResourceAdapterRegistrations<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    }).filter((adapter) => adapter.kind !== "standard");
    const registry = createQueuedMaterialAdapterRegistry(registrations);
    const report = validateQueuedBuiltInAppResourceAdapterRegistry(registry);

    expect(report).toEqual({
      valid: false,
      expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
      registeredFamilies: ["unlit", "matcap", "debug-normal"],
      diagnostics: [
        {
          code: "queuedBuiltInAppResourceAdapter.missingFamily",
          severity: "error",
          family: "standard",
          message:
            "Built-in app resource adapter family 'standard' is not registered.",
        },
      ],
    });
    expect(
      queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(
        report,
      ),
    ).toEqual(report);
  });

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
      prepareDebugNormalTextureSamplerResources: (options) => {
        calls.push(`texture:debug-normal:${options.token}`);
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
      createDebugNormalFrameResources: (options) => {
        calls.push(`frame:debug-normal:${options.token}`);
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
      "debug-normal",
    ]);
    expect(registry.diagnostics).toEqual([]);

    registry.get("unlit")?.prepareTextureSamplerResources({ token: "a" });
    registry.get("matcap")?.prepareTextureSamplerResources({ token: "b" });
    registry.get("standard")?.prepareTextureSamplerResources({ token: "c" });
    registry
      .get("debug-normal")
      ?.prepareTextureSamplerResources({ token: "d" });
    const unlitFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("unlit")?.createFrameResources({ token: "e" }) ??
      frameResult();
    const matcapFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("matcap")?.createFrameResources({ token: "f" }) ??
      frameResult();
    const standardFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("standard")?.createFrameResources({ token: "g" }) ??
      frameResult();
    const debugNormalFrameResources: QueuedMaterialFrameResourceAdapterResult =
      registry.get("debug-normal")?.createFrameResources({ token: "h" }) ??
      frameResult();

    expect(calls).toEqual([
      "texture:unlit:a",
      "texture:matcap:b",
      "texture:standard:c",
      "texture:debug-normal:d",
      "frame:unlit:e",
      "frame:matcap:f",
      "frame:standard:g",
      "frame:debug-normal:h",
    ]);
    expect([
      unlitFrameResources,
      matcapFrameResources,
      standardFrameResources,
      debugNormalFrameResources,
    ]).toEqual([frameResult(), frameResult(), frameResult(), frameResult()]);
  });

  it("appends created frame resources into the matching family buckets", () => {
    const registry = createQueuedBuiltInAppResourceAdapterRegistry<
      Record<string, never>,
      Record<string, never>
    >({
      prepareUnlitTextureSamplerResources: prepared,
      prepareMatcapTextureSamplerResources: prepared,
      prepareStandardTextureSamplerResources: prepared,
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    });
    const unlit = fakeResource("unlit");
    const matcap = fakeResource("matcap");
    const standard = fakeResource("standard");
    const debugNormal = fakeResource("debug-normal");
    const buckets = { unlit: [], matcap: [], standard: [], debugNormal: [] };

    registry.get("unlit")?.appendFrameResource(unlit, buckets);
    registry.get("matcap")?.appendFrameResource(matcap, buckets);
    registry.get("standard")?.appendFrameResource(standard, buckets);
    registry.get("debug-normal")?.appendFrameResource(debugNormal, buckets);

    expect(buckets).toEqual({
      unlit: [unlit],
      matcap: [matcap],
      standard: [standard],
      debugNormal: [debugNormal],
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
      prepareDebugNormalTextureSamplerResources: prepared,
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
      createDebugNormalFrameResources: () => ({
        valid: true,
        resources: fakeResource("debug-normal") as never,
        diagnostics: [],
      }),
    });
    const buckets = { unlit: [], matcap: [], standard: [], debugNormal: [] };

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
      {
        valid: true,
        status: "appended",
        family: "debug-normal",
        diagnostics: [],
      },
    ]);
    expect(buckets).toEqual({
      unlit: [fakeResource("unlit")],
      matcap: [fakeResource("matcap")],
      standard: [fakeResource("standard")],
      debugNormal: [fakeResource("debug-normal")],
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
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: frameResult,
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    });
    const buckets = { unlit: [], matcap: [], standard: [], debugNormal: [] };
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
      debugNormal: [],
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
      prepareDebugNormalTextureSamplerResources: prepared,
      createUnlitFrameResources: () => ({
        valid: false,
        resources: null,
        diagnostics: [{ code: "fake.failed", raw: () => "not json" } as never],
      }),
      createMatcapFrameResources: frameResult,
      createStandardFrameResources: frameResult,
      createDebugNormalFrameResources: frameResult,
    });
    const buckets = { unlit: [], matcap: [], standard: [], debugNormal: [] };

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
    expect(buckets).toEqual({
      unlit: [],
      matcap: [],
      standard: [],
      debugNormal: [],
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
