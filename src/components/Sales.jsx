import { useMemo, useState } from 'react';
import Modal from './Modal';
import SaleForm from './SaleForm';
import { supabase } from '../supabase';
import { CATEGORY_LABELS, dateLabel, money, plClass, saleNet, signedMoney } from '../lib/format';

export default function Sales({ sales, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState('all');
  const [year, setYear] = useState('all');

  const platforms = useMemo(() => [...new Set(sales.map((s) => s.platform).filter(Boolean))].sort(), [sales]);
  const years = useMemo(() => [...new Set(sales.map((s) => s.sold_on.slice(0, 4)))].sort().reverse(), [sales]);

  const rows = sales
    .filter((s) => platform === 'all' || s.platform === platform)
    .filter((s) => year === 'all' || s.sold_on.startsWith(year));

  const t = rows.reduce(
    (a, s) => ({
      revenue: a.revenue + Number(s.sale_price),
      fees: a.fees + Number(s.fees) + Number(s.shipping_cost),
      cost: a.cost + Number(s.cost_basis),
      net: a.net + saleNet(s),
    }),
    { revenue: 0, fees: 0, cost: 0, net: 0 }
  );

  async function remove(s) {
    if (!window.confirm('Delete this sale? This does not add the item back to your inventory.')) return;
    await supabase.from('cv_sales').delete().eq('id', s.id);
    onChanged();
  }

  return (
    <div className="stack">
      <section className="panel sales-sum">
        <div className="stat"><div className="label">Revenue</div><div className="mono">{money(t.revenue)}</div></div>
        <div className="stat"><div className="label">Fees + shipping</div><div className="mono">{money(t.fees)}</div></div>
        <div className="stat"><div className="label">Cost basis</div><div className="mono">{money(t.cost)}</div></div>
        <div className="stat"><div className="label">Net profit</div><div className={`mono big ${plClass(t.net)}`}>{signedMoney(t.net)}</div></div>
      </section>

      <div className="filters panel row">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
          <option value="all">All platforms</option>
          {platforms.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
          <option value="all">All time</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <button className="btn primary push" onClick={() => setAdding(true)}>+ Log a sale</button>
      </div>
      <p className="muted tiny">To sell something from your inventory, open it and tap “Record sale”. Use “Log a sale” for things you never added, like break spots.</p>

      {!rows.length ? (
        <div className="empty"><p className="muted">No sales yet.</p></div>
      ) : (
        <ul className="item-list">
          {rows.map((s) => {
            const net = saleNet(s);
            return (
              <li key={s.id} className="panel sale-row">
                <div className="item-main">
                  <div className="item-name">{s.item_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}</div>
                  <div className="muted small">
                    {[dateLabel(s.sold_on), s.platform, s.category && CATEGORY_LABELS[s.category]].filter(Boolean).join(' · ')}
                  </div>
                  <div className="muted tiny">
                    Sold {money(Number(s.sale_price))} − fees {money(Number(s.fees) + Number(s.shipping_cost))} − cost {money(Number(s.cost_basis))}
                  </div>
                </div>
                <div className="item-nums">
                  <div className={`mono ${plClass(net)}`}>{signedMoney(net)}</div>
                  <button className="link small" onClick={() => remove(s)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <Modal title="Log a sale" onClose={() => setAdding(false)}>
          <SaleForm onCancel={() => setAdding(false)} onDone={async () => { setAdding(false); await onChanged(); }} />
        </Modal>
      )}
    </div>
  );
}
