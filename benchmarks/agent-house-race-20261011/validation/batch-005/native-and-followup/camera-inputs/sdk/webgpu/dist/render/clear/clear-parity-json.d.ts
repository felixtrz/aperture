import type { ClearParityReport } from "./clear-parity.js";
export interface ClearParityReportJsonValue {
    readonly ready: boolean;
    readonly clearReady: boolean;
    readonly boundaryReady: boolean;
    readonly diagnostics: ClearParityReport["diagnostics"];
}
export declare function clearParityReportToJsonValue(report: ClearParityReport): ClearParityReportJsonValue;
export declare function clearParityReportToJson(report: ClearParityReport): string;
//# sourceMappingURL=clear-parity-json.d.ts.map