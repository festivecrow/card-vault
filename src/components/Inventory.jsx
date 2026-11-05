import { useMemo, useState } from 'react';
import Thumb from './Thumb';
import { CATEGORY_LABELS, KIND_LABELS, itemMath, money, pct, plClass, signedMoney, timeAgo } from '../lib/format';

const SORTS = {
  value: { label: 'Value (high → low)', fn: (a, b) => b.m.value - a.m.value },
  plUp: { label: 'Profit $ (best first)', fn: (a, b) => b.m.pl - a.m.pl },
  plPct: { label: 'Profit % (best first)', fn: (a, b) => (b.m.plPct ?? -1e9) - (a.m.plPct ?? -1e9) },
  plDown: { label: 'Loss $ (worst first)', fn: (a, b) => a.m.pl - b.m.pl },
  name: { label: 'Name A–Z', fn: (a, b) => a.h.name.localeCompare(b.h.name) },
  newest: { label: 'Newest added', fn: (a, b) => b.h.created_at.localeCompare(a.h.created_at) },
};

export default function Inventory({ holdings, onOpen, onAdd }) {
  const [status, setStatus] = useState('holding');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('value');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return holdings
      .filter((h) => status === 'all' || h.status === status)
      .filter((h) => category === 'all' || h.category === category)
      .filter((h) => kind === 'all' || h.kind === kind)
      .filter((h) => !needle || [h.name, h.set_name, h.game, h.grade_label, h.notes].some((v) => v?.toLowerCase().includes(needle)))
      .map((h) => ({ h, m: itemMath(h) }))
      .sort(SORTS[sort].fn);
  }, [holdings, status, category, kind, q, sort]);

  const sum = rows.reduce((s, r) => ({ cost: s.cost + r.m.cost, value: s.value + r.m.value, pl: s.pl + r.m.pl }), { cost: 0, value: 0, pl: 0 });

  return (
    <div className="stack">
      <div className="filters panel">
        <input className="search" placeholder="Search name, set, grade, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="filter-row">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="holding">Holding</option>
            <option value="sold">Sold out</option>
            <option value="all">All</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="all">Sports + TCG</option>
            <option value="sports">Sports</option>
            <option value="tcg">TCG</option>
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
            <option value="all">All types</option>
            <option value="single">Singles</option>
            <option value="graded">Graded</option>
            <option value="sealed">Sealed</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <div className="filter-sum muted small">
          {rows.length} item{rows.length === 1 ? '' : 's'} · cost <span className="mono">{money(sum.cost)}</span> · value{' '}
          <span className="mono">{money(sum.value)}</span> · <span className={`mono ${plClass(sum.pl)}`}>{signedMoney(sum.pl)}</span>
        </div>
      </div>

      {!rows.length ? (
        <div className="empty">
          <p className="muted">{holdings.length ? 'Nothing matches those filters.' : 'No items yet.'}</p>
          {!holdings.length && <button className="btn primary" onClick={onAdd}>+ Add item</button>}
        </div>
      ) : (
        <ul className="item-list">
          {rows.map(({ h, m }) => (
            <li key={h.id}>
              <button className="item-row panel" onClick={() => onOpen(h.id)}>
                <Thumb item={h} />
                <div className="item-main">
                  <div className="item-name">{h.name}</div>
                  <div className="muted small item-sub">
                    {[h.set_name, h.grade_label].filter(Boolean).join(' · ')}
                  </div>
                  <div className="chips">
                    <span className={`chip ${h.category}`}>{CATEGORY_LABELS[h.category]}</span>
                    <span className="chip">{KIND_LABELS[h.kind]}</span>
                    {h.quantity > 1 && <span className="chip">×{h.quantity}</span>}
                    {h.status === 'sold' && <span className="chip">Sold</span>}
                    {h.price_error && <span className="chip warn" title={h.price_error}>Price check failed</span>}
                  </div>
                </div>
                <div className="item-nums">
                  <div className="mono">{money(m.value)}</div>
                  <div className={`mono small ${plClass(m.pl)}`}>
                    {m.priced ? `${signedMoney(m.pl)} (${pct(m.plPct)})` : 'no price yet'}
                  </div>
                  <div className="muted tiny">{h.price_source === 'manual' ? 'manual price' : timeAgo(h.price_updated_at)}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
