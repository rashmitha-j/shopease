import { useEffect, useMemo, useState } from 'react';
import { AuthContext } from './auth-context.js';
import * as authApi from '../api/auth.js';
import { setSessionExpiredHandler } from '../api/client.js';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' until we know whether a previous session can be restored
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;

    authApi
      .restoreSession()
      .then((restoredUser) => active && setUser(restoredUser))
      .catch(() => {}) // no valid refresh cookie: the visitor is simply logged out
      .finally(() => active && setStatus('ready'));

    setSessionExpiredHandler(() => setUser(null));

    return () => {
      active = false;
      setSessionExpiredHandler(null);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login: async (credentials) => setUser(await authApi.login(credentials)),
      register: async (details) => setUser(await authApi.register(details)),
      logout: async () => {
        // Even if the server can't be reached, forget the user in this tab
        await authApi.logout().catch(() => {});
        setUser(null);
      },
    }),
    [user, status],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
