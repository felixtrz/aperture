import { withTransform, withUiHitTarget, withUiImage, withUiNode, withUiPanel, withUiScreen, withUiText, } from "@aperture-engine/runtime";
import { withUiFlex } from "../components/ui-flex.js";
import { withUiBox } from "../components/ui-box.js";
import { withUiFreezeLayout } from "../components/ui-freeze.js";
function toPaddingTuple(padding) {
    if (padding === undefined) {
        return undefined;
    }
    return typeof padding === "number"
        ? [padding, padding, padding, padding]
        : [padding[0], padding[1], padding[2], padding[3]];
}
function nodeInitializer(props) {
    const padding = toPaddingTuple(props.padding);
    return withUiNode({
        ...(props.x === undefined ? {} : { x: props.x }),
        ...(props.y === undefined ? {} : { y: props.y }),
        ...(props.width === undefined ? {} : { width: props.width }),
        ...(props.height === undefined ? {} : { height: props.height }),
        ...(padding === undefined ? {} : { padding }),
        ...(props.gap === undefined ? {} : { gap: props.gap }),
        ...(props.zIndex === undefined ? {} : { zIndex: props.zIndex }),
        ...(props.opacity === undefined ? {} : { opacity: props.opacity }),
        ...(props.clip === undefined ? {} : { clip: props.clip }),
    });
}
function hasBorder(props) {
    return (props.borderRadius !== undefined ||
        props.borderWidth !== undefined ||
        props.borderColor !== undefined);
}
function boxInitializers(props) {
    const init = [
        nodeInitializer(props),
        withUiFlex(props),
    ];
    if (hasBorder(props)) {
        init.push(withUiBox({
            ...(props.borderRadius === undefined
                ? {}
                : { borderRadius: props.borderRadius }),
            ...(props.borderWidth === undefined
                ? {}
                : { borderWidth: props.borderWidth }),
            ...(props.borderColor === undefined
                ? {}
                : { borderColor: props.borderColor }),
        }));
    }
    if (props.backgroundColor !== undefined) {
        init.push(withUiPanel({ color: props.backgroundColor }));
    }
    if (props.cursor !== undefined || props.priority !== undefined) {
        init.push(withUiHitTarget({
            ...(props.cursor === undefined ? {} : { cursor: props.cursor }),
            ...(props.priority === undefined ? {} : { priority: props.priority }),
        }));
    }
    if (props.frozen === true) {
        init.push(withUiFreezeLayout());
    }
    return init;
}
/** A UI screen root. Its children flex-flow within the screen rectangle. */
export function screen(props = {}, children = []) {
    return {
        initializers: [
            withUiScreen({
                ...(props.width === undefined ? {} : { width: props.width }),
                ...(props.height === undefined ? {} : { height: props.height }),
                ...(props.layerMask === undefined
                    ? {}
                    : { layerMask: props.layerMask }),
            }),
            // A UiNode carries the screen's padding/gap (size comes from UiScreen).
            nodeInitializer(props),
            withUiFlex(props),
        ],
        children,
    };
}
/** A flex container (column by default). */
export function box(props = {}, children = []) {
    return { initializers: boxInitializers(props), children };
}
/** A horizontal flex container. */
export function row(props = {}, children = []) {
    return box({ ...props, flexDirection: props.flexDirection ?? "row" }, children);
}
/** A vertical flex container. */
export function column(props = {}, children = []) {
    return box({ ...props, flexDirection: props.flexDirection ?? "column" }, children);
}
/** A text leaf. */
export function text(content, props = {}) {
    return {
        initializers: [
            ...boxInitializers(props),
            withUiText({
                text: content,
                ...(props.color === undefined ? {} : { color: props.color }),
                ...(props.fontSize === undefined ? {} : { fontSize: props.fontSize }),
                ...(props.lineHeight === undefined
                    ? {}
                    : { lineHeight: props.lineHeight }),
                ...(props.maxWidth === undefined ? {} : { maxWidth: props.maxWidth }),
                ...(props.fontAtlasId === undefined
                    ? {}
                    : { fontAtlasId: props.fontAtlasId }),
                ...(props.align === undefined ? {} : { align: props.align }),
            }),
        ],
        children: [],
    };
}
/** A textured image leaf. */
export function image(props) {
    return {
        initializers: [
            ...boxInitializers(props),
            withUiImage({
                texture: props.texture,
                ...(props.sampler === undefined ? {} : { sampler: props.sampler }),
                ...(props.tint === undefined ? {} : { color: props.tint }),
                ...(props.uvRect === undefined ? {} : { uvRect: props.uvRect }),
            }),
        ],
        children: [],
    };
}
/** An interactive button: a flex container with a hit target (cursor pointer). */
export function button(props = {}, children = []) {
    return box({
        cursor: props.cursor ?? "pointer",
        priority: props.priority ?? 1,
        ...props,
    }, children);
}
/** Namespace of element builders, for `ui.column(...)`-style authoring. */
export const ui = { screen, box, row, column, text, image, button };
/**
 * Spawn a {@link UiElement} tree into the world, wiring parent links. Returns the
 * root entity.
 */
export function mountUi(target, element, parent) {
    const initializers = parent === undefined
        ? [...element.initializers]
        : [...element.initializers, withTransform({ parent })];
    const entity = target.spawn(...initializers);
    for (const child of element.children) {
        mountUi(target, child, entity);
    }
    return entity;
}
//# sourceMappingURL=builder.js.map