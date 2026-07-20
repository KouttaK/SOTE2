/**
 * src/shared/utils/randomWeights.ts
 *
 * Shared helpers for the "Aleatório" (Random) token and Random Block: both
 * let the user configure 2+ options, each with a percentage chance
 * (0-100) that always sums to exactly 100 across the set. These functions
 * keep that invariant whenever an option is added, removed, or has its
 * weight edited directly, and pick a single option at runtime according
 * to those weights.
 */

export interface Weighted {
  weight: number;
}

/**
 * Picks one item at random using each item's `weight` as its relative
 * probability (weights don't strictly need to sum to 100 here — any
 * non-negative numbers work, since this normalizes by the total). Falls
 * back to a uniform pick across all items if every weight is missing,
 * negative, or zero. Returns null for an empty list.
 */
export function pickWeightedRandom<T extends Weighted>(items: T[]): T | null {
  if (!items || items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight || 0), 0);
  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)];
  }

  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight || 0);
    if (roll <= 0) return item;
  }
  return items[items.length - 1]; // guards against floating-point rounding at the tail
}

/** Rounds every weight to a whole percentage while keeping the total at
 * exactly 100 — any rounding drift is pushed 1 point at a time onto the
 * largest entries (skipping `protectedIndex`, if given, so the value the
 * user just typed is never silently nudged). */
function roundToHundred(weights: number[], protectedIndex = -1): number[] {
  const rounded = weights.map((w) => Math.round(w));
  let drift = 100 - rounded.reduce((s, w) => s + w, 0);
  if (drift === 0) return rounded;

  const order = rounded
    .map((w, i) => i)
    .filter((i) => i !== protectedIndex)
    .sort((a, b) => rounded[b] - rounded[a]);

  if (order.length === 0) return rounded; // only one (protected) option — nothing else to adjust

  let i = 0;
  while (drift !== 0) {
    const idx = order[i % order.length];
    rounded[idx] += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
    i++;
  }
  return rounded;
}

/**
 * Splits 100% evenly across `count` options (used when first converting a
 * leaf into a Random Block/token, or as a simple default for a freshly
 * added option). Always sums to exactly 100.
 */
export function evenWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const result = new Array(count).fill(base);
  let drift = 100 - base * count;
  for (let i = 0; i < drift; i++) result[i]++;
  return result;
}

/**
 * Recomputes every weight after the option at `changedIndex` was just set
 * to `newWeight` (0-100) by the user: that option gets exactly the typed
 * value, and every other option absorbs the difference proportionally to
 * its current relative weight (or evenly, if the others are all
 * currently 0). Always returns weights summing to exactly 100.
 */
export function rebalanceWeights(weights: number[], changedIndex: number, newWeight: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (n === 1) return [100];

  const clamped = Math.max(0, Math.min(100, newWeight));
  const remaining = 100 - clamped;
  const otherIndices = weights.map((_, i) => i).filter((i) => i !== changedIndex);
  const sumOthers = otherIndices.reduce((s, i) => s + weights[i], 0);

  const result = [...weights];
  result[changedIndex] = clamped;

  if (sumOthers <= 0) {
    const each = remaining / otherIndices.length;
    otherIndices.forEach((i) => { result[i] = each; });
  } else {
    otherIndices.forEach((i) => { result[i] = (weights[i] / sumOthers) * remaining; });
  }

  return roundToHundred(result, changedIndex);
}

/**
 * Recomputes weights after removing the option at `removedIndex`: its
 * share is redistributed proportionally into the remaining options (or
 * evenly, if they're all currently 0). Returns the new weights array,
 * already one entry shorter than `weights`.
 */
export function removeAndRebalance(weights: number[], removedIndex: number): number[] {
  const remaining = weights.filter((_, i) => i !== removedIndex);
  if (remaining.length === 0) return [];

  const removedWeight = weights[removedIndex] || 0;
  const sum = remaining.reduce((s, w) => s + w, 0);

  if (sum <= 0) return evenWeights(remaining.length);

  const scaled = remaining.map((w) => w + (w / sum) * removedWeight);
  return roundToHundred(scaled);
}
