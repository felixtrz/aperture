import { type LayoutEngine, type LayoutEngineOptions } from "./engine.js";
import { loadLayoutModule } from "./yoga-loader.js";
import { createYogaLayoutEngine } from "./yoga-engine.js";

/**
 * Convenience for tests and tools: load Yoga and create a layout engine in one
 * await. Production code should load the module once at startup and reuse it.
 */
export async function createTestLayoutEngine(
  options?: LayoutEngineOptions,
): Promise<LayoutEngine> {
  const yoga = await loadLayoutModule();
  return createYogaLayoutEngine(yoga, options);
}
