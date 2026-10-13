export function boundingRadiusForShape(shape) {
    switch (shape.kind) {
        case "box":
            return Math.hypot(...shape.halfExtents);
        case "sphere":
            return shape.radius;
        case "capsule":
        case "cylinder":
        case "cone":
            return Math.hypot(shape.radius, shape.halfHeight);
        case "convexHull":
        case "trimesh":
        case "heightfield":
            return 0.5;
    }
}
//# sourceMappingURL=shapes.js.map