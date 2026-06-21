export const CameraProjection = {
    Perspective: "perspective",
    Orthographic: "orthographic",
};
export const LightKind = {
    Ambient: "ambient",
    Environment: "environment",
    Directional: "directional",
    Point: "point",
    Spot: "spot",
    RectArea: "rect-area",
};
export const AreaLightShape = {
    Rect: "rect",
    Disk: "disk",
    Sphere: "sphere",
};
export const FogMode = {
    Linear: "linear",
    Exp: "exp",
    Exp2: "exp2",
};
export const ProceduralSkyModel = {
    Gradient: "gradient",
};
export const SpriteCoordinateMode = {
    World: "world",
    Screen: "screen",
};
export const SpriteBillboardMode = {
    None: "none",
    Spherical: "spherical",
    Cylindrical: "cylindrical",
    AxisLocked: "axis-locked",
};
export const SpriteSizeMode = {
    WorldUnits: "world-units",
    ScreenPixels: "screen-pixels",
};
export const SpriteBlendMode = {
    Opaque: "opaque",
    Alpha: "alpha",
    Additive: "additive",
    Multiply: "multiply",
};
export const SpriteDepthMode = {
    Test: "test",
    Disabled: "disabled",
};
export const ParticleSimulationSpace = {
    World: "world",
    Local: "local",
};
export const AudioSimulationSpace = {
    /** Spatialized through a PannerNode from the emitter's world transform. */
    World: "world",
    /** Non-spatial / 2D (UI, music, ambience) — routed straight to its bus. */
    Local: "local",
};
export const AudioPanningModel = {
    EqualPower: "equalpower",
    Hrtf: "HRTF",
};
export const AudioDistanceModel = {
    Inverse: "inverse",
    Linear: "linear",
    Exponential: "exponential",
};
export const UiScreenScaleMode = {
    Fixed: "fixed",
    Viewport: "viewport",
};
export const UiLayoutMode = {
    Absolute: "absolute",
    Row: "row",
    Column: "column",
};
export const UiTextAlign = {
    Left: "left",
    Center: "center",
    Right: "right",
};
export const PickablePrecision = {
    Bounds: "bounds",
    VisualMesh: "visual-mesh",
    Collider: "collider",
};
export const MeshQueryAccelerationMode = {
    None: "none",
    AutoBvh: "auto-bvh",
    Bvh: "bvh",
};
export const MeshQueryAccelerationStrategy = {
    Center: "center",
    Average: "average",
    Sah: "sah",
};
export const MeshQueryDynamicPolicy = {
    Static: "static",
    Refit: "refit",
    Rebuild: "rebuild",
};
//# sourceMappingURL=authoring-types.js.map