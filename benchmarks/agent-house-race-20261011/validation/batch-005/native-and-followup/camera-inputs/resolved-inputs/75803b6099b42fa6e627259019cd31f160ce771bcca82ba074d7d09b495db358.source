import { TypedArrayMap, Types, } from './types.js';
import { assertValidEnumValue, assertValidRangeValue } from './checks.js';
import BitSet from './bit-set.js';
export class Entity {
    constructor(entityManager, queryManager, componentManager, index) {
        this.entityManager = entityManager;
        this.queryManager = queryManager;
        this.componentManager = componentManager;
        this.index = index;
        this.bitmask = new BitSet();
        this.active = true;
        this.generation = 0;
        this.vectorViews = new Map();
    }
    addComponent(component, initialData = {}) {
        if (!this.active) {
            console.warn(`Entity ${this.index} is destroyed, cannot add component ${component.schema}`);
        }
        else {
            if (component.bitmask === null) {
                this.componentManager.registerComponent(component);
            }
            this.bitmask.orInPlace(component.bitmask);
            this.componentManager.attachComponentToEntity(this.index, component, initialData);
            this.queryManager.updateEntity(this, component);
        }
        return this;
    }
    removeComponent(component) {
        if (!this.active) {
            console.warn(`Entity ${this.index} is destroyed, cannot remove component ${component.schema}`);
        }
        else if (component.bitmask) {
            this.bitmask.andNotInPlace(component.bitmask);
            this.vectorViews.delete(component);
            this.queryManager.updateEntity(this, component);
        }
        return this;
    }
    hasComponent(component) {
        return this.bitmask.intersects(component.bitmask);
    }
    getComponents() {
        const bitArray = this.bitmask.toArray();
        return bitArray.map((typeId) => this.componentManager.getComponentByTypeId(typeId));
    }
    getValue(component, key) {
        // allow runtime access with invalid keys, return null
        const schemaEntry = component.schema[key];
        if (!schemaEntry) {
            return null;
        }
        const dataContainer = component.data[key];
        const indexed = dataContainer;
        const data = indexed ? indexed[this.index] : undefined;
        const type = schemaEntry.type;
        switch (type) {
            case Types.Vec2:
            case Types.Vec3:
            case Types.Vec4:
            case Types.Color:
                throw new Error('Array/vector types must be read via getVectorView(component, key).');
            case Types.Boolean:
                return Boolean(data);
            case Types.Entity:
                return this.entityManager.getEntityByPackedRef(data);
            default:
                return data;
        }
    }
    setValue(component, key, value) {
        const componentData = component.data[key];
        const schemaField = component.schema[key];
        const type = schemaField.type;
        switch (type) {
            case Types.Vec2:
            case Types.Vec3:
            case Types.Vec4:
            case Types.Color:
                throw new Error('Array/vector types must be written via getVectorView(component, key).');
            case Types.Enum:
                // enum property is guaranteed to exist due to initialization validation
                assertValidEnumValue(value, schemaField.enum, key);
                componentData[this.index] =
                    value;
                break;
            case Types.Int8:
            case Types.Int16:
            case Types.Int32:
            case Types.Float32:
            case Types.Float64:
                // For numeric types, validate range constraints if present
                if ('min' in schemaField || 'max' in schemaField) {
                    assertValidRangeValue(value, schemaField.min, schemaField.max, key);
                }
                componentData[this.index] =
                    value;
                break;
            case Types.Entity:
                componentData[this.index] =
                    this.entityManager.packEntityRef(value);
                break;
            default:
                componentData[this.index] =
                    value;
                break;
        }
        // Notify only queries that depend on this component's values
        this.queryManager.updateEntityValue(this, component);
    }
    getVectorView(component, key) {
        var _a;
        const keyStr = key;
        const cachedVectorView = (_a = this.vectorViews.get(component)) === null || _a === void 0 ? void 0 : _a.get(keyStr);
        if (cachedVectorView) {
            return cachedVectorView;
        }
        else {
            const componentData = component.data[key];
            const type = component.schema[key].type;
            const length = TypedArrayMap[type].length;
            const offset = this.index * length;
            const vectorView = componentData.subarray(offset, offset + length);
            if (!this.vectorViews.has(component)) {
                this.vectorViews.set(component, new Map());
            }
            this.vectorViews.get(component).set(keyStr, vectorView);
            return vectorView;
        }
    }
    destroy() {
        if (this.active) {
            this.active = false;
            this.bitmask.clear();
            this.vectorViews.clear();
            this.queryManager.resetEntity(this);
            this.entityManager.releaseEntityInstance(this);
        }
    }
}
//# sourceMappingURL=entity.js.map