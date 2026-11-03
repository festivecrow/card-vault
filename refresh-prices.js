import { adminClient, sendError } from './_lib/supabaseAdmin.js';
import { currentPrice, savePrice, savePriceError } from './_lib/pricing.js';

// Runs every night from vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const sb = adminClient();
    const items = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('cv_holdings')
        .select('*')
        .eq('status', 'holding')
        .neq('price_source', 'manual')
        .not('source_id', 'is', null)
        .range(from, from + 999);
      if (error) throw error;
      items.push(...data);
      if (data.length < 1000) break;
    }

    // Same product owned twice (e.g. 3 rows of one box) only costs one API call
    const cache = new Map();
    const lookup = (item) => {
      const key = `${item.price_source}|${item.source_id}|${item.price_field}`;
      if (!cache.has(key)) cache.set(key, currentPrice(item.price_source, item.source_id, item.price_field));
      return cache.get(key);
    };

    let updated = 0;
    const failed = [];
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const item = items[next++];
        try {
          const price = await lookup(item);
          await savePrice(sb, item, price);
          updated++;
        } catch (err) {
          failed.push({ name: item.name, error: err.message });
          await savePriceError(sb, item, err.message);
        }
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));

    res.status(200).json({ checked: items.length, updated, apiCalls: cache.size, failed });
  } catch (err) {
    sendError(res, err);
  }
}
