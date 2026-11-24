begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Isolated database only';end if;end$$;
insert into auth.users(id,email,email_confirmed_at) values('b0170000-0000-4000-8000-000000000001','privacy-admin@fixture.invalid',now()),('b0170000-0000-4000-8000-000000000002','privacy-customer@fixture.invalid',now());
insert into public.user_roles values('b0170000-0000-4000-8000-000000000001','admin');
insert into public.products(id,published,payload) values('privacy-public',true,'{"name":{"en":"Public phone","internalNotes":"HIDDEN_SENTINEL"},"price":100,"stock":10,"costPrice":50,"purchaseCost":55,"margin":45,"supplier":"HIDDEN_SENTINEL","internalNotes":"HIDDEN_SENTINEL","futurePrivateKey":"HIDDEN_SENTINEL","placements":{"home-featured":1,"secret":"HIDDEN_SENTINEL"},"offer":{"enabled":false,"notes":"HIDDEN_SENTINEL"},"variants":[{"id":"v1","stock":5,"priceDelta":0,"costPrice":20,"supplier":"HIDDEN_SENTINEL","label":{"en":"128GB","internal":"HIDDEN_SENTINEL"}}]}'),('privacy-draft',false,'{"price":200,"stock":10,"supplier":"HIDDEN_SENTINEL"}');
set local role anon;
do $$declare result jsonb;begin
 begin perform payload from public.products;raise exception 'Anon raw product access';exception when insufficient_privilege then null;end;
 result=public.catalog_page('{"q":"privacy-public"}',1,12);
 if result::text like '%HIDDEN_SENTINEL%' or result::text like '%costPrice%' or result::text like '%purchaseCost%' then raise exception 'Public catalog leak';end if;
 result=public.catalog_page('{"q":"HIDDEN_SENTINEL"}',1,12);
 if (result->>'total')::int<>0 then raise exception 'Search infers internal fields';end if;
 result=public.site_bootstrap(array['privacy-public','privacy-draft']);
 if result::text like '%HIDDEN_SENTINEL%' or result::text like '%privacy-draft%' then raise exception 'Bootstrap leak';end if;
 if (select payload::text from public.public_products where id='privacy-public') like '%HIDDEN_SENTINEL%' then raise exception 'Direct public view leak';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub','b0170000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.products) then raise exception 'Customer raw product access';end if;
 if (public.catalog_page('{}',1,12))::text like '%HIDDEN_SENTINEL%' then raise exception 'Customer catalog leak';end if;
end$$;
reset role;
select set_config('request.jwt.claim.sub','b0170000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$begin if (select payload->>'supplier' from public.products where id='privacy-public')<>'HIDDEN_SENTINEL' then raise exception 'Admin internal data lost';end if;end$$;
reset role;
rollback;
