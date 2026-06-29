import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createExtractionApp,
  withTransform,
  withUiNode,
  withUiScreen,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import {
  installYogaUiLayout,
  loadLayoutModule,
  withUiFlex,
  withUiInput,
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

function spawnInput(input: Parameters<typeof withUiInput>[0]) {
  app = createExtractionApp();
  const screen = app.spawn(withUiScreen({ width: 300, height: 100 }));
  app.spawn(
    withTransform({ parent: screen }),
    withUiNode({ x: 10, y: 10, width: 200, height: 30, padding: [4, 4, 4, 4] }),
    withUiFlex({}),
    withUiInput(input),
  );
  installed = installYogaUiLayout(app.world, yoga);
  return app.extract(0).uiNodes ?? [];
}

describe("UiInput rendering", () => {
  it("renders the value as text", () => {
    const nodes = spawnInput({ value: "hi" });
    const textNode = nodes.find((n) => n.kind === "text");
    expect(textNode?.text).toBe("hi");
  });

  it("masks a password value", () => {
    const nodes = spawnInput({ value: "secret", type: "password" });
    const textNode = nodes.find((n) => n.kind === "text");
    expect(textNode?.text).toBe("••••••");
  });

  it("shows the placeholder when empty", () => {
    const nodes = spawnInput({ value: "", placeholder: "Name" });
    const textNode = nodes.find((n) => n.kind === "text");
    expect(textNode?.text).toBe("Name");
  });

  it("emits a caret panel when focused", () => {
    const nodes = spawnInput({ value: "hi", focused: true, caret: 2 });
    const caret = nodes.find((n) => n.kind === "panel" && n.rect.width === 2);
    expect(caret).toBeTruthy();
    // content left = 10 + padding 4 = 14; caret at index 2, charWidth 8 → +16.
    expect(caret?.rect.x).toBe(30);
    expect(caret?.rect.height).toBe(16);
  });

  it("emits no caret when not focused", () => {
    const nodes = spawnInput({ value: "hi", focused: false });
    expect(
      nodes.find((n) => n.kind === "panel" && n.rect.width === 2),
    ).toBeUndefined();
  });

  it("emits a selection highlight", () => {
    const nodes = spawnInput({
      value: "hello",
      focused: true,
      caret: 1,
      anchor: 4,
    });
    const highlight = nodes.find(
      (n) => n.kind === "panel" && n.rect.width === 24,
    );
    expect(highlight).toBeTruthy();
    // selection from index 1 (x=8) → content left 14 + 8 = 22.
    expect(highlight?.rect.x).toBe(22);
  });
});
