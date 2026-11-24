begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Disposable database only';end if;end$$;
insert into auth.users(id,email,email_confirmed_at) values('33333333-0000-4000-8000-000000000001','backfill-admin@fixture.invalid',now()),('33333333-0000-4000-8000-000000000002','owned@fixture.invalid',now());
insert into public.user_roles(user_id,role) values('33333333-0000-4000-8000-000000000001','admin');
insert into public.customers(email,phone,name,auth_user_id) values('owned@fixture.invalid','01012345678','Do not overwrite','33333333-0000-4000-8000-000000000002');
-- Fixture only: emulate historical orders imported before customer-association triggers.
alter table public.orders disable trigger order_customer_sync;
insert into public.orders(id,payload) values
 ('backfill-guest','{"customer":{"name":"Guest","email":"guest@fixture.invalid","phone":"01011111111"},"items":[],"total":0,"statusKey":"new"}'),
 ('backfill-owned','{"customer":{"name":"Untrusted guest","email":"owned@fixture.invalid","phone":"01012345678"},"items":[],"total":0,"statusKey":"new"}');
alter table public.orders enable trigger order_customer_sync;
select set_config('request.jwt.claim.sub','33333333-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare result jsonb;begin
 result=public.backfill_guest_customers(100,null);
 if (result->>'linked')::int<>1 or (result->>'skipped')::int<>1 then raise exception 'Unsafe/incomplete historical grouping: %',result;end if;
 if exists(select 1 from public.customers where email='guest@fixture.invalid' and auth_user_id is not null) then raise exception 'Guest was assigned an account';end if;
 if (select customer_id from public.orders where id='backfill-owned') is not null then raise exception 'Unverified guest order linked to an owned customer';end if;
 if (select name from public.customers where email='owned@fixture.invalid')<>'Do not overwrite' then raise exception 'Existing customer overwritten';end if;
end$$;
reset role;
rollback;
