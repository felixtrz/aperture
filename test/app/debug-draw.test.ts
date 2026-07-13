import { describe, expect, it } from "vitest";

import {
  createApertureSystemContext,
  runPhysicsDebugDrawFrame,
} from "@aperture-engine/app/systems";
import {
  extractRenderSnapshot,
  type DebugDrawApi,
} from "@aperture-engine/render";
import {
  PhysicsDebug,
  createPhysicsDebug,
  registerPhysicsComponents,
} from "@aperture-engine/physics";
import {
  AssetRegistry,
  createWorld,
  type EcsWorld,
} from "@aperture-engine/simulation";

function contextForConfig(debugDraw?: boolean) {
  const world = createWorld({ entityCapacity: 8 });
  const context = createApertureSystemContext({
    world,
    assetsRegistry: new AssetRegistry(),
    ...(debugDraw === undefined
      ? {}
      : { config: { mode: "headless", debugDraw } }),
  });

  return { context, world };
}

describe("E3 this.debugDraw system accessor", () => {
  it("exposes an enabled immediate-mode API by default and folds into the snapshot", () => {
    const { context, world } = contextForConfig();
    expect(context.debugDraw.enabled).toBe(true);

    context.debugDraw.aabb([-1, -1, -1], [1, 1, 1]);
    context.debugDraw.axes([0, 0, 0], 1);

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });
    expect(snapshot.debugLines?.segmentCount).toBe(15); // 12 + 3
    expect(snapshot.report.debugDraw).toEqual({
      primitives: 2,
      segments: 15,
      vertices: 30,
    });
  });

  it("binds a byte-identical no-op API when config.debugDraw is false", () => {
    const { context, world } = contextForConfig(false);
    expect(context.debugDraw.enabled).toBe(false);

    context.debugDraw.aabb([-1, -1, -1], [1, 1, 1]);
    context.debugDraw.sphere([0, 0, 0], 1);

    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });
    expect(snapshot.debugLines).toBeUndefined();
    expect(snapshot.report.debugDraw).toBeUndefined();
  });
});

describe("E3 physics-debug re-plumb", () => {
  function worldWithPhysicsDebug(): EcsWorld {
    const world = createWorld({ entityCapacity: 8 });
    registerPhysicsComponents(world);
    const entity = world.createEntity();
    entity.addComponent(
      PhysicsDebug,
      createPhysicsDebug({ colliderWireframes: true }),
    );
    return world;
  }

  it("routes physics debug geometry through the debug-draw overlay when a channel is enabled", () => {
    const world = worldWithPhysicsDebug();
    let requestedOptions: unknown = null;
    const debug = debugDrawSpy();
    const context = {
      debugDraw: debug.api,
      physics: {
        debugGeometry: (options: unknown) => {
          requestedOptions = options;
          return {
            lines: [
              { from: [0, 0, 0], to: [1, 0, 0], color: [1, 0.5, 0, 1] },
              { from: [1, 0, 0], to: [1, 1, 0], color: [1, 0.5, 0, 1] },
            ],
          };
        },
      },
    } as unknown as Parameters<typeof runPhysicsDebugDrawFrame>[0];

    runPhysicsDebugDrawFrame(context, world);

    expect(requestedOptions).toEqual({ colliderWireframes: true });
    expect(debug.physicsCalls).toHaveLength(1);
    expect(debug.physicsCalls[0]?.lines).toHaveLength(2);
  });

  it("does nothing when no PhysicsDebug channel is enabled (byte-identity preserved)", () => {
    const world = createWorld({ entityCapacity: 8 });
    registerPhysicsComponents(world);
    let called = false;
    const debug = debugDrawSpy();
    const context = {
      debugDraw: debug.api,
      physics: {
        debugGeometry: () => {
          called = true;
          return { lines: [] };
        },
      },
    } as unknown as Parameters<typeof runPhysicsDebugDrawFrame>[0];

    runPhysicsDebugDrawFrame(context, world);

    expect(called).toBe(false);
    expect(debug.physicsCalls).toHaveLength(0);
  });
});

function debugDrawSpy(): {
  readonly api: DebugDrawApi;
  readonly physicsCalls: { readonly lines: readonly unknown[] }[];
} {
  const physicsCalls: { readonly lines: readonly unknown[] }[] = [];
  const noop = () => undefined;
  const api = {
    enabled: true,
    line: noop,
    aabb: noop,
    box: noop,
    sphere: noop,
    axes: noop,
    grid: noop,
    frustum: noop,
    bones: noop,
    light: noop,
    physics: (geometry: { readonly lines: readonly unknown[] }) => {
      physicsCalls.push({ lines: geometry.lines });
    },
    pushSegments: noop,
  } as unknown as DebugDrawApi;

  return { api, physicsCalls };
}
