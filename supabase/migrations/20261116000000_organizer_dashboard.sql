begin;

-- Reading attendee data requires ownership, even when the event is public.
grant select on public.registrations to authenticated;
create policy registrations_owner_read on public.registrations
for select to authenticated using (
  exists (
    select 1 from public.ticket_types tt
    join public.events e on e.id = tt.event_id
    where tt.id = registrations.ticket_type_id
      and e.owner_id = (select auth.uid())
  )
);

-- Run as the caller: RLS remains active and no service-role key is needed.
create function public.organizer_dashboard(p_event_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with owned_events as materialized (
    select e.* from public.events e
    where e.owner_id = (select auth.uid())
      and (p_event_id is null or e.id = p_event_id)
  ), owned_types as materialized (
    select tt.* from public.ticket_types tt
    join owned_events e on e.id = tt.event_id
    where p_event_id is not null
  ), owned_registrations as materialized (
    select r.* from public.registrations r
    join owned_types tt on tt.id = r.ticket_type_id
  )
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at, e.id) from owned_events e), '[]'::jsonb),
    'ticketTypes', coalesce((
      select jsonb_agg(to_jsonb(tt) || jsonb_build_object('registeredCount', (
        select count(*) from owned_registrations r where r.ticket_type_id = tt.id
      )) order by tt.name, tt.id) from owned_types tt
    ), '[]'::jsonb),
    'registrations', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id) from owned_registrations r
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.organizer_dashboard(uuid) from public, anon;
grant execute on function public.organizer_dashboard(uuid) to authenticated;

commit;
