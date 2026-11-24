begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Disposable database only';end if;end$$;
insert into public.products(id,published,payload) values('settlement-product',true,'{"price":100,"stock":10,"name":{"en":"Fixture"}}');
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select public.submit_store_order('{"id":"settlement-order","requestId":"44444444-0000-4000-8000-000000000001","customer":{"name":"Fixture","email":"settlement@fixture.invalid","phone":"01044444444","address":"Fixture street","city":"Cairo"},"items":[{"id":"settlement-product","quantity":2}],"subtotal":200,"shipping":0,"discount":0,"delivery":"standard","payment":"cod"}');
reset role;
-- A local provider-reference fixture, never an actual gateway connection.
update public.payment_transactions set provider='fixture',provider_id='settlement-reference' where order_id='settlement-order';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$declare rejected boolean=false;begin
 begin perform public.apply_verified_payment('wrong-amount','fixture','settlement-reference','paid',100,'EGP');exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'Wrong amount accepted';end if;
end$$;
select public.apply_verified_payment('paid-event','fixture','settlement-reference','paid',200,'EGP');
select public.apply_verified_payment('paid-event','fixture','settlement-reference','paid',200,'EGP');
reset role;
do $$begin
 if not (select (payload->>'paymentVerified')::boolean from public.orders where id='settlement-order') then raise exception 'Verified service settlement did not mark payment';end if;
 if (select count(*) from public.provider_events where id='fixture:paid-event')<>1 then raise exception 'Duplicate provider event';end if;
 if not exists(select 1 from public.provider_events where id='fixture:paid-event' and event_status='paid' and amount=200 and currency='EGP' and payment_transaction_id is not null) then raise exception 'Verified event audit missing';end if;
 if (select (payload->>'stock')::int from public.products where id='settlement-product')<>8 then raise exception 'Payment changed reserved stock';end if;
end$$;
rollback;
