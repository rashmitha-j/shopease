import { api, refreshSession, setAccessToken } from './client.js';

// Each call resolves with the logged-in user and keeps the access token in memory.

export async function login({ email, password }) {
  const data = await api('/auth/login', { method: 'POST', body: { email, password } });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function register({ name, email, password }) {
  const data = await api('/auth/register', { method: 'POST', body: { name, email, password } });
  setAccessToken(data.accessToken);
  return data.user;
}

// Restores the session after a page reload, using the refresh cookie
export const restoreSession = refreshSession;

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}
