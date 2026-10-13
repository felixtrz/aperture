import { Entity } from './entity.js';
export class EntityManager {
    constructor(queryManager, componentManager, entityReleaseCallback) {
        this.queryManager = queryManager;
        this.componentManager = componentManager;
        this.entityReleaseCallback = entityReleaseCallback;
        this.pool = [];
        this.entityIndex = 0;
        this.indexLookup = [];
        this.poolSize = 0;
    }
    requestEntityInstance() {
        let entity;
        if (this.poolSize > 0) {
            entity = this.pool[--this.poolSize];
            entity.active = true;
            entity.generation = (entity.generation + 1) & 0xff; // 8-bit wrap
        }
        else {
            entity = new Entity(this, this.queryManager, this.componentManager, this.entityIndex++);
        }
        this.indexLookup[entity.index] = entity;
        return entity;
    }
    releaseEntityInstance(entity) {
        var _a;
        (_a = this.entityReleaseCallback) === null || _a === void 0 ? void 0 : _a.call(this, entity);
        this.indexLookup[entity.index] = null;
        this.pool[this.poolSize++] = entity;
    }
    getEntityByIndex(index) {
        var _a;
        if (index === -1) {
            return null;
        }
        return (_a = this.indexLookup[index]) !== null && _a !== void 0 ? _a : null;
    }
    /**
     * Pack an entity reference into a 32-bit value containing both index and generation.
     * Format: [8 bits generation][24 bits index]
     * This allows up to 16 million unique entity indices and 256 generations per slot.
     */
    packEntityRef(entity) {
        if (entity === null) {
            return -1;
        }
        return ((entity.generation & 0xff) << 24) | (entity.index & 0xffffff);
    }
    /**
     * Unpack and resolve an entity reference, returning null if the entity
     * has been destroyed (generation mismatch) or doesn't exist.
     */
    getEntityByPackedRef(packedRef) {
        if (packedRef === -1) {
            return null;
        }
        const index = packedRef & 0xffffff;
        const generation = (packedRef >>> 24) & 0xff;
        const entity = this.indexLookup[index];
        if (entity && entity.generation === generation) {
            return entity;
        }
        return null;
    }
}
//# sourceMappingURL=entity-manager.js.map