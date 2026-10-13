import { arrayBufferFromBytes, bytesView } from "./ktx2-utils.js";
export async function loadBasisUniversalKtx2Module(source) {
    const [jsSource, wasmBinary] = await Promise.all([
        resolveTranscoderJsSource(source),
        resolveTranscoderWasmBinary(source),
    ]);
    const basisFactory = compileBasisFactory(jsSource);
    const basisModule = await basisFactory({
        wasmBinary: arrayBufferFromBytes(wasmBinary),
    });
    if (typeof basisModule.initializeBasis !== "function") {
        throw new Error("Basis Universal transcoder did not expose initializeBasis().");
    }
    if (typeof basisModule.KTX2File !== "function") {
        throw new Error("Basis Universal transcoder does not support KTX2File.");
    }
    basisModule.initializeBasis();
    return basisModule;
}
async function resolveTranscoderJsSource(source) {
    if (source.jsSource !== undefined) {
        return source.jsSource;
    }
    if (source.jsUrl === undefined) {
        throw new Error("Basis Universal transcoder requires jsSource or jsUrl.");
    }
    if (source.fetchText !== undefined) {
        return source.fetchText(source.jsUrl);
    }
    if (typeof fetch !== "function") {
        throw new Error("No fetch implementation is available for Basis Universal JS glue.");
    }
    const response = await fetch(source.jsUrl);
    if (!response.ok) {
        throw new Error(`Fetching Basis Universal JS glue failed with HTTP ${response.status}.`);
    }
    return response.text();
}
async function resolveTranscoderWasmBinary(source) {
    if (source.wasmBinary !== undefined) {
        return new Uint8Array(bytesView(source.wasmBinary));
    }
    if (source.wasmUrl === undefined) {
        throw new Error("Basis Universal transcoder requires wasmBinary or wasmUrl.");
    }
    if (source.fetchBinary !== undefined) {
        return new Uint8Array(bytesView(await source.fetchBinary(source.wasmUrl)));
    }
    if (typeof fetch !== "function") {
        throw new Error("No fetch implementation is available for Basis Universal WASM.");
    }
    const response = await fetch(source.wasmUrl);
    if (!response.ok) {
        throw new Error(`Fetching Basis Universal WASM failed with HTTP ${response.status}.`);
    }
    return new Uint8Array(await response.arrayBuffer());
}
function compileBasisFactory(jsSource) {
    const moduleObject = {};
    const evaluator = new Function("module", "exports", "process", "__filename", "__dirname", "window", "document", "importScripts", `${jsSource}\nreturn module.exports || BASIS;`);
    const factory = evaluator(moduleObject, {}, undefined, undefined, undefined, {}, undefined, undefined);
    if (typeof factory !== "function") {
        throw new Error("Basis Universal JS glue did not expose a factory.");
    }
    return factory;
}
//# sourceMappingURL=ktx2-basis-module.js.map