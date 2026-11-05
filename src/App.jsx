import { useCallback, useEffect, useState } from 'react';
import { supabase, configMissing } from './supabase';
import { apiCall } from './lib/api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Sales from './components/Sales';
import AddItem from './components/AddItem';
import ItemDetail from './components/ItemDetail';

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    if (configMissing) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (configMissing) {
    return (
      <div className="center-screen">
        <div className="panel narrow">
          <h2>Almost there</h2>
          <p className="muted">
            The app can't find your Supabase settings. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in Vercel, then redeploy. See Step 5 of SETUP.md.
          </p>
        </div>
      </div>
    );
  }
  if (session === undefined) return <div className="center-screen muted">Loading…</div>;
  if (!session) return <Login />;
  return <Main session={session} />;
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'sales', label: 'Sales' },
];

function Main({ session }) {
  const [tab, setTab] = useState('dashboard');
  const [holdings, setHoldings] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sources, setSources] = useState({ tcgapi: false, sportscardspro: false, pricecharting: false });
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState(null);

  const reload = useCallback(async () => {
    setLoadError('');
    const [h, s] = await Promise.all([
      supabase.from('cv_holdings').select('*').order('created_at', { ascending: false }),
      supabase.from('cv_sales').select('*').order('sold_on', { ascending: false }),
    ]);
    if (h.error || s.error) setLoadError((h.error || s.error).message);
    else {
      setHoldings(h.data);
      setSales(s.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    apiCall('/api/config').then((c) => setSources(c.sources)).catch(() => {});
  }, [reload]);

  const openItem = holdings.find((h) => h.id === openId) || null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Card Vault</span>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="btn primary" onClick={() => setShowAdd(true)}>+ Add</button>
          <button className="btn ghost small" onClick={() => supabase.auth.signOut()} title={session.user.email}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {loadError && (
          <div className="alert">
            Couldn't load your data: {loadError}. If this is a brand-new setup, make sure you ran{' '}
            <code>supabase/schema.sql</code> (SETUP.md Step 2).
          </div>
        )}
        {loading ? (
          <div className="muted pad">Loading your vault…</div>
        ) : tab === 'dashboard' ? (
          <Dashboard holdings={holdings} sales={sales} onOpen={setOpenId} onAdd={() => setShowAdd(true)} />
        ) : tab === 'inventory' ? (
          <Inventory holdings={holdings} onOpen={setOpenId} onAdd={() => setShowAdd(true)} />
        ) : (
          <Sales sales={sales} holdings={holdings} onChanged={reload} />
        )}
      </main>

      {showAdd && (
        <AddItem
          sources={sources}
          onClose={() => setShowAdd(false)}
          onSaved={async () => {
            setShowAdd(false);
            await reload();
          }}
        />
      )}
      {openItem && (
        <ItemDetail
          item={openItem}
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
