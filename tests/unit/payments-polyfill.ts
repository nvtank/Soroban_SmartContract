/**
 * Polyfill Map.groupBy và Object.groupBy cho Node.js 20 nếu thiếu.
 */
if (typeof (Map as any).groupBy !== "function") {
  (Map as any).groupBy = function <K, T>(
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

if (typeof (Object as any).groupBy !== "function") {
  (Object as any).groupBy = function <K extends PropertyKey, T>(
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
