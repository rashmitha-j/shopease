import { useSyncExternalStore } from 'react';
import { hasSlowRequests, subscribeToSlowRequests } from '../../api/client.js';

// Small toast in the bottom corner, shown only once an API request has been waiting longer
// than NETWORK.slowAfterMs (8 s). On Render's free tier that usually means the server is
// waking up; normal page loads finish long before it would appear.
export default function SlowLoadingToast() {
  const slow = useSyncExternalStore(subscribeToSlowRequests, hasSlowRequests);

  return (
    // The live region stays mounted so screen readers announce the message when it appears
    <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      {slow && (
        <p className="flex items-center gap-2.5 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur motion-safe:animate-toast-in">
          <span
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 motion-reduce:animate-none"
            aria-hidden="true"
          />
          Loading…
        </p>
      )}
    </div>
  );
}
