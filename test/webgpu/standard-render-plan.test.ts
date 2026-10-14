import { describe, expect, it, vi } from "vitest";
import type { BatchCompatibilityKey } from "@aperture-engine/render";
import {
  createStandardRenderPlan,
  materializeStandardExplicitPipelineLayout,
} from "../../packages/webgpu/src/materials/standard/standard-render-plan.js";
import {
  createStandardPipelineDescriptorPlan,
  createStandardPipelineShaderFeaturePlan,
} from "../../packages/webgpu/src/materials/standard/standard-pipeline-descriptor.js";
import { createStandardRenderPipelineResource } from "../../packages/webgpu/src/materials/standard/standard-pipeline.js";
import {
  createStandardTextureVariantShader,
  STANDARD_MESH_SHADER,
} from "../../packages/webgpu/src/materials/standard/standard-shader.js";
import { getWebGpuAppPipelineLayouts } from "../../packages/webgpu/src/app/pipeline-layouts.js";
import { getOrCreateWebGpuAppPipeline } from "../../packages/webgpu/src/app/pipeline-resources.js";
import { createWebGpuAppResourceCache } from "../../packages/webgpu/src/app/resource-cache.js";
import { createWebGpuAppResourceReuseReport } from "../../packages/webgpu/src/app/report.js";
import type { WebGpuApp } from "../../packages/webgpu/src/app/app.js";
import type { WebGpuBindGroupLayoutDescriptor } from "../../packages/webgpu/src/gpu/bind-group-layout-cache.js";

function batch(uniform = false, extra: string[] = []): BatchCompatibilityKey {
  return {
    pipelineKey: [
      "standard",
      "standard-light-mask-3",
      "standard-light-layout-2-1_0",
      "standard-single-shadow-owner-0",
      "standard-directional-filter-1",
      "shadowMap",
      ...(uniform ? ["standard-small-light-uniforms-v1"] : []),
      ...extra,
      "opaque",
      "back",
      "less",
      "none",
    ].join("|"),
    materialKey: "material:one",
    meshLayoutKey: "primitive-interleaved",
    topology: "triangle-list",
    instanced: true,
    skinned: false,
    morphed: false,
  };
}

function device() {
  const layouts: WebGpuBindGroupLayoutDescriptor[] = [];
  const pipelineLayouts: unknown[] = [];
  const shaders: string[] = [];
  const pipelines: unknown[] = [];
  return {
    layouts,
    pipelineLayouts,
    shaders,
    pipelines,
    createBindGroupLayout(descriptor: WebGpuBindGroupLayoutDescriptor) {
      layouts.push(descriptor);
      return { descriptor };
    },
    createPipelineLayout(descriptor: {
      readonly bindGroupLayouts: readonly unknown[];
    }) {
      pipelineLayouts.push(descriptor);
      return { descriptor };
    },
    createShaderModule(descriptor: { readonly code: string }) {
      shaders.push(descriptor.code);
      return {};
    },
    createRenderPipeline(descriptor: unknown) {
      pipelines.push(descriptor);
      return { getBindGroupLayout: (group: number) => ({ group }) };
    },
  };
}

describe("one typed standard plan", () => {
  it("checks compiled pipeline reuse before decoding a plan and still separates feature transitions", async () => {
    const gpu = device();
    // CPU pipeline-cache fixture: no frame, worker, canvas or rendering route is run.
    const app = {
      sceneRenderFormat: "rgba16float",
      initialization: { format: "bgra8unorm", device: gpu },
      tonemap: "aces",
      outputColorSpace: "srgb",
      msaa: { sampleCount: 4 },
    } as unknown as WebGpuApp;
    const cache = createWebGpuAppResourceCache(false);
    const reuse = createWebGpuAppResourceReuseReport();
    const key = { ...batch() };
    let featureKey = key.pipelineKey;
    let reads = 0;
    Object.defineProperty(key, "pipelineKey", {
      enumerable: true,
      get: () => {
        reads++;
        return featureKey;
      },
    });
    const first = await getOrCreateWebGpuAppPipeline({
      app,
      cache,
      reuse,
      kind: "standard",
      batchKey: key,
      pipelineKey: featureKey,
    });
    expect(first.valid).toBe(true);
    reads = 0;
    for (let frame = 0; frame < 10; frame++) {
      expect(
        await getOrCreateWebGpuAppPipeline({
          app,
          cache,
          reuse,
          kind: "standard",
          batchKey: key,
          pipelineKey: featureKey,
        }),
      ).toBe(first);
    }
    // Each hit reads the feature key only for the compact lookup, and does not
    // read it again to derive a plan or construct binding descriptors.
    expect(reads).toBe(10);
    reads = 0;
    expect(
      await getOrCreateWebGpuAppPipeline({
        app,
        cache,
        reuse,
        kind: "standard",
        batchKey: key,
        pipelineKey: featureKey,
      }),
    ).toBe(first);
    expect(reads).toBe(1);
    expect(gpu.pipelines).toHaveLength(1);
    expect(reuse.pipelineHits).toBe(11);
    featureKey = batch(false, ["baseColorTexture"]).pipelineKey;
    const changed = await getOrCreateWebGpuAppPipeline({
      app,
      cache,
      reuse,
      kind: "standard",
      batchKey: key,
      pipelineKey: featureKey,
    });
    expect(changed.valid).toBe(true);
    expect(changed).not.toBe(first);
    expect(gpu.pipelines).toHaveLength(2);
    expect(cache.pipelines.size).toBe(2);
    expect(
      [...cache.pipelines.keys()].every(
        (value) => !value.includes('"layouts"'),
      ),
    ).toBe(true);
    cache.pipelines.clear();
    const rebuilt = await getOrCreateWebGpuAppPipeline({
      app,
      cache,
      reuse,
      kind: "standard",
      batchKey: key,
      pipelineKey: featureKey,
    });
    expect(rebuilt).not.toBe(changed);
    expect(gpu.pipelines).toHaveLength(3);
  });

  it("reuses immutable structural plans across new batch objects and material values", () => {
    const key = batch();
    const first = createStandardRenderPlan(key);
    const repeated = createStandardRenderPlan({
      ...key,
      materialKey: "material:updated-numeric-values",
    });
    expect(repeated).toBe(first);
    expect(repeated.features).toBe(first.features);
    expect(repeated.lightBindingLayout).toBe(first.lightBindingLayout);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.features)).toBe(true);
    expect(Object.isFrozen(first.features.knownLightKindLayout)).toBe(true);
    expect(Object.isFrozen(first.lightBindingLayout.entries)).toBe(true);
    expect(Object.isFrozen(first.lightBindingLayout.entries[0]?.buffer)).toBe(
      true,
    );
    expect(Reflect.set(first.features, "baseColorTexture", true)).toBe(false);
  });

  it("separates structural transitions, fallback options and authored overrides", () => {
    const key = batch(true);
    const first = createStandardRenderPlan(key);
    const texture = createStandardRenderPlan(batch(true, ["baseColorTexture"]));
    const order = createStandardRenderPlan({
      ...key,
      pipelineKey: key.pipelineKey
        .replace("layout-2-1_0", "layout-2-0_1")
        .replace("owner-0", "owner-1"),
    });
    const vertexColor = createStandardRenderPlan({
      ...key,
      meshLayoutKey: "primitive-interleaved|COLOR_0:float32x4",
    });
    const skinned = createStandardRenderPlan({ ...key, skinned: true });
    const morphed = createStandardRenderPlan({ ...key, morphed: true });
    const authored = createStandardRenderPlan(key, { authoredShader: true });
    const automatic = createStandardRenderPlan(key, { explicitLayouts: false });
    const storage = createStandardRenderPlan(key, {
      smallLightUniforms: false,
    });
    for (const changed of [
      texture,
      order,
      vertexColor,
      skinned,
      morphed,
      authored,
      automatic,
      storage,
    ]) {
      expect(changed).not.toBe(first);
    }
    expect(texture.features.baseColorTexture).toBe(true);
    expect(order.features.fixedSingleShadowLightIndex).toBe(1);
    expect(vertexColor.features.vertexColor).toBe(true);
    expect(skinned.lightTransport).toBe("storage");
    expect(morphed.lightTransport).toBe("storage");
    expect(authored.lightTransport).toBe("storage");
    expect(authored.usesAreaLightLtc).toBe(true);
    expect(automatic.layoutMode).toBe("auto");
    expect(storage.lightTransport).toBe("storage");
    expect(createStandardRenderPlan({ ...key })).toBe(first);
    expect(createStandardRenderPlan(key, { authoredShader: true })).toBe(
      authored,
    );
  });

  it("does not treat caller-owned feature object identity as a numeric revision", () => {
    const key = batch(true);
    const layout: (0 | 1)[] = [1, 0];
    const features = {
      ...createStandardRenderPlan(key).features,
      knownLightKindLayout: layout,
    };
    const first = createStandardRenderPlan(key, { features });
    features.baseColorTexture = true;
    layout[0] = 0;
    layout[1] = 1;
    const changed = createStandardRenderPlan(key, { features });
    expect(changed).not.toBe(first);
    expect(first.features.baseColorTexture).toBe(false);
    expect(first.features.knownLightKindLayout).toEqual([1, 0]);
    expect(changed.features.baseColorTexture).toBe(true);
    expect(changed.features.knownLightKindLayout).toEqual([0, 1]);
    expect(changed.lightTransport).toBe("storage");
    expect(Object.isFrozen(features)).toBe(false);
    expect(Object.isFrozen(layout)).toBe(false);
  });

  it("bounds pure cache retention and re-derives an evicted plan without changing its contract", async () => {
    vi.resetModules();
    const isolated =
      await import("../../packages/webgpu/src/materials/standard/standard-render-plan.js");
    const first = isolated.createStandardRenderPlan(batch());
    // Enumerate existing valid packed-kind tuples; this tests CPU plan cache
    // retention only and allocates no device objects or numeric light packets.
    for (let bits = 0; bits < 256; bits++) {
      const kinds = Array.from(
        { length: 8 },
        (_, index) => (bits >> index) & 1,
      );
      const mask = kinds.reduce((value, kind) => value | (1 << kind), 0);
      const owner = kinds.indexOf(1);
      isolated.createStandardRenderPlan({
        ...batch(),
        pipelineKey: [
          "standard",
          `standard-light-mask-${mask}`,
          `standard-light-layout-8-${kinds.join("_")}`,
          `standard-single-shadow-owner-${owner < 0 ? "none" : owner}`,
          "standard-directional-filter-1",
          "shadowMap",
          "opaque",
          "back",
          "less",
          "none",
        ].join("|"),
      });
    }
    const restored = isolated.createStandardRenderPlan(batch());
    expect(restored).not.toBe(first);
    expect(restored).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("reuses host layout records by pipeline identity and respects cache clearing", async () => {
    const gpu = device();
    const result = await createStandardRenderPipelineResource({
      device: gpu,
      batchKey: batch(),
      colorFormat: "rgba16float",
    });
    const cache = { layouts: new Map() };
    let resolutions = 0;
    const getBindGroupLayout = (group: number) => {
      resolutions++;
      return { group };
    };
    const first = getWebGpuAppPipelineLayouts({
      cache,
      kind: "standard",
      pipeline: result,
      getBindGroupLayout,
    });
    for (let frame = 0; frame < 10; frame++) {
      expect(
        getWebGpuAppPipelineLayouts({
          cache,
          kind: "standard",
          pipeline: { ...result },
          getBindGroupLayout,
        }),
      ).toBe(first);
    }
    expect(resolutions).toBe(4);
    cache.layouts.clear();
    const refreshed = getWebGpuAppPipelineLayouts({
      cache,
      kind: "standard",
      pipeline: result,
      getBindGroupLayout,
    });
    expect(refreshed).not.toBe(first);
    expect(resolutions).toBe(8);
    const otherCache = { layouts: new Map() };
    const another = getWebGpuAppPipelineLayouts({
      cache: otherCache,
      kind: "standard",
      pipeline: result,
      getBindGroupLayout,
    });
    expect(another).not.toBe(refreshed);
    expect(resolutions).toBe(12);
  });

  it("keeps authored overrides automatic even when a specialized plan was supplied", async () => {
    const gpu = device();
    const key = batch(true);
    const result = await createStandardRenderPipelineResource({
      device: gpu,
      batchKey: key,
      renderPlan: createStandardRenderPlan(key),
      shader: STANDARD_MESH_SHADER,
      colorFormat: "rgba16float",
      tonemap: "none",
      outputColorSpace: "linear",
    });
    expect(result.valid).toBe(true);
    expect(result.resource?.standardRenderPlan?.lightTransport).toBe("storage");
    expect(result.resource?.standardRenderPlan?.usesAreaLightLtc).toBe(true);
    expect(result.resource?.descriptor.layout).toBe("auto");
    expect(gpu.layouts).toHaveLength(0);
    expect(gpu.shaders[0]).toBe(STANDARD_MESH_SHADER.code);
  });
  it("keeps storage WGSL exact while sharing the finalized feature object", () => {
    const key = batch(false, ["baseColorTexture", "instance-tint"]);
    const plan = createStandardRenderPlan(key);
    const auto = createStandardRenderPlan(key, { explicitLayouts: false });
    const shader = createStandardPipelineShaderFeaturePlan(
      key,
      undefined,
      plan,
    );
    const descriptor = createStandardPipelineDescriptorPlan({
      batchKey: key,
      renderPlan: plan,
      colorFormat: "rgba16float",
    });
    expect(plan.layoutMode).toBe("explicit");
    expect(shader.features).toBe(plan.features);
    expect(shader.shader.code).toBe(
      createStandardTextureVariantShader(auto.features).code,
    );
    expect(descriptor.plan?.renderPlan).toBe(plan);
    expect(
      plan.lightBindingLayout.entries.map((entry) => entry.binding),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(
      plan.bindGroupLayouts[1]?.entries.map((entry) => entry.binding),
    ).toEqual([0]);
    expect(
      plan.bindGroupLayouts[2]?.entries.map((entry) => entry.binding),
    ).toEqual([0, 1, 2]);
  });

  it("requires a matching narrow ABI and separates uniform from storage identities", () => {
    const storage = createStandardRenderPlan(batch());
    const uniform = createStandardRenderPlan(batch(true));
    expect(uniform.lightTransport).toBe("sun-ambient-v1");
    expect(uniform.lightBindingLayout.entries.slice(0, 2)).toMatchObject([
      { binding: 0, buffer: { type: "uniform", minBindingSize: 240 } },
      { binding: 1, buffer: { type: "uniform", minBindingSize: 64 } },
    ]);
    expect(uniform.structuralKey).not.toBe(storage.structuralKey);
    expect(
      createStandardPipelineShaderFeaturePlan(batch(true)).variantKey,
    ).toContain("small-light-uniforms-sun-ambient-v1");
    for (const extra of [
      "iblDiffuse",
      "transmission",
      "clearcoatTexture",
      "fogExp",
      "clusteredLocalLights",
      "pointShadowMap",
      "spotShadowMap",
    ]) {
      const fallback = createStandardRenderPlan(batch(true, [extra]));
      expect(fallback.lightTransport, extra).toBe("storage");
      expect(fallback.layoutMode, extra).toBe("auto");
    }
    const wrongOwner = {
      ...batch(true),
      pipelineKey: batch(true).pipelineKey.replace("owner-0", "owner-1"),
    };
    expect(createStandardRenderPlan(wrongOwner).lightTransport).toBe("storage");
    const custom = createStandardRenderPlan(batch(true), {
      authoredShader: true,
    });
    expect(custom.lightTransport).toBe("storage");
    expect(custom.layoutMode).toBe("auto");
    expect(custom.usesAreaLightLtc).toBe(true);
  });

  it("declares transmission producers and bindings for every light provider family", () => {
    for (const extra of [
      [],
      ["shadowMap"],
      ["iblDiffuse"],
      ["shadowMap", "iblDiffuse"],
      ["pointShadowMap"],
      ["shadowMap", "pointShadowMap"],
      ["shadowMap", "cascadedShadowMap"],
      ["shadowMap", "pointShadowMap", "clusteredLocalLights"],
    ]) {
      const key = {
        ...batch(),
        pipelineKey: [
          "standard",
          "transmission",
          ...extra,
          "opaque",
          "back",
          "less",
          "none",
        ].join("|"),
      };
      const plan = createStandardRenderPlan(key);
      expect(plan.transmissionSceneColor).toMatchObject({
        producer: "scene-color-grab",
        textureBinding: 14,
        samplerBinding: 15,
      });
      expect(
        plan.lightBindingLayout.entries.filter(
          (entry) => entry.binding === 14 || entry.binding === 15,
        ),
      ).toMatchObject([
        {
          binding: 14,
          texture: {
            sampleType: "float",
            viewDimension: "2d",
            multisampled: false,
          },
        },
        { binding: 15, sampler: { type: "filtering" } },
      ]);
      expect(plan.layoutMode).toBe("auto");
    }
  });

  it("owns actual explicit layouts per device and forwards the same plan to host layouts", async () => {
    const gpu = device();
    const key = batch(true, ["baseColorTexture"]);
    const plan = createStandardRenderPlan(key);
    const explicit = materializeStandardExplicitPipelineLayout(gpu, plan);
    expect(materializeStandardExplicitPipelineLayout(gpu, plan)).toBe(explicit);
    expect(gpu.layouts).toHaveLength(4);
    const result = await createStandardRenderPipelineResource({
      device: gpu,
      batchKey: key,
      renderPlan: plan,
      colorFormat: "rgba16float",
      depthFormat: "depth24plus",
      sampleCount: 4,
      tonemap: "none",
      outputColorSpace: "linear",
    });
    expect(result.valid).toBe(true);
    expect(result.resource?.descriptor.layout).toBe(explicit?.layout);
    expect(gpu.layouts).toHaveLength(4);
    expect(gpu.shaders[0]).toContain("var<uniform> smallLightFloats");
    const host = getWebGpuAppPipelineLayouts({
      cache: { layouts: new Map() },
      kind: "standard",
      pipeline: result,
      getBindGroupLayout: (group) => explicit?.bindGroupLayouts[group],
    });
    expect(host.standardRenderPlan).toBe(plan);
    expect(host.lightLayout?.descriptor).toBe(plan.lightBindingLayout);
    expect(host.lightLayout?.layout).toBe(explicit?.bindGroupLayouts[3]);
    const anotherDevice = device();
    expect(
      materializeStandardExplicitPipelineLayout(anotherDevice, plan),
    ).not.toBe(explicit);
    expect(anotherDevice.layouts).toHaveLength(4);
  });

  it("bounds admission and selects matching storage shader/resources before submission", async () => {
    const gpu = device();
    const seed = createStandardRenderPlan(batch(true));
    for (let bits = 0; bits < 128; bits++) {
      const plan = createStandardRenderPlan(batch(true), {
        features: {
          ...seed.features,
          baseColorTexture: Boolean(bits & 1),
          metallicRoughnessTexture: Boolean(bits & 2),
          normalTexture: Boolean(bits & 4),
          occlusionTexture: Boolean(bits & 8),
          emissiveTexture: Boolean(bits & 16),
          instanceTint: Boolean(bits & 32),
          vertexColor: Boolean(bits & 64),
        },
      });
      expect(
        materializeStandardExplicitPipelineLayout(gpu, plan),
      ).not.toBeNull();
    }
    expect(gpu.pipelineLayouts).toHaveLength(128);
    const key = {
      ...batch(true),
      pipelineKey: batch(true)
        .pipelineKey.replace("layout-2-1_0", "layout-2-0_1")
        .replace("owner-0", "owner-1"),
    };
    const rejected = createStandardRenderPlan(key);
    expect(materializeStandardExplicitPipelineLayout(gpu, rejected)).toBeNull();
    const result = await createStandardRenderPipelineResource({
      device: gpu,
      batchKey: key,
      renderPlan: rejected,
      colorFormat: "rgba16float",
    });
    expect(result.valid).toBe(true);
    expect(result.resource?.standardRenderPlan?.lightTransport).toBe("storage");
    expect(result.resource?.standardRenderPlan?.layoutMode).toBe("auto");
    expect(result.resource?.descriptor.layout).toBe("auto");
    expect(gpu.shaders.at(-1)).toContain("var<storage, read> lightFloats");
    expect(gpu.shaders.at(-1)).not.toContain("smallLightFloats");
    expect(gpu.pipelineLayouts).toHaveLength(128);
  });
});
