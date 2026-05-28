import { describe, expect, it } from "vitest";

import {
  createQueuedMaterialAdapterRegistry,
  type QueuedMaterialAdapterRegistration,
} from "@aperture-engine/webgpu/test-support";

interface TestAdapter extends QueuedMaterialAdapterRegistration {
  readonly label: string;
}

describe("queued material adapter registry", () => {
  it("returns null for unknown material families so callers can emit diagnostics", () => {
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      { kind: "unlit", label: "Unlit adapter" },
      { kind: "standard", label: "Standard adapter" },
    ]);

    expect(registry.diagnostics).toEqual([]);
    expect(registry.get("debug-normal")).toBeNull();
    expect(registry.get("legacy-custom")).toBeNull();
  });

  it("diagnoses duplicate families while preserving first-match behavior", () => {
    const first: TestAdapter = { kind: "standard", label: "first" };
    const second: TestAdapter = { kind: "standard", label: "second" };
    const registry = createQueuedMaterialAdapterRegistry<TestAdapter>([
      first,
      second,
    ]);

    expect(registry.adapters).toEqual([first, second]);
    expect(registry.get("standard")).toBe(first);
    expect(registry.diagnostics).toEqual([
      {
        code: "queuedMaterialAdapter.duplicateFamily",
        severity: "warning",
        family: "standard",
        firstIndex: 0,
        duplicateIndex: 1,
        message:
          "Material adapter family 'standard' is registered more than once; the first adapter at index 0 will be used.",
      },
    ]);
  });
});
