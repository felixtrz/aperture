import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Starter Kit FPS layout", () => {
  it("keeps the playable canvas free-resize without splash chrome", () => {
    const html = readFileSync("fps/index.html", "utf8");

    expect(html).toContain("width: 100vw;");
    expect(html).toContain("height: 100vh;");
    expect(html).toContain("width: 100%;");
    expect(html).toContain("height: 100%;");
    expect(html).not.toContain("aspect-ratio");
    expect(html).not.toContain("boot-splash");
    expect(html).not.toContain("splash-screen");
  });

  it("keeps the weapon compare panes free-resize instead of source-aspect boxed", () => {
    const source = readFileSync("fps/src/weapon-three-compare.ts", "utf8");

    expect(source).toContain("width:50vw;height:100vh");
    expect(source).not.toContain("calc(100vh * 16 / 9)");
    expect(source).not.toContain("calc(50vw * 9 / 16)");
  });
});
