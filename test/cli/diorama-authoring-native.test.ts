import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { createApertureProject } from "@aperture-engine/cli";
import { preflightApertureSnapshotBundle } from "../../packages/cli/src/headless/bundle.js";

it("extracts the diorama starter through Node exports and attributes malformed authored geometry", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "aperture-diorama-"));
  const root = path.resolve(import.meta.dirname, "../..");
  const cli = path.join(root, "packages/cli/dist/bin/aperture.js");
  try {
    const project = await createApertureProject({
      cwd: temp,
      name: "scene",
      template: "diorama",
    });
    const scope = path.join(project.targetDir, "node_modules/@aperture-engine");
    await mkdir(scope, { recursive: true });
    await symlink(
      path.join(root, "packages/app"),
      path.join(scope, "app"),
      "dir",
    );
    const out = path.join(temp, "scene.json");
    const args = [
      cli,
      "headless",
      path.join(project.targetDir, "aperture.headless.config.ts"),
      "--out",
      out,
      "--asset-mode",
      "strict",
    ];
    await promisify(execFile)(process.execPath, args, {
      cwd: root,
      timeout: 60000,
    });
    const bundle = JSON.parse(await readFile(out, "utf8"));
    expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
    expect(bundle.renderTarget.planarReflection.height).toBe(0);
    expect(bundle.closure.roots).toContain("material:water.material");
    expect(bundle.snapshot.value.meshDraws.length).toBe(6);

    await writeFile(
      path.join(project.targetDir, "src/systems/scene.system.ts"),
      `
import { createSystem, mesh, material } from "@aperture-engine/app/systems";
export default class InvalidFloor extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.mesh({ key: "bad-floor", mesh: mesh.polygons({ faces: [{
      outline: [[0,0,0],[1,0,0],[1,1,1],[0,0,1]],
    }] }), material: material.standard() });
  }
}
`,
    );
    await expect(
      promisify(execFile)(process.execPath, args, {
        cwd: root,
        timeout: 60000,
      }),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/not coplanar[\s\S]*scene\.system\.ts:\d+/),
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}, 90000);
