import { loadYoga } from "yoga-layout/load";
let cached = null;
/**
 * Load the Yoga WebAssembly module (async — Yoga 3.x is WASM-only with no
 * synchronous init path). The promise is cached, so this is safe to await from
 * many call sites; on a worker, await it once during system bootstrap before the
 * layout system ticks.
 */
export function loadLayoutModule() {
    return (cached ??= loadYoga());
}
/** Test hook: drop the cached module so a fresh load can be exercised. */
export function resetLayoutModuleCacheForTests() {
    cached = null;
}
//# sourceMappingURL=yoga-loader.js.map