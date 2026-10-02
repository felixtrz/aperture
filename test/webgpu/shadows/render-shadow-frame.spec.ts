import { normalizeShadowSubmittedDrawCounts } from "../../../packages/webgpu/src/app/shadow-submission-report.js";
import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createRenderShadowFrame,
  createWebGpuEnvironmentResourceCache,
  makePerspective,
  multiplyMat4,
  type RenderShadowFrameDeviceLike,
  type RenderSnapshot,
  type ShadowCasterExecutableMeshResourceView,
  type ShadowCasterPreparedMeshResourceView,
} from "@aperture-engine/webgpu/test-support";

import {
  renderReport,
  webGpuAppRenderReportToJsonValue,
} from "../../../packages/webgpu/src/app/report.js";
import { renderBundleFeedbackMetadata } from "../../../packages/cli/src/render/driver.js";

// These scenarios always produce directional shadows; narrow the shadow-kind
// union to the directional members the assertions read.
function dirMatrix(
  value: unknown,
):
  | { readonly orthographicSize: number; readonly center: readonly number[] }
  | undefined {
  return value as
    | { readonly orthographicSize: number; readonly center: readonly number[] }
    | undefined;
}
function dirPlan(value: unknown):
  | {
      readonly cascadeNearDistance: number;
      readonly cascadeFarDistance: number;
    }
  | undefined {
  return value as
    | {
        readonly cascadeNearDistance: number;
        readonly cascadeFarDistance: number;
      }
    | undefined;
}

describe("render shadow frame", () => {
  it("reports cascaded sun plus three omitted point requests through public and CLI status", () => {
    const source = snapshot({ shadowRequest: { cascadeCount: 2 } });
    const points = [21, 22, 23].map((lightId) => ({
      ...source.shadowRequests[0]!,
      shadowId: lightId + 100,
      lightId,
      lightKind: "point" as const,
    }));
    const mixed = {
      ...source,
      shadowRequests: [...source.shadowRequests, ...points],
    };
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: mixed,
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });
    expect(result.report.status).toBe("submitted");
    expect(result.report.requestCount).toBe(1);
    expect(result.report.requestCoverage).toEqual({
      requestedCount: 4,
      servedCount: 1,
      omittedCount: 3,
      requested: [
        { shadowId: 7, lightId: 11, lightKind: "directional" },
        ...points.map(({ shadowId, lightId, lightKind }) => ({
          shadowId,
          lightId,
          lightKind,
        })),
      ],
      served: [{ shadowId: 7, lightId: 11, lightKind: "directional" }],
      omitted: points.map(({ shadowId, lightId, lightKind }) => ({
        shadowId,
        lightId,
        lightKind,
        reason: "mixed-shadow-kind-not-supported",
      })),
    });
    expect(result.report.diagnostics).toHaveLength(3);
    for (const lightId of [21, 22, 23]) {
      expect(result.report.diagnostics).toContainEqual({
        stage: "shadowRequests",
        code: "renderShadowFrame.omittedShadowRequest",
        severity: "warning",
        message: `Shadow request ${lightId + 100} for point light ${lightId} was omitted: mixed-shadow-kind-not-supported. The selected shadow path is directional.`,
      });
    }
    const report = renderReport({
      ok: true,
      snapshot: mixed,
      diagnostics: [],
      shadow: result.report,
    });
    for (const detail of ["full", "status"] as const) {
      const value = webGpuAppRenderReportToJsonValue(report, { detail });
      expect(value.shadow).toMatchObject({
        requestCoverage: result.report.requestCoverage,
      });
      expect(value.diagnostics).toEqual(result.report.diagnostics);
      const cli = renderBundleFeedbackMetadata(value);
      expect(cli.diagnostics).toEqual(result.report.diagnostics);
      expect(cli.shadow).toMatchObject({
        requestCoverage: result.report.requestCoverage,
      });
    }
  });

  it.each(["directional", "point", "spot"] as const)(
    "preserves homogeneous %s coverage without omission warnings",
    (lightKind) => {
      const source = snapshot({
        shadowRequest: { lightKind, cascadeCount: 1 },
      });
      const result = createRenderShadowFrame({
        device: device(createDeviceCalls()),
        snapshot: {
          ...source,
          lights: source.lights.map((light) => ({
            ...light,
            kind: lightKind,
            range: 10,
            outerConeAngle: 0.8,
          })),
        },
        preparedMeshes: preparedMeshes(),
        executableMeshes: executableMeshes(),
      });
      expect(result.report.requestCoverage).toMatchObject({
        requestedCount: 1,
        servedCount: 1,
        omittedCount: 0,
        omitted: [],
        served: [{ shadowId: 7, lightId: 11, lightKind }],
      });
      expect(result.report.diagnostics).not.toContainEqual(
        expect.objectContaining({
          code: "renderShadowFrame.omittedShadowRequest",
        }),
      );
      expect(result.report.status).toBe("submitted");
    },
  );

  it("identifies unsupported light kinds independently of mixed supported kinds", () => {
    const source = snapshot();
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: {
        ...source,
        shadowRequests: [
          ...source.shadowRequests,
          {
            ...source.shadowRequests[0]!,
            lightKind: "rect-area",
            lightId: 30,
            shadowId: 30,
          },
        ],
      },
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
    });
    expect(result.report.requestCoverage?.omitted).toEqual([
      {
        shadowId: 30,
        lightId: 30,
        lightKind: "rect-area",
        reason: "unsupported-shadow-light-kind",
      },
    ]);
    expect(result.report.diagnostics).toHaveLength(1);
    expect(result.report.diagnostics[0]?.message).toContain(
      "unsupported-shadow-light-kind",
    );
  });

  it("keeps an empty shadow request list quiet", () => {
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: { ...snapshot(), shadowRequests: [] },
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
    });
    expect(result.report.status).toBe("not-required");
    expect(result.report.requestCoverage).toEqual({
      requestedCount: 0,
      servedCount: 0,
      omittedCount: 0,
      requested: [],
      served: [],
      omitted: [],
    });
    expect(result.report.diagnostics).toEqual([]);
  });

  it("reports point precedence over spot and legacy directional requests", () => {
    for (const lightKind of [undefined, "point"] as const) {
      const source = snapshot({
        shadowRequest: {
          ...(lightKind === undefined ? {} : { lightKind }),
          cascadeCount: 1,
        },
      });
      const { lightKind: _kind, ...legacy } = source.shadowRequests[0]!;
      const request =
        lightKind === undefined ? legacy : source.shadowRequests[0]!;
      const result = createRenderShadowFrame({
        device: device(createDeviceCalls()),
        snapshot: {
          ...source,
          shadowRequests: [
            request,
            { ...request, shadowId: 99, lightId: 99, lightKind: "spot" },
          ],
        },
        preparedMeshes: preparedMeshes(),
        executableMeshes: executableMeshes(),
      });
      expect(result.report.requestCoverage).toMatchObject({
        requestedCount: 2,
        servedCount: 1,
        omittedCount: 1,
        served: [{ lightKind: lightKind ?? "directional" }],
        omitted: [
          {
            lightId: 99,
            lightKind: "spot",
            reason: "mixed-shadow-kind-not-supported",
          },
        ],
      });
    }
  });

  it("submits a directional CSM caster pass and returns receiver resources", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 3, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.report.status).toBe("submitted");
    expect(result.report.commandBufferSubmission.status).toBe("submitted");
    expect(result.report.commandBufferSubmission.sections.shaderSampling).toBe(
      true,
    );
    expect(result.report.passCount).toBeGreaterThan(0);
    expect(result.report.drawCalls).toBeGreaterThan(0);
    expect(result.report.diagnostics).toEqual([]);
    expect(result.receiverResources).toMatchObject({
      shadowKind: "directional-cascaded",
    });
    expect(result.receiverResources?.matrixBufferResource.resource).not.toBe(
      null,
    );
    expect(
      result.receiverResources?.depthTextureResources.resources.some(
        (resource) => resource.allocation.resource !== null,
      ),
    ).toBe(true);
    expect(calls.submissions).toHaveLength(1);
    expect(JSON.stringify(result.report)).not.toMatch(
      /deferred|not implemented yet/i,
    );
  });

  it("reports partial caster readiness and preserves omitted caster identity", () => {
    const source = snapshot();
    const original = source.meshDraws[0]!;
    const partial = {
      ...source,
      meshDraws: [
        ...source.meshDraws,
        {
          ...original,
          renderId: 202,
          mesh: createMeshHandle("missing"),
          sortKey: {
            ...original.sortKey,
            meshKey: "mesh:missing",
            stableId: 202,
          },
        },
      ],
    };
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: partial,
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });
    expect(result.report.casterCounts).toMatchObject({
      requestedDraws: 2,
      includedDraws: 2,
      readyDraws: 1,
      encodedDrawCalls: 1,
      submittedDrawCalls: 1,
    });
    expect(result.report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "shadowCasterCommandRecord.frameResourcesNotReady",
        renderId: 202,
        meshKey: "mesh:missing",
        passKey: expect.any(String),
      }),
    );
  });

  it.each([
    "standard|blend|back|less|alpha",
    "standard|alpha-test|back|less|none",
  ])("preserves unsupported material omission identity: %s", (pipelineKey) => {
    const source = snapshot();
    const original = source.meshDraws[0]!;
    const unsupported = {
      ...source,
      meshDraws: [
        ...source.meshDraws,
        {
          ...original,
          renderId: 203,
          batchKey: { ...original.batchKey, pipelineKey },
        },
      ],
    };
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: unsupported,
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });
    expect(result.report.casterCounts).toMatchObject({
      requestedDraws: 2,
      includedDraws: 1,
      readyDraws: 1,
      encodedDrawCalls: 1,
      submittedDrawCalls: 1,
    });
    expect(result.report.diagnostics).toContainEqual(
      expect.objectContaining({
        renderId: 203,
        meshKey: "mesh:caster",
        severity: "warning",
        code: expect.stringMatching(/unsupportedAlpha/),
      }),
    );
  });

  it("frustum-fits automatic directional shadows from the primary snapshot camera", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot({ view: primaryCameraView() }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });

    expect(result.report.status).toBe("submitted");
    expect(result.report.diagnostics).toEqual([]);
    expect(
      dirPlan(result.viewProjection.plans[0])?.cascadeNearDistance,
    ).toBeCloseTo(0.1, 4);
    expect(
      dirPlan(result.viewProjection.plans[0])?.cascadeFarDistance,
    ).toBeCloseTo(60, 2);
    expect(
      dirPlan(result.report.viewProjection.plans[0])?.cascadeFarDistance,
    ).toBeCloseTo(60, 2);
    expect(
      dirMatrix(result.matrixComputation.matrices[0])?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(
      dirMatrix(result.report.matrixComputation.matrices[0])?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(result.report.casterDrawList.includedDrawCount).toBe(
      result.casterDrawList.includedDrawCount,
    );
    expect(dirMatrix(result.matrixComputation.matrices[0])?.center).not.toEqual(
      [0, 0, 0],
    );
  });

  it("uses matrix options as fallback without suppressing primary camera frustum fit", () => {
    const baseResult = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({ view: primaryCameraView() }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({ view: primaryCameraView() }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
      matrix: {
        center: [0, 0, -2],
        orthographicSize: 4,
        near: 0.5,
        far: 8,
        lightDistance: 4,
      },
    });

    expect(result.report.status).toBe("submitted");
    expect(
      dirMatrix(result.matrixComputation.matrices[0])?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(result.matrixComputation.matrices[0]).toEqual(
      baseResult.matrixComputation.matrices[0],
    );
    expect(dirMatrix(result.matrixComputation.matrices[0])?.center).not.toEqual(
      [0, 0, -2],
    );
  });

  it("tightens single-cascade frustum fit to receiver bounds", () => {
    const wideCamera = primaryCameraView();
    const loose = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: wideCamera,
        shadowRequest: { cascadeCount: 1 },
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });
    const tight = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: wideCamera,
        shadowRequest: { cascadeCount: 1 },
        bounds: [
          boundsPacket(0, {
            min: [-2, 0, -2],
            max: [2, 2, 2],
          }),
        ],
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });

    const looseSize =
      dirMatrix(loose.matrixComputation.matrices[0])?.orthographicSize ?? 0;
    const tightSize =
      dirMatrix(tight.matrixComputation.matrices[0])?.orthographicSize ?? 0;

    expect(looseSize).toBeGreaterThan(100);
    expect(tightSize).toBeGreaterThan(0);
    expect(tightSize).toBeLessThan(10);
    expect(tightSize).toBeLessThan(looseSize * 0.1);
    expect(
      dirMatrix(tight.report.matrixComputation.matrices[0])?.orthographicSize,
    ).toBe(tightSize);
  });

  it("reuses cached shadow resources across identical frames", () => {
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const input = {
      device: device(calls),
      snapshot: snapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      shadowMap: { cascadeCount: 3, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame(input);
    const second = createRenderShadowFrame(input);

    expect(first.report.resourceReuse).toMatchObject({
      depthTexturesCreated: 1,
      depthTexturesReused: 0,
      samplersCreated: 1,
      samplersReused: 0,
      pipelinesCreated: 1,
      pipelinesReused: 0,
      matrixBindGroupsCreated: 3,
      matrixBindGroupsReused: 0,
    });
    expect(second.report.resourceReuse).toMatchObject({
      depthTexturesCreated: 0,
      depthTexturesReused: 1,
      samplersCreated: 0,
      samplersReused: 1,
      pipelinesCreated: 0,
      pipelinesReused: 1,
      matrixBindGroupsCreated: 0,
      matrixBindGroupsReused: 3,
    });
    expect(second.report.commandBufferSubmission.status).toBe("submitted");
    expect(second.report.commandBufferSubmission.sections.shaderSampling).toBe(
      true,
    );
    expect(second.report.diagnostics).toEqual([]);
    expect(calls.textures).toHaveLength(1);
    expect(calls.samplers).toHaveLength(1);
    expect(calls.pipelines).toHaveLength(1);
    expect(calls.buffers).toHaveLength(5);
    expect(calls.bindGroups).toHaveLength(3);
    expect(calls.submissions).toHaveLength(2);
    expect(calls.destroyedBuffers).toHaveLength(0);
    expect(
      calls.bufferWrites.filter((write) =>
        writeTargetsBufferLabel(write, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(1);
  });

  it("updates cached caster world transforms in place when caster transforms change", () => {
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const base = {
      device: device(calls),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      shadowMap: { cascadeCount: 3, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame({
      ...base,
      snapshot: snapshot(),
    });
    const second = createRenderShadowFrame({
      ...base,
      snapshot: snapshot({ transforms: translatedTransform([1, 0, 0]) }),
    });

    expect(first.report.status).toBe("submitted");
    expect(second.report.status).toBe("submitted");
    expect(
      calls.buffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(1);
    expect(
      calls.destroyedBuffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(0);
    expect(
      calls.bufferWrites.filter((write) =>
        writeTargetsBufferLabel(write, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(2);
  });

  it("recreates caster world-transform resources when the caster count changes", () => {
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const base = {
      device: device(calls),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame({
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 1 } }),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
    });
    const second = createRenderShadowFrame({
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 3 } }),
      shadowMap: { cascadeCount: 3, mapSize: 512 },
    });

    expect(first.report.status).toBe("submitted");
    expect(second.report.status).toBe("submitted");
    expect(
      calls.buffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(2);
    expect(
      calls.destroyedBuffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(1);
    expect(
      calls.destroyedBuffers.filter((buffer) =>
        bufferHasLabel(buffer, "DirectionalShadowMatrices/storage"),
      ),
    ).toHaveLength(1);
    expect(calls.bindGroups).toHaveLength(4);
  });

  it("drops cached caster command topology when the world-transform buffer is recreated", () => {
    // Regression: demolishing a shadow caster changes the caster count, which
    // resizes (destroys + recreates) the shared ShadowCasterWorldTransforms
    // buffer. Revisiting an earlier caster configuration must not replay a
    // cached command topology whose bind groups still point at the destroyed
    // buffer — doing so submits a destroyed buffer every frame and blacks out
    // the whole device (a permanent black screen after delete).
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const base = {
      device: device(calls),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;
    const single = {
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 1 } }),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
    } as const;
    const triple = {
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 3 } }),
      shadowMap: { cascadeCount: 3, mapSize: 512 },
    } as const;

    // 1 cascade (caches a topology) -> 3 cascades (recreates the buffer, so the
    // first topology now references a destroyed buffer) -> back to 1 cascade,
    // whose topology key matches the very first frame.
    createRenderShadowFrame(single);
    createRenderShadowFrame(triple);
    const revisit = createRenderShadowFrame(single);

    expect(revisit.report.status).toBe("submitted");

    const destroyed = new Set(calls.destroyedBuffers);
    const referencedBuffers = bindGroupBufferReferences(revisit.commandRecords);
    expect(referencedBuffers.length).toBeGreaterThan(0);
    expect(referencedBuffers.filter((buffer) => destroyed.has(buffer))).toEqual(
      [],
    );
  });

  it("honors authored shadow request bias, filter radius, and map size", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot({
        shadowRequest: {
          mapSize: 2048,
          depthBias: 0.0004,
          normalBias: 0.02,
          filterRadius: 4,
        },
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.descriptor.descriptors[0]).toMatchObject({
      mapSize: 2048,
      textureWidth: 2048,
      textureHeight: 2048,
      depthBias: 0.0004,
      normalBias: 0.02,
      filterRadiusTexels: 4,
    });
  });

  it("lets authored fixed shadow-camera settings override auto matrix options", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot({
        view: primaryCameraView(),
        shadowRequest: {
          cascadeCount: 1,
          center: [1, 2, 3],
          orthographicSize: 16,
          near: 0.5,
          far: 60,
          lightDistance: 20,
        },
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: {
        center: [0, 0, -2],
        orthographicSize: 8,
        near: 1,
        far: 12,
        lightDistance: 5,
      },
    });

    expect(result.matrixComputation.matrices[0]).toMatchObject({
      center: [1, 2, 3],
      orthographicSize: 16,
      near: 0.5,
      far: 60,
      lightPosition: [1, 2, 23],
    });
  });

  it("keeps authored fixed shadow-camera matrices independent of primary camera movement", () => {
    const fixedShadow = {
      cascadeCount: 1,
      center: [1, 2, 3] as const,
      orthographicSize: 16,
      near: 0.5,
      far: 60,
      lightDistance: 20,
    };
    const base = {
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
    } as const;
    const first = createRenderShadowFrame({
      ...base,
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: primaryCameraView(),
        shadowRequest: fixedShadow,
      }),
    });
    const second = createRenderShadowFrame({
      ...base,
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: cameraView(-8, 6, 24),
        shadowRequest: fixedShadow,
      }),
    });

    expect(second.matrixComputation.matrices[0]).toEqual(
      first.matrixComputation.matrices[0],
    );
  });

  it("specializes caster pipeline vertex layout from the caster draw list", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.pipelineDescriptor.descriptor?.vertex.meshLayoutKey).toBe(
      "POSITION",
    );
    expect(result.pipelineDescriptor.descriptor?.pipelineKey).toContain(
      "mesh-layout:POSITION",
    );
    expect(calls.pipelines).toHaveLength(1);

    const pipelineDescriptor = calls.pipelines[0] as {
      readonly vertex?: {
        readonly buffers?: readonly {
          readonly arrayStride?: number;
          readonly stepMode?: string;
          readonly attributes?: readonly {
            readonly shaderLocation?: number;
            readonly offset?: number;
            readonly format?: string;
          }[];
        }[];
      };
    };

    expect(pipelineDescriptor.vertex?.buffers?.[0]).toMatchObject({
      arrayStride: 12,
      stepMode: "vertex",
      attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
    });
  });
});

function snapshot(
  options: {
    readonly shadowRequest?: Partial<RenderSnapshot["shadowRequests"][number]>;
    readonly view?: Pick<RenderSnapshot, "views" | "viewMatrices">;
    readonly bounds?: RenderSnapshot["bounds"];
    readonly transforms?: Float32Array;
  } = {},
): RenderSnapshot {
  return {
    frame: 1,
    views: options.view?.views ?? [],
    meshDraws: [
      {
        renderId: 101,
        entity: { index: 2, generation: 0 },
        mesh: createMeshHandle("caster"),
        material: createMaterialHandle("caster"),
        submesh: 0,
        materialSlot: 0,
        worldTransformOffset: 0,
        boundsIndex: 0,
        layerMask: 1,
        castsShadow: true,
        receivesShadow: true,
        sortKey: {
          queue: "opaque",
          viewId: 0,
          layer: 0,
          order: 0,
          pipelineKey: "standard|cascadedShadowMap",
          materialKey: "material:caster",
          meshKey: "mesh:caster",
          depth: 0,
          stableId: 101,
        },
        batchKey: {
          pipelineKey: "standard|cascadedShadowMap",
          materialKey: "material:caster",
          meshLayoutKey: "POSITION",
          topology: "triangle-list",
          instanced: false,
          skinned: false,
          morphed: false,
        },
      },
    ],
    lights: [
      {
        lightId: 11,
        entity: { index: 1, generation: 0 },
        kind: "directional",
        color: [1, 1, 1, 1],
        intensity: 1,
        range: 0,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    environments: [],
    shadowRequests: [
      {
        shadowId: 7,
        lightId: 11,
        lightKind: "directional",
        cascadeCount: 3,
        casterLayerMask: 1,
        receiverLayerMask: 1,
        ...options.shadowRequest,
      },
    ],
    bounds: options.bounds ?? [],
    transforms: options.transforms ?? identityTransform(),
    viewMatrices: options.view?.viewMatrices ?? new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: options.bounds?.length ?? 0,
      diagnostics: 0,
    },
  };
}

function boundsPacket(
  boundsId: number,
  worldAabb: RenderSnapshot["bounds"][number]["worldAabb"],
): RenderSnapshot["bounds"][number] {
  const center: readonly [number, number, number] = [
    (worldAabb.min[0] + worldAabb.max[0]) * 0.5,
    (worldAabb.min[1] + worldAabb.max[1]) * 0.5,
    (worldAabb.min[2] + worldAabb.max[2]) * 0.5,
  ];
  const radius = Math.hypot(
    worldAabb.max[0] - center[0],
    worldAabb.max[1] - center[1],
    worldAabb.max[2] - center[2],
  );

  return {
    boundsId,
    entity: { index: boundsId, generation: 0 },
    localAabb: worldAabb,
    worldAabb,
    localSphere: { center, radius },
    worldSphere: { center, radius },
  };
}

function primaryCameraView(): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  return cameraView(4, 2, 10);
}

function cameraView(
  x: number,
  y: number,
  z: number,
): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  const viewMatrix = translationView(x, y, z);
  const projectionMatrix = makePerspective(1.0, 1.5, 0.1, 60);
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
  const viewMatrices = new Float32Array(48);

  viewMatrices.set(viewMatrix, 0);
  viewMatrices.set(projectionMatrix, 16);
  viewMatrices.set(viewProjectionMatrix, 32);

  return {
    views: [
      {
        viewId: 0,
        camera: { index: 99, generation: 0 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 0,
        projectionMatrixOffset: 16,
        viewProjectionMatrixOffset: 32,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    viewMatrices,
  };
}

function translationView(x: number, y: number, z: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
}

function preparedMeshes(): readonly ShadowCasterPreparedMeshResourceView[] {
  return [
    {
      meshKey: "mesh:caster",
      meshResourceKey: "mesh-buffer:caster",
      vertexBufferResourceKeys: ["mesh-vertex-buffer:caster/position"],
      indexBufferResourceKey: "mesh-index-buffer:caster",
    },
  ];
}

function executableMeshes(): readonly ShadowCasterExecutableMeshResourceView[] {
  return [
    {
      meshKey: "mesh:caster",
      meshResourceKey: "mesh-buffer:caster",
      vertexBuffers: [
        {
          resourceKey: "mesh-vertex-buffer:caster/position",
          buffer: { kind: "vertex-buffer" },
          vertexCount: 3,
        },
      ],
      indexBuffer: {
        resourceKey: "mesh-index-buffer:caster",
        buffer: { kind: "index-buffer" },
        format: "uint32",
        indexCount: 3,
      },
    },
  ];
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function translatedTransform(
  translation: readonly [number, number, number],
): Float32Array {
  const transform = identityTransform();

  transform[12] = translation[0];
  transform[13] = translation[1];
  transform[14] = translation[2];

  return transform;
}

interface DeviceCalls {
  readonly textures: unknown[];
  readonly textureViews: unknown[];
  readonly samplers: unknown[];
  readonly buffers: unknown[];
  readonly destroyedBuffers: unknown[];
  readonly bufferWrites: unknown[];
  readonly shaderModules: unknown[];
  readonly bindGroupLayouts: unknown[];
  readonly pipelineLayouts: unknown[];
  readonly pipelines: unknown[];
  readonly bindGroups: unknown[];
  readonly renderPasses: unknown[];
  readonly submissions: unknown[];
}

function createDeviceCalls(): DeviceCalls {
  return {
    textures: [],
    textureViews: [],
    samplers: [],
    buffers: [],
    destroyedBuffers: [],
    bufferWrites: [],
    shaderModules: [],
    bindGroupLayouts: [],
    pipelineLayouts: [],
    pipelines: [],
    bindGroups: [],
    renderPasses: [],
    submissions: [],
  };
}

function device(calls: DeviceCalls): RenderShadowFrameDeviceLike {
  return {
    createTexture(descriptor) {
      calls.textures.push(descriptor);
      return {
        createView(viewDescriptor) {
          calls.textureViews.push(viewDescriptor ?? {});
          return { viewDescriptor: viewDescriptor ?? {} };
        },
      };
    },
    createSampler(descriptor) {
      calls.samplers.push(descriptor);
      return { descriptor };
    },
    createBuffer(descriptor) {
      const buffer = {
        descriptor,
        destroy: () => {
          calls.destroyedBuffers.push(buffer);
        },
      };
      calls.buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      calls.shaderModules.push(descriptor);
      return { compilationInfo: async () => ({ messages: [] }) };
    },
    createBindGroupLayout(descriptor) {
      calls.bindGroupLayouts.push(descriptor);
      return { descriptor };
    },
    createPipelineLayout(descriptor) {
      calls.pipelineLayouts.push(descriptor);
      return { descriptor };
    },
    createRenderPipeline(descriptor) {
      calls.pipelines.push(descriptor);
      return { descriptor };
    },
    createBindGroup(descriptor) {
      calls.bindGroups.push(descriptor);
      return { descriptor };
    },
    createCommandEncoder() {
      return {
        beginRenderPass(descriptor: unknown) {
          calls.renderPasses.push(descriptor);
          return renderPassEncoder();
        },
        finish() {
          return { kind: "command-buffer" };
        },
      };
    },
    queue: {
      writeBuffer(...args) {
        calls.bufferWrites.push(args);
      },
      submit(commandBuffers) {
        calls.submissions.push(commandBuffers);
      },
    },
  };
}

function bindGroupBufferReferences(report: {
  readonly commandRecords: readonly {
    readonly commands: readonly {
      readonly kind: string;
      readonly bindGroup?: unknown;
    }[];
  }[];
}): unknown[] {
  const buffers: unknown[] = [];
  for (const record of report.commandRecords) {
    for (const command of record.commands) {
      if (command.kind !== "setBindGroup") continue;
      const entries =
        (
          command.bindGroup as {
            readonly descriptor?: {
              readonly entries?: readonly {
                readonly resource?: { readonly buffer?: unknown };
              }[];
            };
          }
        ).descriptor?.entries ?? [];
      for (const entry of entries) {
        if (entry.resource?.buffer !== undefined) {
          buffers.push(entry.resource.buffer);
        }
      }
    }
  }
  return buffers;
}

function bufferHasLabel(buffer: unknown, label: string): boolean {
  return (
    typeof buffer === "object" &&
    buffer !== null &&
    (buffer as { readonly descriptor?: { readonly label?: string } }).descriptor
      ?.label === label
  );
}

function writeTargetsBufferLabel(write: unknown, label: string): boolean {
  return Array.isArray(write) && bufferHasLabel(write[0], label);
}

function renderPassEncoder() {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    setIndexBuffer: () => undefined,
    drawIndexed: () => undefined,
    end: () => undefined,
  };
}

function mixedSnapshot(): RenderSnapshot {
  const source = snapshot({ shadowRequest: { cascadeCount: 1 } });
  const transforms = new Float32Array(16 * 4);
  transforms.set(source.transforms, 0);
  for (let index = 1; index <= 3; index++) {
    transforms.set(translatedTransform([index * 2 - 4, 3, 2]), index * 16);
  }
  return {
    ...source,
    transforms,
    lights: [
      ...source.lights,
      ...[1, 2, 3].map((index) => ({
        ...source.lights[0]!,
        lightId: 11 + index,
        kind: "point" as const,
        worldTransformOffset: index * 16,
        range: 12,
      })),
    ],
    shadowRequests: [
      ...source.shadowRequests,
      ...[1, 2, 3].map((index) => ({
        shadowId: 7 + index,
        lightId: 11 + index,
        lightKind: "point" as const,
        casterLayerMask: 1,
        receiverLayerMask: 1,
        mapSize: 128,
      })),
    ],
  };
}

describe("composed directional and point shadow frames", () => {
  it("keeps multiple shadow-requesting suns on directional precedence with per-point omissions", () => {
    const source = mixedSnapshot();
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: {
        ...source,
        lights: [...source.lights, { ...source.lights[0]!, lightId: 99 }],
        shadowRequests: [
          ...source.shadowRequests,
          { ...source.shadowRequests[0]!, shadowId: 99, lightId: 99 },
        ],
      },
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      encode: false,
    });
    expect(result.frames).toBeUndefined();
    expect(result.report.requestCoverage).toMatchObject({
      requestedCount: 5,
      servedCount: 2,
      omittedCount: 3,
      served: [
        { shadowId: 7, lightId: 11, lightKind: "directional" },
        { shadowId: 99, lightId: 99, lightKind: "directional" },
      ],
      omitted: [12, 13, 14].map((lightId) => ({
        lightId,
        lightKind: "point",
        reason: "mixed-shadow-kind-not-supported",
      })),
    });
    expect(
      result.report.diagnostics.filter(
        (d) => d.code === "renderShadowFrame.omittedShadowRequest",
      ),
    ).toHaveLength(3);
  });

  it.each([
    "cached",
    "graph-submitted",
    "graph-not-submitted",
    "standalone",
  ] as const)(
    "normalizes nested %s counts in full and compact reports without fabricating command buffers",
    (mode) => {
      const source = mixedSnapshot();
      const result = createRenderShadowFrame({
        device: device(createDeviceCalls()),
        snapshot: source,
        preparedMeshes: preparedMeshes(),
        executableMeshes: executableMeshes(),
        ...(mode.startsWith("graph") ? { encode: false, submit: false } : {}),
      });
      const normalized = normalizeShadowSubmittedDrawCounts(
        result.report,
        mode,
      );
      const expected =
        mode === "cached" || mode === "graph-not-submitted" ? [0, 0] : [1, 18];
      expect(
        normalized.lightKindReports?.map(
          (child) => child.casterCounts?.submittedDrawCalls,
        ),
      ).toEqual(expected);
      expect(normalized.casterCounts?.submittedDrawCalls).toBe(
        expected[0]! + expected[1]!,
      );
      expect(normalized.commandBufferSubmission).toEqual(
        result.report.commandBufferSubmission,
      );
      expect(
        normalized.lightKindReports?.map(
          (child) => child.commandBufferSubmission,
        ),
      ).toEqual(
        result.report.lightKindReports?.map(
          (child) => child.commandBufferSubmission,
        ),
      );
      const report = renderReport({
        ok: true,
        snapshot: source,
        shadow: normalized,
        diagnostics: [],
      });
      for (const detail of ["status", "full"] as const) {
        const serialized = webGpuAppRenderReportToJsonValue(report, { detail });
        expect(serialized.shadow).toMatchObject({
          casterCounts: { submittedDrawCalls: expected[0]! + expected[1]! },
          lightKindReports: expected.map((submittedDrawCalls) => ({
            casterCounts: { submittedDrawCalls },
          })),
        });
      }
    },
  );

  it.each([false, true])(
    "accounts for selected mixed requests independently of failed allocation (%s)",
    (failAllocation) => {
      const source = mixedSnapshot();
      const gpu = {
        ...device(createDeviceCalls()),
        ...(failAllocation
          ? {
              createTexture: () => {
                throw new Error("injected allocation failure");
              },
            }
          : {}),
      };
      for (const spot of [false, true]) {
        const requested = spot
          ? [
              ...source.shadowRequests,
              {
                ...source.shadowRequests[0]!,
                shadowId: 99,
                lightId: 99,
                lightKind: "spot" as const,
              },
            ]
          : source.shadowRequests;
        const result = createRenderShadowFrame({
          device: gpu,
          snapshot: { ...source, shadowRequests: requested },
          preparedMeshes: preparedMeshes(),
          executableMeshes: executableMeshes(),
          encode: false,
        });
        expect(result.report.requestCoverage).toMatchObject({
          requestedCount: spot ? 5 : 4,
          servedCount: 4,
          omittedCount: spot ? 1 : 0,
          served: source.shadowRequests.map(
            ({ shadowId, lightId, lightKind }) => ({
              shadowId,
              lightId,
              lightKind: lightKind ?? "directional",
            }),
          ),
        });
        const omissions = result.report.diagnostics.filter(
          (d) => d.code === "renderShadowFrame.omittedShadowRequest",
        );
        expect(omissions).toHaveLength(spot ? 1 : 0);
        if (spot) expect(omissions[0]?.message).toContain("spot light 99");
        expect(
          result.report.diagnostics.some(
            (d) => d.code === "renderShadowFrame.unsupportedMixedCombination",
          ),
        ).toBe(false);
        if (failAllocation) {
          expect(result.report.ready).toBe(false);
          expect(
            result.report.diagnostics.some(
              (d) => d.code !== "renderShadowFrame.omittedShadowRequest",
            ),
          ).toBe(true);
        }
      }
    },
  );

  it("namespaces explicit map keys and respects cascade override precedence", () => {
    const options = {
      device: device(createDeviceCalls()),
      snapshot: mixedSnapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      encode: false,
    };
    const composed = createRenderShadowFrame({
      ...options,
      shadowMap: { resourceKey: "custom-map" },
    });
    expect(
      composed.frames![0]!.depthTextureResources.resources[0]!.textureKey,
    ).toBe("custom-map:directional:texture");
    expect(
      composed.frames![1]!.depthTextureResources.resources[0]!.textureKey,
    ).toBe("custom-map:point:texture");
    const cascaded = createRenderShadowFrame({
      ...options,
      shadowMap: { cascadeCount: 3 },
    });
    expect(cascaded.frames).toBeUndefined();
    expect(cascaded.receiverResources?.shadowKind).toBe("directional-cascaded");
  });

  it("bakes all four lights with one sun and eighteen distinct point faces", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: mixedSnapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      encode: false,
      submit: false,
    });
    expect(result.report).toMatchObject({
      ready: true,
      shadowKind: "directional-point-array",
      requestCount: 4,
      passCount: 19,
      diagnostics: [],
    });
    expect(result.frames).toHaveLength(2);
    const points = result.frames![1]!;
    expect(points.passPlan.passes).toHaveLength(18);
    expect(
      new Set(points.passPlan.passes.map((pass) => pass.viewKey)).size,
    ).toBe(18);
    expect(
      points.depthTextureResources.resources.map(
        (resource) => resource.layerBaseIndex,
      ),
    ).toEqual([0, 6, 12]);
    expect(
      points.depthTextureResources.resources.every(
        (resource) => resource.layerCount === 18,
      ),
    ).toBe(true);
    expect(
      new Set(
        points.depthTextureResources.resources.map(
          (resource) => resource.allocation.resource,
        ),
      ).size,
    ).toBe(1);
    expect(points.matrixBufferResource.matrixCount).toBe(18);
    expect(calls.destroyedBuffers).toHaveLength(0);
    expect(calls.submissions).toHaveLength(0);
  });

  it("keeps both world buffers live across cache reuse, movement and point removal", () => {
    const calls = createDeviceCalls(),
      gpu = device(calls),
      cache = createWebGpuEnvironmentResourceCache();
    const source = mixedSnapshot();
    const render = (current: RenderSnapshot) =>
      createRenderShadowFrame({
        device: gpu,
        snapshot: current,
        cache,
        preparedMeshes: preparedMeshes(),
        executableMeshes: executableMeshes(),
        encode: false,
        submit: false,
      });
    const first = render(source);
    const again = render(source);
    expect(again.report.resourceReuse.depthTexturesCreated).toBe(0);
    expect(again.report.resourceReuse.matrixBuffersCreated).toBe(0);
    expect(calls.destroyedBuffers).toHaveLength(0);
    const moved = {
      ...source,
      transforms: new Float32Array(source.transforms),
    };
    moved.transforms[12] = 0.75;
    moved.transforms[16 + 12] = 3;
    const movedResult = render(moved);
    expect(
      movedResult.frames![1]!.matrixComputation.matrices[0]!
        .viewProjectionMatrix,
    ).not.toEqual(
      first.frames![1]!.matrixComputation.matrices[0]!.viewProjectionMatrix,
    );
    const reduced = render({
      ...moved,
      shadowRequests: moved.shadowRequests.slice(0, 2),
    });
    const revisited = render(moved);
    expect(reduced.report.requestCount).toBe(2);
    expect(revisited.report.passCount).toBe(19);
    for (const frame of revisited.frames!) {
      for (const buffer of bindGroupBufferReferences(frame.commandRecords)) {
        expect(calls.destroyedBuffers).not.toContain(buffer);
      }
    }
  });

  it("submits both standalone kinds and summarizes all draw calls", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: mixedSnapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
    });
    expect(calls.submissions).toHaveLength(2);
    expect(result.report.commandBufferSubmission.submittedCommandBuffers).toBe(
      2,
    );
    expect(result.report.casterCounts?.submittedDrawCalls).toBe(19);
  });

  it("keeps cascaded directional paths and reports unsupported local requests", () => {
    const source = mixedSnapshot();
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: {
        ...source,
        shadowRequests: source.shadowRequests.map((request, index) =>
          index === 0 ? { ...request, cascadeCount: 3 } : request,
        ),
      },
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      encode: false,
    });
    expect(result.receiverResources?.shadowKind).toBe("directional-cascaded");
    expect(result.frames).toBeUndefined();
    expect(
      result.report.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "renderShadowFrame.omittedShadowRequest",
      ),
    ).toBe(true);
  });
});
