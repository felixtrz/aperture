import { afterEach, describe, expect, it, vi } from "vitest";
import { APERTURE_GENERATED_COMMAND_EVENT } from "../../packages/app/src/commands.js";
import {
  dispatchApertureHtmlEvent,
  observeApertureHtmlSlots,
  type ApertureHtmlSlotObserver,
} from "../../packages/app/src/browser/html-bridge.js";
import {
  APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
  type HtmlBridgeCommand,
} from "../../packages/app/src/systems/html-bridge.js";

function rect(left = 10, top = 20, width = 100, height = 50): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return { left, top, width, height };
    },
  };
}

class FakeNode {
  elements: FakeElement[] = [];
  querySelectorAll = vi.fn((_selector: string) => this.elements);
}

class FakeElement extends FakeNode {
  bounds = rect();
  display = "block";
  visibility = "visible";
  constructor(public slot: string | null = "panel") {
    super();
  }
  getAttribute(name: string) {
    return name === "data-aperture-slot" ? this.slot : null;
  }
  getBoundingClientRect() {
    return this.bounds;
  }
}

class FakeHtmlElement extends FakeElement {
  hidden = false;
  tagName = "DIV";
  children: FakeElement[] = [];
  getAttributeNames() {
    return this.slot === null ? [] : ["data-aperture-slot"];
  }
}

const activeObservers: ApertureHtmlSlotObserver[] = [];

function setup(
  options: { observers?: boolean; visualViewport?: boolean } = {},
) {
  const documentNode = Object.assign(new FakeNode(), {
    querySelector: vi.fn((_selector: string): FakeElement | null => null),
  });
  const visualViewport = Object.assign(new EventTarget(), {
    width: 640,
    height: 360,
  });
  const windowTarget = Object.assign(new EventTarget(), {
    devicePixelRatio: 2,
    innerWidth: 800,
    innerHeight: 450,
    scrollX: 5,
    scrollY: 15,
    visualViewport: options.visualViewport === false ? null : visualViewport,
    getComputedStyle: vi.fn((element: FakeElement) => ({
      display: element.display,
      visibility: element.visibility,
    })),
  });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  const cancelFrame = vi.fn((id: number) => {
    frames.delete(id);
  });
  const resizeObservers: FakeResizeObserver[] = [];
  const mutationObservers: FakeMutationObserver[] = [];
  class FakeResizeObserver {
    observed = new Set<FakeElement>();
    observe = vi.fn((element: FakeElement) => {
      this.observed.add(element);
    });
    disconnect = vi.fn(() => {
      this.observed.clear();
    });
    constructor(readonly callback: () => void) {
      resizeObservers.push(this);
    }
  }
  class FakeMutationObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(readonly callback: () => void) {
      mutationObservers.push(this);
    }
  }
  vi.stubGlobal("Node", FakeNode);
  vi.stubGlobal("HTMLElement", FakeHtmlElement);
  vi.stubGlobal("document", documentNode);
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  vi.stubGlobal(
    "ResizeObserver",
    options.observers === false ? undefined : FakeResizeObserver,
  );
  vi.stubGlobal(
    "MutationObserver",
    options.observers === false ? undefined : FakeMutationObserver,
  );
  const commands: HtmlBridgeCommand[] = [];
  windowTarget.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, (event) => {
    const detail = (
      event as CustomEvent<{ channel: string; payload: HtmlBridgeCommand }>
    ).detail;
    expect(detail.channel).toBe(APERTURE_HTML_BRIDGE_COMMAND_CHANNEL);
    commands.push(detail.payload);
  });
  return {
    documentNode,
    windowTarget,
    visualViewport,
    frames,
    requestFrame,
    cancelFrame,
    resizeObservers,
    mutationObservers,
    commands,
    observe(options: Parameters<typeof observeApertureHtmlSlots>[0] = {}) {
      const observer = observeApertureHtmlSlots(options);
      activeObservers.push(observer);
      return observer;
    },
    runFrame() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(100);
    },
  };
}

afterEach(() => {
  for (const observer of activeObservers.splice(0)) observer.disconnect();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HTML bridge event dispatch", () => {
  it("dispatches to window by default and omits an absent payload", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const receive = vi.fn();
    target.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, receive);

    dispatchApertureHtmlEvent("game.resume");

    expect(receive).toHaveBeenCalledOnce();
    expect((receive.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      channel: "game.resume",
    });
  });

  it("preserves a payload on a supplied target without also broadcasting on window", () => {
    const windowTarget = new EventTarget();
    const suppliedTarget = new EventTarget();
    vi.stubGlobal("window", windowTarget);
    const receiveWindow = vi.fn();
    const receive = vi.fn();
    windowTarget.addEventListener(
      APERTURE_GENERATED_COMMAND_EVENT,
      receiveWindow,
    );
    suppliedTarget.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, receive);
    const payload = { selected: "ship" };

    dispatchApertureHtmlEvent("selection", payload, suppliedTarget);
    dispatchApertureHtmlEvent("selection", null, suppliedTarget);

    expect(receiveWindow).not.toHaveBeenCalled();
    expect((receive.mock.calls[0]?.[0] as CustomEvent).detail.payload).toBe(
      payload,
    );
    expect((receive.mock.calls[1]?.[0] as CustomEvent).detail).toEqual({
      channel: "selection",
      payload: null,
    });
  });
});

describe("HTML slot observations", () => {
  it("emits initial trimmed names and viewport-relative geometry from a custom scope", () => {
    const fixture = setup();
    vi.spyOn(performance, "now").mockReturnValue(123);
    const slot = new FakeHtmlElement("  toolbar  ");
    slot.bounds = rect(45, 70, 120, 40);
    const scope = new FakeNode();
    scope.elements = [
      new FakeHtmlElement(null),
      new FakeHtmlElement(" \t "),
      slot,
    ];
    const viewport = new FakeElement();
    viewport.bounds = rect(25, 50, 500, 300);
    fixture.documentNode.querySelector.mockReturnValue(viewport);
    const target = new EventTarget();
    const received: unknown[] = [];
    target.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, (event) => {
      received.push((event as CustomEvent).detail);
    });

    fixture.observe({
      scope: scope as unknown as ParentNode,
      selector: ".hud-slot",
      viewportElement: "#viewport",
      eventTarget: target,
    });

    expect(fixture.documentNode.querySelector).toHaveBeenCalledWith(
      "#viewport",
    );
    expect(scope.querySelectorAll).toHaveBeenCalledWith(".hud-slot");
    expect(received).toEqual([
      {
        channel: APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
        payload: {
          kind: "slot",
          slot: "toolbar",
          visible: true,
          sequence: 1,
          time: 123,
          reason: "initial",
          rect: {
            x: 20,
            y: 20,
            left: 20,
            top: 20,
            width: 120,
            height: 40,
            right: 140,
            bottom: 60,
          },
          viewport: {
            width: 500,
            height: 300,
            devicePixelRatio: 2,
            scrollX: 5,
            scrollY: 15,
            rect: {
              x: 25,
              y: 50,
              left: 25,
              top: 50,
              width: 500,
              height: 300,
              right: 525,
              bottom: 350,
            },
          },
        },
      },
    ]);
    expect(fixture.commands).toEqual([]);
    expect(fixture.resizeObservers[0]?.observed).toEqual(
      new Set(scope.elements),
    );
    expect(
      fixture.mutationObservers[0]?.observe,
    ).toHaveBeenCalledExactlyOnceWith(scope, {
      attributes: true,
      attributeFilter: ["data-aperture-slot", "class", "style", "hidden"],
      childList: true,
      subtree: true,
    });
  });

  it("uses visual viewport metrics by default and suppresses identical manual flushes", () => {
    const fixture = setup();
    fixture.documentNode.elements = [new FakeHtmlElement()];
    const observer = fixture.observe();
    observer.flush();
    observer.flush("same-layout");

    expect(fixture.commands).toHaveLength(1);
    expect(fixture.commands[0]).toMatchObject({
      rect: { x: 10, y: 20 },
      viewport: {
        width: 640,
        height: 360,
        devicePixelRatio: 2,
        scrollX: 5,
        scrollY: 15,
      },
    });
    expect(fixture.documentNode.querySelectorAll).toHaveBeenCalledWith(
      "[data-aperture-slot]",
    );
  });

  it("works without browser observers, visualViewport, or performance", () => {
    const fixture = setup({ observers: false, visualViewport: false });
    vi.stubGlobal("performance", undefined);
    vi.spyOn(Date, "now").mockReturnValue(456);
    const slot = new FakeHtmlElement();
    fixture.documentNode.elements = [slot];
    const observer = fixture.observe({ viewportElement: "#missing" });
    expect(fixture.commands[0]).toMatchObject({
      time: 456,
      viewport: { width: 800, height: 450 },
    });
    expect(fixture.resizeObservers).toEqual([]);
    expect(fixture.mutationObservers).toEqual([]);

    slot.bounds = rect(15);
    fixture.windowTarget.dispatchEvent(new Event("scroll"));
    fixture.runFrame();
    expect(fixture.commands[1]).toMatchObject({
      reason: "scroll",
      rect: { x: 15 },
    });
    observer.disconnect();
  });

  it.each(["x", "y", "width", "height"] as const)(
    "suppresses epsilon-sized %s changes but compares larger changes to the last published rect",
    (dimension) => {
      const fixture = setup();
      const slot = new FakeHtmlElement();
      fixture.documentNode.elements = [slot];
      const observer = fixture.observe();
      const values = { x: 10, y: 20, width: 100, height: 50 };
      values[dimension] += 0.5;
      slot.bounds = rect(values.x, values.y, values.width, values.height);
      observer.flush();
      expect(fixture.commands).toHaveLength(1);
      values[dimension] += 0.01;
      slot.bounds = rect(values.x, values.y, values.width, values.height);
      observer.flush();
      expect(fixture.commands).toHaveLength(2);
      expect(fixture.commands[1]).toMatchObject({
        sequence: 2,
        reason: "manual",
        rect: { [dimension]: values[dimension] },
      });
    },
  );

  it("clamps a negative epsilon to zero", () => {
    const fixture = setup();
    const slot = new FakeHtmlElement();
    fixture.documentNode.elements = [slot];
    const observer = fixture.observe({ epsilonPx: -10, viewportElement: null });
    slot.bounds = rect(10.001);
    observer.flush("precise");
    expect(fixture.commands).toHaveLength(2);
    expect(fixture.commands[1]).toMatchObject({
      reason: "precise",
      rect: { x: 10.001 },
    });
  });

  it.each([
    "width",
    "height",
    "devicePixelRatio",
    "scrollX",
    "scrollY",
  ] as const)(
    "publishes changes in viewport %s even when slot geometry is unchanged",
    (property) => {
      const fixture = setup();
      fixture.documentNode.elements = [new FakeHtmlElement()];
      const observer = fixture.observe();
      if (property === "width" || property === "height")
        fixture.visualViewport[property] += 1;
      else fixture.windowTarget[property] += 1;
      observer.flush();
      expect(fixture.commands).toHaveLength(2);
      const expected =
        property === "width" || property === "height"
          ? fixture.visualViewport[property]
          : fixture.windowTarget[property];
      expect(fixture.commands[1]).toMatchObject({
        viewport: { [property]: expected },
      });
    },
  );

  it.each([
    [
      "zero width",
      (slot: FakeHtmlElement) => {
        slot.bounds = rect(10, 20, 0, 50);
      },
    ],
    [
      "negative height",
      (slot: FakeHtmlElement) => {
        slot.bounds = rect(10, 20, 100, -1);
      },
    ],
    [
      "hidden attribute",
      (slot: FakeHtmlElement) => {
        slot.hidden = true;
      },
    ],
    [
      "display none",
      (slot: FakeHtmlElement) => {
        slot.display = "none";
      },
    ],
    [
      "visibility hidden",
      (slot: FakeHtmlElement) => {
        slot.visibility = "hidden";
      },
    ],
  ] as const)(
    "reports %s as invisible, then detects restored visibility",
    (_label, hide) => {
      const fixture = setup();
      const slot = new FakeHtmlElement();
      hide(slot);
      fixture.documentNode.elements = [slot];
      const observer = fixture.observe();
      expect(fixture.commands[0]).toMatchObject({ visible: false });
      slot.bounds = rect();
      slot.hidden = false;
      slot.display = "block";
      slot.visibility = "visible";
      observer.flush();
      expect(fixture.commands).toHaveLength(2);
      expect(fixture.commands[1]).toMatchObject({ visible: true, sequence: 2 });
    },
  );

  it("supports non-HTML elements and a directly supplied viewport element", () => {
    const fixture = setup();
    const slot = new FakeElement("svg-overlay");
    fixture.documentNode.elements = [slot];
    const viewport = new FakeElement();
    viewport.bounds = rect(5, 10, 200, 100);
    fixture.observe({ viewportElement: viewport as unknown as Element });
    expect(fixture.documentNode.querySelector).not.toHaveBeenCalled();
    expect(fixture.commands[0]).toMatchObject({
      slot: "svg-overlay",
      visible: true,
      rect: { x: 5, y: 10 },
      viewport: { width: 200, height: 100 },
    });
  });

  it("coalesces resize and scroll sources until the next animation frame", () => {
    const fixture = setup();
    const slot = new FakeHtmlElement();
    fixture.documentNode.elements = [slot];
    fixture.observe();
    slot.bounds = rect(11);
    fixture.windowTarget.dispatchEvent(new Event("resize"));
    fixture.windowTarget.dispatchEvent(new Event("scroll"));
    fixture.visualViewport.dispatchEvent(new Event("resize"));
    fixture.visualViewport.dispatchEvent(new Event("scroll"));
    fixture.resizeObservers[0]?.callback();
    expect(fixture.requestFrame).toHaveBeenCalledOnce();
    expect(fixture.commands).toHaveLength(1);
    fixture.runFrame();
    expect(fixture.commands[1]).toMatchObject({
      reason: "viewport-resize",
      rect: { x: 11 },
    });

    slot.bounds = rect(12);
    fixture.resizeObservers[0]?.callback();
    fixture.runFrame();
    expect(fixture.commands[2]).toMatchObject({
      reason: "resize-observer",
      rect: { x: 12 },
    });
  });

  it("refreshes observed elements and emits ordered removal and re-addition commands", () => {
    const fixture = setup();
    const first = new FakeHtmlElement("first");
    const second = new FakeHtmlElement("second");
    fixture.documentNode.elements = [first];
    fixture.observe();
    fixture.documentNode.elements = [second];
    fixture.mutationObservers[0]?.callback();
    expect(fixture.resizeObservers[0]?.observed).toEqual(new Set([second]));
    fixture.runFrame();
    fixture.documentNode.elements = [];
    fixture.mutationObservers[0]?.callback();
    fixture.runFrame();
    fixture.documentNode.elements = [first];
    fixture.mutationObservers[0]?.callback();
    fixture.runFrame();

    expect(
      fixture.commands.map(({ kind, slot, sequence, reason }) => ({
        kind,
        slot,
        sequence,
        reason,
      })),
    ).toEqual([
      { kind: "slot", slot: "first", sequence: 1, reason: "initial" },
      {
        kind: "slot",
        slot: "second",
        sequence: 2,
        reason: "mutation-observer",
      },
      {
        kind: "remove-slot",
        slot: "first",
        sequence: 3,
        reason: "mutation-observer",
      },
      {
        kind: "remove-slot",
        slot: "second",
        sequence: 4,
        reason: "mutation-observer",
      },
      { kind: "slot", slot: "first", sequence: 5, reason: "mutation-observer" },
    ]);
  });

  it("can disable mutation observation and still remove renamed or blanked slots on manual flush", () => {
    const fixture = setup();
    const slot = new FakeHtmlElement("old");
    fixture.documentNode.elements = [slot];
    const observer = fixture.observe({ observeMutations: false });
    expect(fixture.mutationObservers).toEqual([]);
    slot.slot = "new";
    observer.flush("rename");
    slot.slot = " ";
    observer.flush("blank");
    observer.flush();
    expect(fixture.commands.map(({ kind, slot }) => ({ kind, slot }))).toEqual([
      { kind: "slot", slot: "old" },
      { kind: "slot", slot: "new" },
      { kind: "remove-slot", slot: "old" },
      { kind: "remove-slot", slot: "new" },
    ]);
  });

  it("does not attach a mutation observer to a query-only scope that is not a Node", () => {
    const fixture = setup();
    const scope = { querySelectorAll: () => [new FakeHtmlElement()] };
    fixture.observe({ scope: scope as unknown as ParentNode });
    expect(fixture.commands).toHaveLength(1);
    expect(fixture.mutationObservers[0]?.observe).not.toHaveBeenCalled();
  });

  it("cancels pending work, detaches listeners, and ignores late callbacks after repeated disconnect", () => {
    const fixture = setup();
    const slot = new FakeHtmlElement();
    fixture.documentNode.elements = [slot];
    const removeWindow = vi.spyOn(fixture.windowTarget, "removeEventListener");
    const removeVisual = vi.spyOn(
      fixture.visualViewport,
      "removeEventListener",
    );
    const observer = fixture.observe();
    slot.bounds = rect(50);
    fixture.windowTarget.dispatchEvent(new Event("resize"));
    const queued = [...fixture.frames.values()][0];
    observer.disconnect();
    observer.disconnect();
    expect(fixture.cancelFrame).toHaveBeenCalledExactlyOnceWith(1);
    expect(fixture.frames.size).toBe(0);
    expect(fixture.resizeObservers[0]?.observed.size).toBe(0);
    expect(fixture.mutationObservers[0]?.disconnect).toHaveBeenCalledTimes(2);
    expect(removeWindow).toHaveBeenCalledWith("scroll", expect.any(Function), {
      capture: true,
    });
    expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeVisual).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeVisual).toHaveBeenCalledWith("resize", expect.any(Function));

    fixture.requestFrame.mockClear();
    observer.flush();
    queued?.(200);
    fixture.resizeObservers[0]?.callback();
    fixture.windowTarget.dispatchEvent(new Event("resize"));
    fixture.windowTarget.dispatchEvent(new Event("scroll"));
    fixture.visualViewport.dispatchEvent(new Event("resize"));
    fixture.visualViewport.dispatchEvent(new Event("scroll"));
    expect(fixture.requestFrame).not.toHaveBeenCalled();
    expect(fixture.commands).toHaveLength(1);
  });
});
