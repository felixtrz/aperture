import { describe, expect, it } from "vitest";

import {
  createShadowCasterMatrixBindGroupResourceReport,
  shadowCasterMatrixBindGroupResourceReportToJson,
  shadowCasterMatrixBindGroupResourceReportToJsonValue,
  type ShadowMatrixBufferResourceReport,
} from "@aperture-engine/webgpu";

describe("shadow caster matrix bind-group resource", () => {
  it("creates a group 0 matrix bind group over the live shadow matrix buffer", () => {
    const layouts: unknown[] = [];
    const bindGroups: unknown[] = [];
    const layout = { type: "layout" };
    const bindGroup = { type: "bind-group" };
    const report = createShadowCasterMatrixBindGroupResourceReport({
      device: {
        createBindGroupLayout(descriptor) {
          layouts.push(descriptor);
          return layout;
        },
        createBindGroup(descriptor) {
          bindGroups.push(descriptor);
          return bindGroup;
        },
      },
      matrixBufferResource: matrixBufferResource(),
    });
    const json = shadowCasterMatrixBindGroupResourceReportToJsonValue(report);

    expect(report.resource).toMatchObject({
      group: 0,
      matrixResourceKey: "shadow-matrix-buffer:directional",
      layout,
      bindGroup,
    });
    expect(layouts).toEqual([
      {
        label: "shadow-caster/group-0:directional-shadow-matrices@0",
        entries: [
          {
            binding: 0,
            visibility: 1,
            buffer: { type: "read-only-storage" },
          },
        ],
      },
    ]);
    expect(bindGroups).toEqual([
      {
        label:
          "bind-group:shadow-caster/group-0/shadow-matrix-buffer:directional",
        layout,
        entries: [
          {
            binding: 0,
            resource: { buffer: "matrix-buffer" },
          },
        ],
      },
    ]);
    expect(json).toEqual({
      ready: true,
      status: "available",
      matrixBufferCount: 1,
      createdBindGroupCount: 1,
      reusedBindGroupCount: 0,
      sections: {
        matrixBufferResource: true,
        bindGroupLayout: true,
        bindGroupResource: true,
        passSubmission: false,
        shaderSampling: false,
      },
      resource: {
        group: 0,
        matrixResourceKey: "shadow-matrix-buffer:directional",
        resourceKey:
          "bind-group:shadow-caster/group-0/shadow-matrix-buffer:directional",
        layoutKey: "shadow-caster/group-0:directional-shadow-matrices@0",
        entryResourceKeys: ["shadow-matrix-buffer:directional"],
      },
      diagnostics: [
        {
          code: "shadowCasterMatrixBindGroupResource.passSubmissionDeferred",
          severity: "warning",
          message:
            "Shadow caster matrix bind group is available, but shadow pass submission is deferred.",
        },
        {
          code: "shadowCasterMatrixBindGroupResource.shaderSamplingDeferred",
          severity: "warning",
          message:
            "Shadow caster matrix bind group is available, but StandardMaterial shadow sampling remains deferred.",
        },
      ],
    });
    expect(
      JSON.parse(shadowCasterMatrixBindGroupResourceReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(
      /GPUBuffer|GPUBindGroup|GPUBindGroupLayout|"raw"|callback/,
    );
  });

  it("can reuse a pipeline-owned bind group layout", () => {
    const layout = { type: "pipeline-owned-layout" };
    const bindGroups: unknown[] = [];
    const report = createShadowCasterMatrixBindGroupResourceReport({
      device: {
        createBindGroup(descriptor) {
          bindGroups.push(descriptor);
          return { type: "bind-group" };
        },
      },
      matrixBufferResource: matrixBufferResource(),
      layout,
    });

    expect(report.ready).toBe(true);
    expect(report.resource?.layout).toBe(layout);
    expect(bindGroups).toEqual([
      {
        label:
          "bind-group:shadow-caster/group-0/shadow-matrix-buffer:directional",
        layout,
        entries: [
          {
            binding: 0,
            resource: { buffer: "matrix-buffer" },
          },
        ],
      },
    ]);
  });

  it("reports missing matrix buffer and missing device methods", () => {
    const missingMatrix = shadowCasterMatrixBindGroupResourceReportToJsonValue(
      createShadowCasterMatrixBindGroupResourceReport({
        device: device(),
        matrixBufferResource: {
          ...matrixBufferResource(),
          ready: false,
          status: "missing",
          matrixCount: 0,
          resource: null,
        },
      }),
    );
    const missingLayout = shadowCasterMatrixBindGroupResourceReportToJsonValue(
      createShadowCasterMatrixBindGroupResourceReport({
        device: { createBindGroup: () => ({}) },
        matrixBufferResource: matrixBufferResource(),
      }),
    );
    const missingBindGroup =
      shadowCasterMatrixBindGroupResourceReportToJsonValue(
        createShadowCasterMatrixBindGroupResourceReport({
          device: { createBindGroupLayout: () => ({}) },
          matrixBufferResource: matrixBufferResource(),
        }),
      );

    expect(missingMatrix.diagnostics).toMatchObject([
      {
        code: "shadowCasterMatrixBindGroupResource.missingMatrixBufferResource",
      },
    ]);
    expect(missingLayout.diagnostics).toMatchObject([
      {
        code: "shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable",
      },
    ]);
    expect(missingBindGroup.diagnostics).toMatchObject([
      {
        code: "shadowCasterMatrixBindGroupResource.createBindGroupUnavailable",
      },
    ]);
  });
});

function matrixBufferResource(): ShadowMatrixBufferResourceReport {
  return {
    ready: true,
    status: "available",
    matrixCount: 1,
    byteSize: 64,
    createdBufferCount: 1,
    reusedBufferCount: 0,
    sections: {
      matrixComputation: true,
      bufferDescriptor: true,
      bufferAllocation: true,
      upload: true,
      bindGroupResource: false,
      shaderSampling: false,
    },
    resource: {
      resourceKey: "shadow-matrix-buffer:directional",
      label: "DirectionalShadowMatrices",
      buffer: "matrix-buffer",
      byteSize: 64,
      matrixCount: 1,
      entryMatrixKeys: ["shadow-matrix:7:light:11"],
    },
    diagnostics: [],
  };
}

function device() {
  return {
    createBindGroupLayout: () => ({}),
    createBindGroup: () => ({}),
  };
}
