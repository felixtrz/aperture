import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createRootTransform,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  WorldTransform,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  createLine,
  createPoints,
  extractRenderSnapshot,
  Line,
  Points,
  registerRenderAuthoringComponents,
} from "@aperture-engine/render";

function createRenderWorld(): EcsWorld {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

function addWorldTransform(
  entity: ReturnType<EcsWorld["createEntity"]>,
  translation: readonly [number, number, number] = [0, 0, 0],
): void {
  entity.addComponent(
    WorldTransform,
    createRootTransform({ translation: [...translation] }).world,
  );
}

describe("E1 fat-line extraction", () => {
  it("is byte-identical (no line/point fields) when no lines or points exist", () => {
    const world = createRenderWorld();
    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });

    expect(snapshot.lines).toBeUndefined();
    expect(snapshot.lineVertices).toBeUndefined();
    expect(snapshot.points).toBeUndefined();
    expect(snapshot.pointVertices).toBeUndefined();
    expect(snapshot.pointColors).toBeUndefined();
    expect(snapshot.report.lines).toBeUndefined();
    expect(snapshot.report.points).toBeUndefined();
  });

  it("extracts a polyline into a line packet + shared vertex buffer", () => {
    const world = createRenderWorld();
    const entity = world.createEntity();
    addWorldTransform(entity, [1, 0, 0]);
    entity.addComponent(
      Line,
      createLine({
        positions: [0, 0, 0, 1, 0, 0, 1, 1, 0],
        color: [0.25, 0.5, 0.75, 1],
        width: 6,
        dashSize: 0.5,
        gapSize: 0.25,
        dashOffset: 0.25,
      }),
    );

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });

    expect(snapshot.lines).toHaveLength(1);
    const packet = snapshot.lines?.[0];
    expect(packet).toMatchObject({
      vertexOffset: 0,
      vertexCount: 3,
      width: 6,
      dashSize: 0.5,
      gapSize: 0.25,
      dashOffset: 0.25,
      layerMask: 1,
    });
    expect(packet?.color).toEqual([0.25, 0.5, 0.75, 1]);
    expect(packet?.sortKey.queue).toBe("transparent");
    expect(Array.from(snapshot.lineVertices ?? [])).toEqual([
      0, 0, 0, 1, 0, 0, 1, 1, 0,
    ]);
    expect(snapshot.report.lines).toEqual({
      lines: 1,
      segments: 2,
      vertices: 3,
    });
  });

  it("rejects a degenerate polyline (single vertex) with a diagnostic and no packet", () => {
    const world = createRenderWorld();
    const entity = world.createEntity();
    addWorldTransform(entity);
    entity.addComponent(Line, createLine({ positions: [0, 0, 0], width: 4 }));

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });

    expect(snapshot.lines).toBeUndefined();
    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.line.invalidPositions",
      ),
    ).toBe(true);
  });
});

describe("E1 point-cloud extraction", () => {
  it("folds the uniform color per point when no per-point colors are supplied", () => {
    const world = createRenderWorld();
    const entity = world.createEntity();
    addWorldTransform(entity);
    entity.addComponent(
      Points,
      createPoints({
        positions: [0, 0, 0, 1, 0, 0],
        color: [1, 0.5, 0, 1],
        size: 8,
        sizeAttenuation: true,
        shape: "square",
      }),
    );

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });

    expect(snapshot.points).toHaveLength(1);
    expect(snapshot.points?.[0]).toMatchObject({
      vertexOffset: 0,
      vertexCount: 2,
      size: 8,
      sizeAttenuation: true,
      round: false,
    });
    expect(Array.from(snapshot.pointVertices ?? [])).toEqual([
      0, 0, 0, 1, 0, 0,
    ]);
    // Uniform color replicated per point.
    expect(Array.from(snapshot.pointColors ?? [])).toEqual([
      1, 0.5, 0, 1, 1, 0.5, 0, 1,
    ]);
    expect(snapshot.report.points).toEqual({ clouds: 1, points: 2 });
  });

  it("carries per-point colors when supplied", () => {
    const world = createRenderWorld();
    const entity = world.createEntity();
    addWorldTransform(entity);
    entity.addComponent(
      Points,
      createPoints({
        positions: [0, 0, 0, 1, 0, 0],
        colors: [1, 0, 0, 1, 0, 1, 0, 1],
      }),
    );

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });

    expect(Array.from(snapshot.pointColors ?? [])).toEqual([
      1, 0, 0, 1, 0, 1, 0, 1,
    ]);
    expect(snapshot.points?.[0]?.round).toBe(true);
  });

  it("rejects mismatched per-point colors with a diagnostic and no packet", () => {
    const world = createRenderWorld();
    const entity = world.createEntity();
    addWorldTransform(entity);
    entity.addComponent(
      Points,
      createPoints({
        positions: [0, 0, 0, 1, 0, 0],
        colors: [1, 0, 0, 1],
      }),
    );

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });

    expect(snapshot.points).toBeUndefined();
    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.points.invalidColors",
      ),
    ).toBe(true);
  });
});
