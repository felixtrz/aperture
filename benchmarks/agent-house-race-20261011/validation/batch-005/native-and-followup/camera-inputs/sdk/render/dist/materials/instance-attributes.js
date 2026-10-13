const DEFAULT_INSTANCE_ATTRIBUTE_LOCATION = 6;
export function defineInstanceAttributes(attributes) {
    return {
        attributes: normalizeInstanceAttributes(attributes).map((attribute) => ({
            name: attribute.name,
            format: attribute.format,
            shaderLocation: attribute.shaderLocation,
        })),
    };
}
export function createInstanceAttributeLayout(input) {
    if (input === undefined || input.attributes.length === 0) {
        return null;
    }
    const attributes = normalizeInstanceAttributes(input.attributes);
    const strideFloats = attributes.reduce((max, attribute) => Math.max(max, attribute.floatOffset + attribute.components), 0);
    return {
        attributes,
        stride: strideFloats * 4,
        strideFloats,
        layoutKey: instanceAttributeLayoutKey(attributes),
    };
}
export function instanceAttributeComponentCount(format) {
    switch (format) {
        case "float32":
            return 1;
        case "float32x2":
            return 2;
        case "float32x3":
            return 3;
        case "float32x4":
            return 4;
    }
}
function normalizeInstanceAttributes(declarations) {
    const names = new Set();
    const locations = new Set();
    let byteOffset = 0;
    return declarations.map((declaration, index) => {
        const name = declaration.name.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            throw new RangeError(`Instance attribute names must be WGSL identifier-like strings; received '${declaration.name}'.`);
        }
        if (names.has(name)) {
            throw new RangeError(`Instance attribute '${name}' is declared more than once.`);
        }
        names.add(name);
        const shaderLocation = declaration.shaderLocation ?? DEFAULT_INSTANCE_ATTRIBUTE_LOCATION + index;
        if (!Number.isInteger(shaderLocation) || shaderLocation < 0) {
            throw new RangeError(`Instance attribute '${name}' has invalid shader location '${String(shaderLocation)}'.`);
        }
        if (locations.has(shaderLocation)) {
            throw new RangeError(`Instance attribute shader location ${shaderLocation} is declared more than once.`);
        }
        locations.add(shaderLocation);
        const components = instanceAttributeComponentCount(declaration.format);
        const normalized = {
            name,
            format: declaration.format,
            shaderLocation,
            offset: byteOffset,
            floatOffset: byteOffset / 4,
            components,
        };
        byteOffset += components * 4;
        return normalized;
    });
}
function instanceAttributeLayoutKey(attributes) {
    const normalized = attributes
        .map((attribute) => `${attribute.name}:${attribute.format}:${attribute.shaderLocation}:${attribute.floatOffset}`)
        .join(",");
    return stableStringHash(normalized);
}
function stableStringHash(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
//# sourceMappingURL=instance-attributes.js.map