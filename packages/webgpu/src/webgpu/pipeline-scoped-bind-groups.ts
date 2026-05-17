export interface PipelineScopedBindGroupResource {
  readonly group: number;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface PipelineScopedBindGroupScratch {
  readonly pool: MutablePipelineScopedBindGroupResource[];
  count: number;
}

interface MutablePipelineScopedBindGroupResource {
  group: number;
  resourceKey: string;
  layoutKey: string;
  bindGroup: unknown;
  entryResourceKeys: string[];
}

export function createPipelineScopedBindGroupScratch(): PipelineScopedBindGroupScratch {
  return { pool: [], count: 0 };
}

export function resetPipelineScopedBindGroupScratch(
  scratch: PipelineScopedBindGroupScratch,
): void {
  scratch.count = 0;
}

export function appendPipelineScopedBindGroups(
  bindGroups: readonly PipelineScopedBindGroupResource[],
  pipelineKey: string,
  output: PipelineScopedBindGroupResource[],
  scratch: PipelineScopedBindGroupScratch,
): void {
  for (const bindGroup of bindGroups) {
    if (bindGroup.group === 2) {
      output.push(bindGroup);
      continue;
    }

    const scoped = scopedBindGroupAt(scratch);

    scoped.group = bindGroup.group;
    scoped.resourceKey = `${bindGroup.resourceKey}|pipeline:${pipelineKey}`;
    scoped.layoutKey = bindGroup.layoutKey;
    scoped.bindGroup = bindGroup.bindGroup;
    scoped.entryResourceKeys.length = 0;
    scoped.entryResourceKeys.push(...bindGroup.entryResourceKeys, pipelineKey);
    output.push(scoped);
  }
}

function scopedBindGroupAt(
  scratch: PipelineScopedBindGroupScratch,
): MutablePipelineScopedBindGroupResource {
  const index = scratch.count;
  let record = scratch.pool[index];

  if (record === undefined) {
    record = {
      group: 0,
      resourceKey: "",
      layoutKey: "",
      bindGroup: null,
      entryResourceKeys: [],
    };
    scratch.pool.push(record);
  }

  scratch.count += 1;
  return record;
}
