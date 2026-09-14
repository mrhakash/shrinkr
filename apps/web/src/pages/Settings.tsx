import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth, ErrorBanner } from '../ui.js';

export function Settings() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null); setProfileErr(null);
    try {
      await api.updateProfile(name);
      await refresh();
      setProfileMsg('Profile saved.');
    } catch (err) {
      setProfileErr((err as Error).message);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null); setPwErr(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPwMsg('Password changed. All sessions logged out — please log in again.');
      setCurrentPassword(''); setNewPassword('');
    } catch (err) {
      setPwErr((err as Error).message);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account? Your workspace and links stop working. This cannot be undone.')) return;
    await api.deleteAccount();
    window.location.href = '/';
  };

  return (
    <div>
      <h2>Settings</h2>
      <div className="card">
        <h3>Profile</h3>
        {profileMsg && <div className="success">{profileMsg}</div>}
        <ErrorBanner error={profileErr} />
        <form onSubmit={saveProfile}>
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="name">Display name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="muted" style={{ marginBottom: 10 }}>Email: {user?.email} (cannot change)</div>
          <button className="btn primary" type="submit">Save profile</button>
        </form>
      </div>

      <div className="card">
        <h3>Change password</h3>
        {pwMsg && <div className="success">{pwMsg}</div>}
        <ErrorBanner error={pwErr} />
        <form onSubmit={savePassword}>
          <div className="row">
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="cur">Current password</label>
              <input id="cur" className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="new">New password (8+)</label>
              <input id="new" className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
          </div>
          <button className="btn primary" type="submit">Change password</button>
        </form>
      </div>

      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)' }}>Danger zone</h3>
        <p className="muted">Deletes your account and workspace. Short links stop redirecting immediately.</p>
        <button className="btn danger" onClick={deleteAccount}>Delete account</button>
      </div>
    </div>
  );
}
