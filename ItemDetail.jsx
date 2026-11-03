import { useEffect, useState } from 'react';
import Modal from './Modal';
import PriceChart from './PriceChart';
import SaleForm from './SaleForm';
import Thumb from './Thumb';
import { supabase } from '../supabase';
import { apiCall } from '../lib/api';
import {
  CATEGORY_LABELS, KIND_LABELS, SOURCE_LABELS, dateLabel, itemMath, money, num, pct, plClass, signedMoney, timeAgo, today,
} from '../lib/format';

export default function ItemDetail({ item, onClose, onChanged }) {
  const [mode, setMode] = useState('view'); // view | edit | sell
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const m = itemMath(item);
  const auto = item.price_source !== 'manual' && item.source_id;

  useEffect(() => {
    supabase
      .from('cv_price_history')
      .select('price,recorded_on')
      .eq('holding_id', item.id)
      .order('recorded_on')
      .then(({ data }) => setHistory((data || []).map((r) => ({ date: r.recorded_on, value: Number(r.price) }))));
  }, [item.id, item.current_price]);

  async function refresh() {
    setErr('');
    setRefreshing(true);
    try {
      await apiCall('/api/refresh-item', { method: 'POST', body: { id: item.id } });
    } catch (e) {
      setErr(e.message);
    }
    await onChanged();
    setRefreshing(false);
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.name}" and its price history? Sales you recorded stay in your sales log.`)) return;
    const { error } = await supabase.from('cv_holdings').delete().eq('id', item.id);
    if (error) return setErr(error.message);
    onClose();
    onChanged();
  }

  const title = mode === 'sell' ? 'Record a sale' : mode === 'edit' ? 'Edit item' : 'Item';

  return (
    <Modal title={title} onClose={onClose} wide>
      {mode === 'sell' ? (
        <SaleForm item={item} onCancel={() => setMode('view')} onDone={async () => { await onChanged(); setMode('view'); }} />
      ) : mode === 'edit' ? (
        <EditForm item={item} onCancel={() => setMode('view')} onSaved={async () => { await onChanged(); setMode('view'); }} />
      ) : (
        <div className="stack">
          <div className="detail-head">
            <Thumb item={item} size={84} />
            <div className="item-main">
              <h3 className="detail-name">{item.name}</h3>
              <div className="muted small">{[item.set_name, item.card_number && `#${item.card_number}`, item.grade_label].filter(Boolean).join(' · ')}</div>
              <div className="chips">
                <span className={`chip ${item.category}`}>{CATEGORY_LABELS[item.category]}</span>
                <span className="chip">{KIND_LABELS[item.kind]}</span>
                <span className="chip">{SOURCE_LABELS[item.price_source]}</span>
                {item.status === 'sold' && <span className="chip">Sold out</span>}
              </div>
            </div>
          </div>

          <div className="detail-stats">
            <div><div className="label">Market / each</div><div className="mono">{item.current_price != null ? money(item.current_price) : '—'}</div></div>
            <div><div className="label">Cost / each</div><div className="mono">{money(Number(item.cost_per_unit))}</div></div>
            <div><div className="label">Qty</div><div className="mono">{item.quantity}</div></div>
            <div><div className="label">Total value</div><div className="mono">{money(m.value)}</div></div>
            <div><div className="label">Profit / loss</div><div className={`mono ${plClass(m.pl)}`}>{m.priced ? `${signedMoney(m.pl)} (${pct(m.plPct)})` : '—'}</div></div>
            <div><div className="label">Price checked</div><div className="small">{item.price_source === 'manual' ? 'Manual' : timeAgo(item.price_updated_at)}</div></div>
          </div>

          {item.price_error && (
            <div className="alert small">Last price check failed: {item.price_error}</div>
          )}
          {err && <div className="alert">{err}</div>}

          <div className="panel inset">
            <div className="label">Market price per item</div>
            <PriceChart points={history} height={200} />
          </div>

          <div className="muted small detail-meta">
            {item.purchase_date && <span>Bought {dateLabel(item.purchase_date)}</span>}
            {item.purchased_from && <span>from {item.purchased_from}</span>}
            {item.notes && <span className="notes">“{item.notes}”</span>}
          </div>

          <div className="modal-actions spread">
            <button className="btn danger ghost" onClick={remove}>Delete</button>
            <div className="action-group">
              {auto && <button className="btn ghost" onClick={refresh} disabled={refreshing}>{refreshing ? 'Checking…' : 'Refresh price'}</button>}
              <button className="btn ghost" onClick={() => setMode('edit')}>Edit</button>
              {item.quantity > 0 && <button className="btn primary" onClick={() => setMode('sell')}>Record sale</button>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditForm({ item, onCancel, onSaved }) {
  const [f, setF] = useState({
    name: item.name || '',
    set_name: item.set_name || '',
    grade_label: item.grade_label || '',
    quantity: String(item.quantity),
    cost_per_unit: String(item.cost_per_unit ?? ''),
    current_price: item.current_price != null ? String(item.current_price) : '',
    purchase_date: item.purchase_date || '',
    purchased_from: item.purchased_from || '',
    image_url: item.image_url || '',
    notes: item.notes || '',
  });
  const [stopAuto, setStopAuto] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const manual = item.price_source === 'manual' || stopAuto;

  async function save(e) {
    e.preventDefault();
    const qty = parseInt(f.quantity, 10);
    if (Number.isNaN(qty) || qty < 0) return setErr('Quantity must be 0 or more');
    if (!f.name.trim()) return setErr('Name is required');
    setBusy(true);
    const patch = {
      name: f.name.trim(),
      set_name: f.set_name.trim() || null,
      grade_label: f.grade_label.trim() || null,
      quantity: qty,
      status: qty === 0 ? 'sold' : 'holding',
      cost_per_unit: num(f.cost_per_unit) || 0,
      purchase_date: f.purchase_date || null,
      purchased_from: f.purchased_from.trim() || null,
      image_url: f.image_url.trim() || null,
      notes: f.notes.trim() || null,
    };
    const newPrice = num(f.current_price);
    const priceChanged = manual && newPrice !== (item.current_price != null ? Number(item.current_price) : null);
    if (stopAuto) Object.assign(patch, { price_source: 'manual', source_id: null, price_field: null, price_error: null });
    if (priceChanged) Object.assign(patch, { current_price: newPrice, price_updated_at: new Date().toISOString() });
    const { error } = await supabase.from('cv_holdings').update(patch).eq('id', item.id);
    if (!error && priceChanged && newPrice != null) {
      await supabase.from('cv_price_history').upsert(
        { holding_id: item.id, user_id: item.user_id, price: newPrice, recorded_on: today() },
        { onConflict: 'holding_id,recorded_on' }
      );
    }
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  }

  return (
    <form className="stack" onSubmit={save}>
      <div className="form-grid">
        <label className="span2">Name<input value={f.name} onChange={set('name')} /></label>
        <label>Set / product line<input value={f.set_name} onChange={set('set_name')} /></label>
        <label>Grade / condition<input value={f.grade_label} onChange={set('grade_label')} /></label>
        <label>Quantity<input type="number" min="0" step="1" value={f.quantity} onChange={set('quantity')} /></label>
        <label>Cost per item ($)<input type="number" min="0" step="0.01" value={f.cost_per_unit} onChange={set('cost_per_unit')} /></label>
        {manual && <label>Current value per item ($)<input type="number" min="0" step="0.01" value={f.current_price} onChange={set('current_price')} /></label>}
        <label>Purchase date<input type="date" value={f.purchase_date} onChange={set('purchase_date')} /></label>
        <label>Bought from<input value={f.purchased_from} onChange={set('purchased_from')} /></label>
        <label className="span2">Image URL<input value={f.image_url} onChange={set('image_url')} /></label>
        <label className="span2">Notes<textarea rows="2" value={f.notes} onChange={set('notes')} /></label>
      </div>
      {item.price_source !== 'manual' && (
        <label className="check">
          <input type="checkbox" checked={stopAuto} onChange={(e) => setStopAuto(e.target.checked)} />
          Stop automatic pricing and enter the value myself
        </label>
      )}
      {err && <div className="alert">{err}</div>}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}
