import { describe, expect, it } from "vitest";

import {
  BUILT_IN_MATERIAL_QUEUE_FAMILIES,
  isBuiltInMaterialQueueFamily,
} from "@aperture-engine/webgpu/test-support";

describe("built-in material queue families", () => {
  it("lists the currently supported built-in queue families", () => {
    expect(BUILT_IN_MATERIAL_QUEUE_FAMILIES).toEqual([
      "unlit",
      "matcap",
      "standard",
      "debug-normal",
    ]);
  });

  it("recognizes supported families", () => {
    expect(isBuiltInMaterialQueueFamily("unlit")).toBe(true);
    expect(isBuiltInMaterialQueueFamily("matcap")).toBe(true);
    expect(isBuiltInMaterialQueueFamily("standard")).toBe(true);
    expect(isBuiltInMaterialQueueFamily("debug-normal")).toBe(true);
  });

  it("rejects unsupported, empty, and near-miss family strings", () => {
    expect(isBuiltInMaterialQueueFamily("")).toBe(false);
    expect(isBuiltInMaterialQueueFamily("standard ")).toBe(false);
    expect(isBuiltInMaterialQueueFamily("Standard")).toBe(false);
    expect(isBuiltInMaterialQueueFamily("unlit|opaque")).toBe(false);
  });
});
