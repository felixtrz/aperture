import { errorMessage, isRecord } from "./gltf-uri-shared.js";
export function parseGltfJson(url, bytes) {
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch (error) {
        return invalidJson(url, error);
    }
    try {
        const parsed = JSON.parse(text);
        if (!isRecord(parsed)) {
            return invalidJson(url, null);
        }
        return { ok: true, root: parsed };
    }
    catch (error) {
        return invalidJson(url, error);
    }
}
function invalidJson(url, error) {
    return {
        ok: false,
        diagnostic: {
            code: "loadGltfFromUri.invalidJson",
            severity: "error",
            uri: url,
            message: errorMessage(error, `glTF URI '${url}' did not contain JSON.`),
        },
    };
}
//# sourceMappingURL=gltf-uri-json.js.map