export const EPSILON = 1e-6;

// Determinant threshold below which a 4x4 matrix is treated as singular.
// Deliberately much smaller than EPSILON: a uniform-scale matrix has
// det = s^3, so cm-authored glTF content (s = 0.01 -> det = 1e-6) is
// well-conditioned yet would be misclassified as singular by EPSILON.
export const MAT4_SINGULARITY_EPSILON = 1e-12;
