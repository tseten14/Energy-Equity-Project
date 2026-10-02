-- Verified public data: every observation belongs to a measure, and every measure cites a source.

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  publisher text not null,
  title text not null,
  url text not null,
  data_year text not null,
  retrieved_at date not null
);

create table public.measures (
  slug text primary key,
  side text not null check (side in ('household', 'financial', 'context')),
  label text not null,
  unit text not null check (unit in ('percent', 'usd', 'usd_per_share', 'cents_per_kwh', 'kwh', 'count')),
  definition text not null,
  annual_agg text not null check (annual_agg in ('sum', 'mean', 'last')),
  source_id uuid references public.sources (id) on delete set null
);

create index measures_source_id_idx on public.measures (source_id);

create table public.observations (
  measure_slug text not null references public.measures (slug) on delete cascade,
  period date not null,
  grain text not null check (grain in ('month', 'quarter', 'year')),
  dimension text not null default '',
  geo_id text not null default '',
  value numeric not null,
  primary key (measure_slug, period, dimension, geo_id)
);

alter table public.sources enable row level security;
alter table public.measures enable row level security;
alter table public.observations enable row level security;

-- Only the server (secret key) reads or writes these tables.
revoke all on public.sources, public.measures, public.observations from anon, authenticated;
