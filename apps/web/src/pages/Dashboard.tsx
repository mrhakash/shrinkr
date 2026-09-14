import React, { useState } from 'react';
import { api, type Link, type Plan } from '../lib/api.js';
import { useAsync, ErrorBanner } from '../ui.js';

export function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.links(), []);
  const [targetUrl, setTargetUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setCreateError(null);
    try {
      await api.createLink(targetUrl, slug || undefined, title || undefined);
      setTargetUrl(''); setSlug(''); setTitle('');
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this short link? It will stop redirecting.')) return;
    await api.deleteLink(id);
    reload();
  };

  const copy = async (l: Link) => {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${l.slug}`);
    setCopied(l.id);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) return <p className="muted">Loading…</p>;

  const links = data?.links ?? [];
  const plan = data?.plan as Plan | undefined;
  const usedPct = plan ? Math.min(100, (links.length / plan.max_links) * 100) : 0;

  return (
    <div>
      <h2>Links</h2>
      <ErrorBanner error={error} />
      <div className="card">
        <div className="spread">
          <div>
            <strong>{links.length} / {plan?.max_links ?? '—'}</strong> links used · Plan: <span className="badge ok">{plan?.name}</span>
            <div className="meter" style={{ width: 220 }}><div style={{ width: `${usedPct}%` }} /></div>
          </div>
          {plan?.id === 'free' && <a className="btn" href="/app/billing">Upgrade</a>}
        </div>
      </div>

      <div className="card">
        <h3>Shorten a link</h3>
        <ErrorBanner error={createError} />
        <form onSubmit={create} className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 240 }}>
            <label htmlFor="target">Long URL (http/https)</label>
            <input id="target" className="input" placeholder="https://example.com/very/long/path" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} required />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label htmlFor="slug">Custom slug (optional)</label>
            <input id="slug" className="input" placeholder="auto" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label htmlFor="title">Title (optional)</label>
            <input id="title" className="input" placeholder="Launch page" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <button className="btn primary" disabled={busy} type="submit">{busy ? 'Creating…' : 'Shorten'}</button>
        </form>
      </div>

      {links.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">No links yet. Shorten your first link above — it takes seconds.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Short</th><th>Target</th><th>Clicks</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td><a className="slug-preview" href={`/r/${l.slug}`} target="_blank" rel="noreferrer">/r/{l.slug}</a></td>
                  <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.title ? <>{l.title}<br /></> : null}
                    <span className="muted">{l.target_url}</span>
                  </td>
                  <td><strong>{l.total_clicks}</strong></td>
                  <td className="muted">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="row">
                      <button className="btn small" onClick={() => copy(l)}>{copied === l.id ? 'Copied!' : 'Copy'}</button>
                      <button className="btn small danger" onClick={() => remove(l.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
