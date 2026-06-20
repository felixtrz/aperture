import { describe, expect, it } from "vitest";

import {
  createShadowCasterMatrixBindGroupResourceReport,
  shadowCasterMatrixBindGroupResourceReportToJson,
  shadowCasterMatrixBindGroupResourceReportToJsonValue,
  type ShadowMatrixBufferResourceReport,
} from "@aperture-engine/webgpu/test-support";

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
      passMatrixResources: [passMatrixResource()],
      worldTransformResource: worldTransformResource(),
    });
    const json = shadowCasterMatrixBindGroupResourceReportToJsonValue(report);

    expect(report.resource).toMatchObject({
      group: 0,
      matrixResourceKey: "shadow-caster-pass-matrix:pass-0",
      passKey: "shadow-pass:7",
      worldTransformResourceKey: "world-transform-buffer:shadow-casters",
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
            buffer: { type: "uniform" },
          },
          {
            binding: 1,
            visibility: 1,
            buffer: { type: "read-only-storage" },
          },
        ],
      },
    ]);
    expect(bindGroups).toEqual([
      {
        label:
          "bind-group:shadow-caster/group-0/shadow-caster-pass-matrix:pass-0/pass:shadow-pass%3A7/world:world-transform-buffer%3Ashadow-casters",
        layout,
        entries: [
          {
            binding: 0,
            resource: { buffer: "pass-matrix-buffer" },
          },
          {
            binding: 1,
            resource: { buffer: "world-transform-buffer" },
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
        matrixResourceKey: "shadow-caster-pass-matrix:pass-0",
        passKey: "shadow-pass:7",
        worldTransformResourceKey: "world-transform-buffer:shadow-casters",
        resourceKey:
          "bind-group:shadow-caster/group-0/shadow-caster-pass-matrix:pass-0/pass:shadow-pass%3A7/world:world-transform-buffer%3Ashadow-casters",
        layoutKey: "shadow-caster/group-0:directional-shadow-matrices@0",
        entryResourceKeys: [
          "shadow-caster-pass-matrix:pass-0",
          "world-transform-buffer:shadow-casters",
        ],
      },
      resources: [
        {
          group: 0,
          matrixResourceKey: "shadow-caster-pass-matrix:pass-0",
          passKey: "shadow-pass:7",
          worldTransformResourceKey: "world-transform-buffer:shadow-casters",
          resourceKey:
            "bind-group:shadow-caster/group-0/shadow-caster-pass-matrix:pass-0/pass:shadow-pass%3A7/world:world-transform-buffer%3Ashadow-casters",
          layoutKey: "shadow-caster/group-0:directional-shadow-matrices@0",
          entryResourceKeys: [
            "shadow-caster-pass-matrix:pass-0",
            "world-transform-buffer:shadow-casters",
          ],
        },
      ],
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
      passMatrixResources: [passMatrixResource()],
      worldTransformResource: worldTransformResource(),
      layout,
    });

    expect(report.ready).toBe(true);
    expect(report.resource?.layout).toBe(layout);
    expect(bindGroups).toEqual([
      {
        label:
          "bind-group:shadow-caster/group-0/shadow-caster-pass-matrix:pass-0/pass:shadow-pass%3A7/world:world-transform-buffer%3Ashadow-casters",
        layout,
        entries: [
          {
            binding: 0,
            resource: { buffer: "pass-matrix-buffer" },
          },
          {
            binding: 1,
            resource: { buffer: "world-transform-buffer" },
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
        passMatrixResources: [passMatrixResource()],
        worldTransformResource: worldTransformResource(),
      }),
    );
    const missingBindGroup =
      shadowCasterMatrixBindGroupResourceReportToJsonValue(
        createShadowCasterMatrixBindGroupResourceReport({
          device: { createBindGroupLayout: () => ({}) },
          matrixBufferResource: matrixBufferResource(),
          passMatrixResources: [passMatrixResource()],
          worldTransformResource: worldTransformResource(),
        }),
      );
    const missingWorldTransform =
      shadowCasterMatrixBindGroupResourceReportToJsonValue(
        createShadowCasterMatrixBindGroupResourceReport({
          device: device(),
          matrixBufferResource: matrixBufferResource(),
          passMatrixResources: [passMatrixResource()],
        }),
      );
    const missingPassMatrix =
      shadowCasterMatrixBindGroupResourceReportToJsonValue(
        createShadowCasterMatrixBindGroupResourceReport({
          device: device(),
          matrixBufferResource: matrixBufferResource(),
          worldTransformResource: worldTransformResource(),
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
    expect(missingWorldTransform.diagnostics).toMatchObject([
      {
        code: "shadowCasterMatrixBindGroupResource.missingWorldTransformResource",
      },
    ]);
    expect(missingPassMatrix.diagnostics).toMatchObject([
      {
        code: "shadowCasterMatrixBindGroupResource.missingPassMatrixResource",
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

function passMatrixResource() {
  return {
    passKey: "shadow-pass:7",
    matrixResourceKey: "shadow-caster-pass-matrix:pass-0",
    buffer: "pass-matrix-buffer",
  };
}

function worldTransformResource() {
  return {
    resourceKey: "world-transform-buffer:shadow-casters",
    buffer: "world-transform-buffer",
  };
}

function device() {
  return {
    createBindGroupLayout: () => ({}),
    createBindGroup: () => ({}),
  };
}
