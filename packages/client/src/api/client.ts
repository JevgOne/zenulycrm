const BASE = '/api';

export async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
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
