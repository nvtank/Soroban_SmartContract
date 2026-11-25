"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export const adminFixturesEnabled = process.env.NEXT_PUBLIC_ADMIN_FIXTURES === "1";

export function useOpsResource<Data>(
  load: () => Promise<Data>,
  intervalMs = 0,
  shouldPoll?: (data: Data) => boolean,
) {
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<{ load: typeof load; data?: Data; failed: boolean }>();
  const revision = useRef(0);
  const data = snapshot?.load === load ? snapshot.data : undefined;
  const failed = snapshot?.load === load && snapshot.failed;
  const mayPoll = useEffectEvent(
    () => !document.hidden && (!shouldPoll || (data !== undefined && shouldPoll(data))),
  );

  useEffect(() => {
    let disposed = false;
    let inFlight = false;

    async function request() {
      if (inFlight) return;
      inFlight = true;
      const requestedRevision = revision.current;
      const isCurrent = () => !disposed && requestedRevision === revision.current;
      try {
        const result = await load();
        if (isCurrent()) setSnapshot({ load, data: result, failed: false });
      } catch {
        if (isCurrent()) {
          setSnapshot((previous) => ({
            load,
            data: previous?.load === load ? previous.data : undefined,
            failed: true,
          }));
        }
      } finally {
        inFlight = false;
      }
    }

    function poll() {
      if (mayPoll()) void request();
    }

    void request();
    const interval = intervalMs ? window.setInterval(poll, intervalMs) : undefined;
    if (intervalMs) document.addEventListener("visibilitychange", poll);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [intervalMs, load, version]);

  function update(transform: (data: Data) => Data) {
    revision.current += 1;
    setSnapshot((previous) =>
      previous?.load === load && previous.data !== undefined
        ? { ...previous, data: transform(previous.data) }
        : previous,
    );
  }

  return { data, failed, reload: () => setVersion((previous) => previous + 1), update };
}
