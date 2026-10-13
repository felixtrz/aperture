export function createPhysicsTriangleMeshGeometryFromSpatialMesh(options) {
    const triangles = collectMeshTriangles(options.mesh);
    if (triangles.length === 0) {
        return {
            ok: false,
            error: {
                code: "physics.collider.asset.empty",
                feature: "collider.triangleMesh",
                message: `Physics triangle mesh '${options.key}' has no triangles to cook.`,
                suggestedFix: "Provide triangle-list mesh geometry with at least one triangle before authoring it as a physics collider.",
                details: {
                    key: options.key,
                    vertexCount: options.mesh.vertexCount,
                },
            },
        };
    }
    const positions = new Float32Array(triangles.length * 9);
    const indices = new Uint32Array(triangles.length * 3);
    let positionOffset = 0;
    let indexOffset = 0;
    for (const triangle of triangles) {
        writePosition(options.mesh, triangle.v0, positions, positionOffset);
        writePosition(options.mesh, triangle.v1, positions, positionOffset + 3);
        writePosition(options.mesh, triangle.v2, positions, positionOffset + 6);
        indices[indexOffset] = indexOffset;
        indices[indexOffset + 1] = indexOffset + 1;
        indices[indexOffset + 2] = indexOffset + 2;
        positionOffset += 9;
        indexOffset += 3;
    }
    return {
        ok: true,
        geometry: {
            key: options.key,
            ...(options.sourceVersion === undefined
                ? {}
                : { sourceVersion: options.sourceVersion }),
            positions,
            indices,
            vertexCount: triangles.length * 3,
            triangleCount: triangles.length,
        },
    };
}
export function validatePhysicsHeightfieldGeometry(geometry) {
    if (!Number.isInteger(geometry.rows) ||
        !Number.isInteger(geometry.columns) ||
        geometry.rows < 2 ||
        geometry.columns < 2) {
        return invalidHeightfield(geometry, "Heightfield geometry must have at least two rows and two columns.");
    }
    if (geometry.heights.length !== geometry.rows * geometry.columns) {
        return invalidHeightfield(geometry, `Heightfield '${geometry.key}' has ${geometry.heights.length} heights, expected rows * columns (${geometry.rows * geometry.columns}).`);
    }
    if (!allFinite(geometry.heights) || !finiteVec3(geometry.scale)) {
        return invalidHeightfield(geometry, `Heightfield '${geometry.key}' contains non-finite heights or scale values.`);
    }
    return { ok: true, geometry };
}
function invalidHeightfield(geometry, message) {
    return {
        ok: false,
        error: {
            code: "physics.collider.asset.invalid",
            feature: "collider.heightfield",
            message,
            suggestedFix: "Provide a finite heightfield with rows * columns height values and finite xyz scale.",
            details: {
                key: geometry.key,
                rows: geometry.rows,
                columns: geometry.columns,
                heightCount: geometry.heights.length,
            },
        },
    };
}
function collectMeshTriangles(mesh) {
    const submeshes = mesh.submeshes !== undefined && mesh.submeshes.length > 0
        ? mesh.submeshes
        : [defaultSubmesh(mesh)];
    const triangles = [];
    for (const submesh of submeshes) {
        if (submesh.topology !== undefined &&
            submesh.topology !== "triangle-list") {
            continue;
        }
        if (mesh.indices !== undefined) {
            const indexStart = submesh.indexStart ?? 0;
            const indexCount = submesh.indexCount ?? Math.max(0, mesh.indices.length - indexStart);
            const end = indexStart + indexCount - 2;
            for (let index = indexStart; index < end; index += 3) {
                triangles.push({
                    v0: readIndex(mesh.indices, index),
                    v1: readIndex(mesh.indices, index + 1),
                    v2: readIndex(mesh.indices, index + 2),
                });
            }
            continue;
        }
        const vertexStart = submesh.vertexStart ?? 0;
        const vertexCount = submesh.vertexCount ?? Math.max(0, mesh.vertexCount - vertexStart);
        const end = vertexStart + vertexCount - 2;
        for (let vertex = vertexStart; vertex < end; vertex += 3) {
            triangles.push({
                v0: vertex,
                v1: vertex + 1,
                v2: vertex + 2,
            });
        }
    }
    return triangles.filter((triangle) => triangleIndicesAreInRange(mesh, triangle));
}
function defaultSubmesh(mesh) {
    return mesh.indices === undefined
        ? {
            topology: "triangle-list",
            vertexStart: 0,
            vertexCount: mesh.vertexCount,
        }
        : {
            topology: "triangle-list",
            vertexStart: 0,
            vertexCount: mesh.vertexCount,
            indexStart: 0,
            indexCount: mesh.indices.length,
        };
}
function triangleIndicesAreInRange(mesh, triangle) {
    return (triangle.v0 >= 0 &&
        triangle.v0 < mesh.vertexCount &&
        triangle.v1 >= 0 &&
        triangle.v1 < mesh.vertexCount &&
        triangle.v2 >= 0 &&
        triangle.v2 < mesh.vertexCount);
}
function writePosition(mesh, vertex, out, offset) {
    const attributeOffset = mesh.positions.offset ?? 0;
    const base = attributeOffset + vertex * mesh.positions.stride;
    out[offset] = readNumber(mesh.positions.data, base);
    out[offset + 1] = readNumber(mesh.positions.data, base + 1);
    out[offset + 2] = readNumber(mesh.positions.data, base + 2);
}
function readIndex(indices, index) {
    return Math.trunc(readNumber(indices, index));
}
function readNumber(values, index) {
    const value = values[index];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function allFinite(values) {
    for (let index = 0; index < values.length; index += 1) {
        if (!Number.isFinite(values[index])) {
            return false;
        }
    }
    return true;
}
function finiteVec3(value) {
    return value.every(Number.isFinite);
}
//# sourceMappingURL=collider-geometry.js.map