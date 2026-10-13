import { Types } from './types.js';
import BitSet from './bit-set.js';
export class Query {
    constructor(requiredMask, excludedMask, queryId, valuePredicates = []) {
        this.requiredMask = requiredMask;
        this.excludedMask = excludedMask;
        this.queryId = queryId;
        this.subscribers = {
            qualify: new Set(),
            disqualify: new Set(),
        };
        this.entities = new Set();
        this.valuePredicates = [];
        this.valuePredicates = valuePredicates;
    }
    matches(entity) {
        // Excluded: if any excluded bit is present on entity -> no match
        if (!this.excludedMask.isEmpty() &&
            this.excludedMask.intersects(entity.bitmask)) {
            return false;
        }
        // Required: entity must contain all required bits
        if (!entity.bitmask.contains(this.requiredMask)) {
            return false;
        }
        // Value predicates: verify values
        if (this.valuePredicates.length > 0) {
            for (const p of this.valuePredicates) {
                const v = entity.getValue(p.component, p.key);
                switch (p.op) {
                    case 'eq':
                        if (v !== p.value) {
                            return false;
                        }
                        break;
                    case 'ne':
                        if (v === p.value) {
                            return false;
                        }
                        break;
                    case 'lt':
                        if (!(typeof v === 'number' &&
                            typeof p.value === 'number' &&
                            v < p.value)) {
                            return false;
                        }
                        break;
                    case 'le':
                        if (!(typeof v === 'number' &&
                            typeof p.value === 'number' &&
                            v <= p.value)) {
                            return false;
                        }
                        break;
                    case 'gt':
                        if (!(typeof v === 'number' &&
                            typeof p.value === 'number' &&
                            v > p.value)) {
                            return false;
                        }
                        break;
                    case 'ge':
                        if (!(typeof v === 'number' &&
                            typeof p.value === 'number' &&
                            v >= p.value)) {
                            return false;
                        }
                        break;
                    case 'in':
                        if (!p.valueSet || !p.valueSet.has(v)) {
                            return false;
                        }
                        break;
                    case 'nin':
                        if (p.valueSet && p.valueSet.has(v)) {
                            return false;
                        }
                        break;
                }
            }
        }
        return true;
    }
    subscribe(event, callback, replayExisting = false) {
        this.subscribers[event].add(callback);
        if (event === 'qualify' && replayExisting) {
            for (const e of this.entities) {
                callback(e);
            }
        }
        return () => {
            this.subscribers[event].delete(callback);
        };
    }
    static generateQueryInfo(queryConfig) {
        var _a;
        const requiredMask = new BitSet();
        const excludedMask = new BitSet();
        for (const c of queryConfig.required) {
            requiredMask.orInPlace(c.bitmask);
        }
        if (queryConfig.excluded) {
            for (const c of queryConfig.excluded) {
                excludedMask.orInPlace(c.bitmask);
            }
        }
        // Normalize and validate predicates
        const rawPreds = (_a = queryConfig.where) !== null && _a !== void 0 ? _a : [];
        const preds = rawPreds.map((p) => {
            const schema = p.component.schema[p.key];
            if (!schema) {
                throw new Error(`Predicate key '${p.key}' not found on component ${p.component.id}`);
            }
            const t = schema.type;
            // Validate operator applicability
            switch (p.op) {
                case 'lt':
                case 'le':
                case 'gt':
                case 'ge':
                    if (!(t === Types.Int8 ||
                        t === Types.Int16 ||
                        t === Types.Int32 ||
                        t === Types.Float32 ||
                        t === Types.Float64)) {
                        throw new Error(`Operator '${p.op}' only valid for numeric fields: ${p.component.id}.${p.key}`);
                    }
                    break;
                case 'in':
                case 'nin':
                    if (!Array.isArray(p.value)) {
                        throw new Error(`Operator '${p.op}' requires array value for ${p.component.id}.${p.key}`);
                    }
                    break;
                default:
                    // eq, ne valid for all
                    break;
            }
            const np = { ...p };
            if (p.op === 'in' || p.op === 'nin') {
                np.valueSet = new Set(p.value);
            }
            return np;
        });
        for (const p of preds) {
            requiredMask.orInPlace(p.component.bitmask);
        }
        const whereStr = preds
            .map((p) => `${p.component.typeId}:${p.key}:${p.op}=${Array.isArray(p.value) ? 'arr' : String(p.value)}`)
            .join(',');
        return {
            requiredMask,
            excludedMask,
            queryId: `required:${requiredMask.toString()}|excluded:${excludedMask.toString()}|where:${whereStr}`,
            valuePredicates: preds,
        };
    }
}
//# sourceMappingURL=query.js.map