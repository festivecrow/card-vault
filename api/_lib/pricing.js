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
    ebay: Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
    sportscardspro: Boolean(process.env.SPORTSCARDSPRO_TOKEN),
    pricecharting: Boolean(process.env.PRICECHARTING_TOKEN),
  };
}

// ---------- eBay (free Browse API: active Buy It Now listings) ----------
// Used for sports sealed wax. Sealed boxes are identical products, so the
// cheapest legit Buy It Now listings are a good read on market price.
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_DEFAULT_EXCLUDE = [
  'case', 'break', 'spot', 'pick your', 'you pick', 'pyt', 'random', 'repack', 'empty',
  'opened', 'resealed', 'lot of', 'digital', 'read description', 'no packs', 'wrapper',
];
let ebayToken = null;

async function ebayAuth() {
  if (ebayToken && ebayToken.exp > Date.now() + 60_000) return ebayToken.value;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set in Vercel');
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
    signal: AbortSignal.timeout(15000),
  });
  const b = await r.json().catch(() => null);
  if (!r.ok || !b?.access_token) {
    throw new Error(b?.error_description || `eBay sign-in failed (HTTP ${r.status}). Check your eBay keys.`);
  }
  ebayToken = { value: b.access_token, exp: Date.now() + (b.expires_in || 7200) * 1000 };
  return ebayToken.value;
}

export function parseEbayId(id) {
  try {
    const o = JSON.parse(id);
    return { q: String(o.q || ''), x: String(o.x || '') };
  } catch {
    return { q: String(id || ''), x: '' };
  }
}

export function ebaySearchUrl(q) {
  const p = new URLSearchParams({ _nkw: q, LH_BIN: '1', LH_ItemCondition: '1000', _sop: '15' });
  return `https://www.ebay.com/sch/i.html?${p}`;
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round2 = (n) => Math.round(n * 100) / 100;

export async function ebayLookup(q, extraExclude = '') {
  if (!q || q.trim().length < 3) throw new Error('Type at least 3 characters');
  const token = await ebayAuth();
  const params = new URLSearchParams({
    q: q.trim(),
    limit: '100',
    filter: 'buyingOptions:{FIXED_PRICE},conditionIds:{1000},itemLocationCountry:US,deliveryCountry:US,priceCurrency:USD',
  });
  const r = await fetch(`${EBAY_SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
    signal: AbortSignal.timeout(15000),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = body?.errors?.[0]?.longMessage || body?.errors?.[0]?.message || `eBay search failed (HTTP ${r.status})`;
    throw new Error(msg);
  }

  const exclude = [
    ...EBAY_DEFAULT_EXCLUDE,
    ...extraExclude.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean),
  ];
  const years = q.match(/\b(19|20)\d{2}(-\d{2})?\b/g) || [];

  const listings = [];
  for (const it of body?.itemSummaries || []) {
    const title = it.title || '';
    const t = title.toLowerCase();
    if (exclude.some((w) => t.includes(w))) continue;
    if (years.some((y) => !t.includes(y.toLowerCase()))) continue;
    const price = Number(it.price?.value);
    if (!price || it.price?.currency !== 'USD') continue;
    const ship = Number(it.shippingOptions?.[0]?.shippingCost?.value || 0);
    listings.push({
      title,
      price: round2(price),
      shipping: round2(ship),
      total: round2(price + ship),
      url: it.itemWebUrl,
      image: it.image?.imageUrl || it.thumbnailImages?.[0]?.imageUrl || null,
    });
  }
  listings.sort((a, b) => a.total - b.total);

  // Drop suspiciously cheap listings (wrong item, scams), then take the
  // middle of the 5 cheapest that remain.
  const mid = median(listings.map((l) => l.total));
  const sane = mid ? listings.filter((l) => l.total >= mid * 0.6) : [];
  const estimate = sane.length ? round2(median(sane.slice(0, 5).map((l) => l.total))) : null;

  return { estimate, count: listings.length, used: sane.slice(0, 5), listings: listings.slice(0, 25), url: ebaySearchUrl(q.trim()) };
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
  if (source === 'ebay') {
    const { q, x } = parseEbayId(id);
    const res = await ebayLookup(q, x);
    if (res.count < 3 && res.estimate != null) {
      // Too few listings to trust; still return it so the user can decide.
      res.lowConfidence = true;
    }
    return { prices: [{ key: 'ebay-low', label: 'eBay low Buy It Now', value: res.estimate }], ebay: res };
  }
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
