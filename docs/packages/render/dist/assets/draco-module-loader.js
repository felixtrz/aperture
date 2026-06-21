import { decodeDracoMeshData } from "./draco-mesh-data.js";
import { arrayBufferFromBytes, bytesView } from "./draco-utils.js";
export async function createDracoMeshDecoder(source) {
    const [jsSource, wasmBinary] = await Promise.all([
        resolveDracoJsSource(source),
        resolveDracoWasmBinary(source),
    ]);
    const factory = compileDracoFactory(jsSource);
    const dracoModule = await factory({
        wasmBinary: arrayBufferFromBytes(wasmBinary),
    });
    if (typeof dracoModule.Decoder !== "function") {
        throw new Error("Draco decoder did not expose Decoder().");
    }
    if (typeof dracoModule.Mesh !== "function") {
        throw new Error("Draco decoder did not expose Mesh().");
    }
    return {
        decode(sourceBytes, options = {}) {
            return decodeDracoMeshData(sourceBytes, dracoModule, options);
        },
    };
}
async function resolveDracoJsSource(source) {
    if (source.jsSource !== undefined) {
        return source.jsSource;
    }
    if (source.jsUrl === undefined) {
        throw new Error("Draco decoder requires jsSource or jsUrl.");
    }
    if (source.fetchText !== undefined) {
        return source.fetchText(source.jsUrl);
    }
    if (typeof fetch !== "function") {
        throw new Error("No fetch implementation is available for Draco JS glue.");
    }
    const response = await fetch(source.jsUrl);
    if (!response.ok) {
        throw new Error(`Fetching Draco JS glue failed with HTTP ${response.status}.`);
    }
    return response.text();
}
async function resolveDracoWasmBinary(source) {
    if (source.wasmBinary !== undefined) {
        return new Uint8Array(bytesView(source.wasmBinary));
    }
    if (source.wasmUrl === undefined) {
        throw new Error("Draco decoder requires wasmBinary or wasmUrl.");
    }
    if (source.fetchBinary !== undefined) {
        return new Uint8Array(bytesView(await source.fetchBinary(source.wasmUrl)));
    }
    if (typeof fetch !== "function") {
        throw new Error("No fetch implementation is available for Draco WASM.");
    }
    const response = await fetch(source.wasmUrl);
    if (!response.ok) {
        throw new Error(`Fetching Draco WASM failed with HTTP ${response.status}.`);
    }
    return new Uint8Array(await response.arrayBuffer());
}
function compileDracoFactory(jsSource) {
    const moduleObject = {};
    const evaluator = new Function("module", "exports", "process", "__filename", "__dirname", "window", "document", "importScripts", `${jsSource}\nreturn module.exports || DracoDecoderModule;`);
    const factory = evaluator(moduleObject, {}, undefined, undefined, undefined, {}, undefined, undefined);
    if (typeof factory !== "function") {
        throw new Error("Draco JS glue did not expose a factory.");
    }
    return factory;
}
//# sourceMappingURL=draco-module-loader.js.map