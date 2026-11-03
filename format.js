const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money = (n) => (n == null || Number.isNaN(n) ? '—' : usd.format(n));
export const moneyShort = (n) => (n == null ? '—' : Math.abs(n) >= 10000 ? usd0.format(n) : usd.format(n));
export const signedMoney = (n) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${usd.format(Math.abs(n))}`);
export const pct = (n) => (n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`);
export const plClass = (n) => (n > 0.004 ? 'up' : n < -0.004 ? 'down' : 'flat');
export const num = (v) => (v === '' || v == null ? null : Number(v));
export const round2 = (n) => Math.round(n * 100) / 100;

export function dateLabel(d) {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export const KIND_LABELS = { single: 'Single', graded: 'Graded', sealed: 'Sealed' };
export const CATEGORY_LABELS = { sports: 'Sports', tcg: 'TCG' };
export const SOURCE_LABELS = {
  tcgapi: 'TCGplayer Market',
  sportscardspro: 'SportsCardsPro',
  pricecharting: 'PriceCharting',
  manual: 'Manual',
};
export const PLATFORMS = ['Fanatics Live', 'eBay', 'Whatnot', 'TCGplayer', 'Card show', 'In person', 'Other'];

// Money math for one item
export function itemMath(h) {
  const qty = h.quantity || 0;
  const cost = qty * Number(h.cost_per_unit || 0);
  const priced = h.current_price != null;
  const unit = priced ? Number(h.current_price) : Number(h.cost_per_unit || 0);
  const value = qty * unit;
  const pl = priced ? value - cost : 0;
  const plPct = priced && cost > 0 ? (pl / cost) * 100 : null;
  return { qty, cost, value, pl, plPct, priced };
}

export function saleNet(s) {
  return Number(s.sale_price) - Number(s.fees) - Number(s.shipping_cost) - Number(s.cost_basis);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
