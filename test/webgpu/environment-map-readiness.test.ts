import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  createEnvironmentMapReadinessReport,
  environmentMapReadinessReportToJson,
  environmentMapReadinessReportToJsonValue,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu/test-support";

describe("environment map readiness", () => {
  it("treats empty environment snapshots as ready planning no-ops", () => {
    const report = createEnvironmentMapReadinessReport({
      snapshot: { environments: [] },
    });

    expect(report).toEqual({
      ready: true,
      environmentCount: 0,
      nullHandleCount: 0,
      requiredEnvironmentMapCount: 0,
      sections: {
        environmentResourcePlanning: true,
        environmentMapResources: null,
      },
      requirements: [],
      diagnostics: [],
    });
    expect(JSON.parse(environmentMapReadinessReportToJson(report))).toEqual(
      environmentMapReadinessReportToJsonValue(report),
    );
  });

  it("keeps null-handle environments ready without resource requirements", () => {
    const report = createEnvironmentMapReadinessReport({
      snapshot: [environment(1, null), environment(2, null)],
    });

    expect(report).toMatchObject({
      ready: true,
      environmentCount: 2,
      nullHandleCount: 2,
      requiredEnvironmentMapCount: 0,
      requirements: [],
      diagnostics: [],
    });
  });

  it("reports stable environment-map requirements without raw handles", () => {
    const report = createEnvironmentMapReadinessReport({
      snapshot: [
        environment(3, "warehouse"),
        environment(1, "studio"),
        environment(2, "studio"),
      ],
    });
    const json = environmentMapReadinessReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: true,
      environmentCount: 3,
      nullHandleCount: 0,
      requiredEnvironmentMapCount: 2,
      sections: {
        environmentResourcePlanning: true,
        environmentMapResources: null,
      },
      requirements: [
        {
          resourceKey: "environment-map:studio",
          environmentIds: [1, 2],
          ready: null,
        },
        {
          resourceKey: "environment-map:warehouse",
          environmentIds: [3],
          ready: null,
        },
      ],
    });
    expect(JSON.stringify(json)).not.toContain('"handle"');
    expect(JSON.stringify(json)).not.toContain("GPU");
  });

  it("diagnoses missing renderer-owned environment resources when provided", () => {
    const report = createEnvironmentMapReadinessReport({
      snapshot: [environment(1, "studio"), environment(2, "warehouse")],
      resources: {
        environmentMapResourceKeys: ["environment-map:studio"],
      },
    });
    const json = environmentMapReadinessReportToJsonValue(report);

    expect(json.ready).toBe(false);
    expect(json.sections.environmentMapResources).toBe(false);
    expect(json.requirements).toEqual([
      {
        resourceKey: "environment-map:studio",
        environmentIds: [1],
        ready: true,
      },
      {
        resourceKey: "environment-map:warehouse",
        environmentIds: [2],
        ready: false,
      },
    ]);
    expect(json.diagnostics).toEqual([
      {
        code: "environmentMapReadiness.missingResource",
        severity: "warning",
        resourceKey: "environment-map:warehouse",
        environmentIds: [2],
        message:
          "Environment map resource 'environment-map:warehouse' is required by extracted environment packets but is not present in renderer resource state.",
      },
    ]);
  });
});

function environment(
  environmentId: number,
  handleId: string | null,
): EnvironmentPacket {
  return {
    environmentId,
    handle: handleId === null ? null : createEnvironmentMapHandle(handleId),
    color: [1, 1, 1, 1],
    intensity: 1,
    layerMask: 1,
  };
}
