import assert from "node:assert/strict";
import { describe, it } from "vitest";

import pieChartDataSchema from "./chartDataSchema";
import { derivePieSlices, getSelectableSliceRow } from "./logic";

describe("PieChartModule data schema", () => {
  it("accepts finite nonnegative values", () => {
    assert.equal(
      pieChartDataSchema.safeParse({ name: "Enterprise", value: 0 }).success,
      true,
    );
    assert.equal(
      pieChartDataSchema.safeParse({ name: "Enterprise", value: 42.5 })
        .success,
      true,
    );
  });

  it("rejects negative and non-finite values", () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(
        pieChartDataSchema.safeParse({ name: "Enterprise", value }).success,
        false,
      );
    }
  });
});

describe("derivePieSlices", () => {
  it("drops zero values while preserving source-row identity and total", () => {
    const enterprise = { name: "Enterprise", value: 40 };
    const unused = { name: "Unused", value: 0 };
    const publicSector = { name: "Public sector", value: 10 };

    const result = derivePieSlices(
      [enterprise, unused, publicSector],
      undefined,
      undefined,
    );

    assert.equal(result.total, 50);
    assert.equal(result.slices.length, 2);
    assert.strictEqual(result.slices[0].row, enterprise);
    assert.strictEqual(result.slices[1].row, publicSector);
  });

  it("groups all but the stable top N into one synthetic slice", () => {
    const firstTie = { name: "First tie", value: 20 };
    const leader = { name: "Leader", value: 30 };
    const secondTie = { name: "Second tie", value: 20 };
    const tail = { name: "Tail", value: 5 };

    const result = derivePieSlices(
      [firstTie, leader, secondTie, tail],
      { enabled: true, mode: "topN", value: 2, label: "Other" },
      undefined,
    );

    assert.deepEqual(
      result.slices.map((slice) => [slice.kind, slice.row.name, slice.row.value]),
      [
        ["source", "First tie", 20],
        ["source", "Leader", 30],
        ["others", "Other", 25],
      ],
    );
    assert.equal(result.total, 75);
    assert.deepEqual(
      result.slices[2].kind === "others"
        ? result.slices[2].absorbedRows
        : [],
      [secondTie, tail],
    );
  });

  it("keeps values on the threshold and groups values below it", () => {
    const result = derivePieSlices(
      [
        { name: "Half", value: 50 },
        { name: "Boundary", value: 25 },
        { name: "Small", value: 20 },
        { name: "Tiny", value: 5 },
      ],
      {
        enabled: true,
        mode: "threshold",
        value: 0.25,
        label: "Below threshold",
      },
      undefined,
    );

    assert.deepEqual(
      result.slices.map((slice) => [slice.row.name, slice.row.value]),
      [
        ["Half", 50],
        ["Boundary", 25],
        ["Below threshold", 25],
      ],
    );
  });

  it("sorts grouped output by configured value direction", () => {
    const result = derivePieSlices(
      [
        { name: "Large", value: 60 },
        { name: "Medium", value: 30 },
        { name: "Small", value: 10 },
      ],
      { enabled: true, mode: "topN", value: 1 },
      { by: "value", direction: "asc" },
    );

    assert.deepEqual(
      result.slices.map((slice) => [slice.kind, slice.row.value]),
      [
        ["others", 40],
        ["source", 60],
      ],
    );
  });
});

describe("getSelectableSliceRow", () => {
  it("returns the original source row", () => {
    const row = { name: "Enterprise", value: 42 };
    const { slices } = derivePieSlices([row], undefined, undefined);

    assert.strictEqual(getSelectableSliceRow(slices, 0), row);
  });

  it("rejects synthetic and out-of-range slices", () => {
    const { slices } = derivePieSlices(
      [
        { name: "Large", value: 90 },
        { name: "Small", value: 10 },
      ],
      { enabled: true, mode: "topN", value: 1 },
      undefined,
    );

    assert.equal(getSelectableSliceRow(slices, 1), null);
    assert.equal(getSelectableSliceRow(slices, 99), null);
  });
});