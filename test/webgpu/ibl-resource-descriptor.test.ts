import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createIblResourceDescriptorReport,
  iblResourceDescriptorReportToJson,
  iblResourceDescriptorReportToJsonValue,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu/test-support";

describe("IBL resource descriptors", () => {
  it("creates stable renderer-owned diffuse/specular descriptor keys", () => {
    const report = createIblResourceDescriptorReport({
      snapshot: [environment(2, "studio"), environment(1, "studio")],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          diffuseResourceKey: "texture:studio:diffuse-irradiance",
          specularResourceKey: "texture:studio:specular-prefilter",
        },
      ],
    });
    const json = iblResourceDescriptorReportToJsonValue(report);

    expect(report.ready).toBe(true);
    expect(json).toMatchObject({
      environmentCount: 2,
      requiredEnvironmentMapCount: 1,
      descriptorCount: 1,
      sections: {
        environmentResourcePlanning: true,
        iblDescriptors: true,
        shaderSampling: false,
      },
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
          environmentIds: [1, 2],
          ready: true,
          diffuse: {
            status: "ready",
            resourceKey: "texture:studio:diffuse-irradiance",
            placeholder: null,
          },
          specular: {
            status: "ready",
            resourceKey: "texture:studio:specular-prefilter",
            placeholder: null,
          },
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(iblResourceDescriptorReportToJson(report))).toEqual(json);
    expect(JSON.stringify(json)).not.toContain('"handle"');
    expect(JSON.stringify(json)).not.toContain("GPU");
  });

  it("reports source-not-prepared placeholders for descriptors without resource keys", () => {
    const report = createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [
        {
          environmentMapResourceKey: "environment-map:studio",
        },
      ],
    });
    const json = iblResourceDescriptorReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.sections).toEqual({
      environmentResourcePlanning: true,
      iblDescriptors: true,
      shaderSampling: false,
    });
    expect(json.descriptors).toMatchObject([
      {
        environmentMapResourceKey: "environment-map:studio",
        ready: true,
        diffuse: {
          status: "unsupported",
          resourceKey: null,
          placeholder: "environment-map:studio:ibl:diffuse:unsupported",
        },
        specular: {
          status: "unsupported",
          resourceKey: null,
          placeholder: "environment-map:studio:ibl:specular:unsupported",
        },
      },
    ]);
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "iblResourceDescriptor.diffuseSourceNotPrepared",
      "iblResourceDescriptor.specularSourceNotPrepared",
    ]);
    expect(
      json.diagnostics.map((diagnostic) => diagnostic.message),
    ).not.toContainEqual(expect.stringContaining("without enabling"));
  });

  it("diagnoses missing descriptors for required environment resources", () => {
    const report = createIblResourceDescriptorReport({
      snapshot: [environment(1, "studio")],
      descriptors: [],
    });
    const json = iblResourceDescriptorReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.descriptorCount).toBe(0);
    expect(json.sections.iblDescriptors).toBe(false);
    expect(json.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "iblResourceDescriptor.missingDescriptor",
      "iblResourceDescriptor.diffuseSourceNotPrepared",
      "iblResourceDescriptor.specularSourceNotPrepared",
    ]);
  });

  it("keeps empty snapshots as ready no-ops", () => {
    const report = createIblResourceDescriptorReport({
      snapshot: { environments: [] },
    });

    expect(iblResourceDescriptorReportToJsonValue(report)).toEqual({
      ready: true,
      environmentCount: 0,
      requiredEnvironmentMapCount: 0,
      descriptorCount: 0,
      sections: {
        environmentResourcePlanning: true,
        iblDescriptors: true,
        shaderSampling: false,
      },
      descriptors: [],
      diagnostics: [],
    });
  });
});

function environment(
  environmentId: number,
  handleId: string,
): EnvironmentPacket {
  return {
    environmentId,
    handle: createEnvironmentMapHandle(handleId),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}
