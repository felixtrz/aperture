import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Starter Kit FPS layout", () => {
  it("keeps the playable canvas free-resize without splash chrome", () => {
    const html = readFileSync("showcase/fps/index.html", "utf8");

    expect(html).toContain("width: 100vw;");
    expect(html).toContain("height: 100vh;");
    expect(html).toContain("width: 100%;");
    expect(html).toContain("height: 100%;");
    expect(html).not.toContain("aspect-ratio");
    expect(html).not.toContain("boot-splash");
    expect(html).not.toContain("splash-screen");
  });
});
