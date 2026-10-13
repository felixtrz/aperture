/** Invalid heightfield input, with a stable field, row, or sample location. */
export class HeightfieldMeshError extends RangeError {
    path;
    constructor(path, reason) {
        super(`${path} ${reason}`);
        this.name = "HeightfieldMeshError";
        this.path = path;
    }
}
export function readHeightfieldGrid(options) {
    if (options === null ||
        typeof options !== "object" ||
        Array.isArray(options)) {
        throw new HeightfieldMeshError("options", "must be an object.");
    }
    if (options.label !== undefined && typeof options.label !== "string") {
        throw new HeightfieldMeshError("label", "must be a string.");
    }
    const source = options.heights;
    if (!Array.isArray(source) || source.length < 2) {
        throw new HeightfieldMeshError("heights", "must be a rectangular array with at least two rows and two columns.");
    }
    const heights = [];
    let columns = 0;
    for (let row = 0; row < source.length; row += 1) {
        const values = source[row];
        const path = `heights[${row}]`;
        if (!Array.isArray(values) || values.length < 2) {
            throw new HeightfieldMeshError(path, "must be an array with at least two height samples.");
        }
        if (row === 0)
            columns = values.length;
        if (values.length !== columns) {
            throw new HeightfieldMeshError(path, `must have exactly ${columns} columns to match heights[0].`);
        }
        const samples = [];
        for (let column = 0; column < columns; column += 1) {
            samples.push(readFloat32(values[column], `${path}[${column}]`));
        }
        heights.push(samples);
    }
    return {
        heights,
        x: readAxis(options.width, "width", columns, "columns"),
        z: readAxis(options.depth, "depth", heights.length, "rows"),
    };
}
function readFloat32(value, path) {
    if (typeof value !== "number" ||
        !Number.isFinite(value) ||
        !Number.isFinite(Math.fround(value))) {
        throw new HeightfieldMeshError(path, "must be a finite number representable as float32.");
    }
    return Math.fround(value);
}
function readAxis(value, path, count, entries) {
    const size = value === undefined ? 1 : value;
    const rounded = readFloat32(size, path);
    if (rounded <= 0) {
        throw new HeightfieldMeshError(path, "must be positive after float32 conversion.");
    }
    const coordinates = [];
    for (let index = 0; index < count; index += 1) {
        const coordinate = Math.fround((index / (count - 1) - 0.5) * rounded);
        if (index > 0 && coordinate <= coordinates[index - 1]) {
            throw new HeightfieldMeshError(path, `collapses ${entries} ${index - 1} and ${index} after float32 conversion; use a larger extent or fewer samples.`);
        }
        coordinates.push(coordinate);
    }
    return coordinates;
}
//# sourceMappingURL=heightfield-validation.js.map