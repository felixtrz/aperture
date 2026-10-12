import { describe, expect, it } from "vitest";
import {
  capturePreparedResourceDependencies,
  touchPreparedResourceDependencies,
} from "../../packages/webgpu/src/resources/core/prepared-resource-dependencies.js";

describe("cached GPU prepared dependency identities", () => {
  it("does not refresh any dependency if another exact entry was retired or replaced", () => {
    const mesh = { cacheKey: "mesh-v1", lastUsedFrame: 1 };
    const material = { cacheKey: "material-v1", lastUsedFrame: 1 };
    const meshes = { resources: new Map([[mesh.cacheKey, mesh]]) };
    const materials = { resources: new Map([[material.cacheKey, material]]) };
    const dependencies = capturePreparedResourceDependencies(
      [meshes, mesh],
      [materials, material],
    );
    const replacement = { ...material };
    materials.resources.set(material.cacheKey, replacement);
    expect(touchPreparedResourceDependencies(dependencies, 130)).toBe(false);
    expect(mesh.lastUsedFrame).toBe(1);
    expect(material.lastUsedFrame).toBe(1);
    expect(replacement.lastUsedFrame).toBe(1);
    materials.resources.set(material.cacheKey, material);
    expect(touchPreparedResourceDependencies(dependencies, 130)).toBe(true);
    expect(mesh.lastUsedFrame).toBe(130);
    expect(material.lastUsedFrame).toBe(130);
    meshes.resources.delete(mesh.cacheKey);
    expect(touchPreparedResourceDependencies(dependencies, 131)).toBe(false);
    expect(material.lastUsedFrame).toBe(130);
  });

  it("preserves newer uses and requires dependency evidence for legacy cache entries", () => {
    const entry = { cacheKey: "current-alias", lastUsedFrame: 140 };
    const cache = { resources: new Map([[entry.cacheKey, entry]]) };
    const dependencies = capturePreparedResourceDependencies(
      [cache, entry],
      [cache, null],
    );
    expect(touchPreparedResourceDependencies(dependencies, 139)).toBe(true);
    expect(entry.lastUsedFrame).toBe(140);
    expect(touchPreparedResourceDependencies(undefined, 141)).toBe(false);
  });
});
