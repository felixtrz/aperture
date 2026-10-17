// Upstream ships ESM separately from its CJS main under a type:module package.
// Use the ESM file explicitly, while retaining upstream's public declarations.
declare module "wgsl_reflect/wgsl_reflect.module.js" {
  export { WgslReflect, WgslParser, WgslScanner } from "wgsl_reflect";
}
