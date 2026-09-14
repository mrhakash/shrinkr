import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './ui.js';
import { api } from './lib/api.js';
import { Landing } from './pages/Landing.js';
import { Login, Signup } from './pages/Auth.js';
import { Dashboard } from './pages/Dashboard.js';
import { Billing } from './pages/Billing.js';
import { Settings } from './pages/Settings.js';
import { AdminMetrics, AdminOrgs, AdminUsers, AdminAudit } from './pages/Admin.js';

function FullscreenLoading() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }} className="muted">Loading…</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullscreenLoading />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isPlatformAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, org, refresh } = useAuth();
  const logout = async () => {
    await api.logout();
    await refresh();
    window.location.href = '/';
  };
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Shrink<span>r</span></div>
        <NavLink to="/app" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Links</NavLink>
        <NavLink to="/app/billing" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Billing</NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Settings</NavLink>
        {user?.isPlatformAdmin && (
          <>
            <div className="muted" style={{ margin: '14px 12px 6px', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Admin</div>
            <NavLink to="/admin" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Metrics</NavLink>
            <NavLink to="/admin/orgs" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Workspaces</NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Users</NavLink>
            <NavLink to="/admin/audit" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Audit log</NavLink>
          </>
        )}
        <div style={{ marginTop: 'auto' }}>
          <div className="muted" style={{ fontSize: 13, padding: '0 12px 8px' }}>
            {org?.name}<br />{user?.email}
          </div>
          <button className="btn" style={{ width: '100%' }} onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/app" element={<RequireAuth><Shell><Dashboard /></Shell></RequireAuth>} />
      <Route path="/app/billing" element={<RequireAuth><Shell><Billing /></Shell></RequireAuth>} />
      <Route path="/app/settings" element={<RequireAuth><Shell><Settings /></Shell></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><Shell><AdminMetrics /></Shell></RequireAdmin>} />
      <Route path="/admin/orgs" element={<RequireAdmin><Shell><AdminOrgs /></Shell></RequireAdmin>} />
      <Route path="/admin/users" element={<RequireAdmin><Shell><AdminUsers /></Shell></RequireAdmin>} />
      <Route path="/admin/audit" element={<RequireAdmin><Shell><AdminAudit /></Shell></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
