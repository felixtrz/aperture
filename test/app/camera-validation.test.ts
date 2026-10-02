import { describe, expect, it } from "vitest";
import { createApertureSystemContext } from "@aperture-engine/app/systems";
import {
  Camera,
  CameraProjection,
  createCamera,
  validateCameraInput,
  extractRenderSnapshot,
  type CameraInput,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createWorld,
  WorldTransform,
  createRootTransform,
} from "@aperture-engine/simulation";

const invalid: { input: CameraInput; field: string }[] = [];
for (const projection of [
  CameraProjection.Perspective,
  CameraProjection.Orthographic,
]) {
  for (const field of ["aspect", "near", "far"] as const) {
    for (const value of [NaN, Infinity, -Infinity])
      invalid.push({ input: { projection, [field]: value }, field });
  }
  for (const value of [0, -1]) {
    invalid.push({ input: { projection, aspect: value }, field: "aspect" });
    invalid.push({ input: { projection, near: value }, field: "near" });
  }
  invalid.push({ input: { projection, near: 1, far: 1 }, field: "far" });
  invalid.push({ input: { projection, near: 2, far: 1 }, field: "far" });
}
for (const value of [NaN, Infinity, -Infinity, 0, -1, Math.PI])
  invalid.push({ input: { fovYRadians: value }, field: "fovYRadians" });
for (const value of [NaN, Infinity, -Infinity, 0, -1])
  invalid.push({
    input: {
      projection: CameraProjection.Orthographic,
      orthographicHeight: value,
    },
    field: "orthographicHeight",
  });

describe("finite camera validation agreement", () => {
  it.each(invalid)(
    "rejects $input with field $field before spawn or extraction",
    ({ input, field }) => {
      const validation = validateCameraInput(input);
      expect(validation.valid).toBe(false);
      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({ field }),
      );
      const world = createWorld({ entityCapacity: 8 });
      const registry = new AssetRegistry();
      const context = createApertureSystemContext({
        world,
        assetsRegistry: registry,
      });
      expect(() => context.spawn.camera({ camera: input })).toThrow(
        expect.objectContaining({
          code: "aperture.camera.invalidProjection",
          detail: { diagnostics: validation.diagnostics },
        }),
      );
      expect(context.cameras.active).toHaveLength(0);
      // Direct low-level ECS authoring bypasses spawn, but extraction and rays
      // still reject the same invalid projection before matrix construction.
      const entity = world.createEntity();
      entity.addComponent(Camera, createCamera(input));
      entity.addComponent(WorldTransform, createRootTransform().world);
      const snapshot = extractRenderSnapshot(world, registry);
      expect(snapshot.views).toHaveLength(0);
      expect(snapshot.diagnostics).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining(field) }),
      );
      expect(() => context.cameras.main.rayFromPointer([0.5, 0.5])).toThrow(
        expect.objectContaining({ code: "aperture.camera.invalidProjection" }),
      );
    },
  );

  it.each<CameraInput>([
    {},
    { projection: CameraProjection.Orthographic },
    { aspect: 2, near: 0.01, far: 100, fovYRadians: 1 },
    {
      projection: CameraProjection.Orthographic,
      aspect: 2,
      orthographicHeight: 5,
      fovYRadians: 0,
    },
    { orthographicHeight: 0, temporalJitter: [0, 0] },
  ])("preserves defaults and inactive-projection sentinels: %j", (input) => {
    expect(validateCameraInput(input)).toEqual({
      valid: true,
      diagnostics: [],
    });
    const world = createWorld({ entityCapacity: 8 });
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world,
      assetsRegistry: registry,
    });
    context.spawn.camera({ camera: input });
    expect(() => context.cameras.main.rayFromPointer([0.5, 0.5])).not.toThrow();
    const snapshot = extractRenderSnapshot(world, registry);
    expect(snapshot.views).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([]);
  });
});
