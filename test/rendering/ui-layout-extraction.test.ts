import { describe, expect, it } from "vitest";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import { UiScroll } from "@aperture-engine/render";
import {
  createExtractionApp,
  withTransform,
  withUiHitTarget,
  withUiImage,
  withUiNode,
  withUiPanel,
  withUiScreen,
  withUiScroll,
  withUiText,
} from "@aperture-engine/runtime";

describe("retained UI layout extraction", () => {
  it("derives screen-space nodes, clips, stack order, and hit regions from ECS parents", () => {
    const app = createExtractionApp();
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
        padding: [8, 8, 8, 8],
        gap: 4,
        layoutMode: "column",
        zIndex: 1,
        clip: true,
      }),
      withUiPanel({ color: [0.1, 0.2, 0.3, 0.9] }),
      withUiScroll({ offset: [0, 5] }),
      withUiHitTarget({ cursor: "pointer", priority: 4 }),
    );
    const label = app.spawn(
      withTransform({ parent: panel }),
      withUiNode({ height: 24 }),
      withUiText({
        text: "Hi",
        fontSize: 18,
        lineHeight: 22,
        maxWidth: 160,
        color: [1, 0.9, 0.7, 1],
      }),
    );
    const image = app.spawn(
      withTransform({ parent: panel }),
      withUiNode({ width: 40, height: 20 }),
      withUiImage({
        texture,
        sampler,
        color: [0.7, 0.8, 1, 1],
        uvRect: [0.25, 0.25, 0.5, 0.5],
      }),
    );
    const row = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({
        x: 210,
        y: 20,
        width: 120,
        height: 40,
        padding: [4, 4, 4, 4],
        gap: 3,
        layoutMode: "row",
        zIndex: 2,
      }),
      withUiPanel(),
    );
    const rowLeft = app.spawn(
      withTransform({ parent: row }),
      withUiNode(),
      withUiPanel(),
    );
    const rowRight = app.spawn(
      withTransform({ parent: row }),
      withUiNode(),
      withUiPanel(),
    );

    const snapshot = app.extract(12);
    const uiNodes = snapshot.uiNodes ?? [];
    const hitRegions = snapshot.uiHitRegions ?? [];
    const byEntity = new Map(uiNodes.map((node) => [node.entity.index, node]));

    expect(snapshot.frame).toBe(12);
    expect(snapshot.report.uiNodes).toBe(7);
    expect(snapshot.report.uiHitRegions).toBe(1);
    expect(uiNodes.map((node) => node.stackIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(byEntity.get(screen.index)).toMatchObject({
      kind: "screen",
      parentUiId: null,
      rect: { x: 0, y: 0, width: 400, height: 240 },
      clip: { x: 0, y: 0, width: 400, height: 240 },
    });
    expect(byEntity.get(panel.index)).toMatchObject({
      kind: "panel",
      parentUiId: byEntity.get(screen.index)?.uiId,
      rect: { x: 10, y: 20, width: 180, height: 100 },
      clip: { x: 10, y: 20, width: 180, height: 100 },
      clipsChildren: true,
      scrollOffset: [0, 5],
      color: [
        expect.closeTo(0.1),
        expect.closeTo(0.2),
        expect.closeTo(0.3),
        expect.closeTo(0.9),
      ],
    });
    expect(byEntity.get(label.index)).toMatchObject({
      kind: "text",
      parentUiId: byEntity.get(panel.index)?.uiId,
      rect: { x: 18, y: 23, width: 164, height: 24 },
      clip: { x: 18, y: 23, width: 164, height: 24 },
      text: "Hi",
      fontSize: 18,
      lineHeight: 22,
      maxWidth: 160,
      glyphCount: 2,
    });
    expect(byEntity.get(image.index)).toMatchObject({
      kind: "image",
      parentUiId: byEntity.get(panel.index)?.uiId,
      rect: { x: 18, y: 51, width: 40, height: 20 },
      texture,
      sampler,
      uvRect: [0.25, 0.25, 0.5, 0.5],
    });
    expect(byEntity.get(row.index)).toMatchObject({
      kind: "panel",
      layoutMode: "row",
      rect: { x: 210, y: 20, width: 120, height: 40 },
    });
    expect(byEntity.get(rowLeft.index)).toMatchObject({
      rect: { x: 214, y: 24, width: 32, height: 32 },
    });
    expect(byEntity.get(rowRight.index)).toMatchObject({
      rect: { x: 249, y: 24, width: 32, height: 32 },
    });
    expect(hitRegions).toEqual([
      expect.objectContaining({
        uiId: byEntity.get(panel.index)?.uiId,
        rect: { x: 10, y: 20, width: 180, height: 100 },
        clip: { x: 10, y: 20, width: 180, height: 100 },
        stackIndex: byEntity.get(panel.index)?.stackIndex,
        blocksInput: true,
        cursor: "pointer",
        priority: 4,
      }),
    ]);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("shifts child layout by a runtime-mutated UiScroll offset (renderer consumes live ECS scroll state)", () => {
    const app = createExtractionApp();
    const screen = app.spawn(withUiScreen({ width: 400, height: 240 }));
    const panel = app.spawn(
      withTransform({ parent: screen }),
      withUiNode({
        x: 10,
        y: 20,
        width: 180,
        height: 100,
        layoutMode: "column",
      }),
      withUiPanel(),
      // Authored at rest: enabled with a zero offset.
      withUiScroll(),
    );
    const item = app.spawn(
      withTransform({ parent: panel }),
      withUiNode({ height: 40 }),
      withUiPanel(),
    );

    const before = app.extract(1);
    const beforeByEntity = new Map(
      (before.uiNodes ?? []).map((node) => [node.entity.index, node]),
    );

    expect(beforeByEntity.get(panel.index)).toMatchObject({
      scrollOffset: [0, 0],
      clipsChildren: true,
    });
    expect(beforeByEntity.get(item.index)).toMatchObject({
      rect: { x: 10, y: 20, width: 180, height: 40 },
    });

    // A worker-side system (AI-47 wheel/drag mapping) mutates the live ECS
    // component to a non-authored runtime value.
    panel.getVectorView(UiScroll, "offset").set([7, 33]);

    const after = app.extract(2);
    const afterByEntity = new Map(
      (after.uiNodes ?? []).map((node) => [node.entity.index, node]),
    );

    expect(afterByEntity.get(panel.index)).toMatchObject({
      scrollOffset: [7, 33],
      rect: { x: 10, y: 20, width: 180, height: 100 },
    });
    // The child layout shifts by exactly the mutated offset and stays clipped
    // to the scroll node's rect.
    expect(afterByEntity.get(item.index)).toMatchObject({
      rect: { x: 3, y: -13, width: 180, height: 40 },
      clip: { x: 10, y: 20, width: 173, height: 7 },
    });
    expect(after.diagnostics).toEqual([]);
  });
});
