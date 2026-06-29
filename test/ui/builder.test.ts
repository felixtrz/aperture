import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createExtractionApp,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import {
  installYogaUiLayout,
  loadLayoutModule,
  mountUi,
  ui,
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

describe("declarative builder", () => {
  it("composes, mounts, and lays out a flex tree", () => {
    app = createExtractionApp();
    const tree = ui.screen({ width: 300, height: 200, padding: 10, gap: 5 }, [
      ui.row({ height: 40, gap: 8 }, [
        ui.box({ width: 50, height: 30, backgroundColor: [1, 0, 0, 1] }),
        ui.box({
          width: 50,
          height: 30,
          backgroundColor: [0, 1, 0, 1],
          borderRadius: 4,
          borderWidth: 2,
          borderColor: [0, 0, 0, 1],
        }),
      ]),
      ui.text("Hello", { fontSize: 16, height: 20 }),
      ui.button(
        { width: 80, height: 24, backgroundColor: [0.2, 0.2, 0.2, 1] },
        [ui.text("OK")],
      ),
    ]);
    mountUi(app, tree);
    installed = installYogaUiLayout(app.world, yoga);

    const snapshot = app.extract(0);
    const nodes = snapshot.uiNodes ?? [];
    const hitRegions = snapshot.uiHitRegions ?? [];

    const screen = nodes.find((n) => n.kind === "screen");
    expect(screen?.rect).toMatchObject({ width: 300, height: 200 });

    const red = nodes.find(
      (n) => n.kind === "panel" && n.color?.[0] === 1 && n.color?.[1] === 0,
    );
    // padding (10,10); first row child at the row content origin.
    expect(red?.rect).toMatchObject({ x: 10, y: 10, width: 50, height: 30 });

    const rounded = nodes.find((n) => n.cornerRadii !== undefined);
    expect(rounded?.cornerRadii).toEqual([4, 4, 4, 4]);
    expect(rounded?.borderWidths).toEqual([2, 2, 2, 2]);
    // second child: after first (50) + gap (8).
    expect(rounded?.rect).toMatchObject({ x: 68, y: 10 });

    expect(nodes.find((n) => n.text === "Hello")?.kind).toBe("text");
    expect(nodes.find((n) => n.text === "OK")).toBeTruthy();
    expect(hitRegions.some((h) => h.cursor === "pointer")).toBe(true);
  });

  it("wires parent-child hierarchy", () => {
    app = createExtractionApp();
    const tree = ui.screen({ width: 100, height: 100 }, [
      ui.column({ width: 100, height: 100 }, [
        ui.box({ width: 20, height: 20 }),
      ]),
    ]);
    mountUi(app, tree);
    installed = installYogaUiLayout(app.world, yoga);

    const nodes = app.extract(0).uiNodes ?? [];
    const screen = nodes.find((n) => n.kind === "screen");
    const leaf = nodes.find((n) => n.rect.width === 20);
    const container = nodes.find((n) => n.uiId === leaf?.parentUiId);
    expect(container?.parentUiId).toBe(screen?.uiId);
  });
});
