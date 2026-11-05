import { requireUser, sendError } from './_lib/supabaseAdmin.js';
import { quote } from './_lib/pricing.js';

// GET /api/quote?source=sportscardspro&id=72584
export default async function handler(req, res) {
  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { source, id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    res.status(200).json(await quote(source, String(id)));
  } catch (err) {
    sendError(res, err, 400);
  }
}
