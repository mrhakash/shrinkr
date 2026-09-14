import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync, ErrorBanner } from '../ui.js';

export function Billing() {
  const plansQ = useAsync(() => api.plans(), []);
  const subQ = useAsync(() => api.subscription(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = async (planId: string) => {
    if (!window.confirm(`Switch to ${planId.toUpperCase()}? (Sandbox billing — no charge)`)) return;
    setBusy(planId); setError(null);
    try {
      await api.changePlan(planId);
      plansQ.reload();
      subQ.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (plansQ.loading || subQ.loading) return <p className="muted">Loading…</p>;
  const plans = plansQ.data?.plans ?? [];
  const sub = subQ.data;
  const current = sub?.subscription.plan_id;

  return (
    <div>
      <h2>Billing</h2>
      <ErrorBanner error={error ?? plansQ.error ?? subQ.error} />
      <div className="card">
        <div className="spread">
          <div>
            Current plan: <span className="badge ok">{sub?.subscription.plan_name}</span>
            <div className="muted" style={{ marginTop: 6 }}>
              Usage: {sub?.usage.links} / {sub?.usage.maxLinks} links · renews {sub ? new Date(sub.subscription.current_period_end).toLocaleDateString() : '—'}
            </div>
          </div>
          <span className="badge warn">Sandbox mode — no real payments</span>
        </div>
      </div>
      <div className="row" style={{ alignItems: 'stretch' }}>
        {plans.map((p) => (
          <div key={p.id} className={`plan-card ${p.id === current ? 'current' : ''}`}>
            <h3>{p.name}</h3>
            <div className="price">${(p.price_cents / 100).toFixed(0)}<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
            <ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.9 }}>
              <li>{p.max_links} short links</li>
              <li>{p.max_clicks_tracked_per_link.toLocaleString()} click detail / link</li>
            </ul>
            <button
              className={`btn ${p.id === current ? '' : 'primary'}`}
              style={{ width: '100%', marginTop: 12 }}
              disabled={p.id === current || busy !== null}
              onClick={() => change(p.id)}
            >
              {p.id === current ? 'Current plan' : busy === p.id ? 'Switching…' : `Switch to ${p.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
