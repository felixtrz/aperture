import { before, after, test } from "node:test";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "../packages/adapter-node/dist/index.js";
import { compileShader } from "../packages/shader/dist/compiler.js";
import {
  encodeShaderJob,
  decodeShaderJob,
} from "../packages/shader/dist/index.js";
import {
  createGpuContext,
  renderShaderJob,
} from "../packages/gpu/dist/index.js";
import { registerStandaloneGpuTests } from "../test/helpers/standalone-gpu-suite.mjs";

registerStandaloneGpuTests(
  { before, after, test },
  {
    createNodeDevice,
    createOffscreenOutput,
    compileShader,
    createGpuContext,
    renderShaderJob,
    encodeShaderJob,
    decodeShaderJob,
  },
);
