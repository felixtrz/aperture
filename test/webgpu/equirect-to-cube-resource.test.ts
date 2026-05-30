import { describe, expect, it } from "vitest";

import {
  createEquirectToCubeResource,
  hasEquirectToCubeDeviceSupport,
  type TextureGpuDeviceLike,
} from "@aperture-engine/webgpu/test-support";

interface DispatchRecord {
  dispatched: boolean;
  cubeCreated: boolean;
}

function recordingComputeDevice(record: DispatchRecord): TextureGpuDeviceLike {
  const view = { createView: () => ({}) };
  return {
    createTexture: (descriptor: unknown) => {
      const size = (descriptor as { size?: readonly number[] }).size;
      if (size?.[2] === 6) {
        record.cubeCreated = true;
      }
      return { createView: () => ({}) };
    },
    createSampler: () => ({}),
    createShaderModule: () => view,
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createComputePipeline: () => ({}),
    createBuffer: () => ({}),
    createBindGroup: () => ({}),
    createCommandEncoder: () => ({
      beginComputePass: () => ({
        setPipeline: () => {},
        setBindGroup: () => {},
        dispatchWorkgroups: () => {
          record.dispatched = true;
        },
        end: () => {},
      }),
      finish: () => ({}),
    }),
    queue: {
      writeTexture: () => {},
      writeBuffer: () => {},
      submit: () => {},
    },
  } as unknown as TextureGpuDeviceLike;
}

const equirect = {
  width: 8,
  height: 4,
  data: new Uint8Array(8 * 4 * 4),
};

describe("equirect-to-cube resource", () => {
  it("projects an equirect into a cube via a compute dispatch on a capable device", () => {
    const record: DispatchRecord = { dispatched: false, cubeCreated: false };
    const report = createEquirectToCubeResource({
      device: recordingComputeDevice(record),
      equirect,
      faceSize: 16,
    });

    expect(report.ready).toBe(true);
    expect(report.projection).toBe("equirect-to-cube");
    expect(report.faceCount).toBe(6);
    expect(report.faceSize).toBe(16);
    expect(report.resource?.viewDescriptor).toEqual({ dimension: "cube" });
    expect(record.dispatched).toBe(true);
    expect(record.cubeCreated).toBe(true);
    expect(report.diagnostics).toHaveLength(0);
  });

  it("degrades gracefully without compute support", () => {
    const report = createEquirectToCubeResource({
      device: {
        createTexture: () => ({ createView: () => ({}) }),
        queue: { writeTexture: () => {} },
      } as unknown as TextureGpuDeviceLike,
      equirect,
    });

    expect(report.ready).toBe(false);
    expect(report.resource).toBeNull();
    expect(report.diagnostics[0]?.code).toBe(
      "equirectToCubeResource.deviceUnsupported",
    );
  });

  it("rejects an undersized equirect source", () => {
    const record: DispatchRecord = { dispatched: false, cubeCreated: false };
    const report = createEquirectToCubeResource({
      device: recordingComputeDevice(record),
      equirect: { width: 8, height: 4, data: new Uint8Array(4) },
    });

    expect(report.ready).toBe(false);
    expect(report.diagnostics[0]?.code).toBe(
      "equirectToCubeResource.invalidSource",
    );
    expect(record.dispatched).toBe(false);
  });

  it("feature-detects compute capability", () => {
    const record: DispatchRecord = { dispatched: false, cubeCreated: false };
    expect(hasEquirectToCubeDeviceSupport(recordingComputeDevice(record))).toBe(
      true,
    );
    expect(
      hasEquirectToCubeDeviceSupport({
        createTexture: () => ({}),
      } as unknown as TextureGpuDeviceLike),
    ).toBe(false);
  });
});
