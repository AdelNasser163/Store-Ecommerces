begin;
create or replace function public.verified_administrative_role() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.role='admin' and not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null) then raise exception 'Administrator must be a verified Authentication user';end if;return new;end$$;
drop trigger if exists verified_administrative_role on public.user_roles;
create trigger verified_administrative_role before insert or update on public.user_roles for each row execute function public.verified_administrative_role();
revoke all on function public.verified_administrative_role() from public,anon,authenticated;

create or replace function public.guard_catalog_shape() returns trigger language plpgsql security definer set search_path='' as $$declare variant jsonb;begin
 if coalesce((new.payload->>'stock')::int,-1)<0 or coalesce((new.payload->>'price')::numeric,-1)<0 then raise exception 'Invalid stock or price';end if;
 if new.payload ? 'variants' then
  if jsonb_typeof(new.payload->'variants') is distinct from 'array' then raise exception 'Variants must be an array';end if;
  if exists(select 1 from jsonb_array_elements(new.payload->'variants')v group by v->>'id' having count(*)>1) then raise exception 'Duplicate variant IDs';end if;
  for variant in select value from jsonb_array_elements(new.payload->'variants') loop
   if nullif(trim(variant->>'id'),'') is null or coalesce((variant->>'stock')::int,-1)<0 or (new.payload->>'price')::numeric+coalesce((variant->>'priceDelta')::numeric,0)<0 then raise exception 'Invalid variant';end if;
  end loop;
 end if;return new;end$$;
drop trigger if exists guard_catalog_shape on public.products;
create trigger guard_catalog_shape before insert or update on public.products for each row execute function public.guard_catalog_shape();
revoke all on function public.guard_catalog_shape() from public,anon,authenticated;

-- A bounded explicit administrator action, not an automatic migration. Historical
-- customer contact grouping is not proof of authenticated ownership. Never assign
-- auth_user_id here or link a guest order to an already-owned customer record.
create or replace function public.backfill_guest_customers(p_limit int default 100,p_after text default null) returns jsonb language plpgsql security definer set search_path='' as $$declare row public.orders%rowtype;customer_uuid uuid;linked int=0;skipped int=0;last_id text;begin
 if public.admin_role() is distinct from 'admin' then raise insufficient_privilege;end if;
 for row in select * from public.orders where customer_id is null and (p_after is null or id>p_after) order by id limit greatest(1,least(p_limit,100)) for update loop
  last_id=row.id;
  if coalesce(row.payload->'customer'->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(row.payload->'customer'->>'phone','')) not between 8 and 30 then skipped=skipped+1;continue;end if;
  insert into public.customers(email,phone,name,city,address) values(lower(row.payload->'customer'->>'email'),row.payload->'customer'->>'phone',row.payload->'customer'->>'name',row.payload->'customer'->>'city',row.payload->'customer'->>'address') on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do nothing;
  select id into customer_uuid from public.customers where lower(email)=lower(row.payload->'customer'->>'email') and phone=row.payload->'customer'->>'phone' and auth_user_id is null;
  if customer_uuid is null then skipped=skipped+1;continue;end if;
  perform set_config('almumez.link_guest_customer','yes',true);
  update public.orders set customer_id=customer_uuid where id=row.id and customer_id is null;linked=linked+1;
  perform set_config('almumez.link_guest_customer','',true);
 end loop;return jsonb_build_object('linked',linked,'skipped',skipped,'nextCursor',last_id);end$$;
revoke all on function public.backfill_guest_customers(int,text) from public,anon,authenticated;
grant execute on function public.backfill_guest_customers(int,text) to authenticated;
create or replace function public.admin_category_page(p_query text default '',p_page int default 1) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return(select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from(select c.*,(select count(*) from public.products where payload->>'category'=c.id) products from public.categories c where strpos(lower(c.id||c.name::text),lower(left(p_query,100)))>0 order by c.id limit 20 offset (greatest(1,least(p_page,100000))-1)*20)p),'[]'),'total',(select count(*) from public.categories c where strpos(lower(c.id||c.name::text),lower(left(p_query,100)))>0)));
end$$;
revoke all on function public.admin_category_page(text,int) from public,anon,authenticated;
grant execute on function public.admin_category_page(text,int) to authenticated;
create or replace function public.message_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$declare verified_uid uuid;customer_uuid uuid;begin
 new.customer_id=null;
 select id into verified_uid from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(new.email);
 if verified_uid is null then return new;end if;
 select id into customer_uuid from public.customers where auth_user_id=verified_uid order by created_at,id limit 1;
 if customer_uuid is null then
  insert into public.customers(email,phone,name,auth_user_id) values(lower(new.email),null,new.name,verified_uid)
  on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do update set auth_user_id=excluded.auth_user_id where public.customers.auth_user_id is null or public.customers.auth_user_id=excluded.auth_user_id returning id into customer_uuid;
 end if;
 new.customer_id=customer_uuid;return new;end$$;
revoke all on function public.message_customer_sync() from public,anon,authenticated;
create or replace function public.customer_support_messages(p_page int default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(m)) from(select m.id,m.subject,m.status,m.message,m.created_at from public.support_messages m join public.customers c on c.id=m.customer_id where c.auth_user_id=auth.uid() order by m.created_at desc,m.id limit 20 offset (greatest(1,least(p_page,10000))-1)*20)m),'[]');
end$$;
revoke all on function public.customer_support_messages(int) from public,anon,authenticated;
grant execute on function public.customer_support_messages(int) to authenticated;
create or replace function public.admin_notifications() returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(n)) from(select * from(
 select 'order-'||id id,'order' kind,id reference,coalesce(payload->'customer'->>'name',id) label,created_at time from public.orders where payload->>'statusKey'='new'
 union all select 'message-'||id::text,'message',id::text,name,created_at from public.support_messages where read_at is null and not archived
 union all select 'stock-'||id,'product',id,coalesce(payload->'name'->>'ar',payload->'name'->>'en',id),updated_at from public.products where (payload->>'stock')::int<=5
 )events order by time desc,id limit 20)n),'[]');end$$;
revoke all on function public.admin_notifications() from public,anon,authenticated;
grant execute on function public.admin_notifications() to authenticated;
create or replace function public.guard_category_delete() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.products where payload->>'category'=old.id) then raise exception 'Category is used by products; preserve the category';end if;return old;end$$;
drop trigger if exists guard_category_delete on public.categories;
create trigger guard_category_delete before delete on public.categories for each row execute function public.guard_category_delete();
revoke all on function public.guard_category_delete() from public,anon,authenticated;
do $sku$ begin
 if exists(select 1 from public.products where nullif(payload->>'sku','') is not null group by lower(payload->>'sku') having count(*)>1) then raise exception 'Duplicate existing SKU values; no automatic product merge';end if;
end $sku$;
create unique index if not exists products_sku_unique on public.products(lower(payload->>'sku')) where nullif(payload->>'sku','') is not null;
insert into public.store_schema_migrations(version) values('202611230010') on conflict(version) do nothing;
commit;
