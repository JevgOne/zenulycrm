const BASE = '/api';

function getToken(): string | null {
  const auth = localStorage.getItem('zenuly_auth');
  if (!auth) return null;
  try {
    return JSON.parse(auth).token || null;
  } catch {
    return null;
  }
}

export async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired or invalid - clear auth and redirect to login
    localStorage.removeItem('zenuly_auth');
    if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
      window.location.href = '/';
    }
    throw new Error('Nepřihlášen');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  return res.json();
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: any) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T = any>(path: string, body: any) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: any) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T = any>(path: string) =>
  api<T>(path, { method: 'DELETE' });

// Auth helpers
export function isLoggedIn(): boolean {
  const auth = localStorage.getItem('zenuly_auth');
  if (!auth) return false;
  try {
    const parsed = JSON.parse(auth);
    return !!parsed.token;
  } catch {
    return false;
  }
}

export function logout() {
  localStorage.removeItem('zenuly_auth');
  window.location.href = '/';
}

export function getUser(): { email: string; name: string; role: string } | null {
  const auth = localStorage.getItem('zenuly_auth');
  if (!auth) return null;
  try {
    return JSON.parse(auth).user || null;
  } catch {
    return null;
  }
}
