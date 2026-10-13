// Storage allocation helpers. The branded vector/matrix types are
// `Float32Array & <tuple>`, which a bare `new Float32Array(n)` is not directly
// assignable to, so every allocation funnels through one of these. Each accepts
// the kernel's optional output-parameter `dst` (any same-shaped Float32Array)
// and returns it branded. The `as` conversions are type-only and free at
// runtime — these wrappers compile down to a plain `new Float32Array(n)` (or the
// passed-through `dst`) once V8 inlines them.
export function allocVec2(dst) {
    return (dst ?? new Float32Array(2));
}
export function allocVec3(dst) {
    return (dst ?? new Float32Array(3));
}
export function allocVec4(dst) {
    return (dst ?? new Float32Array(4));
}
export function allocQuat(dst) {
    return (dst ?? new Float32Array(4));
}
export function allocMat4(dst) {
    return (dst ?? new Float32Array(16));
}
//# sourceMappingURL=alloc.js.map