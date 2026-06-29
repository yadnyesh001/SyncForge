/**
 * services/api.js
 * -----------------------------------------------------------------------------
 * The single Axios instance for all REST calls.
 *
 * WHY IT EXISTS
 *   Centralizes the base URL and, crucially, the auth header. Instead of every
 *   component remembering to attach the JWT, a request interceptor does it once.
 *   A response interceptor handles global 401s (expired/invalid token) by
 *   clearing the session so the app falls back to the login screen.
 *
 * HOW IT CONNECTS
 *   AuthContext and the page components import this. The token is read from
 *   localStorage, which AuthContext keeps in sync.
 */

import axios from 'axios';

const TOKEN_KEY = 'syncdocs_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach the bearer token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, the token is dead — drop it. AuthContext's route guard then redirects.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export default api;
