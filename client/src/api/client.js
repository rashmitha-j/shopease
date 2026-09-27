// Small fetch wrapper for the Express API.
// Every response from the server is JSON: { success, ... } or { success: false, message }.

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;
const UNREACHABLE = 'Cannot reach the server. Please try again in a moment.';

// The access token lives in memory only (never localStorage), so a script
// injected into the page can't read it from storage. The long-lived refresh
// token is in an httpOnly cookie that the browser sends automatically.
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token || null;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
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
