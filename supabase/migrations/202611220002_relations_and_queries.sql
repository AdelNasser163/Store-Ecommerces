begin;
do $apply$ begin
alter table public.customers add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.support_messages add column if not exists customer_id uuid references public.customers(id) on delete set null;
create table if not exists public.product_images(id uuid primary key default gen_random_uuid(),product_id text not null references public.products(id) on delete cascade,url text not null,position int not null default 0,created_at timestamptz not null default now(),unique(product_id,url));
create table if not exists public.inventory_transactions(id uuid primary key default gen_random_uuid(),product_id text references public.products(id) on delete set null,old_quantity int not null,new_quantity int not null,changed_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
create table if not exists public.message_replies(id uuid primary key default gen_random_uuid(),message_id uuid not null references public.support_messages(id) on delete cascade,sender_id uuid not null references auth.users(id),body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default now(),client_id uuid not null unique);
create table if not exists public.payment_transactions(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),provider text not null,provider_id text unique,status text not null default 'pending' check(status in ('pending','paid','failed','cancelled')),amount numeric not null check(amount>=0),currency text not null default 'EGP',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(order_id,provider));
create table if not exists public.provider_events(id text primary key,provider text not null,processed_at timestamptz not null default now());
alter table public.provider_events add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete restrict;
alter table public.provider_events add column if not exists event_status text;
alter table public.provider_events add column if not exists amount numeric;
alter table public.provider_events add column if not exists currency text;
create table if not exists public.shipments(id uuid primary key default gen_random_uuid(),order_id text not null unique references public.orders(id),provider text not null,provider_id text,status text not null default 'pending',created_at timestamptz not null default now());
create index if not exists orders_customer_idx on public.orders(customer_id,created_at desc);
create index if not exists customer_auth_idx on public.customers(auth_user_id);
create index if not exists replies_parent_idx on public.message_replies(message_id,created_at);
create index if not exists images_product_idx on public.product_images(product_id,position);
create index if not exists orders_customer_search on public.orders(lower(payload->'customer'->>'name'));
alter table public.product_images enable row level security;alter table public.inventory_transactions enable row level security;alter table public.message_replies enable row level security;alter table public.payment_transactions enable row level security;alter table public.provider_events enable row level security;alter table public.shipments enable row level security;
revoke all on public.provider_events,public.payment_transactions,public.shipments from anon,authenticated;
grant select on public.payment_transactions,public.shipments to authenticated;
drop policy if exists payment_read on public.payment_transactions;
create policy payment_read on public.payment_transactions for select to authenticated using(public.admin_access() or exists(select 1 from public.orders o join public.customers c on c.id=o.customer_id where o.id=order_id and c.auth_user_id=auth.uid()));
drop policy if exists shipment_read on public.shipments;
create policy shipment_read on public.shipments for select to authenticated using(public.admin_access());
grant select on public.product_images to anon,authenticated;
drop policy if exists image_read on public.product_images;
create policy image_read on public.product_images for select using(exists(select 1 from public.products p where p.id=product_id and p.published) or public.admin_access());
grant select on public.inventory_transactions to authenticated;
drop policy if exists inventory_read on public.inventory_transactions;
create policy inventory_read on public.inventory_transactions for select to authenticated using(public.admin_access());
grant select,insert on public.message_replies to authenticated;
drop policy if exists replies_read on public.message_replies;
create policy replies_read on public.message_replies for select to authenticated using(public.admin_access() or exists(select 1 from public.support_messages m join public.customers c on c.id=m.customer_id where m.id=message_id and c.auth_user_id=auth.uid()));
drop policy if exists replies_send on public.message_replies;
create policy replies_send on public.message_replies for insert to authenticated with check(sender_id=auth.uid() and (public.admin_access() or exists(select 1 from public.support_messages m join public.customers c on c.id=m.customer_id where m.id=message_id and c.auth_user_id=auth.uid())));
grant update(name,phone,city,address) on public.customers to authenticated;
drop policy if exists customer_own_read on public.customers;
create policy customer_own_read on public.customers for select to authenticated using(auth_user_id=auth.uid());
drop policy if exists customer_update on public.customers;
create policy customer_update on public.customers for update to authenticated using(public.admin_access() or auth_user_id=auth.uid()) with check(public.admin_access() or auth_user_id=auth.uid());
drop policy if exists order_own_read on public.orders;
create policy order_own_read on public.orders for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=auth.uid()));
drop policy if exists order_items_own_read on public.order_items;
create policy order_items_own_read on public.order_items for select to authenticated using(exists(select 1 from public.orders o join public.customers c on c.id=o.customer_id where o.id=order_id and c.auth_user_id=auth.uid()));
drop policy if exists support_own_read on public.support_messages;
create policy support_own_read on public.support_messages for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=auth.uid()));
-- No arbitrary settings keys: secrets never enter this frontend-readable relation.
do $constraint$ begin if not exists(select 1 from pg_constraint where conrelid='public.settings'::regclass and conname='public_settings_keys') then alter table public.settings add constraint public_settings_keys check(key in ('storeName','supportEmail','whatsappNumber','monthlyGoal','shipping','paymentMethods','preferences')) not valid;end if;end $constraint$;
create or replace function public.product_relations_sync() returns trigger language plpgsql security definer set search_path='' as $$declare image text;idx int=0;begin
 if TG_OP='UPDATE' and (old.payload->>'stock')::int<>(new.payload->>'stock')::int then insert into public.inventory_transactions(product_id,old_quantity,new_quantity,changed_by) values(new.id,(old.payload->>'stock')::int,(new.payload->>'stock')::int,auth.uid());end if;
 for image in select distinct value from jsonb_array_elements_text(jsonb_build_array(new.payload->>'image')||coalesce(new.payload->'gallery','[]')) where value is not null and value<>'' loop insert into public.product_images(product_id,url,position) values(new.id,image,idx) on conflict(product_id,url) do nothing;idx=idx+1;end loop;return new;end$$;
drop trigger if exists product_relations_sync on public.products;
create trigger product_relations_sync after insert or update of payload on public.products for each row execute function public.product_relations_sync();
create or replace function public.order_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$declare customer_uuid uuid;verified_uid uuid;begin
 select id into verified_uid from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(new.payload->'customer'->>'email');
 if exists(select 1 from public.customers where lower(coalesce(email,''))=lower(coalesce(new.payload->'customer'->>'email','')) and coalesce(phone,'')=coalesce(new.payload->'customer'->>'phone','') and auth_user_id is not null and auth_user_id is distinct from verified_uid) then new.customer_id=null;return new;end if;
 insert into public.customers(name,email,phone,city,address,auth_user_id) values(new.payload->'customer'->>'name',lower(new.payload->'customer'->>'email'),new.payload->'customer'->>'phone',new.payload->'customer'->>'city',new.payload->'customer'->>'address',verified_uid) on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do update set updated_at=now(),auth_user_id=coalesce(public.customers.auth_user_id,excluded.auth_user_id) returning id into customer_uuid;
 new.customer_id=customer_uuid;return new;end$$;
drop trigger if exists order_customer_sync on public.orders;
create trigger order_customer_sync before insert on public.orders for each row execute function public.order_customer_sync();
create or replace function public.message_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then select c.id into new.customer_id from public.customers c join auth.users u on u.id=c.auth_user_id where c.auth_user_id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(new.email) limit 1;end if;return new;end$$;
drop trigger if exists message_customer_sync on public.support_messages;
create trigger message_customer_sync before insert on public.support_messages for each row execute function public.message_customer_sync();
-- A signed-in customer can submit a contact request but cannot mutate admin fields.
drop policy if exists support_customer_submit on public.support_messages;
create policy support_customer_submit on public.support_messages for insert to authenticated with check(consent and status='new' and not starred and not archived and not demo and (customer_id is null or exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=auth.uid())));

create or replace function public.admin_page(p_kind text,p_filter jsonb default '{}',p_page int default 1,p_per int default 25) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;query text;condition text;sorting text;table_name text;page int=greatest(1,least(p_page,100000));per int=greatest(1,least(p_per,100));term text=left(coalesce(p_filter->>'q',''),200);begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 if p_kind not in ('orders','products','bundles','messages','customers') then raise exception 'Unknown entity';end if;
 table_name=case when p_kind='messages' then 'support_messages' else p_kind end;
 if p_kind='orders' then
  condition=format('(%L='''' or strpos(lower(id||payload::text),lower(%L))>0)',term,term);
  if nullif(p_filter->>'status','') is not null then condition=condition||format(' and payload->>''statusKey''=%L',p_filter->>'status');end if;
  if nullif(p_filter->>'payment','') is not null then condition=condition||format(' and payload->>''payment''=%L',p_filter->>'payment');end if;
  if nullif(p_filter->>'from','') is not null then condition=condition||format(' and created_at>=%L::date',p_filter->>'from');end if;
  if nullif(p_filter->>'to','') is not null then condition=condition||format(' and created_at<%L::date+interval ''1 day''',p_filter->>'to');end if;
  sorting=case p_filter->>'sort' when 'total' then '(payload->>''total'')::numeric' when 'customer' then 'payload->''customer''->>''name''' else 'created_at' end||case when coalesce((p_filter->>'desc')::boolean,true) then ' desc' else ' asc' end||',id';
 elsif p_kind='products' then
  condition=format('(%L='''' or strpos(lower(payload::text),lower(%L))>0)',term,term);
  if nullif(p_filter->>'category','') is not null then condition=condition||format(' and payload->>''category''=%L',p_filter->>'category');end if;
  if p_filter->>'stock'='out' then condition=condition||' and (payload->>''stock'')::int<=0';elsif p_filter->>'stock'='low' then condition=condition||' and (payload->>''stock'')::int between 1 and 5';elsif p_filter->>'stock'='in' then condition=condition||' and (payload->>''stock'')::int>5';end if;
  if p_filter->>'published'='draft' then condition=condition||' and not published';elsif p_filter->>'published'='published' then condition=condition||' and published';end if;sorting='updated_at desc,id';
 elsif p_kind='messages' then
  condition=format('(%L='''' or strpos(lower(name||email||message),lower(%L))>0)',term,term);
  if p_filter->>'filter'='archived' then condition=condition||' and archived';else condition=condition||' and not archived';end if;
  if p_filter->>'filter'='unread' then condition=condition||' and read_at is null';elsif p_filter->>'filter'='starred' then condition=condition||' and starred';elsif p_filter->>'filter'='resolved' then condition=condition||' and status=''resolved''';end if;
  if nullif(p_filter->>'topic','') is not null then condition=condition||format(' and subject=%L',p_filter->>'topic');end if;sorting='created_at desc,id';
 elsif p_kind='customers' then condition=format('(%L='''' or strpos(lower(coalesce(name,'''')||coalesce(email,'''')||coalesce(phone,'''')||coalesce(city,'''')),lower(%L))>0)',term,term);sorting='created_at desc,id';
 else condition='true';if p_filter->>'status'='active' then condition=condition||' and (payload->>''enabled'')::boolean';elsif p_filter->>'status'='inactive' then condition=condition||' and not (payload->>''enabled'')::boolean';end if;sorting='updated_at desc,id';end if;
 query=format('with filtered as(select * from public.%I where %s),paged as(select * from filtered order by %s limit %s offset %s) select jsonb_build_object(''rows'',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),''[]''::jsonb),''total'',(select count(*) from filtered),''page'',%s,''per'',%s)',table_name,condition,sorting,per,(page-1)*per,page,per);
 execute query into result;return result;end$$;
revoke all on function public.admin_page(text,jsonb,int,int) from public,anon;grant execute on function public.admin_page(text,jsonb,int,int) to authenticated;

create or replace function public.admin_summary() returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 select jsonb_build_object('orders',jsonb_build_object('total',(select count(*) from public.orders),'new',(select count(*) from public.orders where payload->>'statusKey'='new'),'processing',(select count(*) from public.orders where payload->>'statusKey'='processing'),'shipping',(select count(*) from public.orders where payload->>'statusKey'='shipping'),'completed',(select count(*) from public.orders where payload->>'statusKey'='completed'),'cancelled',(select count(*) from public.orders where payload->>'statusKey'='cancelled')),'products',jsonb_build_object('total',(select count(*) from public.products),'low',(select count(*) from public.products where (payload->>'stock')::int between 1 and 5),'out',(select count(*) from public.products where (payload->>'stock')::int<=0),'value',(select coalesce(sum(public.effective_product_price(payload)*(payload->>'stock')::int),0) from public.products)),'unread',(select count(*) from public.support_messages where read_at is null and not archived),'customers',(select count(*) from public.customers),'categories',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.categories),'payments',(select coalesce(jsonb_agg(distinct payload->>'payment'),'[]'::jsonb) from public.orders),'recentNotifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]'::jsonb) from (select * from public.notifications order by created_at desc limit 8)n)) into result;return result;end$$;
revoke all on function public.admin_summary() from public,anon;grant execute on function public.admin_summary() to authenticated;

create or replace function public.admin_report(p_start timestamptz,p_end timestamptz,p_group text default 'product') returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.admin_access() then raise insufficient_privilege;end if;
 with matching as(select * from public.orders where created_at>=p_start and created_at<p_end),valid as(select * from matching where payload->>'statusKey'<>'cancelled'),items as(select o.payload->'customer'->>'city' city,i.payload,coalesce(p.payload->>'category','other') category from valid o join public.order_items i on i.order_id=o.id left join public.products p on p.id=i.product_id),groups as(select case p_group when 'city' then city when 'category' then category else coalesce(payload->'name'->>'ar',payload->>'name',payload->>'id') end label,sum((payload->>'quantity')::int) quantity,sum((payload->>'price')::numeric*(payload->>'quantity')::int) total from items group by 1)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(groups) order by total desc) from groups),'[]'::jsonb),'sales',(select coalesce(sum((payload->>'total')::numeric),0) from valid),'orders',(select count(*) from matching),'cancelled',(select count(*) from matching where payload->>'statusKey'='cancelled'),'completed',(select count(*) from matching where payload->>'statusKey'='completed'),'processed',(select count(*) from matching where payload->>'statusKey' in ('processing','shipping','completed')),'days',coalesce((select jsonb_object_agg(day_label,n) from(select to_char(created_at,'Dy') day_label,count(*) n from valid group by 1)d),'{}'::jsonb)) into result;return result;end$$;
revoke all on function public.admin_report(timestamptz,timestamptz,text) from public,anon;grant execute on function public.admin_report(timestamptz,timestamptz,text) to authenticated;
create or replace function public.admin_customer_detail(p_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$begin if not public.admin_access() then raise insufficient_privilege;end if;return jsonb_build_object('customer',(select to_jsonb(c) from public.customers c where id=p_id),'orders',coalesce((select jsonb_agg(to_jsonb(o)) from(select * from public.orders where customer_id=p_id order by created_at desc limit 25)o),'[]'::jsonb));end$$;
grant execute on function public.admin_customer_detail(uuid) to authenticated;revoke all on function public.admin_customer_detail(uuid) from public,anon;
create or replace function public.apply_verified_payment(p_event_id text,p_provider text,p_provider_id text,p_status text,p_amount numeric,p_currency text) returns void language plpgsql security definer set search_path='' as $$declare txn public.payment_transactions%rowtype;begin
 if p_status not in ('paid','failed','cancelled') then raise exception 'Invalid settlement state';end if;
 insert into public.provider_events(id,provider) values(p_event_id,p_provider) on conflict(id) do nothing;if not found then return;end if;
 select * into txn from public.payment_transactions where provider=p_provider and provider_id=p_provider_id for update;
 if not found or txn.amount<>p_amount or lower(txn.currency)<>lower(p_currency) then raise exception 'Payment settlement mismatch';end if;
 if txn.status='paid' then return;end if;
 update public.payment_transactions set status=p_status,updated_at=now() where id=txn.id;
 if p_status='paid' then update public.orders set payload=payload||jsonb_build_object('paymentVerified',true,'paymentStatus','paid') where id=txn.order_id;end if;end$$;
revoke all on function public.apply_verified_payment(text,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.apply_verified_payment(text,text,text,text,numeric,text) to service_role;
-- Backfill without replacing existing orders/products/customers.
insert into public.product_images(product_id,url,position) select p.id,image.value,0 from public.products p cross join lateral jsonb_array_elements_text(jsonb_build_array(p.payload->>'image')||coalesce(p.payload->'gallery','[]')) image where image.value is not null and image.value<>'' on conflict(product_id,url) do nothing;
-- Historical order/customer associations remain unchanged. Any explicit backfill
-- requires a separately reviewed import; do not infer business ownership here.
do $$declare table_name text;begin foreach table_name in array array['message_replies','customers','product_images','inventory_transactions','shipments'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then execute format('alter publication supabase_realtime add table public.%I',table_name);end if;end loop;end$$;
insert into public.store_schema_migrations(version) values('202611220002') on conflict(version) do nothing;end $apply$;
commit;
