import { describe, expect, it, vi } from "vitest";

import {
  analyzeLightingHealth,
  createLightingHealthAnalyzer,
  createStandardMaterialAsset,
  lightingHealthInputFingerprint,
  lightingHealthReportToJson,
  lightingHealthReportToJsonValue,
  type LightPacket,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createEnvironmentMapHandle,
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";

describe("lighting health", () => {
  it("warns for visible metallic materials without specular IBL", () => {
    const assets = new AssetRegistry();
    const metal = registerMaterial(assets, "metal", 1);
    const snapshot = scene([
      draw(7, metal, "standard|opaque|back|less|no-blend|"),
      draw(8, metal, "standard|opaque|back|less|no-blend|"),
    ]);
    const report = analyzeLightingHealth({
      snapshot,
      assets,
      output: output(),
    });

    expect(report.materials).toMatchObject({
      visible: 1,
      highMetallic: 1,
      highMetallicWithoutIbl: 1,
      maximumMetallicFactor: 1,
    });
    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: "render.material.metalWithoutSpecularIbl",
        severity: "warning",
        materialCount: 1,
        entityCount: 2,
        maximumMetallicFactor: 1,
        activeEnvironmentCount: 0,
        materialKeys: ["material:metal"],
        entities: [
          { index: 7, generation: 1 },
          { index: 8, generation: 1 },
        ],
      }),
    ]);
  });

  it("does not warn for dielectric materials or active specular IBL", () => {
    const assets = new AssetRegistry();
    const dielectric = registerMaterial(assets, "dielectric", 0);
    const metal = registerMaterial(assets, "metal", 1);
    const pipeline =
      "standard|iblDiffuse|iblSpecularBrdf|opaque|back|less|no-blend|";

    expect(
      analyzeLightingHealth({
        snapshot: scene([draw(1, dielectric, pipeline)]),
        assets,
        output: output(),
      }).warnings,
    ).toEqual([]);

    const report = analyzeLightingHealth({
      snapshot: scene([draw(2, metal, pipeline)], { environment: true }),
      assets,
      output: output(),
      ibl: {
        diffuseReady: true,
        specularReady: true,
        preparationStatus: "diffuse-specular-ready",
      },
    });

    expect(report.lighting).toMatchObject({
      environment: 1,
      diffuseIblActive: true,
      specularIblActive: true,
      environmentPreparationStatus: "diffuse-specular-ready",
    });
    expect(report.materials.highMetallicWithoutIbl).toBe(0);
    expect(report.warnings).toEqual([]);
  });

  it("only considers visible mesh draws", () => {
    const assets = new AssetRegistry();
    registerMaterial(assets, "culled-metal", 1);
    const dielectric = registerMaterial(assets, "visible", 0);
    const report = analyzeLightingHealth({
      snapshot: scene([draw(1, dielectric)]),
      assets,
      output: output(),
    });

    expect(report.materials).toMatchObject({
      visible: 1,
      highMetallic: 0,
      highMetallicWithoutIbl: 0,
    });
    expect(report.warnings).toEqual([]);
  });

  it("reports an authored environment that is inactive", () => {
    const assets = new AssetRegistry();
    const dielectric = registerMaterial(assets, "dielectric", 0);
    const report = analyzeLightingHealth({
      snapshot: scene([draw(1, dielectric)], { environment: true }),
      assets,
      output: output(),
      ibl: {
        preparationStatus: "preparation-failed",
        diffuseReady: false,
        specularReady: false,
      },
    });

    expect(report.warnings).toEqual([
      expect.objectContaining({
        code: "render.environment.requestedButInactive",
        activeEnvironmentCount: 1,
      }),
    ]);
  });

  it("only emits the high-range warning from a measured clipping risk", () => {
    const assets = new AssetRegistry();
    const noMeasurement = analyzeLightingHealth({
      snapshot: scene([], { lights: [light("directional", 10_000)] }),
      assets,
      output: output({ tonemap: "none" }),
    });
    const measured = analyzeLightingHealth({
      snapshot: scene([], { lights: [light("directional", 1)] }),
      assets,
      output: output({ tonemap: "none" }),
      luminance: { maximumPreOutputLuminance: 2.5 },
    });

    expect(noMeasurement.warnings).toEqual([]);
    expect(measured.warnings).toEqual([
      expect.objectContaining({
        code: "render.output.untoneMappedHighRange",
        maximumPreOutputLuminance: 2.5,
        clippingRiskThreshold: 1,
      }),
    ]);
  });

  it("is deterministic and JSON-safe", () => {
    const assets = new AssetRegistry();
    const metalB = registerMaterial(assets, "b", 0.9);
    const metalA = registerMaterial(assets, "a", 1);
    const report = analyzeLightingHealth({
      snapshot: scene([draw(9, metalB), draw(3, metalA), draw(9, metalA)]),
      assets,
      output: output(),
    });
    const json = lightingHealthReportToJsonValue(report);

    expect(json.warnings[0]).toMatchObject({
      materialKeys: ["material:a", "material:b"],
      entities: [
        { index: 3, generation: 1 },
        { index: 9, generation: 1 },
      ],
    });
    expect(JSON.parse(lightingHealthReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPU|callback|raw/);
  });

  it("fingerprints only health-relevant state for steady-frame report reuse", () => {
    const assets = new AssetRegistry();
    const metal = registerMaterial(assets, "metal", 1);
    const first = scene([draw(1, metal)]);
    const nextFrame = { ...first, frame: 2 };
    const firstFingerprint = lightingHealthInputFingerprint(first, assets);

    expect(lightingHealthInputFingerprint(nextFrame, assets)).toBe(
      firstFingerprint,
    );
    expect(
      lightingHealthInputFingerprint(
        scene([
          draw(
            1,
            metal,
            "standard|iblDiffuse|iblSpecularBrdf|opaque|back|less|no-blend|",
          ),
        ]),
        assets,
      ),
    ).not.toBe(firstFingerprint);

    assets.markReady(
      metal,
      createStandardMaterialAsset({
        label: "metal",
        metallicFactor: 0.1,
        roughnessFactor: 0.7,
      }),
    );
    expect(lightingHealthInputFingerprint(nextFrame, assets)).not.toBe(
      firstFingerprint,
    );
  });

  it("refreshes moving-camera geometry without repeating material analysis", () => {
    const assets = new AssetRegistry();
    const metal = registerMaterial(assets, "metal", 1);
    const snapshot = scene([draw(1, metal), draw(2, metal)], {
      lights: [light("directional", 4)],
    });
    const input = { snapshot, assets, output: output() };
    const analyze = createLightingHealthAnalyzer();
    const first = analyze(input);
    const reads = vi.spyOn(assets, "get");
    try {
      const cameraSnapshot = withCamera(snapshot);
      const moved = analyze({ ...input, snapshot: cameraSnapshot });
      // The existing fingerprint performs one lookup per draw. Rebuilding the
      // visible material groups would cause another lookup for the unique asset.
      expect(reads).toHaveBeenCalledTimes(2);
      expect(moved.materials).toBe(first.materials);
      expect(moved.warnings).toBe(first.warnings);
      expect(moved.lighting.directionalGeometry).not.toBe(
        first.lighting.directionalGeometry,
      );
      expect(moved.lighting.directionalGeometry[0]!.cameras).toHaveLength(1);
      reads.mockClear();
      cameraSnapshot.viewMatrices[0] = -1;
      cameraSnapshot.viewMatrices[10] = -1;
      const turned = analyze({ ...input, snapshot: cameraSnapshot });
      expect(reads).toHaveBeenCalledTimes(2);
      expect(turned.materials).toBe(first.materials);
      expect(turned.warnings).toBe(first.warnings);
      expect(
        turned.lighting.directionalGeometry[0]!.cameras[0]!
          .angleFromCameraAxisDegrees,
      ).toBe(180);
      const lit = {
        ...cameraSnapshot,
        lights: [{ ...cameraSnapshot.lights[0]!, intensity: 8 }],
      };
      const brighter = analyze({ ...input, snapshot: lit });
      expect(brighter.materials).toBe(first.materials);
      expect(brighter.lighting.directionalGeometry[0]!.intensity).toBe(8);
      assets.markReady(
        metal,
        createStandardMaterialAsset({ metallicFactor: 0 }),
      );
      reads.mockClear();
      const painted = analyze({ ...input, snapshot: lit });
      expect(reads).toHaveBeenCalledTimes(3);
      expect(painted.materials).not.toBe(first.materials);
      expect(painted.warnings).toEqual([]);
    } finally {
      reads.mockRestore();
    }
  });

  it("does no geometry refresh for camera edits without directional lights", () => {
    const assets = new AssetRegistry();
    const snapshot = scene([]);
    const analyze = createLightingHealthAnalyzer();
    const input = { snapshot, assets, output: output() };
    const first = analyze(input);
    const moved = { ...input, snapshot: withCamera(snapshot) };
    expect(analyze(moved)).toBe(first);
    moved.snapshot.viewMatrices[12] = 100;
    expect(analyze(moved)).toBe(first);
    expect(lightingHealthInputFingerprint(moved.snapshot, assets)).toBe(
      lightingHealthInputFingerprint(snapshot, assets),
    );
  });

  it("invalidates compatibility for output, IBL and measured-luminance edits", () => {
    const assets = new AssetRegistry();
    const metal = registerMaterial(assets, "metal", 1);
    const snapshot = scene([draw(1, metal)], { environment: true });
    const analyze = createLightingHealthAnalyzer();
    const input = { snapshot, assets, output: output() };
    const first = analyze(input);
    expect(analyze({ ...input, snapshot: { ...snapshot, frame: 2 } })).toBe(
      first,
    );
    const reflected = analyze({
      ...input,
      ibl: { specularActive: true, specularReady: true },
    });
    expect(reflected).not.toBe(first);
    expect(reflected.warnings).toEqual([]);
    expect(reflected.lighting.specularIblReady).toBe(true);
    const unreflected = analyze({
      ...input,
      ibl: { specularActive: false, specularReady: false },
    });
    expect(unreflected.warnings).toEqual(first.warnings);
    const raw = {
      ...input,
      output: output({ tonemap: "none" }),
      luminance: { maximumPreOutputLuminance: 2 },
    };
    const clipped = analyze(raw);
    expect(
      clipped.warnings.some(
        (warning) => warning.code === "render.output.untoneMappedHighRange",
      ),
    ).toBe(true);
    const withinRange = analyze({
      ...raw,
      luminance: { maximumPreOutputLuminance: 2, clippingRiskThreshold: 3 },
    });
    expect(
      withinRange.warnings.some(
        (warning) => warning.code === "render.output.untoneMappedHighRange",
      ),
    ).toBe(false);
    const changedOutput = output({
      exposure: 2,
      hdr: false,
      colorSpace: "linear",
    });
    const changed = analyze({ ...input, output: changedOutput });
    expect(changed.output).toEqual(changedOutput);
    expect(changed).not.toBe(first);
  });
});

function withCamera(snapshot: RenderSnapshot): RenderSnapshot {
  return {
    ...snapshot,
    transforms: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]),
    viewMatrices: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]),
    views: [
      {
        viewId: 1,
        camera: { index: 9, generation: 0 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 0,
        projectionMatrixOffset: 0,
        viewProjectionMatrixOffset: 0,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
  };
}

function registerMaterial(
  assets: AssetRegistry,
  id: string,
  metallicFactor: number,
) {
  const handle = createMaterialHandle(id);
  assets.register(handle);
  assets.markReady(
    handle,
    createStandardMaterialAsset({
      label: id,
      metallicFactor,
      roughnessFactor: 0.7,
    }),
  );
  return handle;
}

function draw(
  index: number,
  material: ReturnType<typeof createMaterialHandle>,
  pipelineKey = "standard|opaque|back|less|no-blend|",
) {
  return {
    renderId: index,
    entity: { index, generation: 1 },
    mesh: createMeshHandle("fixture"),
    material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: {
      queue: "opaque" as const,
      viewId: 1,
      layer: 0,
      order: 0,
      pipelineKey,
      materialKey: material.id,
      meshKey: "fixture",
      depth: 0,
      stableId: index,
    },
    batchKey: {
      pipelineKey,
      materialKey: material.id,
      meshLayoutKey: "position",
      topology: "triangle-list" as const,
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}

function scene(
  meshDraws: RenderSnapshot["meshDraws"],
  options: {
    readonly environment?: boolean;
    readonly lights?: readonly LightPacket[];
  } = {},
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws,
    lights: options.lights ?? [],
    environments:
      options.environment === true
        ? [
            {
              environmentId: 1,
              handle: createEnvironmentMapHandle("studio"),
              color: [1, 1, 1, 1],
              intensity: 1,
              layerMask: 1,
            },
          ]
        : [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: meshDraws.length,
      lights: options.lights?.length ?? 0,
      environments: options.environment === true ? 1 : 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function light(kind: LightPacket["kind"], intensity: number): LightPacket {
  return {
    lightId: 1,
    entity: { index: 1, generation: 1 },
    kind,
    color: [1, 1, 1, 1],
    intensity,
    range: 0,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

type TestOutput = {
  readonly tonemap: "none" | "reinhard" | "aces" | "agx";
  readonly exposure: number;
  readonly hdr: boolean;
  readonly colorSpace: "linear" | "srgb";
};

function output(overrides: Partial<TestOutput> = {}): TestOutput {
  return {
    tonemap: "aces",
    exposure: 1,
    hdr: true,
    colorSpace: "srgb",
    ...overrides,
  };
}
