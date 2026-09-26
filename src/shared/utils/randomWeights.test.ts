import { describe, it, expect } from 'vitest';
import {
  pickWeightedRandom,
  pickWeightedRandomExcluding,
  evenWeights,
  rebalanceWeights,
  removeAndRebalance,
} from './randomWeights.js';

describe('randomWeights', () => {
  describe('pickWeightedRandom', () => {
    it('returns null for empty or missing list', () => {
      expect(pickWeightedRandom([])).toBeNull();
      expect(pickWeightedRandom(null as any)).toBeNull();
    });

    it('returns the only item when list has length 1', () => {
      const item = { id: '1', weight: 100 };
      expect(pickWeightedRandom([item])).toBe(item);
    });

    it('picks items according to non-zero weights', () => {
      const itemA = { id: 'A', weight: 100 };
      const itemB = { id: 'B', weight: 0 };
      // itemA has 100% weight, so roll always picks itemA
      expect(pickWeightedRandom([itemA, itemB])).toBe(itemA);
    });

    it('falls back to uniform pick when all weights are zero or negative', () => {
      const items = [
        { id: '1', weight: 0 },
        { id: '2', weight: 0 },
      ];
      const picked = pickWeightedRandom(items);
      expect(items).toContain(picked);
    });
  });

  describe('pickWeightedRandomExcluding', () => {
    it('returns null for empty list', () => {
      expect(pickWeightedRandomExcluding([])).toBeNull();
      expect(pickWeightedRandomExcluding([], 'some-id')).toBeNull();
    });

    it('excludes excludeId when there are 2 or more items', () => {
      const itemA = { id: 'A', weight: 50 };
      const itemB = { id: 'B', weight: 50 };

      // When excluding A, must pick B
      expect(pickWeightedRandomExcluding([itemA, itemB], 'A')).toBe(itemB);
      // When excluding B, must pick A
      expect(pickWeightedRandomExcluding([itemA, itemB], 'B')).toBe(itemA);
    });

    it('does not exclude when there is only 1 item', () => {
      const itemA = { id: 'A', weight: 100 };
      expect(pickWeightedRandomExcluding([itemA], 'A')).toBe(itemA);
    });

    it('picks normally if excludeId is undefined or does not match any item', () => {
      const itemA = { id: 'A', weight: 100 };
      const itemB = { id: 'B', weight: 0 };

      expect(pickWeightedRandomExcluding([itemA, itemB])).toBe(itemA);
      expect(pickWeightedRandomExcluding([itemA, itemB], 'non-existent')).toBe(itemA);
    });

    it('handles multiple alternatives excluding the previous one', () => {
      const items = [
        { id: '1', weight: 33 },
        { id: '2', weight: 33 },
        { id: '3', weight: 34 },
      ];
      for (let i = 0; i < 20; i++) {
        const picked = pickWeightedRandomExcluding(items, '2');
        expect(picked).not.toBeNull();
        expect(picked?.id).not.toBe('2');
      }
    });
  });

  describe('evenWeights', () => {
    it('returns empty array for count <= 0', () => {
      expect(evenWeights(0)).toEqual([]);
      expect(evenWeights(-1)).toEqual([]);
    });

    it('splits 100 evenly and always sums to 100', () => {
      for (const count of [1, 2, 3, 4, 5, 7, 10]) {
        const weights = evenWeights(count);
        expect(weights.length).toBe(count);
        const sum = weights.reduce((a, b) => a + b, 0);
        expect(sum).toBe(100);
      }
    });
  });

  describe('rebalanceWeights', () => {
    it('maintains 100% sum after adjusting a weight', () => {
      const initial = [50, 50];
      const rebalanced = rebalanceWeights(initial, 0, 70);
      expect(rebalanced[0]).toBe(70);
      expect(rebalanced[1]).toBe(30);
      expect(rebalanced.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('handles single item rebalancing', () => {
      expect(rebalanceWeights([50], 0, 80)).toEqual([100]);
    });
  });

  describe('removeAndRebalance', () => {
    it('redistributes removed weight and sums to 100', () => {
      const initial = [50, 25, 25];
      const updated = removeAndRebalance(initial, 0);
      expect(updated.length).toBe(2);
      expect(updated.reduce((a, b) => a + b, 0)).toBe(100);
      expect(updated).toEqual([50, 50]);
    });

    it('returns empty array when removing the last element', () => {
      expect(removeAndRebalance([100], 0)).toEqual([]);
    });
  });
});
