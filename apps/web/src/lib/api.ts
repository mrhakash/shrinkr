export interface User { id: string; email: string; name: string; isPlatformAdmin: boolean }
export interface Org { id: string; name: string; slug: string; status: string; role: string }
export interface Plan { id: string; name: string; price_cents: number; max_links: number; max_clicks_tracked_per_link: number }
export interface Link { id: string; slug: string; target_url: string; title: string | null; total_clicks: number; created_at: string }

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => call<{ user: User; org: Org | null }>('GET', '/api/auth/me'),
  signup: (email: string, password: string, name: string) =>
    call<{ user: User }>('POST', '/api/auth/signup', { email, password, name }),
  login: (email: string, password: string) => call<{ user: User }>('POST', '/api/auth/login', { email, password }),
  logout: () => call<{ ok: boolean }>('POST', '/api/auth/logout'),
  links: () => call<{ links: Link[]; plan: Plan }>('GET', '/api/links'),
  createLink: (targetUrl: string, slug?: string, title?: string) =>
    call<{ link: Link }>('POST', '/api/links', { targetUrl, slug, title }),
  deleteLink: (id: string) => call<{ ok: boolean }>('DELETE', `/api/links/${id}`),
  clicks: (id: string) => call<{ clicks: { occurred_at: string; referrer: string | null; user_agent: string | null }[] }>('GET', `/api/links/${id}/clicks`),
  plans: () => call<{ mode: string; plans: Plan[] }>('GET', '/api/billing/plans'),
  subscription: () => call<{ subscription: { plan_id: string; plan_name: string; current_period_end: string }; usage: { links: number; maxLinks: number } }>('GET', '/api/billing/subscription'),
  changePlan: (planId: string) => call<{ ok: boolean }>('POST', '/api/billing/change-plan', { planId }),
  updateProfile: (name: string) => call<{ ok: boolean }>('PATCH', '/api/auth/me', { name }),
  changePassword: (currentPassword: string, newPassword: string) =>
    call<{ ok: boolean }>('PATCH', '/api/auth/password', { currentPassword, newPassword }),
  deleteAccount: () => call<{ ok: boolean }>('DELETE', '/api/auth/me'),
  adminMetrics: () => call<{ orgs: number; users: number; links: number; clicks: number }>('GET', '/api/admin/metrics'),
  adminOrgs: () => call<{ orgs: { id: string; name: string; slug: string; status: string; plan_id: string | null; link_count: number; created_at: string }[] }>('GET', '/api/admin/orgs'),
  adminUsers: () => call<{ users: { id: string; email: string; name: string; is_platform_admin: number; org_name: string | null }[] }>('GET', '/api/admin/users'),
  adminAudit: () => call<{ events: { id: string; action: string; target_type: string | null; target_id: string | null; created_at: string }[] }>('GET', '/api/admin/audit'),
  adminSuspend: (orgId: string) => call<{ ok: boolean }>('POST', `/api/admin/orgs/${orgId}/suspend`),
  adminResume: (orgId: string) => call<{ ok: boolean }>('POST', `/api/admin/orgs/${orgId}/resume`),
  adminPromote: (userId: string) => call<{ ok: boolean }>('POST', `/api/admin/users/${userId}/promote`),
};
