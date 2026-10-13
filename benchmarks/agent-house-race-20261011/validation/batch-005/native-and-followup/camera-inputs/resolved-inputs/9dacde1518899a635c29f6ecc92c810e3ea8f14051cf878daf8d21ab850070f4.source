/**
 * Public preset values. These are authoring data, not hidden renderer state;
 * `spawn.lightRig` expands them into ordinary ECS entities.
 */
export const LIGHT_RIG_PRESETS = Object.freeze({
    "studio-neutral": Object.freeze({
        environment: Object.freeze({
            intensity: 1,
            color: Object.freeze([1, 1, 1, 1]),
            layerMask: 1,
        }),
        keyLight: Object.freeze({
            kind: "directional",
            intensity: 3,
            color: Object.freeze([1, 1, 1, 1]),
            transform: Object.freeze({
                rotationEulerDegrees: Object.freeze([-45, 35, 0]),
            }),
        }),
        rimLight: Object.freeze({
            kind: "rect-area",
            intensity: 1.5,
            color: Object.freeze([1, 1, 1, 1]),
            light: Object.freeze({ width: 3, height: 3, range: 10 }),
            transform: Object.freeze({
                translation: Object.freeze([-2.5, 3, -2]),
                lookAt: Object.freeze([0, 0.5, 0]),
            }),
        }),
    }),
    "outdoor-neutral": Object.freeze({
        environment: Object.freeze({
            intensity: 0.85,
            color: Object.freeze([1, 1, 1, 1]),
            layerMask: 1,
        }),
        keyLight: Object.freeze({
            kind: "directional",
            intensity: 4,
            color: Object.freeze([1, 0.98, 0.94, 1]),
            transform: Object.freeze({
                rotationEulerDegrees: Object.freeze([-50, -30, 0]),
            }),
        }),
        rimLight: null,
    }),
    none: Object.freeze({
        environment: null,
        keyLight: null,
        rimLight: null,
    }),
});
//# sourceMappingURL=light-rig-presets.js.map