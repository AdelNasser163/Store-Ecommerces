-- Run once in Supabase SQL Editor. No frontend service-role key is needed.
begin;
create schema if not exists support_private;
revoke all on schema support_private from public, anon, authenticated;
create table support_private.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create function public.is_support_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from support_private.admins where user_id=auth.uid());
$$;
revoke all on function public.is_support_admin() from public, anon;
grant execute on function public.is_support_admin() to authenticated;
create table public.support_messages(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 100),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 subject text not null check(subject in ('order','product','returns','other')),
 order_number text check(length(order_number)<=80),
 product_name text check(length(product_name)<=160),
 message text not null check(length(trim(message)) between 10 and 1000),
 consent boolean not null check(consent),
 status text not null default 'new' check(status in ('new','in_progress','resolved')),
 read_at timestamptz,
 created_at timestamptz not null default now(),
 check(order_number is null or subject in ('order','returns')),
 check(product_name is null or subject in ('product','returns'))
);
create index on public.support_messages(created_at desc);
create index on public.support_messages(subject,status);
alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon,authenticated;
grant insert(name,email,subject,order_number,product_name,message,consent) on public.support_messages to anon,authenticated;
grant select on public.support_messages to authenticated;
grant update(status,read_at) on public.support_messages to authenticated;
create policy submit_request on public.support_messages for insert to anon,authenticated with check(consent=true);
create policy admin_read on public.support_messages for select to authenticated using(public.is_support_admin());
create policy admin_update on public.support_messages for update to authenticated using(public.is_support_admin()) with check(public.is_support_admin());
-- Basic database-side throttling. Not a replacement for CAPTCHA against distributed abuse.
create function support_private.limit_submissions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),0));
 if (select count(*) from public.support_messages where lower(email)=lower(new.email) and created_at>now()-interval '10 minutes')>=3 then
  raise exception 'Please wait before submitting another request' using errcode='P0001';
 end if;
 return new;
end;
$$;
revoke all on function support_private.limit_submissions() from public,anon,authenticated;
create trigger limit_support_submissions before insert on public.support_messages for each row execute function support_private.limit_submissions();
create function public.list_support_messages(p_topic text default '',p_status text default '',p_query text default '',p_page integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_support_admin() then raise insufficient_privilege; end if;
 with filtered as (
 select * from public.support_messages where (p_topic='' or subject=p_topic) and (p_status='' or status=p_status)
 and (p_query='' or strpos(lower(concat_ws(' ',name,email,message,order_number,product_name)),lower(left(p_query,200)))>0)
 ), paged as (select * from filtered order by created_at desc,id limit 25 offset greatest(0,least(p_page,100000))*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb),'total',(select count(*) from filtered),
 'unread',(select count(*) from public.support_messages where read_at is null)) into result;
 return result;
end;
$$;
revoke all on function public.list_support_messages(text,text,text,integer) from public,anon;
grant execute on function public.list_support_messages(text,text,text,integer) to authenticated;
commit;
-- After creating an admin user in Authentication > Users, run separately:
-- insert into support_private.admins(user_id) values ('ADMIN_AUTH_USER_UUID');
