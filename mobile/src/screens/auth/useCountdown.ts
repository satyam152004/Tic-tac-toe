import { useCallback, useEffect, useState } from 'react';

/** Whole-second countdown; `start(n)` restarts it. */
export function useCountdown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const start = useCallback((n: number) => setLeft(Math.max(0, Math.ceil(n))), []);
  return { left, start };
}
