-- Disposable PostgreSQL regression tests. No provider or Supabase API calls.
begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Disposable database only';end if;end$$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
insert into public.products(id,published,payload) values
 ('identity-a',true,'{"price":100,"stock":20,"name":{"ar":"أ","en":"A"},"variants":[{"id":"128","stock":3,"priceDelta":10}]}'),
 ('identity-b',true,'{"price":200,"stock":20,"name":{"ar":"ب","en":"B"}}');
insert into public.bundles(id,payload) values('identity-bundle','{"price":250,"enabled":true,"productIds":["identity-a","identity-b"]}');
update public.bundle_items set quantity=2 where bundle_id='identity-bundle' and product_id='identity-a';
create function pg_temp.checkout_fixture(order_id text,request_key text,lines jsonb,quote numeric,phone text default '01099999999',method text default 'cod') returns jsonb language sql as $$
 select public.submit_store_order(jsonb_build_object('id',order_id,'requestId',request_key,'customer',jsonb_build_object('name','Fixture','email','identity@fixture.invalid','phone',phone,'address','Fixture street','city','Cairo'),'items',lines,'subtotal',quote,'shipping',0,'discount',0,'coupon','','delivery','standard','payment',method,'language','en'));
$$;
do $$declare first_order jsonb;replay jsonb;rejected boolean;begin
 first_order=pg_temp.checkout_fixture('identity-order-a','11111111-0000-4000-8000-000000000001','[{"id":"identity-a","quantity":2}]',200);
 replay=pg_temp.checkout_fixture('identity-different-generated-id','11111111-0000-4000-8000-000000000001','[{"id":"identity-a","quantity":2}]',200);
 if replay->>'id'<>first_order->>'id' or (select (payload->>'stock')::int from public.products where id='identity-a')<>18 then raise exception 'Replay deducted stock or changed order';end if;
 rejected=false;begin perform pg_temp.checkout_fixture('identity-conflict','11111111-0000-4000-8000-000000000001','[{"id":"identity-a","quantity":3}]',300);exception when raise_exception then rejected=true;end;if not rejected then raise exception 'Conflicting request accepted';end if;
 rejected=false;begin perform pg_temp.checkout_fixture('identity-order-a','11111111-0000-4000-8000-000000000002','[{"id":"identity-a","quantity":2}]',200);exception when raise_exception then rejected=true;end;if not rejected then raise exception 'Existing order ID accepted for new request';end if;
 rejected=false;begin perform pg_temp.checkout_fixture('identity-card','11111111-0000-4000-8000-000000000003','[{"id":"identity-a","quantity":1}]',100,'01000000001','card');exception when raise_exception then rejected=true;end;if not rejected then raise exception 'Disabled card accepted';end if;
 rejected=false;begin perform pg_temp.checkout_fixture('identity-valu','11111111-0000-4000-8000-000000000004','[{"id":"identity-a","quantity":1}]',100,'01000000001','valu');exception when raise_exception then rejected=true;end;if not rejected then raise exception 'Disabled ValU accepted';end if;
 rejected=false;begin perform pg_temp.checkout_fixture('identity-no-stock','11111111-0000-4000-8000-000000000005','[{"id":"identity-a","quantity":99}]',9900,'01000000002');exception when raise_exception then rejected=true;end;if not rejected then raise exception 'Insufficient stock accepted';end if;
 if (select (payload->>'stock')::int from public.products where id='identity-a')<>18 then raise exception 'Rejected checkout changed stock';end if;
 perform pg_temp.checkout_fixture('identity-variant','11111111-0000-4000-8000-000000000006','[{"id":"identity-a","storage":"128","quantity":2}]',220,'01000000003');
 if (select (payload->'variants'->0->>'stock')::int from public.products where id='identity-a')<>1 then raise exception 'Variant deduction mismatch';end if;
 perform pg_temp.checkout_fixture('identity-bundle-order','11111111-0000-4000-8000-000000000007','[{"id":"identity-bundle","bundleId":"identity-bundle","isBundle":true,"quantity":2}]',500,'01000000004');
 if (select (payload->>'stock')::int from public.products where id='identity-a')<>12 or (select (payload->>'stock')::int from public.products where id='identity-b')<>18 then raise exception 'Bundle component quantities mismatch';end if;
end$$;
insert into auth.users(id,email,email_confirmed_at) values('11111111-0000-4000-8000-000000000099','lifecycle@fixture.invalid',now());
insert into public.user_roles(user_id,role) values('11111111-0000-4000-8000-000000000099','staff');
select set_config('request.jwt.claim.sub','11111111-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
select public.admin_set_order_status(array['identity-variant','identity-bundle-order'],'cancelled');
select public.admin_set_order_status(array['identity-variant','identity-bundle-order'],'cancelled');
select public.admin_set_order_status(array['identity-order-a'],'processing');
select public.admin_set_order_status(array['identity-order-a'],'shipping');
do $$declare rejected boolean=false;begin
 begin perform public.admin_set_order_status(array['identity-order-a'],'cancelled');exception when raise_exception then rejected=true;end;if not rejected then raise exception 'Consumed stock restored';end if;
end$$;
select public.admin_set_order_status(array['identity-order-a'],'completed');
reset role;
do $$begin
 if (select (payload->>'stock')::int from public.products where id='identity-a')<>18 or (select (payload->>'stock')::int from public.products where id='identity-b')<>20 then raise exception 'Cancellation/restoration quantity mismatch';end if;
 if (select (payload->'variants'->0->>'stock')::int from public.products where id='identity-a')<>3 then raise exception 'Variant not restored';end if;
end$$;
rollback;
