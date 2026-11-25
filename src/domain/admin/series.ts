export const minuteMs = 60_000;
export const dayMs = 86_400_000;
const vietnamOffset = 7 * 60 * minuteMs;

export function dayKey(date: Date | string | number) {
  return new Date(new Date(date).getTime() + vietnamOffset).toISOString().slice(0, 10);
}

export function dailyStart(now: Date) {
  return new Date(`${dayKey(now.getTime() - 29 * dayMs)}T00:00:00+07:00`).toISOString();
}

export function dailyPoints(now: Date, values: ReadonlyMap<string, number | bigint>) {
  return Array.from({ length: 30 }, (_, index) => {
    const date = dayKey(now.getTime() - (29 - index) * dayMs);
    return { date, value: Number(values.get(date) ?? 0) };
  });
}

export function minuteKey(date: Date | string) {
  return Math.floor(new Date(date).getTime() / minuteMs) * minuteMs;
}

export function countIn<Key>(counts: Map<Key, number>, key: Key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
