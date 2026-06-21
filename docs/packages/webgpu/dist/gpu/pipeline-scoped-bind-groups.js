export function createPipelineScopedBindGroupScratch() {
    return { pool: [], count: 0 };
}
export function resetPipelineScopedBindGroupScratch(scratch) {
    scratch.count = 0;
}
export function appendPipelineScopedBindGroups(bindGroups, pipelineKey, output, scratch) {
    for (const bindGroup of bindGroups) {
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
function scopedBindGroupAt(scratch) {
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
//# sourceMappingURL=pipeline-scoped-bind-groups.js.map