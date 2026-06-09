import { describe, expect, it } from "vitest";
import { mat4 } from "wgpu-matrix";
import type { Aabb, Mat4 } from "@aperture-engine/simulation";
import {
  computeViewDepth,
  createFrustumPlanes,
  createViewCullSignature,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "../../packages/render/src/rendering/extraction-culling.js";

const IDENTITY = mat4.identity() as unknown as Mat4;

function aabbAt(
  center: readonly [number, number, number],
  halfExtent = 0.25,
): Aabb {
  return {
    min: [
      center[0] - halfExtent,
      center[1] - halfExtent,
      center[2] - halfExtent,
    ],
    max: [
      center[0] + halfExtent,
      center[1] + halfExtent,
      center[2] + halfExtent,
    ],
  };
}

function cullContext(
  overrides: Partial<ViewCullContext> & {
    readonly planes: ViewCullContext["planes"];
  },
): ViewCullContext {
  return {
    viewId: 1,
    camera: { index: 0, generation: 0 },
    priority: 0,
    layerMask: 0b1,
    viewMatrix: IDENTITY,
    frustumCulling: true,
    stats: {
      viewId: 1,
      camera: { index: 0, generation: 0 },
      tested: 0,
      culled: 0,
      included: 0,
    },
    ...overrides,
  };
}

describe("frustum plane extraction", () => {
  it("derives the WebGPU clip volume from an identity view-projection", () => {
    const planes = createFrustumPlanes(IDENTITY);
    const context = cullContext({ planes });

    // Inside the clip volume (x, y in [-1, 1], z in [0, 1]).
    expect(
      isVisibleInAnyMatchingView(aabbAt([0, 0, 0.5]), 0b1, [context]),
    ).toBe(true);

    // Outside each face.
    expect(
      isVisibleInAnyMatchingView(aabbAt([2, 0, 0.5]), 0b1, [context]),
    ).toBe(false);
    expect(
      isVisibleInAnyMatchingView(aabbAt([-2, 0, 0.5]), 0b1, [context]),
    ).toBe(false);
    expect(
      isVisibleInAnyMatchingView(aabbAt([0, 2, 0.5]), 0b1, [context]),
    ).toBe(false);
    expect(
      isVisibleInAnyMatchingView(aabbAt([0, -2, 0.5]), 0b1, [context]),
    ).toBe(false);
    expect(isVisibleInAnyMatchingView(aabbAt([0, 0, -1]), 0b1, [context])).toBe(
      false,
    );
    expect(isVisibleInAnyMatchingView(aabbAt([0, 0, 2]), 0b1, [context])).toBe(
      false,
    );

    // Straddling a face counts as visible.
    expect(
      isVisibleInAnyMatchingView(aabbAt([1, 0, 0.5]), 0b1, [context]),
    ).toBe(true);
  });

  it("culls against a perspective camera frustum", () => {
    const projection = mat4.perspective(Math.PI / 2, 1, 0.1, 100);
    const view = mat4.translation([0, 0, -5]);
    const viewProjection = mat4.multiply(projection, view) as unknown as Mat4;
    const planes = createFrustumPlanes(viewProjection);
    const context = cullContext({ planes });

    // 5 units in front of the camera (camera looks down -Z from origin).
    expect(isVisibleInAnyMatchingView(aabbAt([0, 0, 0]), 0b1, [context])).toBe(
      true,
    );
    // Behind the camera.
    expect(isVisibleInAnyMatchingView(aabbAt([0, 0, 10]), 0b1, [context])).toBe(
      false,
    );
    // Beyond the far plane.
    expect(
      isVisibleInAnyMatchingView(aabbAt([0, 0, -120]), 0b1, [context]),
    ).toBe(false);
    // Outside the 90° horizontal field of view at depth 5.
    expect(isVisibleInAnyMatchingView(aabbAt([8, 0, 0]), 0b1, [context])).toBe(
      false,
    );
    expect(isVisibleInAnyMatchingView(aabbAt([-8, 0, 0]), 0b1, [context])).toBe(
      false,
    );
    // Inside the cone near its edge.
    expect(isVisibleInAnyMatchingView(aabbAt([4, 0, 0]), 0b1, [context])).toBe(
      true,
    );
  });

  it("keeps large scaled bounds visible when their center is off screen", () => {
    const projection = mat4.perspective(Math.PI / 2, 1, 0.1, 100);
    const view = mat4.translation([0, 0, -5]);
    const planes = createFrustumPlanes(
      mat4.multiply(projection, view) as unknown as Mat4,
    );
    const context = cullContext({ planes });

    // Center far to the left, but the 10-unit half extent reaches the frustum.
    expect(
      isVisibleInAnyMatchingView(aabbAt([-12, 0, 0], 10), 0b1, [context]),
    ).toBe(true);
  });
});

describe("view cull dispatch", () => {
  it("treats draws with no matching view as visible and skips their stats", () => {
    const planes = createFrustumPlanes(IDENTITY);
    const context = cullContext({ planes, layerMask: 0b10 });

    expect(isVisibleInAnyMatchingView(aabbAt([5, 5, 5]), 0b01, [context])).toBe(
      true,
    );
    expect(context.stats.tested).toBe(0);
    expect(context.stats.included).toBe(0);
    expect(context.stats.culled).toBe(0);
  });

  it("bypasses the frustum test when a view disables culling", () => {
    const planes = createFrustumPlanes(IDENTITY);
    const context = cullContext({ planes, frustumCulling: false });

    expect(isVisibleInAnyMatchingView(aabbAt([9, 9, 9]), 0b1, [context])).toBe(
      true,
    );
    expect(context.stats.included).toBe(1);
    expect(context.stats.tested).toBe(0);
  });

  it("counts tested, culled, and included draws per view", () => {
    const planes = createFrustumPlanes(IDENTITY);
    const context = cullContext({ planes });

    isVisibleInAnyMatchingView(aabbAt([0, 0, 0.5]), 0b1, [context]);
    isVisibleInAnyMatchingView(aabbAt([5, 0, 0.5]), 0b1, [context]);

    expect(context.stats.tested).toBe(2);
    expect(context.stats.included).toBe(1);
    expect(context.stats.culled).toBe(1);
  });

  it("returns the first view whose layer mask matches", () => {
    const planes = createFrustumPlanes(IDENTITY);
    const first = cullContext({ planes, viewId: 1, layerMask: 0b01 });
    const second = cullContext({ planes, viewId: 2, layerMask: 0b10 });

    expect(firstMatchingSortView(0b10, [first, second])?.viewId).toBe(2);
    expect(firstMatchingSortView(0b100, [first, second])).toBeUndefined();
  });
});

describe("view depth", () => {
  it("orders points front-to-back along the camera forward axis", () => {
    // Camera at the origin looking down -Z: nearer points get smaller depth.
    const view = mat4.identity() as unknown as Mat4;
    const near = computeViewDepth(view, [0, 0, -1]);
    const far = computeViewDepth(view, [0, 0, -10]);

    expect(near).toBeCloseTo(1, 5);
    expect(far).toBeCloseTo(10, 5);
    expect(near).toBeLessThan(far);
  });

  it("respects the view matrix translation", () => {
    const view = mat4.translation([0, 0, -5]) as unknown as Mat4;

    expect(computeViewDepth(view, [0, 0, 0])).toBeCloseTo(5, 5);
    expect(computeViewDepth(view, [0, 0, 3])).toBeCloseTo(2, 5);
  });
});

describe("view cull signature", () => {
  it("is stable for identical contexts and differs when culling toggles", () => {
    const planes = createFrustumPlanes(IDENTITY);
    const enabled = cullContext({ planes });
    const disabled = cullContext({ planes, frustumCulling: false });

    expect(createViewCullSignature([enabled])).toBe(
      createViewCullSignature([cullContext({ planes })]),
    );
    expect(createViewCullSignature([enabled])).not.toBe(
      createViewCullSignature([disabled]),
    );
  });
});
