// `|` is the contributionKey delimiter, so no key segment may contain it.
const KEY_DELIMITER = "|";

export function assertKeySafe(description: string, value: string): void {
  if (value.includes(KEY_DELIMITER)) {
    throw new Error(
      `${description} "${value}" must not contain "${KEY_DELIMITER}".`,
    );
  }
}

export function validateFilterDimensions(
  dimensions: FilterDimension[],
): void {
  const dimensionsById = new Map<string, FilterDimension>();

  for (const dimension of dimensions) {
    if (dimension.id.trim() === "") {
      throw new Error("Filter dimension id must be a non-empty string.");
    }

    assertKeySafe("Filter dimension id", dimension.id);

    if (dimension.control?.location === "tab") {
      assertKeySafe(
        `Control tab of filter dimension "${dimension.id}"`,
        dimension.control.tab,
      );
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