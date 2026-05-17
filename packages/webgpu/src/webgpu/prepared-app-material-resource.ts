export type PreparedAppMaterialResourceStatus = "created" | "reused";

export interface PreparedAppMaterialResourceUse<TResource> {
  readonly status: PreparedAppMaterialResourceStatus;
  readonly resource: TResource;
}

export interface PreparedAppMaterialResourceReuseCounters {
  materialBuffersCreated: number;
  materialBuffersReused: number;
  preparedMaterialBuffersCreated: number;
  preparedMaterialBuffersReused: number;
  preparedMaterialBindGroupsCreated: number;
  preparedMaterialBindGroupsReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
}

export function recordPreparedAppMaterialResourceUse(
  counters: PreparedAppMaterialResourceReuseCounters,
  use: PreparedAppMaterialResourceUse<unknown>,
  totalBindGroupCount: number,
): void {
  if (use.status === "reused") {
    counters.materialBuffersReused += 1;
    counters.bindGroupsReused += 1;
    counters.preparedMaterialBuffersReused += 1;
    counters.preparedMaterialBindGroupsReused += 1;
  } else {
    counters.materialBuffersCreated += 1;
    counters.bindGroupsCreated += 1;
    counters.preparedMaterialBuffersCreated += 1;
    counters.preparedMaterialBindGroupsCreated += 1;
  }

  counters.bindGroupsCreated += Math.max(0, totalBindGroupCount - 1);
}
