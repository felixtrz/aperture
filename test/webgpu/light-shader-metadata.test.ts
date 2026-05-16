import { describe, expect, it } from "vitest";

import {
  LIGHT_SHADER_BINDING_METADATA,
  createLightShaderResourceReadinessReport,
  createLightBindGroupLayoutDescriptor,
  lightShaderResourceReadinessReportToJson,
  lightShaderResourceReadinessReportToJsonValue,
  lightShaderReadinessToResourceSummaryDiagnostics,
  validateLightBindGroupLayoutMetadata,
} from "@aperture-engine/webgpu";

describe("light shader binding metadata", () => {
  it("declares stable light buffer binding metadata", () => {
    expect(LIGHT_SHADER_BINDING_METADATA).toEqual({
      group: 3,
      bindings: [
        {
          id: "lightFloats",
          label: "Packed light float storage",
          group: 3,
          binding: 0,
          resource: "read-only-storage-buffer",
        },
        {
          id: "lightMetadata",
          label: "Packed light metadata storage",
          group: 3,
          binding: 1,
          resource: "read-only-storage-buffer",
        },
      ],
    });
  });

  it("matches the light bind group layout descriptor contract", () => {
    const layout = createLightBindGroupLayoutDescriptor();

    expect(
      LIGHT_SHADER_BINDING_METADATA.bindings.map((binding) => ({
        group: binding.group,
        binding: binding.binding,
        resource: binding.resource,
      })),
    ).toEqual([
      { group: 3, binding: 0, resource: "read-only-storage-buffer" },
      { group: 3, binding: 1, resource: "read-only-storage-buffer" },
    ]);
    expect(layout.entries).toEqual([
      {
        binding: 0,
        visibility: 0x2,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: 0x2,
        buffer: { type: "read-only-storage" },
      },
    ]);
  });

  it("validates light bind group layout metadata", () => {
    expect(
      validateLightBindGroupLayoutMetadata(
        createLightBindGroupLayoutDescriptor(),
      ),
    ).toEqual({ valid: true, diagnostics: [] });
  });

  it("diagnoses missing light layout bindings and resource mismatches", () => {
    expect(
      validateLightBindGroupLayoutMetadata({
        label: "bad",
        entries: [
          {
            binding: 0,
            visibility: 0x2,
            buffer: { type: "uniform" },
          },
        ],
      }),
    ).toEqual({
      valid: false,
      diagnostics: [
        {
          code: "lightShaderBinding.resourceMismatch",
          bindingId: "lightFloats",
          binding: 0,
          message:
            "Light bind group layout binding 0 uses 'uniform-buffer' but metadata requires 'read-only-storage-buffer'.",
        },
        {
          code: "lightShaderBinding.missingBinding",
          bindingId: "lightMetadata",
          binding: 1,
          message:
            "Light bind group layout is missing 'lightMetadata' at binding 1.",
        },
      ],
    });
  });

  it("reports ready light shader resources without enabling shader lighting", () => {
    expect(
      createLightShaderResourceReadinessReport({
        lightGpuBufferResourceKey: "light-buffer:main",
        layoutKey: "bind-group-layout:lights/group-3",
        bindGroupResourceKey: "bind-group:lights/group-3/light-buffer:main",
        metadata: validateLightBindGroupLayoutMetadata(
          createLightBindGroupLayoutDescriptor(),
        ),
      }),
    ).toEqual({
      ready: true,
      sections: {
        lightGpuBuffers: true,
        layout: true,
        bindGroup: true,
        metadata: true,
      },
      diagnostics: [],
    });
  });

  it("reports missing light shader resources and metadata mismatch", () => {
    const metadata = validateLightBindGroupLayoutMetadata({
      label: "bad",
      entries: [],
    });

    expect(
      createLightShaderResourceReadinessReport({
        lightGpuBufferResourceKey: null,
        layoutKey: null,
        bindGroupResourceKey: null,
        metadata,
      }),
    ).toEqual({
      ready: false,
      sections: {
        lightGpuBuffers: false,
        layout: false,
        bindGroup: false,
        metadata: false,
      },
      diagnostics: [
        {
          code: "lightShaderReadiness.missingLightGpuBuffers",
          message: "Light shader readiness requires light GPU buffers.",
        },
        {
          code: "lightShaderReadiness.missingLayout",
          message: "Light shader readiness requires a light bind group layout.",
        },
        {
          code: "lightShaderReadiness.missingBindGroup",
          message:
            "Light shader readiness requires a light bind group resource.",
        },
        {
          code: "lightShaderReadiness.metadataInvalid",
          message: "Light shader binding metadata validation failed.",
        },
      ],
    });
  });

  it("serializes stable light shader readiness JSON", () => {
    const report = createLightShaderResourceReadinessReport({
      lightGpuBufferResourceKey: null,
      layoutKey: "bind-group-layout:lights/group-3",
      bindGroupResourceKey: null,
      metadata: validateLightBindGroupLayoutMetadata({
        label: "bad",
        entries: [],
      }),
    });
    const value = lightShaderResourceReadinessReportToJsonValue(report);
    const json = lightShaderResourceReadinessReportToJson(report);

    expect(value).toMatchObject({
      ready: false,
      sections: {
        lightGpuBuffers: false,
        layout: true,
        bindGroup: false,
        metadata: false,
      },
      diagnostics: [
        { code: "lightShaderReadiness.missingLightGpuBuffers" },
        { code: "lightShaderReadiness.missingBindGroup" },
        { code: "lightShaderReadiness.metadataInvalid" },
      ],
    });
    expect(JSON.parse(json) as unknown).toEqual(value);
    expect(json).toBe(lightShaderResourceReadinessReportToJson(report));
    expect(json).not.toContain("raw-light");
    expect(json).not.toContain("shaderModule");
  });

  it("bridges readiness diagnostics into resource summary warnings", () => {
    const ready = createLightShaderResourceReadinessReport({
      lightGpuBufferResourceKey: "light-buffer:main",
      layoutKey: "bind-group-layout:lights/group-3",
      bindGroupResourceKey: "bind-group:lights/group-3/light-buffer:main",
      metadata: validateLightBindGroupLayoutMetadata(
        createLightBindGroupLayoutDescriptor(),
      ),
    });
    const missing = createLightShaderResourceReadinessReport({
      lightGpuBufferResourceKey: null,
      layoutKey: "bind-group-layout:lights/group-3",
      bindGroupResourceKey: null,
      metadata: validateLightBindGroupLayoutMetadata({ entries: [] }),
    });

    expect(lightShaderReadinessToResourceSummaryDiagnostics(ready)).toEqual([]);
    expect(
      lightShaderReadinessToResourceSummaryDiagnostics(missing),
    ).toMatchObject([
      {
        code: "lightShaderReadiness.missingLightGpuBuffers",
        severity: "warning",
      },
      {
        code: "lightShaderReadiness.missingBindGroup",
        severity: "warning",
      },
      {
        code: "lightShaderReadiness.metadataInvalid",
        severity: "warning",
      },
    ]);
  });
});
