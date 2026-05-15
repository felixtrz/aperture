import { describe, expect, it } from "vitest";

import {
  UNLIT_MESH_SHADER,
  createUnlitBindGroupLayoutPlan,
  type BuiltInShaderSourceModule,
} from "../../src/index.js";

describe("unlit bind group layout descriptor planning", () => {
  it("creates layout descriptors matching unlit shader binding metadata", () => {
    expect(createUnlitBindGroupLayoutPlan()).toEqual({
      valid: true,
      diagnostics: [],
      layouts: [
        {
          group: 0,
          label: "unlit/group-0",
          entries: [
            {
              binding: 0,
              label: "View projection uniform",
              resource: "uniform-buffer",
            },
          ],
        },
        {
          group: 1,
          label: "unlit/group-1",
          entries: [
            {
              binding: 0,
              label: "World transform matrix storage",
              resource: "read-only-storage-buffer",
            },
          ],
        },
        {
          group: 2,
          label: "unlit/group-2",
          entries: [
            {
              binding: 0,
              label: "Unlit material uniform",
              resource: "uniform-buffer",
            },
          ],
        },
      ],
    });
  });

  it("diagnoses missing metadata and unsupported resources", () => {
    const invalid: BuiltInShaderSourceModule = {
      ...UNLIT_MESH_SHADER,
      bindings: [
        {
          id: "viewProjection",
          label: "bad",
          group: 0,
          binding: 0,
          resource: "texture" as "uniform-buffer",
        },
      ],
    };

    expect(
      createUnlitBindGroupLayoutPlan(invalid).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "unlitBindGroupLayout.unsupportedResource",
      "unlitBindGroupLayout.missingBinding",
      "unlitBindGroupLayout.missingBinding",
    ]);
  });
});
