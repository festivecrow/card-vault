// All price-source code lives here. API keys stay on the server and never reach the browser.

const TCG_BASE = 'https://api.tcgapi.dev/v1';
const SPORTS_BASE = 'https://www.sportscardspro.com/api';
const PC_BASE = 'https://www.pricecharting.com/api';

// SportsCardsPro / PriceCharting price fields (values come back in pennies)
export const GRADE_FIELDS = [
  { key: 'loose-price', label: 'Ungraded / Raw' },
  { key: 'cib-price', label: 'Grade 7 – 7.5' },
  { key: 'new-price', label: 'Grade 8 – 8.5' },
  { key: 'graded-price', label: 'Grade 9' },
  { key: 'box-only-price', label: 'BGS 9.5' },
  { key: 'manual-only-price', label: 'PSA 10' },
];

export function enabledSources() {
  return {
    tcgapi: Boolean(process.env.TCGAPI_KEY),
    sportscardspro: Boolean(process.env.SPORTSCARDSPRO_TOKEN),
    pricecharting: Boolean(process.env.PRICECHARTING_TOKEN),
  };
}

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  let body = null;
  try { body = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || body?.status === 'error') {
    let msg = body?.['error-message'] || body?.error?.message || body?.error || body?.message || `Price source error (HTTP ${r.status})`;
    if (typeof msg !== 'string') msg = JSON.stringify(msg);
    if (r.status === 429) msg = 'Price source daily limit reached. Try again tomorrow or upgrade your plan.';
    throw new Error(msg);
  }
  return body;
}

function tcgHeaders() {
  if (!process.env.TCGAPI_KEY) throw new Error('TCGAPI_KEY is not set in Vercel');
  return { 'X-API-Key': process.env.TCGAPI_KEY };
}

function pcConfig(source) {
  if (source === 'sportscardspro') {
    if (!process.env.SPORTSCARDSPRO_TOKEN) throw new Error('SPORTSCARDSPRO_TOKEN is not set in Vercel');
    return { base: SPORTS_BASE, token: process.env.SPORTSCARDSPRO_TOKEN };
  }
  if (!process.env.PRICECHARTING_TOKEN) throw new Error('PRICECHARTING_TOKEN is not set in Vercel');
  return { base: PC_BASE, token: process.env.PRICECHARTING_TOKEN };
}

const cents = (v) => (typeof v === 'number' && v > 0 ? Math.round(v) / 100 : null);
const asArray = (d) => (Array.isArray(d) ? d : d ? [d] : []);

// ---------- Search ----------
export async function search(source, q, kind) {
  if (!q || q.trim().length < 2) throw new Error('Type at least 2 characters');
  if (source === 'tcgapi') {
    const params = new URLSearchParams({ q: q.trim(), per_page: '30' });
    if (kind === 'sealed') params.set('type', 'Sealed Products');
    else params.set('type', 'Cards');
    const body = await getJson(`${TCG_BASE}/search?${params}`, tcgHeaders());
    const seen = new Set();
    const out = [];
    for (const d of asArray(body?.data)) {
      const id = String(d.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: d.name,
        set: d.set_name,
        game: d.game_name,
        number: d.number || null,
        image: d.image_url || null,
        price: d.market_price ?? null,
        printing: d.printing || null,
      });
    }
    return out;
  }
  if (source === 'sportscardspro' || source === 'pricecharting') {
    const { base, token } = pcConfig(source);
    const params = new URLSearchParams({ t: token, q: q.trim() });
    const body = await getJson(`${base}/products?${params}`);
    return asArray(body?.products).map((p) => ({
      id: String(p.id),
      name: p['product-name'],
      set: p['console-name'],
      game: p.genre || null,
      number: null,
      image: null,
      price: cents(p['loose-price']),
      printing: null,
    }));
  }
  throw new Error('Unknown price source');
}

// ---------- Quote: every price option for one product ----------
export async function quote(source, id) {
  if (source === 'tcgapi') {
    const body = await getJson(`${TCG_BASE}/cards/${encodeURIComponent(id)}/prices`, tcgHeaders());
    return {
      prices: asArray(body?.data).map((p) => ({
        key: p.printing,
        label: p.printing,
        value: p.market_price ?? null,
        change7d: p.price_change_7d ?? null,
        asOf: p.market_price_as_of || null,
      })),
    };
  }
  if (source === 'sportscardspro' || source === 'pricecharting') {
    const { base, token } = pcConfig(source);
    const params = new URLSearchParams({ t: token, id });
    const p = await getJson(`${base}/product?${params}`);
    return {
      prices: GRADE_FIELDS.map((f) => ({ key: f.key, label: f.label, value: cents(p[f.key]) })),
      salesVolume: p['sales-volume'] ?? null,
    };
  }
  throw new Error('Unknown price source');
}

// ---------- Current price for a saved item ----------
export async function currentPrice(source, id, field) {
  const { prices } = await quote(source, id);
  if (!prices.length) throw new Error('No prices returned for this item');
  let match = prices.find((p) => p.key === field);
  if (!match && source === 'tcgapi') match = prices[0];
  if (!match) throw new Error(`Price type "${field}" not found`);
  if (match.value == null || match.value <= 0) throw new Error(`No current market price for ${match.label}`);
  return Number(match.value);
}

const today = () => new Date().toISOString().slice(0, 10);

// Saves a new price on the item and adds today's point to its history
export async function savePrice(sb, item, price) {
  const now = new Date().toISOString();
  const { error: e1 } = await sb
    .from('cv_holdings')
    .update({ current_price: price, price_updated_at: now, price_error: null })
    .eq('id', item.id);
  if (e1) throw e1;
  const { error: e2 } = await sb
    .from('cv_price_history')
    .upsert(
      { holding_id: item.id, user_id: item.user_id, price, recorded_on: today() },
      { onConflict: 'holding_id,recorded_on' }
    );
  if (e2) throw e2;
}

export async function savePriceError(sb, item, message) {
  await sb.from('cv_holdings').update({ price_error: String(message).slice(0, 300) }).eq('id', item.id);
}
