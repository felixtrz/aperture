import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createExtractionApp,
  withTransform,
  withUiNode,
  withUiPanel,
  withUiScreen,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import {
  installYogaUiLayout,
  loadLayoutModule,
  withUiBox,
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

function nodeByEntity(target: ExtractionApp, index: number) {
  const nodes = target.extract(0).uiNodes ?? [];
  return nodes.find((n) => n.entity.index === index);
}

describe("UiBox — border & radius packets", () => {
  it("emits per-corner radius and per-side border with color", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const panel = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 10, y: 10, width: 120, height: 60 }),
      withUiPanel({ color: [0.1, 0.1, 0.1, 1] }),
      withUiBox({
        borderRadius: [8, 8, 4, 4],
        borderWidth: 2,
        borderColor: [1, 0, 0, 1],
      }),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const node = nodeByEntity(app, panel.index);
    expect(node?.cornerRadii).toEqual([8, 8, 4, 4]);
    expect(node?.borderWidths).toEqual([2, 2, 2, 2]);
    expect(node?.borderColor).toEqual([1, 0, 0, 1]);
  });

  it("omits border fields when there is no border or radius", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const panel = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 0, y: 0, width: 50, height: 50 }),
      withUiPanel(),
      withUiBox({ borderRadius: 0, borderWidth: 0 }),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const node = nodeByEntity(app, panel.index);
    expect(node?.cornerRadii).toBeUndefined();
    expect(node?.borderWidths).toBeUndefined();
    expect(node?.borderColor).toBeUndefined();
  });

  it("insets children by the border width", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 0, y: 0, width: 120, height: 120 }),
      withUiFlex({ flexDirection: "column" }),
      withUiBox({ borderWidth: 6 }),
      withUiPanel(),
    );
    const child = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ width: 40, height: 20 }),
      withUiFlex({ alignSelf: "flex-start" }),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    // Border insets content, so the child starts at (6, 6).
    expect(nodeByEntity(app, child.index)?.rect).toMatchObject({ x: 6, y: 6 });
  });
});
