import { describe, expect, it } from "vitest";

import {
  createShadowCasterMeshViewsFromAppReport,
  type ShadowCasterPreparedMeshSourceLike,
} from "@aperture-engine/webgpu/test-support";

describe("shadow frame caster mesh views", () => {
  it("resolves current prepared mesh facade entries through versioned mesh buffer keys", () => {
    const views = createShadowCasterMeshViewsFromAppReport(
      report({
        assetKey: "mesh:caster",
        sourceVersion: 3,
        label: "CasterCube",
        meshResourceKey: "prepared-mesh:mesh:caster",
        gpuMeshResourceKey: "mesh-buffer:mesh:caster@v3",
      }),
    );

    expect(views.preparedMeshes).toEqual([
      {
        meshKey: "mesh:caster",
        meshResourceKey: "mesh-buffer:mesh:caster@v3",
        vertexBufferResourceKeys: ["vertex-buffer:position"],
        indexBufferResourceKey: "index-buffer:caster",
      },
    ]);
    expect(views.executableMeshes).toMatchObject([
      {
        meshKey: "mesh:caster",
        meshResourceKey: "mesh-buffer:mesh:caster@v3",
        vertexBuffers: [
          {
            resourceKey: "vertex-buffer:position",
            buffer: "position-buffer",
            vertexCount: 24,
          },
        ],
        indexBuffer: {
          resourceKey: "index-buffer:caster",
          buffer: "index-buffer",
          format: "uint32",
          indexCount: 36,
        },
      },
    ]);
  });

  it("keeps the legacy label-key fallback for older app reports", () => {
    const views = createShadowCasterMeshViewsFromAppReport(
      report({
        assetKey: "mesh:legacy-caster",
        label: "LegacyCaster",
        gpuMeshResourceKey: "mesh-buffer:LegacyCaster",
      }),
    );

    expect(views.preparedMeshes).toEqual([
      {
        meshKey: "mesh:legacy-caster",
        meshResourceKey: "mesh-buffer:LegacyCaster",
        vertexBufferResourceKeys: ["vertex-buffer:position"],
        indexBufferResourceKey: "index-buffer:caster",
      },
    ]);
  });
});

function report(input: {
  readonly assetKey: string;
  readonly sourceVersion?: number;
  readonly label: string;
  readonly meshResourceKey?: string;
  readonly gpuMeshResourceKey: string;
}): ShadowCasterPreparedMeshSourceLike {
  return {
    resources: {
      resources: {
        meshResources: [
          {
            resourceKey: input.gpuMeshResourceKey,
            vertexBuffers: [
              {
                resourceKey: "vertex-buffer:position",
                buffer: "position-buffer",
                vertexCount: 24,
              },
            ],
            indexBuffer: {
              resourceKey: "index-buffer:caster",
              buffer: "index-buffer",
              format: "uint32",
              indexCount: 36,
            },
          },
        ],
      },
    },
    resourceReuse: {
      preparedMeshFacade: {
        entries: [
          {
            assetKey: input.assetKey,
            ...(input.sourceVersion === undefined
              ? {}
              : { sourceVersion: input.sourceVersion }),
            label: input.label,
            ...(input.meshResourceKey === undefined
              ? {}
              : { meshResourceKey: input.meshResourceKey }),
          },
        ],
      },
    },
  };
}
