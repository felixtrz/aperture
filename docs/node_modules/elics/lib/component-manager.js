import { assignInitialComponentData, initializeComponentStorage, } from './component.js';
import BitSet from './bit-set.js';
export class ComponentManager {
    constructor(entityCapacity) {
        this.entityCapacity = entityCapacity;
        this.nextComponentTypeId = 0;
        this.componentsByTypeId = [];
    }
    hasComponent(component) {
        return (component.typeId !== -1 &&
            this.componentsByTypeId[component.typeId] === component);
    }
    registerComponent(component) {
        if (this.hasComponent(component)) {
            return;
        }
        const typeId = this.nextComponentTypeId++;
        component.bitmask = new BitSet();
        component.bitmask.set(typeId, 1);
        component.typeId = typeId;
        initializeComponentStorage(component, this.entityCapacity);
        this.componentsByTypeId[typeId] = component;
    }
    attachComponentToEntity(entityIndex, component, initialData) {
        assignInitialComponentData(component, entityIndex, initialData);
    }
    getComponentByTypeId(typeId) {
        var _a;
        return (_a = this.componentsByTypeId[typeId]) !== null && _a !== void 0 ? _a : null;
    }
}
//# sourceMappingURL=component-manager.js.map