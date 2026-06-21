# Supabase Auth And Storage Setup

This app now assumes:

- auth is handled by Supabase Auth
- item and photo images upload to Supabase Storage
- each user syncs into a user-scoped dataset
- project-level Supabase config comes from environment variables, not the UI

## 1. Environment variables

Set these in local `.env.local` and in Vercel Project Settings:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_ASSET_BUCKET=collection-assets
```

## 2. Auth settings

In Supabase Dashboard:

1. Go to `Authentication -> Providers -> Email`
2. Enable `Email`
3. Enable `Confirm email` only if you want mailbox verification before first login
4. Add your site URLs:
   - local: `http://127.0.0.1:5173`
   - local alt: `http://localhost:5173`
   - production: your `https://<project>.vercel.app`

This frontend currently uses email + password sign up / sign in, plus refresh token rotation through Supabase Auth REST endpoints.

## 3. Snapshot table

Run this in Supabase SQL Editor:

```sql
create table if not exists public.collection_snapshots (
  dataset_id text primary key,
  payload jsonb not null,
  app_version text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.collection_snapshots enable row level security;

drop policy if exists "snapshot_select_own_dataset" on public.collection_snapshots;
create policy "snapshot_select_own_dataset"
on public.collection_snapshots
for select
to authenticated
using (dataset_id = auth.uid()::text);

drop policy if exists "snapshot_insert_own_dataset" on public.collection_snapshots;
create policy "snapshot_insert_own_dataset"
on public.collection_snapshots
for insert
to authenticated
with check (dataset_id = auth.uid()::text);

drop policy if exists "snapshot_update_own_dataset" on public.collection_snapshots;
create policy "snapshot_update_own_dataset"
on public.collection_snapshots
for update
to authenticated
using (dataset_id = auth.uid()::text)
with check (dataset_id = auth.uid()::text);
```

Why this shape works with the current frontend:

- frontend forces `datasetId = user.id`
- sync reads and writes one row per authenticated user
- RLS guarantees each user can only read and mutate the row whose `dataset_id` matches `auth.uid()`

## 4. Storage bucket

Create a bucket named `collection-assets`.

Current frontend behavior expects public image URLs, so set the bucket to `public`.

Then run these policies:

```sql
insert into storage.buckets (id, name, public)
values ('collection-assets', 'collection-assets', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "assets_insert_own_folder" on storage.objects;
create policy "assets_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'collection-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "assets_update_own_folder" on storage.objects;
create policy "assets_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'collection-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'collection-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "assets_delete_own_folder" on storage.objects;
create policy "assets_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'collection-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

Why the folder rule matches the frontend:

- uploaded object path starts with `datasetId`
- `datasetId` is forced to `user.id`
- for example: `user-uuid/items/asset-123.jpg`

## 4.1 Optional incremental sync tables

The current frontend still keeps `collection_snapshots` as the compatibility checkpoint. To move toward faster multi-device sync, add an operation log table first. New clients can write small entity changes here while older clients keep using the snapshot row.

```sql
create table if not exists public.collection_operations (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  entity_type text not null check (entity_type in ('item', 'photo', 'album', 'album_slot', 'checklist', 'purchase', 'sale_record', 'category', 'field', 'tag')),
  entity_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  payload jsonb,
  client_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists collection_operations_dataset_created_idx
on public.collection_operations (dataset_id, created_at);

alter table public.collection_operations enable row level security;

drop policy if exists "operations_select_own_dataset" on public.collection_operations;
create policy "operations_select_own_dataset"
on public.collection_operations
for select
to authenticated
using (dataset_id = auth.uid()::text);

drop policy if exists "operations_insert_own_dataset" on public.collection_operations;
create policy "operations_insert_own_dataset"
on public.collection_operations
for insert
to authenticated
with check (dataset_id = auth.uid()::text);
```

Recommended rollout:

1. Keep writing `collection_snapshots` as a compact recovery checkpoint.
2. Start writing one operation per changed entity into `collection_operations`.
3. On device startup, load the latest local checkpoint, then replay operations newer than the local cursor.
4. Periodically compact operations into `collection_snapshots` so a brand-new device does not need to replay an unbounded history.

## 4.2 Future tables for Obsidian import and bead inventory

These tables are not required by the current frontend yet. They document the intended v0.4 backend shape for importing the local Obsidian vault and managing MARD bead inventory.

```sql
create table if not exists public.obsidian_import_batches (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  vault_path text not null,
  status text not null check (status in ('scanned', 'importing', 'completed', 'failed')),
  scanned_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  conflict_count integer not null default 0,
  error_summary text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.obsidian_source_refs (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  entity_type text not null check (entity_type in ('item', 'purchase', 'source', 'asset')),
  entity_id text not null,
  vault_path text not null,
  file_name text,
  file_mtime timestamptz,
  content_hash text,
  import_batch_id uuid references public.obsidian_import_batches(id),
  last_imported_at timestamptz not null default timezone('utc', now()),
  unique (dataset_id, vault_path)
);

create table if not exists public.bead_colors (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  brand text not null default 'MARD',
  code text not null,
  group_code text not null check (group_code in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M')),
  name text,
  hex text,
  rgb integer[],
  swatch_url text,
  stock_count integer not null default 0,
  total_added integer not null default 0,
  total_used integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dataset_id, brand, code)
);

create table if not exists public.bead_inventory_logs (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  bead_color_id uuid not null references public.bead_colors(id),
  action text not null check (action in ('add', 'consume', 'adjust')),
  quantity integer not null,
  item_id text,
  source_pattern_id text,
  source text not null check (source in ('manual', 'pattern_recognition', 'import', 'correction')),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.obsidian_import_batches enable row level security;
alter table public.obsidian_source_refs enable row level security;
alter table public.bead_colors enable row level security;
alter table public.bead_inventory_logs enable row level security;
```

Recommended RLS policy pattern:

```sql
create policy "own_dataset_select"
on public.bead_colors
for select
to authenticated
using (dataset_id = auth.uid()::text);
```

Apply the same `dataset_id = auth.uid()::text` rule to select, insert, and update policies for each future table when the frontend starts using them.

## 5. Frontend session flow

The current frontend does this:

1. user signs up or signs in with email/password
2. access token + refresh token are stored in local storage
3. app restores the session on load
4. app refreshes the token before expiry
5. sync actions require a valid authenticated session
6. local browser data is separated by `storageScopeKey = user.id`

Relevant code:

- `src/auth/supabaseAuth.ts`
- `src/auth/AuthProvider.tsx`
- `src/store/collectionStore.tsx`

## 6. Image flow

Current image path:

1. user selects an image
2. app generates a compressed local preview
3. original file is stored in local IndexedDB pending-assets storage
4. item/photo record stores:
   - preview `imageUrl`
   - pending `imageAssetId`
5. when online sync runs:
   - original file uploads to Supabase Storage
   - record `imageUrl` is replaced with the remote public URL
   - `imageAssetId` is cleared

This allows:

- offline image staging
- online auto-upload later
- lightweight local rendering before cloud upload finishes

## 7. Export / backup

The app now exports a JSON backup from Settings.

Current backup contains:

- snapshot data
- sync settings without the anon key
- export timestamp
- user scope metadata

This is a user-facing backup, not a full binary asset dump. Pending local original files are not bundled into the export JSON.

## 8. Known limitations

Current implementation is intentionally simple:

- sign in uses email/password, not magic link
- storage bucket is public for easy image rendering
- backup export does not include raw pending image blobs
- there is no admin UI for user management
- there is no password reset UI yet

## 9. Recommended next steps

1. add password reset flow
2. add delete-account flow
3. add import-from-backup flow
4. move from public bucket to signed URL flow if user privacy becomes more important
5. add end-to-end browser tests once Playwright browser install is available
