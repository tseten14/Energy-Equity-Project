-- Community uploads: kept apart from the verified observations.

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_name text not null,
  format text not null check (format in ('csv', 'tsv', 'xlsx', 'json', 'ndjson')),
  row_count int not null check (row_count >= 0),
  profile jsonb not null,
  uploader_hash text not null,
  created_at timestamptz not null default now()
);

create index datasets_uploader_recent_idx on public.datasets (uploader_hash, created_at desc);
create index datasets_created_at_idx on public.datasets (created_at desc);

create table public.dataset_rows (
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  row_number int not null,
  data jsonb not null,
  primary key (dataset_id, row_number)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('stat', 'relation', 'ai')),
  title text not null,
  body text not null,
  related_measure text references public.measures (slug) on delete set null,
  stats jsonb
);

create index insights_dataset_id_idx on public.insights (dataset_id, position);
create index insights_related_measure_idx on public.insights (related_measure);

alter table public.datasets enable row level security;
alter table public.dataset_rows enable row level security;
alter table public.insights enable row level security;

revoke all on public.datasets, public.dataset_rows, public.insights from anon, authenticated;
