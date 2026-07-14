import {
  createBoxMeshAsset,
  createCapsuleMeshAsset,
  createCircleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  createCustomWgslMaterialAsset,
  createDodecahedronMeshAsset,
  createIcosahedronMeshAsset,
  createLineListMeshAsset,
  createOctahedronMeshAsset,
  createPlaneMeshAsset,
  createRingMeshAsset,
  createRoundedBoxMeshAsset,
  createSphereMeshAsset,
  createStandardMaterialAsset,
  createTetrahedronMeshAsset,
  createTorusMeshAsset,
  createTorusKnotMeshAsset,
  createUnlitMaterialAsset,
  materialAssetDependencies,
  validateCustomMaterialSource,
  validateMeshAsset,
  type CustomWgslUniformFieldType,
  type LineListMeshOptions,
  type LineListMeshSubmeshOptions,
  type LineListPosition,
  type MeshAsset,
  type PlatonicSolidMeshOptions,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  vec4,
  type AssetHandle,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
  type Vec3Like,
} from "@aperture-engine/simulation";
import type {
  PlatonicSolidMeshDescriptorOptions,
  PrimitiveMeshDescriptor,
  SpawnMeshOptions,
  MaterialDescriptor,
  StandardMaterialOptions,
} from "./types.js";
import type { LodInput } from "@aperture-engine/render";
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

/**
 * Resolve a `spawn.mesh({ lod })` option into render-layer {@link LodInput}:
 * each level's mesh descriptor is registered as a ready asset (or a supplied
 * handle passed through), keyed uniquely per level off the entity's key/name so
 * generated primitive meshes never collide. Distances/hysteresis are forwarded
 * verbatim so `createLod`/`validateLodInput` see the authored order.
 */
export function resolveLodInput(
  options: { readonly registry: AssetRegistry },
  input: SpawnMeshOptions,
): LodInput {
  const lod = input.lod;
  const baseId = input.key ?? input.name ?? "mesh";

  return {
    levels: (lod?.levels ?? []).map((level, index) => ({
      mesh: resolveLodLevelMeshHandle(
        options,
        level.mesh,
        `${baseId}.lod${index}.mesh`,
      ),
      distance: level.distance,
    })),
    ...(lod?.hysteresis === undefined ? {} : { hysteresis: lod.hysteresis }),
  };
}

function resolveLodLevelMeshHandle(
  options: { readonly registry: AssetRegistry },
  mesh: PrimitiveMeshDescriptor | MeshHandle,
  meshId: string,
): MeshHandle {
  if ("kind" in mesh && mesh.kind !== "mesh") {
    const handle = createMeshHandle(meshId);
    registerReadyAsset(options.registry, handle, primitiveToMeshAsset(mesh));
    return handle;
  }

  return mesh as MeshHandle;
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
    case "circle":
      return createCircleMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 1),
        segments: numberOption(descriptorValue.options.segments, 32),
      });
    case "ring":
      return createRingMeshAsset({
        innerRadius: numberOption(descriptorValue.options.innerRadius, 0.5),
        outerRadius: numberOption(descriptorValue.options.outerRadius, 1),
        thetaSegments: numberOption(descriptorValue.options.segments, 32),
        phiSegments: numberOption(descriptorValue.options.phiSegments, 1),
      });
    case "torus":
      return createTorusMeshAsset({
        majorRadius: numberOption(descriptorValue.options.radius, 0.75),
        tubeRadius: numberOption(descriptorValue.options.tube, 0.25),
        // three.js `tubularSegments` wraps the ring; `radialSegments` wraps the
        // tube cross-section, mapping onto the render builder's fields.
        radialSegments: numberOption(
          descriptorValue.options.tubularSegments,
          32,
        ),
        tubeSegments: numberOption(descriptorValue.options.radialSegments, 12),
      });
    case "torus-knot":
      return createTorusKnotMeshAsset({
        radius: numberOption(descriptorValue.options.radius, 1),
        tube: numberOption(descriptorValue.options.tube, 0.4),
        tubularSegments: numberOption(
          descriptorValue.options.tubularSegments,
          64,
        ),
        radialSegments: numberOption(descriptorValue.options.radialSegments, 8),
        p: numberOption(descriptorValue.options.p, 2),
        q: numberOption(descriptorValue.options.q, 3),
      });
    case "tetrahedron":
      return createTetrahedronMeshAsset(
        platonicOptions(descriptorValue.options),
      );
    case "octahedron":
      return createOctahedronMeshAsset(
        platonicOptions(descriptorValue.options),
      );
    case "icosahedron":
      return createIcosahedronMeshAsset(
        platonicOptions(descriptorValue.options),
      );
    case "dodecahedron":
      return createDodecahedronMeshAsset(
        platonicOptions(descriptorValue.options),
      );
    case "rounded-box": {
      const size = descriptorValue.options.size;
      const tuple =
        typeof size === "number"
          ? [size, size, size]
          : Array.isArray(size)
            ? size
            : [1, 1, 1];
      return createRoundedBoxMeshAsset({
        width: read3(tuple, 0),
        height: read3(tuple, 1),
        depth: read3(tuple, 2),
        segments: numberOption(descriptorValue.options.segments, 4),
        radius: numberOption(descriptorValue.options.radius, 0.1),
      });
    }
    case "line-list":
      return createLineListPrimitiveMeshAsset(descriptorValue.options);
  }
}

function platonicOptions(
  options: PlatonicSolidMeshDescriptorOptions,
): PlatonicSolidMeshOptions {
  return {
    radius: numberOption(options.radius, 1),
    detail: numberOption(options.detail, 0),
  };
}

function createLineListPrimitiveMeshAsset(
  options: LineListMeshOptions,
): MeshAsset {
  const positions = lineListPositions(options.positions);
  const indices =
    options.indices === undefined
      ? undefined
      : lineListIndices(options.indices, positions.length);

  validateLinePairCount(
    indices?.length ?? positions.length,
    indices === undefined ? "positions" : "indices",
  );

  const label = optionalString(options.label, "label");
  const mesh = createLineListMeshAsset({
    ...(label === undefined ? {} : { label }),
    positions,
    ...(indices === undefined ? {} : { indices }),
    ...(options.materialSlots === undefined
      ? {}
      : { materialSlots: lineListMaterialSlots(options.materialSlots) }),
    ...(options.submeshes === undefined
      ? {}
      : {
          submeshes: lineListSubmeshes(options.submeshes, {
            indexed: indices !== undefined,
            indexCount: indices?.length ?? 0,
            vertexCount: positions.length,
          }),
        }),
  });
  const validation = validateMeshAsset(mesh);

  if (!validation.valid) {
    throw new ApertureSystemError(
      "aperture.spawn.invalidLineListMesh",
      `mesh.lineList() produced an invalid mesh: ${validation.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
      "Check line-list positions, indices, submesh ranges, and material slots before spawning the mesh.",
    );
  }

  return mesh;
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

  if (descriptorValue.kind === "unlit") {
    return createUnlitMaterialAsset({
      ...(descriptorValue.options.label === undefined
        ? {}
        : { label: descriptorValue.options.label }),
      ...(descriptorValue.options.baseColor === undefined
        ? {}
        : {
            baseColorFactor: vec4(
              read4(descriptorValue.options.baseColor, 0),
              read4(descriptorValue.options.baseColor, 1),
              read4(descriptorValue.options.baseColor, 2),
              read4(descriptorValue.options.baseColor, 3),
            ),
          }),
      ...(descriptorValue.options.renderState === undefined
        ? {}
        : { renderState: descriptorValue.options.renderState }),
    });
  }

  const standardOptions = descriptorValue.options;
  return createStandardMaterialAsset({
    ...(standardOptions.label === undefined
      ? {}
      : { label: standardOptions.label }),
    ...(standardOptions.baseColor === undefined
      ? {}
      : {
          baseColorFactor: vec4(
            read4(standardOptions.baseColor, 0),
            read4(standardOptions.baseColor, 1),
            read4(standardOptions.baseColor, 2),
            read4(standardOptions.baseColor, 3),
          ),
        }),
    ...(standardOptions.roughness === undefined
      ? {}
      : { roughnessFactor: standardOptions.roughness }),
    ...(standardOptions.metallic === undefined
      ? {}
      : { metallicFactor: standardOptions.metallic }),
    ...(standardOptions.emissiveFactor === undefined
      ? {}
      : { emissiveFactor: readVec3Tuple(standardOptions.emissiveFactor) }),
    ...(standardOptions.attenuationColor === undefined
      ? {}
      : {
          attenuationColor: readVec3Tuple(standardOptions.attenuationColor),
        }),
    ...(standardOptions.sheenColorFactor === undefined
      ? {}
      : {
          sheenColorFactor: readVec3Tuple(standardOptions.sheenColorFactor),
        }),
    ...definedScalarOptions(standardOptions, [
      "normalScale",
      "occlusionStrength",
      "clearcoatFactor",
      "clearcoatRoughnessFactor",
      "transmissionFactor",
      "ior",
      "thickness",
      "attenuationDistance",
      "sheenRoughnessFactor",
      "iridescenceFactor",
      "iridescenceIor",
      "iridescenceThicknessMinimum",
      "iridescenceThicknessMaximum",
    ]),
    ...(standardOptions.renderState === undefined
      ? {}
      : { renderState: standardOptions.renderState }),
  });
}

type StandardScalarOptionKey =
  | "normalScale"
  | "occlusionStrength"
  | "clearcoatFactor"
  | "clearcoatRoughnessFactor"
  | "transmissionFactor"
  | "ior"
  | "thickness"
  | "attenuationDistance"
  | "sheenRoughnessFactor"
  | "iridescenceFactor"
  | "iridescenceIor"
  | "iridescenceThicknessMinimum"
  | "iridescenceThicknessMaximum";

function definedScalarOptions(
  options: StandardMaterialOptions,
  keys: readonly StandardScalarOptionKey[],
): Partial<Record<StandardScalarOptionKey, number>> {
  const defined: Partial<Record<StandardScalarOptionKey, number>> = {};
  for (const key of keys) {
    const value = options[key];
    if (value !== undefined) {
      defined[key] = value;
    }
  }
  return defined;
}

function readVec3Tuple(value: Vec3Like): [number, number, number] {
  return [read3(value, 0), read3(value, 1), read3(value, 2)];
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

function lineListPositions(value: unknown): LineListPosition[] {
  if (!Array.isArray(value)) {
    invalidLineListMesh(
      "mesh.lineList() requires positions to be an array of [x, y, z] tuples.",
    );
  }

  return value.map((position, index) =>
    lineListPosition(position, `positions[${index}]`),
  );
}

function lineListPosition(value: unknown, path: string): LineListPosition {
  const tuple = arrayLike(value, path);

  return [
    finiteNumber(tuple[0], `${path}[0]`),
    finiteNumber(tuple[1], `${path}[1]`),
    finiteNumber(tuple[2], `${path}[2]`),
  ];
}

function lineListIndices(
  value: NonNullable<LineListMeshOptions["indices"]>,
  vertexCount: number,
): NonNullable<LineListMeshOptions["indices"]> {
  if (value instanceof Uint16Array || value instanceof Uint32Array) {
    validateLineListIndices(value, vertexCount);
    return value;
  }

  if (!Array.isArray(value)) {
    invalidLineListMesh(
      "mesh.lineList() indices must be a number array, Uint16Array, or Uint32Array.",
    );
  }

  return value.map((index, itemIndex) =>
    lineListIndex(index, `indices[${itemIndex}]`, vertexCount),
  );
}

function validateLineListIndices(
  indices: Uint16Array | Uint32Array,
  vertexCount: number,
): void {
  indices.forEach((index, itemIndex) => {
    lineListIndex(index, `indices[${itemIndex}]`, vertexCount);
  });
}

function lineListIndex(
  value: unknown,
  path: string,
  vertexCount: number,
): number {
  const index = nonNegativeInteger(value, path);

  if (index >= vertexCount) {
    invalidLineListMesh(
      `mesh.lineList() ${path} references vertex ${index}, but only ${vertexCount} positions were provided.`,
    );
  }

  return index;
}

function lineListMaterialSlots(value: unknown): string[] {
  if (!Array.isArray(value)) {
    invalidLineListMesh(
      "mesh.lineList() materialSlots must be a string array.",
    );
  }

  return value.map((slot, index) => {
    if (typeof slot !== "string") {
      invalidLineListMesh(
        `mesh.lineList() materialSlots[${index}] must be a string.`,
      );
    }

    return slot;
  });
}

function lineListSubmeshes(
  value: unknown,
  options: {
    readonly indexed: boolean;
    readonly indexCount: number;
    readonly vertexCount: number;
  },
): LineListMeshSubmeshOptions[] {
  if (!Array.isArray(value)) {
    invalidLineListMesh("mesh.lineList() submeshes must be an array.");
  }

  return value.map((submesh, index) => {
    if (!isRecord(submesh)) {
      invalidLineListMesh(
        `mesh.lineList() submeshes[${index}] must be an object.`,
      );
    }

    const label = optionalString(submesh.label, `submeshes[${index}].label`);
    const normalized: LineListMeshSubmeshOptions = {
      ...(label === undefined ? {} : { label }),
      ...(submesh.materialSlot === undefined
        ? {}
        : {
            materialSlot: nonNegativeInteger(
              submesh.materialSlot,
              `submeshes[${index}].materialSlot`,
            ),
          }),
      ...(submesh.vertexStart === undefined
        ? {}
        : {
            vertexStart: nonNegativeInteger(
              submesh.vertexStart,
              `submeshes[${index}].vertexStart`,
            ),
          }),
      ...(submesh.vertexCount === undefined
        ? {}
        : {
            vertexCount: nonNegativeInteger(
              submesh.vertexCount,
              `submeshes[${index}].vertexCount`,
            ),
          }),
      ...(submesh.indexStart === undefined
        ? {}
        : {
            indexStart: nonNegativeInteger(
              submesh.indexStart,
              `submeshes[${index}].indexStart`,
            ),
          }),
      ...(submesh.indexCount === undefined
        ? {}
        : {
            indexCount: nonNegativeInteger(
              submesh.indexCount,
              `submeshes[${index}].indexCount`,
            ),
          }),
    };
    const lineStart = options.indexed
      ? (normalized.indexStart ?? 0)
      : (normalized.vertexStart ?? 0);
    const lineCount = options.indexed
      ? (normalized.indexCount ?? options.indexCount)
      : (normalized.vertexCount ?? options.vertexCount);
    const lineRange = options.indexed ? "index" : "vertex";

    if (lineStart % 2 !== 0) {
      invalidLineListMesh(
        `mesh.lineList() submeshes[${index}] ${lineRange}Start must begin on a line-pair boundary.`,
      );
    }
    validateLinePairCount(lineCount, `submeshes[${index}].${lineRange}Count`);

    return normalized;
  });
}

function validateLinePairCount(count: number, path: string): void {
  if (count % 2 !== 0) {
    invalidLineListMesh(
      `mesh.lineList() ${path} must contain an even number of entries because line-list data is consumed in pairs.`,
    );
  }
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    invalidLineListMesh(`mesh.lineList() ${path} must be a string.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalidLineListMesh(
      `mesh.lineList() ${path} must be a non-negative integer.`,
    );
  }

  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalidLineListMesh(`mesh.lineList() ${path} must be a finite number.`);
  }

  return value;
}

function arrayLike(value: unknown, path: string): ArrayLike<unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    !("length" in value) ||
    typeof value.length !== "number" ||
    value.length < 3
  ) {
    invalidLineListMesh(
      `mesh.lineList() ${path} must be an array-like [x, y, z] tuple.`,
    );
  }

  return value as ArrayLike<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidLineListMesh(message: string): never {
  throw new ApertureSystemError(
    "aperture.spawn.invalidLineListMesh",
    message,
    "Use mesh.lineList({ positions: [[x, y, z], [x, y, z], ...] }) with finite coordinates and paired positions or paired indices.",
  );
}
