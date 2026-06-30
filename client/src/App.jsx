/**
 * App.jsx — route table.
 *
 * Public:    /         (Landing), /login, /register
 * Protected: /dashboard (Dashboard), /documents/:id (Editor)
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents/:id" element={<Editor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
