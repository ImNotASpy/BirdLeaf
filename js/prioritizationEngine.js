// prioritizationEngine.js
// Uses merge sort to rank values in O(n log n) comparisons instead of O(n²).

const SNAPSHOT_VERSION = 1;

function isValidSnapshot(snapshot) {
  return (
    snapshot &&
    typeof snapshot === "object" &&
    snapshot.snapshotVersion === SNAPSHOT_VERSION &&
    Array.isArray(snapshot.values) &&
    Array.isArray(snapshot.runs)
  );
}

function estimateTotal(n) {
  if (n <= 1) return 0;
  // Worst-case merge sort comparisons: sum of (left+right-1) across all merges.
  // n*ceil(log2(n)) is a safe upper bound.
  return Math.ceil(n * Math.log2(n));
}

export function createPrioritizer(values, snapshot = null) {
  const orderedValues = Array.isArray(values) ? [...values] : [];

  // runs: queue of sorted arrays waiting to be merged.
  // mergeState: the active merge in progress (null when between merges).
  let runs;
  let mergeState;
  let completedComparisons;
  let totalComparisons;

  if (isValidSnapshot(snapshot)) {
    runs = snapshot.runs.map(r => Array.isArray(r) ? [...r] : []);
    mergeState = snapshot.mergeState
      ? {
          left:   [...snapshot.mergeState.left],
          right:  [...snapshot.mergeState.right],
          result: [...snapshot.mergeState.result],
          li: snapshot.mergeState.li,
          ri: snapshot.mergeState.ri
        }
      : null;
    completedComparisons = Number.isInteger(snapshot.completedComparisons)
      ? snapshot.completedComparisons : 0;
    totalComparisons = Number.isInteger(snapshot.totalComparisons)
      ? snapshot.totalComparisons : estimateTotal(orderedValues.length);
  } else {
    // Fresh start: each value is its own sorted run of length 1.
    runs = orderedValues.map(v => [v]);
    mergeState = null;
    completedComparisons = 0;
    totalComparisons = estimateTotal(orderedValues.length);
    advanceToNextMerge();
  }

  // Pull the next two runs off the queue and start merging them.
  function advanceToNextMerge() {
    if (mergeState || runs.length <= 1) return;
    const left = runs.shift();
    const right = runs.shift();
    mergeState = { left, right, result: [], li: 0, ri: 0 };
  }

  // One side of the current merge is exhausted — flush the rest and push the
  // completed merged run back onto the queue.
  function finishCurrentMerge() {
    if (!mergeState) return;
    while (mergeState.li < mergeState.left.length) {
      mergeState.result.push(mergeState.left[mergeState.li++]);
    }
    while (mergeState.ri < mergeState.right.length) {
      mergeState.result.push(mergeState.right[mergeState.ri++]);
    }
    runs.push(mergeState.result);
    mergeState = null;
  }

  function getNextComparison() {
    if (!mergeState) return null;
    const { left, right, li, ri } = mergeState;
    // If one side is exhausted, finish and move to the next merge.
    if (li >= left.length || ri >= right.length) {
      finishCurrentMerge();
      advanceToNextMerge();
      return getNextComparison();
    }
    return { a: left[li], b: right[ri] };
  }

  function submitResult(winner /*, loser — unused, winner determines advancement */) {
    if (!mergeState) return;
    mergeState.result.push(winner);
    completedComparisons++;
    // Advance the pointer on whichever side the winner came from.
    if (mergeState.left[mergeState.li] === winner) {
      mergeState.li++;
    } else {
      mergeState.ri++;
    }
    // If one side is now exhausted, finish and advance.
    if (mergeState.li >= mergeState.left.length || mergeState.ri >= mergeState.right.length) {
      finishCurrentMerge();
      advanceToNextMerge();
    }
  }

  function getProgress() {
    return {
      completed: completedComparisons,
      total: totalComparisons
    };
  }

  function finalize() {
    // When done, runs contains exactly one fully sorted array.
    return runs.length === 1 ? [...runs[0]] : [...orderedValues];
  }

  function serialize() {
    return {
      snapshotVersion: SNAPSHOT_VERSION,
      values: [...orderedValues],
      runs: runs.map(r => [...r]),
      mergeState: mergeState
        ? {
            left:   [...mergeState.left],
            right:  [...mergeState.right],
            result: [...mergeState.result],
            li: mergeState.li,
            ri: mergeState.ri
          }
        : null,
      completedComparisons,
      totalComparisons
    };
  }

  return { getNextComparison, submitResult, getProgress, finalize, serialize };
}
