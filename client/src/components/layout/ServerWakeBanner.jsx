import { useSyncExternalStore } from 'react';
import { hasSlowRequests, subscribeToSlowRequests } from '../../api/client.js';

// Shown while any API request has been waiting 5 seconds or is being retried, which on
// Render's free tier usually means the server is starting up after sleeping.
export default function ServerWakeBanner() {
  const slow = useSyncExternalStore(subscribeToSlowRequests, hasSlowRequests);

  return (
    <div role="status" aria-live="polite">
      {slow && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
            <span
              className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700"
              aria-hidden="true"
            />
            Waking up the server, this can take up to a minute
          </p>
        </div>
      )}
    </div>
  );
}
