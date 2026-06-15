// The vendored three.js r184 WebGPU build ships no .d.ts alongside this build
// file. The lab consumes it as an opaque module (typed `any`); the bundle is the
// upstream reference renderer, not engine code we type-check. Wildcard match so
// the relative `./three.webgpu.js` import resolves to `any`.
declare module "*/three.webgpu.js";
