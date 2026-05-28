import {
  createBoxMeshAsset,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createStandardMaterialAsset,
  type MaterialAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";
import type {
  PrimitiveMeshDescriptor,
  SpawnMeshOptions,
  StandardMaterialDescriptor,
} from "./types.js";

export function resolveMeshHandle(
  options: {
    readonly registry: AssetRegistry;
  },
  input: SpawnMeshOptions,
): MeshHandle {
  if ("kind" in input.mesh && input.mesh.kind !== "mesh") {
    const id = `${input.key ?? input.name ?? "mesh"}.mesh`;
    const handle = createMeshHandle(id);
    registerReadyAsset(
      options.registry,
      handle,
      primitiveToMeshAsset(input.mesh),
    );
    return handle;
  }

  return input.mesh as MeshHandle;
}

export function resolveMaterialHandle(
  options: {
    readonly registry: AssetRegistry;
  },
  input: SpawnMeshOptions,
): MaterialHandle {
  if ("kind" in input.material && input.material.kind !== "material") {
    const id = `${input.key ?? input.name ?? "mesh"}.material`;
    const handle = createMaterialHandle(id);
    registerReadyAsset(
      options.registry,
      handle,
      materialDescriptorToAsset(input.material),
    );
    return handle;
  }

  return input.material as MaterialHandle;
}

function registerReadyAsset<TAsset>(
  registry: AssetRegistry,
  handle: MeshHandle | MaterialHandle,
  assetValue: TAsset,
): void {
  if (!registry.has(handle)) {
    registry.register(handle);
  }

  registry.markReady(handle, assetValue);
}

function primitiveToMeshAsset(
  descriptorValue: PrimitiveMeshDescriptor,
): MeshAsset {
  switch (descriptorValue.kind) {
    case "box": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size, size]
          : Array.isArray(size)
            ? size
            : [1, 1, 1];
      return createBoxMeshAsset({
        width: read3(tuple, 0),
        height: read3(tuple, 1),
        depth: read3(tuple, 2),
      });
    }
    case "sphere":
      return createSphereMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        widthSegments: numberOption(descriptorValue.options.segments, 32),
        heightSegments: numberOption(descriptorValue.options.segments, 16),
      });
    case "capsule":
      return createCapsuleMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 2),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "plane": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size]
          : Array.isArray(size)
            ? size
            : [1, 1];
      return createPlaneMeshAsset({
        width: read2(tuple, 0),
        height: read2(tuple, 1),
      });
    }
    case "cylinder":
      return createCylinderMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
    case "cone":
      return createConeMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 0.5),
        height: numberOption(descriptorValue.options.depth, 1),
        radialSegments: numberOption(descriptorValue.options.segments, 32),
      });
  }
}

function materialDescriptorToAsset(
  descriptorValue: StandardMaterialDescriptor,
): MaterialAsset {
  return createStandardMaterialAsset({
    ...(descriptorValue.options.label === undefined
      ? {}
      : { label: descriptorValue.options.label }),
    ...(descriptorValue.options.baseColor === undefined
      ? {}
      : {
          baseColorFactor: new Float32Array([
            read4(descriptorValue.options.baseColor, 0),
            read4(descriptorValue.options.baseColor, 1),
            read4(descriptorValue.options.baseColor, 2),
            read4(descriptorValue.options.baseColor, 3),
          ]),
        }),
    ...(descriptorValue.options.roughness === undefined
      ? {}
      : { roughnessFactor: descriptorValue.options.roughness }),
    ...(descriptorValue.options.metallic === undefined
      ? {}
      : { metallicFactor: descriptorValue.options.metallic }),
  });
}

function read2(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function read3(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function read4(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}

function numberOption(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
