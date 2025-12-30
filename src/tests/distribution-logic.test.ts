import { describe, it, expect } from "vitest";
import { calculateNewDistribution } from "@/lib/distribution";

describe("calculateNewDistribution", () => {
  const mockCollections = ["col1", "col2", "col3"];
  const mockTags = ["tag1", "tag2"];

  it("should update value directly in count mode", () => {
    const currentRatios = { col1: 10, col2: 20 };
    const result = calculateNewDistribution(
      "col1",
      15,
      "top",
      currentRatios,
      mockCollections,
      [],
      "count"
    );
    expect(result).toEqual({ col1: 15, col2: 20 });
  });

  it("should force 100% if only one item in group (percent mode)", () => {
    const currentRatios = { col1: 50 };
    const result = calculateNewDistribution(
      "col1",
      80,
      "top",
      currentRatios,
      ["col1"],
      [],
      "percent"
    );
    expect(result).toEqual({ col1: 100 });
  });

  it("should adjust the other item to sum to 100% (percent mode)", () => {
    const currentRatios = { col1: 50, col2: 50 };
    const result = calculateNewDistribution(
      "col1",
      60,
      "top",
      currentRatios,
      ["col1", "col2"],
      [],
      "percent"
    );
    expect(result).toEqual({ col1: 60, col2: 40 });
  });

  it("should adjust others proportionally (percent mode)", () => {
    // col1: 50, col2: 25, col3: 25. Change col1 to 60.
    // Remaining 40 should be split 20/20.
    const currentRatios = { col1: 50, col2: 25, col3: 25 };
    const result = calculateNewDistribution(
      "col1",
      60,
      "top",
      currentRatios,
      ["col1", "col2", "col3"],
      [],
      "percent"
    );
    expect(result).toEqual({ col1: 60, col2: 20, col3: 20 });
  });

  it("should distribute equally if others sum to 0 (percent mode)", () => {
    // col1: 100, col2: 0, col3: 0. Change col1 to 40.
    // Remaining 60 should be split 30/30.
    const currentRatios = { col1: 100, col2: 0, col3: 0 };
    const result = calculateNewDistribution(
      "col1",
      40,
      "top",
      currentRatios,
      ["col1", "col2", "col3"],
      [],
      "percent"
    );
    expect(result).toEqual({ col1: 40, col2: 30, col3: 30 });
  });

  it("should handle rounding with Largest Remainder Method (percent mode)", () => {
    // col1: 33, col2: 33, col3: 34. Change col1 to 34.
    // Remaining 66. col2 and col3 were 33/34 (~49.25% / ~50.75% of remaining).
    // Let's try a case that forces a remainder distribution.
    // col1: 10, col2: 45, col3: 45. Change col1 to 11.
    // Remaining 89. col2/col3 should be 44.5 -> 44 + 45.

    const currentRatios = { col1: 10, col2: 45, col3: 45 };
    const result = calculateNewDistribution(
      "col1",
      11,
      "top",
      currentRatios,
      ["col1", "col2", "col3"],
      [],
      "percent"
    );

    // Sum should be 100
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(result.col1).toBe(11);
    // One should be 44, one 45 (or similar close values)
    expect(result.col2 + result.col3).toBe(89);
  });

  it("should only affect tags when group is tags", () => {
    const currentRatios = { tag1: 50, tag2: 50, col1: 100 };
    const result = calculateNewDistribution(
      "tag1",
      70,
      "tags",
      currentRatios,
      ["col1"],
      ["tag1", "tag2"],
      "percent"
    );

    expect(result.tag1).toBe(70);
    expect(result.tag2).toBe(30);
    expect(result.col1).toBe(100); // Should not change
  });

  it("should include _TAGS_TOTAL_ in top group", () => {
    const currentRatios = { col1: 50, _TAGS_TOTAL_: 50 };
    const result = calculateNewDistribution(
      "col1",
      80,
      "top",
      currentRatios,
      ["col1"],
      ["tag1"], // Has tags, so _TAGS_TOTAL_ exists
      "percent"
    );

    expect(result.col1).toBe(80);
    expect(result._TAGS_TOTAL_).toBe(20);
  });
});
