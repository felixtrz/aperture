import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  asset,
  defineApertureConfig,
  input,
} from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { LocalTransform, type Entity } from "@aperture-engine/simulation";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";

// End-to-end task contracts, rather than isolated tool mocks. Keep the assets
// local and the seed fixed so these journeys also run in offline CI.
async function authoringSession(importModel = false) {
  return createHeadlessSessionController({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
      assets: importModel
        ? { model: asset.gltf("/assets/cube.glb", { preload: "blocking" }) }
        : {},
      input: { actions: { select: input.button([input.key("Space")]) } },
    }),
    systems: [
      {
        default: class AuthoringScene extends createSystem() {
          #subject: Entity | null = null;
          override init(): void {
            this.spawn.camera({
              key: "camera.main",
              transform: { translation: [0, 1, 8], lookAt: [0, 0, 0] },
            });
            this.spawn.light({ kind: "directional", illuminance: 3 });
            this.#subject = this.spawn.mesh({
              key: "subject",
              tags: ["editable"],
              mesh: mesh.box({ size: [1, 1, 1] }),
              material: material.standard(),
              transform: { translation: [0, 0, 0] },
            });
            if (importModel)
              this.spawn.gltf(this.assets.gltf("model"), {
                key: "imported",
                transform: { translation: [2, 0, 0] },
              });
          }
          override update(): void {
            const select = this.input.actions["select"];
            if (
              select?.kind === "button" &&
              select.pressed.value &&
              this.#subject !== null
            ) {
              const position = this.#subject.getVectorView(
                LocalTransform,
                "translation",
              );
              position[0] = (position[0] ?? 0) + 1;
            }
          }
        },
      },
    ],
    seed: 42,
    assetMode: "strict",
    root: path.resolve("examples/developer-api"),
    publicDir: "public",
    allowHttpAssets: false,
    determinism: "error",
  });
}

describe("agent authoring task baseline", () => {
  it("first scene: boot, settle, discover and read a named subject", async () => {
    const session = await authoringSession();
    try {
      const calls = [
        session.callTool({
          name: "ecs_step",
          arguments: { untilQuiescent: true },
        }),
        session.callTool({
          name: "ecs_find_entities",
          arguments: { key: "subject" },
        }),
        session.callTool({
          name: "ecs_get_entity",
          arguments: { key: "subject" },
        }),
      ];
      expect(calls.every((result) => result.ok)).toBe(true);
      expect(calls[1]?.result).toMatchObject({
        summaries: [{ key: "subject" }],
      });
      expect(calls[2]?.result).toMatchObject({
        summary: { localTransform: { translation: [0, 0, 0] } },
      });
      expect(session.extract().snapshot.meshDraws).toHaveLength(1);
    } finally {
      session.dispose();
    }
  });

  it("GLB import: inspect real asset bytes, find root and revise its transform", async () => {
    const session = await authoringSession(true);
    try {
      expect(
        session.callTool({ name: "asset_inspect", arguments: { id: "model" } }),
      ).toMatchObject({ ok: true, result: { ready: true, meshes: 1 } });
      expect(
        session.callTool({
          name: "ecs_get_entity",
          arguments: { key: "imported" },
        }),
      ).toMatchObject({ ok: true, result: { summary: { key: "imported" } } });
      expect(
        session.callTool({
          name: "ecs_set_component_field",
          arguments: {
            key: "imported",
            component: LocalTransform.id,
            field: "scale",
            value: [3, 2, 1],
          },
        }).ok,
      ).toBe(true);
      session.step({ frames: 1 });
      expect(
        session.callTool({
          name: "ecs_get_entity",
          arguments: { key: "imported" },
        }),
      ).toMatchObject({
        ok: true,
        result: { summary: { localTransform: { scale: [3, 2, 1] } } },
      });
      expect(
        session.runner.app.lowLevel.assets.createManifestReport().placeholders
          .count,
      ).toBe(0);
    } finally {
      session.dispose();
    }
  });

  it("compose and revise: capture a checkpoint, edit, read back and diff", async () => {
    const session = await authoringSession();
    try {
      expect(session.callTool({ name: "ecs_snapshot" }).ok).toBe(true);
      expect(
        session.callTool({
          name: "ecs_set_component_field",
          arguments: {
            key: "subject",
            component: LocalTransform.id,
            field: "translation",
            value: [2, 1, 0],
          },
        }).ok,
      ).toBe(true);
      expect(
        session.callTool({
          name: "ecs_get_entity",
          arguments: { key: "subject" },
        }),
      ).toMatchObject({
        result: { summary: { localTransform: { translation: [2, 1, 0] } } },
      });
      expect(session.callTool({ name: "ecs_diff" })).toMatchObject({
        ok: true,
        result: { counts: { changed: 1, added: 0, removed: 0 } },
      });
    } finally {
      session.dispose();
    }
  });

  it("diagnose: invalid edit has an actionable error and does not mutate", async () => {
    const session = await authoringSession();
    try {
      const failed = session.callTool({
        name: "ecs_set_component_field",
        arguments: {
          key: "subject",
          component: LocalTransform.id,
          field: "position",
          value: [99, 0, 0],
        },
      });
      expect(failed).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "aperture.entityLookup.componentFieldUnsupported",
            suggestedFix: expect.any(String),
          },
        ],
      });
      expect(
        session.callTool({
          name: "ecs_get_entity",
          arguments: { key: "subject" },
        }),
      ).toMatchObject({
        result: { summary: { localTransform: { translation: [0, 0, 0] } } },
      });
    } finally {
      session.dispose();
    }
  });

  it("interaction and replay: semantic input and fixed steps survive a seeded reset", async () => {
    const session = await authoringSession();
    try {
      const run = () => {
        expect(
          session.callTool({
            name: "input_inject",
            arguments: { actions: { select: true } },
          }).ok,
        ).toBe(true);
        session.step({ frames: 4 });
        expect(
          session.callTool({
            name: "ecs_get_entity",
            arguments: { key: "subject" },
          }),
        ).toMatchObject({
          result: { summary: { localTransform: { translation: [4, 0, 0] } } },
        });
        return {
          input: session.callTool({ name: "input_get_state" }),
          snapshot: session.extract({ digest: true }).result,
        };
      };
      const first = run();
      await session.reset({ seed: 42 });
      expect(run()).toEqual(first);
    } finally {
      session.dispose();
    }
  });
});
