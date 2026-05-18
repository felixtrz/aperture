import { describe, expect, it } from "vitest";

import {
  BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
  createQueuedMaterialAdapterRegistry,
  queuedMaterialAdapterRegistryToJson,
  queuedMaterialAdapterRegistryToJsonValue,
  queuedMaterialAdapterRegistryValidationReportToJson,
  queuedMaterialAdapterRegistryValidationReportToJsonValue,
  type QueuedMaterialAdapterRegistration,
  validateQueuedMaterialAdapterRegistry,
} from "@aperture-engine/webgpu";

interface TestAdapter extends QueuedMaterialAdapterRegistration {
  readonly prepare?: () => void;
}

describe("queued material adapter registry JSON", () => {
  it("serializes empty registries without adapter objects", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([]);
    const json = queuedMaterialAdapterRegistryToJsonValue(registry);

    expect(json).toEqual({
      adapterCount: 0,
      families: [],
      diagnostics: [],
    });
    expect(JSON.parse(queuedMaterialAdapterRegistryToJson(registry))).toEqual(
      json,
    );
  });

  it("serializes unique adapter families without functions", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      { kind: "unlit", prepare: () => undefined },
      { kind: "standard", prepare: () => undefined },
    ]);
    const json = queuedMaterialAdapterRegistryToJsonValue(registry);
    const serialized = JSON.stringify(json);

    expect(json).toEqual({
      adapterCount: 2,
      families: ["unlit", "standard"],
      diagnostics: [],
    });
    expect(serialized).not.toContain("prepare");
    expect(serialized).not.toContain("function");
  });

  it("serializes duplicate-family diagnostics with stable index context", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      { kind: "standard", prepare: () => undefined },
      { kind: "matcap", prepare: () => undefined },
      { kind: "standard", prepare: () => undefined },
    ]);
    const json = queuedMaterialAdapterRegistryToJsonValue(registry);

    expect(json).toEqual({
      adapterCount: 3,
      families: ["standard", "matcap", "standard"],
      diagnostics: [
        {
          code: "queuedMaterialAdapter.duplicateFamily",
          severity: "warning",
          family: "standard",
          firstIndex: 0,
          duplicateIndex: 2,
          message:
            "Material adapter family 'standard' is registered more than once; the first adapter at index 0 will be used.",
        },
      ],
    });
  });
});

describe("queued material adapter registry validation", () => {
  it("preserves duplicate custom-family diagnostics as warnings", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      { kind: "test-preview", prepare: () => undefined },
      { kind: "test-preview", prepare: () => undefined },
    ]);
    const report = validateQueuedMaterialAdapterRegistry(registry, {
      expectedFamilies: ["test-preview"],
    });

    expect(report).toEqual({
      valid: true,
      expectedFamilies: ["test-preview"],
      registeredFamilies: ["test-preview", "test-preview"],
      diagnostics: [
        {
          code: "queuedMaterialAdapter.duplicateFamily",
          severity: "warning",
          family: "test-preview",
          firstIndex: 0,
          duplicateIndex: 1,
          message:
            "Material adapter family 'test-preview' is registered more than once; the first adapter at index 0 will be used.",
        },
      ],
    });
  });

  it("reports missing expected custom families without built-in policy names", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      { kind: "test-preview", prepare: () => undefined },
    ]);
    const report = validateQueuedMaterialAdapterRegistry(registry, {
      expectedFamilies: ["test-preview", "test-depth"],
    });

    expect(report).toEqual({
      valid: false,
      expectedFamilies: ["test-preview", "test-depth"],
      registeredFamilies: ["test-preview"],
      diagnostics: [
        {
          code: "queuedMaterialAdapter.missingExpectedFamily",
          severity: "error",
          family: "test-depth",
          message:
            "Expected material adapter family 'test-depth' is not registered.",
        },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("Built-in");
    expect(JSON.stringify(report)).not.toContain(
      "queuedBuiltInAppResourceAdapter",
    );
  });

  it("validates the built-in expected family list through the generic helper", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>(
      BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES.map((kind) => ({
        kind,
        prepare: () => undefined,
      })),
    );
    const report = validateQueuedMaterialAdapterRegistry(registry, {
      expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
    });

    expect(report).toEqual({
      valid: true,
      expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
      registeredFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
      diagnostics: [],
    });
  });

  it("serializes validation reports without adapter objects or functions", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      { kind: "test-preview", prepare: () => undefined },
      { kind: "test-preview", prepare: () => undefined },
    ]);
    const report = validateQueuedMaterialAdapterRegistry(registry, {
      expectedFamilies: ["test-preview", "test-depth"],
    });
    const json =
      queuedMaterialAdapterRegistryValidationReportToJsonValue(report);
    const serialized =
      queuedMaterialAdapterRegistryValidationReportToJson(report);

    expect(json).toEqual({
      valid: false,
      expectedFamilies: ["test-preview", "test-depth"],
      registeredFamilies: ["test-preview", "test-preview"],
      diagnostics: [
        expect.objectContaining({
          code: "queuedMaterialAdapter.duplicateFamily",
          family: "test-preview",
        }),
        expect.objectContaining({
          code: "queuedMaterialAdapter.missingExpectedFamily",
          family: "test-depth",
        }),
      ],
    });
    expect(JSON.parse(serialized)).toEqual(json);
    expect(serialized).not.toContain("prepare");
    expect(serialized).not.toContain("function");
    expect(serialized).not.toContain("GPU");
  });
});
