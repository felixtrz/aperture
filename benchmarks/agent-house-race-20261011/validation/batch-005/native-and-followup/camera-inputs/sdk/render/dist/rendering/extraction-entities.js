export function sortedEntities(entities) {
    return [...entities].sort((a, b) => a.index - b.index || a.generation - b.generation);
}
//# sourceMappingURL=extraction-entities.js.map