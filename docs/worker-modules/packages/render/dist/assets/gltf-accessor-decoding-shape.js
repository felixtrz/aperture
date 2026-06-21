import { GLTF_COMPONENT_BYTE, GLTF_COMPONENT_FLOAT, GLTF_COMPONENT_SHORT, GLTF_COMPONENT_UNSIGNED_BYTE, GLTF_COMPONENT_UNSIGNED_INT, GLTF_COMPONENT_UNSIGNED_SHORT, } from "./gltf-accessor-validation-utils.js";
const ACCESSOR_COMPONENTS = new Map([
    ["SCALAR", 1],
    ["VEC2", 2],
    ["VEC3", 3],
    ["VEC4", 4],
]);
export const NATIVE_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
export function decodeShape(accessor) {
    const sourceItemSize = ACCESSOR_COMPONENTS.get(accessor.accessorType);
    if (sourceItemSize === undefined) {
        return null;
    }
    switch (accessor.expectedFormat) {
        case "float32x2":
        case "float32x3":
        case "float32x4": {
            const sourceComponent = sourceComponentForAccessor(accessor);
            if (sourceComponent === null) {
                return null;
            }
            return {
                sourceItemSize,
                outputItemSize: sourceItemSize,
                sourceComponentBytes: sourceComponent.sourceComponentBytes,
                sourceComponentType: sourceComponent.sourceComponentType,
                normalizeComponents: accessor.normalized &&
                    sourceComponent.sourceComponentType !== "float32",
                output: "float32",
                paddingComponentValue: 0,
            };
        }
        case "unorm8x4":
            return {
                sourceItemSize,
                outputItemSize: 4,
                sourceComponentBytes: 1,
                sourceComponentType: "uint8",
                normalizeComponents: false,
                output: "uint8",
                paddingComponentValue: 255,
            };
        case "unorm16x4":
            return {
                sourceItemSize,
                outputItemSize: 4,
                sourceComponentBytes: 2,
                sourceComponentType: "uint16",
                normalizeComponents: false,
                output: "uint16",
                paddingComponentValue: 65535,
            };
        case "uint8x4":
            return {
                sourceItemSize,
                outputItemSize: sourceItemSize,
                sourceComponentBytes: 1,
                sourceComponentType: "uint8",
                normalizeComponents: false,
                output: "uint8",
                paddingComponentValue: 0,
            };
        case "uint16x4":
            return {
                sourceItemSize,
                outputItemSize: sourceItemSize,
                sourceComponentBytes: 2,
                sourceComponentType: "uint16",
                normalizeComponents: false,
                output: "uint16",
                paddingComponentValue: 0,
            };
        case "uint8-to-uint16":
            return {
                sourceItemSize,
                outputItemSize: sourceItemSize,
                sourceComponentBytes: 1,
                sourceComponentType: "uint8",
                normalizeComponents: false,
                output: "uint16",
                paddingComponentValue: 0,
            };
        case "uint16":
            return {
                sourceItemSize,
                outputItemSize: sourceItemSize,
                sourceComponentBytes: 2,
                sourceComponentType: "uint16",
                normalizeComponents: false,
                output: "uint16",
                paddingComponentValue: 0,
            };
        case "uint32":
            return {
                sourceItemSize,
                outputItemSize: sourceItemSize,
                sourceComponentBytes: 4,
                sourceComponentType: "uint32",
                normalizeComponents: false,
                output: "uint32",
                paddingComponentValue: 0,
            };
    }
}
export function createOutputArray(shape, length) {
    switch (shape.output) {
        case "float32":
            return new Float32Array(length);
        case "uint8":
            return new Uint8Array(length);
        case "uint16":
            return new Uint16Array(length);
        case "uint32":
            return new Uint32Array(length);
    }
}
export function createOutputArrayView(shape, buffer, byteOffset, length) {
    switch (shape.output) {
        case "float32":
            return new Float32Array(buffer, byteOffset, length);
        case "uint8":
            return new Uint8Array(buffer, byteOffset, length);
        case "uint16":
            return new Uint16Array(buffer, byteOffset, length);
        case "uint32":
            return new Uint32Array(buffer, byteOffset, length);
    }
}
export function outputComponentBytes(shape) {
    return shape.output === "uint8" ? 1 : shape.output === "uint16" ? 2 : 4;
}
export function readComponent(view, byteOffset, shape) {
    switch (shape.sourceComponentType) {
        case "float32":
            return view.getFloat32(byteOffset, true);
        case "int8": {
            const value = view.getInt8(byteOffset);
            return shape.normalizeComponents ? Math.max(value / 127, -1) : value;
        }
        case "uint8": {
            const value = view.getUint8(byteOffset);
            return shape.normalizeComponents ? value / 255 : value;
        }
        case "int16": {
            const value = view.getInt16(byteOffset, true);
            return shape.normalizeComponents ? Math.max(value / 32767, -1) : value;
        }
        case "uint16": {
            const value = view.getUint16(byteOffset, true);
            return shape.normalizeComponents ? value / 65535 : value;
        }
        case "uint32":
            return view.getUint32(byteOffset, true);
    }
}
function sourceComponentForAccessor(accessor) {
    switch (accessor.componentType) {
        case GLTF_COMPONENT_FLOAT:
            return { sourceComponentBytes: 4, sourceComponentType: "float32" };
        case GLTF_COMPONENT_BYTE:
            return { sourceComponentBytes: 1, sourceComponentType: "int8" };
        case GLTF_COMPONENT_UNSIGNED_BYTE:
            return { sourceComponentBytes: 1, sourceComponentType: "uint8" };
        case GLTF_COMPONENT_SHORT:
            return { sourceComponentBytes: 2, sourceComponentType: "int16" };
        case GLTF_COMPONENT_UNSIGNED_SHORT:
            return { sourceComponentBytes: 2, sourceComponentType: "uint16" };
        case GLTF_COMPONENT_UNSIGNED_INT:
            return { sourceComponentBytes: 4, sourceComponentType: "uint32" };
    }
    return null;
}
export function arrayTypeForExpectedFormat(expectedFormat) {
    switch (expectedFormat) {
        case "float32x2":
        case "float32x3":
        case "float32x4":
            return "Float32Array";
        case "unorm8x4":
        case "uint8x4":
            return "Uint8Array";
        case "unorm16x4":
        case "uint16x4":
        case "uint8-to-uint16":
        case "uint16":
            return "Uint16Array";
        case "uint32":
            return "Uint32Array";
    }
}
//# sourceMappingURL=gltf-accessor-decoding-shape.js.map