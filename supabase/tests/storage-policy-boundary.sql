begin;
do $$begin if current_setting('almumez.test_isolated',true) is distinct from 'yes' then raise exception 'Isolated database only';end if;end$$;
insert into auth.users(id,email,email_confirmed_at) values('c0170000-0000-4000-8000-000000000001','storage-admin@fixture.invalid',now()),('c0170000-0000-4000-8000-000000000002','storage-staff@fixture.invalid',now()),('c0170000-0000-4000-8000-000000000003','storage-customer@fixture.invalid',now());
insert into public.user_roles values('c0170000-0000-4000-8000-000000000001','admin'),('c0170000-0000-4000-8000-000000000002','staff');
-- Supabase service-level table grants are emulated by this isolated fixture.
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;
insert into storage.objects(id,bucket_id) values('c0171000-0000-4000-8000-000000000001','product-images');
set local role anon;
do $$begin
 if not exists(select 1 from storage.objects where bucket_id='product-images') then raise exception 'Public image read denied';end if;
 begin insert into storage.objects(bucket_id) values('product-images');raise exception 'Anon image upload allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','c0170000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$begin begin insert into storage.objects(bucket_id) values('product-images');raise exception 'Customer image upload allowed';exception when insufficient_privilege then null;end;end$$;
reset role;
select set_config('request.jwt.claim.sub','c0170000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into storage.objects(id,bucket_id) values('c0171000-0000-4000-8000-000000000002','product-images');
do $$declare affected int;begin
 delete from storage.objects where id='c0171000-0000-4000-8000-000000000002';get diagnostics affected=row_count;if affected<>0 then raise exception 'Staff image delete allowed';end if;
 begin update storage.objects set bucket_id='private-documents' where id='c0171000-0000-4000-8000-000000000002';raise exception 'Cross bucket image move allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','c0170000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare affected int;begin delete from storage.objects where id='c0171000-0000-4000-8000-000000000002';get diagnostics affected=row_count;if affected<>1 then raise exception 'Admin image delete denied';end if;end$$;
reset role;
rollback;
