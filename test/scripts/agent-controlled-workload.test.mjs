import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createWorkload,
  VARIANTS,
} from "../../tools/agent-benchmark/controlled-workload/scene.mjs";
import {
  prepareControlledWorkload,
  workloadManifest,
} from "../../tools/agent-benchmark/controlled-workload/prepare.mjs";

describe("controlled workload fairness", () => {
  it("retains a deterministic indexed workload within the declared resource budgets", () => {
    for (const variant of VARIANTS) {
      const workload = createWorkload(variant);
      expect(workload).toEqual(createWorkload(variant));
      const manifest = workloadManifest(workload);
      expect(manifest.totals.placedTriangles).toBeLessThanOrEqual(300_000);
      expect(manifest.totals.storedGeometryBytes).toBeLessThanOrEqual(
        24 * 1024 * 1024,
      );
      expect(manifest.totals.storedInstanceBytes).toBeLessThanOrEqual(
        4 * 1024 * 1024,
      );
      expect(manifest.totals.materials).toBeLessThanOrEqual(64);
      expect(workload.geometries).toHaveLength(6);
      expect(workload.instances.length).toBeGreaterThan(150);
      for (const geometry of workload.geometries) {
        const { positions: p, normals: n, indices } = geometry;
        expect(n).toHaveLength(p.length);
        expect(geometry.uvs).toHaveLength((p.length / 3) * 2);
        expect(indices.length % 3).toBe(0);
        expect(new Set(indices).size).toBeLessThan(indices.length);
        for (let i = 0; i < indices.length; i += 3) {
          const offsets = indices.slice(i, i + 3).map((index) => index * 3);
          expect(
            offsets.every((offset) => offset >= 0 && offset + 2 < p.length),
          ).toBe(true);
          const [a, b, c] = offsets.map((offset) =>
            p.slice(offset, offset + 3),
          );
          const u = b.map((v, axis) => v - a[axis]),
            v = c.map((w, axis) => w - a[axis]);
          const cross = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
          ];
          expect(Math.hypot(...cross)).toBeGreaterThan(1e-8);
          const averageNormal = [0, 1, 2].map((axis) =>
            offsets.reduce((sum, offset) => sum + n[offset + axis], 0),
          );
          expect(
            cross.reduce(
              (sum, value, axis) => sum + value * averageNormal[axis],
              0,
            ),
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("ablates shadows and textures without changing geometry, placement or cameras", () => {
    const baseline = createWorkload();
    for (const variant of ["no-shadows", "no-textures"]) {
      const workload = createWorkload(variant);
      expect(workload.geometries).toEqual(baseline.geometries);
      expect(workload.instances).toEqual(baseline.instances);
      expect(workload.settings.camera).toEqual(baseline.settings.camera);
      expect(workload.settings.sun).toEqual(baseline.settings.sun);
      expect(workload.settings.ambient).toEqual(baseline.settings.ambient);
    }
    expect(createWorkload("no-shadows").settings.shadow.enabled).toBe(false);
    expect(createWorkload("no-textures").textures).toEqual([]);
    expect(
      createWorkload("no-textures").materials.every(
        (material) => material.texture === null,
      ),
    ).toBe(true);
    expect(() => createWorkload("pick-fastest")).toThrow(
      "Unknown controlled variant",
    );
  });

  it("writes byte-identical canonical input into both real-renderer source trees and refuses overwrite", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "aperture-controlled-"));
    try {
      const outputRoot = resolve(temporary, "pair");
      const result = await prepareControlledWorkload({
        outputRoot,
        build: false,
      });
      const aperture = await readFile(
        join(outputRoot, "aperture/source/workload.json"),
      );
      const three = await readFile(
        join(outputRoot, "three/source/workload.json"),
      );
      expect(aperture.equals(three)).toBe(true);
      expect(
        aperture.equals(await readFile(join(outputRoot, "workload.json"))),
      ).toBe(true);
      expect(result.adapters.aperture.canonicalWorkloadSha256).toBe(
        result.adapters.three.canonicalWorkloadSha256,
      );
      expect(
        result.manifest.geometries.every((entry) =>
          Object.values(entry.fields).every(
            (field) => field.sha256.length === 64,
          ),
        ),
      ).toBe(true);
      const worker = await readFile(
        join(outputRoot, "aperture/source/aperture-worker.mjs"),
        "utf8",
      );
      expect(worker).toContain("startGeneratedSimulationWorker");
      const adapter = await readFile(
        join(outputRoot, "three/source/three-main.mjs"),
        "utf8",
      );
      expect(adapter).toContain("WebGPURenderer");
      expect(adapter).toContain(
        'geometry.getAttribute("position").array.slice()',
      );
      expect(adapter).toContain("object.getMatrixAt");
      await expect(
        prepareControlledWorkload({ outputRoot, build: false }),
      ).rejects.toThrow();
      expect(
        (await readFile(join(outputRoot, "workload.json"))).equals(aperture),
      ).toBe(true);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("changes manifest hashes when a position, transform, material or render setting changes", () => {
    const baseline = createWorkload(),
      original = workloadManifest(baseline);
    for (const mutate of [
      (workload) => {
        workload.geometries[0].positions[0] += 0.1;
      },
      (workload) => {
        workload.instances[0].translation[0] += 0.1;
      },
      (workload) => {
        workload.materials[0].roughness += 0.1;
      },
      (workload) => {
        workload.settings.exposure += 0.1;
      },
    ]) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(workloadManifest(changed).workloadSha256).not.toBe(
        original.workloadSha256,
      );
    }
  });
});
