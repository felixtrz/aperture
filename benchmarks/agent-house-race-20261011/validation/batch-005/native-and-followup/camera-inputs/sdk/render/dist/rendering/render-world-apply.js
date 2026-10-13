export function applySnapshotToRenderWorldObjects(objects, snapshot, options = {}) {
    const diagnostics = [];
    const seen = new Set();
    const unchangedRenderIds = unchangedMeshDrawRenderIds(options.changeSet, snapshot.frame);
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const packet of snapshot.meshDraws) {
        if (seen.has(packet.renderId)) {
            diagnostics.push({
                code: "renderWorld.duplicateRenderId",
                message: `Duplicate render id ${packet.renderId} in snapshot.`,
                severity: "error",
            });
            continue;
        }
        seen.add(packet.renderId);
        const existing = objects.get(packet.renderId);
        if (existing === undefined) {
            created += 1;
        }
        else if (unchangedRenderIds.has(packet.renderId)) {
            unchanged += 1;
        }
        else {
            updated += 1;
        }
        objects.set(packet.renderId, {
            renderId: packet.renderId,
            status: "active",
            packet,
            gpu: existing?.gpu ?? {
                meshResourceKey: null,
                materialResourceKey: null,
            },
        });
    }
    let removed = 0;
    for (const renderId of objects.keys()) {
        if (!seen.has(renderId)) {
            objects.delete(renderId);
            removed += 1;
        }
    }
    return {
        created,
        updated,
        unchanged,
        removed,
        active: objects.size,
        diagnostics,
    };
}
function unchangedMeshDrawRenderIds(changeSet, frame) {
    if (changeSet?.frame === frame &&
        changeSet.unchangedMeshDrawRenderIds !== undefined) {
        return changeSet.unchangedMeshDrawRenderIds.length === 0
            ? EMPTY_RENDER_IDS
            : new Set(changeSet.unchangedMeshDrawRenderIds);
    }
    const keys = changeSet?.frame === frame ? changeSet.keys?.meshDraws : null;
    if (keys === null || keys === undefined || keys.unchanged.length === 0) {
        return EMPTY_RENDER_IDS;
    }
    const renderIds = new Set();
    for (const key of keys.unchanged) {
        const renderId = renderIdFromMeshDrawKey(key);
        if (renderId !== null) {
            renderIds.add(renderId);
        }
    }
    return renderIds;
}
const EMPTY_RENDER_IDS = new Set();
function renderIdFromMeshDrawKey(key) {
    const prefix = "mesh-draw:";
    if (!key.startsWith(prefix)) {
        return null;
    }
    const renderId = Number(key.slice(prefix.length));
    return Number.isSafeInteger(renderId) ? renderId : null;
}
//# sourceMappingURL=render-world-apply.js.map