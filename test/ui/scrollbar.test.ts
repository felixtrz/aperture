import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createExtractionApp,
  withTransform,
  withUiNode,
  withUiPanel,
  withUiScreen,
  withUiScroll,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import {
  installYogaUiLayout,
  loadLayoutModule,
  withUiFlex,
  type InstalledUiLayout,
  type Yoga,
} from "@aperture-engine/ui";

let yoga: Yoga;
let app: ExtractionApp | null = null;
let installed: InstalledUiLayout | null = null;

beforeEach(async () => {
  yoga = await loadLayoutModule();
});

afterEach(() => {
  installed?.uninstall();
  installed = null;
  app = null;
});

function buildScroll(offsetY: number) {
  const target = createExtractionApp();
  const screen = target.spawn(withUiScreen({ width: 200, height: 200 }));
  const scroller = target.spawn(
    withTransform({ parent: screen }),
    withUiNode({ x: 0, y: 0, width: 100, height: 100, clip: true }),
    withUiFlex({ flexDirection: "column" }),
    withUiScroll({ enabled: true, offset: [0, offsetY] }),
    withUiPanel({ color: [0, 0, 0, 1] }),
  );
  for (let i = 0; i < 3; i += 1) {
    target.spawn(
      withTransform({ parent: scroller }),
      withUiNode({ height: 100 }),
      withUiFlex({}),
      withUiPanel({ color: [0.2, 0.2, 0.2, 1] }),
    );
  }
  return target;
}

function thumb(target: ExtractionApp) {
  const nodes = target.extract(0).uiNodes ?? [];
  // The synthesized thumb is the only panel 6px wide.
  return nodes.find((n) => n.kind === "panel" && n.rect.width === 6);
}

describe("rendered scrollbars", () => {
  it("emits a thumb sized to the content/viewport ratio", () => {
    app = buildScroll(0);
    installed = installYogaUiLayout(app.world, yoga);
    const t = thumb(app);
    expect(t).toBeTruthy();
    // viewport 100 / content 300 * track 100 ≈ 33.3.
    expect(t?.rect.height).toBeCloseTo(100 / 3, 0);
    // Pinned to the right inner edge: 100 - 6 - 2 = 92.
    expect(t?.rect.x).toBe(92);
    expect(t?.rect.y).toBe(0);
  });

  it("moves the thumb down as the content scrolls", () => {
    app = buildScroll(100);
    installed = installYogaUiLayout(app.world, yoga);
    const t = thumb(app);
    // progress 100/200 = 0.5; thumbY = 0.5 * (100 - 33.3) ≈ 33.3.
    expect(t?.rect.y).toBeCloseTo((100 - 100 / 3) * 0.5, 0);
  });

  it("omits the thumb when content fits the viewport", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const scroller = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 0, y: 0, width: 100, height: 100, clip: true }),
      withUiFlex({ flexDirection: "column" }),
      withUiScroll({ enabled: true, offset: [0, 0] }),
      withUiPanel(),
    );
    app.spawn(
      withTransform({ parent: scroller }),
      withUiNode({ height: 40 }),
      withUiFlex({}),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    expect(thumb(app)).toBeUndefined();
  });
});
