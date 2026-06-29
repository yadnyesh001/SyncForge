/**
 * components/ProtectedRoute.jsx
 * -----------------------------------------------------------------------------
 * Route guard. While the session is being restored we show a spinner; if there's
 * no user we redirect to /login; otherwise we render the nested routes.
 *
 * Implements the spec's "Protected Routes" requirement using react-router's
 * <Outlet/> so it can wrap a whole group of routes.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
