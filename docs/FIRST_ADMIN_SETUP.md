# First administrator and staff setup

No administrator was created and no production SQL was run by this task.
Use the existing project. First validate the complete setup on an approved,
disposable staging database and review `DEPLOYMENT.md`.

1. In Supabase Dashboard → Authentication → Users → Add user, enter the intended
   email/password and enable **Auto Confirm User** only after the project owner
   verifies this account belongs to the authorized person. Alternatively invite
   the intended account and have them complete verification.
2. Complete email verification and copy the Auth UUID. Never use browser metadata
   or a submitted email address as authority.
3. A trusted project owner can deliberately run the following **after** schema
   installation/approval, replacing the placeholder. The schema also enforces
   verified email for administrator assignments with a trigger.

```sql
do $$
declare chosen_user uuid := 'REPLACE_WITH_AUTH_UUID'::uuid;
begin
  if not exists(select 1 from auth.users where id=chosen_user
                and email_confirmed_at is not null) then
    raise exception 'Create and verify this Auth user first';
  end if;
  insert into public.user_roles(user_id,role) values(chosen_user,'admin')
  on conflict(user_id) do update set role=excluded.role;
end $$;
```

4. Sign in through `admin-login.html`. Confirm another customer account cannot
   access the dashboard or change roles.

## Staff

Create and verify a second Auth account. Use the guarded block above with `staff`
instead of `admin`, and `ON CONFLICT(user_id) DO NOTHING` when importing staff to
avoid accidentally demoting an existing administrator. A current administrator
can also assign an existing Auth UUID in Settings → Manage roles. This never
creates/invites Auth users or sends email automatically.

Staff can operate products/bundles/categories, read customers and the inbox,
update allowed inbox fields, and update valid order states/notes. Staff cannot
delete support messages, assign roles, edit protected settings, confirm online
payments or override commercial order data.

## Revoke access

After a trusted operator confirms the exact UUID, revoke its role record through
the project administration tools. The corresponding SQL operation is:

```sql
delete from public.user_roles where user_id='REPLACE_WITH_AUTH_UUID'::uuid;
```

This deliberately removes an authorization record, not business history. It is
documentation for a future authorized operation; it was not executed. Sign out
that account and revoke its Auth sessions as well. RLS checks the current table
role on subsequent requests; do not rely only on hiding UI links.

## Legacy support administrators

`support_private.admins` remains preserved but grants no access. Review each legacy
UUID against Authentication, confirmed email and current business authorization.
Assign staff or admin one account at a time. Missing/unverified/unapproved accounts
are not promoted. There is no bulk automatic promotion and no public role-grant RPC.
