create table public.registrations (
 id uuid primary key,
 ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 200),
 email text not null check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 created_at timestamptz not null default now()
);
create index registrations_ticket_idx on public.registrations(ticket_type_id);
alter table public.registrations enable row level security;
revoke all on public.registrations from anon, authenticated;

create function public.public_events(p_event_id uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(item order by item->>'starts_at'), '[]'::jsonb) from (
 select jsonb_build_object('id', e.id, 'title', e.title, 'description', e.description,
 'starts_at', e.starts_at, 'venue', e.venue, 'tickets', coalesce((
 select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
 'remaining', greatest(0, t.capacity - (select count(*) from public.registrations r where r.ticket_type_id = t.id))) order by t.name)
 from public.ticket_types t where t.event_id = e.id), '[]'::jsonb)) item
 from public.events e where e.status = 'publicado'
 and (e.starts_at at time zone 'America/Lima')::date >= (statement_timestamp() at time zone 'America/Lima')::date
 and (p_event_id is null or e.id = p_event_id)) events;
$$;

create function public.register_attendee(p_event_id uuid, p_ticket_id uuid, p_name text, p_email text, p_request_id uuid)
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
 return jsonb_build_object('code', 'ok', 'id', existing.id); end if;
 return jsonb_build_object('code', 'invalid'); end if;
 if ev.status <> 'publicado' or (ev.starts_at at time zone 'America/Lima')::date < (clock_timestamp() at time zone 'America/Lima')::date then
 return jsonb_build_object('code', 'unavailable'); end if;
 select * into ticket from public.ticket_types where id = p_ticket_id and event_id = p_event_id;
 if not found then return jsonb_build_object('code', 'sold_out'); end if;
 if (select count(*) from public.registrations where ticket_type_id = ticket.id) >= ticket.capacity
 or (ev.capacity is not null and (select count(*) from public.registrations r join public.ticket_types t on t.id = r.ticket_type_id where t.event_id = ev.id) >= ev.capacity) then
 return jsonb_build_object('code', 'sold_out'); end if;
 insert into public.registrations(id, ticket_type_id, name, email) values(p_request_id, ticket.id, trim(p_name), lower(trim(p_email)));
 return jsonb_build_object('code', 'ok', 'id', p_request_id);
end;
$$;

create function public.protect_registered_tickets() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.events where id = new.event_id for update;
 if (new.event_id <> old.event_id and exists(select 1 from public.registrations where ticket_type_id = old.id))
 or new.capacity < (select count(*) from public.registrations where ticket_type_id = old.id) then
 raise exception 'No se puede mover una entrada con registros ni reducir el aforo por debajo de los inscritos'; end if;
 return new;
end;
$$;
create trigger ticket_types_protect_registrations before update of capacity, event_id on public.ticket_types
for each row execute function public.protect_registered_tickets();
revoke all on function public.public_events(uuid) from public;
revoke all on function public.register_attendee(uuid, uuid, text, text, uuid) from public;
grant execute on function public.public_events(uuid) to anon, authenticated;
grant execute on function public.register_attendee(uuid, uuid, text, text, uuid) to anon, authenticated;
