/**
 * Evaluate one config in a disposable module graph. Native ESM import caches
 * transitive dependencies (including failed imports); changing the root URL
 * cannot refresh them. A worker gives each invocation fresh ESM and CJS caches
 * without changing app/runtime singleton semantics or rewriting user imports.
 * This is execution isolation, not a security sandbox for untrusted configs.
 */
export declare function evaluateConfigTypeMetadata(configFile: string): Promise<unknown>;
//# sourceMappingURL=config-type-evaluation.d.ts.map