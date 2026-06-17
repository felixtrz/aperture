import { describe, expect, it } from "vitest";
import {
  LocalTransform,
  RenderInterpolation,
  createFollowCameraController,
  expSmoothingAlpha,
  lerp,
  quatLookAt,
  registerApertureAppComponents,
  vec3Dot,
  vec3Normalize,
  type FollowCameraPose,
  type Vec3Tuple,
} from "@aperture-engine/app/systems";
import {
  createWorld,
  registerTransformComponents,
} from "@aperture-engine/simulation";

const CAMERA = {
  offset: [9.27, 9.18, 9.27] as Vec3Tuple,
  leadFactor: 3.0,
  smoothing: 2.0,
  deadzoneRadius: 5.0,
  screenShiftUp: 1.0,
} as const;
const INITIAL: Vec3Tuple = [3.5, 0.5, 5];
const RIGHT_XZ = vec3Normalize([
  CAMERA.offset[2],
  0,
  -CAMERA.offset[0],
]) as Vec3Tuple;
const FWD_XZ = vec3Normalize([
  -CAMERA.offset[0],
  0,
  -CAMERA.offset[2],
]) as Vec3Tuple;

describe("follow camera controller", () => {
  it("matches the legacy racing follow math over representative fixed updates", () => {
    const controller = createFollowCameraController({
      offset: CAMERA.offset,
      initialTarget: INITIAL,
      leadFactor: CAMERA.leadFactor,
      smoothing: CAMERA.smoothing,
      deadzoneRadius: CAMERA.deadzoneRadius,
      screenShiftUp: CAMERA.screenShiftUp,
    });
    const legacy = createLegacyRacingCameraState();
    const frames = [
      {
        delta: 1 / 60,
        target: [3.5, 0.5, 5] as Vec3Tuple,
        leadVelocity: [0, 0, 0] as Vec3Tuple,
      },
      {
        delta: 1 / 60,
        target: [5.2, 0.5, 8.4] as Vec3Tuple,
        leadVelocity: [0.75, 0, 2.35] as Vec3Tuple,
      },
      {
        delta: 1 / 30,
        target: [8.8, 0.5, 10.1] as Vec3Tuple,
        leadVelocity: [-1.5, 0, 3.7] as Vec3Tuple,
      },
    ];

    for (const frame of frames) {
      const actual = controller.update(frame);
      const expected = legacy.step(
        frame.delta,
        frame.target,
        frame.leadVelocity,
      );

      expectVec3(actual.desiredTarget, expected.desiredTarget);
      expectVec3(actual.smoothedTarget, expected.smoothedTarget);
      expectVec3(actual.lookPoint, expected.lookPoint);
      expectVec3(actual.eye, expected.eye);
      expectVec4(actual.rotation, expected.rotation);
    }
  });

  it("keeps the target inside the deadzone even with slow smoothing", () => {
    const controller = createFollowCameraController({
      offset: CAMERA.offset,
      initialTarget: [0, 0, 0],
      smoothing: 0.1,
      deadzoneRadius: 2,
    });

    controller.update({ delta: 1 / 60, target: [0, 0, 0] });
    const pose = controller.update({ delta: 1 / 60, target: [20, 0, 0] });

    const delta: Vec3Tuple = [
      pose.target[0] - pose.smoothedTarget[0],
      pose.target[1] - pose.smoothedTarget[1],
      pose.target[2] - pose.smoothedTarget[2],
    ];
    const right = vec3Dot(delta, controller.rightAxis);
    const forward = vec3Dot(delta, controller.forwardAxis);
    expect(Math.hypot(right, forward)).toBeLessThanOrEqual(2.000001);
  });

  it("writes LocalTransform and opts the camera into render interpolation", () => {
    const world = createWorld({ entityCapacity: 2 });
    registerTransformComponents(world);
    registerApertureAppComponents(world);
    const camera = world.createEntity();
    const controller = createFollowCameraController({
      offset: [2, 3, 4],
      initialTarget: [1, 0, 1],
    });

    const pose = controller.writeTo(camera, {
      delta: 1 / 60,
      target: [1, 0, 1],
    });

    expectVec3(
      Array.from(
        camera.getVectorView(LocalTransform, "translation"),
      ) as Vec3Tuple,
      pose.eye,
    );
    expectVec4(
      Array.from(camera.getVectorView(LocalTransform, "rotation")) as [
        number,
        number,
        number,
        number,
      ],
      pose.rotation,
    );
    expect(camera.hasComponent(RenderInterpolation)).toBe(true);
  });
});

function createLegacyRacingCameraState(): {
  step(
    delta: number,
    target: Vec3Tuple,
    leadVelocity: Vec3Tuple,
  ): FollowCameraPose;
} {
  let smoothed: Vec3Tuple = [...INITIAL];
  let initialized = false;

  return {
    step(delta, target, leadVelocity) {
      const radius = CAMERA.deadzoneRadius;
      const radiusSq = radius * radius;
      let leadX = vec3Dot(leadVelocity, RIGHT_XZ) * CAMERA.leadFactor;
      let leadY = vec3Dot(leadVelocity, FWD_XZ) * CAMERA.leadFactor;
      const leadLenSq = leadX * leadX + leadY * leadY;
      if (leadLenSq > radiusSq) {
        const k = radius / Math.sqrt(leadLenSq);
        leadX *= k;
        leadY *= k;
      }

      const desiredTarget: Vec3Tuple = [
        target[0] + RIGHT_XZ[0] * leadX + FWD_XZ[0] * leadY,
        target[1] + RIGHT_XZ[1] * leadX + FWD_XZ[1] * leadY,
        target[2] + RIGHT_XZ[2] * leadX + FWD_XZ[2] * leadY,
      ];

      const alpha = initialized
        ? expSmoothingAlpha(delta, CAMERA.smoothing)
        : 1;
      smoothed = [
        lerp(smoothed[0], desiredTarget[0], alpha),
        lerp(smoothed[1], desiredTarget[1], alpha),
        lerp(smoothed[2], desiredTarget[2], alpha),
      ];
      initialized = true;

      const delta3: Vec3Tuple = [
        target[0] - smoothed[0],
        target[1] - smoothed[1],
        target[2] - smoothed[2],
      ];
      const offX = vec3Dot(delta3, RIGHT_XZ);
      const offY = vec3Dot(delta3, FWD_XZ);
      const offLenSq = offX * offX + offY * offY;
      if (offLenSq > radiusSq) {
        const offLen = Math.sqrt(offLenSq);
        const k = (offLen - radius) / offLen;
        smoothed = [
          smoothed[0] + RIGHT_XZ[0] * offX * k + FWD_XZ[0] * offY * k,
          smoothed[1] + RIGHT_XZ[1] * offX * k + FWD_XZ[1] * offY * k,
          smoothed[2] + RIGHT_XZ[2] * offX * k + FWD_XZ[2] * offY * k,
        ];
      }

      const lookPoint: Vec3Tuple = [
        smoothed[0] - FWD_XZ[0] * CAMERA.screenShiftUp,
        smoothed[1] - FWD_XZ[1] * CAMERA.screenShiftUp,
        smoothed[2] - FWD_XZ[2] * CAMERA.screenShiftUp,
      ];
      const eye: Vec3Tuple = [
        lookPoint[0] + CAMERA.offset[0],
        lookPoint[1] + CAMERA.offset[1],
        lookPoint[2] + CAMERA.offset[2],
      ];

      return {
        target: [...target],
        desiredTarget,
        smoothedTarget: [...smoothed],
        lookPoint,
        eye,
        rotation: [...quatLookAt(eye, lookPoint)],
        lead: [leadX, leadY],
      };
    },
  };
}

function expectVec3(actual: Vec3Tuple, expected: Vec3Tuple): void {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
  expect(actual[2]).toBeCloseTo(expected[2], 6);
}

function expectVec4(
  actual: readonly [number, number, number, number],
  expected: readonly [number, number, number, number],
): void {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
  expect(actual[2]).toBeCloseTo(expected[2], 6);
  expect(actual[3]).toBeCloseTo(expected[3], 6);
}
