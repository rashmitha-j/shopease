import { createContext } from 'react';

// { user, status: 'loading' | 'ready', login, register, logout }; provided by <AuthProvider>
export const AuthContext = createContext(null);
