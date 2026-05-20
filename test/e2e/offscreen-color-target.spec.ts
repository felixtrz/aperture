import { expect, test } from "@playwright/test";

test("renders a triangle into an off-screen color target and reads pixels", async ({
  page,
}) => {
  await page.goto("/examples/triangle.html");

  const result = await page.evaluate(async () => {
    if (navigator.gpu === undefined) {
      return { ok: false, reason: "webgpu-unavailable" };
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (adapter === null) {
      return { ok: false, reason: "adapter-unavailable" };
    }

    const device = await adapter.requestDevice();
    const { createOffscreenColorTarget, createRenderPassAttachmentPlan } =
      await import("@aperture-engine/webgpu");
    const width = 32;
    const height = 32;
    const format = "rgba8unorm";
    const textureUsageCopySrc = 0x01;
    const textureUsageRenderAttachment = 0x10;
    const bufferUsageMapRead = 0x01;
    const bufferUsageCopyDst = 0x08;
    const mapModeRead = 0x01;
    const texture = device.createTexture({
      label: "aperture-offscreen-target-test",
      size: { width, height },
      format,
      usage: textureUsageRenderAttachment | textureUsageCopySrc,
    });
    const target = createOffscreenColorTarget({
      texture,
      clearColor: [0, 0, 0, 1],
      loadOp: "clear",
      storeOp: "store",
    });
    const attachmentPlan = createRenderPassAttachmentPlan({
      colorTargets: target.target === null ? [] : [target.target],
    });

    if (
      !target.valid ||
      !attachmentPlan.valid ||
      attachmentPlan.plan === null
    ) {
      return {
        ok: false,
        reason: "attachment-plan-failed",
        target,
        attachmentPlan,
      };
    }

    const shader = device.createShaderModule({
      label: "aperture-offscreen-target-test-shader",
      code: `
        @vertex
        fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
          var positions = array<vec2f, 3>(
            vec2f(-0.8, -0.8),
            vec2f(0.8, -0.8),
            vec2f(0.0, 0.8),
          );
          return vec4f(positions[vertexIndex], 0.0, 1.0);
        }

        @fragment
        fn fs() -> @location(0) vec4f {
          return vec4f(0.95, 0.2, 0.1, 1.0);
        }
      `,
    });
    const pipeline = device.createRenderPipeline({
      label: "aperture-offscreen-target-test-pipeline",
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const encoder = device.createCommandEncoder({
      label: "aperture-offscreen-target-test-encoder",
    });
    const pass = encoder.beginRenderPass({
      label: "aperture-offscreen-target-test-pass",
      colorAttachments: attachmentPlan.plan.colorAttachments.map(
        (attachment) => ({
          view: attachment.view as GPUTextureView,
          ...(attachment.clearValue === undefined
            ? {}
            : { clearValue: attachment.clearValue }),
          loadOp: attachment.loadOp,
          storeOp: attachment.storeOp,
        }),
      ),
    });

    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    const bytesPerRow = 256;
    const readback = device.createBuffer({
      label: "aperture-offscreen-target-test-readback",
      size: bytesPerRow * height,
      usage: bufferUsageCopyDst | bufferUsageMapRead,
    });

    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow },
      { width, height },
    );
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(mapModeRead);

    const mapped = new Uint8Array(readback.getMappedRange());
    const offset = 16 * bytesPerRow + 16 * 4;
    const center = Array.from(mapped.slice(offset, offset + 4));

    readback.unmap();
    texture.destroy();

    return {
      ok: true,
      center,
      targetValid: target.valid,
      attachmentCount: attachmentPlan.plan.colorAttachments.length,
    };
  });

  if (!result.ok && result.reason === "webgpu-unavailable") {
    test.skip(true, "WebGPU is not available in this browser.");
  }

  if (!result.ok && result.reason === "adapter-unavailable") {
    test.skip(true, "WebGPU adapter is not available in this browser.");
  }

  if (!result.ok) {
    expect(result).toMatchObject({ ok: true });
    return;
  }

  expect(result).toMatchObject({
    ok: true,
    targetValid: true,
    attachmentCount: 1,
  });
  const center = result.center ?? [];

  expect(center[0]).toBeGreaterThan(180);
  expect(center[1]).toBeLessThan(90);
  expect(center[3]).toBe(255);
});
