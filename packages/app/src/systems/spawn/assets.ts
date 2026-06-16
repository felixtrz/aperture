import {
  createBoxMeshAsset,
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createCustomWgslMaterialAsset,
  createPlaneMeshAsset,
  createSphereMeshAsset,
  createStandardMaterialAsset,
  materialAssetDependencies,
  validateCustomMaterialSource,
  type CustomWgslUniformFieldType,
  type MeshAsset,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  type AssetHandle,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";
import type {
  PrimitiveMeshDescriptor,
  SpawnMeshOptions,
  MaterialDescriptor,
} from "./types.js";
import { ApertureSystemError } from "../errors.js";

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
    const asset = materialDescriptorToAsset(input.material);

    registerReadyAsset(options.registry, handle, asset, {
      label: asset.label,
      dependencies: materialAssetDependencies(asset),
    });
    return handle;
  }

  return input.material as MaterialHandle;
}

function registerReadyAsset<TAsset>(
  registry: AssetRegistry,
  handle: MeshHandle | MaterialHandle,
  assetValue: TAsset,
  options: {
    readonly dependencies?: readonly AssetHandle[];
    readonly label?: string;
  } = {},
): void {
  if (!registry.has(handle)) {
    registry.register(handle, {
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.dependencies === undefined
        ? {}
        : { dependencies: options.dependencies }),
    });
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
  descriptorValue: MaterialDescriptor,
): SourceMaterialAsset {
  if (descriptorValue.kind === "custom-wgsl") {
    const source = createCustomWgslMaterialAsset({
      ...descriptorValue,
      ...(descriptorValue.bindings === undefined
        ? {}
        : {
            bindings: descriptorValue.bindings.map(normalizeCustomWgslBinding),
          }),
    });
    const diagnostics = validateCustomMaterialSource(source, {
      expectedFamily: source.familyKey,
    });
    const errors = diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );

    if (errors.length > 0) {
      throw new ApertureSystemError(
        "aperture.spawn.invalidCustomWgslMaterial",
        `Custom WGSL material '${source.label}' is invalid: ${errors
          .map((diagnostic) => diagnostic.message)
          .join(" ")}`,
        "Fix material.customWgsl() familyKey, shader, entry points, render state, bindings, dependencies, or metadata.",
      );
    }

    return source;
  }

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
    ...(descriptorValue.options.emissiveFactor === undefined
      ? {}
      : {
          emissiveFactor: [
            read3(descriptorValue.options.emissiveFactor, 0),
            read3(descriptorValue.options.emissiveFactor, 1),
            read3(descriptorValue.options.emissiveFactor, 2),
          ],
        }),
  });
}

function normalizeCustomWgslBinding(
  binding: NonNullable<
    Extract<MaterialDescriptor, { readonly kind: "custom-wgsl" }>["bindings"]
  >[number],
): NonNullable<
  Extract<MaterialDescriptor, { readonly kind: "custom-wgsl" }>["bindings"]
>[number] {
  if (binding.kind !== "uniform-buffer") {
    return binding;
  }

  return {
    ...binding,
    fields: Object.fromEntries(
      Object.entries(binding.fields).map(([name, field]) => [
        name,
        {
          ...field,
          type: normalizeUniformFieldType(field.type),
        },
      ]),
    ),
  };
}

function normalizeUniformFieldType(value: string): CustomWgslUniformFieldType {
  switch (value) {
    case "Float32":
    case "float32":
      return "float32";
    case "Vec2":
    case "vec2":
      return "vec2";
    case "Vec3":
    case "vec3":
      return "vec3";
    case "Vec4":
    case "Color":
    case "vec4":
      return "vec4";
    case "Int32":
    case "int32":
      return "int32";
    case "Uint32":
    case "uint32":
      return "uint32";
    case "mat4x4":
      return "mat4x4";
    default:
      return value as CustomWgslUniformFieldType;
  }
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
