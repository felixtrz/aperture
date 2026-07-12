import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  assetHandleKey,
  createBufferHandle,
  type BufferHandle,
  type Entity,
} from "@aperture-engine/simulation";
import {
  isCustomWgslMaterialAsset,
  type BufferAsset,
  type CustomWgslMaterialAsset,
  type CustomWgslStorageBindingDeclaration,
} from "@aperture-engine/render";

const STORAGE_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<storage, read> bendParams: array<vec4f>;

struct VertexOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vs_main(
  @location(0) position: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  let bend = bendParams[instanceIndex];
  let world = worldTransforms[instanceIndex];
  output.position =
    view.viewProjection * world * vec4f(position + vec3f(bend.x, 0.0, 0.0), 1.0);
  return output;
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(0.3, 0.8, 0.3, 1.0);
}
`;

describe("app storage-buffer material authoring", () => {
  it("registers procedural buffer assets and converts material.storage descriptors", async () => {
    const refs: {
      buffer: BufferHandle | null;
      grass: Entity | null;
    } = { buffer: null, grass: null };

    class StorageSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const buffer = this.buffers.register({
          id: "grass.bend",
          elementType: "vec4f",
          elementCount: 4,
          data: new Float32Array(16),
          label: "Grass Bend Params",
        });

        refs.buffer = buffer;
        this.spawn.camera({ key: "camera.main" });
        refs.grass = this.spawn.mesh({
          key: "grass.blade",
          mesh: mesh.plane({ size: [0.1, 1] }),
          material: material.customWgsl({
            familyKey: "test/grass",
            label: "Grass Blades",
            shader: {
              kind: "inline-wgsl",
              code: STORAGE_WGSL,
              virtualPath: "grass.wgsl",
            },
            entryPoints: { vertex: "vs_main", fragment: "fs_main" },
            bindings: [
              material.storage("bendParams", {
                binding: 0,
                visibility: ["vertex"],
                buffer,
                runtimeBufferKey: "grass.bend",
              }),
            ],
          }),
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: StorageSetupSystem }],
    });

    expect(refs.buffer).not.toBeNull();

    const bufferEntry = app.lowLevel.assets.get<"buffer", BufferAsset>(
      refs.buffer as BufferHandle,
    );

    expect(bufferEntry?.status).toBe("ready");
    expect(bufferEntry?.asset).toMatchObject({
      kind: "buffer",
      label: "Grass Bend Params",
      elementType: "vec4f",
      elementCount: 4,
      usage: "read-only-storage",
    });

    const materialEntry = app.lowLevel.assets
      .list({ kind: "material" })
      .find((entry) => entry.handle.id === "grass.blade.material");

    expect(materialEntry).toBeDefined();

    const materialAsset = materialEntry?.asset as CustomWgslMaterialAsset;

    expect(isCustomWgslMaterialAsset(materialAsset)).toBe(true);

    const storageBinding = materialAsset.bindings.find(
      (binding): binding is CustomWgslStorageBindingDeclaration =>
        binding.kind === "storage-buffer",
    );

    expect(storageBinding).toMatchObject({
      kind: "storage-buffer",
      name: "bendParams",
      binding: 0,
      visibility: ["vertex"],
      buffer: { kind: "buffer", id: "grass.bend" },
      runtimeBufferKey: "grass.bend",
    });
    // The buffer handle joins the material's dependency declarations AND the
    // registry-level dependency list used for readiness tracking.
    expect(materialAsset.dependencies).toContainEqual({
      kind: "buffer",
      handle: { kind: "buffer", id: "grass.bend" },
    });
    expect(
      materialEntry?.dependencies.map((handle) => assetHandleKey(handle)),
    ).toContain("buffer:grass.bend");
  });

  it("defaults material.storage visibility to vertex and fragment", () => {
    const binding = material.storage("params", {
      binding: 2,
      buffer: createBufferHandle("params"),
    });

    expect(binding).toMatchObject({
      kind: "storage-buffer",
      name: "params",
      binding: 2,
      visibility: ["vertex", "fragment"],
      buffer: { kind: "buffer", id: "params" },
    });
    expect(binding).not.toHaveProperty("runtimeBufferKey");
  });

  it("rejects invalid procedural buffer registrations with structured errors", async () => {
    const failures: string[] = [];

    class InvalidBufferSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        for (const options of [
          { id: "bad.vec3", elementType: "vec3f" as const, elementCount: 4 },
          { id: "bad.count", elementType: "f32" as const, elementCount: 0 },
          {
            id: "bad.length",
            elementType: "vec4f" as const,
            elementCount: 2,
            data: new Float32Array(4),
          },
        ]) {
          try {
            this.buffers.register(options);
          } catch (error) {
            failures.push(error instanceof Error ? error.message : "unknown");
          }
        }
      }
    }

    await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: InvalidBufferSystem }],
    });

    expect(failures).toHaveLength(3);
    expect(failures[0]).toContain("vec3f");
    expect(failures[1]).toContain("elementCount");
    expect(failures[2]).toContain("does not match elementCount");
  });

  it("spawns keyed runtime buffer entities and reuses them per key", async () => {
    const refs: { first: Entity | null; second: Entity | null } = {
      first: null,
      second: null,
    };

    class RuntimeBufferSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        refs.first = this.spawn.runtimeBuffer({
          bufferKey: "grass.bend",
          values: [0.1, 0.2, 0.3, 0.4],
        });
        refs.second = this.spawn.runtimeBuffer({
          bufferKey: "grass.bend",
          values: [0.5, 0.6, 0.7, 0.8],
          elementOffset: 1,
          version: 2,
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: RuntimeBufferSystem }],
    });
    const snapshot = app.extract(1);

    expect(refs.first).toBe(refs.second);
    expect(snapshot.runtimeBuffers).toHaveLength(1);
    expect(snapshot.runtimeBuffers?.[0]).toMatchObject({
      key: "grass.bend",
      values: [0.5, 0.6, 0.7, 0.8],
      elementOffset: 1,
      version: 2,
    });
  });
});
