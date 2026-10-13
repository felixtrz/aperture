import { ComponentManager } from './component-manager.js';
import { EntityManager } from './entity-manager.js';
import { QueryManager } from './query-manager.js';
import { toggleChecks } from './checks.js';
export class World {
    constructor({ entityCapacity = 1000, checksOn = true, entityReleaseCallback, } = {}) {
        this.systems = [];
        this.globals = {};
        this.componentManager = new ComponentManager(entityCapacity);
        this.queryManager = new QueryManager(this.componentManager);
        this.entityManager = new EntityManager(this.queryManager, this.componentManager, entityReleaseCallback);
        toggleChecks(checksOn);
    }
    registerComponent(component) {
        this.componentManager.registerComponent(component);
        return this;
    }
    hasComponent(component) {
        return this.componentManager.hasComponent(component);
    }
    createEntity() {
        return this.entityManager.requestEntityInstance();
    }
    registerSystem(systemClass, options = {}) {
        if (this.hasSystem(systemClass)) {
            console.warn(`System ${systemClass.name} is already registered, skipping registration.`);
            return this;
        }
        const { configData = {}, priority = 0 } = options;
        const queries = {};
        Object.entries(systemClass.queries).forEach(([queryName, queryConfig]) => {
            queries[queryName] =
                this.queryManager.registerQuery(queryConfig);
        });
        const systemInstance = new systemClass(this, this.queryManager, priority);
        systemInstance.queries = queries;
        Object.entries(configData).forEach(([key, value]) => {
            if (key in systemInstance.config) {
                const cfg = systemInstance.config;
                cfg[key].value = value;
            }
        });
        systemInstance.init();
        // Determine the correct position for the new system based on priority
        const insertIndex = this.systems.findIndex((s) => s.priority > systemInstance.priority);
        if (insertIndex === -1) {
            this.systems.push(systemInstance);
        }
        else {
            this.systems.splice(insertIndex, 0, systemInstance);
        }
        return this;
    }
    unregisterSystem(systemClass) {
        const systemInstance = this.getSystem(systemClass);
        if (systemInstance) {
            systemInstance.destroy();
            this.systems = this.systems.filter((system) => !(system instanceof systemClass));
        }
    }
    registerQuery(queryConfig) {
        this.queryManager.registerQuery(queryConfig);
        return this;
    }
    update(delta, time) {
        for (const system of this.systems) {
            if (!system.isPaused) {
                system.update(delta, time);
            }
        }
    }
    getSystem(systemClass) {
        for (const system of this.systems) {
            if (system instanceof systemClass) {
                return system;
            }
        }
        return undefined;
    }
    getSystems() {
        return this.systems;
    }
    hasSystem(systemClass) {
        return this.systems.some((system) => system instanceof systemClass);
    }
}
//# sourceMappingURL=world.js.map