import { APERTURE_GENERATED_COMMAND_EVENT } from "../commands.js";
import {
  APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
  type HtmlBridgeCommand,
  type HtmlBridgeRect,
  type HtmlBridgeViewport,
} from "../systems/html-bridge.js";

export interface ApertureHtmlSlotObserverOptions {
  readonly scope?: ParentNode;
  readonly selector?: string;
  readonly eventTarget?: EventTarget;
  readonly viewportElement?: Element | string | null;
  readonly epsilonPx?: number;
  readonly observeMutations?: boolean;
}

export interface ApertureHtmlSlotObserver {
  flush(reason?: string): void;
  disconnect(): void;
}

export function dispatchApertureHtmlEvent(
  channel: string,
  payload?: unknown,
  eventTarget: EventTarget = window,
): void {
  eventTarget.dispatchEvent(
    new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
      detail: {
        channel,
        ...(payload === undefined ? {} : { payload }),
      },
    }),
  );
}

export function observeApertureHtmlSlots(
  options: ApertureHtmlSlotObserverOptions = {},
): ApertureHtmlSlotObserver {
  const scope = options.scope ?? document;
  const selector = options.selector ?? "[data-aperture-slot]";
  const eventTarget = options.eventTarget ?? window;
  const viewportElement = resolveViewportElement(options.viewportElement);
  const epsilonPx = Math.max(0, options.epsilonPx ?? 0.5);
  const snapshots = new Map<string, SlotSignature>();
  let sequence = 0;
  let disposed = false;
  let frame = 0;

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => scheduleFlush("resize-observer"));
  const mutationObserver =
    options.observeMutations === false ||
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          refreshObservedElements();
          scheduleFlush("mutation-observer");
        });

  const flush = (reason = "manual"): void => {
    if (disposed) return;
    frame = 0;
    refreshObservedElements();
    const seen = new Set<string>();
    for (const element of slotElements(scope, selector)) {
      const slot = slotName(element);
      if (slot === null) continue;
      seen.add(slot);
      const viewport = viewportSnapshot(viewportElement);
      const rect = rectRelativeToViewport(
        element.getBoundingClientRect(),
        viewport.rect,
      );
      const visible = isVisible(element, rect);
      const signature = signatureOf(rect, viewport, visible);
      const previous = snapshots.get(slot);
      if (
        previous !== undefined &&
        sameSignature(previous, signature, epsilonPx)
      ) {
        continue;
      }

      sequence += 1;
      snapshots.set(slot, signature);
      dispatchApertureHtmlEvent(
        APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
        {
          kind: "slot",
          slot,
          rect,
          viewport,
          visible,
          sequence,
          time: nowMilliseconds(),
          reason,
        } satisfies HtmlBridgeCommand,
        eventTarget,
      );
    }

    for (const slot of [...snapshots.keys()]) {
      if (seen.has(slot)) continue;
      snapshots.delete(slot);
      sequence += 1;
      dispatchApertureHtmlEvent(
        APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
        {
          kind: "remove-slot",
          slot,
          sequence,
          time: nowMilliseconds(),
          reason,
        } satisfies HtmlBridgeCommand,
        eventTarget,
      );
    }
  };

  const scheduleFlush = (reason: string): void => {
    if (disposed || frame !== 0) return;
    frame = requestAnimationFrame(() => flush(reason));
  };

  const onResize = (): void => scheduleFlush("viewport-resize");
  const onScroll = (): void => scheduleFlush("scroll");

  function refreshObservedElements(): void {
    if (resizeObserver === null) return;
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

interface SlotSignature {
  readonly rect: HtmlBridgeRect;
  readonly viewport: HtmlBridgeViewport;
  readonly visible: boolean;
}

function slotElements(scope: ParentNode, selector: string): Element[] {
  return [...scope.querySelectorAll(selector)];
}

function slotName(element: Element): string | null {
  const value = element.getAttribute("data-aperture-slot");
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

function rectSnapshot(rect: DOMRect): HtmlBridgeRect {
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

function rectFromValues(
  left: number,
  top: number,
  width: number,
  height: number,
): HtmlBridgeRect {
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

function rectRelativeToViewport(
  rect: DOMRect,
  viewportRect: HtmlBridgeRect | undefined,
): HtmlBridgeRect {
  const originLeft = viewportRect?.left ?? 0;
  const originTop = viewportRect?.top ?? 0;
  return rectFromValues(
    rect.left - originLeft,
    rect.top - originTop,
    rect.width,
    rect.height,
  );
}

function viewportSnapshot(viewportElement: Element | null): HtmlBridgeViewport {
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

function resolveViewportElement(
  input: Element | string | null | undefined,
): Element | null {
  if (input === undefined || input === null) {
    return null;
  }
  if (typeof input === "string") {
    return document.querySelector(input);
  }
  return input;
}

function isVisible(element: Element, rect: HtmlBridgeRect): boolean {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  if (element instanceof HTMLElement && element.hidden) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function signatureOf(
  rect: HtmlBridgeRect,
  viewport: HtmlBridgeViewport,
  visible: boolean,
): SlotSignature {
  return { rect, viewport, visible };
}

function sameSignature(
  a: SlotSignature,
  b: SlotSignature,
  epsilonPx: number,
): boolean {
  return (
    a.visible === b.visible &&
    sameRect(a.rect, b.rect, epsilonPx) &&
    Math.abs(a.viewport.width - b.viewport.width) <= epsilonPx &&
    Math.abs(a.viewport.height - b.viewport.height) <= epsilonPx &&
    a.viewport.devicePixelRatio === b.viewport.devicePixelRatio &&
    Math.abs(a.viewport.scrollX - b.viewport.scrollX) <= epsilonPx &&
    Math.abs(a.viewport.scrollY - b.viewport.scrollY) <= epsilonPx
  );
}

function sameRect(a: HtmlBridgeRect, b: HtmlBridgeRect, epsilonPx: number) {
  return (
    Math.abs(a.x - b.x) <= epsilonPx &&
    Math.abs(a.y - b.y) <= epsilonPx &&
    Math.abs(a.width - b.width) <= epsilonPx &&
    Math.abs(a.height - b.height) <= epsilonPx &&
    Math.abs(a.top - b.top) <= epsilonPx &&
    Math.abs(a.right - b.right) <= epsilonPx &&
    Math.abs(a.bottom - b.bottom) <= epsilonPx &&
    Math.abs(a.left - b.left) <= epsilonPx
  );
}

function nowMilliseconds(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
