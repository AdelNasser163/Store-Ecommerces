begin;
-- Only the administrator restore RPC, for an exact archived row, bypasses the
-- ordinary submission rate limit. GUC alone and customer/admin INSERT do not.
create or replace function support_private.limit_submissions() returns trigger language plpgsql security definer set search_path='' as $$begin
 if public.admin_role()='admin' and current_setting('almumez.support_restore',true)='yes'
 and exists(select 1 from public.deleted_support_messages d where d.message_id=new.id and d.restored_at is null and d.payload=to_jsonb(new)) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),0));
 if (select count(*) from public.support_messages where lower(email)=lower(new.email) and created_at>now()-interval '10 minutes')>=3 then raise exception 'Please wait before submitting another request';end if;
 return new;
end$$;
revoke all on function support_private.limit_submissions() from public,anon,authenticated;
-- Refresh the expanded projection AFTER customer_id and other fields exist.
create or replace view public.messages with(security_invoker=true) as select * from public.support_messages;
revoke all on public.messages from anon;
grant insert(name,email,subject,order_number,product_name,message,consent) on public.messages to anon;

create table if not exists public.deleted_support_messages(
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 replies jsonb not null default '[]' check(jsonb_typeof(replies)='array'),
 deleted_by uuid not null,
 deleted_at timestamptz not null default now(),
 restored_by uuid,
 restored_at timestamptz
);
-- Deliberately no FK to the deleted message or Auth account: retain audit history.
create index if not exists deleted_support_messages_created on public.deleted_support_messages(deleted_at desc,id);
alter table public.deleted_support_messages enable row level security;
revoke all on public.deleted_support_messages from public,anon,authenticated;
grant select on public.deleted_support_messages to authenticated;
drop policy if exists deleted_support_admin_read on public.deleted_support_messages;
create policy deleted_support_admin_read on public.deleted_support_messages for select to authenticated using(public.admin_role()='admin');

create or replace function public.archive_deleted_support_message() returns trigger language plpgsql security definer set search_path='' as $$begin
 if public.admin_role() is distinct from 'admin' then raise insufficient_privilege;end if;
 -- Serialize reply insertion against deletion before taking the reply snapshot.
 perform 1 from public.support_messages where id=old.id for update;
 insert into public.deleted_support_messages(message_id,payload,replies,deleted_by)
 values(old.id,to_jsonb(old),coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.message_replies r where r.message_id=old.id),'[]'::jsonb),auth.uid());
 return old;
end$$;
drop trigger if exists archive_deleted_support_message on public.support_messages;
create trigger archive_deleted_support_message before delete on public.support_messages for each row execute function public.archive_deleted_support_message();
revoke all on function public.archive_deleted_support_message() from public,anon,authenticated;

-- Preserve verified ownership during an admin-only archive restore. All normal
-- submissions still discard caller-supplied ownership and derive it from Auth.
create or replace function public.message_customer_sync() returns trigger language plpgsql security definer set search_path='' as $$declare verified_uid uuid;customer_uuid uuid;begin
 if public.admin_role()='admin' and current_setting('almumez.support_restore',true)='yes' and exists(select 1 from public.deleted_support_messages d where d.message_id=new.id and d.restored_at is null and d.payload=to_jsonb(new)) then return new;end if;
 new.customer_id=null;
 select id into verified_uid from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(new.email);
 if verified_uid is null then return new;end if;
 select id into customer_uuid from public.customers where auth_user_id=verified_uid order by created_at,id limit 1;
 if customer_uuid is null then
  insert into public.customers(email,phone,name,auth_user_id) values(lower(new.email),null,new.name,verified_uid)
  on conflict(lower(coalesce(email,'')),coalesce(phone,'')) do update set auth_user_id=excluded.auth_user_id where public.customers.auth_user_id is null or public.customers.auth_user_id=excluded.auth_user_id returning id into customer_uuid;
 end if;
 new.customer_id=customer_uuid;return new;
end$$;
revoke all on function public.message_customer_sync() from public,anon,authenticated;

create or replace function public.restore_deleted_support_message(p_archive_id uuid) returns uuid language plpgsql security definer set search_path='' as $$declare saved public.deleted_support_messages;previous_flag text;begin
 if public.admin_role() is distinct from 'admin' then raise insufficient_privilege;end if;
 select * into saved from public.deleted_support_messages where id=p_archive_id for update;
 if not found then raise exception 'Deleted message not found';end if;
 if saved.restored_at is not null then return saved.message_id;end if;
 if exists(select 1 from public.support_messages where id=saved.message_id) then raise exception 'Message ID already exists; nothing overwritten';end if;
 previous_flag=current_setting('almumez.support_restore',true);
 perform set_config('almumez.support_restore','yes',true);
 insert into public.support_messages select (jsonb_populate_record(null::public.support_messages,saved.payload)).*;
 -- No ON CONFLICT suppression: a reply collision must roll the whole restore
 -- back rather than silently dropping independently stored conversation data.
 insert into public.message_replies select * from jsonb_populate_recordset(null::public.message_replies,saved.replies);
 perform set_config('almumez.support_restore',coalesce(previous_flag,''),true);
 update public.deleted_support_messages set restored_at=now(),restored_by=auth.uid() where id=saved.id;
 return saved.message_id;
end$$;
revoke all on function public.restore_deleted_support_message(uuid) from public,anon,authenticated;
grant execute on function public.restore_deleted_support_message(uuid) to authenticated;

-- Old demo-order deletion conflicts with the relationship preservation guard.
-- Remove its authorization; never weaken the guard or remove order history.
drop policy if exists order_delete on public.orders;
revoke delete on public.orders from anon,authenticated;
-- The dashboard subscribes to category changes as well as product/order changes.
do $categories_realtime$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='categories') then
  alter publication supabase_realtime add table public.categories;
 end if;
end $categories_realtime$;
insert into public.store_schema_migrations(version) values('202611230011') on conflict(version) do nothing;
commit;
