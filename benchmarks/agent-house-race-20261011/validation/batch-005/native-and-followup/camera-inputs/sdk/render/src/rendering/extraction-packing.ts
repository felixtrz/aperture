export function pushVec4(values: number[], vector: ArrayLike<number>): number {
  const offset = values.length;
  values.push(vector[0] ?? 1, vector[1] ?? 1, vector[2] ?? 1, vector[3] ?? 1);
  return offset;
}
