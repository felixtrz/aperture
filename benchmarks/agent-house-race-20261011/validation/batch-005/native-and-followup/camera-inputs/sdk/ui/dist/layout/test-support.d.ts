import { type LayoutEngine, type LayoutEngineOptions } from "./engine.js";
/**
 * Convenience for tests and tools: load Yoga and create a layout engine in one
 * await. Production code should load the module once at startup and reuse it.
 */
export declare function createTestLayoutEngine(options?: LayoutEngineOptions): Promise<LayoutEngine>;
//# sourceMappingURL=test-support.d.ts.map