/**
 * Engine animation clip *data* types. These live in the base simulation
 * package (alongside {@link AnimationClipHandle}) so both the glTF importer in
 * `@aperture-engine/render` and the sampler/mixer in `@aperture-engine/runtime`
 * can share one canonical clip shape without a package-boundary cycle (runtime
 * depends on render, so render cannot import runtime). The runtime package
 * re-exports these and owns the pure sampler that consumes them.
 *
 * Data only: flat typed buffers, no logic, structured-clone / worker safe.
 */
export {};
//# sourceMappingURL=animation-clip-data.js.map