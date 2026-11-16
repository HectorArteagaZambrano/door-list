-- NULL preserves existing events and means that no overall limit is set.
alter table public.events add column capacity integer check (capacity > 0);

create function public.check_event_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare allocated bigint;
begin
  if new.capacity is not null then
    select coalesce(sum(capacity), 0) into allocated
    from public.ticket_types where event_id = new.id;
    if allocated > new.capacity then
      raise exception 'El aforo del evento no puede ser menor que la suma de los tipos de entrada';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_check_capacity before update of capacity on public.events
for each row execute function public.check_event_capacity();

create function public.check_ticket_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_limit integer; allocated bigint;
begin
  -- Lock the parent so simultaneous ticket edits and event limit changes serialize.
  select capacity into event_limit from public.events where id = new.event_id for update;
  if event_limit is not null then
    select coalesce(sum(capacity), 0) into allocated from public.ticket_types
    where event_id = new.event_id and id <> new.id;
    if allocated + new.capacity > event_limit then
      raise exception 'La suma de los aforos supera el aforo máximo del evento';
    end if;
  end if;
  return new;
end;
$$;
create trigger ticket_types_check_capacity before insert or update of capacity, event_id on public.ticket_types
for each row execute function public.check_ticket_capacity();

-- A cascade deleting an event must be able to remove its final ticket type.
create or replace function public.check_ticket_type_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_status text;
begin
  if tg_op = 'UPDATE' and new.event_id is not distinct from old.event_id then return new; end if;
  select status into event_status from public.events where id = old.event_id for update;
  if event_status = 'publicado' and not exists
    (select 1 from public.ticket_types where event_id = old.event_id and id <> old.id) then
    raise exception 'Un evento publicado necesita al menos un tipo de entrada';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
