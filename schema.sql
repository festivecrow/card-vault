-- Card Vault database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then click "Run".
-- It is safe to run more than once.

create extension if not exists pgcrypto;

-- Everything you own (cards, graded slabs, sealed boxes)
create table if not exists public.cv_holdings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category         text not null check (category in ('sports','tcg')),
  kind             text not null check (kind in ('single','graded','sealed')),
  name             text not null,
  set_name         text,
  game             text,
  card_number      text,
  image_url        text,
  grade_label      text,
  quantity         integer not null default 1 check (quantity >= 0),
  cost_per_unit    numeric(12,2) not null default 0,
  purchase_date    date,
  purchased_from   text,
  notes            text,
  price_source     text not null default 'manual'
                   check (price_source in ('tcgapi','sportscardspro','pricecharting','manual')),
  source_id        text,
  price_field      text,
  current_price    numeric(12,2),
  price_updated_at timestamptz,
  price_error      text,
  status           text not null default 'holding' check (status in ('holding','sold')),
  created_at       timestamptz not null default now()
);
create index if not exists cv_holdings_user_idx on public.cv_holdings(user_id);

-- One price per item per day (builds your charts)
create table if not exists public.cv_price_history (
  id          bigserial primary key,
  holding_id  uuid not null references public.cv_holdings(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  price       numeric(12,2) not null,
  recorded_on date not null default current_date,
  unique (holding_id, recorded_on)
);
create index if not exists cv_price_history_user_idx on public.cv_price_history(user_id, recorded_on);

-- Everything you sold (linked to an item, or standalone like break sales)
create table if not exists public.cv_sales (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  holding_id    uuid references public.cv_holdings(id) on delete set null,
  item_name     text not null,
  category      text check (category in ('sports','tcg')),
  quantity      integer not null default 1 check (quantity >= 1),
  sale_price    numeric(12,2) not null default 0,  -- total for all units
  fees          numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  cost_basis    numeric(12,2) not null default 0,  -- what those units cost you
  platform      text,
  sold_on       date not null default current_date,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists cv_sales_user_idx on public.cv_sales(user_id);

-- Row Level Security: each account only ever sees its own rows
alter table public.cv_holdings      enable row level security;
alter table public.cv_price_history enable row level security;
alter table public.cv_sales         enable row level security;

drop policy if exists "own holdings" on public.cv_holdings;
create policy "own holdings" on public.cv_holdings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own history" on public.cv_price_history;
create policy "own history" on public.cv_price_history
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sales" on public.cv_sales;
create policy "own sales" on public.cv_sales
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Records a sale and lowers the item's quantity in one safe step
create or replace function public.cv_record_sale(
  p_holding_id uuid,
  p_quantity   integer,
  p_sale_price numeric,
  p_fees       numeric,
  p_shipping   numeric,
  p_platform   text,
  p_sold_on    date,
  p_notes      text
) returns uuid
language plpgsql
security invoker
as $$
declare
  h      public.cv_holdings;
  new_id uuid;
begin
  select * into h from public.cv_holdings
   where id = p_holding_id and user_id = auth.uid()
   for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > h.quantity then
    raise exception 'Quantity must be between 1 and %', h.quantity;
  end if;

  insert into public.cv_sales
    (user_id, holding_id, item_name, category, quantity, sale_price, fees,
     shipping_cost, cost_basis, platform, sold_on, notes)
  values
    (auth.uid(), h.id, h.name, h.category, p_quantity, coalesce(p_sale_price,0),
     coalesce(p_fees,0), coalesce(p_shipping,0), round(h.cost_per_unit * p_quantity, 2),
     p_platform, coalesce(p_sold_on, current_date), p_notes)
  returning id into new_id;

  update public.cv_holdings
     set quantity = quantity - p_quantity,
         status   = case when quantity - p_quantity = 0 then 'sold' else status end
   where id = h.id;

  return new_id;
end;
$$;

grant execute on function public.cv_record_sale(uuid,integer,numeric,numeric,numeric,text,date,text) to authenticated;
