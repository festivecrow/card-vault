import { useMemo, useState } from 'react';
import Modal from './Modal';
import { supabase } from '../supabase';
import { apiCall } from '../lib/api';
import { money, num, SOURCE_LABELS, today } from '../lib/format';

function sourceOptions(category, kind, sources) {
  const opts = [];
  if (category === 'tcg') {
    if (kind !== 'graded' && sources.tcgapi) opts.push('tcgapi');
    if (sources.pricecharting) opts.push('pricecharting');
  } else if (sources.sportscardspro) {
    opts.push('sportscardspro');
  }
  opts.push('manual');
  return opts;
}

const SOURCE_HINTS = {
  tcgapi: 'TCGplayer market price (median of recent sales). Raw/ungraded only.',
  sportscardspro: 'Raw and graded values built from recent sales.',
  pricecharting: 'Raw and graded values for Pokémon and other TCGs.',
  manual: 'You type the value. It will not update on its own.',
};

const EMPTY_FORM = {
  name: '', set_name: '', game: '', card_number: '', image_url: '', grade_label: '',
  quantity: '1', cost_per_unit: '', purchase_date: today(), purchased_from: '', notes: '', manual_price: '',
};

export default function AddItem({ sources, onClose, onSaved }) {
  const [category, setCategory] = useState('sports');
  const [kind, setKind] = useState('single');
  const options = useMemo(() => sourceOptions(category, kind, sources), [category, kind, sources]);
  const [sourcePick, setSourcePick] = useState(null);
  const source = options.includes(sourcePick) ? sourcePick : options[0];

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [priceKey, setPriceKey] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function resetPick() {
    setPicked(null);
    setQuote(null);
    setPriceKey('');
    setResults(null);
  }

  async function runSearch(e) {
    e.preventDefault();
    setErr('');
    setSearching(true);
    setResults(null);
    try {
      const params = new URLSearchParams({ source, q: query, kind });
      const { results } = await apiCall(`/api/search?${params}`);
      setResults(results);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSearching(false);
    }
  }

  async function pick(r) {
    setErr('');
    setPicked(r);
    setQuoting(true);
    setForm((f) => ({
      ...f,
      name: r.name || '',
      set_name: r.set || '',
      game: r.game || '',
      card_number: r.number || '',
      image_url: r.image || '',
    }));
    try {
      const params = new URLSearchParams({ source, id: r.id });
      const q = await apiCall(`/api/quote?${params}`);
      setQuote(q);
      const withValue = q.prices.filter((p) => p.value != null);
      let def;
      if (source === 'tcgapi') def = q.prices.find((p) => p.key === r.printing) || withValue[0] || q.prices[0];
      else if (kind === 'graded') def = q.prices.find((p) => p.key === 'manual-only-price' && p.value != null) || withValue[withValue.length - 1];
      else def = q.prices.find((p) => p.key === 'loose-price');
      setPriceKey(def?.key || '');
      if (kind === 'graded' && def && source !== 'tcgapi') setForm((f) => ({ ...f, grade_label: def.label }));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setQuoting(false);
    }
  }

  const chosen = quote?.prices.find((p) => p.key === priceKey);
  const isManual = source === 'manual';
  const ready = form.name.trim() && (isManual || (picked && chosen));

  async function save() {
    setErr('');
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty < 1) return setErr('Quantity must be at least 1');
    if (form.cost_per_unit === '' || Number(form.cost_per_unit) < 0) return setErr('Enter what you paid per item (0 is fine for pulls)');
    setSaving(true);
    const current = isManual ? num(form.manual_price) : chosen?.value ?? null;
    const row = {
      category,
      kind,
      name: form.name.trim(),
      set_name: form.set_name.trim() || null,
      game: form.game.trim() || null,
      card_number: form.card_number.trim() || null,
      image_url: form.image_url.trim() || null,
      grade_label: form.grade_label.trim() || null,
      quantity: qty,
      cost_per_unit: Number(form.cost_per_unit),
      purchase_date: form.purchase_date || null,
      purchased_from: form.purchased_from.trim() || null,
      notes: form.notes.trim() || null,
      price_source: source,
      source_id: isManual ? null : picked.id,
      price_field: isManual ? null : priceKey,
      current_price: current,
      price_updated_at: current != null ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from('cv_holdings').insert(row).select().single();
    if (error) {
      setSaving(false);
      return setErr(error.message);
    }
    if (current != null) {
      await supabase.from('cv_price_history').upsert(
        { holding_id: data.id, user_id: data.user_id, price: current, recorded_on: today() },
        { onConflict: 'holding_id,recorded_on' }
      );
    }
    setSaving(false);
    onSaved();
  }

  const noKeys = !sources.tcgapi && !sources.sportscardspro && !sources.pricecharting;

  return (
    <Modal title="Add to vault" onClose={onClose} wide>
      <div className="stack">
        <div className="grid2 tight">
          <div>
            <div className="label">Category</div>
            <div className="seg full">
              {['sports', 'tcg'].map((c) => (
                <button key={c} className={category === c ? 'active' : ''} onClick={() => { setCategory(c); resetPick(); }}>
                  {c === 'sports' ? 'Sports' : 'TCG'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Type</div>
            <div className="seg full">
              {[['single', 'Single'], ['graded', 'Graded'], ['sealed', 'Sealed']].map(([k, l]) => (
                <button key={k} className={kind === k ? 'active' : ''} onClick={() => { setKind(k); resetPick(); }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="label">Price source</div>
          <div className="source-pick">
            {options.map((o) => (
              <label key={o} className={source === o ? 'radio active' : 'radio'}>
                <input type="radio" name="src" checked={source === o} onChange={() => { setSourcePick(o); resetPick(); }} />
                <span>
                  <strong>{SOURCE_LABELS[o]}</strong>
                  <span className="muted small">{SOURCE_HINTS[o]}</span>
                </span>
              </label>
            ))}
          </div>
          {noKeys && <p className="muted tiny">No price API keys are set up yet, so only manual prices are available. See SETUP.md Step 3.</p>}
          {category === 'tcg' && kind === 'graded' && !sources.pricecharting && (
            <p className="muted tiny">TCGplayer only prices raw cards. For automatic graded TCG values, add a PriceCharting token (optional, SETUP.md Step 3).</p>
          )}
        </div>

        {!isManual && !picked && (
          <form className="search-form" onSubmit={runSearch}>
            <input
              className="search"
              autoFocus
              placeholder={category === 'tcg' ? (kind === 'sealed' ? 'e.g. Surging Sparks booster box' : 'e.g. Charizard ex Obsidian Flames') : (kind === 'sealed' ? 'e.g. 2024 Prizm Football hobby box' : 'e.g. Caleb Williams 2024 Prizm')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn primary" disabled={searching || query.trim().length < 2}>{searching ? 'Searching…' : 'Search'}</button>
          </form>
        )}

        {err && <div className="alert">{err}</div>}

        {!isManual && !picked && results && (
          results.length === 0 ? (
            <p className="muted small">No matches. Try fewer words, or the player/card name plus the year or set.</p>
          ) : (
            <ul className="result-list">
              {results.map((r) => (
                <li key={r.id}>
                  <button className="result-row" onClick={() => pick(r)}>
                    {r.image ? <img src={r.image} alt="" className="thumb" style={{ width: 34, height: 46 }} /> : <div className="thumb placeholder" style={{ width: 34, height: 46 }}>{r.name?.charAt(0)}</div>}
                    <div className="item-main">
                      <div className="item-name">{r.name}{r.number ? ` #${r.number}` : ''}</div>
                      <div className="muted small">{[r.set, r.game].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="mono small">{r.price != null ? money(r.price) : ''}</div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {!isManual && picked && (
          <div className="picked panel inset">
            <div className="panel-head">
              <div>
                <div className="item-name">{picked.name}</div>
                <div className="muted small">{picked.set}</div>
              </div>
              <button className="btn ghost small" onClick={resetPick}>Change</button>
            </div>
            {quoting ? (
              <p className="muted small">Getting prices…</p>
            ) : quote ? (
              <>
                <div className="label">Which price should this item track?</div>
                <div className="price-options">
                  {quote.prices.map((p) => (
                    <label key={p.key} className={priceKey === p.key ? 'radio active' : 'radio'}>
                      <input
                        type="radio"
                        name="pk"
                        checked={priceKey === p.key}
                        disabled={p.value == null}
                        onChange={() => {
                          setPriceKey(p.key);
                          if (kind === 'graded' && source !== 'tcgapi') setForm((f) => ({ ...f, grade_label: p.label }));
                        }}
                      />
                      <span className="po-label">{p.label}</span>
                      <span className="mono">{p.value != null ? money(p.value) : 'no data'}</span>
                    </label>
                  ))}
                </div>
                {quote.salesVolume != null && <p className="muted tiny">About {quote.salesVolume} sales a year.</p>}
              </>
            ) : null}
          </div>
        )}

        {(isManual || picked) && (
          <div className="form-grid">
            <label className="span2">Name<input value={form.name} onChange={set('name')} required /></label>
            <label>Set / product line<input value={form.set_name} onChange={set('set_name')} /></label>
            <label>{kind === 'graded' ? 'Grade (e.g. PSA 10)' : 'Condition / variation'}<input value={form.grade_label} onChange={set('grade_label')} /></label>
            <label>Quantity<input type="number" min="1" step="1" inputMode="numeric" value={form.quantity} onChange={set('quantity')} /></label>
            <label>Cost per item ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={form.cost_per_unit} onChange={set('cost_per_unit')} placeholder="0.00" /></label>
            {isManual && <label>Current value per item ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={form.manual_price} onChange={set('manual_price')} placeholder="optional" /></label>}
            <label>Purchase date<input type="date" value={form.purchase_date} onChange={set('purchase_date')} /></label>
            <label>Bought from<input value={form.purchased_from} onChange={set('purchased_from')} placeholder="LCS, eBay, break pull…" /></label>
            <label className="span2">Image URL (optional)<input value={form.image_url} onChange={set('image_url')} /></label>
            <label className="span2">Notes<textarea rows="2" value={form.notes} onChange={set('notes')} /></label>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!ready || saving}>{saving ? 'Saving…' : 'Add to vault'}</button>
        </div>
      </div>
    </Modal>
  );
}
