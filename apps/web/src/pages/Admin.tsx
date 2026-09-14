import React from 'react';
import { api } from '../lib/api.js';
import { useAsync, ErrorBanner } from '../ui.js';

export function AdminMetrics() {
  const { data, loading, error } = useAsync(() => api.adminMetrics(), []);
  if (loading) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h2>Platform metrics</h2>
      <ErrorBanner error={error} />
      <div className="card">
        <div className="metric"><div className="num">{data?.orgs ?? '—'}</div><div className="muted">Workspaces</div></div>
        <div className="metric"><div className="num">{data?.users ?? '—'}</div><div className="muted">Users</div></div>
        <div className="metric"><div className="num">{data?.links ?? '—'}</div><div className="muted">Links</div></div>
        <div className="metric"><div className="num">{data?.clicks ?? '—'}</div><div className="muted">Total clicks</div></div>
      </div>
    </div>
  );
}

export function AdminOrgs() {
  const { data, loading, error, reload } = useAsync(() => api.adminOrgs(), []);
  const act = async (fn: () => Promise<unknown>) => { await fn(); reload(); };
  if (loading) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h2>Workspaces</h2>
      <ErrorBanner error={error} />
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Name</th><th>Slug</th><th>Plan</th><th>Links</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(data?.orgs ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td className="muted">{o.slug}</td>
                <td>{o.plan_id ? <span className="badge ok">{o.plan_id}</span> : '—'}</td>
                <td>{o.link_count}</td>
                <td>
                  {o.status === 'active' ? <span className="badge ok">active</span> : <span className="badge danger">suspended</span>}
                </td>
                <td>
                  {o.status === 'active'
                    ? <button className="btn small danger" onClick={() => act(() => api.adminSuspend(o.id))}>Suspend</button>
                    : <button className="btn small" onClick={() => act(() => api.adminResume(o.id))}>Resume</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { data, loading, error, reload } = useAsync(() => api.adminUsers(), []);
  const promote = async (id: string) => { await api.adminPromote(id); reload(); };
  if (loading) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h2>Users</h2>
      <ErrorBanner error={error} />
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Workspace</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td className="muted">{u.org_name ?? '—'}</td>
                <td>{u.is_platform_admin ? <span className="badge warn">admin</span> : <span className="badge">user</span>}</td>
                <td>
                  {u.is_platform_admin ? null : <button className="btn small" onClick={() => promote(u.id)}>Promote to admin</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAudit() {
  const { data, loading, error } = useAsync(() => api.adminAudit(), []);
  if (loading) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h2>Audit log</h2>
      <ErrorBanner error={error} />
      <div className="card" style={{ padding: 0, maxHeight: 500, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Time</th><th>Action</th><th>Target</th></tr></thead>
          <tbody>
            {(data?.events ?? []).map((e) => (
              <tr key={e.id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString()}</td>
                <td><code>{e.action}</code></td>
                <td className="muted">{e.target_type ? `${e.target_type}:${(e.target_id ?? '').slice(0, 8)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
