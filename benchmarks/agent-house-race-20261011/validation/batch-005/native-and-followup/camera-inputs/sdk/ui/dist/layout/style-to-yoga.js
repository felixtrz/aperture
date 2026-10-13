import { Align as YogaAlign, Display as YogaDisplay, Edge, FlexDirection as YogaFlexDirection, Gutter, Justify as YogaJustify, Overflow as YogaOverflow, PositionType as YogaPositionType, Wrap as YogaWrap, } from "yoga-layout/load";
import { DEFAULT_LAYOUT_STYLE, } from "./types.js";
const FLEX_DIRECTION = {
    row: YogaFlexDirection.Row,
    "row-reverse": YogaFlexDirection.RowReverse,
    column: YogaFlexDirection.Column,
    "column-reverse": YogaFlexDirection.ColumnReverse,
};
const FLEX_WRAP = {
    "no-wrap": YogaWrap.NoWrap,
    wrap: YogaWrap.Wrap,
    "wrap-reverse": YogaWrap.WrapReverse,
};
const JUSTIFY = {
    "flex-start": YogaJustify.FlexStart,
    center: YogaJustify.Center,
    "flex-end": YogaJustify.FlexEnd,
    "space-between": YogaJustify.SpaceBetween,
    "space-around": YogaJustify.SpaceAround,
    "space-evenly": YogaJustify.SpaceEvenly,
};
const ALIGN = {
    auto: YogaAlign.Auto,
    "flex-start": YogaAlign.FlexStart,
    center: YogaAlign.Center,
    "flex-end": YogaAlign.FlexEnd,
    stretch: YogaAlign.Stretch,
    baseline: YogaAlign.Baseline,
    "space-between": YogaAlign.SpaceBetween,
    "space-around": YogaAlign.SpaceAround,
    "space-evenly": YogaAlign.SpaceEvenly,
};
const POSITION_TYPE = {
    static: YogaPositionType.Static,
    relative: YogaPositionType.Relative,
    absolute: YogaPositionType.Absolute,
};
const OVERFLOW = {
    visible: YogaOverflow.Visible,
    hidden: YogaOverflow.Hidden,
    scroll: YogaOverflow.Scroll,
};
const DISPLAY = {
    flex: YogaDisplay.Flex,
    none: YogaDisplay.None,
    contents: YogaDisplay.Contents,
};
const INSET_EDGES = [
    [Edge.Top, "top"],
    [Edge.Right, "right"],
    [Edge.Bottom, "bottom"],
    [Edge.Left, "left"],
];
/**
 * Apply a complete {@link LayoutStyle} to a Yoga node. Every property is written
 * each call (using {@link DEFAULT_LAYOUT_STYLE} for unset fields), so a style
 * update fully overwrites the previous one — including clearing removed
 * properties. Yoga dirties a node only when a value actually changes, so writing
 * unchanged values is cheap.
 */
export function applyStyleToYogaNode(node, style) {
    const d = DEFAULT_LAYOUT_STYLE;
    node.setDisplay(DISPLAY[style.display ?? d.display]);
    node.setFlexDirection(FLEX_DIRECTION[style.flexDirection ?? d.flexDirection]);
    node.setFlexWrap(FLEX_WRAP[style.flexWrap ?? d.flexWrap]);
    node.setFlexGrow(style.flexGrow ?? d.flexGrow);
    node.setFlexShrink(style.flexShrink ?? d.flexShrink);
    node.setFlexBasis(style.flexBasis ?? d.flexBasis);
    node.setJustifyContent(JUSTIFY[style.justifyContent ?? d.justifyContent]);
    node.setAlignItems(ALIGN[style.alignItems ?? d.alignItems]);
    node.setAlignSelf(ALIGN[style.alignSelf ?? d.alignSelf]);
    node.setAlignContent(ALIGN[style.alignContent ?? d.alignContent]);
    const gap = style.gap ?? d.gap;
    node.setGap(Gutter.Row, style.rowGap ?? gap);
    node.setGap(Gutter.Column, style.columnGap ?? gap);
    node.setWidth(style.width ?? d.width);
    node.setHeight(style.height ?? d.height);
    node.setMinWidth(style.minWidth);
    node.setMinHeight(style.minHeight);
    node.setMaxWidth(style.maxWidth);
    node.setMaxHeight(style.maxHeight);
    node.setAspectRatio(style.aspectRatio);
    node.setPositionType(POSITION_TYPE[style.positionType ?? d.positionType]);
    for (const [edge, key] of INSET_EDGES) {
        const value = style[key];
        if (value === undefined) {
            node.setPositionAuto(edge);
        }
        else {
            node.setPosition(edge, value);
        }
    }
    const padding = style.padding ?? d.padding;
    node.setPadding(Edge.Top, style.paddingTop ?? padding);
    node.setPadding(Edge.Right, style.paddingRight ?? padding);
    node.setPadding(Edge.Bottom, style.paddingBottom ?? padding);
    node.setPadding(Edge.Left, style.paddingLeft ?? padding);
    const margin = style.margin ?? d.margin;
    setMargin(node, Edge.Top, style.marginTop ?? margin);
    setMargin(node, Edge.Right, style.marginRight ?? margin);
    setMargin(node, Edge.Bottom, style.marginBottom ?? margin);
    setMargin(node, Edge.Left, style.marginLeft ?? margin);
    const border = style.border ?? d.border;
    node.setBorder(Edge.Top, style.borderTop ?? border);
    node.setBorder(Edge.Right, style.borderRight ?? border);
    node.setBorder(Edge.Bottom, style.borderBottom ?? border);
    node.setBorder(Edge.Left, style.borderLeft ?? border);
    node.setOverflow(OVERFLOW[style.overflow ?? d.overflow]);
}
function setMargin(node, edge, value) {
    if (value === "auto") {
        node.setMarginAuto(edge);
    }
    else {
        node.setMargin(edge, value);
    }
}
//# sourceMappingURL=style-to-yoga.js.map