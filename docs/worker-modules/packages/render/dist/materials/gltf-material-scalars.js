import { vec4 } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { isFiniteNumberTuple, toDiagnosticValue, } from "./gltf-material-utils.js";
export function mapBaseColorFactor(input) {
    if (input.value === undefined) {
        return vec4(1, 1, 1, 1);
    }
    if (isFiniteNumberTuple(input.value, 4)) {
        const tuple = input.value;
        return vec4(tuple[0], tuple[1], tuple[2], tuple[3]);
    }
    input.diagnostics.push({
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialKey: input.materialKey,
        field: input.field,
        value: toDiagnosticValue(input.value),
        message: `${input.field} must be a four-number array.`,
    });
    return vec4(1, 1, 1, 1);
}
export function mapVec3(input) {
    if (input.value === undefined) {
        return input.fallback;
    }
    if (isFiniteNumberTuple(input.value, 3)) {
        const tuple = input.value;
        return [tuple[0], tuple[1], tuple[2]];
    }
    input.diagnostics.push({
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialKey: input.materialKey,
        field: input.field,
        value: toDiagnosticValue(input.value),
        message: `${input.field} must be a three-number array.`,
    });
    return input.fallback;
}
export function mapFiniteNumber(input) {
    if (input.value === undefined) {
        return input.fallback;
    }
    if (typeof input.value === "number" && Number.isFinite(input.value)) {
        return input.value;
    }
    input.diagnostics.push({
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialKey: input.materialKey,
        field: input.field,
        value: toDiagnosticValue(input.value),
        message: `${input.field} must be a finite number.`,
    });
    return input.fallback;
}
export function mapAlphaCutoff(input) {
    if (input.value === undefined) {
        return input.fallback;
    }
    if (typeof input.value === "number" &&
        Number.isFinite(input.value) &&
        input.value >= 0 &&
        input.value <= 1) {
        return input.value;
    }
    input.diagnostics.push({
        code: "gltfMaterial.invalidField",
        severity: "error",
        materialKey: input.materialKey,
        field: input.field,
        value: toDiagnosticValue(input.value),
        message: `${input.field} must be a finite number between 0 and 1.`,
    });
    return input.fallback;
}
//# sourceMappingURL=gltf-material-scalars.js.map