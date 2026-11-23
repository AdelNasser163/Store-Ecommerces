begin;
-- No request IDs/fingerprints are guessed or backfilled for legacy orders.
-- Duplicate checks run before installing any additional unique request index.
do $duplicates$ begin
 if exists(select 1 from public.orders where coalesce(request_id,nullif(payload->>'requestId','')) is not null group by coalesce(request_id,nullif(payload->>'requestId','')) having count(*)>1) then
  raise exception 'Duplicate historical checkout request IDs. Stop and review; no rows merged or removed';
 end if;
end $duplicates$;
create unique index if not exists orders_request_id_unique on public.orders(request_id) where request_id is not null;
do $identity_index$ begin
 if not exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.orders_request_id_unique') and i.indrelid='public.orders'::regclass and i.indisunique and i.indisvalid and i.indisready and i.indnatts=1 and i.indkey[0]=(select attnum from pg_attribute where attrelid='public.orders'::regclass and attname='request_id') and pg_get_expr(i.indpred,i.indrelid)='(request_id IS NOT NULL)') then raise exception 'Existing orders_request_id_unique has incompatible definition; review without deleting data';end if;
end $identity_index$;
create index if not exists orders_legacy_request_lookup on public.orders((payload->>'requestId')) where request_id is null;
-- Compatibility view: anonymous submission can use either name, but there is
-- only one table and the view must retain invoker security and restricted columns.
grant insert(name,email,subject,order_number,product_name,message,consent) on public.messages to anon;
revoke select,update,delete,truncate,references,trigger on public.messages from anon;
insert into public.store_schema_migrations(version) values('202611230008') on conflict(version) do nothing;
commit;
