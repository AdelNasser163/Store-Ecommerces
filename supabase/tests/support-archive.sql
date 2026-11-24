-- Disposable fixture only. The runner sets the explicit authorization marker.
begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Disposable test database required';end if;end$$;
insert into auth.users(id,email,email_confirmed_at) values
 ('a0110000-0000-4000-8000-000000000001','archive-admin@fixture.invalid',now()),
 ('a0110000-0000-4000-8000-000000000002','archive-staff@fixture.invalid',now()),
 ('a0110000-0000-4000-8000-000000000003','archive-customer@fixture.invalid',now());
insert into public.user_roles(user_id,role) values('a0110000-0000-4000-8000-000000000001','admin'),('a0110000-0000-4000-8000-000000000002','staff');
select set_config('request.jwt.claim.sub','a0110000-0000-4000-8000-000000000003',true);
insert into public.support_messages(id,name,email,subject,message,consent) values('a0111000-0000-4000-8000-000000000001','Archive customer','archive-customer@fixture.invalid','product','Please preserve this complete conversation.',true);
insert into public.message_replies(id,message_id,sender_id,body,client_id) values('a0112000-0000-4000-8000-000000000001','a0111000-0000-4000-8000-000000000001','a0110000-0000-4000-8000-000000000003','Preserve this reply too.','a0113000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','a0110000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$declare affected int;begin
 delete from public.support_messages where id='a0111000-0000-4000-8000-000000000001';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Staff deleted support';end if;
 if exists(select 1 from public.deleted_support_messages) then raise exception 'Staff read archive';end if;
 begin perform public.restore_deleted_support_message(gen_random_uuid());raise exception 'Staff restored archive';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','a0110000-0000-4000-8000-000000000001',true);
set local role authenticated;
delete from public.support_messages where id='a0111000-0000-4000-8000-000000000001';
reset role;
-- Three ordinary recent messages now occupy the full customer rate allowance.
insert into public.support_messages(name,email,subject,message,consent) select 'Rate fixture','archive-customer@fixture.invalid','other','Existing recent message '||n,true from generate_series(1,3)n;
select set_config('request.jwt.claim.sub','a0110000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$begin
 perform set_config('almumez.support_restore','yes',true);
 begin insert into public.support_messages(name,email,subject,message,consent) values('Archive customer','archive-customer@fixture.invalid','other','Customer cannot bypass the limit.',true);raise exception 'Customer bypass accepted';exception when raise_exception then if SQLERRM<>'Please wait before submitting another request' then raise;end if;end;
 perform set_config('almumez.support_restore','',true);
end$$;
reset role;
select set_config('request.jwt.claim.sub','a0110000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare saved public.deleted_support_messages;restored uuid;begin
 select * into strict saved from public.deleted_support_messages where message_id='a0111000-0000-4000-8000-000000000001';
 if saved.payload->>'customer_id' is null or jsonb_array_length(saved.replies)<>1 or saved.deleted_by<>auth.uid() then raise exception 'Incomplete archive';end if;
 restored=public.restore_deleted_support_message(saved.id);
 if restored<>saved.message_id then raise exception 'Wrong restored ID';end if;
 if (select to_jsonb(m) from public.support_messages m where id=restored) is distinct from saved.payload then raise exception 'Full row or ownership not preserved';end if;
 if (select to_jsonb(r) from public.message_replies r where message_id=restored) is distinct from saved.replies->0 then raise exception 'Reply metadata lost';end if;
 perform public.restore_deleted_support_message(saved.id);
 if (select count(*) from public.message_replies where message_id=restored)<>1 then raise exception 'Repeated restore duplicated replies';end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.deleted_support_messages;raise exception 'Anon read archive';exception when insufficient_privilege then null;end;
 begin perform public.restore_deleted_support_message(gen_random_uuid());raise exception 'Anon restore';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
