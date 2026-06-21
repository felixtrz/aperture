import { createBoxMeshAsset, createCapsuleMeshAsset, createConeMeshAsset, createCylinderMeshAsset, createCustomWgslMaterialAsset, createLineListMeshAsset, createPlaneMeshAsset, createSphereMeshAsset, createStandardMaterialAsset, createUnlitMaterialAsset, materialAssetDependencies, validateCustomMaterialSource, validateMeshAsset, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createMaterialHandle, createMeshHandle, vec4, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { ApertureSystemError } from "../errors.js";
export function resolveMeshHandle(options, input) {
    if ("kind" in input.mesh && input.mesh.kind !== "mesh") {
        const id = `${input.key ?? input.name ?? "mesh"}.mesh`;
        const handle = createMeshHandle(id);
        registerReadyAsset(options.registry, handle, primitiveToMeshAsset(input.mesh));
        return handle;
    }
    return input.mesh;
}
export function resolveMaterialHandle(options, input) {
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
    return input.material;
}
function registerReadyAsset(registry, handle, assetValue, options = {}) {
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
function primitiveToMeshAsset(descriptorValue) {
    switch (descriptorValue.kind) {
        case "box": {
            const size = descriptorValue.options.size;
            const tuple = typeof size === "number"
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
            const tuple = typeof size === "number"
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
        case "line-list":
            return createLineListPrimitiveMeshAsset(descriptorValue.options);
    }
}
function createLineListPrimitiveMeshAsset(options) {
    const positions = lineListPositions(options.positions);
    const indices = options.indices === undefined
        ? undefined
        : lineListIndices(options.indices, positions.length);
    validateLinePairCount(indices?.length ?? positions.length, indices === undefined ? "positions" : "indices");
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
        throw new ApertureSystemError("aperture.spawn.invalidLineListMesh", `mesh.lineList() produced an invalid mesh: ${validation.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(" ")}`, "Check line-list positions, indices, submesh ranges, and material slots before spawning the mesh.");
    }
    return mesh;
}
function materialDescriptorToAsset(descriptorValue) {
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
        const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
        if (errors.length > 0) {
            throw new ApertureSystemError("aperture.spawn.invalidCustomWgslMaterial", `Custom WGSL material '${source.label}' is invalid: ${errors
                .map((diagnostic) => diagnostic.message)
                .join(" ")}`, "Fix material.customWgsl() familyKey, shader, entry points, render state, bindings, dependencies, or metadata.");
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
                    baseColorFactor: vec4(read4(descriptorValue.options.baseColor, 0), read4(descriptorValue.options.baseColor, 1), read4(descriptorValue.options.baseColor, 2), read4(descriptorValue.options.baseColor, 3)),
                }),
            ...(descriptorValue.options.renderState === undefined
                ? {}
                : { renderState: descriptorValue.options.renderState }),
        });
    }
    return createStandardMaterialAsset({
        ...(descriptorValue.options.label === undefined
            ? {}
            : { label: descriptorValue.options.label }),
        ...(descriptorValue.options.baseColor === undefined
            ? {}
            : {
                baseColorFactor: vec4(read4(descriptorValue.options.baseColor, 0), read4(descriptorValue.options.baseColor, 1), read4(descriptorValue.options.baseColor, 2), read4(descriptorValue.options.baseColor, 3)),
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
function normalizeCustomWgslBinding(binding) {
    if (binding.kind !== "uniform-buffer") {
        return binding;
    }
    return {
        ...binding,
        fields: Object.fromEntries(Object.entries(binding.fields).map(([name, field]) => [
            name,
            {
                ...field,
                type: normalizeUniformFieldType(field.type),
            },
        ])),
    };
}
function normalizeUniformFieldType(value) {
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
            return value;
    }
}
function read2(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return value;
}
function read3(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return value;
}
function read4(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return value;
}
function numberOption(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function lineListPositions(value) {
    if (!Array.isArray(value)) {
        invalidLineListMesh("mesh.lineList() requires positions to be an array of [x, y, z] tuples.");
    }
    return value.map((position, index) => lineListPosition(position, `positions[${index}]`));
}
function lineListPosition(value, path) {
    const tuple = arrayLike(value, path);
    return [
        finiteNumber(tuple[0], `${path}[0]`),
        finiteNumber(tuple[1], `${path}[1]`),
        finiteNumber(tuple[2], `${path}[2]`),
    ];
}
function lineListIndices(value, vertexCount) {
    if (value instanceof Uint16Array || value instanceof Uint32Array) {
        validateLineListIndices(value, vertexCount);
        return value;
    }
    if (!Array.isArray(value)) {
        invalidLineListMesh("mesh.lineList() indices must be a number array, Uint16Array, or Uint32Array.");
    }
    return value.map((index, itemIndex) => lineListIndex(index, `indices[${itemIndex}]`, vertexCount));
}
function validateLineListIndices(indices, vertexCount) {
    indices.forEach((index, itemIndex) => {
        lineListIndex(index, `indices[${itemIndex}]`, vertexCount);
    });
}
function lineListIndex(value, path, vertexCount) {
    const index = nonNegativeInteger(value, path);
    if (index >= vertexCount) {
        invalidLineListMesh(`mesh.lineList() ${path} references vertex ${index}, but only ${vertexCount} positions were provided.`);
    }
    return index;
}
function lineListMaterialSlots(value) {
    if (!Array.isArray(value)) {
        invalidLineListMesh("mesh.lineList() materialSlots must be a string array.");
    }
    return value.map((slot, index) => {
        if (typeof slot !== "string") {
            invalidLineListMesh(`mesh.lineList() materialSlots[${index}] must be a string.`);
        }
        return slot;
    });
}
function lineListSubmeshes(value, options) {
    if (!Array.isArray(value)) {
        invalidLineListMesh("mesh.lineList() submeshes must be an array.");
    }
    return value.map((submesh, index) => {
        if (!isRecord(submesh)) {
            invalidLineListMesh(`mesh.lineList() submeshes[${index}] must be an object.`);
        }
        const label = optionalString(submesh.label, `submeshes[${index}].label`);
        const normalized = {
            ...(label === undefined ? {} : { label }),
            ...(submesh.materialSlot === undefined
                ? {}
                : {
                    materialSlot: nonNegativeInteger(submesh.materialSlot, `submeshes[${index}].materialSlot`),
                }),
            ...(submesh.vertexStart === undefined
                ? {}
                : {
                    vertexStart: nonNegativeInteger(submesh.vertexStart, `submeshes[${index}].vertexStart`),
                }),
            ...(submesh.vertexCount === undefined
                ? {}
                : {
                    vertexCount: nonNegativeInteger(submesh.vertexCount, `submeshes[${index}].vertexCount`),
                }),
            ...(submesh.indexStart === undefined
                ? {}
                : {
                    indexStart: nonNegativeInteger(submesh.indexStart, `submeshes[${index}].indexStart`),
                }),
            ...(submesh.indexCount === undefined
                ? {}
                : {
                    indexCount: nonNegativeInteger(submesh.indexCount, `submeshes[${index}].indexCount`),
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
            invalidLineListMesh(`mesh.lineList() submeshes[${index}] ${lineRange}Start must begin on a line-pair boundary.`);
        }
        validateLinePairCount(lineCount, `submeshes[${index}].${lineRange}Count`);
        return normalized;
    });
}
function validateLinePairCount(count, path) {
    if (count % 2 !== 0) {
        invalidLineListMesh(`mesh.lineList() ${path} must contain an even number of entries because line-list data is consumed in pairs.`);
    }
}
function optionalString(value, path) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        invalidLineListMesh(`mesh.lineList() ${path} must be a string.`);
    }
    return value;
}
function nonNegativeInteger(value, path) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        invalidLineListMesh(`mesh.lineList() ${path} must be a non-negative integer.`);
    }
    return value;
}
function finiteNumber(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        invalidLineListMesh(`mesh.lineList() ${path} must be a finite number.`);
    }
    return value;
}
function arrayLike(value, path) {
    if (value === null ||
        typeof value !== "object" ||
        !("length" in value) ||
        typeof value.length !== "number" ||
        value.length < 3) {
        invalidLineListMesh(`mesh.lineList() ${path} must be an array-like [x, y, z] tuple.`);
    }
    return value;
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function invalidLineListMesh(message) {
    throw new ApertureSystemError("aperture.spawn.invalidLineListMesh", message, "Use mesh.lineList({ positions: [[x, y, z], [x, y, z], ...] }) with finite coordinates and paired positions or paired indices.");
}
//# sourceMappingURL=assets.js.map