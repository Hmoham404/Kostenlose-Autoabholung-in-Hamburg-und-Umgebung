-- Car-Fit24 — migration à exécuter APRÈS setup.sql dans Supabase SQL Editor.
-- Ajoute contacts, décisions, brouillons allemands, historique email et corbeille.
-- Aucun email n'est envoyé par ce SQL. Les mots de passe SMTP et le code
-- d'accès administrateur restent exclusivement dans l'environnement serveur.
-- Le site local actuel utilise .data/ ; ce script ne synchronise pas ces fichiers.
begin;

alter table public.requests add column if not exists deleted_at timestamptz;
alter table public.requests add column if not exists email_draft jsonb;
alter table public.requests add column if not exists email_delivery jsonb;

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check(status in ('new','review','accepted','rejected','scheduled','collected'));

-- Les coordonnées restent dans payload JSONB :
-- {"name":"...","email":"...","phone":"+49...","whatsapp":"+49...", ...}
-- Les anciennes lignes sans email restent conservées et peuvent être complétées.
create or replace function public.valid_customer_email(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value is not null and length(value) between 3 and 254
    and value ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$';
$$;

alter table public.requests drop constraint if exists valid_payload_contacts;
alter table public.requests add constraint valid_payload_contacts check (
  (not (payload ? 'email') or payload->>'email' = '' or public.valid_customer_email(payload->>'email'))
  and (not (payload ? 'whatsapp') or payload->>'whatsapp' = ''
    or (jsonb_typeof(payload->'whatsapp')='string' and length(payload->>'whatsapp') between 6 and 40 and payload->>'whatsapp' ~ '^[+0-9() .-]+$'))
) not valid;

create or replace function public.validate_new_request_contacts() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.valid_customer_email(new.payload->>'email') then
    raise exception 'A valid customer email is required';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_new_request_contacts() from public;
drop trigger if exists request_contact_validation on public.requests;
create trigger request_contact_validation before insert on public.requests
for each row execute function public.validate_new_request_contacts();

alter table public.requests drop constraint if exists valid_email_draft;
alter table public.requests add constraint valid_email_draft check (
  email_draft is null or (
    jsonb_typeof(email_draft)='object'
    and email_draft @> '{"language":"de"}'::jsonb
    and jsonb_typeof(email_draft->'subject')='string'
    and jsonb_typeof(email_draft->'text')='string'
    and coalesce(length(btrim(email_draft->>'subject')),0) between 1 and 250
    and (email_draft->>'subject') !~ E'[\r\n]'
    and coalesce(length(btrim(email_draft->>'text')),0) between 1 and 8000
  )
);
alter table public.requests drop constraint if exists valid_email_delivery;
alter table public.requests add constraint valid_email_delivery check (
  email_delivery is null or (
    jsonb_typeof(email_delivery)='object'
    and coalesce(email_delivery->>'state','') in ('sending','sent','failed')
    and public.valid_customer_email(email_delivery->>'to')
    and coalesce(length(email_delivery->>'key'),0)=64
  )
);
alter table public.requests drop constraint if exists rejected_has_no_appointment;
alter table public.requests add constraint rejected_has_no_appointment
  check(status <> 'rejected' or appointment_at is null);

create index if not exists requests_active_created_idx on public.requests(created_at desc)
  where deleted_at is null;
create index if not exists requests_active_status_idx on public.requests(status)
  where deleted_at is null;
create index if not exists requests_email_idx on public.requests(lower(payload->>'email'));

-- Une personne qui dépose une demande ne peut pas fabriquer une confirmation
-- d'envoi, un brouillon administrateur ou une suppression.
drop policy if exists submit_own_request on public.requests;
create policy submit_own_request on public.requests for insert to authenticated
with check(user_id=auth.uid() and status='new' and appointment_at is null
  and deleted_at is null and email_draft is null and email_delivery is null);

-- Les politiques existantes is_admin(), lecture et modification restent actives.
-- Client / utilisateur anonyme : aucune lecture des demandes ou photos privées.
-- En mode Supabase, l'API serveur administrateur utilise :
--   liste active : SELECT ... WHERE deleted_at IS NULL;
--   corbeille   : UPDATE ... SET deleted_at=now() WHERE id=...;
--   restaurer   : UPDATE ... SET deleted_at=NULL WHERE id=...;
-- Les photos restent privées et sont conservées tant que la demande est en corbeille.
commit;
