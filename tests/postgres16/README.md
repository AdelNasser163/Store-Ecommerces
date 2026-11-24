# PostgreSQL 16 isolated gate

Run `python tests/postgres16/tests.py --pg-bin /path/to/postgresql16/bin`.
Requires PostgreSQL 16 with pgcrypto and Python 3; no pip packages. Never run
stub.sql against an existing database. Runner accepts no DSN, clears PG connection
environment variables, creates a new temporary cluster on loopback, then stops it.
The stopped cluster remains for inspection; no existing database is deleted.

Checks: full setup twice, single-apply messages view/grants, all individual
migrations sorted twice, tables/RLS/PK/grants/indexes/publication, actual project
SQL scenarios, and identical checkout attempts on independent connections.
Actual count is calculated, not fabricated to match a historical 113 count.
Auth/Storage are fixtures, not real Supabase services.

Evidence: docs/backend-audit/postgres16-results.json. Locally downloaded official
EDB PostgreSQL 16.11 and Python.org 3.12.10 live only in the OS temporary directory.
Initial missing-runtime-file and Windows pipe-handle failures are not passes.
