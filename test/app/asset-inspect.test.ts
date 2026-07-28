import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { inspectGltfAsset } from "@aperture-engine/app/headless-tools";
import {
  createStandardMaterialAsset,
  type GltfReportDrivenImportReport,
  type MeshAsset,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createMaterialHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import type {
  SystemGltfAssetHandle,
  SystemGltfLoadedScene,
} from "../../packages/app/src/systems/assets.js";

describe("asset_inspect report", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    {
      fixture: "lighting-metallic.gltf",
      materials: 3,
      nodes: 3,
      textures: 0,
      images: 0,
      highMetallic: 3,
    },
    {
      fixture: "lighting-dielectric.gltf",
      materials: 1,
      nodes: 1,
      textures: 0,
      images: 0,
      highMetallic: 0,
    },
    {
      fixture: "lighting-textured-pbr.gltf",
      materials: 1,
      nodes: 1,
      textures: 3,
      images: 3,
      highMetallic: 1,
    },
  ])(
    "loads and inspects $fixture without network or placeholder assets",
    async ({ fixture, materials, nodes, textures, images, highMetallic }) => {
      const bytes = await readFile(
        new URL(`../assets/fixtures/${fixture}`, import.meta.url),
      );
      const sourceUrl = `https://fixtures.aperture.invalid/${fixture}`;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url !== sourceUrl) {
            throw new Error(`Unexpected fixture fetch: ${url}`);
          }
          return new Response(bytes, {
            status: 200,
            headers: { "content-type": "model/gltf+json" },
          });
        }),
      );
      const app = await createApertureApp({
        config: defineApertureConfig({
          mode: "headless",
          systems: [],
          assets: {
            fixture: asset.gltf(sourceUrl, { preload: "blocking" }),
          },
        }),
        gltfAssetDecoders: {
          decodeImageData: async () => ({
            width: 2,
            height: 2,
            format: "rgba8unorm",
            sourceData: {
              bytes: new Uint8Array(16).fill(255),
              bytesPerRow: 8,
              rowsPerImage: 2,
            },
          }),
        },
      });

      const report = inspectGltfAsset(
        app.context.assets.gltf("fixture"),
        app.context.assetsRegistry,
      );

      expect(report.ready).toBe(true);
      expect(report.nodes).toBe(nodes);
      expect(report.meshes).toBe(nodes === 3 ? 3 : 1);
      expect(report.primitives).toBe(nodes === 3 ? 3 : 1);
      expect(report.materials).toHaveLength(materials);
      expect(report.summary).toMatchObject({
        textureCount: textures,
        imageCount: images,
        highMetallicMaterialCount: highMetallic,
      });
      expect(report.diagnostics).toEqual([]);
      expect(report.meshPrimitives.every((mesh) => mesh.normals)).toBe(true);
      expect(
        report.meshPrimitives.every((mesh) => mesh.uvSets.includes(0)),
      ).toBe(true);

      if (fixture === "lighting-metallic.gltf") {
        expect(
          report.materials.map((material) => material.metallicFactor),
        ).toEqual([1, 1, 1]);
        expect(
          report.materials.map((material) => material.roughnessFactor),
        ).toEqual([1, 1, 1]);
        expect(
          report.materials.every((material) =>
            Object.values(material.textureStatus).every(
              (texture) => texture.status === "not-authored",
            ),
          ),
        ).toBe(true);
      }

      if (fixture === "lighting-textured-pbr.gltf") {
        expect(report.materials[0]).toMatchObject({
          textures: {
            baseColor: true,
            metallicRoughness: true,
            normal: true,
            emissive: false,
          },
          textureStatus: {
            baseColor: { authored: true, status: "ready" },
            metallicRoughness: { authored: true, status: "ready" },
            normal: { authored: true, status: "ready" },
            emissive: { authored: false, status: "not-authored" },
          },
        });
      }
    },
    20_000,
  );

  it("summarizes source and patched materials, texture states, and mesh attributes", () => {
    const registry = new AssetRegistry();
    const failedTexture = createTextureHandle("hq:base-color");
    registry.register(failedTexture);
    registry.markFailed(failedTexture, [
      { code: "fixture.textureFailed", message: "fixture", severity: "error" },
    ]);
    const source = createStandardMaterialAsset({
      label: "metalDark",
      baseColorFactor: [0.675, 0.71, 0.774, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
      baseColorTexture: {
        texture: failedTexture,
        sampler: null,
        texCoord: 0,
      },
    });
    const patched = createStandardMaterialAsset({
      ...source,
      label: "metalDark (spawn override)",
      metallicFactor: 0.12,
      roughnessFactor: 0.72,
    });
    const patchedHandle = createMaterialHandle(
      "hq:material:0:hq:material:0:override:abc",
    );
    registry.register<"material", SourceMaterialAsset>(patchedHandle);
    registry.markReady<"material", SourceMaterialAsset>(patchedHandle, patched);
    const mesh = fixtureMesh();
    const handle = fakeHandle({
      importReport: {
        assetMapping: {
          materials: [
            {
              handleKey: "material:hq:material:0",
              materialIndex: 0,
              material: source,
              report: { valid: true, material: {}, diagnostics: [] },
            },
          ],
          textures: [
            {
              handleKey: "texture:hq:base-color",
              textureIndex: 0,
              slot: "baseColor",
              texture: null,
              report: { valid: false, texture: null, diagnostics: [] },
            },
          ],
        },
        meshConstruction: {
          valid: true,
          meshes: [
            {
              handleKey: "mesh:hq:0:0",
              registeredHandleKey: "mesh:hq:0:0",
              meshIndex: 0,
              primitiveIndex: 0,
              mesh,
            },
          ],
          diagnostics: [],
        },
      } as unknown as GltfReportDrivenImportReport,
    } as SystemGltfLoadedScene);
    const report = inspectGltfAsset(handle, registry);

    expect(report).toMatchObject({
      asset: "hq",
      ready: true,
      meshes: 1,
      meshPrimitives: [
        {
          handleKey: "mesh:hq:0:0",
          normals: true,
          tangents: true,
          uvSets: [0],
        },
      ],
      materials: [
        {
          name: "metalDark",
          kind: "standard",
          metallicFactor: 1,
          roughnessFactor: 1,
          textures: {
            baseColor: true,
            metallicRoughness: false,
            normal: false,
            emissive: false,
          },
          textureStatus: {
            baseColor: {
              authored: true,
              status: "failed",
              textureKey: "texture:hq:base-color",
            },
            normal: { authored: false, status: "not-authored" },
          },
        },
      ],
      spawnPatchedMaterials: [
        {
          sourceMaterialKey: "material:hq:material:0",
          metallicFactor: 0.12,
          roughnessFactor: 0.72,
        },
      ],
      summary: {
        imageCount: 1,
        textureCount: 1,
        highMetallicMaterialCount: 1,
        patchedMaterialCount: 1,
      },
      diagnostics: [],
    });
    expect(JSON.stringify(report)).not.toMatch(/Float32Array|GPU|callback/);
  });

  it("reports an unloaded glTF without requiring GPU initialization", () => {
    const handle = fakeHandle(null);
    const report = inspectGltfAsset(handle, new AssetRegistry());

    expect(report).toMatchObject({
      ready: false,
      materials: [],
      diagnostics: [{ code: "aperture.assetInspect.gltfNotReady" }],
    });
  });
});

function fakeHandle(
  scene: SystemGltfLoadedScene | null,
): SystemGltfAssetHandle {
  return {
    id: "hq",
    kind: "gltf",
    url: "/hq.glb",
    preload: "manual",
    scene: { value: scene },
  } as unknown as SystemGltfAssetHandle;
}

function fixtureMesh(): MeshAsset {
  return {
    kind: "mesh",
    label: "fixture",
    vertexStreams: [
      {
        id: "main",
        arrayStride: 48,
        vertexCount: 3,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TANGENT", format: "float32x4", offset: 24 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 40 },
        ],
        data: new Float32Array(36),
      },
    ],
    submeshes: [
      {
        label: "fixture",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
  };
}
