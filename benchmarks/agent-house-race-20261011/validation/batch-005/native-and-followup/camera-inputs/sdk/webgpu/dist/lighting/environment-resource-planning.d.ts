import { type EnvironmentMapHandle } from "@aperture-engine/simulation";
import type { EnvironmentPacket, RenderSnapshot } from "@aperture-engine/render";
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
export type PlanEnvironmentResourcesInput = readonly EnvironmentPacket[] | Pick<RenderSnapshot, "environments">;
export declare function planEnvironmentResources(input: PlanEnvironmentResourcesInput): EnvironmentResourcePlan;
//# sourceMappingURL=environment-resource-planning.d.ts.map