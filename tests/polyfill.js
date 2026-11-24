if (typeof Map.groupBy !== "function") {
  Map.groupBy = function (items, keySelector) {
    const map = new Map();
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      const group = map.get(key);
      if (!group) {
        map.set(key, [item]);
      } else {
        group.push(item);
      }
    }
    return map;
  };
}

if (typeof Object.groupBy !== "function") {
  Object.groupBy = function (items, keySelector) {
    const obj = {};
    let index = 0;
    for (const item of items) {
      const key = keySelector(item, index++);
      if (!obj[key]) {
        obj[key] = [item];
      } else {
        obj[key].push(item);
      }
    }
    return obj;
  };
}

// Polyfill globalThis.WebSocket for Node 20 if needed
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class MockWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}
