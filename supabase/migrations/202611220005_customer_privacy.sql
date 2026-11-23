begin;
-- Customers use a deliberately sanitized RPC; internal notes remain staff-only.
drop policy if exists order_own_read on public.orders;
drop policy if exists order_items_own_read on public.order_items;
create or replace function public.customer_orders(p_page int default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(safe) from(select o.payload-array['notes','timeline','requestId'] safe from public.orders o join public.customers c on c.id=o.customer_id where c.auth_user_id=auth.uid() order by o.created_at desc limit 20 offset (greatest(1,least(p_page,10000))-1)*20)r),'[]');end$$;
revoke all on function public.customer_orders(int) from public,anon;grant execute on function public.customer_orders(int) to authenticated;
insert into public.store_schema_migrations(version) values('202611220005') on conflict(version) do nothing;
commit;
