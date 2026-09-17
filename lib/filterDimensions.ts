export function validateFilterDimensions(
  dimensions: FilterDimension[],
): void {
  const dimensionsById = new Map<string, FilterDimension>();

  for (const dimension of dimensions) {
    if (dimension.id.trim() === "") {
      throw new Error("Filter dimension id must be a non-empty string.");
    }

    const existing = dimensionsById.get(dimension.id);

    if (existing) {
      throw new Error(
        `Filter dimension id "${dimension.id}" must be unique within a dashboard.`,
      );
    }

    dimensionsById.set(dimension.id, dimension);
  }
}