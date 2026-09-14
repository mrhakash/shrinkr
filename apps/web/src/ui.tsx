import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, type User, type Org } from './lib/api.js';

export const AuthCtx = createContext<{
  user: User | null;
  org: Org | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
}>({ user: null, org: null, loading: true, refresh: async () => {}, setUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const me = await api.me();
      setUser(me.user);
      setOrg(me.org);
    } catch {
      setUser(null);
      setOrg(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);
  return <AuthCtx.Provider value={{ user, org, loading, refresh, setUser }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e: Error) => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [...deps, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
