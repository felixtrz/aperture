// WebGPU shader-compile gate (AI-17): compile every built-in family's
// output-stage-wrapped WGSL in a real WebGPU implementation (Dawn, via headless
// Chrome) and fail on any validation error.
//
// Why this exists: the family-agnostic output stage (`applyOutputStageToFragmentWgsl`)
// rewrites each family's fragment entry into an inner helper + a thin @fragment
// wrapper. The unit tests only assert the emitted *string*, never compile it, so a
// WGSL-validity regression (e.g. an IO attribute on a non-entry function) slips
// through them. This check closes that gap against real Dawn.
//
// Requires a built dist (`pnpm run typecheck`) and a WebGPU-capable Chrome. When no
// browser / adapter is available it SKIPS (exit 0) rather than failing, so it is
// safe in browserless environments; it only exits non-zero on an actual compile
// error.
//
// Usage: node scripts/webgpu-shader-compile-check.mjs
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyOutputStageToBuiltInShader,
  applyOutputStageToFragmentWgsl,
} from "../packages/webgpu/dist/output/output-stage-tonemap.js";
import { createMotionVectorBuiltInShaderVariant } from "../packages/webgpu/dist/render/motion/motion-vector-shader.js";
import {
  UNLIT_MESH_SHADER,
  UNLIT_TEXTURED_MESH_SHADER,
  UNLIT_VERTEX_COLOR_MESH_SHADER,
  UNLIT_TEXTURED_VERTEX_COLOR_MESH_SHADER,
} from "../packages/webgpu/dist/materials/unlit/unlit-shader.js";
import { MATCAP_MESH_SHADER } from "../packages/webgpu/dist/materials/matcap/matcap-shader.js";
import { DEBUG_NORMAL_MESH_SHADER } from "../packages/webgpu/dist/materials/debug-normal/debug-normal-shader.js";
import { SPRITE_WGSL } from "../packages/webgpu/dist/render/sprites/sprite-pipeline.js";
import { PARTICLE_RENDER_WGSL } from "../packages/webgpu/dist/render/particles/particle-pipeline.js";
import {
  UI_IMAGE_WGSL,
  UI_PANEL_WGSL,
} from "../packages/webgpu/dist/render/ui/ui-quad-pipeline.js";
import { MSDF_TEXT_WGSL } from "../packages/webgpu/dist/render/text/msdf-text-pipeline.js";

const OPERATORS = ["aces", "neutral", "agx", "reinhard", "linear"];

// Module-based families compose the motion-vector variant; string families do not.
const MESH_MODULES = {
  unlit: UNLIT_MESH_SHADER,
  "unlit-textured": UNLIT_TEXTURED_MESH_SHADER,
  "unlit-vertex-color": UNLIT_VERTEX_COLOR_MESH_SHADER,
  "unlit-textured-vertex-color": UNLIT_TEXTURED_VERTEX_COLOR_MESH_SHADER,
  matcap: MATCAP_MESH_SHADER,
  "debug-normal": DEBUG_NORMAL_MESH_SHADER,
};
const STRING_FAMILIES = {
  sprite: SPRITE_WGSL,
  particle: PARTICLE_RENDER_WGSL,
  "ui-panel": UI_PANEL_WGSL,
  "ui-image": UI_IMAGE_WGSL,
  "msdf-text": MSDF_TEXT_WGSL,
};

function buildCases() {
  const cases = [];
  for (const [name, module] of Object.entries(MESH_MODULES)) {
    if (
      applyOutputStageToBuiltInShader(module, "none", "linear").code !==
      module.code
    ) {
      throw new Error(`${name}: none+linear output stage is not a no-op`);
    }
    cases.push({
      name: `${name} aces/srgb`,
      code: applyOutputStageToBuiltInShader(module, "aces", "srgb").code,
    });
    cases.push({
      name: `${name} aces/srgb + motion-vector`,
      code: createMotionVectorBuiltInShaderVariant(
        applyOutputStageToBuiltInShader(module, "aces", "srgb"),
      ).code,
    });
  }
  for (const [name, wgsl] of Object.entries(STRING_FAMILIES)) {
    if (applyOutputStageToFragmentWgsl(wgsl, "none", "linear", name) !== wgsl) {
      throw new Error(`${name}: none+linear output stage is not a no-op`);
    }
    for (const operator of OPERATORS) {
      cases.push({
        name: `${name} ${operator}/srgb`,
        code: applyOutputStageToFragmentWgsl(wgsl, operator, "srgb", name),
      });
    }
  }
  return cases;
}

// Fail-closed in CI: a missing browser/adapter must not pass silently when the
// gate is explicitly required. APERTURE_REQUIRE_WEBGPU=1 turns every SKIP into a
// hard failure; locally (unset) the script still degrades to a SKIP so a
// browserless dev box stays usable.
const REQUIRE_WEBGPU = process.env.APERTURE_REQUIRE_WEBGPU === "1";
// CI exposes WebGPU only through real Google Chrome + SwiftShader (headless
// Chromium hides navigator.gpu on Linux), matching playwright.ci.config.ts. Set
// APERTURE_WEBGPU_CHANNEL=chrome (run under xvfb) to use it; unset uses the
// bundled Chromium headless path that works on macOS (Metal).
const WEBGPU_CHANNEL = process.env.APERTURE_WEBGPU_CHANNEL;

async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null;
  }
  try {
    if (WEBGPU_CHANNEL) {
      return await chromium.launch({
        channel: WEBGPU_CHANNEL,
        headless: false,
        args: [
          "--enable-unsafe-webgpu",
          "--use-vulkan=swiftshader",
          "--enable-features=Vulkan",
          "--enable-unsafe-swiftshader",
        ],
      });
    }
    return await chromium.launch({
      executablePath: chromium.executablePath(),
      args: [
        "--headless=new",
        "--enable-unsafe-webgpu",
        "--enable-features=WebGPU,Vulkan",
        "--use-angle=swiftshader",
      ],
    });
  } catch {
    return null;
  }
}

function reportUnavailable(reason, caseCount) {
  if (REQUIRE_WEBGPU) {
    console.error(
      `[webgpu-shader-compile-check] FAIL: ${reason}, but APERTURE_REQUIRE_WEBGPU=1 ` +
        "requires a real Dawn compile of every family shader.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `[webgpu-shader-compile-check] SKIP: ${reason} ` +
      `(string no-op invariants for ${caseCount} cases held).`,
  );
}

async function main() {
  const cases = buildCases();
  const browser = await launchBrowser();
  if (!browser) {
    reportUnavailable("no WebGPU-capable Chrome available", cases.length);
    return;
  }

  try {
    const page = await browser.newPage();
    const htmlPath = join(tmpdir(), "aperture-wgsl-compile-check.html");
    writeFileSync(htmlPath, "<!doctype html><title>wgsl</title>");
    await page.goto(`file://${htmlPath}`);

    const result = await page.evaluate(async (cases) => {
      if (!navigator.gpu) return { skip: "navigator.gpu unavailable" };
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return { skip: "no WebGPU adapter" };
      const device = await adapter.requestDevice();
      const failures = [];
      for (const testCase of cases) {
        device.pushErrorScope("validation");
        const module = device.createShaderModule({ code: testCase.code });
        const info = await (module.getCompilationInfo
          ? module.getCompilationInfo()
          : module.compilationInfo());
        const scopeError = await device.popErrorScope();
        const errors = info.messages.filter((m) => m.type === "error");
        if (errors.length || scopeError) {
          failures.push({
            name: testCase.name,
            messages: errors.map((m) => `${m.lineNum}: ${m.message}`),
            validationError: scopeError ? scopeError.message : null,
          });
        }
      }
      return { failures };
    }, cases);

    if (result.skip) {
      reportUnavailable(result.skip, cases.length);
      return;
    }
    if (result.failures.length > 0) {
      console.error(
        `[webgpu-shader-compile-check] ${result.failures.length} family shader(s) failed to compile:`,
      );
      for (const failure of result.failures) {
        console.error(`  ✗ ${failure.name}`);
        for (const message of failure.messages)
          console.error(`      ${message}`);
        if (failure.validationError) {
          console.error(`      ${failure.validationError.split("\n")[0]}`);
        }
      }
      process.exitCode = 1;
      return;
    }
    console.log(
      `[webgpu-shader-compile-check] OK: ${cases.length} output-stage family shaders compiled in Dawn.`,
    );
  } finally {
    await browser.close();
  }
}

await main();
