export function hitTestUiRegions(hitRegions, point, options = {}) {
    let best = null;
    for (const region of hitRegions) {
        if (!regionMatchesLayer(region, options.layerMask ?? null)) {
            continue;
        }
        if (!pointInRect(point, region.rect) || !pointInRect(point, region.clip)) {
            continue;
        }
        if (best === null || compareUiHitRegions(region, best) > 0) {
            best = region;
        }
    }
    return best === null
        ? null
        : {
            region: best,
            entity: best.entity,
            point,
            blocksInput: best.blocksInput,
            cursor: best.cursor,
        };
}
export function hitTestUiLayout(options) {
    const screens = new Map();
    for (const node of options.nodes) {
        if (node.kind === "screen") {
            screens.set(node.screenId, node);
        }
    }
    let best = null;
    for (const region of options.hitRegions) {
        const screen = screens.get(region.screenId);
        if (screen === undefined) {
            continue;
        }
        const point = {
            x: screen.rect.x + options.position[0] * screen.rect.width,
            y: screen.rect.y + options.position[1] * screen.rect.height,
        };
        const result = hitTestUiRegions([region], point, {
            layerMask: options.layerMask ?? null,
        });
        if (result !== null &&
            (best === null || compareUiHitRegions(result.region, best.region) > 0)) {
            best = result;
        }
    }
    return best;
}
function pointInRect(point, rect) {
    return (rect.width > 0 &&
        rect.height > 0 &&
        point.x >= rect.x &&
        point.y >= rect.y &&
        point.x <= rect.x + rect.width &&
        point.y <= rect.y + rect.height);
}
function regionMatchesLayer(region, layerMask) {
    return layerMask === null || (region.layerMask & layerMask) !== 0;
}
function compareUiHitRegions(a, b) {
    return (a.priority - b.priority || a.stackIndex - b.stackIndex || a.uiId - b.uiId);
}
//# sourceMappingURL=ui-hit-test.js.map