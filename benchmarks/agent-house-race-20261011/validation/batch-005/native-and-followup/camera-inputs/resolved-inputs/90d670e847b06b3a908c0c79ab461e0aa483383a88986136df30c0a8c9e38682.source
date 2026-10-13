import { TypedArrayMap, Types, } from './types.js';
import { ErrorMessages, assertCondition, assertValidEnumValue, assertValidRangeValue, } from './checks.js';
export class ComponentRegistry {
    static record(component) {
        if (this.components.has(component.id)) {
            throw new Error(`Component with id '${component.id}' already exists. Each component must have a unique identifier.`);
        }
        this.components.set(component.id, component);
    }
    static getById(id) {
        return this.components.get(id);
    }
    static getAllComponents() {
        return Array.from(this.components.values());
    }
    static has(id) {
        return this.components.has(id);
    }
    static clear() {
        this.components.clear();
    }
}
ComponentRegistry.components = new Map();
export function createComponent(id, schema, description) {
    const component = {
        id,
        description,
        schema,
        data: {},
        bitmask: null,
        typeId: -1,
    };
    ComponentRegistry.record(component);
    return component;
}
export function initializeComponentStorage(component, entityCapacity) {
    const s = component.schema;
    component.data = {};
    for (const key in s) {
        const schemaField = s[key];
        const { type, default: defaultValue } = schemaField;
        let { arrayConstructor, length } = TypedArrayMap[type];
        // For Enum types, validate enum property exists
        if (type === Types.Enum) {
            assertCondition('enum' in schemaField, ErrorMessages.InvalidDefaultValue, `Enum type requires 'enum' property for field ${key}`);
        }
        assertCondition(!!arrayConstructor, ErrorMessages.TypeNotSupported, type);
        component.data[key] = new arrayConstructor(entityCapacity * length);
        assertCondition(length === 1 ||
            (Array.isArray(defaultValue) && defaultValue.length === length), ErrorMessages.InvalidDefaultValue, key);
    }
}
export function assignInitialComponentData(component, index, initialData) {
    var _a, _b, _c;
    const s = component.schema;
    for (const key in s) {
        const schemaField = s[key];
        const { type, default: defaultValue } = schemaField;
        const length = TypedArrayMap[type].length;
        const dataRef = component.data[key];
        const input = (_a = initialData[key]) !== null && _a !== void 0 ? _a : defaultValue;
        switch (type) {
            case Types.Entity: {
                const entityInput = input;
                dataRef[index] = entityInput
                    ? ((entityInput.generation & 0xff) << 24) |
                        (entityInput.index & 0xffffff)
                    : -1;
                break;
            }
            case Types.Enum:
                assertValidEnumValue(input, schemaField.enum, key);
                dataRef[index] = input;
                break;
            case Types.Int8:
            case Types.Int16:
            case Types.Int32:
            case Types.Float32:
            case Types.Float64:
                // For numeric types, validate range constraints if present
                if ('min' in schemaField || 'max' in schemaField) {
                    assertValidRangeValue(input, schemaField.min, schemaField.max, key);
                }
                dataRef[index] = input;
                break;
            case Types.FilePath:
            case Types.String:
                dataRef[index] = input;
                break;
            case Types.Object:
                dataRef[index] = input;
                break;
            case Types.Color: {
                const length = TypedArrayMap[type].length;
                const arr = (_b = input) !== null && _b !== void 0 ? _b : [1, 1, 1, 1];
                let clamped = false;
                for (let i = 0; i < 4; i++) {
                    let v = (_c = arr[i]) !== null && _c !== void 0 ? _c : 1;
                    if (v < 0) {
                        v = 0;
                        clamped = true;
                    }
                    else if (v > 1) {
                        v = 1;
                        clamped = true;
                    }
                    dataRef[index * length + i] = v;
                }
                if (clamped) {
                    console.warn(`Color values out of range for ${component.id}.${key}; clamped to [0,1].`);
                }
                break;
            }
            default:
                if (length === 1) {
                    dataRef[index] = input;
                }
                else {
                    dataRef.set(input, index * length);
                }
                break;
        }
    }
}
//# sourceMappingURL=component.js.map