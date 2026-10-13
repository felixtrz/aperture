import { EcsType, type ComponentInitialData, type EcsWorld, type Entity } from "@aperture-engine/simulation";
export declare const UiInputType: {
    readonly Text: "text";
    readonly Password: "password";
};
export type UiInputType = (typeof UiInputType)[keyof typeof UiInputType];
/**
 * Editable text input state. Holds the value, caret/selection, focus, and type.
 * The caret/anchor are character indices. A main-thread hidden-DOM input mirror
 * (for IME / mobile keyboards) feeds edits in through this component; the
 * extractor renders the value (masked for password), caret, and selection.
 */
export declare const UiInput: import("elics").Component<{
    value: {
        type: EcsType.String;
        default: string;
    };
    placeholder: {
        type: EcsType.String;
        default: string;
    };
    type: {
        type: EcsType.Enum;
        enum: {
            readonly Text: "text";
            readonly Password: "password";
        };
        default: "text";
    };
    caret: {
        type: EcsType.Int32;
        default: number;
    };
    anchor: {
        type: EcsType.Int32;
        default: number;
    };
    focused: {
        type: EcsType.Boolean;
        default: false;
    };
    editable: {
        type: EcsType.Boolean;
        default: true;
    };
    maxLength: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export interface UiInputInput {
    readonly value?: string;
    readonly placeholder?: string;
    readonly type?: UiInputType;
    readonly caret?: number;
    readonly anchor?: number;
    readonly focused?: boolean;
    readonly editable?: boolean;
    readonly maxLength?: number;
}
export declare function createUiInput(input?: UiInputInput): ComponentInitialData<typeof UiInput>;
export declare function withUiInput(input?: UiInputInput): (entity: Entity, context: {
    readonly world: EcsWorld;
}) => void;
//# sourceMappingURL=ui-input.d.ts.map