export type DistributionMode = "percent" | "count";

export function calculateNewDistribution(
  changedId: string,
  newValue: number,
  group: "top" | "tags",
  currentRatios: Record<string, number>,
  selectedCollections: string[],
  selectedTags: string[],
  distMode: DistributionMode
): Record<string, number> {
  if (distMode !== "percent") {
    return { ...currentRatios, [changedId]: newValue };
  }

  const safeVal = Math.max(0, Math.min(100, newValue));
  let peers: string[] = [];

  if (group === "top") {
    peers = [...selectedCollections];
    if (selectedTags.length > 0) peers.push("_TAGS_TOTAL_");
  } else {
    peers = [...selectedTags];
  }

  // Filter out the changed ID
  const others = peers.filter((id) => id !== changedId);

  if (others.length === 0) {
    // Only one item in group, must be 100%
    return { ...currentRatios, [changedId]: 100 };
  }

  const targetSumOthers = 100 - safeVal;

  // Calculate current sum of others based on currentRatios
  const currentSumOthers = others.reduce(
    (sum, id) => sum + (currentRatios[id] || 0),
    0
  );

  const next = { ...currentRatios, [changedId]: safeVal };

  if (currentSumOthers === 0) {
    // If others currently sum to 0, distribute equally
    if (targetSumOthers > 0) {
      const baseShare = Math.floor(targetSumOthers / others.length);
      let remainder = targetSumOthers - baseShare * others.length;

      others.forEach((id) => {
        if (remainder > 0) {
          next[id] = baseShare + 1;
          remainder--;
        } else {
          next[id] = baseShare;
        }
      });
    } else {
      others.forEach((id) => (next[id] = 0));
    }
  } else {
    // Largest Remainder Method for smooth distribution
    const factor = targetSumOthers / currentSumOthers;

    // 1. Calculate raw values and separate integer/fraction parts
    const distribution = others.map((id) => {
      const oldVal = currentRatios[id] || 0;
      const exact = oldVal * factor;
      const integer = Math.floor(exact);
      const fraction = exact - integer;
      return { id, integer, fraction };
    });

    // 2. Calculate current sum of integers
    const currentSumInt = distribution.reduce(
      (acc, item) => acc + item.integer,
      0
    );
    let shortfall = targetSumOthers - currentSumInt;

    // 3. Sort by fractional part descending
    distribution.sort((a, b) => b.fraction - a.fraction);

    // 4. Distribute shortfall
    distribution.forEach((item) => {
      if (shortfall > 0) {
        next[item.id] = item.integer + 1;
        shortfall--;
      } else {
        next[item.id] = item.integer;
      }
    });
  }
  return next;
}
