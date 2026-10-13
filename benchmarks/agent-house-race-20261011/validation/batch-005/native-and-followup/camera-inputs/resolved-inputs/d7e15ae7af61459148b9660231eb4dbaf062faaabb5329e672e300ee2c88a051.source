import { compareRenderSortKeys, } from "@aperture-engine/render";
import { runDisposersInReverse, } from "@aperture-engine/simulation";
export function createWebGpuFeatureRealizerRegistry() {
    const realizers = [];
    const disposers = [];
    return {
        register(realizer) {
            if (realizers.some((candidate) => candidate.id === realizer.id)) {
                throw new Error(`WebGPU feature realizer '${realizer.id}' is already registered.`);
            }
            let disposed = false;
            realizers.push(realizer);
            const dispose = async () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                const index = realizers.indexOf(realizer);
                if (index >= 0) {
                    realizers.splice(index, 1);
                }
                await realizer.dispose?.();
            };
            disposers.push(dispose);
            return dispose;
        },
        list() {
            return realizers.slice();
        },
        // Realizer exceptions intentionally propagate: a throwing prepareFrame
        // must reject the frame loudly (with its stack) instead of degrading into
        // a silent ok:false report.
        async prepareFrame(input) {
            const sceneGroups = [];
            const overlayGroups = [];
            const reports = new Map();
            const diagnostics = [];
            let valid = true;
            for (const realizer of realizers.slice()) {
                const result = await realizer.prepareFrame(input);
                valid = valid && result.valid;
                if (result.report !== undefined) {
                    reports.set(realizer.id, result.report);
                }
                if (result.diagnostics !== undefined) {
                    diagnostics.push(...result.diagnostics);
                }
                for (const group of result.commandGroups) {
                    // An empty group is a legal no-op (a feature with no work this
                    // frame), not a contract violation.
                    if (group.commands.length === 0) {
                        continue;
                    }
                    if (group.phase === "overlay") {
                        overlayGroups.push(group);
                    }
                    else {
                        sceneGroups.push(group);
                    }
                }
            }
            overlayGroups.sort((a, b) => a.ordinal - b.ordinal);
            const overlayCommands = [];
            for (const group of overlayGroups) {
                overlayCommands.push(...group.commands);
            }
            return { valid, sceneGroups, overlayCommands, reports, diagnostics };
        },
        async dispose() {
            await runDisposersInReverse({
                disposers,
                failureMessage: "One or more WebGPU feature realizer disposers failed.",
            });
        },
    };
}
export function createWebGpuFeatureCommandGroupsFromCommands(options) {
    if (options.commands.length === 0) {
        return [];
    }
    const sortKeys = options.sortKeys ??
        (options.snapshot === undefined
            ? undefined
            : snapshotRenderSortKeysByRenderId(options.snapshot));
    const groups = [];
    let current;
    for (const command of options.commands) {
        if (current === undefined ||
            current.commands[0]?.renderId !== command.renderId) {
            const sortKey = sortKeys?.get(command.renderId);
            current = {
                featureId: options.featureId,
                phase: options.phase,
                ordinal: (options.startingOrdinal ?? 0) + groups.length,
                commands: [],
                ...(sortKey === undefined ? {} : { sortKey }),
            };
            groups.push(current);
        }
        current.commands.push(command);
    }
    return groups;
}
export function validateWebGpuFeatureCommandGroups(groups) {
    const diagnostics = [];
    for (const group of groups) {
        if (requiresRenderSortKey(group.phase) && group.sortKey === undefined) {
            diagnostics.push({
                code: "webGpuFeatureCommandGroup.missingSortKey",
                featureId: group.featureId,
                phase: group.phase,
                message: `WebGPU feature '${group.featureId}' returned a '${group.phase}' command group without a render sort key.`,
            });
        }
    }
    return diagnostics;
}
export function orderWebGpuFeatureCommandGroups(groups) {
    return [...groups].sort((a, b) => {
        const phaseOrder = phaseOrdinal(a.phase) - phaseOrdinal(b.phase);
        if (phaseOrder !== 0) {
            return phaseOrder;
        }
        if (requiresRenderSortKey(a.phase) &&
            a.sortKey !== undefined &&
            b.sortKey !== undefined) {
            return (compareRenderSortKeys(a.sortKey, b.sortKey) || a.ordinal - b.ordinal);
        }
        return a.ordinal - b.ordinal;
    });
}
export function mergeSnapshotSortedRenderPassCommands(options) {
    const featureGroups = options.featureGroups ?? [];
    if (options.overlayCommands.length === 0 && featureGroups.length === 0) {
        return { commands: options.baseCommands, diagnostics: [] };
    }
    const sortKeys = snapshotRenderSortKeysByRenderId(options.snapshot);
    const sorted = [];
    const keyless = [];
    const push = (group) => {
        (group.sortKey === undefined ? keyless : sorted).push(group);
    };
    for (const group of createWebGpuFeatureCommandGroupsFromCommands({
        featureId: "snapshot-overlay",
        phase: "transparent",
        commands: [...options.baseCommands, ...options.overlayCommands],
        sortKeys,
    })) {
        push(group);
    }
    for (const group of featureGroups) {
        if (group.commands.length === 0) {
            continue;
        }
        if (group.sortKey !== undefined) {
            push(group);
            continue;
        }
        const derived = sortKeys.get(group.commands[0]?.renderId ?? -1);
        push(derived === undefined ? group : { ...group, sortKey: derived });
    }
    sorted.sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey) || a.ordinal - b.ordinal);
    const commands = [];
    for (const group of sorted) {
        commands.push(...group.commands);
    }
    for (const group of keyless) {
        commands.push(...group.commands);
    }
    return { commands, diagnostics: validateWebGpuFeatureCommandGroups(keyless) };
}
function requiresRenderSortKey(phase) {
    return (phase === "opaque" || phase === "alpha-test" || phase === "transparent");
}
function phaseOrdinal(phase) {
    switch (phase) {
        case "opaque":
            return 0;
        case "alpha-test":
            return 1;
        case "transparent":
            return 2;
        case "overlay":
            return 3;
    }
}
function snapshotRenderSortKeysByRenderId(snapshot) {
    const sortKeys = new Map();
    for (const draw of snapshot.meshDraws) {
        sortKeys.set(draw.renderId, draw.sortKey);
    }
    for (const draw of snapshot.spriteDraws ?? []) {
        sortKeys.set(draw.renderId, draw.sortKey);
    }
    for (const batch of snapshot.quadBatches ?? []) {
        sortKeys.set(batch.batchId, batch.sortKey);
    }
    for (const emitter of snapshot.particleEmitters ?? []) {
        sortKeys.set(emitter.emitterId, emitter.sortKey);
    }
    return sortKeys;
}
//# sourceMappingURL=feature-command-groups.js.map