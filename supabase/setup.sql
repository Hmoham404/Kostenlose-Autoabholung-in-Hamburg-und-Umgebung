-- Car-Fit24: run in the Supabase SQL Editor as project owner.
-- Private photos + JSONB requests. No secret key is needed in the website.
begin;
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
drop policy if exists own_admin_membership on public.admins;
create policy own_admin_membership on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  payload jsonb not null,
  photo_paths text[] not null default '{}',
  status text not null default 'new' check (status in ('new','review','scheduled','collected')),
  appointment_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_payload check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16000
    and payload @> '{"consent":true}'::jsonb
    and coalesce(length(btrim(payload->>'make')),0) between 1 and 100
    and coalesce(length(btrim(payload->>'model')),0) between 1 and 100
    and coalesce(length(btrim(payload->>'name')),0) between 2 and 150
    and coalesce(length(btrim(payload->>'phone')),0) between 6 and 40
    and coalesce(payload->>'postal','') ~ '^[0-9]{5}$'
    and coalesce(length(btrim(payload->>'city')),0) between 1 and 150
    and coalesce(length(btrim(payload->>'address')),0) between 1 and 250
    and coalesce(payload->>'year','') ~ '^(19|20)[0-9]{2}$'
    and coalesce(payload->>'wheels','') ~ '^[0-4]$'
    and coalesce(length(payload->>'condition'),0) between 1 and 100
  ),
  constraint photo_count check (cardinality(photo_paths) <= 6),
  constraint scheduled_has_appointment check (status <> 'scheduled' or appointment_at is not null)
);
create index if not exists requests_created_at on public.requests(created_at desc);
create index if not exists requests_user_id on public.requests(user_id);
alter table public.requests enable row level security;
revoke all on public.requests from anon, authenticated;
grant select, insert, update, delete on public.requests to authenticated;

-- Validation runs even if clients bypass the form. Serializes submissions per user.
create or replace function public.validate_request_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare path text;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.requests where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Daily request limit reached';
  end if;
  new.created_at := now();
  new.status := 'new';
  new.appointment_at := null;
  foreach path in array new.photo_paths loop
    if path not like new.user_id::text || '/' || new.id::text || '/%' then raise exception 'Invalid photo reference'; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'vehicle-photos' and name = path) then raise exception 'Photo missing'; end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.validate_request_insert() from public;
drop trigger if exists request_insert_validation on public.requests;
create trigger request_insert_validation before insert on public.requests for each row execute function public.validate_request_insert();
drop policy if exists submit_own_request on public.requests;
create policy submit_own_request on public.requests for insert to authenticated with check (user_id = auth.uid() and status = 'new' and appointment_at is null);
drop policy if exists admin_read_requests on public.requests;
create policy admin_read_requests on public.requests for select to authenticated using (public.is_admin());
drop policy if exists admin_update_requests on public.requests;
create policy admin_update_requests on public.requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_delete_requests on public.requests;
create policy admin_delete_requests on public.requests for delete to authenticated using (public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vehicle-photos','vehicle-photos',false,2097152,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.can_upload_vehicle_photo(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and split_part(object_name,'/',1) = auth.uid()::text
    and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg)$'
    and (select count(*) from storage.objects where bucket_id='vehicle-photos' and split_part(name,'/',1)=auth.uid()::text and created_at > now()-interval '1 day') < 30;
$$;
revoke all on function public.can_upload_vehicle_photo(text) from public;
grant execute on function public.can_upload_vehicle_photo(text) to authenticated;
create or replace function public.owns_unsubmitted_photo(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(object_name,'/',1)=auth.uid()::text
    and not exists(select 1 from public.requests where photo_paths @> array[object_name]);
$$;
revoke all on function public.owns_unsubmitted_photo(text) from public;
grant execute on function public.owns_unsubmitted_photo(text) to authenticated;
drop policy if exists upload_vehicle_photo on storage.objects;
create policy upload_vehicle_photo on storage.objects for insert to authenticated
with check(bucket_id='vehicle-photos' and public.can_upload_vehicle_photo(name));
drop policy if exists admin_read_vehicle_photo on storage.objects;
create policy admin_read_vehicle_photo on storage.objects for select to authenticated
using(bucket_id='vehicle-photos' and (public.is_admin() or public.owns_unsubmitted_photo(name)));
drop policy if exists delete_vehicle_photo on storage.objects;
create policy delete_vehicle_photo on storage.objects for delete to authenticated
using(bucket_id='vehicle-photos' and (public.is_admin() or public.owns_unsubmitted_photo(name)));
commit;

-- AFTER creating Sofiane's user in Authentication > Users (email + strong password):
-- Replace UUID below with that user's UUID, then run ONLY this statement:
-- insert into public.admins(user_id) values ('REPLACE-WITH-SOFIANE-USER-UUID') on conflict do nothing;
