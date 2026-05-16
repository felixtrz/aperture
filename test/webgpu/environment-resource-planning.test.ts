import { describe, expect, it } from "vitest";

import {
  createEnvironmentMapHandle,
  planEnvironmentResources,
  type EnvironmentPacket,
} from "@aperture-engine/webgpu";

describe("environment resource planning", () => {
  it("plans unique environment-map resource keys in stable order", () => {
    const plan = planEnvironmentResources([
      environment(3, "warehouse"),
      environment(1, "studio"),
      environment(2, "studio"),
    ]);

    expect(plan).toMatchObject({
      environmentCount: 3,
      nullHandleCount: 0,
      requirements: [
        {
          resourceKey: "environment-map:studio",
          environmentIds: [1, 2],
        },
        {
          resourceKey: "environment-map:warehouse",
          environmentIds: [3],
        },
      ],
    });
    expect(plan.requirements[0]?.handle).toMatchObject({
      kind: "environment-map",
      id: "studio",
    });
  });

  it("keeps null environment handles valid without resource requirements", () => {
    const plan = planEnvironmentResources([
      environment(1, null),
      environment(2, "studio"),
      environment(3, null),
    ]);

    expect(plan.environmentCount).toBe(3);
    expect(plan.nullHandleCount).toBe(2);
    expect(
      plan.requirements.map((requirement) => requirement.resourceKey),
    ).toEqual(["environment-map:studio"]);
  });

  it("accepts render snapshots without reading ECS state", () => {
    const plan = planEnvironmentResources({
      environments: [environment(9, "studio")],
    });

    expect(plan.requirements).toMatchObject([
      {
        resourceKey: "environment-map:studio",
        environmentIds: [9],
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
