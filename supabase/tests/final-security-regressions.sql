-- DEFERRED: never run on production. No SQL executed during this review.
-- Requires an authorized disposable database with the complete setup installed.
begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Disposable test database authorization required';end if;end$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('f0000000-0000-4000-8000-000000000001','admin@fixture.invalid',now(),'{}'),
 ('f0000000-0000-4000-8000-000000000002','staff@fixture.invalid',now(),'{}'),
 ('f0000000-0000-4000-8000-000000000003','customer@fixture.invalid',now(),'{}'),
 ('f0000000-0000-4000-8000-000000000004','other@fixture.invalid',now(),'{}');
insert into public.user_roles(user_id,role) values('f0000000-0000-4000-8000-000000000001','admin'),('f0000000-0000-4000-8000-000000000002','staff');
insert into public.products(id,published,payload) values('fixture-security-product',true,'{"price":100,"stock":20,"name":{"en":"Fixture"},"category":"test","gallery":[]}');
insert into public.products(id,published,payload) values
 ('fixture-security-product-2',true,'{"price":100,"stock":20,"name":{"en":"Fixture 2"},"category":"test"}'),
 ('fixture-security-product-3',true,'{"price":100,"stock":20,"name":{"en":"Fixture 3"},"category":"test"}');
insert into public.bundles(id,payload) values('fixture-security-bundle','{"price":180,"enabled":false,"productIds":["fixture-security-product","fixture-security-product-2"]}');
insert into public.bundle_items(bundle_id,product_id,quantity) values('fixture-security-bundle','fixture-security-product-3',7);
update public.bundles set payload=payload||'{"title":{"en":"Updated title"}}' where id='fixture-security-bundle';
do $$declare bad jsonb;rejected boolean;begin
 if not exists(select 1 from public.bundle_items where bundle_id='fixture-security-bundle' and product_id='fixture-security-product-3' and quantity=7) then raise exception 'Independent bundle metadata was lost';end if;
 for bad in select value from jsonb_array_elements('[null,{},"scalar",[],["fixture-security-product"],["fixture-security-product",null],["fixture-security-product",""],["fixture-security-product","unknown-id"],["fixture-security-product","fixture-security-product"],[1,2],["1","2","3","4","5","6","7","8","9"]]') loop
  rejected=false;
  begin update public.bundles set payload=jsonb_set(payload,'{productIds}',bad) where id='fixture-security-bundle';exception when raise_exception then rejected=true;end;
  if not rejected then raise exception 'Invalid bundle productIds accepted: %',bad;end if;
 end loop;
 rejected=false;
 begin update public.bundles set payload=payload-'productIds' where id='fixture-security-bundle';exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'Missing bundle productIds accepted';end if;
end$$;
insert into public.support_messages(id,name,email,subject,message,consent) values('f1000000-0000-4000-8000-000000000001','Fixture customer','customer@fixture.invalid','product','A fixture product question',true);
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$declare affected int;begin
 delete from public.support_messages where id='f1000000-0000-4000-8000-000000000001';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Staff deleted a support message';end if;
 delete from public.messages where id='f1000000-0000-4000-8000-000000000001';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Staff deleted through compatibility view';end if;
 update public.support_messages set status='in_progress' where id='f1000000-0000-4000-8000-000000000001';get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Staff cannot update inbox';end if;
 begin
  insert into public.user_roles(user_id,role) values('f0000000-0000-4000-8000-000000000002','admin') on conflict(user_id) do update set role='admin';
  raise exception 'Staff role escalation succeeded';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
insert into public.support_messages(name,email,subject,message,consent) values('Anonymous fixture','anonymous@fixture.invalid','other','An anonymous support question',true);
insert into public.messages(name,email,subject,message,consent) values('View fixture','view@fixture.invalid','other','A compatibility view question',true);
do $$begin
 begin perform 1 from public.support_messages;raise exception 'Anonymous private table SELECT succeeded';exception when insufficient_privilege then null;end;
 begin perform 1 from public.messages;raise exception 'Anonymous private view SELECT succeeded';exception when insufficient_privilege then null;end;
end$$;
reset role;
insert into public.customers(id,name,email,phone,auth_user_id) values
 ('f2000000-0000-4000-8000-000000000003','Customer','customer@fixture.invalid','01011111111','f0000000-0000-4000-8000-000000000003'),
 ('f2000000-0000-4000-8000-000000000004','Other','other@fixture.invalid','01022222222','f0000000-0000-4000-8000-000000000004');
insert into public.orders(id,payload) values('fixture-other-order','{"id":"fixture-other-order","customer":{"name":"Other","email":"other@fixture.invalid","phone":"01022222222"},"items":[],"total":100,"statusKey":"new","payment":"cod"}');
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$declare affected int;begin
 if exists(select 1 from public.customers where id='f2000000-0000-4000-8000-000000000004') then raise exception 'Cross-customer SELECT leak';end if;
 update public.customers set name='Attacker' where id='f2000000-0000-4000-8000-000000000004';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-customer UPDATE succeeded';end if;
 if exists(select 1 from public.orders where id='fixture-other-order') then raise exception 'Cross-customer order SELECT leak';end if;
 if public.customer_orders()::text like '%fixture-other-order%' then raise exception 'Cross-customer order RPC leak';end if;
 begin
  perform public.apply_verified_payment('browser-forgery','fixture','fake','paid',100,'EGP');raise exception 'Customer executed settlement';
 exception when insufficient_privilege then null;end;
end$$;
insert into public.support_messages(name,email,subject,message,consent) values('Customer','customer@fixture.invalid','product','A verified owned support question',true);
do $$begin if public.customer_support_messages()::text not like '%verified owned%' then raise exception 'Verified customer support history missing';end if;end$$;
select public.submit_store_order('{"id":"fixture-security-order","requestId":"f3000000-0000-4000-8000-000000000001","customer":{"name":"Customer","email":"customer@fixture.invalid","phone":"01011111111","address":"Fixture Street","city":"Cairo"},"items":[{"id":"fixture-security-product","quantity":2}],"subtotal":200,"shipping":0,"discount":0,"payment":"cod","delivery":"standard"}');
reset role;
-- Independently stored child metadata survives stock/order updates.
update public.order_items set payload=payload||'{"independentAudit":"preserve-me"}' where order_id='fixture-security-order';
insert into public.product_images(id,product_id,url,position) values('f4000000-0000-4000-8000-000000000001','fixture-security-product','https://fixture.invalid/independent.webp',17);
update public.products set payload=jsonb_set(payload,'{stock}',to_jsonb((payload->>'stock')::int-1)) where id='fixture-security-product';
update public.products set payload=jsonb_set(payload,'{stock}',to_jsonb((payload->>'stock')::int+1)) where id='fixture-security-product';
do $$begin if not exists(select 1 from public.product_images where id='f4000000-0000-4000-8000-000000000001' and position=17) then raise exception 'Independent image metadata was lost';end if;end$$;
-- Test-only provider association; this does not simulate an actual provider API.
update public.payment_transactions set provider='fixture',provider_id='fixture-transaction' where order_id='fixture-security-order';
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select public.apply_verified_payment('failed-event','fixture','fixture-transaction','failed',200,'EGP');
select public.apply_verified_payment('failed-event','fixture','fixture-transaction','failed',200,'EGP');
select public.apply_verified_payment('second-failed-event','fixture','fixture-transaction','failed',200,'EGP');
reset role;
do $$begin
 if (select (payload->>'stock')::int from public.products where id='fixture-security-product')<>20 then raise exception 'Failed payment did not restore stock exactly once';end if;
 if exists(select 1 from public.order_stock_reservations where order_id='fixture-security-order' and state<>'released') then raise exception 'Reservation not released';end if;
 if (select payload->>'statusKey' from public.orders where id='fixture-security-order')<>'cancelled' then raise exception 'Failed payment did not cancel order';end if;
 if not exists(select 1 from public.order_items where order_id='fixture-security-order' and payload->>'independentAudit'='preserve-me') then raise exception 'Independent order line metadata was lost';end if;
end$$;
set local role service_role;
select public.apply_verified_payment('late-paid-event','fixture','fixture-transaction','paid',200,'EGP');
reset role;
do $$begin
 if not exists(select 1 from public.payment_transactions where order_id='fixture-security-order' and reconciliation_required) then raise exception 'Late settlement was not flagged';end if;
 if (select coalesce((payload->>'paymentVerified')::boolean,false) from public.orders where id='fixture-security-order') then raise exception 'Released order falsely verified';end if;
end$$;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$declare affected int;begin
 delete from public.support_messages where id='f1000000-0000-4000-8000-000000000001';get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Administrator cannot delete message';end if;
end$$;
reset role;
rollback;
