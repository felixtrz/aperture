import { Camera } from "/aperture/worker-modules/packages/render/dist/index.js";
import { APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL, } from "../commands.js";
import { isRecord } from "./payload.js";
export function applyViewportResizeCommand(app, command) {
    if (command.channel !== APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL) {
        return false;
    }
    const resize = viewportResizePayloadFromValue(command.payload);
    if (resize === null) {
        app.context.diagnostics.warn("aperture.viewportResize.invalidPayload", {
            channel: command.channel,
        });
        return true;
    }
    const query = app.lowLevel.world.queryManager.registerQuery({
        required: [Camera],
    });
    for (const entity of query.entities) {
        if (entity.getValue(Camera, "autoAspect") === false) {
            continue;
        }
        const renderTargetId = entity.getValue(Camera, "renderTargetId") ?? "";
        if (renderTargetId.length > 0) {
            continue;
        }
        const viewport = entity.getVectorView(Camera, "viewport");
        const viewportWidth = finitePositiveNumber(viewport[2]) ?? 1;
        const viewportHeight = finitePositiveNumber(viewport[3]) ?? 1;
        entity.setValue(Camera, "aspect", resize.aspect * (viewportWidth / viewportHeight));
    }
    return true;
}
function viewportResizePayloadFromValue(value) {
    if (!isRecord(value)) {
        return null;
    }
    const width = finitePositiveNumber(value["width"]);
    const height = finitePositiveNumber(value["height"]);
    const displayWidth = finitePositiveNumber(value["displayWidth"]);
    const displayHeight = finitePositiveNumber(value["displayHeight"]);
    const pixelRatio = finitePositiveNumber(value["pixelRatio"]);
    const aspect = finitePositiveNumber(value["aspect"]);
    if (width === null ||
        height === null ||
        displayWidth === null ||
        displayHeight === null ||
        pixelRatio === null ||
        aspect === null) {
        return null;
    }
    return {
        width,
        height,
        displayWidth,
        displayHeight,
        pixelRatio,
        aspect,
    };
}
function finitePositiveNumber(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
    }
    return null;
}
//# sourceMappingURL=viewport.js.map