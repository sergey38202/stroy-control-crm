import { useCallback, useEffect, useRef, useState } from 'react';

// Callers pass a useCallback loader. Invalidate in-flight results on unmount,
// route changes, account changes and refresh. Never retain stale rows on errors.
export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(undefined);
    setData(undefined);
    try {
      const result = await loader();
      if (sequence.current === request) setData(result);
    } catch (failure) {
      if (sequence.current === request) setError(failure);
    } finally {
      if (sequence.current === request) setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    void refresh();
    // Window focus is not a data change. Refresh on navigation, explicit user
    // requests and successful mutations; focus changes must not blank the screen.
    return () => {
      sequence.current++;
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}
