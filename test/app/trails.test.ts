import { describe, expect, it } from "vitest";
import { createApertureSystemContext } from "@aperture-engine/app/systems";
import type { MaterialAsset } from "@aperture-engine/render";
import {
  AssetRegistry,
  createMaterialHandle,
  createWorld,
} from "@aperture-engine/simulation";

describe("Aperture system trail access", () => {
  it("creates a spawned ground ribbon with dynamic mesh and material assets", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });

    const trail = context.trails.groundRibbon("test.skid", {
      label: "Skid trail",
      material: "test.skid.material",
      color: [0.1, 0.2, 0.3],
      opacity: 0.5,
      depthBias: -2,
      depthBiasSlopeScale: 1.25,
      width: 0.25,
      maxSegments: 4,
      minSegmentLength: 0.01,
      tags: ["trail"],
    });

    const material = registry.get<"material">(trail.material);
    const materialAsset = material?.asset as MaterialAsset | null | undefined;
    expect(registry.get<"mesh">(trail.mesh.handle)?.status).toBe("ready");
    expect(material?.status).toBe("ready");
    expect(materialAsset?.renderState.depth.bias).toBe(-2);
    expect(materialAsset?.renderState.depth.biasSlopeScale).toBe(1.25);
    expect(trail.material).toEqual(createMaterialHandle("test.skid.material"));
    expect(trail.entity).toBeDefined();

    const initialMesh = trail.getMeshAsset();
    expect(initialMesh.vertexStreams[0]?.vertexCount).toBe(1);
    expect(initialMesh.vertexStreams[0]?.data).toHaveLength(12);
    expect(initialMesh.submeshes[0]?.vertexCount).toBe(0);
    expect(initialMesh.indexBuffer).toBeUndefined();
  });

  it("tracks and publishes faded ground-ribbon segments", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    const trail = context.trails.groundRibbon("test.trail", {
      width: 0.5,
      maxSegments: 2,
      color: [0.25, 0.5, 0.75],
      opacity: 0.5,
    });

    expect(trail.track([0, 0, 0], { emit: true, alpha: 0.25 })).toBe(false);
    expect(trail.track([1, 0, 0], { emit: true, alpha: 0.25 })).toBe(true);

    const result = trail.flush();
    const asset = trail.mesh.get();
    const data = asset?.vertexStreams[0]?.data as Float32Array | undefined;

    expect(result?.version).toBe(2);
    expect(asset?.vertexStreams[0]?.vertexCount).toBe(6);
    expect(data?.length).toBe(6 * 12);
    expect(asset?.indexBuffer?.indexCount).toBe(6);
    expect(asset?.indexBuffer?.data).toHaveLength(6);
    expect(asset?.submeshes[0]?.vertexCount).toBe(6);
    expect(asset?.localAabb?.min).toEqual([0, 0, -0.5]);
    expect(asset?.localAabb?.max).toEqual([1, 0, 0.5]);
    expect(Array.from(data?.slice(8, 12) ?? [])).toEqual([
      0.25, 0.5, 0.75, 0.25,
    ]);
  });

  it("shrinks wrapped trail bounds to the active segment window", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    const trail = context.trails.groundRibbon("test.wrapped-trail", {
      width: 0.5,
      maxSegments: 2,
      minSegmentLength: 0.01,
    });

    expect(trail.addSegment([100, 0, 0], [101, 0, 0])).toBe(true);
    expect(trail.addSegment([0, 0, 0], [1, 0, 0])).toBe(true);
    expect(trail.getMeshAsset().localAabb?.max[0]).toBe(101);

    expect(trail.addSegment([1, 0, 0], [2, 0, 0])).toBe(true);

    const asset = trail.getMeshAsset();
    const data = asset.vertexStreams[0]?.data as Float32Array | undefined;

    expect(asset.vertexStreams[0]?.vertexCount).toBe(12);
    expect(data?.length).toBe(12 * 12);
    expect(asset.indexBuffer?.data).toHaveLength(12);
    expect(asset.localAabb?.min).toEqual([0, 0, -0.5]);
    expect(asset.localAabb?.max).toEqual([2, 0, 0.5]);
    expect(Array.from(data?.slice(0, 3) ?? [])).toEqual([0, 0, -0.5]);
  });

  it("uses uint32 indices when a trail exceeds uint16 vertex capacity", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    const trail = context.trails.groundRibbon("test.long-trail", {
      maxSegments: 11_000,
    });

    expect(trail.addSegment([0, 0, 0], [1, 0, 0])).toBe(true);
    expect(trail.getMeshAsset().indexBuffer?.format).toBe("uint32");
  });
});
