import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import {
  RuntimeBuffer,
  createRuntimeBuffer,
  createStableRenderId,
  extractRenderSnapshot,
  registerRenderAuthoringComponents,
  validateRuntimeBufferInput,
} from "@aperture-engine/render";

describe("runtime buffer extraction", () => {
  it("extracts keyed runtime buffer packets sorted by key", () => {
    const world = createRuntimeWorld();
    const assets = new AssetRegistry();
    const wind = world.createEntity();
    const bend = world.createEntity();

    wind.addComponent(
      RuntimeBuffer,
      createRuntimeBuffer({
        key: "grass.wind",
        values: [0.25, 0.5],
        elementOffset: 2,
        version: 3,
      }),
    );
    bend.addComponent(
      RuntimeBuffer,
      createRuntimeBuffer({
        key: "grass.bend",
        values: [1, 2, 3, 4],
      }),
    );

    const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });

    expect(snapshot.runtimeBuffers).toHaveLength(2);
    expect(snapshot.runtimeBuffers?.map((packet) => packet.key)).toEqual([
      "grass.bend",
      "grass.wind",
    ]);
    expect(snapshot.runtimeBuffers?.[1]).toEqual({
      bufferId: createStableRenderId({
        index: wind.index,
        generation: wind.generation,
      }),
      entity: { index: wind.index, generation: wind.generation },
      key: "grass.wind",
      values: [0.25, 0.5],
      elementOffset: 2,
      version: 3,
    });
    expect(snapshot.runtimeBuffers?.[0]).toMatchObject({
      key: "grass.bend",
      values: [1, 2, 3, 4],
      elementOffset: 0,
      version: 0,
    });
    expect(snapshot.report).toMatchObject({
      runtimeBuffers: 2,
      diagnostics: 0,
    });
  });

  it("clones packet values so later component writes do not mutate snapshots", () => {
    const world = createRuntimeWorld();
    const assets = new AssetRegistry();
    const entity = world.createEntity();

    entity.addComponent(
      RuntimeBuffer,
      createRuntimeBuffer({ key: "grass.wind", values: [1, 2] }),
    );

    const first = extractRenderSnapshot(world, assets, { frame: 1 });

    entity.setValue(RuntimeBuffer, "values", [9, 9]);

    const second = extractRenderSnapshot(world, assets, { frame: 2 });

    expect(first.runtimeBuffers?.[0]?.values).toEqual([1, 2]);
    expect(second.runtimeBuffers?.[0]?.values).toEqual([9, 9]);
  });

  it("diagnoses duplicate runtime buffer keys and keeps the first packet", () => {
    const world = createRuntimeWorld();
    const assets = new AssetRegistry();
    const first = world.createEntity();
    const duplicate = world.createEntity();

    first.addComponent(
      RuntimeBuffer,
      createRuntimeBuffer({ key: "grass.wind", values: [1] }),
    );
    duplicate.addComponent(
      RuntimeBuffer,
      createRuntimeBuffer({ key: "grass.wind", values: [2] }),
    );

    const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });

    expect(snapshot.runtimeBuffers).toHaveLength(1);
    expect(snapshot.runtimeBuffers?.[0]?.values).toEqual([1]);
    expect(snapshot.diagnostics).toMatchObject([
      {
        code: "render.runtimeBuffer.duplicateKey",
        entity: { index: duplicate.index, generation: duplicate.generation },
        runtimeBufferKey: "grass.wind",
      },
    ]);
  });

  it("diagnoses invalid runtime buffer inputs instead of emitting packets", () => {
    const world = createRuntimeWorld();
    const assets = new AssetRegistry();
    const entity = world.createEntity();

    entity.addComponent(
      RuntimeBuffer,
      createRuntimeBuffer({
        key: "",
        values: [Number.NaN],
        elementOffset: -1,
      }),
    );

    const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });
    const codes = snapshot.diagnostics.map((diagnostic) => diagnostic.code);

    expect(snapshot.runtimeBuffers).toBeUndefined();
    expect(codes).toContain("render.runtimeBuffer.invalidKey");
    expect(codes).toContain("render.runtimeBuffer.invalidValues");
    expect(codes).toContain("render.runtimeBuffer.invalidElementOffset");
  });

  it("validates runtime buffer inputs directly", () => {
    expect(
      validateRuntimeBufferInput({ key: "grass.wind", values: [0, 1, 2] }),
    ).toEqual({ valid: true, diagnostics: [] });

    const invalid = validateRuntimeBufferInput({
      key: " ",
      values: [],
      elementOffset: 1.5,
      version: -1,
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "runtimeBuffer.invalidKey",
      "runtimeBuffer.invalidValues",
      "runtimeBuffer.invalidElementOffset",
      "runtimeBuffer.invalidVersion",
    ]);
  });
});

function createRuntimeWorld(): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}
