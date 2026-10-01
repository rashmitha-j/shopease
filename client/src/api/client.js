// Small fetch wrapper for the Express API.
// Every response from the server is JSON: { success, ... } or { success: false, message }.

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;
const UNREACHABLE = 'Cannot reach the server. Please try again in a moment.';
const TIMED_OUT = 'The server is taking too long to respond. Please try again in a moment.';
const TIMED_OUT_MAYBE_DONE =
  'The server took too long to respond, so your request may or may not have gone through. Please check before trying again.';

// Health endpoint on the Render server itself, not behind the Vercel /api rewrite
const WAKE_URL =
  import.meta.env.VITE_RENDER_HEALTH_URL ?? 'https://shopease-api-gm4r.onrender.com/api/health';

// The backend runs on Render's free tier, which sleeps when idle: the first request after a
// while can take a few minutes while it wakes. Exported so tests can shorten the timings.
export const NETWORK = {
  timeoutMs: 90_000, // give up on a single attempt after 90 s
  retryDelayMs: 10_000, // wait between retries
  retryWindowMs: 180_000, // no waiting beyond 3 minutes after the first attempt
  slowAfterMs: 8_000, // show the loading toast once a request has waited this long (retries included)
};

// Retrying these can't cause a duplicate on the server
const SAFE_TO_REPEAT = ['GET', 'HEAD', 'OPTIONS'];

// Auth endpoints report 401s themselves; retrying them after a refresh makes no sense
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

// The access token lives in memory only (never localStorage), so a script
// injected into the page can't read it from storage. The long-lived refresh
// token is in an httpOnly cookie that the browser sends automatically.
let accessToken = null;
let refreshPromise = null;
let onSessionExpired = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token || null;
};

// Called when the session can't be renewed, so the UI can show the user as logged out
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Called once when the app loads. Requests through the Vercel proxy don't reliably wake a
// sleeping Render server, but one sent straight to it does. Fire-and-forget: 'no-cors' gives
// an unreadable response, which is fine, since only the request reaching Render matters.
export function wakeServer() {
  if (!import.meta.env.PROD || !WAKE_URL) return; // development talks to localhost
  try {
    fetch(WAKE_URL, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).catch(() => {});
  } catch {
    // an invalid URL throws synchronously; the normal retries still apply
  }
}

// ---- Loading toast -------------------------------------------------------------------------
// Counts requests that have been waiting longer than NETWORK.slowAfterMs, measured from the
// first attempt (time spent retrying counts). The toast subscribes with useSyncExternalStore.
let slowRequests = 0;
const slowListeners = new Set();
const notifySlow = () => slowListeners.forEach((listener) => listener());

export const subscribeToSlowRequests = (listener) => {
  slowListeners.add(listener);
  return () => slowListeners.delete(listener);
};
export const hasSlowRequests = () => slowRequests > 0;

function trackSlowness() {
  let slow = false;
  const markSlow = () => {
    if (slow) return;
    slow = true;
    slowRequests++;
    notifySlow();
  };
  const timer = setTimeout(markSlow, NETWORK.slowAfterMs);
  return {
    done() {
      clearTimeout(timer);
      if (!slow) return;
      slow = false;
      slowRequests--;
      notifySlow();
    },
  };
}

// ---- Requests with timeout and retry ------------------------------------------------------
const abortError = () => new DOMException('The request was aborted', 'AbortError');

// Waits between retries; stops early if the caller aborts (e.g. the page was left)
const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

// One attempt. Resolves with { res, data }, or with { failure: 'timeout' | 'network' } when
// the server couldn't be reached. A caller abort is re-thrown as an AbortError.
async function attempt(url, init, signal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => null); // reading the body counts towards the timeout
    if (timedOut) return { failure: 'timeout' };
    if (signal?.aborted) throw abortError();
    return { res, data };
  } catch {
    if (timedOut) return { failure: 'timeout' };
    if (signal?.aborted) throw abortError();
    return { failure: 'network' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const url = `${BASE_URL}${path}`;
  const safeToRepeat = SAFE_TO_REPEAT.includes(method);
  const deadline = Date.now() + NETWORK.retryWindowMs;
  const slowness = trackSlowness();

  try {
    for (;;) {
      // Built per attempt, so a retry uses a token renewed in the meantime
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const init = {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include', // send the refresh-token cookie
      };

      const timeoutMs = Math.max(1, Math.min(NETWORK.timeoutMs, deadline - Date.now()));
      const outcome = await attempt(url, init, signal, timeoutMs);

      let failure = outcome.failure;
      if (!failure) {
        const { res, data } = outcome;
        // A 502/503/504 without our API's JSON body comes from the Vercel proxy while
        // Render is down or waking up. One WITH a message is a real answer from the API.
        if (res.status >= 502 && res.status <= 504 && !data?.message) {
          failure = res.status === 504 ? 'timeout' : 'unavailable'; // 504: the proxy gave up waiting
        } else if (!res.ok) {
          throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
        } else {
          return data;
        }
      }

      // After a timeout the server may already have processed the request, so repeating a
      // POST/PUT/PATCH/DELETE could, for example, place an order twice. Only safe requests
      // are retried then; a request that never got through ('network', 'unavailable') is.
      if (failure === 'timeout' && !safeToRepeat) throw new ApiError(TIMED_OUT_MAYBE_DONE, 0);
      if (Date.now() + NETWORK.retryDelayMs >= deadline) {
        throw new ApiError(failure === 'timeout' ? TIMED_OUT : UNREACHABLE, 0);
      }
      await wait(NETWORK.retryDelayMs, signal);
    }
  } finally {
    slowness.done();
  }
}

// Gets a new access token using the httpOnly refresh cookie and resolves with the user.
// Concurrent callers share one request: the server rotates the refresh token on every
// call and treats reuse of an old one as theft, so two parallel refreshes would end the session.
export function refreshSession() {
  refreshPromise ??= request('/auth/refresh', { method: 'POST' })
    .then((data) => {
      setAccessToken(data.accessToken);
      return data.user;
    })
    .catch((err) => {
      // Only a 401 means the session is over. A network error or timeout (e.g. the server is
      // still waking up) says nothing about the session, so the token is kept.
      if (err.status === 401) setAccessToken(null);
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function api(path, options = {}) {
  const tokenUsed = accessToken;
  try {
    return await request(path, options);
  } catch (err) {
    // An expired access token gives a 401: renew it once and retry the request
    if (err.status !== 401 || !tokenUsed || NO_REFRESH_PATHS.includes(path)) throw err;

    // Another request may have renewed the token while this one was in flight
    if (accessToken === tokenUsed) {
      try {
        await refreshSession();
      } catch (refreshErr) {
        if (refreshErr.status === 401) onSessionExpired?.(); // not on network errors
        throw refreshErr;
      }
    }
    return request(path, options);
  }
}
