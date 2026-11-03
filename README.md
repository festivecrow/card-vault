# Card Vault

Personal tracker for sports cards, TCG cards, graded slabs and sealed boxes, with prices that update every night.

- **TCG prices:** TCGplayer market price (median of recent sales) via TCG API
- **Sports prices:** SportsCardsPro raw and graded values (Raw, 7, 8, 9, BGS 9.5, PSA 10)
- **Optional:** PriceCharting for graded TCG slabs
- Dashboard with portfolio value chart, Sports vs TCG breakdown, gainers/losers
- Inventory with search, filters and sorting
- Sales log with fees, shipping and net profit (Fanatics Live, eBay, Whatnot…)

Stack: React + Vite, Supabase (auth + Postgres with row-level security), Vercel serverless functions + Vercel Cron.

**Start here:** [SETUP.md](SETUP.md)
