import { defineResource, resource } from "./resources.js";
export const APERTURE_HTML_BRIDGE_COMMAND_CHANNEL = "aperture.html.bridge";
export const APERTURE_HTML_EVENT_CHANNEL_PREFIX = "aperture.html.event.";
export const HtmlBridgeStateResource = defineResource("aperture.html.bridge", {
    slots: resource.value(() => ({}), {
        kind: "htmlSlots",
        summarize: (slots) => ({
            count: Object.keys(slots).length,
            slots: Object.fromEntries(Object.entries(slots).map(([slot, snapshot]) => [
                slot,
                {
                    visible: snapshot.visible,
                    rect: snapshot.rect,
                    viewport: snapshot.viewport,
                    sequence: snapshot.sequence,
                },
            ])),
        }),
    }),
});
export function createHtmlBridgeAccess(resources) {
    return {
        slot(slot) {
            const trimmed = slot.trim();
            if (trimmed.length === 0)
                return null;
            return resources.read(HtmlBridgeStateResource).slots[trimmed] ?? null;
        },
        slots() {
            return Object.values(resources.read(HtmlBridgeStateResource).slots).sort((a, b) => a.slot.localeCompare(b.slot));
        },
        eventChannel: htmlEventChannel,
    };
}
export function htmlEventChannel(name) {
    const trimmed = name.trim();
    return trimmed.startsWith(APERTURE_HTML_EVENT_CHANNEL_PREFIX)
        ? trimmed
        : `${APERTURE_HTML_EVENT_CHANNEL_PREFIX}${trimmed}`;
}
export function runHtmlBridgeFrame(input) {
    const commands = input.commands.drain(APERTURE_HTML_BRIDGE_COMMAND_CHANNEL);
    if (commands.length === 0) {
        return false;
    }
    input.resources.write(HtmlBridgeStateResource, (state) => {
        for (const command of commands) {
            const slot = slotName(command.slot);
            if (slot === null) {
                continue;
            }
            if (command.kind === "remove-slot") {
                delete state.slots[slot];
                continue;
            }
            if (command.kind !== "slot" || !isFiniteRect(command.rect)) {
                continue;
            }
            state.slots[slot] = {
                slot,
                rect: command.rect,
                viewport: finiteViewport(command.viewport),
                visible: command.visible &&
                    command.rect.width > 0 &&
                    command.rect.height > 0 &&
                    command.viewport.width > 0 &&
                    command.viewport.height > 0,
                sequence: finiteInteger(command.sequence, 0),
                time: finiteNumber(command.time, 0),
                ...(command.reason === undefined || command.reason.length === 0
                    ? {}
                    : { reason: command.reason }),
            };
        }
    });
    return true;
}
function slotName(slot) {
    if (typeof slot !== "string") {
        return null;
    }
    const trimmed = slot.trim();
    return trimmed.length === 0 ? null : trimmed;
}
function isFiniteRect(rect) {
    return (isFiniteNumber(rect.x) &&
        isFiniteNumber(rect.y) &&
        isFiniteNumber(rect.width) &&
        isFiniteNumber(rect.height) &&
        isFiniteNumber(rect.top) &&
        isFiniteNumber(rect.right) &&
        isFiniteNumber(rect.bottom) &&
        isFiniteNumber(rect.left));
}
function finiteViewport(viewport) {
    const width = Math.max(0, finiteNumber(viewport.width, 0));
    const height = Math.max(0, finiteNumber(viewport.height, 0));
    const fallbackRect = {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
    };
    return {
        width,
        height,
        devicePixelRatio: Math.max(0, finiteNumber(viewport.devicePixelRatio, 1)),
        scrollX: finiteNumber(viewport.scrollX, 0),
        scrollY: finiteNumber(viewport.scrollY, 0),
        rect: viewport.rect !== undefined && isFiniteRect(viewport.rect)
            ? viewport.rect
            : fallbackRect,
    };
}
function finiteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function finiteInteger(value, fallback) {
    return typeof value === "number" && Number.isInteger(value)
        ? value
        : fallback;
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
//# sourceMappingURL=html-bridge.js.map