import { signal } from '@preact/signals-core';
export function createSystem(queries = {}, schema = {}) {
    var _a;
    return _a = class {
            constructor(world, queryManager, priority) {
                this.world = world;
                this.queryManager = queryManager;
                this.priority = priority;
                this.isPaused = false;
                this.config = {};
                for (const key in schema) {
                    const k = key;
                    // Initialize config signals with strongly-typed defaults
                    this.config[k] = signal(schema[k].default);
                }
            }
            get globals() {
                return this.world.globals;
            }
            createEntity() {
                return this.world.createEntity();
            }
            init() { }
            update(_delta, _time) { }
            play() {
                this.isPaused = false;
            }
            stop() {
                this.isPaused = true;
            }
            destroy() { }
        },
        _a.schema = schema,
        _a.isSystem = true,
        _a.queries = queries,
        _a;
}
//# sourceMappingURL=system.js.map