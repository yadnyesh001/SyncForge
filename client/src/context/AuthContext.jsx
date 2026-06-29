/**
 * context/AuthContext.jsx
 * -----------------------------------------------------------------------------
 * App-wide authentication state (the React Context API piece of the stack).
 *
 * WHY IT EXISTS
 *   Many components need to know "who is logged in?" and "are we still checking?"
 *   Lifting that into a context avoids prop-drilling and gives one place to do
 *   login/register/logout, token persistence, and the socket connect/disconnect
 *   side-effects.
 *
 * WHAT IT PROVIDES
 *   { user, loading, login, register, logout }
 *   - On mount, if a token exists, it fetches /auth/profile to restore the
 *     session (so a refresh keeps you logged in).
 *   - login/register store the token, set the user, and open the socket.
 *   - logout clears everything and closes the socket.
 *
 * HOW IT CONNECTS
 *   Wraps the app in main.jsx. ProtectedRoute reads { user, loading }. The Editor
 *   relies on the socket having been connected here.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { tokenStorage } from '../services/api';
import { connectSocket, disconnectSocket } from '../socket/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore a session from a stored token on first load.
  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/profile')
      .then((res) => {
        setUser(res.data.user);
        connectSocket(token);
      })
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  const establishSession = useCallback((token, nextUser) => {
    tokenStorage.set(token);
    setUser(nextUser);
    connectSocket(token);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      establishSession(res.data.token, res.data.user);
      return res.data.user;
    },
    [establishSession]
  );

  const register = useCallback(
    async (name, email, password) => {
      const res = await api.post('/auth/register', { name, email, password });
      establishSession(res.data.token, res.data.user);
      return res.data.user;
    },
    [establishSession]
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
