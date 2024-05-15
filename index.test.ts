

import {describe, expect, test} from '@jest/globals';
import { PriorityExpiryCache } from './index';

//------------------------------------------------------------------------------
// For this assignment: exact set of verification cases
//------------------------------------------------------------------------------
describe('PriorityExpiryCache -- REQUIRED TESTS', () => {
  test('Verify required test sequence', () => {
    // Create an instance of PriorityExpiryCache() with maxItems: 4.
    // It will start with a mockTime value of 0.
    const cache = new PriorityExpiryCache<number>(4);
    expect(cache.getKeys()).toEqual([]);

    cache.set("A", 1, 15, 100); // keys => [ "A" ]
    expect(cache.getKeys()).toEqual(["A"]);

    cache.set("B", 2, 15, 103); // keys => [ "A", "B" ]
    expect(cache.getKeys()).toEqual(["A", "B"]);

    // Simulate sleeping until time 100
    cache.setMockTime(100);
    
    // Note that "A" expired. Is still in the cache, but getKeys() does not return it.
    expect(cache.getKeys()).toEqual(['B']);

    cache.set("C", 3, 5, 110); // keys => [ "B", "C" ]  since item "A" expired
    expect(cache.getKeys()).toEqual(["B", "C"]);

    cache.set("D", 4, 1, 115);
    expect(cache.getKeys()).toEqual(["B", "C", "D"]);

    cache.set("E", 5, 5,  150); // keys => [ "B", "C", "D", "E" ] since nothing expired and there is still room
    expect(cache.getKeys()).toEqual(["B", "C", "D", "E"]);

    cache.set("F", 2, 15, 103); // keys => [ "B", "C", "E", "F" ] since "D" is lowest priority
    expect(cache.getKeys()).toEqual(["B", "C", "E", "F"]);

    cache.get("C");
    expect(cache.getKeys()).toEqual(["B", "C", "E", "F"]);

    cache.set("G", 6, 10, 160); // keys => [ "B", "C", "F", "G" ] since "C" & "E" both priority 5 and "C" was recently used
    expect(cache.getKeys()).toEqual(["B", "C", "F", "G"]);
  });
});

//----------------------------------------------------------------------------
// Black Box tests (not using getKeys())
//----------------------------------------------------------------------------
describe('PriorityExpiryCache -- Black box tests', () => {
  test('Verify eviction by expTime not influenced by priority', () => {
    // Create an instance of PriorityExpiryCache() with maxItems: 2.
    // It will start with a mockTime value of 0.
    const cache = new PriorityExpiryCache<number>(2);
    cache.set("A", 1, 15, 100);
    cache.set("B", 2, 5, 103); // Note: lowest priority, should be irrelevent for eviction by expTime.
  
    // Simulate sleeping until time 100
    cache.setMockTime(100);

    cache.set("C", 3, 5, 110);

    // Verify that "A" was evicted.
    expect(cache.get("A")).toBe(undefined);
    expect(cache.get("B")).toBe(2);
    expect(cache.get("C")).toBe(3);
  });

  // Repeat the above test, making sure eviction is based on item A's expTime
  // and not the order in which is was added to the cache.
  test('Verify eviction by expTime not influenced by order of entry into cache', () => {
    const cache = new PriorityExpiryCache<number>(2);
    cache.set("B", 2, 15, 103);
    cache.set("A", 1, 15, 100);

    // Simulate sleeping until time 100
    cache.setMockTime(100);

    cache.set("C", 3, 5, 110);

    // Verify "A" was evicted.
    expect(cache.get("A")).toBe(undefined);
    expect(cache.get("B")).toBe(2);
    expect(cache.get("C")).toBe(3);
  });

  // Repeat the above test, making sure eviction is based on item A's expTime
  // and not based on B being the least recently used.
  test('Verify eviction by expTime not influenced by LRU', () => {
    const cache = new PriorityExpiryCache<number>(2);

    cache.set("A", 1, 15, 100);
    cache.set("B", 2, 15, 103);

    // Force "A" to be the most recently used,
    // which should be irrelevant for eviction based on expTime.
    cache.get("A");
    
    // Simulate sleeping until time 100
    cache.setMockTime(100);

    cache.set("C", 3, 5, 110);

    // Verify "A" was evicted.
    expect(cache.get("A")).toBe(undefined);
    expect(cache.get("B")).toBe(2);
    expect(cache.get("C")).toBe(3);
  });

  test('Verify eviction by priority (when no expired items)', () => {
    const cache = new PriorityExpiryCache<number>(2);
    cache.set("A", 1, 15, 100);
    cache.set("B", 2, 4, 103); // Lowest priority
  
    // Simulate sleeping until time 50
    cache.setMockTime(50);

    cache.set("C", 3, 5, 110);

    // Verify that "B" was evicted.
    expect(cache.get("A")).toBe(1);
    expect(cache.get("B")).toBe(undefined);
    expect(cache.get("C")).toBe(3);
  });

  test('Verify eviction by priority not influenced by LRU of items with other priorities (when no expired items)', () => {
    const cache = new PriorityExpiryCache<number>(2);
    cache.set("A", 1, 15, 100);
    cache.set("B", 2, 4, 103); // Lowest priority
  
    // Force "B" to be the most recently used, with "A" being the least recently used,
    // which should be irrelevant for eviction based on another item having a lower priority,
    // i.e. this does not "save" B.
    cache.get("B");

    cache.set("C", 3, 5, 110);

    // Verify that "B" was evicted (not "A" which was the LRU, but for another priority)
    expect(cache.get("A")).toBe(1);
    expect(cache.get("B")).toBe(undefined);
    expect(cache.get("C")).toBe(3);
  });

  test('Verify eviction by priority and LRU (when no expired items) #1', () => {
    const cache = new PriorityExpiryCache<number>(2);
    cache.set("A", 1, 15, 100);
    cache.set("B", 2, 15, 103); // Same priority
  
    cache.set("C", 3, 5, 110);

    // Verify that "A" was evicted, based on LRU of items with same priority.
    expect(cache.get("A")).toBe(undefined);
    expect(cache.get("B")).toBe(2);
    expect(cache.get("C")).toBe(3);
  });

  test('Verify eviction by priority and LRU (when no expired items) #2', () => {
    const cache = new PriorityExpiryCache<number>(2);
    cache.set("A", 1, 15, 100);
    cache.set("B", 2, 15, 103); // Same priority
  
    // Force "A" to be the most recently used, with "B" being the least recently used.
    cache.get("A");

    cache.set("C", 3, 5, 110);

    // Verify that "B" was evicted, based on LRU of items with same priority.
    expect(cache.get("A")).toBe(1);
    expect(cache.get("B")).toBe(undefined);
    expect(cache.get("C")).toBe(3);
  });
});
