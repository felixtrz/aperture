import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createExtractionApp,
  withTransform,
  withUiHitTarget,
  withUiImage,
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

beforeEach(async () => {
  yoga = await loadLayoutModule();
});

let installed: InstalledUiLayout | null = null;
let app: ExtractionApp | null = null;

afterEach(() => {
  installed?.uninstall();
  installed = null;
  app = null;
});

function install(target: ExtractionApp): void {
  installed = installYogaUiLayout(target.world, yoga);
}

function nodesByEntity(snapshot: ReturnType<ExtractionApp["extract"]>) {
  const nodes = snapshot.uiNodes ?? [];
  return new Map(nodes.map((n) => [n.entity.index, n]));
}

describe("ECS Yoga extractor — wiring & seam", () => {
  it("takes over from the built-in extractor when installed", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 400, height: 240 }));
    app.spawn(
      withTransform({ parent: screen }),
      withUiNode({ x: 10, y: 20, width: 180, height: 100 }),
      withUiPanel({ color: [0.1, 0.2, 0.3, 0.9] }),
    );
    install(app);
    const snapshot = app.extract(7);
    const byEntity = nodesByEntity(snapshot);
    expect(snapshot.frame).toBe(7);
    // Screen child positioned absolutely by x/y (screen acts as an absolute
    // container, preserving the legacy semantics through the flex engine).
    const panel = [...byEntity.values()].find((n) => n.kind === "panel");
    expect(panel).toMatchObject({
      rect: { x: 10, y: 20, width: 180, height: 100 },
    });
    expect(byEntity.get(screen.index)).toMatchObject({
      kind: "screen",
      rect: { x: 0, y: 0, width: 400, height: 240 },
    });
  });
});

describe("ECS Yoga extractor — real flexbox", () => {
  it("includes entities authored only with the new UiFlex component", () => {
    app = createExtractionApp();
    const screen = app.spawn(
      withUiScreen({ width: 200, height: 100 }),
      withUiFlex({ flexDirection: "column" }),
    );
    const child = app.spawn(
      withTransform({ parent: screen }),
      withUiFlex({ alignSelf: "flex-start", minWidth: 50, minHeight: 20 }),
    );

    install(app);
    const byEntity = nodesByEntity(app.extract(0));
    expect(byEntity.get(child.index)).toMatchObject({
      kind: "node",
      rect: { x: 0, y: 0, width: 50, height: 20 },
    });
  });

  it("distributes a row with flexGrow via padding/gap", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 320, height: 100 }));
    // A row container filling a slice of the screen, with two children that
    // flow (no explicit x/y) separated by a gap — real flex flow, not the
    // legacy hand-rolled cursor.
    const row = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({
        x: 0,
        y: 0,
        width: 300,
        height: 40,
        layoutMode: "row",
        gap: 20,
        padding: [5, 10, 5, 10],
      }),
      withUiPanel(),
    );
    const a = app.spawn(
      withTransform({ parent: row }),
      withUiNode({ width: 100, height: 30 }),
      withUiPanel(),
    );
    const b = app.spawn(
      withTransform({ parent: row }),
      withUiNode({ width: 60, height: 30 }),
      withUiPanel(),
    );

    install(app);
    const byEntity = nodesByEntity(app.extract(0));
    // Content origin = padding left/top (10, 5). First child there; second
    // child after first width (100) + gap (20).
    expect(byEntity.get(a.index)?.rect).toMatchObject({ x: 10, y: 5 });
    expect(byEntity.get(b.index)?.rect).toMatchObject({ x: 130, y: 5 });
  });

  it("stacks a column and accumulates absolute offsets through nesting", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 200, height: 300 }));
    const col = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({
        x: 20,
        y: 30,
        width: 160,
        height: 200,
        layoutMode: "column",
        gap: 8,
        padding: [4, 4, 4, 4],
      }),
      withUiPanel(),
    );
    const first = app.spawn(
      withTransform({ parent: col }),
      withUiNode({ width: 140, height: 24 }),
      withUiPanel(),
    );
    const second = app.spawn(
      withTransform({ parent: col }),
      withUiNode({ width: 140, height: 24 }),
      withUiPanel(),
    );

    install(app);
    const byEntity = nodesByEntity(app.extract(0));
    // col origin (20,30) + padding (4,4) => content at (24,34).
    expect(byEntity.get(first.index)?.rect).toMatchObject({ x: 24, y: 34 });
    // second below first: 34 + 24 + gap 8 = 66.
    expect(byEntity.get(second.index)?.rect).toMatchObject({ x: 24, y: 66 });
  });
});

describe("ECS Yoga extractor — packet parity", () => {
  it("emits screen + node packets, hit regions, image handles, and stack order", () => {
    app = createExtractionApp();
    const texture = createTextureHandle("ui-icon");
    const sampler = createSamplerHandle("ui-linear");
    const screen = app.spawn(withUiScreen({ width: 400, height: 240 }));
    const panel = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({
        x: 10,
        y: 20,
        width: 180,
        height: 100,
        layoutMode: "column",
        clip: true,
      }),
      withUiPanel({ color: [0.1, 0.2, 0.3, 0.9] }),
      withUiHitTarget({ cursor: "pointer", priority: 4 }),
    );
    app.spawn(
      withTransform({ parent: panel }),
      withUiNode({ width: 40, height: 20 }),
      withUiImage({
        texture,
        sampler,
        color: [0.7, 0.8, 1, 1],
        uvRect: [0.25, 0.25, 0.5, 0.5],
      }),
    );

    install(app);
    const snapshot = app.extract(12);
    const nodes = snapshot.uiNodes ?? [];
    const hitRegions = snapshot.uiHitRegions ?? [];

    expect(snapshot.report.uiNodes).toBe(3);
    expect(snapshot.report.uiHitRegions).toBe(1);
    expect(nodes.map((n) => n.stackIndex)).toEqual([0, 1, 2]);

    const byEntity = nodesByEntity(snapshot);
    expect(byEntity.get(panel.index)).toMatchObject({
      kind: "panel",
      clipsChildren: true,
      color: [
        expect.closeTo(0.1),
        expect.closeTo(0.2),
        expect.closeTo(0.3),
        expect.closeTo(0.9),
      ],
    });
    const image = nodes.find((n) => n.kind === "image");
    expect(image).toMatchObject({
      texture,
      sampler,
      uvRect: [0.25, 0.25, 0.5, 0.5],
    });
    expect(hitRegions[0]).toMatchObject({ cursor: "pointer", priority: 4 });
  });

  it("composes opacity multiplicatively down the tree", () => {
    app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 100, height: 100 }));
    const parent = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({
        width: 100,
        height: 100,
        opacity: 0.5,
        layoutMode: "column",
      }),
      withUiPanel(),
    );
    const child = app.spawn(
      withTransform({ parent }),
      withUiNode({ width: 50, height: 50, opacity: 0.5 }),
      withUiPanel(),
    );

    install(app);
    const byEntity = nodesByEntity(app.extract(0));
    expect(byEntity.get(parent.index)?.opacity).toBeCloseTo(0.5);
    expect(byEntity.get(child.index)?.opacity).toBeCloseTo(0.25);
  });
});
