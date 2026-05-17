import { describe, expect, it } from "vitest";

import {
  createQueuedMaterialAdapterRegistry,
  queuedMaterialAdapterRegistryToJson,
  queuedMaterialAdapterRegistryToJsonValue,
  type QueuedMaterialAdapterRegistration,
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
