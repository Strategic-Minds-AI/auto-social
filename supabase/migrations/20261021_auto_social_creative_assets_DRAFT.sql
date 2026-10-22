-- DRAFT ONLY: DO NOT APPLY TO PRODUCTION WITHOUT AUTHORIZATION.
-- X1 Creative Asset Studio: Strategic Intelligence canonical media model.
-- Existing source tables: public.auto_social_businesses and public.auto_social_*.
-- Identity model: Base44 user ids are strings; do NOT equate them with Supabase auth.uid().
-- Use a server-side, business-authorized sync worker after credential verification.
begin;

create table if not exists public.auto_social_media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  base44_asset_id text unique,
  base44_owner_id text not null,
  title text not null,
  original_filename text,
  media_type text not null check (media_type in ('image','video')),
  mime_type text,
  file_bytes bigint not null default 0 check (file_bytes >= 0),
  width integer check (width >= 0),
  height integer check (height >= 0),
  duration_seconds numeric check (duration_seconds >= 0),
  storage_provider text not null default 'base44',
  storage_bucket text,
  storage_path text,
  source_url text,
  category text not null default 'Unsorted',
  tags text[] not null default '{}',
  classification_method text not null default 'filename_rules',
  classification_confidence numeric check (classification_confidence between 0 and 1),
  classification_note text,
  approval_status text not null default 'draft' check (approval_status in ('draft','review','approved','archived')),
  source_asset_id uuid references public.auto_social_media_assets(id),
  platform_preset text,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auto_social_media_assets_business
  on public.auto_social_media_assets (business_id, created_at desc);
create index if not exists idx_auto_social_media_assets_category
  on public.auto_social_media_assets (business_id, category);

create table if not exists public.auto_social_media_collections (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  base44_owner_id text not null,
  name text not null,
  description text,
  filter_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.auto_social_creative_projects (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  base44_owner_id text not null,
  project_type text not null check (project_type in ('image','flyer','video','website','campaign')),
  title text not null,
  template_key text,
  layout_spec jsonb not null default '{}'::jsonb,
  storyboard jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  export_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_auto_social_projects_business
  on public.auto_social_creative_projects (business_id, created_at desc);

-- RLS: deny all direct anon/authenticated API reads/writes until an authenticated
-- user identity mapping + tenant-specific policies have been proven.
alter table public.auto_social_media_assets enable row level security;
alter table public.auto_social_media_collections enable row level security;
alter table public.auto_social_creative_projects enable row level security;
revoke all on public.auto_social_media_assets from anon, authenticated;
revoke all on public.auto_social_media_collections from anon, authenticated;
revoke all on public.auto_social_creative_projects from anon, authenticated;
-- Only server-side service-role integration may write; NEVER expose that key in Base44 browser code.

commit;