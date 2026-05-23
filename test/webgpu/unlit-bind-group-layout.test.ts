import { describe, expect, it } from "vitest";

import {
  UNLIT_MESH_SHADER,
  createUnlitBindGroupLayoutPlan,
  type BuiltInShaderSourceModule,
} from "@aperture-engine/webgpu";

describe("unlit bind group layout descriptor planning", () => {
  it("creates layout descriptors matching unlit shader binding metadata", () => {
    expect(createUnlitBindGroupLayoutPlan()).toMatchObject({
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
          metadata: {
            group: 0,
            name: "view",
            bindings: [
              {
                binding: 0,
                name: "viewUniform",
                resourceKind: "buffer",
                visibility: ["vertex"],
                required: true,
              },
            ],
          },
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
          metadata: {
            group: 1,
            name: "worldTransforms",
            bindings: [
              {
                binding: 0,
                name: "worldTransforms",
                resourceKind: "buffer",
                visibility: ["vertex"],
                required: true,
              },
              {
                binding: 3,
                name: "previousWorldTransforms",
                resourceKind: "buffer",
                visibility: ["vertex"],
                required: false,
              },
            ],
          },
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
          metadata: {
            group: 2,
            name: "material",
            bindings: [
              {
                binding: 0,
                name: "unlitMaterial",
                resourceKind: "buffer",
                visibility: ["fragment"],
                required: true,
              },
              {
                binding: 1,
                name: "baseColorTexture",
                resourceKind: "texture-view",
                visibility: ["fragment"],
                required: false,
              },
              {
                binding: 2,
                name: "baseColorSampler",
                resourceKind: "sampler",
                visibility: ["fragment"],
                required: false,
              },
            ],
          },
        },
      ],
    });
  });

  it("includes texture and sampler bindings when shader metadata declares them", () => {
    const textured: BuiltInShaderSourceModule = {
      ...UNLIT_MESH_SHADER,
      bindings: [
        ...UNLIT_MESH_SHADER.bindings,
        {
          id: "baseColorTexture",
          label: "Base color texture",
          group: 2,
          binding: 1,
          resource: "texture",
        },
        {
          id: "baseColorSampler",
          label: "Base color sampler",
          group: 2,
          binding: 2,
          resource: "sampler",
        },
      ],
    };

    expect(
      createUnlitBindGroupLayoutPlan(textured).layouts.at(-1),
    ).toMatchObject({
      group: 2,
      label: "unlit/group-2",
      entries: [
        {
          binding: 0,
          label: "Unlit material uniform",
          resource: "uniform-buffer",
        },
        {
          binding: 1,
          label: "Base color texture",
          resource: "texture",
        },
        {
          binding: 2,
          label: "Base color sampler",
          resource: "sampler",
        },
      ],
      metadata: {
        group: 2,
        name: "material",
        bindings: [
          { binding: 0, resourceKind: "buffer", required: true },
          { binding: 1, resourceKind: "texture-view", required: false },
          { binding: 2, resourceKind: "sampler", required: false },
        ],
      },
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
          resource: "unsupported" as "uniform-buffer",
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
