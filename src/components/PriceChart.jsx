import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, moneyShort, dateLabel } from '../lib/format';

function TipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="muted small">{dateLabel(label)}</div>
      <div className="mono">{money(payload[0].value)}</div>
    </div>
  );
}

export default function PriceChart({ points, height = 220 }) {
  if (!points || points.length < 2) {
    return (
      <div className="chart-empty muted small" style={{ height }}>
        The chart fills in as nightly prices come in. Check back after a few days.
      </div>
    );
  }
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const color = last >= first ? 'var(--up)' : 'var(--down)';
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fillArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => dateLabel(d).replace(/, \d{4}$/, '')}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={moneyShort}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<TipBox />} cursor={{ stroke: 'var(--line)' }} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#fillArea)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
