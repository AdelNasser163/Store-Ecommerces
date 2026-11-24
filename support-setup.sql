-- DEPRECATED: do not run the old standalone support schema.
-- The only supported entry point is supabase/setup.sql.
-- It preserves support_messages and authorizes with public.user_roles.
-- support_private.admins is retained as legacy data; it grants no permissions.
-- See docs/supabase/PRODUCTION-REVIEW.md for limitations and migration order.
do $$begin raise exception 'Standalone support setup is retired. Review supabase/setup.sql and the migration guide instead.';end$$;
