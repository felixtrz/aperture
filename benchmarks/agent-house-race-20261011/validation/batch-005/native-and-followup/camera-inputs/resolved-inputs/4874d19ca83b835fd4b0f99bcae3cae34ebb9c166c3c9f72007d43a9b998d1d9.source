import { OPAQUE_STATE_SORT_POLICY_NAME } from "./render-state-sort.js";
export function renderQueueSortPolicyForPhase(phase) {
    return phase === "transparent"
        ? TRANSPARENT_RENDER_QUEUE_SORT_POLICY
        : OPAQUE_RENDER_QUEUE_SORT_POLICY;
}
const OPAQUE_RENDER_QUEUE_SORT_POLICY = {
    name: OPAQUE_STATE_SORT_POLICY_NAME,
    depthOrder: "front-to-back",
    primaryKeys: [
        "queue",
        "viewId",
        "layer",
        "order",
        "pipelineKey",
        "materialResourceKey",
        "meshLayoutKey",
        "meshResourceKey",
        "depth",
    ],
    tieBreakers: ["stableId", "renderId", "sortOrdinal"],
    totalOrder: true,
};
const TRANSPARENT_RENDER_QUEUE_SORT_POLICY = {
    name: "transparent-order-back-to-front-stable",
    depthOrder: "back-to-front",
    primaryKeys: ["queue", "viewId", "layer", "order", "depth"],
    tieBreakers: [
        "stableId",
        "pipelineKey",
        "materialKey",
        "meshKey",
        "renderId",
        "sortOrdinal",
    ],
    totalOrder: true,
};
//# sourceMappingURL=render-queue-sort-policies.js.map