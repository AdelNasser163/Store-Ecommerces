# PostgreSQL 17 first-deployment gate

The runner additionally loads the exact LF-only rls_auto_enable/ensure_rls fixture
from the verified pre-deployment backup. It proves the MD5(pg_get_functiondef)
algorithm, exercises the generated guard under valid and altered platform states,
and checks that the full deployment preserves the original routine and trigger.
The fixture is never a production migration; do not run it against MyStore.

Run `python tests/postgres17/tests.py --pg-bin /path/to/postgresql17/bin`.
The runner accepts no production DSN, clears PG environment variables, initializes
a new loopback-only temporary cluster and stops it in finally. No MyStore settings,
production data, existing database or backup are modified or restored.

It executes the ENTIRE DEPLOY_TO_SUPABASE.sql (including post-COMMIT verification),
checks first-install reapplication refusal, applies the general setup again and
all 11 individual migrations twice, then runs the project's SQL scenarios. Checks
cover independent concurrent checkout connections, role isolation, COD stock,
archive restoration with a full rate allowance, public JSON/REST privacy and
actual Storage table RLS. All 13 frontend subscription tables are checked in the
local publication. Auth and Storage schemas are fixtures; no Storage HTTP service
or Supabase Realtime service is installed. Event delivery/reconnect is not claimed.

Report: `docs/backend-audit/postgres17-results.json`. Current run uses PostgreSQL
17.12. Failure reports are not counted as successful runs; the initial projection
delimiter syntax error was repaired before the successful complete run.
