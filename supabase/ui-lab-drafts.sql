-- Private UI-lab drafts. Published values live in src/design-system/tokens.json.
create table if not exists public.ui_lab_drafts (
  user_id text not null,
  component_key text not null,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, component_key)
);

alter table public.ui_lab_drafts enable row level security;
revoke all on public.ui_lab_drafts from anon, authenticated;
grant all on public.ui_lab_drafts to service_role;
