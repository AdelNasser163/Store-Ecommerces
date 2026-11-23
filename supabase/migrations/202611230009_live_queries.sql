begin;
create or replace function public.catalog_match(p jsonb,f jsonb,skip text default '') returns boolean language plpgsql stable security invoker set search_path='' as $$declare amount numeric=public.effective_product_price(p);brand text=coalesce(p->'brand'->>'en',p->>'brand','');begin
 if skip<>'q' and coalesce(f->>'q','')<>'' and strpos(translate(lower(p::text),'أإآىة','ااايه'),translate(lower(f->>'q'),'أإآىة','ااايه'))=0 then return false;end if;
 if skip<>'dept' and coalesce(f->>'dept','')<>'' and p->>'category' is distinct from f->>'dept' then return false;end if;
 if skip<>'brands' and jsonb_array_length(coalesce(f->'brands','[]'))>0 and not (f->'brands' ? brand) then return false;end if;
 if skip<>'storage' and jsonb_array_length(coalesce(f->'storage','[]'))>0 and not exists(select 1 from jsonb_array_elements(coalesce(p->'variants','[]')) v where f->'storage' ? coalesce(v->'label'->>'en',v->'label'->>'ar',v->>'id')) then return false;end if;
 if skip<>'price' and ((nullif(f->>'min','') is not null and amount<(f->>'min')::numeric) or (nullif(f->>'max','') is not null and amount>(f->>'max')::numeric)) then return false;end if;
 if skip<>'rating' and coalesce((p->>'rating')::numeric,0)<coalesce((f->>'rating')::numeric,0) then return false;end if;
 if skip<>'availability' then
  if coalesce((f->>'stock')::boolean,false) and coalesce((p->>'stock')::int,0)<=0 then return false;end if;
  if coalesce((f->>'sale')::boolean,false) and amount>=greatest((p->>'price')::numeric,coalesce((p->>'oldPrice')::numeric,0)) then return false;end if;
  if coalesce((f->>'express')::boolean,false) and not coalesce((p->>'express')::boolean,false) then return false;end if;
 end if;return true;end$$;
revoke all on function public.catalog_match(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.catalog_match(jsonb,jsonb,text),public.effective_product_price(jsonb,text) to anon,authenticated;

create or replace function public.catalog_page(p_filter jsonb default '{}',p_page int default 1,p_per int default 12) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 with base as(select id,payload,public.effective_product_price(payload) price from public.products where published),matched as(select * from base where public.catalog_match(payload,p_filter)),counts as(select count(*) total from matched),bounds as(select total,greatest(1,least(coalesce(p_per,12),48)) per,greatest(1,least(greatest(1,coalesce(p_page,1)),ceil(total::numeric/greatest(1,least(coalesce(p_per,12),48)))::int)) page from counts),rows as(select m.* from matched m order by
 case when p_filter->>'sort'='price-asc' then price end asc,
 case when p_filter->>'sort'='price-desc' then price end desc,
 case when p_filter->>'sort'='rating' then (payload->>'rating')::numeric end desc nulls last,
 case when p_filter->>'sort'='newest' then nullif(payload->>'createdAt','')::timestamptz end desc nulls last,
 case when p_filter->>'sort'='discount' then 1-price/nullif(greatest((payload->>'price')::numeric,coalesce((payload->>'oldPrice')::numeric,0)),0) end desc nulls last,
 coalesce((payload->'offer'->>'sold')::numeric,0) desc,id limit(select per from bounds) offset(select (page-1)*per from bounds)),deps as(select payload->>'category' key,count(*) n from base where public.catalog_match(payload,p_filter,'dept') group by 1),brands as(select coalesce(payload->'brand'->>'en',payload->>'brand','') key,count(*) n from base where public.catalog_match(payload,p_filter,'brands') group by 1),storages as(select coalesce(v->'label'->>'en',v->'label'->>'ar',v->>'id') key,count(distinct b.id)n from base b cross join lateral jsonb_array_elements(coalesce(payload->'variants','[]'))v where public.catalog_match(payload,p_filter,'storage') group by 1)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id)) from rows),'[]'),'total',total,'page',page,'pages',greatest(1,ceil(total::numeric/per)::int),'facets',jsonb_build_object('departments',coalesce((select jsonb_object_agg(key,n) from deps where key is not null),'{}'),'brands',coalesce((select jsonb_object_agg(key,n) from brands where key is not null),'{}'),'storages',coalesce((select jsonb_object_agg(key,n) from storages where key is not null),'{}')),'departments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ar',coalesce(name->>'ar',id),'en',coalesce(name->>'en',id))) from public.categories),'[]'),'brands',coalesce((select jsonb_agg(distinct coalesce(payload->'brand'->>'en',payload->>'brand','')) from base),'[]'),'storages',coalesce((select jsonb_agg(distinct coalesce(v->'label'->>'en',v->'label'->>'ar',v->>'id')) from base cross join lateral jsonb_array_elements(coalesce(payload->'variants','[]'))v),'[]')) into result from bounds;
 return result;end$$;
revoke all on function public.catalog_page(jsonb,int,int) from public,anon,authenticated;
grant execute on function public.catalog_page(jsonb,int,int) to anon,authenticated;

create or replace function public.site_bootstrap(p_ids text[] default '{}') returns jsonb language sql stable security invoker set search_path='' as $$
 with chosen as(select id,payload from public.products where published and (id=any(p_ids[1:100]) or id in(select id from public.products where published and payload->'placements' ? 'home-flash' order by (payload->'placements'->>'home-flash')::numeric,id limit 8) or id in(select id from public.products where published and payload->'placements' ? 'home-featured' order by (payload->'placements'->>'home-featured')::numeric,id limit 8)) order by (id=any(p_ids[1:100])) desc,id limit 116),b as(select id,payload from public.bundles order by updated_at desc limit 12)
 select jsonb_build_object('products',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id)) from chosen),'[]'),'bundles',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id)) from b),'[]'),'settings',coalesce((select jsonb_object_agg(key,value) from public.settings where key in ('storeName','supportEmail','whatsappNumber','shipping','paymentMethods')),'{}'));
$$;
revoke all on function public.site_bootstrap(text[]) from public,anon,authenticated;
grant execute on function public.site_bootstrap(text[]) to anon,authenticated;

create or replace function public.admin_operational_summary() returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return jsonb_build_object('monthSales',(select coalesce(sum((payload->>'total')::numeric),0) from public.orders where created_at>=date_trunc('month',now()) and payload->>'statusKey'<>'cancelled'),'customers',jsonb_build_object('total',(select count(*) from public.customers),'purchases',(select coalesce(sum((payload->>'total')::numeric),0) from public.orders where payload->>'statusKey'<>'cancelled'),'returning',(select count(*) from(select customer_id from public.orders where customer_id is not null group by customer_id having count(*)>1)c),'cities',(select count(distinct city) from public.customers)),'bundles',jsonb_build_object('total',(select count(*) from public.bundles),'active',(select count(*) from public.bundles where coalesce((payload->>'enabled')::boolean,false) and (nullif(payload->>'startsAt','') is null or (payload->>'startsAt')::timestamptz<=now()) and (nullif(payload->>'endsAt','') is null or (payload->>'endsAt')::timestamptz>now()))),'bundleSales',coalesce((select jsonb_object_agg(id,jsonb_build_object('quantity',quantity,'total',total)) from(select i.payload->>'bundleId' id,sum(i.quantity)quantity,sum(i.quantity*i.unit_price)total from public.order_items i join public.orders o on o.id=i.order_id where i.payload->>'isBundle'='true' and o.payload->>'statusKey'<>'cancelled' group by 1)b),'{}'));
end$$;
revoke all on function public.admin_operational_summary() from public,anon,authenticated;
grant execute on function public.admin_operational_summary() to authenticated;
insert into public.store_schema_migrations(version) values('202611230009') on conflict(version) do nothing;
commit;
