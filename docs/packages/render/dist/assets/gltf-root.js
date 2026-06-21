const MAPPER_ARRAY_FIELDS = [
    "materials",
    "textures",
    "images",
    "samplers",
    // `skins` is a core root array (not an extension). Recognize it so skinned
    // assets validate as an array rather than being treated as unknown (M2-T3).
    "skins",
];
const SUPPORTED_ROOT_EXTENSIONS = new Set([
    "KHR_materials_unlit",
    "KHR_texture_transform",
    "KHR_texture_basisu",
    "KHR_draco_mesh_compression",
    "EXT_meshopt_compression",
    "KHR_meshopt_compression",
    "KHR_mesh_quantization",
]);
export function validateGltfRootForAssetMapping(root) {
    const diagnostics = [];
    if (!isRecord(root)) {
        diagnostics.push({
            code: "gltfRoot.malformedRoot",
            severity: "error",
            value: toDiagnosticValue(root),
            message: "glTF root must be an object.",
        });
        return { valid: false, diagnostics };
    }
    validateAsset(root, diagnostics);
    validateMapperArrays(root, diagnostics);
    validateRequiredExtensions(root, diagnostics);
    return {
        valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        diagnostics,
    };
}
export function gltfRootValidationReportToJsonValue(report) {
    return {
        valid: report.valid,
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfRootValidationReportToJson(report) {
    return JSON.stringify(gltfRootValidationReportToJsonValue(report));
}
function validateAsset(root, diagnostics) {
    const asset = root.asset;
    if (!isRecord(asset)) {
        diagnostics.push({
            code: "gltfRoot.invalidAsset",
            severity: "error",
            field: "asset",
            value: toDiagnosticValue(asset),
            message: "glTF root must include an asset object.",
        });
        return;
    }
    if (asset.version !== "2.0") {
        diagnostics.push({
            code: "gltfRoot.unsupportedVersion",
            severity: "error",
            field: "asset.version",
            value: toDiagnosticValue(asset.version),
            message: "Only glTF 2.0 roots are supported by the asset mapper.",
        });
    }
}
function validateMapperArrays(root, diagnostics) {
    for (const field of MAPPER_ARRAY_FIELDS) {
        const value = root[field];
        if (value !== undefined && !Array.isArray(value)) {
            diagnostics.push({
                code: "gltfRoot.malformedArray",
                severity: "error",
                field,
                value: toDiagnosticValue(value),
                message: `${field} must be an array when present.`,
            });
        }
    }
}
function validateRequiredExtensions(root, diagnostics) {
    const extensionsRequired = root.extensionsRequired;
    if (extensionsRequired === undefined) {
        return;
    }
    if (!Array.isArray(extensionsRequired)) {
        diagnostics.push({
            code: "gltfRoot.malformedArray",
            severity: "error",
            field: "extensionsRequired",
            value: toDiagnosticValue(extensionsRequired),
            message: "extensionsRequired must be an array when present.",
        });
        return;
    }
    for (const extensionName of extensionsRequired) {
        if (typeof extensionName === "string" &&
            SUPPORTED_ROOT_EXTENSIONS.has(extensionName)) {
            continue;
        }
        diagnostics.push({
            code: "gltfRoot.unsupportedRequiredExtension",
            severity: "error",
            field: "extensionsRequired",
            ...(typeof extensionName === "string" ? { extensionName } : {}),
            value: toDiagnosticValue(extensionName),
            message: typeof extensionName === "string"
                ? `Required glTF extension '${extensionName}' is not supported by the minimal asset mapper.`
                : "extensionsRequired entries must be extension name strings.",
        });
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toDiagnosticValue(value) {
    if (value === null) {
        return null;
    }
    switch (typeof value) {
        case "string":
        case "boolean":
            return value;
        case "number":
            return Number.isFinite(value) ? value : String(value);
        case "undefined":
            return "undefined";
        case "bigint":
        case "symbol":
        case "function":
        case "object":
            return Object.prototype.toString.call(value);
    }
    return String(value);
}
//# sourceMappingURL=gltf-root.js.map