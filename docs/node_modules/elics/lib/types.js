export var Types;
(function (Types) {
    Types["Int8"] = "Int8";
    Types["Int16"] = "Int16";
    Types["Int32"] = "Int32";
    Types["Entity"] = "Entity";
    Types["Float32"] = "Float32";
    Types["Float64"] = "Float64";
    Types["Boolean"] = "Boolean";
    Types["String"] = "String";
    Types["FilePath"] = "FilePath";
    Types["Object"] = "Object";
    Types["Vec2"] = "Vec2";
    Types["Vec3"] = "Vec3";
    Types["Vec4"] = "Vec4";
    Types["Color"] = "Color";
    Types["Enum"] = "Enum";
})(Types || (Types = {}));
export const TypedArrayMap = {
    Int8: { arrayConstructor: Int8Array, length: 1 },
    Int16: { arrayConstructor: Int16Array, length: 1 },
    Int32: { arrayConstructor: Int32Array, length: 1 },
    Entity: { arrayConstructor: Int32Array, length: 1 },
    Float32: { arrayConstructor: Float32Array, length: 1 },
    Float64: { arrayConstructor: Float64Array, length: 1 },
    Boolean: { arrayConstructor: Uint8Array, length: 1 },
    String: { arrayConstructor: Array, length: 1 },
    FilePath: { arrayConstructor: Array, length: 1 },
    Object: { arrayConstructor: Array, length: 1 },
    Vec2: { arrayConstructor: Float32Array, length: 2 },
    Vec3: { arrayConstructor: Float32Array, length: 3 },
    Vec4: { arrayConstructor: Float32Array, length: 4 },
    Color: { arrayConstructor: Float32Array, length: 4 },
    Enum: { arrayConstructor: Array, length: 1 },
};
//# sourceMappingURL=types.js.map