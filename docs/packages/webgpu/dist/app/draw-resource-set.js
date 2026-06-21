import { assetHandleKey } from "@aperture-engine/simulation";
export function createWebGpuAppDrawResourceSetPlan(snapshot) {
    const mutableSets = [];
    const setByKey = new Map();
    for (let drawIndex = 0; drawIndex < snapshot.meshDraws.length; drawIndex += 1) {
        const draw = snapshot.meshDraws[drawIndex];
        if (draw === undefined) {
            continue;
        }
        const meshKey = assetHandleKey(draw.mesh);
        const materialKey = assetHandleKey(draw.material);
        const setKey = `${meshKey}|${materialKey}`;
        let set = setByKey.get(setKey);
        if (set === undefined) {
            set = {
                index: mutableSets.length,
                meshKey,
                materialKey,
                drawIndices: [],
                renderIds: [],
            };
            mutableSets.push(set);
            setByKey.set(setKey, set);
        }
        set.drawIndices.push(drawIndex);
        set.renderIds.push(draw.renderId);
    }
    return {
        drawCount: snapshot.meshDraws.length,
        sets: mutableSets.map((set) => ({
            index: set.index,
            meshKey: set.meshKey,
            materialKey: set.materialKey,
            drawIndices: [...set.drawIndices],
            renderIds: [...set.renderIds],
        })),
    };
}
//# sourceMappingURL=draw-resource-set.js.map