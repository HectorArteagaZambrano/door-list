-- One opaque bearer code per registration, generated only by PostgreSQL.
-- Two independent UUID v4 values provide 244 random bits, without extensions.
create table public.tickets (
 id uuid primary key default gen_random_uuid(),
 registration_id uuid not null unique references public.registrations(id) on delete cascade,
 code text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
   check (code ~ '^[0-9a-f]{64}$'),
 status text not null default 'valid' check (status in ('valid', 'used', 'revoked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.tickets enable row level security;
revoke all on public.tickets from anon, authenticated;
create trigger tickets_touch before update on public.tickets for each row execute function public.touch_updated_at();

create function public.issue_registration_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.tickets(registration_id) values(new.id);
 return new;
end;
$$;
revoke all on function public.issue_registration_ticket() from public;
create trigger registrations_issue_ticket after insert on public.registrations
for each row execute function public.issue_registration_ticket();
-- Issue tickets for registrations made before this migration as well.
insert into public.tickets(registration_id) select id from public.registrations;

create function public.public_ticket(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('code', t.code, 'status', t.status, 'name', r.name,
 'email', r.email, 'ticket_type', tt.name, 'event_title', e.title,
 'starts_at', e.starts_at, 'venue', e.venue)
 from public.tickets t
 join public.registrations r on r.id = t.registration_id
 join public.ticket_types tt on tt.id = r.ticket_type_id
 join public.events e on e.id = tt.event_id
 where p_code ~ '^[0-9a-f]{64}$' and t.code = p_code;
$$;
revoke all on function public.public_ticket(text) from public;
grant execute on function public.public_ticket(text) to anon, authenticated;
create or replace function public.register_attendee(p_event_id uuid, p_ticket_id uuid, p_name text, p_email text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.events; ticket public.ticket_types; existing public.registrations;
begin
 if p_request_id is null or p_name is null or length(trim(p_name)) not between 1 and 200
 or p_email is null or length(trim(p_email)) > 254
 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
 return jsonb_build_object('code', 'invalid'); end if;
 -- Serialize registration with event edits and ticket capacity changes.
 select * into ev from public.events where id = p_event_id for update;
 if not found then return jsonb_build_object('code', 'unavailable'); end if;
 select * into existing from public.registrations where id = p_request_id;
 if found then
 if existing.ticket_type_id = p_ticket_id and existing.name = trim(p_name) and existing.email = lower(trim(p_email)) then
 return jsonb_build_object('code', 'ok', 'id', existing.id, 'ticket_code', (select code from public.tickets where registration_id = existing.id)); end if;
 return jsonb_build_object('code', 'invalid'); end if;
 if ev.status <> 'publicado' or (ev.starts_at at time zone 'America/Lima')::date < (clock_timestamp() at time zone 'America/Lima')::date then
 return jsonb_build_object('code', 'unavailable'); end if;
 select * into ticket from public.ticket_types where id = p_ticket_id and event_id = p_event_id;
 if not found then return jsonb_build_object('code', 'sold_out'); end if;
 if (select count(*) from public.registrations where ticket_type_id = ticket.id) >= ticket.capacity
 or (ev.capacity is not null and (select count(*) from public.registrations r join public.ticket_types t on t.id = r.ticket_type_id where t.event_id = ev.id) >= ev.capacity) then
 return jsonb_build_object('code', 'sold_out'); end if;
 insert into public.registrations(id, ticket_type_id, name, email) values(p_request_id, ticket.id, trim(p_name), lower(trim(p_email)));
 return jsonb_build_object('code', 'ok', 'id', p_request_id, 'ticket_code', (select code from public.tickets where registration_id = p_request_id));
end;
$$;


