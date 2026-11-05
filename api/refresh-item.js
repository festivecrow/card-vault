import { requireUser, sendError } from './_lib/supabaseAdmin.js';
import { currentPrice, savePrice, savePriceError } from './_lib/pricing.js';

// POST /api/refresh-item  { "id": "<holding id>" }  — refresh one item now
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { sb, user } = auth;
    const id = req.body?.id;
    const { data: item, error } = await sb
      .from('cv_holdings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error || !item) return res.status(404).json({ error: 'Item not found' });
    if (item.price_source === 'manual' || !item.source_id) {
      return res.status(400).json({ error: 'This item uses a manual price' });
    }
    try {
      const price = await currentPrice(item.price_source, item.source_id, item.price_field);
      await savePrice(sb, item, price);
    } catch (err) {
      await savePriceError(sb, item, err.message);
      throw err;
    }
    const { data: updated } = await sb.from('cv_holdings').select('*').eq('id', id).single();
    res.status(200).json({ item: updated });
  } catch (err) {
    sendError(res, err, 400);
  }
}
