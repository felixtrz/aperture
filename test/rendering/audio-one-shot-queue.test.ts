import { describe, expect, it } from "vitest";

import { createAudioClipHandle } from "@aperture-engine/simulation";
import {
  createOneShotEmitterQueue,
  type RenderDiagnostic,
} from "@aperture-engine/render";

const CLIP = createAudioClipHandle("boom");

describe("one-shot emitter queue (AU-1.5)", () => {
  it("drains a request into a transient autoplay packet with its world position", () => {
    const queue = createOneShotEmitterQueue();
    expect(queue.enqueue({ clip: CLIP, worldPos: [3, 0, -2] })).toBe(true);

    const transforms: number[] = [];
    const diagnostics: RenderDiagnostic[] = [];
    const packets = queue.drain(transforms, diagnostics);

    expect(packets).toHaveLength(1);
    const packet = packets[0];
    expect(packet?.key).toEqual({ kind: "oneshot", seq: 1 });
    expect(packet?.clip).toEqual(CLIP);
    expect(packet?.autoplay).toBe(true);
    expect(packet?.loop).toBe(false);
    expect(packet?.simulationSpace).toBe("world");
    const o = packet?.worldTransformOffset ?? 0;
    expect(transforms.slice(o + 12, o + 15)).toEqual([3, 0, -2]);
  });

  it("drops one-shots beyond maxActive and emits an overflow diagnostic", () => {
    const queue = createOneShotEmitterQueue({ maxActive: 2, maxPerFrame: 8 });
    const results = [1, 2, 3, 4, 5].map(() => queue.enqueue({ clip: CLIP }));

    expect(results.filter(Boolean)).toHaveLength(2); // only 2 accepted
    expect(queue.droppedCount).toBe(3);

    const diagnostics: RenderDiagnostic[] = [];
    queue.drain([], diagnostics);
    expect(diagnostics.map((d) => d.code)).toContain(
      "render.audio.oneShotOverflow",
    );
  });

  it("honors the per-frame drain cap and keeps the snapshot bounded", () => {
    const queue = createOneShotEmitterQueue({ maxActive: 16, maxPerFrame: 2 });
    for (let i = 0; i < 5; i += 1) {
      queue.enqueue({ clip: CLIP });
    }
    expect(queue.drain([], []).length).toBe(2); // first frame promotes 2
    expect(queue.drain([], []).length).toBe(4); // +2 promoted, 2 still alive
  });

  it("expires a transient emitter after its TTL", () => {
    const queue = createOneShotEmitterQueue({ ttlFrames: 2 });
    queue.enqueue({ clip: CLIP });
    queue.drain([], []); // frame 1 (TTL 2 -> 1)
    expect(queue.activeCount).toBe(1);
    queue.drain([], []); // frame 2 (TTL 1 -> 0, removed)
    expect(queue.activeCount).toBe(0);
    expect(queue.drain([], []).length).toBe(0);
  });
});
