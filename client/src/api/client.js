// Small fetch wrapper for the Express API.
// Every response from the server is JSON: { success, ... } or { success: false, message }.

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;
const UNREACHABLE = 'Cannot reach the server. Please try again in a moment.';

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

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include', // send the refresh-token cookie
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(UNREACHABLE, 0);
  }

  const data = await res.json().catch(() => null);
  // 502-504 come from a proxy/host when the API itself is down
  if (res.status >= 502 && res.status <= 504 && !data?.message) {
    throw new ApiError(UNREACHABLE, res.status);
  }
  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
  }
  return data;
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
      setAccessToken(null);
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
        onSessionExpired?.();
        throw refreshErr;
      }
    }
    return request(path, options);
  }
}
