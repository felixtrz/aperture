// FrameGraph history resources: double-buffered graph handles for temporal
// techniques (M3-T6). A history resource owns exactly TWO physical buffers and
// presents a stable pair of views each frame:
//   - current(): this frame's write target (a node declaring write 'current').
//   - previous(): last frame's written buffer (a node declaring read 'previous').
// At frame end the graph calls swap(), so this frame's write becomes next
// frame's previous — with NO read-write aliasing of the same physical texture in
// any single frame (current() and previous() are always distinct buffers).
//
// This mirrors three.js PassNode's _previousTextures / getPreviousTexture model
// (references/three.js/src/nodes/display/PassNode.js — concept borrowed, no code
// copied): exactly one extra buffer carries history across frames, and a resize
// reallocates both and drops the stale frame.
export function createFrameGraphHistoryResource(bufferA, bufferB) {
    const buffers = [bufferA, bufferB];
    let currentIndex = 0;
    let swapCount = 0;
    return {
        buffers,
        current() {
            return buffers[currentIndex];
        },
        previous() {
            return buffers[currentIndex === 0 ? 1 : 0];
        },
        hasPrevious() {
            return swapCount > 0;
        },
        swap() {
            currentIndex = currentIndex === 0 ? 1 : 0;
            swapCount += 1;
        },
        get swapCount() {
            return swapCount;
        },
    };
}
//# sourceMappingURL=frame-graph-history.js.map