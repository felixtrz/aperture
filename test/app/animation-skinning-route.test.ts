import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { Animation, type AnimationDriverState } from "@aperture-engine/runtime";
import {
  Mesh,
  MorphTargetWeights,
  createMorphTargetWeights,
} from "@aperture-engine/render";
import { LocalTransform, type Entity } from "@aperture-engine/simulation";

import {
  ASSET_KEY,
  CLIP_NAME,
  MESH_NODE_KEY,
  animationSkinningDataUrl,
  buildAnimationSkinningGlb,
} from "../../examples/animation-skinning-scene.js";

/**
 * Fixture + engine-API verification behind the M2-T9 route: the in-memory
 * skinned + 3-morph-target + CUBICSPLINE GLB imports through the public
 * spawn.gltf/spawn.animation API, the CUBICSPLINE clip drives the joint, and a
 * MorphTargetWeights attached to the imported mesh entity produces a morphed
 * draw carrying all three targets in the snapshot.
 */
describe("animation-skinning route fixture (M2-T9)", () => {
  it("imports a skinned + 3-target morph + CUBICSPLINE GLB and renders it morphed", async () => {
    expect(buildAnimationSkinningGlb()[0]).toBe(0x67); // 'g' of glTF magic
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        assets: {
          [ASSET_KEY]: asset.gltf(animationSkinningDataUrl(), {
            preload: "blocking",
          }),
        },
      }),
    });

    const handle = app.context.assets.gltf(ASSET_KEY);
    expect(handle.ready.value).toBe(true);
    const scene = handle.scene.value!;
    expect(scene.skin.skins[0]!.jointCount).toBe(2);
    expect(scene.clips.map((clip) => clip.name)).toContain(CLIP_NAME);
    expect(
      scene.animationReport.diagnostics.some(
        (d) => d.code === "gltfAnimation.unsupportedInterpolation",
      ),
    ).toBe(false);

    const root = app.context.spawn.gltf(handle);
    const animation = app.context.spawn.animation(root);
    expect(animation.clipIds).toContain(CLIP_NAME);

    // The imported renderable mesh entity is reachable via the clip target map;
    // attach a MorphTargetWeights so the 3rd target contributes.
    const state = root.getValue(Animation, "state") as AnimationDriverState;
    const keys = Array.from(state.targets.keys());
    expect(keys, `target keys: ${keys.join(", ")}`).toContain(MESH_NODE_KEY);
    let morphedEntity: Entity | undefined;
    for (const entity of state.targets.values()) {
      if ((entity as Entity).hasComponent(Mesh)) {
        morphedEntity = entity as Entity;
        break;
      }
    }
    expect(
      morphedEntity,
      `no Mesh entity among keys: ${keys.join(", ")}`,
    ).toBeDefined();
    morphedEntity!.addComponent(
      MorphTargetWeights,
      createMorphTargetWeights({ weights: [0, 0, 1] }),
    );

    animation.playClip(CLIP_NAME, { loop: "once" });
    app.step(0.5);
    expect(animation.activeClipId).toBe(CLIP_NAME);

    // CUBICSPLINE drove the upper joint off identity.
    const jointEntity = state.targets.get(`${ASSET_KEY}:node:2`)!;
    const rotation = Array.from(
      jointEntity.getVectorView(LocalTransform, "rotation"),
    );
    expect(Math.abs(rotation[2]!)).toBeGreaterThan(0.1);

    // The snapshot carries a morphed draw with all three targets + skin bones.
    const snapshot = app.extract(1);
    const morphedDraw = snapshot.meshDraws.find(
      (draw) => draw.batchKey.morphed,
    );
    expect(morphedDraw, "expected a morphed draw").toBeDefined();
    expect(morphedDraw!.morphTargetCount).toBe(3);
    expect((snapshot.bones?.length ?? 0) / 16).toBe(2); // 2 skin joints
    expect(
      snapshot.morphTargetWeights?.[morphedDraw!.morphWeightOffset! + 2],
    ).toBe(1);
  });
});
