import { INSTANCE_TINT_VERTEX_BUFFER_LAYOUT } from "../../resources/attributes/instance-tint-buffer.js";
import { STANDARD_SKINNING_JOINTS_LOCATION, STANDARD_SKINNING_WEIGHTS_LOCATION, } from "./standard-skinning-shader.js";
import { UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT, vertexColorAttributeFormatFromBatchKey, } from "../unlit/unlit-pipeline.js";
export const STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 48,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 3, offset: 32, format: "float32x4" },
    ],
};
export const STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 40,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 4, offset: 32, format: "float32x2" },
    ],
};
export const STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 48,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "float32x4" },
    ],
};
export const STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 44,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "float32x3" },
    ],
};
export const STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 36,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "unorm8x4" },
    ],
};
export const STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 40,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 5, offset: 32, format: "unorm16x4" },
    ],
};
export const STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 56,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        {
            shaderLocation: STANDARD_SKINNING_JOINTS_LOCATION,
            offset: 32,
            format: "uint16x4",
        },
        {
            shaderLocation: STANDARD_SKINNING_WEIGHTS_LOCATION,
            offset: 40,
            format: "float32x4",
        },
    ],
};
export const STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT = {
    arrayStride: 56,
    stepMode: "vertex",
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 3, offset: 32, format: "float32x4" },
        { shaderLocation: 4, offset: 48, format: "float32x2" },
    ],
};
function standardPrimitiveVertexBufferLayout(shader, batchKey) {
    const { needsTangents, needsTexCoord1, needsVertexColor, needsSkinning } = standardPrimitiveVertexFeatureNeeds(shader);
    if (needsSkinning && !needsTangents && !needsTexCoord1 && !needsVertexColor) {
        return resolveStandardSkinnedPrimitiveVertexBufferLayout(batchKey);
    }
    if (needsTangents && needsTexCoord1) {
        return STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
    }
    if (needsTangents) {
        return STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
    }
    if (needsTexCoord1) {
        return STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
    }
    if (needsVertexColor) {
        switch (vertexColorAttributeFormatFromBatchKey(batchKey)) {
            case "float32x3":
                return STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
            case "unorm8x4":
                return STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
            case "unorm16x4":
                return STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
            case "float32x4":
                return STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
        }
    }
    return UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
}
function standardPrimitiveVertexFeatureNeeds(shader) {
    return {
        needsTangents: shader.bindings.some((binding) => binding.id === "normalTexture"),
        needsTexCoord1: shader.code.includes("@location(4) uv1: vec2f"),
        needsVertexColor: shader.code.includes("@location(5) color: vec4f"),
        needsSkinning: shader.code.includes("@location(8) joints0: vec4u"),
    };
}
function createStandardDynamicPrimitiveVertexBufferLayouts(batchKey, features) {
    const streams = parseStandardMeshLayoutKey(batchKey?.meshLayoutKey);
    if (streams === null) {
        return null;
    }
    const required = new Set(requiredStandardVertexSemantics(features));
    const streamAttributes = streams.map((stream) => {
        const attributes = [];
        for (const semantic of required) {
            const attribute = stream.attributes.get(semantic);
            const shaderLocation = standardVertexShaderLocation(semantic);
            if (attribute !== undefined && shaderLocation !== null) {
                attributes.push({
                    shaderLocation,
                    offset: attribute.offset,
                    format: attribute.format,
                });
            }
        }
        return attributes;
    });
    for (const attributes of streamAttributes) {
        for (const attribute of attributes) {
            for (const semantic of required) {
                if (standardVertexShaderLocation(semantic) === attribute.shaderLocation) {
                    required.delete(semantic);
                    break;
                }
            }
        }
    }
    if (required.size > 0) {
        return null;
    }
    const lastUsedStreamIndex = findLastUsedStreamIndex(streamAttributes);
    if (lastUsedStreamIndex < 0) {
        return null;
    }
    for (let index = 0; index <= lastUsedStreamIndex; index += 1) {
        if ((streamAttributes[index]?.length ?? 0) === 0) {
            return null;
        }
    }
    return streams.slice(0, lastUsedStreamIndex + 1).map((stream, index) => ({
        arrayStride: stream.arrayStride,
        stepMode: "vertex",
        attributes: streamAttributes[index] ?? [],
    }));
}
function findLastUsedStreamIndex(streamAttributes) {
    for (let index = streamAttributes.length - 1; index >= 0; index -= 1) {
        if ((streamAttributes[index]?.length ?? 0) > 0) {
            return index;
        }
    }
    return -1;
}
function requiredStandardVertexSemantics(features) {
    const semantics = ["POSITION", "NORMAL", "TEXCOORD_0"];
    if (features.needsTangents) {
        semantics.push("TANGENT");
    }
    if (features.needsTexCoord1) {
        semantics.push("TEXCOORD_1");
    }
    if (features.needsVertexColor) {
        semantics.push("COLOR_0");
    }
    if (features.needsSkinning) {
        semantics.push("JOINTS_0", "WEIGHTS_0");
    }
    return semantics;
}
function parseStandardMeshLayoutKey(meshLayoutKey) {
    if (meshLayoutKey === undefined || meshLayoutKey.trim().length === 0) {
        return null;
    }
    const streams = [];
    const seen = new Set();
    for (const rawStream of meshLayoutKey.split("|")) {
        const stream = parseStandardMeshLayoutStream(rawStream, seen);
        if (stream === null) {
            return null;
        }
        streams.push(stream);
    }
    return streams.length > 0 ? streams : null;
}
function parseStandardMeshLayoutStream(rawStream, seen) {
    const attributes = new Map();
    let explicitStride = null;
    let offset = 0;
    for (const rawToken of rawStream.split(",")) {
        const token = rawToken.trim();
        if (token.length === 0) {
            return null;
        }
        if (token.startsWith("stride=")) {
            const stride = parseExplicitMeshLayoutStride(token);
            if (stride === null || explicitStride !== null) {
                return null;
            }
            explicitStride = stride;
            continue;
        }
        const parsed = parseExplicitMeshLayoutAttributeOffset(token);
        const semantic = meshLayoutTokenSemantic(parsed.token);
        const format = standardMeshLayoutTokenFormat(parsed.token);
        if (semantic === null ||
            format === null ||
            attributes.has(semantic) ||
            seen.has(semantic)) {
            return null;
        }
        const attributeOffset = parsed.offset ?? offset;
        const attributeEnd = attributeOffset + vertexFormatByteSize(format);
        seen.add(semantic);
        attributes.set(semantic, {
            shaderLocation: standardVertexShaderLocation(semantic) ?? 0,
            offset: attributeOffset,
            format,
        });
        offset =
            parsed.offset === null ? attributeEnd : Math.max(offset, attributeEnd);
    }
    const arrayStride = explicitStride ?? offset;
    return attributes.size > 0 && arrayStride >= offset
        ? { arrayStride, attributes }
        : null;
}
function meshLayoutTokenSemantic(token) {
    const [semantic] = token.split(":");
    return semantic === undefined || semantic.length === 0 ? null : semantic;
}
function standardMeshLayoutTokenFormat(token) {
    const [semantic, format] = token.split(":");
    switch (semantic) {
        case "POSITION":
        case "NORMAL":
        case "MORPH_POSITION_0":
        case "MORPH_NORMAL_0":
        case "MORPH_POSITION_1":
        case "MORPH_NORMAL_1":
            return format === undefined ? "float32x3" : null;
        case "TEXCOORD_0":
        case "TEXCOORD_1":
            return format === undefined ? "float32x2" : null;
        case "TANGENT":
            return format === undefined ? "float32x4" : null;
        case "COLOR_0":
            return format === undefined
                ? "float32x4"
                : isStandardColorFormat(format)
                    ? format
                    : null;
        case "JOINTS_0":
            return format === undefined
                ? "uint16x4"
                : format === "uint8x4" || format === "uint16x4"
                    ? format
                    : null;
        case "WEIGHTS_0":
            return format === undefined
                ? "float32x4"
                : isStandardWeightFormat(format)
                    ? format
                    : null;
        default:
            return null;
    }
}
function parseExplicitMeshLayoutStride(token) {
    const rawStride = token.slice("stride=".length);
    const value = Number.parseInt(rawStride, 10);
    return Number.isInteger(value) && value > 0 && String(value) === rawStride
        ? value
        : null;
}
function parseExplicitMeshLayoutAttributeOffset(token) {
    const offsetSeparator = token.lastIndexOf("@");
    if (offsetSeparator < 0) {
        return { token, offset: null };
    }
    const baseToken = token.slice(0, offsetSeparator);
    const rawOffset = token.slice(offsetSeparator + 1);
    const offset = Number.parseInt(rawOffset, 10);
    return Number.isInteger(offset) &&
        offset >= 0 &&
        String(offset) === rawOffset &&
        baseToken.length > 0
        ? { token: baseToken, offset }
        : { token: "", offset: null };
}
function isStandardColorFormat(format) {
    return (format === "float32x3" ||
        format === "float32x4" ||
        format === "unorm8x4" ||
        format === "unorm16x4");
}
function isStandardWeightFormat(format) {
    return (format === "float32x4" || format === "unorm8x4" || format === "unorm16x4");
}
function standardVertexShaderLocation(semantic) {
    switch (semantic) {
        case "POSITION":
            return 0;
        case "NORMAL":
            return 1;
        case "TEXCOORD_0":
            return 2;
        case "TANGENT":
            return 3;
        case "TEXCOORD_1":
            return 4;
        case "COLOR_0":
            return 5;
        case "JOINTS_0":
            return STANDARD_SKINNING_JOINTS_LOCATION;
        case "WEIGHTS_0":
            return STANDARD_SKINNING_WEIGHTS_LOCATION;
        default:
            // Morph semantics (MORPH_POSITION_*/MORPH_NORMAL_*) intentionally have no
            // vertex shader location: morph deltas render via the group(1) storage
            // buffer, not vertex attributes. They are still parsed by
            // `standardMeshLayoutTokenFormat` so the interleaved mesh stride is honored.
            return null;
    }
}
function resolveStandardSkinnedPrimitiveVertexBufferLayout(batchKey) {
    const formats = vertexSkinningAttributeFormatsFromBatchKey(batchKey);
    const usesDefaultFormats = formats.joints === "uint16x4" && formats.weights === "float32x4";
    if (usesDefaultFormats) {
        return STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT;
    }
    return createStandardSkinnedPrimitiveVertexBufferLayout({ formats });
}
export function vertexSkinningAttributeFormatsFromBatchKey(batchKey) {
    const tokens = typeof batchKey?.meshLayoutKey === "string"
        ? batchKey.meshLayoutKey.split(/[|,]/)
        : [];
    const joints = tokens.find((token) => token === "JOINTS_0" || token.startsWith("JOINTS_0:"));
    const weights = tokens.find((token) => token === "WEIGHTS_0" || token.startsWith("WEIGHTS_0:"));
    return {
        joints: joints === "JOINTS_0:uint8x4" ? "uint8x4" : "uint16x4",
        weights: weights === "WEIGHTS_0:unorm8x4"
            ? "unorm8x4"
            : weights === "WEIGHTS_0:unorm16x4"
                ? "unorm16x4"
                : "float32x4",
    };
}
function createStandardSkinnedPrimitiveVertexBufferLayout(input) {
    const attributes = [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
    ];
    let offset = 32;
    attributes.push({
        shaderLocation: STANDARD_SKINNING_JOINTS_LOCATION,
        offset,
        format: input.formats.joints,
    });
    offset += vertexFormatByteSize(input.formats.joints);
    attributes.push({
        shaderLocation: STANDARD_SKINNING_WEIGHTS_LOCATION,
        offset,
        format: input.formats.weights,
    });
    offset += vertexFormatByteSize(input.formats.weights);
    return {
        arrayStride: offset,
        stepMode: "vertex",
        attributes,
    };
}
function vertexFormatByteSize(format) {
    switch (format) {
        case "uint8x4":
        case "unorm8x4":
            return 4;
        case "uint16x4":
        case "unorm16x4":
            return 8;
        case "float32x2":
            return 8;
        case "float32x3":
            return 12;
        case "float32x4":
            return 16;
        default:
            return 0;
    }
}
export function standardVertexBufferLayouts(shader, batchKey) {
    const primitive = createStandardDynamicPrimitiveVertexBufferLayouts(batchKey, standardPrimitiveVertexFeatureNeeds(shader)) ?? [standardPrimitiveVertexBufferLayout(shader, batchKey)];
    if (!shader.code.includes("@location(6) instanceTint: vec4f")) {
        return primitive;
    }
    return [...primitive, INSTANCE_TINT_VERTEX_BUFFER_LAYOUT];
}
//# sourceMappingURL=standard-vertex-layout.js.map