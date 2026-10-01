import { afterEach, describe, expect, it, vi } from "vitest";
import type { SimulationWorker } from "@aperture-engine/runtime";
import type { ApertureConfig } from "../../packages/app/src/config.js";
import {
  APERTURE_GENERATED_COMMAND_MESSAGE,
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
} from "../../packages/app/src/commands.js";
import {
  installCanvasResizeSync,
  resolveCanvas,
} from "../../packages/app/src/browser/canvas.js";
import {
  APERTURE_GENERATED_STATUS_GLOBAL,
  installGeneratedStatus,
} from "../../packages/app/src/browser/status.js";

class FakeCanvas {
  clientWidth = 200;
  clientHeight = 100;
  displayWidth = 200;
  displayHeight = 100;
  private backingWidth = 300;
  private backingHeight = 150;
  get width() {
    return this.backingWidth;
  }
  set width(value: number) {
    this.backingWidth = value;
  }
  get height() {
    return this.backingHeight;
  }
  set height(value: number) {
    this.backingHeight = value;
  }
  getBoundingClientRect() {
    return { width: this.displayWidth, height: this.displayHeight };
  }
}

function setup(
  options: { rejectDevicePixelBox?: boolean; observer?: boolean } = {},
) {
  const canvas = new FakeCanvas();
  const windowTarget = Object.assign(new EventTarget(), {
    devicePixelRatio: 1.5,
  });
  const postMessage = vi.fn();
  const observations: { target: Element; options?: ResizeObserverOptions }[] =
    [];
  let observerCallback: ResizeObserverCallback | undefined;
  class FakeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      observerCallback = callback;
    }
    observe(target: Element, observeOptions?: ResizeObserverOptions) {
      observations.push({
        target,
        ...(observeOptions === undefined ? {} : { options: observeOptions }),
      });
      if (
        options.rejectDevicePixelBox &&
        observeOptions?.box === "device-pixel-content-box"
      ) {
        throw new Error("unsupported box option");
      }
    }
  }
  vi.stubGlobal("HTMLCanvasElement", FakeCanvas);
  vi.stubGlobal("window", windowTarget);
  vi.stubGlobal(APERTURE_GENERATED_STATUS_GLOBAL, undefined);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  if (options.observer === false)
    Reflect.deleteProperty(globalThis, "ResizeObserver");
  const status = installGeneratedStatus();
  return {
    canvas,
    element: canvas as unknown as HTMLCanvasElement,
    windowTarget,
    postMessage,
    observations,
    worker: { postMessage } as unknown as SimulationWorker,
    status,
    notify(entries: ResizeObserverEntry[] = []) {
      expect(observerCallback).toBeTypeOf("function");
      observerCallback?.(entries, {} as ResizeObserver);
    },
  };
}

function entry(
  target: HTMLCanvasElement,
  width: number,
  height: number,
): ResizeObserverEntry {
  return {
    target,
    devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
  } as unknown as ResizeObserverEntry;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generated browser canvas resolution", () => {
  it("resolves the exact configured canvas element", () => {
    const fixture = setup();
    const querySelector = vi.fn(() => fixture.canvas);
    vi.stubGlobal("document", { querySelector });

    expect(resolveCanvas({ mode: "browser", canvas: "canvas#game" })).toBe(
      fixture.canvas,
    );
    expect(querySelector).toHaveBeenCalledExactlyOnceWith("canvas#game");
  });

  it.each([
    [
      "non-browser mode",
      { mode: "headless" },
      "can only run configs with mode: 'browser'",
    ],
    ["missing selector", { mode: "browser" }, "missing canvas"],
  ])("rejects %s before querying the document", (_label, config, message) => {
    const querySelector = vi.fn();
    vi.stubGlobal("document", { querySelector });
    expect(() => resolveCanvas(config as ApertureConfig)).toThrow(message);
    expect(querySelector).not.toHaveBeenCalled();
  });

  it.each([null, { tagName: "DIV" }])(
    "rejects a selector result that is not a canvas: %j",
    (result) => {
      setup();
      vi.stubGlobal("document", { querySelector: vi.fn(() => result) });
      expect(() => resolveCanvas({ mode: "browser", canvas: "#game" })).toThrow(
        "Aperture canvas selector '#game' did not match a canvas element.",
      );
    },
  );
});

describe("generated browser canvas resize synchronization", () => {
  it("publishes initial dimensions and render settings before invoking afterResize", () => {
    const fixture = setup();
    const observed: unknown[] = [];
    const afterResize = vi.fn(() => {
      observed.push({
        width: fixture.canvas.width,
        height: fixture.canvas.height,
        status: fixture.status.canvas,
        posts: fixture.postMessage.mock.calls.length,
      });
    });
    installCanvasResizeSync(
      fixture.element,
      fixture.worker,
      fixture.status,
      {
        pixelRatio: 2,
        sampleCount: 1,
      },
      { afterResize, renderProfile: "mobile" },
    );

    expect(fixture.canvas.width).toBe(400);
    expect(fixture.canvas.height).toBe(200);
    expect(fixture.status.canvas).toEqual({
      width: 400,
      height: 200,
      displayWidth: 200,
      displayHeight: 100,
      pixelRatio: 2,
      aspect: 2,
      devicePixelRatio: 1.5,
      maxPixelRatio: 2,
      pixelRatioSource: "configured",
      resizeSource: "initial",
      measurementSource: "css-box",
    });
    expect(fixture.status.render).toMatchObject({
      requestedSampleCount: 1,
      sampleCountSource: "config",
      profile: "mobile",
      pixelRatio: 2,
    });
    expect(fixture.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: APERTURE_GENERATED_COMMAND_MESSAGE,
      command: {
        channel: APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
        payload: fixture.status.canvas,
      },
    });
    expect(observed).toEqual([
      { width: 400, height: 200, status: fixture.status.canvas, posts: 1 },
    ]);
    expect(fixture.observations).toEqual([
      { target: fixture.canvas, options: { box: "device-pixel-content-box" } },
    ]);
  });

  it("suppresses duplicate notifications while refreshing the measurement source", () => {
    const fixture = setup();
    const setWidth = vi.spyOn(fixture.canvas, "width", "set");
    const setHeight = vi.spyOn(fixture.canvas, "height", "set");
    const afterResize = vi.fn();
    installCanvasResizeSync(
      fixture.element,
      fixture.worker,
      fixture.status,
      undefined,
      { afterResize },
    );
    fixture.notify([entry(fixture.element, 300, 150)]);
    fixture.notify([entry(fixture.element, 300, 150)]);

    expect(fixture.postMessage).toHaveBeenCalledOnce();
    expect(afterResize).toHaveBeenCalledOnce();
    expect(fixture.status.canvas).toMatchObject({
      resizeSource: "resize-observer",
      measurementSource: "device-pixel-content-box",
    });
    expect(fixture.status.render?.profile).toBeNull();
    // Even reassigning the same canvas size resets its drawing state.
    expect(setWidth).not.toHaveBeenCalled();
    expect(setHeight).not.toHaveBeenCalled();
  });

  it("selects only this canvas's device-pixel entry and publishes changed size once", () => {
    const fixture = setup();
    const afterResize = vi.fn();
    installCanvasResizeSync(
      fixture.element,
      fixture.worker,
      fixture.status,
      undefined,
      { afterResize },
    );
    const other = new FakeCanvas() as unknown as HTMLCanvasElement;
    fixture.notify([entry(other, 999, 777), entry(fixture.element, 303, 153)]);
    fixture.notify([entry(fixture.element, 303, 153)]);

    expect(fixture.canvas.width).toBe(303);
    expect(fixture.canvas.height).toBe(153);
    expect(fixture.status.canvas).toMatchObject({
      displayWidth: 202,
      displayHeight: 102,
      measurementSource: "device-pixel-content-box",
    });
    expect(fixture.postMessage).toHaveBeenCalledTimes(2);
    expect(afterResize).toHaveBeenCalledTimes(2);
  });

  it("falls back to the CSS box when a notification does not contain the canvas", () => {
    const fixture = setup();
    installCanvasResizeSync(
      fixture.element,
      fixture.worker,
      fixture.status,
      undefined,
    );
    fixture.canvas.displayWidth = 240;
    fixture.notify([
      entry(new FakeCanvas() as unknown as HTMLCanvasElement, 800, 600),
    ]);

    expect(fixture.status.canvas).toMatchObject({
      width: 360,
      height: 150,
      displayWidth: 240,
      measurementSource: "css-box",
    });
    expect(fixture.postMessage).toHaveBeenCalledTimes(2);
  });

  it("retries observe without the device-pixel box when a browser rejects that option", () => {
    const fixture = setup({ rejectDevicePixelBox: true });
    installCanvasResizeSync(
      fixture.element,
      fixture.worker,
      fixture.status,
      undefined,
    );
    expect(fixture.observations).toEqual([
      { target: fixture.canvas, options: { box: "device-pixel-content-box" } },
      { target: fixture.canvas },
    ]);
    fixture.canvas.displayHeight = 120;
    fixture.notify();
    expect(fixture.canvas.height).toBe(180);
    expect(fixture.postMessage).toHaveBeenCalledTimes(2);
  });

  it("uses window resize when ResizeObserver is absent and tracks DPR changes", () => {
    const fixture = setup({ observer: false });
    const afterResize = vi.fn();
    installCanvasResizeSync(
      fixture.element,
      fixture.worker,
      fixture.status,
      undefined,
      { afterResize },
    );
    fixture.windowTarget.dispatchEvent(new Event("resize"));
    expect(fixture.postMessage).toHaveBeenCalledOnce();
    fixture.windowTarget.devicePixelRatio = 2;
    fixture.windowTarget.dispatchEvent(new Event("resize"));
    fixture.windowTarget.dispatchEvent(new Event("resize"));

    expect(fixture.observations).toEqual([]);
    expect(fixture.canvas.width).toBe(400);
    expect(fixture.canvas.height).toBe(200);
    expect(fixture.status.canvas).toMatchObject({
      pixelRatio: 2,
      resizeSource: "window-resize",
    });
    expect(fixture.postMessage).toHaveBeenCalledTimes(2);
    expect(afterResize).toHaveBeenCalledTimes(2);
  });

  it("publishes CSS geometry changes even when integer backing dimensions stay equal", () => {
    const fixture = setup();
    installCanvasResizeSync(fixture.element, fixture.worker, fixture.status, {
      pixelRatio: 1,
    });
    fixture.canvas.displayWidth = 200.25;
    fixture.canvas.displayHeight = 100.25;
    fixture.notify();

    expect(fixture.canvas.width).toBe(200);
    expect(fixture.canvas.height).toBe(100);
    expect(fixture.status.canvas).toMatchObject({
      displayWidth: 200.25,
      displayHeight: 100.25,
      aspect: 200.25 / 100.25,
    });
    expect(fixture.postMessage).toHaveBeenCalledTimes(2);
  });
});
