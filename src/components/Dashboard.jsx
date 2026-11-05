import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { fetchAll } from '../lib/api';
import PriceChart from './PriceChart';
import Thumb from './Thumb';
import {
  CATEGORY_LABELS, KIND_LABELS, itemMath, money, pct, plClass, round2, saleNet, signedMoney,
} from '../lib/format';

const RANGES = [
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
  { id: 365, label: '1Y' },
  { id: 0, label: 'All' },
];

export default function Dashboard({ holdings, sales, onOpen, onAdd }) {
  const active = useMemo(() => holdings.filter((h) => h.status === 'holding' && h.quantity > 0), [holdings]);
  const [history, setHistory] = useState([]);
  const [range, setRange] = useState(90);

  useEffect(() => {
    fetchAll(() =>
      supabase.from('cv_price_history').select('holding_id,price,recorded_on').order('recorded_on')
    ).then(setHistory).catch(() => setHistory([]));
  }, [holdings]);

  const totals = useMemo(() => {
    const t = { cost: 0, value: 0, pl: 0, pricedCost: 0, unpriced: 0, errors: 0 };
    const byCat = { sports: { cost: 0, value: 0, count: 0 }, tcg: { cost: 0, value: 0, count: 0 } };
    const byKind = { single: { cost: 0, value: 0, count: 0 }, graded: { cost: 0, value: 0, count: 0 }, sealed: { cost: 0, value: 0, count: 0 } };
    for (const h of active) {
      const m = itemMath(h);
      t.cost += m.cost;
      t.value += m.value;
      t.pl += m.pl;
      if (m.priced) t.pricedCost += m.cost;
      else t.unpriced++;
      if (h.price_error) t.errors++;
      for (const g of [byCat[h.category], byKind[h.kind]]) {
        g.cost += m.cost;
        g.value += m.value;
        g.count += m.qty;
      }
    }
    const realized = sales.reduce((s, x) => s + saleNet(x), 0);
    return { ...t, byCat, byKind, realized };
  }, [active, sales]);

  const points = useMemo(() => {
    const qty = new Map(active.map((h) => [h.id, h.quantity]));
    const byDate = new Map();
    for (const r of history) {
      if (!qty.has(r.holding_id)) continue;
      if (!byDate.has(r.recorded_on)) byDate.set(r.recorded_on, []);
      byDate.get(r.recorded_on).push(r);
    }
    const last = new Map();
    const out = [];
    for (const [date, rows] of byDate) {
      for (const r of rows) last.set(r.holding_id, Number(r.price));
      let v = 0;
      for (const [id, p] of last) v += p * qty.get(id);
      out.push({ date, value: round2(v) });
    }
    if (!range) return out;
    const cutoff = new Date(Date.now() - range * 864e5).toISOString().slice(0, 10);
    return out.filter((p) => p.date >= cutoff);
  }, [history, active, range]);

  const movers = useMemo(() => {
    const priced = active
      .map((h) => ({ h, m: itemMath(h) }))
      .filter((x) => x.m.priced && x.m.cost > 0);
    const sorted = [...priced].sort((a, b) => b.m.plPct - a.m.plPct);
    return {
      up: sorted.filter((x) => x.m.pl > 0).slice(0, 5),
      down: sorted.filter((x) => x.m.pl < 0).reverse().slice(0, 5),
    };
  }, [active]);

  if (!holdings.length) {
    return (
      <div className="empty">
        <h2>Your vault is empty</h2>
        <p className="muted">Add your first card, slab, or sealed box. Prices update automatically every night.</p>
        <button className="btn primary" onClick={onAdd}>+ Add your first item</button>
      </div>
    );
  }

  const plPctTotal = totals.pricedCost > 0 ? (totals.pl / totals.pricedCost) * 100 : null;

  return (
    <div className="stack">
      <section className="hero panel">
        <div>
          <div className="label">Market value</div>
          <div className="hero-value mono">{money(totals.value)}</div>
          <div className={`hero-pl mono ${plClass(totals.pl)}`}>
            {signedMoney(totals.pl)} <span>({pct(plPctTotal)})</span> unrealized
          </div>
        </div>
        <div className="hero-side">
          <Stat label="Total cost" value={money(totals.cost)} />
          <Stat label="Realized profit" value={signedMoney(totals.realized)} cls={plClass(totals.realized)} />
          <Stat label="Items held" value={active.reduce((s, h) => s + h.quantity, 0)} />
        </div>
      </section>

      {(totals.unpriced > 0 || totals.errors > 0) && (
        <div className="note">
          {totals.unpriced > 0 && <>{totals.unpriced} item{totals.unpriced > 1 ? 's have' : ' has'} no market price yet, so {totals.unpriced > 1 ? 'they count' : 'it counts'} at cost. </>}
          {totals.errors > 0 && <>{totals.errors} item{totals.errors > 1 ? 's' : ''} failed the last price check. Open {totals.errors > 1 ? 'them' : 'it'} in Inventory to see why.</>}
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>Portfolio value</h3>
          <div className="seg">
            {RANGES.map((r) => (
              <button key={r.id} className={range === r.id ? 'active' : ''} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <PriceChart points={points} height={240} />
        <p className="muted tiny">Based on what you hold today, using each night's market price.</p>
      </section>

      <div className="grid2">
        <Breakdown title="Sports vs TCG" groups={totals.byCat} labels={CATEGORY_LABELS} />
        <Breakdown title="By type" groups={totals.byKind} labels={KIND_LABELS} />
      </div>

      <div className="grid2">
        <MoverList title="Biggest gainers" rows={movers.up} onOpen={onOpen} empty="No gainers yet." />
        <MoverList title="Biggest losers" rows={movers.down} onOpen={onOpen} empty="Nothing in the red." />
      </div>
    </div>
  );
}

function Stat({ label, value, cls = '' }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`mono ${cls}`}>{value}</div>
    </div>
  );
}

function Breakdown({ title, groups, labels }) {
  const total = Object.values(groups).reduce((s, g) => s + g.value, 0) || 1;
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="breakdown">
        {Object.entries(groups).map(([key, g]) => {
          const pl = g.value - g.cost;
          return (
            <div key={key} className="bd-row">
              <div className="bd-top">
                <span>{labels[key]} <span className="muted small">· {g.count}</span></span>
                <span className="mono">{money(g.value)}</span>
              </div>
              <div className="bar"><span style={{ width: `${(g.value / total) * 100}%` }} className={key} /></div>
              <div className="bd-bottom muted small">
                <span>Cost {money(g.cost)}</span>
                <span className={plClass(pl)}>{signedMoney(pl)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MoverList({ title, rows, onOpen, empty }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {!rows.length ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className="mini-list">
          {rows.map(({ h, m }) => (
            <li key={h.id}>
              <button className="mini-row" onClick={() => onOpen(h.id)}>
                <Thumb item={h} size={28} />
                <span className="mini-name">{h.name}</span>
                <span className={`mono ${plClass(m.pl)}`}>{pct(m.plPct)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
