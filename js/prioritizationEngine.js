// prioritizationEngine.js

function isComparisonEntry(entry) {
  return (
    entry &&
    typeof entry === "object" &&
    typeof entry.a === "string" &&
    typeof entry.b === "string"
  );
}

function isSnapshot(snapshot) {
  return (
    snapshot &&
    typeof snapshot === "object" &&
    Array.isArray(snapshot.values) &&
    Array.isArray(snapshot.queue) &&
    snapshot.comparisons &&
    typeof snapshot.comparisons === "object"
  );
}

export function createPrioritizer(values, snapshot = null) {
  const orderedValues = Array.isArray(values) ? [...values] : [];
  const comparisons = {};
  const queue = [];
  let totalComparisons = 0;

  if (isSnapshot(snapshot)) {
    const snapshotQueue = snapshot.queue.filter(isComparisonEntry).map(entry => ({ ...entry }));
    Object.entries(snapshot.comparisons).forEach(([key, winner]) => {
      if (typeof key === "string" && typeof winner === "string") {
        comparisons[key] = winner;
      }
    });

    queue.push(...snapshotQueue);
    const completedCount = Object.keys(comparisons).length;
    const fallbackTotal = queue.length + completedCount;
    totalComparisons = Number.isInteger(snapshot.totalComparisons) && snapshot.totalComparisons >= fallbackTotal
      ? snapshot.totalComparisons
      : fallbackTotal;
  } else {
    // Generate all pairwise comparisons
    for (let i = 0; i < orderedValues.length; i++) {
      for (let j = i + 1; j < orderedValues.length; j++) {
        queue.push({ a: orderedValues[i], b: orderedValues[j] });
      }
    }
    totalComparisons = queue.length;
  }

  function getNextComparison() {
    return queue.length > 0 ? queue.shift() : null;
  }

  function submitResult(winner, loser) {
    const key = [winner, loser].sort().join("|");
    comparisons[key] = winner;
  }

  function getProgress() {
    return {
      completed: Object.keys(comparisons).length,
      total: totalComparisons
    };
  }

  function serialize() {
    return {
      values: [...orderedValues],
      queue: queue.map(entry => ({ ...entry })),
      comparisons: { ...comparisons },
      totalComparisons
    };
  }

  function finalize() {
    // Count wins for each value
    const wins = {};
    orderedValues.forEach(v => {
      wins[v] = 0;
    });

    Object.values(comparisons).forEach(winner => {
      if (winner in wins) {
        wins[winner]++;
      }
    });

    // Sort by number of wins (descending)
    return [...orderedValues].sort((a, b) => wins[b] - wins[a]);
  }

  return { getNextComparison, submitResult, getProgress, finalize, serialize };
}
