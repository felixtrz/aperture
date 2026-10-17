import { beforeAll, afterAll, test } from "vitest";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "@aperture-engine/adapter-node";
import { compileShader } from "@aperture-engine/shader/compiler";
import { encodeShaderJob, decodeShaderJob } from "@aperture-engine/shader";
import { createGpuContext, renderShaderJob } from "@aperture-engine/gpu";
import { registerStandaloneGpuTests } from "../helpers/standalone-gpu-suite.mjs";

registerStandaloneGpuTests(
  {
    before: (run) => beforeAll(run, 60000),
    after: (run) => afterAll(run, 60000),
    test: (name, run) => test(name, run, 60000),
  },
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
