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

function rectsByEntity(target: ExtractionApp) {
  const snapshot = target.extract(0);
  const nodes = snapshot.uiNodes ?? [];
  return new Map(nodes.map((n) => [n.entity.index, n.rect]));
}

function row(width: number, flex: Parameters<typeof withUiFlex>[0]) {
  return [
    withUiNode({ x: 0, y: 0, width, height: 40 }),
    withUiFlex({ flexDirection: "row", ...flex }),
    withUiPanel(),
  ] as const;
}

describe("UiFlex authoring — distribution", () => {
  it("distributes a row with flexGrow", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 320, height: 100 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      ...row(300, {}),
    );
    const a = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ height: 30 }),
      withUiFlex({ flexGrow: 1 }),
      withUiPanel(),
    );
    const b = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ height: 30 }),
      withUiFlex({ flexGrow: 3 }),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const rects = rectsByEntity(app);
    expect(rects.get(a.index)).toMatchObject({ x: 0, width: 75 });
    expect(rects.get(b.index)).toMatchObject({ x: 75, width: 225 });
  });

  it("centers content with justifyContent + alignItems", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 320, height: 100 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      ...row(300, { justifyContent: "center", alignItems: "center" }),
    );
    const child = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ width: 100, height: 20 }),
      withUiFlex({}),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const rects = rectsByEntity(app);
    expect(rects.get(child.index)).toMatchObject({ x: 100, y: 10 });
  });

  it("space-between pushes children to the edges", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 320, height: 100 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      ...row(300, { justifyContent: "space-between" }),
    );
    const a = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ width: 40, height: 20 }),
      withUiFlex({}),
      withUiPanel(),
    );
    const b = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ width: 40, height: 20 }),
      withUiFlex({}),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const rects = rectsByEntity(app);
    expect(rects.get(a.index)?.x).toBe(0);
    expect(rects.get(b.index)?.x).toBe(260);
  });
});

describe("UiFlex authoring — constraints", () => {
  it("applies aspectRatio", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 320, height: 200 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      ...row(300, {}),
    );
    const child = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ width: 120 }),
      withUiFlex({ aspectRatio: 2, alignSelf: "flex-start" }),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const rects = rectsByEntity(app);
    expect(rects.get(child.index)).toMatchObject({ width: 120, height: 60 });
  });

  it("clamps percentage width with maxWidth", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 320, height: 200 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 0, y: 0, width: 300, height: 100 }),
      withUiFlex({ flexDirection: "column" }),
      withUiPanel(),
    );
    const child = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ height: 20 }),
      withUiFlex({ widthPercent: 100, maxWidth: 150, alignSelf: "flex-start" }),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const rects = rectsByEntity(app);
    expect(rects.get(child.index)?.width).toBe(150);
  });

  it("offsets a child by margin", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 200 }));
    const container = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 0, y: 0, width: 200, height: 200 }),
      withUiFlex({ flexDirection: "column" }),
      withUiPanel(),
    );
    const child = app.spawn(
      withTransform({ parent: container }),
      withUiNode({ width: 50, height: 20 }),
      withUiFlex({ margin: [12, 0, 0, 8], alignSelf: "flex-start" }),
      withUiPanel(),
    );
    installed = installYogaUiLayout(app.world, yoga);
    const rects = rectsByEntity(app);
    expect(rects.get(child.index)).toMatchObject({ x: 8, y: 12 });
  });
});
