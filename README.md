
# Overview  
Assignment: implement an efficient LRU cache which includes additional features for expiration & priority of entries.
    
# Requirements
The PriorityExpiryCache class must have the following features:
  
  * per entry expiration Time - for each entry after which an entry in the caches is invalid
  * per entry priority - for each entry, where lower priority entries should be evicted before higher priority entries
  * max capacity at creation - maintains a maximum number of entries in the cache by evicting expired or low priority items
  * LRU within a priority group - when multiple items have the same priority or expiration
  
The cache must support these operations:
  
* Set: Update or insert the value by key with a priority value and expiration time: cache.set(key, value, priority, expiration) returns nothing.

  * Set should evict items so that there are never more items than "Max capacity" to be in the cache.
  * Set should run in O(log(p) + log(e))
  
* Get: Get the value of the key if the key exists in the cache and is not expired. cache.get(key) returns a value
  * Get does not need to evict items but should check expiration
  * Get should run in O(1)
  
We are looking for a solution that runs in O(log(P)+log(E)) time to evict an item, where:
  * p = number of unique priorities
  * e = number of unique expiries
      
The cache eviction strategy should be as follows:
  1) Evict expired entries first
  2) If there are no expired items to evict then evict the lowest priority entries
  3) Tie breaking among entries with the same priority is done via least recently used
  4) For expired items with the same expiration time we don't care about order

# Installation
```
npm install
```

# To Build and Run Unit Tests
This runs the required (and additional) test cases.
```
npm run build
npm run test
```
