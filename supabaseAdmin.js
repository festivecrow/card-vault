import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Makes sure the request comes from a signed-in user of this app.
export async function requireUser(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }
  const sb = adminClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
    return null;
  }
  return { user: data.user, sb };
}

export function sendError(res, err, status = 500) {
  console.error(err);
  res.status(status).json({ error: err?.message || 'Something went wrong' });
}
