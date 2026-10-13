import { Direction, Edge, MeasureMode as YogaMeasureMode, } from "yoga-layout/load";
import { applyStyleToYogaNode } from "./style-to-yoga.js";
class YogaHandle {
    id;
    node;
    measure = null;
    constructor(id, node) {
        this.id = id;
        this.node = node;
    }
}
const MEASURE_MODE = {
    [YogaMeasureMode.Undefined]: "undefined",
    [YogaMeasureMode.Exactly]: "exactly",
    [YogaMeasureMode.AtMost]: "at-most",
};
/**
 * Create a Yoga-backed {@link LayoutEngine}. Pass the module returned by
 * `loadLayoutModule()`. The engine owns one Yoga `Config`; call `dispose()` to
 * free it when the engine is discarded.
 */
export function createYogaLayoutEngine(yoga, options = {}) {
    const config = yoga.Config.create();
    config.setPointScaleFactor(options.pointScaleFactor ?? 1);
    let nextId = 1;
    const asYoga = (handle) => handle;
    return {
        createNode() {
            return new YogaHandle(nextId++, yoga.Node.createWithConfig(config));
        },
        setStyle(handle, style) {
            applyStyleToYogaNode(asYoga(handle).node, style);
        },
        setMeasure(handle, measure) {
            const wrapped = asYoga(handle);
            wrapped.measure = measure;
            if (measure === null) {
                wrapped.node.setMeasureFunc(null);
                return;
            }
            wrapped.node.setMeasureFunc((width, widthMode, height, heightMode) => measure(width, MEASURE_MODE[widthMode], height, MEASURE_MODE[heightMode]));
        },
        insertChild(parent, child, index) {
            asYoga(parent).node.insertChild(asYoga(child).node, index);
        },
        removeChild(parent, child) {
            asYoga(parent).node.removeChild(asYoga(child).node);
        },
        childCount(handle) {
            return asYoga(handle).node.getChildCount();
        },
        markDirty(handle) {
            asYoga(handle).node.markDirty();
        },
        isDirty(handle) {
            return asYoga(handle).node.isDirty();
        },
        calculate(handle, availableWidth, availableHeight) {
            asYoga(handle).node.calculateLayout(availableWidth, availableHeight, Direction.LTR);
        },
        getComputed(handle) {
            const node = asYoga(handle).node;
            const layout = node.getComputedLayout();
            return {
                left: layout.left,
                top: layout.top,
                width: layout.width,
                height: layout.height,
                paddingTop: node.getComputedPadding(Edge.Top),
                paddingRight: node.getComputedPadding(Edge.Right),
                paddingBottom: node.getComputedPadding(Edge.Bottom),
                paddingLeft: node.getComputedPadding(Edge.Left),
                borderTop: node.getComputedBorder(Edge.Top),
                borderRight: node.getComputedBorder(Edge.Right),
                borderBottom: node.getComputedBorder(Edge.Bottom),
                borderLeft: node.getComputedBorder(Edge.Left),
            };
        },
        free(handle) {
            asYoga(handle).node.free();
        },
        freeRecursive(handle) {
            asYoga(handle).node.freeRecursive();
        },
        dispose() {
            config.free();
        },
    };
}
//# sourceMappingURL=yoga-engine.js.map