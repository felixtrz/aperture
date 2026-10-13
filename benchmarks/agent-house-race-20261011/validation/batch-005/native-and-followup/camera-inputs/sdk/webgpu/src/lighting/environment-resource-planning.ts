import {
  assetHandleKey,
  type EnvironmentMapHandle,
} from "@aperture-engine/simulation";
import type {
  EnvironmentPacket,
  RenderSnapshot,
} from "@aperture-engine/render";

export interface EnvironmentResourceRequirement {
  readonly resourceKey: string;
  readonly handle: EnvironmentMapHandle;
  readonly environmentIds: readonly number[];
}

export interface EnvironmentResourcePlan {
  readonly environmentCount: number;
  readonly nullHandleCount: number;
  readonly requirements: readonly EnvironmentResourceRequirement[];
}

export type PlanEnvironmentResourcesInput =
  | readonly EnvironmentPacket[]
  | Pick<RenderSnapshot, "environments">;

export function planEnvironmentResources(
  input: PlanEnvironmentResourcesInput,
): EnvironmentResourcePlan {
  const environments = isEnvironmentPacketArray(input)
    ? input
    : input.environments;
  const requirementsByKey = new Map<
    string,
    {
      readonly handle: EnvironmentMapHandle;
      readonly environmentIds: number[];
    }
  >();
  let nullHandleCount = 0;

  for (const environment of environments) {
    if (environment.handle === null) {
      nullHandleCount += 1;
      continue;
    }

    const resourceKey = assetHandleKey(environment.handle);
    const current = requirementsByKey.get(resourceKey);

    if (current === undefined) {
      requirementsByKey.set(resourceKey, {
        handle: environment.handle,
        environmentIds: [environment.environmentId],
      });
    } else {
      current.environmentIds.push(environment.environmentId);
    }
  }

  return {
    environmentCount: environments.length,
    nullHandleCount,
    requirements: [...requirementsByKey.entries()]
      .map(([resourceKey, requirement]) => ({
        resourceKey,
        handle: requirement.handle,
        environmentIds: [...requirement.environmentIds].sort((a, b) => a - b),
      }))
      .sort((a, b) =>
        a.resourceKey < b.resourceKey
          ? -1
          : a.resourceKey > b.resourceKey
            ? 1
            : 0,
      ),
  };
}

function isEnvironmentPacketArray(
  input: PlanEnvironmentResourcesInput,
): input is readonly EnvironmentPacket[] {
  return Array.isArray(input);
}
