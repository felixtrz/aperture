import type { Yoga } from "yoga-layout/load";
/**
 * Load the Yoga WebAssembly module (async — Yoga 3.x is WASM-only with no
 * synchronous init path). The promise is cached, so this is safe to await from
 * many call sites; on a worker, await it once during system bootstrap before the
 * layout system ticks.
 */
export declare function loadLayoutModule(): Promise<Yoga>;
/** Test hook: drop the cached module so a fresh load can be exercised. */
export declare function resetLayoutModuleCacheForTests(): void;
export type { Yoga };
//# sourceMappingURL=yoga-loader.d.ts.map