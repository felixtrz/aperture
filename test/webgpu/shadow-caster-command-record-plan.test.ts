import { describe, expect, it } from "vitest";

import {
  createShadowCasterCommandRecordPlanReport,
  shadowCasterCommandRecordPlanReportToJson,
  shadowCasterCommandRecordPlanReportToJsonValue,
  type ShadowCasterCommandPlanReadinessReport,
  type ShadowCasterFrameResourceReadinessReport,
} from "@aperture-engine/webgpu/test-support";

describe("shadow caster command record planning", () => {
  it("maps ready frame resources into executable render pass commands", () => {
    const report = createShadowCasterCommandRecordPlanReport({
      frameResources: frameResources("ready"),
      commandPlan: commandPlan(),
      pipelines: [
        {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          resourceKey: "pipeline:shadow-caster/depth-only",
          pipeline: { type: "pipeline" },
        },
      ],
      matrixBindGroups: [
        {
          matrixResourceKey: "shadow-matrix-buffer:directional",
          resourceKey: "bind-group:shadow-caster/matrices",
          group: 0,
          bindGroup: { type: "bind-group" },
        },
      ],
      meshes: [meshResource()],
    });
    const json = shadowCasterCommandRecordPlanReportToJsonValue(report);

    expect(report.commandRecords).toHaveLength(1);
    expect(report.commandRecords[0]?.commands).toMatchObject([
      {
        kind: "setPipeline",
        renderId: 101,
        pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/back",
      },
      {
        kind: "setBindGroup",
        renderId: 101,
        index: 0,
        resourceKey: "bind-group:shadow-caster/matrices",
      },
      {
        kind: "setVertexBuffer",
        renderId: 101,
        slot: 0,
        resourceKey: "mesh-vertex-buffer:gltf-cube/position",
      },
      {
        kind: "setIndexBuffer",
        renderId: 101,
        resourceKey: "mesh-index-buffer:gltf-cube",
        format: "uint32",
      },
      {
        kind: "drawIndexed",
        renderId: 101,
        indexCount: 36,
        instanceCount: 1,
        firstInstance: 1,
      },
    ]);
    expect(json).toEqual({
      ready: true,
      status: "ready",
      counts: {
        frameResourceDraws: 1,
        readyFrameResourceDraws: 1,
        pipelineResources: 1,
        matrixBindGroups: 1,
        meshResources: 1,
        commandRecords: 1,
        commandCount: 5,
        drawCalls: 1,
        indexedDrawCalls: 1,
      },
      sections: {
        frameResources: true,
        commandPlans: true,
        pipelineResources: true,
        matrixBindGroups: true,
        meshBuffers: true,
        commandRecords: true,
        commandBufferFinish: false,
        queueSubmission: false,
        shaderSampling: false,
      },
      records: [
        {
          passKey: "shadow-pass:7:light:11",
          commandKey: "shadow-pass:7:light:11:caster-commands",
          renderIds: [101],
          commandCount: 5,
          drawCalls: 1,
          indexedDrawCalls: 1,
          pipelineKeys: [
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          ],
          pipelineResourceKeys: [
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          ],
          bindGroupResourceKeys: ["bind-group:shadow-caster/matrices"],
          vertexBufferResourceKeys: ["mesh-vertex-buffer:gltf-cube/position"],
          indexBufferResourceKeys: ["mesh-index-buffer:gltf-cube"],
          drawCommandKeys: ["shadow-pass:7:light:11:draw:101"],
        },
      ],
      commandRecords: [
        {
          passKey: "shadow-pass:7:light:11",
          commandKey: "shadow-pass:7:light:11:caster-commands",
          commandCount: 5,
        },
      ],
      diagnostics: [
        {
          code: "shadowCasterCommandRecord.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow caster command records are executable, but command-buffer finish and queue submission are deferred.",
        },
        {
          code: "shadowCasterCommandRecord.shaderSamplingDeferred",
          severity: "warning",
          message:
            "Shadow caster command records are executable, but StandardMaterial shadow sampling remains deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCasterCommandRecordPlanReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUBuffer|GPURenderPipeline|GPUBindGroup|"raw"|callback/,
    );
  });

  it("groups compatible world-transform shadow caster records into one indexed draw", () => {
    const report = createShadowCasterCommandRecordPlanReport({
      frameResources: frameResources("ready", {
        records: [frameResourceRecord(101), frameResourceRecord(102)],
      }),
      commandPlan: commandPlan(),
      pipelines: [
        {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          resourceKey: "pipeline:shadow-caster/depth-only",
          pipeline: { type: "pipeline" },
        },
      ],
      matrixBindGroups: [
        {
          matrixResourceKey: "shadow-caster-pass-matrix:pass-0",
          passKey: "shadow-pass:7:light:11",
          worldTransformResourceKey:
            "shadow-caster-world-transform-buffer:directional",
          resourceKey: "bind-group:shadow-caster/pass-0",
          group: 0,
          bindGroup: { type: "pass-world-bind-group" },
        },
      ],
      worldTransformIndexByPassDraw: new Map([
        ["shadow-pass:7:light:11:101", 0],
        ["shadow-pass:7:light:11:102", 1],
      ]),
      meshes: [meshResource()],
    });
    const drawCommands = report.commandRecords[0]?.commands.filter(
      (command) => command.kind === "drawIndexed",
    );

    expect(drawCommands).toMatchObject([
      {
        kind: "drawIndexed",
        renderId: 101,
        indexCount: 36,
        instanceCount: 2,
        firstIndex: 0,
        firstInstance: 0,
      },
    ]);
    expect(report.counts.frameResourceDraws).toBe(2);
    expect(report.counts.commandCount).toBe(5);
    expect(report.counts.drawCalls).toBe(1);
    expect(report.records[0]).toMatchObject({
      renderIds: [101, 102],
      drawCalls: 1,
      drawCommandKeys: [
        "shadow-pass:7:light:11:draw:101",
        "shadow-pass:7:light:11:draw:102",
      ],
    });
  });

  it("does not group world-transform shadow caster records with different submesh ranges", () => {
    const report = createShadowCasterCommandRecordPlanReport({
      frameResources: frameResources("ready", {
        records: [
          frameResourceRecord(101, { indexStart: 0, indexCount: 6 }),
          frameResourceRecord(102, { indexStart: 6, indexCount: 6 }),
        ],
      }),
      commandPlan: commandPlan(),
      pipelines: [
        {
          pipelineKey:
            "shadow-caster/depth-only/depth24plus/triangle-list/back",
          resourceKey: "pipeline:shadow-caster/depth-only",
          pipeline: { type: "pipeline" },
        },
      ],
      matrixBindGroups: [
        {
          matrixResourceKey: "shadow-caster-pass-matrix:pass-0",
          passKey: "shadow-pass:7:light:11",
          worldTransformResourceKey:
            "shadow-caster-world-transform-buffer:directional",
          resourceKey: "bind-group:shadow-caster/pass-0",
          group: 0,
          bindGroup: { type: "pass-world-bind-group" },
        },
      ],
      worldTransformIndexByPassDraw: new Map([
        ["shadow-pass:7:light:11:101", 0],
        ["shadow-pass:7:light:11:102", 1],
      ]),
      meshes: [meshResource()],
    });
    const drawCommands = report.commandRecords[0]?.commands.filter(
      (command) => command.kind === "drawIndexed",
    );

    expect(drawCommands).toMatchObject([
      {
        kind: "drawIndexed",
        renderId: 101,
        indexCount: 6,
        instanceCount: 1,
        firstIndex: 0,
        firstInstance: 0,
      },
      {
        kind: "drawIndexed",
        renderId: 102,
        indexCount: 6,
        instanceCount: 1,
        firstIndex: 6,
        firstInstance: 1,
      },
    ]);
    expect(report.counts.drawCalls).toBe(2);
    expect(report.records[0]?.renderIds).toEqual([101, 102]);
  });

  it("reports missing live pipeline and matrix bind-group resources", () => {
    const json = shadowCasterCommandRecordPlanReportToJsonValue(
      createShadowCasterCommandRecordPlanReport({
        frameResources: frameResources("ready"),
        commandPlan: commandPlan(),
        meshes: [meshResource()],
      }),
    );

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      counts: {
        frameResourceDraws: 1,
        readyFrameResourceDraws: 1,
        pipelineResources: 0,
        matrixBindGroups: 0,
        meshResources: 1,
        commandRecords: 0,
        commandCount: 0,
        drawCalls: 0,
      },
      records: [],
    });
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterCommandRecord.missingPipelineResource",
      "shadowCasterCommandRecord.missingMatrixBindGroupResource",
    ]);
  });

  it("reports missing mesh buffers before producing commands", () => {
    const json = shadowCasterCommandRecordPlanReportToJsonValue(
      createShadowCasterCommandRecordPlanReport({
        frameResources: frameResources("ready"),
        commandPlan: commandPlan(),
        pipelines: [
          {
            pipelineKey:
              "shadow-caster/depth-only/depth24plus/triangle-list/back",
            resourceKey: "pipeline:shadow-caster/depth-only",
            pipeline: {},
          },
        ],
        matrixBindGroups: [
          {
            matrixResourceKey: "shadow-matrix-buffer:directional",
            resourceKey: "bind-group:shadow-caster/matrices",
            group: 0,
            bindGroup: {},
          },
        ],
        meshes: [
          {
            ...meshResource(),
            vertexBuffers: [],
            indexBuffer: null,
          },
        ],
      }),
    );

    expect(json.ready).toBe(false);
    expect(json.status).toBe("missing");
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "shadowCasterCommandRecord.missingVertexBufferResource",
      "shadowCasterCommandRecord.missingIndexBufferResource",
    ]);
  });

  it("reports not-required when no shadow caster frame resources are needed", () => {
    const json = shadowCasterCommandRecordPlanReportToJsonValue(
      createShadowCasterCommandRecordPlanReport({
        frameResources: frameResources("not-required"),
        commandPlan: {
          ...commandPlan(),
          ready: true,
          status: "not-required",
          commands: [],
        },
      }),
    );

    expect(json).toMatchObject({
      ready: true,
      status: "not-required",
      counts: {
        frameResourceDraws: 0,
        readyFrameResourceDraws: 0,
        commandRecords: 0,
      },
      records: [],
      commandRecords: [],
      diagnostics: [],
    });
  });
});

function frameResources(
  status: ShadowCasterFrameResourceReadinessReport["status"],
  options: {
    readonly records?: ShadowCasterFrameResourceReadinessReport["records"];
  } = {},
): ShadowCasterFrameResourceReadinessReport {
  const ready = status === "ready";
  const records = options.records ?? [frameResourceRecord(101)];

  return {
    ready: ready || status === "not-required",
    status,
    counts: {
      casterDraws: ready ? records.length : 0,
      readyDraws: ready ? records.length : 0,
      missingMeshBuffers: 0,
      pipelineDescriptors: ready ? 1 : 0,
      matrixBuffers: ready ? 1 : 0,
    },
    sections: {
      casterDrawLists: true,
      preparedMeshBuffers: true,
      matrixBufferResource: ready,
      pipelineDescriptor: ready,
      pipelineCreation: false,
      passSubmission: false,
      shaderSampling: false,
    },
    records: ready ? records : [],
    diagnostics: [],
  };
}

function frameResourceRecord(
  renderId: number,
  overrides: Partial<
    ShadowCasterFrameResourceReadinessReport["records"][number]
  > = {},
): ShadowCasterFrameResourceReadinessReport["records"][number] {
  return {
    renderId,
    meshKey: "mesh:gltf-cube",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
    passKey: "shadow-pass:7:light:11",
    submesh: 0,
    meshResourceKey: "mesh-buffer:gltf-cube",
    vertexBufferResourceKeys: ["mesh-vertex-buffer:gltf-cube/position"],
    indexBufferResourceKey: "mesh-index-buffer:gltf-cube",
    matrixResourceKey: "shadow-matrix-buffer:directional",
    pipelineKey: "shadow-caster/depth-only/depth24plus/triangle-list/back",
    ready: true,
    ...overrides,
  };
}

function commandPlan(): ShadowCasterCommandPlanReadinessReport {
  return {
    ready: false,
    status: "deferred",
    counts: {
      requests: 1,
      passes: 1,
      viewProjectionPlans: 1,
      matrices: 1,
      casterLists: 1,
      drawCommands: 1,
      commandPlans: 1,
    },
    sections: {
      shadowPassPlan: true,
      viewProjectionPlanning: true,
      matrixBufferDescriptor: true,
      casterDrawLists: true,
      commandEncoding: false,
      gpuCommands: false,
    },
    commands: [
      {
        commandKey: "shadow-pass:7:light:11:caster-commands",
        shadowId: 7,
        lightId: 11,
        passKey: "shadow-pass:7:light:11",
        matrixResourceKey: "shadow-matrix-buffer:directional",
        matrixOffsetBytes: 64,
        drawCount: 1,
        commandEncoding: "deferred",
      },
    ],
    diagnostics: [],
  };
}

function meshResource(): NonNullable<
  Parameters<typeof createShadowCasterCommandRecordPlanReport>[0]["meshes"]
>[number] {
  return {
    meshKey: "mesh:gltf-cube",
    meshResourceKey: "mesh-buffer:gltf-cube",
    vertexBuffers: [
      {
        resourceKey: "mesh-vertex-buffer:gltf-cube/position",
        buffer: { type: "vertex-buffer" },
        vertexCount: 24,
      },
    ],
    indexBuffer: {
      resourceKey: "mesh-index-buffer:gltf-cube",
      buffer: { type: "index-buffer" },
      format: "uint32",
      indexCount: 36,
    },
  };
}
