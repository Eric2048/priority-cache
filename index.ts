/*
  Priority Expiry Cache
  
  Goal: implement an efficient LRU cache which includes additional features for expiration & priority of entries.
    
  Requirements:
  
  The PriorityExpiryCache class has the following features:
  
  - per entry expiration Time - for each entry after which an entry in the caches is invalid
  - per entry priority - for each entry, where lower priority entries should be evicted before higher priority entries
  - max capacity at creation - maintains a maximum number of entries in the cache by evicting expired or low priority items
  - LRU within a priority group - when multiple items have the same priority or expiration
  
  The cache support these operations:
  
  - Set: Update or insert the value by key with a priority value and expiration time: cache.set( key, value, priority, expiration ) returns nothing
      Set should evict items so that there are never more items than "Max capacity" to be in the cache.
      Set should run in O(log(p) + log(e))
  
  - Get: Get the value of the key if the key exists in the cache and is not expired.  cache.get( key ) returns a value
      Get does not need to evict items but should check expiration
      Get should run in O(1)
  
  We are looking for a solution that runs in O(log(P)+log(E)) time to evict an item, where:
      p = number of unique priorities
      e = number of unique expiries
      
  The cache eviction strategy should be as follows:
  1) Evict expired entries first
  2) If there are no expired items to evict then evict the lowest priority entries
  3) Tie breaking among entries with the same priority is done via least recently used
  4) For expired items with the same expiration time we don't care about order
*/

import { DoublyLinkedList, DoublyLinkedListNode } from '@datastructures-js/linked-list';
import { AvlTree } from '@datastructures-js/binary-search-tree';

interface Item<T> {
  // User-provided values
  key: string;
  value: T;
  expTime: number;
  priority: number;

  // Cached refs to the LinkedList for this item's specific expTime.
  // Must use a doubly-linked list for O(1) remove() timing.
  // Typescript note: must specify that these can be null but in practical
  // usage they are only briefly null when creating or removing an item.
  itemListSameExp:     DoublyLinkedList<Item<T>> | null;
  itemListSameExpNode: DoublyLinkedListNode | null;
  
  // Similar to the above but for this item's specific priority.
  itemListSamePrio:     DoublyLinkedList<Item<T>> | null;
  itemListSamePrioNode: DoublyLinkedListNode | null;
}

// In the expTree AvlTree, each AvlTreeNode's value will have this shape
interface ExpTreeNodeValue<T> {
  expTime: number;
  itemListSameExp: DoublyLinkedList<Item<T>> | null;
}

// In the priorityTree AvlTree, each AvlTreeNode's value will have this shape
interface PriorityTreeNodeValue<T> {
  priority: number;
  itemListSamePrio: DoublyLinkedList<Item<T>> | null;
}

// Detect when run using 'node dist/index.js -- --log' instead of via jest,
// enabling execution of a specific set of manual tests (with their output)
// as required by this exercise.
const isLoggingEnabled: boolean = process.argv.slice(2).findIndex((s) => s === '--log') !== -1;

export class PriorityExpiryCache<T> {
  // Max # items, from initial instantiation of this cache
  private maxItems: number = 0;

  // Mocked current time value -- for this exercise, this cache will use this
  // as the current time, when evaluating expTime values for each cached item.
  // Unit test functions will call setMockTime() to update this during testing.
  private mockTime: number = 0;

  // Internal cache structure, with a separate item count for best performance.
  private items = new Map<string, Item<T>>();
  private numItems: number = 0;

  // An AVL Tree to represent the discrete expTime values for cached items,
  // allowing for fast lookup and removal (O(log(E)) for E expTime values)
  private expTree = new AvlTree<ExpTreeNodeValue<T>>(
    (a: ExpTreeNodeValue<T>, b: ExpTreeNodeValue<T>) => a.expTime - b.expTime, // node comparison function
    { key: 'expTime' } // unique key for an ExpTreeNodeValue's AvlTreeNode, to keep the tree sorted
  );

  // An AVL Tree to represent the discrete priority values for cached items,
  // allowing for fast lookup and removal (O(log(P)) for P priority values)
  private priorityTree = new AvlTree<PriorityTreeNodeValue<T>>(
    (a: PriorityTreeNodeValue<T>, b: PriorityTreeNodeValue<T>) => a.priority - b.priority,
    { key: 'priority' }
  );

  constructor(maxItems: number) {
    this.maxItems = maxItems;
  }

  //----------------------------------------------------------------------------
  // Public API
  //----------------------------------------------------------------------------
  get(key: string): T | undefined { // O(1)
    if (isLoggingEnabled) console.log(`get('${ key }')`);

    let item = this.items.get(key); // O(1)

    // If item exists and not yet expired, mark it as the most recently used
    // in its 'itemListSamePriority' linked list.
    if (item && (item.expTime > this.mockTime)) {
      // Using this item's cached ref to the LinkedList of items with the same
      // priority, and ref to this item's node in that list, move that node to
      // the tail of the list, indicating this this item is the most recently used.
      if (item.itemListSamePrio && item.itemListSamePrioNode) { // Narrowing for Typescript, see Item definition.
        let node = item.itemListSamePrio.remove(item.itemListSamePrioNode); // O(1)
        item.itemListSamePrio.insertLast(node); // O(1)
      }

      // Return this non-expired item
      return item.value;
    }

    // The Requirements don't state a return value for the "no item" / "expired item" cases.
    // Returning undefined so that null can be used as an Item value in the cache.
    return undefined;
  }

  set(key: string, value: T, priority: number, expireTime: number): void { // O(log(P) + log(E))
    if (isLoggingEnabled) console.log(`set('${ key }')`);

    // Do we have this item? (ignore expireTime)
    let item = this.items.get(key); // O(1)
    if (item) {
      // Yes: item is already cached, must update it. But it could have a new
      // priority and/or new expireTime, so must delete and re-add it.
      // Note: could be further optimized to handle this special 'update' case
      // but this approach meets the timing requirements.
      this.deleteItem(item); // O(log(P) + log(E))
      this.addItem(key, value, priority, expireTime); // O(log(P) + log(E))

    } else {
      // No: we will need to add this item. First see if we need to evict an item.
      // Is the cache full?
      if (this.numItems >= this.maxItems) {
        // Yes: first try to evict an Item based on expTime.
        // Get the expTree node with the lowest value.
        let expTreeNode = this.expTree.min(); // O(log(E))
        if (expTreeNode) { // Narrowing for Typescript (never null)
          // Have we reached that expTime value (according to mockTime)?
          let expTreeNodeValue = expTreeNode.getValue(); // O(1)
          if (expTreeNodeValue.expTime <= this.mockTime) {
            // Yes: this item has expired. Get the head node (any node will do
            // but fetching from head is O(1)) from expTreeNodeValue's LinkedList.
            // (Don't remove it -- deleteItem() has that responsibility.)
            let itemListSameExpNode = expTreeNodeValue.itemListSameExp?.head(); // O(1)

            // Get item that this head node refers to and delete it from the cache.
            let itemToEvict = itemListSameExpNode?.getValue(); // O(1)
            this.deleteItem(itemToEvict); // O(log(P) + log(E))

          } else {
            // Cannot find an item to evict based on expTime.
            // Get the priorityTree node with the lowest value.
            let priorityTreeNode = this.priorityTree.min(); // O(log(P))    
            if (priorityTreeNode) { // Narrowing for Typescript (never null)
              // Get the head node (i.e. Least Recently Used item) from that node's itemListSamePrio LinkedList.
              // (Don't remove it -- deleteItem() has that responsibility.)
              let priorityTreeNodeValue = priorityTreeNode.getValue(); // O(1)
              let itemListSamePrioNode = priorityTreeNodeValue.itemListSamePrio?.head(); // O(1)
      
              // Get item that this head node refers to and delete it from the cache.
              let itemToEvict = itemListSamePrioNode?.getValue(); // O(1)
              this.deleteItem(itemToEvict); // O(log(P) + log(E))
            }
          }
        }
      }

      // Add this new item
      this.addItem(key, value, priority, expireTime); // O(log(P) + log(E))
    }
  };

  //----------------------------------------------------------------------------
  // Private methods
  //----------------------------------------------------------------------------
  // Add the specified item to our cache and the LinkedLists for its expTime and priority.
  private addItem(key: string, value: T, priority: number, expireTime: number) { // O(log(P) + log(E))
    let item: Item<T> = {
      key,
      value,
      priority,
      expTime: expireTime,

      itemListSameExp: null,
      itemListSameExpNode: null,

      itemListSamePrio: null,
      itemListSamePrioNode: null,
    };

    // If this is a new expTime, add it to our expTreeAvlTree, associating that new AvlTreeNode
    // with an ExpTreeNodeValue {} which points to a new LinkedList containing this Item.
    // Otherwise add this Item to the existing AvlTreeNode's ExpTreeNodeValue's LinkedList.
    this.updateExpTreeAndLinkedListForExpTime(item); // O(log(E))

    // If this is a new priority, add it to our priorityTreeAvlTree, associating that new AvlTreeNode
    // with an PriorityTreeNodeValue {} which points to a new LinkedList containing this Item.
    // Otherwise add this Item to the existing AvlTreeNode's PriorityTreeNodeValue's LinkedList.
    // In both cases, update this Item so it refers to those entities.
    this.updatePriorityTreeAndLinkedListForPriority(item); // O(log(P))

    // Add this item to our cache
    this.numItems++;
    this.items.set(key, item); // O(1)
  }

  // Remove the specified item from our cache and the LinkedLists for its expTime and priority.
  private deleteItem(item: Item<T>) { // O(log(P) + log(E))
    // Remove this item from the itemListSameExpNode LinkedList that refers
    // to it. If that list is then empty, detach it from expTree (allowing it
    // to be garbage collected), and delete that expTime value from expTree.
    this.updateExpTreeAndLinkedListForItemRemoval(item); // O(log(E))
  
    // Remove this item from the itemListSamePrioNode LinkedList that refers
    // to it. If that list is then empty, detach it from priorityTree (allowing it
    // to be garbage collected), and delete that priority value from priorityTree.
    this.updatePriorityTreeAndLinkedListForItemRemoval(item); // O(log(P))

    this.numItems--;
    this.items.delete(item.key); // O(1)
  }

  // If this is a new expTime, add it to our expTree AvlTree, associating that new AvlTreeNode
  // with an ExpTreeNodeValue {} which points to a new itemListSameExp LinkedList containing this Item.
  // Otherwise add this Item to the existing AvlTreeNode's ExpTreeNodeValue's LinkedList.
  // In both cases, update the item with refs to those entities.
  private updateExpTreeAndLinkedListForExpTime(item: Item<T>) { // O(log(E))
    // Do we have an AvlTreeNode in the expTree AvlTree for this specific expTime?
    let expTreeNode = this.expTree.findKey(item.expTime); // O(log(E))
    if (!expTreeNode) {
      // No: create LinkedList for items having this expTime, and add this as its _only_ item.
      item.itemListSameExp = new DoublyLinkedList<Item<T>>(); // O(1)
      item.itemListSameExpNode = item.itemListSameExp.insertFirst(item); // O(1)

      // Create an ExpTreeNodeValue to hold this node's key value and ref to that LinkedList
      let expTreeNodeValue: ExpTreeNodeValue<T> = { expTime: item.expTime, itemListSameExp: item.itemListSameExp };

      // Add that to the AvlTree. Unfortunately this returns the AvlTree and not the new AvlTreeNode
      // so we need a second step to get the node.
      this.expTree.insert(expTreeNodeValue); // O(log(E))

      // Not needed!
      // expTreeNode = this.expTree.findKey(item.expTime); // O(log(E))

    } else {
      // Yes, we have an AvlTreeNode in the expTree AvlTree for this specific expTime.
      // Get the associated LinkedList, narrow for Typescript, and add this item to the head of that list.
      let expTreeNodeValue = expTreeNode.getValue(); // O(1)
      if (expTreeNodeValue.itemListSameExp) {
        item.itemListSameExpNode = expTreeNodeValue.itemListSameExp?.insertFirst(item); // O(1)
        item.itemListSameExp = expTreeNodeValue.itemListSameExp;
      }
    }
  }

  // If this is a new priority, add it to our priorityTree AvlTree, associating that new AvlTreeNode
  // with an PriorityTreeNodeValue {} which points to a new itemListSamePrio LinkedList containing this Item.
  // Otherwise add this Item to the existing AvlTreeNode's PriorityTreeNodeValue's LinkedList.
  // In both cases, update the item with refs to those entities.
  private updatePriorityTreeAndLinkedListForPriority(item: Item<T>) { // O(log(P))
    // Do we have an AvlTreeNode in the priorityTree AvlTree for this specific priority?
    let priorityTreeNode = this.priorityTree.findKey(item.priority); // O(log(P))
    if (!priorityTreeNode) {
      // No: create LinkedList for items having this priority, and add this as its _only_ item.
      item.itemListSamePrio = new DoublyLinkedList<Item<T>>(); // O(1)
      item.itemListSamePrioNode = item.itemListSamePrio.insertLast(item); // O(1)

      // Create an PriorityTreeNodeValue to hold this node's key value and ref to that LinkedList
      let priorityTreeNodeValue: PriorityTreeNodeValue<T> = { priority: item.priority, itemListSamePrio: item.itemListSamePrio };

      // Add that to the AvlTree. Unfortunately this returns the AvlTree and not the new AvlTreeNode
      // so we need a second step to get the node.
      this.priorityTree.insert(priorityTreeNodeValue); // O(log(P))    

      // Not needed!
      // priorityTreeNode = this.priorityTree.findKey(item.priority); // O(log(P))

    } else {
      // Yes, we have an AvlTreeNode in the priorityTree AvlTree for this specific priority.
      // Get the associated LinkedList, narrow for Typescript, and add this item to the tail of that list,
      // indicating that it is the most recently used.
      let priorityTreeNodeValue = priorityTreeNode.getValue(); // O(1)      
      if (priorityTreeNodeValue.itemListSamePrio) {
        item.itemListSamePrioNode = priorityTreeNodeValue.itemListSamePrio.insertLast(item); // O(1)
        item.itemListSamePrio = priorityTreeNodeValue.itemListSamePrio;
      }
    }
  }

  // Remove this item from the itemListSameExpNode LinkedList that refers
  // to it. If that list is then empty, detach it from expTree and delete that expTime value from expTree.
  private updateExpTreeAndLinkedListForItemRemoval(item: Item<T>) { // O(log(E))
    if (item.itemListSameExpNode) { // Narrowing type for Typescript, see Item type definition.
      item.itemListSameExp?.remove(item.itemListSameExpNode); // O(1)
      if (item.itemListSameExp?.isEmpty()) { // O(1)
        let expTreeNode = this.expTree.findKey(item.expTime); // O(log(E))
        if (expTreeNode) {
          expTreeNode.getValue().itemListSameExp = null; // O(1)
          this.expTree.removeNode(expTreeNode); // O(log(E))
        }
      }

      // Remove this item's refs to the LinkedList.
      item.itemListSameExp = null;
      item.itemListSameExpNode = null;
    }
  }

  // Remove this item from the itemListSamePrioNode LinkedList that refers
  // to it. If that list is then empty, detach it from priorityTree and delete that priority value from priorityTree.
  private updatePriorityTreeAndLinkedListForItemRemoval(item: Item<T>) { // O(log(P))
    if (item.itemListSamePrioNode) { // Narrowing type for Typescript, see Item type definition.
      item.itemListSamePrio?.remove(item.itemListSamePrioNode); // O(1)
      if (item.itemListSamePrio?.isEmpty()) {
        let priorityTreeNode = this.priorityTree.findKey(item.priority); // O(log(P))
        if (priorityTreeNode) {
          priorityTreeNode.getValue().itemListSamePrio = null; // O(1)
          this.priorityTree.removeNode(priorityTreeNode); // O(log(P))
        }
      }

      // Remove this item's refs to the LinkedList.
      item.itemListSamePrio = null;
      item.itemListSamePrioNode = null;
    }
  }

  //----------------------------------------------------------------------------
  // For Unit Testing and manual inspection
  //----------------------------------------------------------------------------
  // For Unit Testing, see comments on mockTime.
  setMockTime(time: number): void {
    this.mockTime = time;
  }

  // For testing, returns a sorted list of keys for all of the unexpired items in the cache.
  getKeys(): Array<string> {
    const keys: Array<string> = [];
    this.items.forEach((item, key) => {
      if (item.expTime > this.mockTime) {
        keys.push(item.key);
      }
    });
    return keys.sort((s: string, s2: string) => s.localeCompare(s2));
  }

  /* For debug
  // This returns ALL items, including those that have expired,
  // whereas getKeys() only returns non-expired items.
  logItems(): void {
    let itemsArray: Array<Item<T>> = [];
    this.items.forEach((value, key) => itemsArray.push(value)); 
    console.log(`Cached items by key: [ ${ itemsArray.map((item) => `'${ item.key }'`).join(', ') } ]\n`);
  }
  */
};
