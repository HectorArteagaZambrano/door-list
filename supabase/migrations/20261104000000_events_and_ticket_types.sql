create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) > 0),
  description text not null,
  starts_at timestamptz not null,
  venue text not null check (length(trim(venue)) > 0),
  status text not null default 'borrador' check (status in ('borrador', 'publicado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_owner_id_idx on public.events(owner_id);
create index events_published_starts_at_idx on public.events(starts_at) where status = 'publicado';
create index ticket_types_event_id_idx on public.ticket_types(event_id);
create unique index ticket_types_event_name_idx on public.ticket_types(event_id, lower(trim(name)));

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger ticket_types_touch before update on public.ticket_types for each row execute function public.touch_updated_at();

-- Serialize publishing and removal of ticket types on the parent event row.
create function public.check_event_publication() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'publicado' and not exists (select 1 from public.ticket_types where event_id = new.id) then
    raise exception 'Un evento publicado necesita al menos un tipo de entrada';
  end if;
  return new;
end;
$$;
create trigger events_check_publication before insert or update of status on public.events for each row execute function public.check_event_publication();

create function public.check_ticket_type_removal() returns trigger language plpgsql security definer set search_path = '' as $$
declare event_status text;
begin
  if tg_op = 'UPDATE' and new.event_id is not distinct from old.event_id then return new; end if;
  select status into event_status from public.events where id = old.event_id for update;
  if event_status = 'publicado' and not exists (select 1 from public.ticket_types where event_id = old.event_id and id <> old.id) then
    raise exception 'Un evento publicado necesita al menos un tipo de entrada';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger ticket_types_check_removal before delete or update of event_id on public.ticket_types for each row execute function public.check_ticket_type_removal();

alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
grant select on public.events, public.ticket_types to anon, authenticated;
grant insert, update, delete on public.events, public.ticket_types to authenticated;

create policy events_read on public.events for select to anon, authenticated using (status = 'publicado' or owner_id = (select auth.uid()));
create policy events_insert on public.events for insert to authenticated with check (owner_id = (select auth.uid()));
create policy events_update on public.events for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy events_delete on public.events for delete to authenticated using (owner_id = (select auth.uid()));

create policy ticket_types_read on public.ticket_types for select to anon, authenticated using (exists (select 1 from public.events e where e.id = event_id and (e.status = 'publicado' or e.owner_id = (select auth.uid()))));
create policy ticket_types_insert on public.ticket_types for insert to authenticated with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy ticket_types_update on public.ticket_types for update to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))) with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy ticket_types_delete on public.ticket_types for delete to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
