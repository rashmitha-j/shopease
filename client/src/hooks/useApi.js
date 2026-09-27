import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Fetches `path` from the API whenever it changes.
// While a new request is loading, the previous `data` is kept so lists don't
// flash empty between pages; `loading` tells the UI a request is in flight.
export function useApi(path) {
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${path}#${reloadKey}`;
  // Result of the last request that finished, tagged with the request it belongs to
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    api(path, { signal: controller.signal })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ key: requestKey, data: null, error });
      });

    // Cancel the request if the path changes or the component unmounts
    return () => controller.abort();
  }, [path, requestKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  const loading = result.key !== requestKey;
  return { data: result.data, error: loading ? null : result.error, loading, retry };
}
