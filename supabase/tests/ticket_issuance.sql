-- This test rolls back every fixture; no real attendee data is read or changed.
begin;
do $$
declare
 owner uuid := gen_random_uuid(); ev uuid := gen_random_uuid(); typ uuid := gen_random_uuid();
 req uuid := gen_random_uuid(); req2 uuid := gen_random_uuid(); result jsonb; retry jsonb; token text;
begin
 insert into auth.users(id) values(owner);
 insert into public.events(id, owner_id, title, description, starts_at, venue)
 values(ev, owner, 'Ticket issuance test', '', now() + interval '1 day', 'Test');
 insert into public.ticket_types(id, event_id, name, capacity) values(typ, ev, 'General', 2);
 update public.events set status = 'publicado' where id = ev;
 result := public.register_attendee(ev, typ, 'Test Attendee', 'test@example.com', req);
 token := result->>'ticket_code';
 if result->>'code' <> 'ok' or token is null or token !~ '^[0-9a-f]{64}$' then raise exception 'Issuance failed'; end if;
 retry := public.register_attendee(ev, typ, 'Test Attendee', 'test@example.com', req);
 if retry <> result or (select count(*) from public.tickets where registration_id = req) <> 1 then raise exception 'Retry duplicated ticket'; end if;
 result := public.register_attendee(ev, typ, 'Second Test', 'second@example.com', req2);
 if result->>'ticket_code' = token or result->>'code' <> 'ok' then raise exception 'Codes not distinct'; end if;
 if public.public_ticket(token)->>'name' <> 'Test Attendee' then raise exception 'Lookup failed'; end if;
 if public.public_ticket(req::text) is not null or public.public_ticket('invalid') is not null
 or public.public_ticket(repeat('0', 64)) is not null then raise exception 'Lookup exposed other identifiers'; end if;
 begin
 insert into public.tickets(registration_id) values(req);
 raise exception 'Duplicate registration accepted';
 exception when unique_violation then null;
 end;
 begin
 insert into public.tickets(registration_id, code) values(gen_random_uuid(), token);
 raise exception 'Duplicate code accepted';
 exception when unique_violation then null;
 end;
 begin
 update public.tickets set status = 'invalid' where registration_id = req;
 raise exception 'Invalid status accepted';
 exception when check_violation then null;
 end;
 update public.tickets set status = 'used' where registration_id = req;
 if public.public_ticket(token)->>'status' <> 'used' then raise exception 'Used state missing'; end if;
 update public.tickets set status = 'revoked' where registration_id = req;
 if public.public_ticket(token)->>'status' <> 'revoked' then raise exception 'Revoked state missing'; end if;
 if has_table_privilege('anon', 'public.tickets', 'select')
 or has_table_privilege('authenticated', 'public.tickets', 'select')
 or has_table_privilege('anon', 'public.tickets', 'insert')
 or has_table_privilege('authenticated', 'public.tickets', 'update') then raise exception 'Direct access allowed'; end if;
 if not has_function_privilege('anon', 'public.public_ticket(text)', 'execute') then raise exception 'Public lookup unavailable'; end if;
end;
$$;
rollback;
select 'ticket issuance, retry, uniqueness, lookup, states and access checks passed; fixtures rolled back' as result;
