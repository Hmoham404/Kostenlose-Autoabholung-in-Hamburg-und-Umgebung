-- Run once in the Supabase SQL Editor for the Vercel deployment.
-- Only the server-side SUPABASE_SECRET_KEY can access these private records.
begin;
create table if not exists public.server_requests (
 id uuid primary key,
 data jsonb not null,
 deleted_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists server_requests_active_created on public.server_requests(created_at desc) where deleted_at is null;
alter table public.server_requests enable row level security;
revoke all on public.server_requests from anon, authenticated;
grant select, insert, update, delete on public.server_requests to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('server-request-photos','server-request-photos',false,2097152,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
commit;
