import { supabase } from '../supabase';

// Calls the app's own server functions in /api with the signed-in user's session
export async function apiCall(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `Request failed (${r.status})`);
  return json;
}

// Supabase returns 1,000 rows max per call, so this pages through everything
export async function fetchAll(build) {
  const size = 1000;
  let rows = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    rows = rows.concat(data);
    if (data.length < size) break;
  }
  return rows;
}
