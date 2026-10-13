import type { Node } from "yoga-layout/load";
import { type LayoutStyle } from "./types.js";
/**
 * Apply a complete {@link LayoutStyle} to a Yoga node. Every property is written
 * each call (using {@link DEFAULT_LAYOUT_STYLE} for unset fields), so a style
 * update fully overwrites the previous one — including clearing removed
 * properties. Yoga dirties a node only when a value actually changes, so writing
 * unchanged values is cheap.
 */
export declare function applyStyleToYogaNode(node: Node, style: LayoutStyle): void;
//# sourceMappingURL=style-to-yoga.d.ts.map