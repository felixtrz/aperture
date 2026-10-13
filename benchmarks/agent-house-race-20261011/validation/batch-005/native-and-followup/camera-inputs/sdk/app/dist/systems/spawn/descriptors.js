import { createMaterialAppearancePreset } from "./material-presets.js";
import { color } from "../color.js";
import { validateRoundedBoxDescriptor } from "./rounded-box.js";
export const mesh = Object.freeze({
    /** Closed indexed XY outline and holes extruded from z=0 along +Z. */
    extrude(options) {
        return descriptor("extrude", options);
    },
    /** Full Y-axis revolution of explicit [radius, y] points, with flat normals. */
    lathe(options) {
        return descriptor("lathe", options);
    },
    /** Y-up terrain: heights[row][column] advances +Z by row and +X by column. */
    heightfield(options) {
        return descriptor("heightfield", options);
    },
    /** Custom triangles with flat face normals unless explicit normals are supplied. */
    triangleList(options) {
        return descriptor("triangle-list", options);
    },
    box(options = {}) {
        return descriptor("box", options);
    },
    /** Centered rounded box: positive halfExtents, fitting radius and 1–32 bevelSegments. */
    roundedBox(options = {}) {
        validateRoundedBoxDescriptor(options);
        return descriptor("rounded-box", options);
    },
    sphere(options = {}) {
        return descriptor("sphere", options);
    },
    capsule(options = {}) {
        return descriptor("capsule", options);
    },
    plane(options = {}) {
        return descriptor("plane", options);
    },
    cylinder(options = {}) {
        return descriptor("cylinder", options);
    },
    cone(options = {}) {
        return descriptor("cone", options);
    },
    /** A Y-up ring; reduce radial/tube segments for low-poly procedural parts. */
    torus(options = {}) {
        return descriptor("torus", options);
    },
    /**
     * Native GPU line-list mesh. Positions are consumed in pairs unless indices
     * are provided; indexed line lists consume indices in pairs.
     */
    lineList(options) {
        return descriptor("line-list", options);
    },
});
export const material = Object.freeze({
    standard(options = {}) {
        return Object.freeze({
            kind: "standard",
            options: linearMaterialOptions(options),
        });
    },
    unlit(options = {}) {
        return Object.freeze({
            kind: "unlit",
            options: linearMaterialOptions(options),
        });
    },
    preset(name, overrides = {}) {
        return createMaterialAppearancePreset(name, overrides);
    },
    customWgsl(options) {
        return Object.freeze({
            kind: "custom-wgsl",
            ...options,
            bindings: [...(options.bindings ?? [])],
            dependencies: [...(options.dependencies ?? [])],
        });
    },
    uniform(name, options) {
        return Object.freeze({
            kind: "uniform-buffer",
            name,
            binding: options.binding,
            visibility: [...options.visibility],
            fields: options.fields,
            ...(options.values === undefined ? {} : { values: options.values }),
            ...(options.runtimeUniformKey === undefined
                ? {}
                : { runtimeUniformKey: options.runtimeUniformKey }),
            ...(options.label === undefined ? {} : { label: options.label }),
        });
    },
    texture(name, options) {
        return Object.freeze({
            kind: "texture",
            name,
            binding: options.binding,
            visibility: [...options.visibility],
            texture: options.texture,
            ...(options.label === undefined ? {} : { label: options.label }),
        });
    },
    sampler(name, options) {
        return Object.freeze({
            kind: "sampler",
            name,
            binding: options.binding,
            visibility: [...options.visibility],
            sampler: options.sampler,
            ...(options.label === undefined ? {} : { label: options.label }),
        });
    },
});
function linearMaterialOptions(options) {
    const { baseColor, ...rest } = options;
    return {
        ...rest,
        ...(Object.prototype.hasOwnProperty.call(options, "baseColor")
            ? {
                baseColor: typeof baseColor === "string"
                    ? color.srgbHex(baseColor)
                    : baseColor,
            }
            : {}),
    };
}
export const shader = Object.freeze({
    asset(input) {
        return Object.freeze({
            kind: "shader-asset",
            handle: readShaderHandle(input),
        });
    },
    inlineWgsl(code, options = {}) {
        return Object.freeze({
            kind: "inline-wgsl",
            code,
            ...(options.virtualPath === undefined
                ? {}
                : { virtualPath: options.virtualPath }),
        });
    },
});
export const physics = Object.freeze({
    rigidBody(input = {}) {
        return Object.freeze({ ...input });
    },
    collider(input = {}) {
        return Object.freeze({ ...input });
    },
    velocity(input = {}) {
        return Object.freeze({ ...input });
    },
    externalForce(input = {}) {
        return Object.freeze({ ...input });
    },
    externalImpulse(input = {}) {
        return Object.freeze({ ...input });
    },
    kinematicTarget(input = {}) {
        return Object.freeze({ ...input });
    },
    characterController(input = {}) {
        return Object.freeze({ ...input });
    },
    material(input = {}) {
        return Object.freeze({ ...input });
    },
    joint(input = {}) {
        return Object.freeze({ ...input });
    },
    debug(input = {}) {
        return Object.freeze({ ...input });
    },
    body(input = {}) {
        return Object.freeze({ ...input });
    },
});
function descriptor(kind, options) {
    return Object.freeze({
        kind,
        options: { ...options },
    });
}
function readShaderHandle(input) {
    if ("renderHandle" in input) {
        return input.renderHandle;
    }
    return input;
}
//# sourceMappingURL=descriptors.js.map