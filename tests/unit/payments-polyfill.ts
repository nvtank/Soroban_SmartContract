/**
 * Polyfill Map.groupBy và Object.groupBy cho Node.js 20 nếu thiếu.
 */

export {};

declare global {
  interface MapConstructor {
    groupBy<K, T>(
      items: Iterable<T>,
      keySelector: (item: T, index: number) => K,
    ): Map<K, T[]>;
  }

  interface ObjectConstructor {
    groupBy<K extends PropertyKey, T>(
      items: Iterable<T>,
      keySelector: (item: T, index: number) => K,
    ): Record<K, T[]>;
  }
}

if (typeof Map.groupBy !== "function") {
  Map.groupBy = function <K, T>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K,
  ): Map<K, T[]> {
    const map = new Map<K, T[]>();
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      const list = map.get(key);
      if (list) {
        list.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  };
}

if (typeof Object.groupBy !== "function") {
  Object.groupBy = function <K extends PropertyKey, T>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K,
  ): Record<K, T[]> {
    const obj = {} as Record<K, T[]>;
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      if (obj[key]) {
        obj[key].push(item);
      } else {
        obj[key] = [item];
      }
    }
    return obj;
  };
}
