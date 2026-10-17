import { writeFile } from "node:fs/promises";
import { compileShaderFile } from "../packages/shader/dist/compiler.js";
import { STANDARD_MATERIAL_EXTENSION_WGSL } from "../packages/render/dist/index.js";
const root = new URL("../examples/material-shaders/", import.meta.url);
await writeFile(
  new URL("shaders/aperture-material.wgsl", root),
  STANDARD_MATERIAL_EXTENSION_WGSL.trim() + "\n",
);
const shader = await compileShaderFile(
  new URL("shaders/material.wgsl", root).pathname,
);
await writeFile(
  new URL("src/material.shader.json", root),
  JSON.stringify(shader, null, 2) + "\n",
);
console.log(`Material example shader: ${shader.hash}`);
