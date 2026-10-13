export const PHYSICS_QUAT_EPSILON = 1e-8;
export function normalizeQuat(value) {
    const x = read(value, 0);
    const y = read(value, 1);
    const z = read(value, 2);
    const w = read(value, 3);
    const length = Math.hypot(x, y, z, w);
    // Degenerate or non-finite rotations collapse to identity so physics
    // writeback and interpolation never propagate NaN transforms.
    if (!Number.isFinite(length) || length <= PHYSICS_QUAT_EPSILON) {
        return [0, 0, 0, 1];
    }
    return [x / length, y / length, z / length, w / length];
}
export function multiplyQuat(left, right) {
    const [lx, ly, lz, lw] = normalizeQuat(left);
    const [rx, ry, rz, rw] = normalizeQuat(right);
    return normalizeQuat([
        lw * rx + lx * rw + ly * rz - lz * ry,
        lw * ry - lx * rz + ly * rw + lz * rx,
        lw * rz + lx * ry - ly * rx + lz * rw,
        lw * rw - lx * rx - ly * ry - lz * rz,
    ]);
}
export function rotateVec3ByQuat(value, rotation) {
    const [qx, qy, qz, qw] = normalizeQuat(rotation);
    const x = read(value, 0);
    const y = read(value, 1);
    const z = read(value, 2);
    const tx = 2 * (qy * z - qz * y);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (qx * y - qy * x);
    return [
        x + qw * tx + (qy * tz - qz * ty),
        y + qw * ty + (qz * tx - qx * tz),
        z + qw * tz + (qx * ty - qy * tx),
    ];
}
export function slerpQuat(previous, current, alpha) {
    const start = normalizeQuat(previous);
    const end = normalizeQuat(current);
    let x1 = end[0];
    let y1 = end[1];
    let z1 = end[2];
    let w1 = end[3];
    let dot = start[0] * x1 + start[1] * y1 + start[2] * z1 + start[3] * w1;
    if (dot < 0) {
        dot = -dot;
        x1 = -x1;
        y1 = -y1;
        z1 = -z1;
        w1 = -w1;
    }
    if (dot > 0.9995) {
        return normalizeQuat([
            lerp(start[0], x1, alpha),
            lerp(start[1], y1, alpha),
            lerp(start[2], z1, alpha),
            lerp(start[3], w1, alpha),
        ]);
    }
    const theta0 = Math.acos(Math.min(1, Math.max(-1, dot)));
    const theta = theta0 * alpha;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return normalizeQuat([
        start[0] * s0 + x1 * s1,
        start[1] * s0 + y1 * s1,
        start[2] * s0 + z1 * s1,
        start[3] * s0 + w1 * s1,
    ]);
}
function lerp(left, right, alpha) {
    return left + (right - left) * alpha;
}
function read(values, index) {
    return values[index] ?? 0;
}
//# sourceMappingURL=math.js.map