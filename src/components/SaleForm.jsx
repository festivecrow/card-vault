import { useState } from 'react';
import { supabase } from '../supabase';
import { money, num, PLATFORMS, round2, today } from '../lib/format';

// Record a sale. With `item` it's linked to inventory (lowers quantity).
// Without `item` it's a standalone sale (break spots, cards you never logged, etc.)
export default function SaleForm({ item, onDone, onCancel }) {
  const [f, setF] = useState({
    item_name: item?.name || '',
    category: item?.category || 'sports',
    quantity: '1',
    sale_price: '',
    fees: '',
    shipping_cost: '',
    cost_basis: '',
    platform: 'Fanatics Live',
    sold_on: today(),
    notes: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const qty = parseInt(f.quantity, 10) || 0;
  const basis = item ? round2(qty * Number(item.cost_per_unit)) : num(f.cost_basis) || 0;
  const net = (num(f.sale_price) || 0) - (num(f.fees) || 0) - (num(f.shipping_cost) || 0) - basis;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (qty < 1) return setErr('Quantity must be at least 1');
    if (item && qty > item.quantity) return setErr(`You only have ${item.quantity}`);
    if (f.sale_price === '') return setErr('Enter the sale price');
    setBusy(true);
    let error;
    if (item) {
      ({ error } = await supabase.rpc('cv_record_sale', {
        p_holding_id: item.id,
        p_quantity: qty,
        p_sale_price: num(f.sale_price),
        p_fees: num(f.fees) || 0,
        p_shipping: num(f.shipping_cost) || 0,
        p_platform: f.platform || null,
        p_sold_on: f.sold_on || null,
        p_notes: f.notes.trim() || null,
      }));
    } else {
      if (!f.item_name.trim()) {
        setBusy(false);
        return setErr('Enter what you sold');
      }
      ({ error } = await supabase.from('cv_sales').insert({
        item_name: f.item_name.trim(),
        category: f.category,
        quantity: qty,
        sale_price: num(f.sale_price),
        fees: num(f.fees) || 0,
        shipping_cost: num(f.shipping_cost) || 0,
        cost_basis: basis,
        platform: f.platform || null,
        sold_on: f.sold_on || today(),
        notes: f.notes.trim() || null,
      }));
    }
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="form-grid">
        {!item && (
          <>
            <label className="span2">What sold<input value={f.item_name} onChange={set('item_name')} placeholder="e.g. Random team spot, 2024 Prizm break" /></label>
            <label>Category
              <select value={f.category} onChange={set('category')}>
                <option value="sports">Sports</option>
                <option value="tcg">TCG</option>
              </select>
            </label>
          </>
        )}
        <label>Quantity{item && <span className="muted tiny"> (have {item.quantity})</span>}
          <input type="number" min="1" max={item?.quantity} step="1" value={f.quantity} onChange={set('quantity')} />
        </label>
        <label>Total sale price ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.sale_price} onChange={set('sale_price')} /></label>
        <label>Platform fees ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.fees} onChange={set('fees')} placeholder="0.00" /></label>
        <label>Shipping you paid ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.shipping_cost} onChange={set('shipping_cost')} placeholder="0.00" /></label>
        {!item && <label>What it cost you ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.cost_basis} onChange={set('cost_basis')} placeholder="0.00" /></label>}
        <label>Where
          <input list="platforms" value={f.platform} onChange={set('platform')} />
          <datalist id="platforms">{PLATFORMS.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <label>Date sold<input type="date" value={f.sold_on} onChange={set('sold_on')} /></label>
        <label className="span2">Notes<input value={f.notes} onChange={set('notes')} /></label>
      </div>
      <div className="sale-preview">
        <span className="muted small">Cost basis {money(basis)}</span>
        <span className={`mono ${net >= 0 ? 'up' : 'down'}`}>Net profit {money(net)}</span>
      </div>
      {err && <div className="alert">{err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Record sale'}</button>
      </div>
    </form>
  );
}
