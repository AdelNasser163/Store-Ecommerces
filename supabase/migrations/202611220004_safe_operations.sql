begin;
create or replace function public.admin_set_order_status(p_ids text[],p_status text) returns void language plpgsql security invoker set search_path='' as $$declare row public.orders%rowtype;label text;begin
 if not public.admin_access() or coalesce(cardinality(p_ids),0) not between 1 and 1000 then raise insufficient_privilege;end if;
 label=case p_status when 'new' then 'طلب جديد' when 'processing' then 'قيد التجهيز' when 'shipping' then 'جاري التوصيل' when 'completed' then 'مكتمل' when 'cancelled' then 'ملغي' end;if label is null then raise exception 'Invalid order status';end if;
 for row in select * from public.orders where id=any(p_ids) order by id for update loop
  if row.payload->>'statusKey'=p_status then continue;end if;
  update public.orders set payload=payload||jsonb_build_object('statusKey',p_status,'status',label,'statusUpdatedAt',now(),'timeline',coalesce(payload->'timeline','[]')||jsonb_build_array(jsonb_build_object('status',p_status,'at',now(),'by',auth.uid()))) where id=row.id;
 end loop;end$$;
revoke all on function public.admin_set_order_status(text[],text) from public,anon;grant execute on function public.admin_set_order_status(text[],text) to authenticated;
create or replace function public.admin_search(p_query text) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare term text=lower(left(trim(p_query),100));begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(to_jsonb(result)) from(select 'order' kind,id,coalesce(payload->'customer'->>'name',id) label,payload->'customer'->>'city' hint from public.orders where strpos(lower(id||payload::text),term)>0 union all select 'product',id,coalesce(payload->'name'->>'ar',payload->'name'->>'en',id),payload->>'sku' from public.products where strpos(lower(payload::text),term)>0 union all select 'customer',id::text,name,email from public.customers where strpos(lower(coalesce(name,'')||coalesce(email,'')),term)>0 limit 12)result),'[]');end$$;
revoke all on function public.admin_search(text) from public,anon;grant execute on function public.admin_search(text) to authenticated;
create or replace function public.customer_summary(p_ids uuid[]) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from(select c.id,count(o.id) count,coalesce(sum((o.payload->>'total')::numeric) filter(where o.payload->>'statusKey'<>'cancelled'),0) total,max(o.created_at) "lastOrder" from public.customers c left join public.orders o on o.customer_id=c.id where c.id=any(p_ids) group by c.id)row;
$$;
revoke all on function public.customer_summary(uuid[]) from public,anon;grant execute on function public.customer_summary(uuid[]) to authenticated;
insert into public.store_schema_migrations(version) values('202611220004') on conflict(version) do nothing;
commit;
