import { APERTURE_GENERATED_COMMAND_EVENT } from "../commands.js";
import { APERTURE_HTML_BRIDGE_COMMAND_CHANNEL, } from "../systems/html-bridge.js";
export function dispatchApertureHtmlEvent(channel, payload, eventTarget = window) {
    eventTarget.dispatchEvent(new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
        detail: {
            channel,
            ...(payload === undefined ? {} : { payload }),
        },
    }));
}
export function observeApertureHtmlSlots(options = {}) {
    const scope = options.scope ?? document;
    const selector = options.selector ?? "[data-aperture-slot]";
    const eventTarget = options.eventTarget ?? window;
    const viewportElement = resolveViewportElement(options.viewportElement);
    const epsilonPx = Math.max(0, options.epsilonPx ?? 0.5);
    const snapshots = new Map();
    let sequence = 0;
    let disposed = false;
    let frame = 0;
    const resizeObserver = typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => scheduleFlush("resize-observer"));
    const mutationObserver = options.observeMutations === false ||
        typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            refreshObservedElements();
            scheduleFlush("mutation-observer");
        });
    const flush = (reason = "manual") => {
        if (disposed)
            return;
        frame = 0;
        refreshObservedElements();
        const seen = new Set();
        for (const element of slotElements(scope, selector)) {
            const slot = slotName(element);
            if (slot === null)
                continue;
            seen.add(slot);
            const viewport = viewportSnapshot(viewportElement);
            const rect = rectRelativeToViewport(element.getBoundingClientRect(), viewport.rect);
            const visible = isVisible(element, rect);
            const signature = signatureOf(rect, viewport, visible);
            const previous = snapshots.get(slot);
            if (previous !== undefined &&
                sameSignature(previous, signature, epsilonPx)) {
                continue;
            }
            sequence += 1;
            snapshots.set(slot, signature);
            dispatchApertureHtmlEvent(APERTURE_HTML_BRIDGE_COMMAND_CHANNEL, {
                kind: "slot",
                slot,
                rect,
                viewport,
                visible,
                sequence,
                time: nowMilliseconds(),
                reason,
            }, eventTarget);
        }
        for (const slot of [...snapshots.keys()]) {
            if (seen.has(slot))
                continue;
            snapshots.delete(slot);
            sequence += 1;
            dispatchApertureHtmlEvent(APERTURE_HTML_BRIDGE_COMMAND_CHANNEL, {
                kind: "remove-slot",
                slot,
                sequence,
                time: nowMilliseconds(),
                reason,
            }, eventTarget);
        }
    };
    const scheduleFlush = (reason) => {
        if (disposed || frame !== 0)
            return;
        frame = requestAnimationFrame(() => flush(reason));
    };
    const onResize = () => scheduleFlush("viewport-resize");
    const onScroll = () => scheduleFlush("scroll");
    function refreshObservedElements() {
        if (resizeObserver === null)
            return;
        resizeObserver.disconnect();
        for (const element of slotElements(scope, selector)) {
            resizeObserver.observe(element);
        }
    }
    refreshObservedElements();
    if (mutationObserver !== null && scope instanceof Node) {
        mutationObserver.observe(scope, {
            attributes: true,
            attributeFilter: ["data-aperture-slot", "class", "style", "hidden"],
            childList: true,
            subtree: true,
        });
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onScroll);
    flush("initial");
    return {
        flush,
        disconnect() {
            disposed = true;
            if (frame !== 0) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, { capture: true });
            window.visualViewport?.removeEventListener("resize", onResize);
            window.visualViewport?.removeEventListener("scroll", onScroll);
        },
    };
}
function slotElements(scope, selector) {
    return [...scope.querySelectorAll(selector)];
}
function slotName(element) {
    const value = element.getAttribute("data-aperture-slot");
    const trimmed = value?.trim() ?? "";
    return trimmed.length === 0 ? null : trimmed;
}
function rectSnapshot(rect) {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
    };
}
function rectFromValues(left, top, width, height) {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
    };
}
function rectRelativeToViewport(rect, viewportRect) {
    const originLeft = viewportRect?.left ?? 0;
    const originTop = viewportRect?.top ?? 0;
    return rectFromValues(rect.left - originLeft, rect.top - originTop, rect.width, rect.height);
}
function viewportSnapshot(viewportElement) {
    if (viewportElement !== null) {
        const rect = rectSnapshot(viewportElement.getBoundingClientRect());
        return {
            width: rect.width,
            height: rect.height,
            devicePixelRatio: window.devicePixelRatio,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            rect,
        };
    }
    const visual = window.visualViewport;
    const width = visual?.width ?? window.innerWidth;
    const height = visual?.height ?? window.innerHeight;
    return {
        width,
        height,
        devicePixelRatio: window.devicePixelRatio,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        rect: rectFromValues(0, 0, width, height),
    };
}
function resolveViewportElement(input) {
    if (input === undefined || input === null) {
        return null;
    }
    if (typeof input === "string") {
        return document.querySelector(input);
    }
    return input;
}
function isVisible(element, rect) {
    if (rect.width <= 0 || rect.height <= 0) {
        return false;
    }
    if (element instanceof HTMLElement && element.hidden) {
        return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
}
function signatureOf(rect, viewport, visible) {
    return { rect, viewport, visible };
}
function sameSignature(a, b, epsilonPx) {
    return (a.visible === b.visible &&
        sameRect(a.rect, b.rect, epsilonPx) &&
        Math.abs(a.viewport.width - b.viewport.width) <= epsilonPx &&
        Math.abs(a.viewport.height - b.viewport.height) <= epsilonPx &&
        a.viewport.devicePixelRatio === b.viewport.devicePixelRatio &&
        Math.abs(a.viewport.scrollX - b.viewport.scrollX) <= epsilonPx &&
        Math.abs(a.viewport.scrollY - b.viewport.scrollY) <= epsilonPx);
}
function sameRect(a, b, epsilonPx) {
    return (Math.abs(a.x - b.x) <= epsilonPx &&
        Math.abs(a.y - b.y) <= epsilonPx &&
        Math.abs(a.width - b.width) <= epsilonPx &&
        Math.abs(a.height - b.height) <= epsilonPx &&
        Math.abs(a.top - b.top) <= epsilonPx &&
        Math.abs(a.right - b.right) <= epsilonPx &&
        Math.abs(a.bottom - b.bottom) <= epsilonPx &&
        Math.abs(a.left - b.left) <= epsilonPx);
}
function nowMilliseconds() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
}
//# sourceMappingURL=html-bridge.js.map