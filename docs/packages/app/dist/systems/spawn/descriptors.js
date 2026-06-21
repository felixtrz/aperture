export const mesh = Object.freeze({
    box(options = {}) {
        return descriptor("box", options);
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
        return Object.freeze({ kind: "standard", options: { ...options } });
    },
    unlit(options = {}) {
        return Object.freeze({ kind: "unlit", options: { ...options } });
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