import { parseFailure } from "./hdr-rgbe-diagnostics.js";
class ByteLineReader {
    bytes;
    #offset = 0;
    constructor(bytes) {
        this.bytes = bytes;
    }
    get offset() {
        return this.#offset;
    }
    readLine() {
        if (this.#offset >= this.bytes.length) {
            return null;
        }
        const start = this.#offset;
        let end = start;
        while (end < this.bytes.length && this.bytes[end] !== 0x0a) {
            end += 1;
        }
        this.#offset = end < this.bytes.length ? end + 1 : end;
        if (end > start && this.bytes[end - 1] === 0x0d) {
            end -= 1;
        }
        return new TextDecoder("ascii").decode(this.bytes.subarray(start, end));
    }
}
export function readHdrHeader(bytes) {
    const reader = new ByteLineReader(bytes);
    const firstLine = reader.readLine();
    if (firstLine === null || !firstLine.startsWith("#?")) {
        return parseFailure("hdrRgbe.invalidHeader", "Radiance HDR data must start with a '#?' magic header.");
    }
    const headerLines = [firstLine];
    let format = "";
    let gamma = 1;
    let exposure = 1;
    let resolutionLine;
    for (;;) {
        const line = reader.readLine();
        if (line === null) {
            return parseFailure("hdrRgbe.invalidResolution", "Radiance HDR header ended before a resolution line.");
        }
        headerLines.push(line);
        if (line.length === 0) {
            resolutionLine = reader.readLine();
            if (resolutionLine !== null) {
                headerLines.push(resolutionLine);
            }
            break;
        }
        const equals = line.indexOf("=");
        if (equals === -1) {
            continue;
        }
        const key = line.slice(0, equals).trim();
        const value = line.slice(equals + 1).trim();
        if (key === "FORMAT") {
            format = value;
        }
        else if (key === "GAMMA") {
            gamma = finitePositiveNumber(value, 1);
        }
        else if (key === "EXPOSURE") {
            exposure = finitePositiveNumber(value, 1);
        }
    }
    if (format !== "32-bit_rle_rgbe") {
        return parseFailure("hdrRgbe.unsupportedFormat", `Radiance HDR FORMAT must be '32-bit_rle_rgbe', not '${format || "missing"}'.`);
    }
    if (resolutionLine === undefined || resolutionLine === null) {
        return parseFailure("hdrRgbe.invalidResolution", "Radiance HDR header is missing a resolution line.");
    }
    const resolution = /^([+-]Y)\s+(\d+)\s+([+-]X)\s+(\d+)$/u.exec(resolutionLine);
    if (resolution === null) {
        return parseFailure("hdrRgbe.invalidResolution", `Radiance HDR resolution '${resolutionLine}' is not supported.`);
    }
    const height = Number(resolution[2]);
    const width = Number(resolution[4]);
    if (!Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0) {
        return parseFailure("hdrRgbe.invalidResolution", `Radiance HDR resolution '${resolutionLine}' must contain positive dimensions.`);
    }
    return {
        ok: true,
        header: {
            text: `${headerLines.join("\n")}\n`,
            format,
            width,
            height,
            gamma,
            exposure,
            dataOffset: reader.offset,
        },
    };
}
function finitePositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
//# sourceMappingURL=hdr-rgbe-header.js.map