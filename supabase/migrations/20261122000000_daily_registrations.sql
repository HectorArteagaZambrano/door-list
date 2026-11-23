begin;

-- Serialize the historical snapshot with changes to publication status.
lock table public.events in share row exclusive mode;

create table public.event_publications (
  event_id uuid primary key references public.events(id) on delete cascade,
  observed_at timestamptz not null,
  is_historical boolean not null default false
);
alter table public.event_publications enable row level security;
revoke all on public.event_publications from public, anon, authenticated;
grant select on public.event_publications to authenticated;
create policy event_publications_owner_read on public.event_publications
for select to authenticated using (exists (
  select 1 from public.events e
  where e.id = event_id and e.owner_id = (select auth.uid())
));

-- A prior registration proves the event had already been published by then.
insert into public.event_publications (event_id, observed_at, is_historical)
select e.id, coalesce(min(r.created_at), statement_timestamp()), true
from public.events e
left join public.ticket_types tt on tt.event_id = e.id
left join public.registrations r on r.ticket_type_id = tt.id
group by e.id
having e.status = 'publicado' or count(r.id) > 0;

create function public.record_event_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_publications (event_id, observed_at)
  values (new.id, clock_timestamp()) on conflict (event_id) do nothing;
  return new;
end;
$$;
revoke all on function public.record_event_publication() from public, anon, authenticated;
create trigger events_record_publication after insert or update of status on public.events
for each row when (new.status = 'publicado') execute function public.record_event_publication();

create function public.daily_registrations(p_event_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with owned_event as (
    select e.id, (p.observed_at at time zone 'America/Lima')::date as first_day,
           coalesce(p.is_historical, false) as historical
    from public.events e left join public.event_publications p on p.event_id = e.id
    where e.id = p_event_id and e.owner_id = (select auth.uid())
  ), totals as (
    select (r.created_at at time zone 'America/Lima')::date as day, count(*) as count
    from owned_event e join public.ticket_types tt on tt.event_id = e.id
    join public.registrations r on r.ticket_type_id = tt.id
    group by 1
  )
  select jsonb_build_object('isHistorical', e.historical, 'days', coalesce((
    select jsonb_agg(jsonb_build_object('date', e.first_day + offset_day,
                                        'count', coalesce(t.count, 0)) order by offset_day)
    from generate_series(0, (now() at time zone 'America/Lima')::date - e.first_day) offset_day
    left join totals t on t.day = e.first_day + offset_day
  ), '[]'::jsonb))
  from owned_event e;
$$;
revoke all on function public.daily_registrations(uuid) from public, anon;
grant execute on function public.daily_registrations(uuid) to authenticated;

commit;
