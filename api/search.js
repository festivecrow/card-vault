import { requireUser, sendError } from './_lib/supabaseAdmin.js';
import { search } from './_lib/pricing.js';

// GET /api/search?source=tcgapi&q=charizard&kind=single
export default async function handler(req, res) {
  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { source, q, kind } = req.query;
    const results = await search(source, q, kind);
    res.status(200).json({ results });
  } catch (err) {
    sendError(res, err, 400);
  }
}
